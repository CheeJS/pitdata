"""
ML Service for F1 Race Predictions
Uses XGBoost model when available, falls back to weighted heuristics.
Includes weather adjustments for wet conditions.
"""

import os
import json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Try xgboost
try:
    import xgboost as xgb
    import numpy as np
    HAS_XGB = True
except ImportError:
    HAS_XGB = False
    np = None

# Model paths
MODEL_DIR = os.path.join(os.path.dirname(__file__), '..', 'models')
MODEL_PATH = os.path.join(MODEL_DIR, 'f1_xgb.json')
MODEL_META_PATH = os.path.join(MODEL_DIR, 'f1_xgb_meta.json')

# Wet weather specialists (boost in rain)
WET_SPECIALISTS = ['HAM', 'VER', 'ALO', 'SAI', 'RUS']


def get_db_session():
    """Reuse session from f1_service"""
    from services.f1_service import get_db_session as f1_session
    return f1_session()


def load_trained_model():
    """Load XGBoost model if available."""
    if not HAS_XGB:
        return None, None
    
    if not os.path.exists(MODEL_PATH):
        return None, None
    
    try:
        model = xgb.XGBRegressor()
        model.load_model(MODEL_PATH)
        
        meta = {}
        if os.path.exists(MODEL_META_PATH):
            with open(MODEL_META_PATH) as f:
                meta = json.load(f)
        
        return model, meta
    except Exception as e:
        print(f"Error loading model: {e}")
        return None, None


def get_weather_for_race(race_code, prediction_year):
    """Get weather conditions for a race (historical or forecast)."""
    from services.f1_service import Race
    from sqlalchemy import text
    
    session = get_db_session()
    
    try:
        # Find the race
        race = session.query(Race).filter(
            Race.year == prediction_year - 1,  # Use last year's weather as proxy
        ).filter(
            Race.race_name.ilike(f'%{race_code}%') | 
            Race.circuit_name.ilike(f'%{race_code}%')
        ).first()
        
        if not race:
            return {"conditions": "Dry", "temperature": 25}
        
        # Query weather directly using SQL to avoid import issues
        result = session.execute(
            text("SELECT conditions, temperature, precipitation FROM race_weather WHERE race_id = :rid"),
            {"rid": race.id}
        ).fetchone()
        
        if result:
            return {
                "conditions": result[0] or "Dry",
                "temperature": result[1] or 25,
                "precipitation": result[2] or 0
            }
    except Exception as e:
        pass
    finally:
        session.close()
    
    return {"conditions": "Dry", "temperature": 25}


def extract_features(race_code, prediction_year, lookback_years=2):
    """Extract ML features for all drivers."""
    from services.f1_service import get_season_standings, Race, Result
    
    session = get_db_session()
    
    standings_year = prediction_year - 1
    historical_years = [prediction_year - i for i in range(1, lookback_years + 1)]
    
    # Check season_entries.json first
    drivers = []
    season_file = os.path.join(os.path.dirname(__file__), '..', 'data', 'season_entries.json')
    if os.path.exists(season_file):
        try:
            with open(season_file, 'r') as f:
                entries = json.load(f)
                if str(prediction_year) in entries:
                    drivers = entries[str(prediction_year)]
                    # Sort by grid or some default order
                    drivers.sort(key=lambda x: x.get('grid', 99))
        except Exception as e:
            print(f"Error loading season entries: {e}")

    # Fallback to standings if no JSON entry
    if not drivers:
        standings_data = get_season_standings(standings_year)
        if not standings_data:
            session.close()
            return None
        drivers = standings_data.get("drivers", [])[:22]
    
    features = []
    driver_info = []
    features = []
    driver_info = []
    
    for idx, d in enumerate(drivers):
        code = d.get("code")
        
        global_races = global_wins = global_podiums = global_dnfs = 0
        circuit_races = circuit_podiums = 0
        circuit_positions = []
        recent_positions = []
        sprint_positions = []
        
        for year in historical_years:
            races = session.query(Race).filter(Race.year == year).all()
            
            for race in races:
                is_target = race_code.upper() in (race.race_name or "").upper() or \
                           race_code.upper() in (race.circuit_name or "").upper()
                
                # Race result
                result = session.query(Result).filter(
                    Result.race_id == race.id,
                    Result.session_type == 'R',
                    Result.driver_code == code
                ).first()
                
                if result:
                    global_races += 1
                    if result.position == 1:
                        global_wins += 1
                    if result.position and result.position <= 3:
                        global_podiums += 1
                    if result.status and ("DNF" in result.status.upper() or "Retired" in result.status):
                        global_dnfs += 1
                    
                    if is_target and result.position:
                        circuit_races += 1
                        circuit_positions.append(result.position)
                        if result.position <= 3:
                            circuit_podiums += 1
                    
                    if year == standings_year and result.position:
                        recent_positions.append(result.position)
                
                # Sprint result
                sprint = session.query(Result).filter(
                    Result.race_id == race.id,
                    Result.session_type == 'Sprint',
                    Result.driver_code == code
                ).first()
                
                if sprint and sprint.position:
                    sprint_positions.append(sprint.position)
        
        global_races = max(global_races, 1)
        
        feature_vec = {
            "grid_position": 10,  # Will be updated with actual quali if available
            "circuit_avg_position": sum(circuit_positions) / len(circuit_positions) if circuit_positions else 10,
            "circuit_races": circuit_races,
            "recent_form": sum(recent_positions[-5:]) / len(recent_positions[-5:]) if recent_positions else 10,
            "is_sprint_weekend": 0,
            "sprint_position": sum(sprint_positions[-3:]) / len(sprint_positions[-3:]) if sprint_positions else 10,
            "round": 1,
            "global_win_rate": global_wins / global_races,
            "circuit_podium_rate": circuit_podiums / max(circuit_races, 1),
            "dnf_rate": global_dnfs / global_races,
            "championship_position": idx + 1,
            "points_share": d.get("points", 0) / max(sum(x.get("points", 1) for x in drivers), 1)
        }
        
        features.append(feature_vec)
        driver_info.append({
            "code": code,
            "name": d.get("name"),
            "team": d.get("team"),
            "points": d.get("points", 0)
        })
    
    session.close()
    return features, driver_info


