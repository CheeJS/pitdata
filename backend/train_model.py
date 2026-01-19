"""
Train XGBoost model for F1 race predictions.
Uses historical data (2022-2025) to predict race outcomes.

Run: python train_model.py
Rerun: Once per year after season ends (December)
"""

import os
import sys
import json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Check for required packages
try:
    import xgboost as xgb
    import numpy as np
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import mean_absolute_error
except ImportError as e:
    print(f"Missing package: {e}")
    print("Run: pip install xgboost scikit-learn numpy")
    sys.exit(1)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from services.f1_service import Race, Result

DB_URL = os.getenv("DATABASE_URL")
engine = create_engine(DB_URL)
Session = sessionmaker(bind=engine)

# Model output path
MODEL_DIR = os.path.join(os.path.dirname(__file__), 'models')
MODEL_PATH = os.path.join(MODEL_DIR, 'f1_xgb.json')


def get_historical_data(years):
    """
    Extract training data from database.
    Each sample = one driver's race result.
    """
    session = Session()
    
    samples = []
    
    for year in years:
        races = session.query(Race).filter(Race.year == year).all()
        
        for race in races:
            # Get race results
            race_results = session.query(Result).filter(
                Result.race_id == race.id,
                Result.session_type == 'R'
            ).all()
            
            # Check for sprint
            sprint_results = session.query(Result).filter(
                Result.race_id == race.id,
                Result.session_type == 'Sprint'
            ).all()
            sprint_dict = {r.driver_code: r.position for r in sprint_results}
            has_sprint = len(sprint_results) > 0
            
            for res in race_results:
                if res.position is None or res.position > 20:
                    continue
                
                # Get driver's historical stats at this circuit
                circuit_history = session.query(Result).join(Race).filter(
                    Race.circuit_name == race.circuit_name,
                    Race.year < year,
                    Result.driver_code == res.driver_code,
                    Result.session_type == 'R'
                ).all()
                
                circuit_avg = sum(r.position or 10 for r in circuit_history) / max(len(circuit_history), 1) if circuit_history else 10
                circuit_races = len(circuit_history)
                
                # Get recent form (last 5 races before this one)
                recent_races = session.query(Result).join(Race).filter(
                    Race.year == year,
                    Race.round < race.round,
                    Result.driver_code == res.driver_code,
                    Result.session_type == 'R'
                ).order_by(Race.round.desc()).limit(5).all()
                
                recent_form = sum(r.position or 10 for r in recent_races) / max(len(recent_races), 1) if recent_races else 10
                
                # Get grid position
                grid = res.grid_position or 10
                
                # Sprint position if applicable
                sprint_pos = sprint_dict.get(res.driver_code, 10) if has_sprint else 10
                
                sample = {
                    'grid_position': grid,
                    'circuit_avg_position': circuit_avg,
                    'circuit_races': circuit_races,
                    'recent_form': recent_form,
                    'is_sprint_weekend': 1 if has_sprint else 0,
                    'sprint_position': sprint_pos,
                    'round': race.round,
                    # Target
                    'finish_position': res.position
                }
                samples.append(sample)
    
    session.close()
    return samples


def train_model():
    """Train XGBoost model on historical data."""
    
    print("="*60)
    print("F1 PREDICTION MODEL TRAINER")
    print("="*60)
    
    # Get current year
    current_year = datetime.now().year
    
    # Use last 4 years of completed data
    training_years = [current_year - i for i in range(1, 5)]
    training_years = [y for y in training_years if y >= 2022]
    
    print(f"\nTraining years: {training_years}")
    
    # Extract data
    print("\n[1/4] Extracting training data...")
    samples = get_historical_data(training_years)
    print(f"      Found {len(samples)} samples")
    
    if len(samples) < 100:
        print("ERROR: Not enough training data. Seed more years first.")
        return
    
    # Prepare features
    print("[2/4] Preparing features...")
    
    feature_cols = ['grid_position', 'circuit_avg_position', 'circuit_races', 
                    'recent_form', 'is_sprint_weekend', 'sprint_position', 'round']
    
    X = np.array([[s[col] for col in feature_cols] for s in samples])
    y = np.array([s['finish_position'] for s in samples])
    
    # Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    print(f"      Train: {len(X_train)}, Test: {len(X_test)}")
    
    # Train
    print("[3/4] Training XGBoost model...")
    
    model = xgb.XGBRegressor(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.1,
        objective='reg:squarederror',
        random_state=42
    )
    
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    print(f"      Mean Absolute Error: {mae:.2f} positions")
    
    # Feature importance
    importance = dict(zip(feature_cols, model.feature_importances_))
    print("\n      Feature Importance:")
    for feat, imp in sorted(importance.items(), key=lambda x: -x[1]):
        print(f"        {feat}: {imp:.3f}")
    
    # Save
    print("\n[4/4] Saving model...")
    os.makedirs(MODEL_DIR, exist_ok=True)
    model.save_model(MODEL_PATH)
    
    # Save metadata
    metadata = {
        'training_years': training_years,
        'samples': len(samples),
        'mae': round(mae, 2),
        'features': feature_cols,
        'trained_at': datetime.now().isoformat()
    }
    with open(MODEL_PATH.replace('.json', '_meta.json'), 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print(f"      Saved to: {MODEL_PATH}")
    print("\n" + "="*60)
    print("TRAINING COMPLETE")
    print("="*60)


if __name__ == "__main__":
    train_model()
