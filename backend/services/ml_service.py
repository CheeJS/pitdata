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


def extract_features(race_code, prediction_year, lookback_years=3):
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
    
    # Calculate team strengths from previous season
    team_strengths = {}
    for team_name in set(d.get("team") for d in drivers if d.get("team")):
        team_results = session.query(Result).join(Race).filter(
            Race.year == standings_year,
            Result.session_type == 'R',
            Result.team_name.ilike(f"%{team_name}%")
        ).all()
        
        if team_results:
            avg_position = sum(r.position for r in team_results if r.position) / len([r for r in team_results if r.position])
            team_strengths[team_name] = max(21 - avg_position, 1) / 20  # Normalize 0-1
        else:
            team_strengths[team_name] = 0.5
    
    for idx, d in enumerate(drivers):
        code = d.get("code")
        
        # Weighted tracking (recent year gets more weight)
        weighted_races = weighted_wins = weighted_podiums = weighted_dnfs = 0
        global_races = global_wins = global_podiums = global_dnfs = 0
        circuit_races = circuit_podiums = 0
        circuit_positions = []
        weighted_circuit_positions = []
        recent_positions = []
        sprint_positions = []
        
        for year_idx, year in enumerate(historical_years):
            # Weight: 70% for most recent year, 30% split for older years
            if year_idx == 0:  # Most recent year (2025 for 2026 predictions)
                weight = 0.70
            else:  # Older years split remaining 30%
                weight = 0.30 / (len(historical_years) - 1)
            
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
                    # Unweighted tracking
                    global_races += 1
                    if result.position == 1:
                        global_wins += 1
                    if result.position and result.position <= 3:
                        global_podiums += 1
                    if result.status and ("DNF" in result.status.upper() or "Retired" in result.status):
                        global_dnfs += 1
                    
                    # Weighted tracking
                    if result.position:
                        weighted_races += weight
                        if result.position == 1:
                            weighted_wins += weight
                        if result.position <= 3:
                            weighted_podiums += weight
                    if result.status and ("DNF" in result.status.upper() or "Retired" in result.status):
                        weighted_dnfs += weight
                    
                    if is_target and result.position:
                        circuit_races += 1
                        circuit_positions.append(result.position)
                        weighted_circuit_positions.append(result.position * weight)
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
        weighted_races = max(weighted_races, 1)
        
        # Get team strength
        team_strength = team_strengths.get(d.get("team"), 0.5)
        
        feature_vec = {
            "grid_position": 10,  # Will be updated with actual quali if available
            "circuit_avg_position": sum(weighted_circuit_positions) / sum([1 for _ in weighted_circuit_positions]) if weighted_circuit_positions else 10,
            "circuit_races": circuit_races,
            "recent_form": sum(recent_positions[-5:]) / len(recent_positions[-5:]) if recent_positions else 10,
            "is_sprint_weekend": 0,
            "sprint_position": sum(sprint_positions[-3:]) / len(sprint_positions[-3:]) if sprint_positions else 10,
            "round": 1,
            "global_win_rate": weighted_wins / weighted_races,  # Use weighted win rate
            "circuit_podium_rate": circuit_podiums / max(circuit_races, 1),
            "dnf_rate": weighted_dnfs / weighted_races,  # Use weighted DNF rate
            "championship_position": idx + 1,
            "points_share": d.get("points", 0) / max(sum(x.get("points", 1) for x in drivers), 1),
            "team_strength": team_strength  # NEW: Team performance from previous season
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


def predict_race(race_code, prediction_year=None, lookback_years=3):
    """Predict race outcomes using ML model or heuristics."""
    
    if prediction_year is None:
        prediction_year = datetime.now().year + 1
    
    # First, try to load pre-computed prediction from file
    predictions_dir = os.path.join(os.path.dirname(__file__), '..', 'predictions', str(prediction_year))
    
    # Map common race codes to our generated file codes
    code_map = {
        'AUT': 'SPI',  # Austria -> Spielberg
        'CHN': 'SHA',  # China -> Shanghai  
        'HUN': 'BUD',  # Hungary -> Budapest
        'ITA': 'MON',  # Italy -> Monza
        'NED': 'ZAN',  # Netherlands -> Zandvoort
        'GBR': 'SIL',  # Britain -> Silverstone
        'BEL': 'SPA',  # Belgium -> Spa
        'ESP': 'BAR',  # Spain -> Barcelona (old)
        'AZE': 'BAK',  # Azerbaijan -> Baku
        'SGP': 'MAR',  # Singapore -> Marina Bay
        'USA': 'AUS',  # United States -> Austin
        'BRA': 'SÃO',  # Brazil -> São Paulo
        'QAT': 'LUS',  # Qatar -> Lusail
        'UAE': 'YAS',  # Abu Dhabi -> Yas Marina
        'SAU': 'JED',  # Saudi Arabia -> Jeddah
        'BHR': 'SAK',  # Bahrain -> Sakhir
        'JPN': 'SUZ',  # Japan -> Suzuka
        'CAN': 'MTL',  # Canada -> Montreal
        'MCO': 'MCO',  # Monaco -> Monaco
        'MEX': 'MEX',  # Mexico -> Mexico City
        'LAS': 'LAS',  # Las Vegas
        'MIA': 'MIA',  # Miami
        'AUS': 'AUS',  # For Austin (USA GP) - might conflict with Australian
    }
    
    # Try mapped code first, then original
    file_code = code_map.get(race_code.upper(), race_code.upper())
    prediction_file = os.path.join(predictions_dir, f'{file_code}.json')
    
    # Also try original code if mapped doesn't exist
    if not os.path.exists(prediction_file):
        prediction_file = os.path.join(predictions_dir, f'{race_code.upper()}.json')
    
    if os.path.exists(prediction_file):
        try:
            with open(prediction_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                print(f"✓ Loaded prediction from {prediction_file}")
                return data
        except Exception as e:
            print(f"Error loading prediction file: {e}")
    
    # Fallback to computing prediction
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
        # Fallback to heuristics (updated weights with team strength)
        scores = []
        for f in features:
            score = 0
            score += (11 - f.get("circuit_avg_position", 10)) / 10 * 0.25  # Circuit performance
            score += f.get("global_win_rate", 0) * 0.25  # Historical wins
            score += (11 - f.get("recent_form", 10)) / 10 * 0.20  # Recent form
            score += f.get("points_share", 0) * 0.15  # Championship standing
            score += f.get("team_strength", 0.5) * 0.15  # NEW: Team performance
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