def predict_race(race_code, prediction_year=None, lookback_years=2):
    """Predict race outcomes using ML model or heuristics."""
    
    if prediction_year is None:
        prediction_year = datetime.now().year + 1
    
    result = extract_features(race_code, prediction_year, lookback_years)
    if not result:
        return {"error": "Could not extract features"}
    
    features, driver_info = result
    
    # Try to load trained model
    model, meta = load_trained_model()
    
    # Get weather
    weather = get_weather_for_race(race_code, prediction_year)
    is_wet = weather.get("conditions") in ["Wet", "Mixed"]
    
    if model and HAS_XGB:
        # Use XGBoost model
        feature_cols = ['grid_position', 'circuit_avg_position', 'circuit_races',
                       'recent_form', 'is_sprint_weekend', 'sprint_position', 'round']
        
        X = np.array([[f.get(col, 10) for col in feature_cols] for f in features])
        predicted_positions = model.predict(X)
        
        # Lower position = better score
        scores = [max(21 - pos, 1) for pos in predicted_positions]
        model_type = "xgboost"
    else:
        # Fallback to heuristics
        scores = []
        for f in features:
            score = 0
            score += (11 - f.get("circuit_avg_position", 10)) / 10 * 0.30
            score += f.get("global_win_rate", 0) * 0.25
            score += (11 - f.get("recent_form", 10)) / 10 * 0.25
            score += f.get("points_share", 0) * 0.20
            scores.append(max(score, 0.01))
        model_type = "weighted_heuristic"
    
    # Weather adjustment
    if is_wet:
        for i, d in enumerate(driver_info):
            if d["code"] in WET_SPECIALISTS:
                scores[i] *= 1.15
    
    # Convert to probabilities
    total = sum(scores)
    probabilities = [s / total * 100 for s in scores]
    
    # Build output
    output = []
    for i, d in enumerate(driver_info):
        output.append({
            "code": d["code"],
            "name": d["name"],
            "team": d["team"],
            "win_probability": float(round(probabilities[i], 1)),
            "podium_probability": float(round(min(probabilities[i] * 2.5, 95), 1)),
            "confidence": float(round(features[i].get("circuit_races", 0) / 3 * 100, 0)),
            "wet_boost": d["code"] in WET_SPECIALISTS and is_wet,
            "features": {
                "circuit_avg": float(round(features[i].get("circuit_avg_position", 10), 1)),
                "recent_form": float(round(features[i].get("recent_form", 10), 1)),
                "global_win_rate": float(round(features[i].get("global_win_rate", 0) * 100, 1))
            }
        })
    
    output.sort(key=lambda x: x["win_probability"], reverse=True)
    
    return {
        "race": race_code,
        "prediction_year": prediction_year,
        "model_type": model_type,
        "weather": weather,
        "results": output[:10],
        "model_confidence": round(sum(1 for f in features if f.get("circuit_races", 0) >= 1) / len(features) * 100, 0)
    }
