"""
POST-QUALIFYING Prediction Script
Run this AFTER Saturday qualifying to update predictions with actual Q3 times

Usage:
    python generate_predictions_post_quali.py <race_code> <quali_times_file>
    
Example:
    python generate_predictions_post_quali.py MON actual_quali_monaco.json

Where actual_quali_monaco.json contains:
{
    "VER": 70.123,
    "NOR": 69.987,
    "LEC": 70.456,
    ...
}
"""

import json
import sys
from generate_predictions_fastf1 import predict_race_advanced_with_actual_quali
from services.f1_service import get_db_session, Race

def update_prediction_with_actual_quali(race_code, actual_quali_times, output_dir='predictions/2026'):
    """
    Update prediction with actual qualifying times from Saturday
    """
    
    print(f"\n🏁 Updating {race_code} prediction with ACTUAL qualifying times")
    print(f"   This will be MUCH more accurate than estimated quali!\n")
    
    # Get race info
    session = get_db_session()
    race = session.query(Race).filter_by(year=2026).filter(
        Race.circuit_name.ilike(f"%{race_code}%")
    ).first()
    session.close()
    
    if not race:
        print(f"✗ Race not found for code: {race_code}")
        return
    
    # Generate prediction with actual quali
    prediction = predict_race_advanced_with_actual_quali(
        race.circuit_name,
        race.round,
        actual_quali_times,
        2026
    )
    
    if prediction:
        # Save
        filepath = f'{output_dir}/{race_code.upper()}.json'
        with open(filepath, 'w') as f:
            json.dump(prediction, f, indent=2)
        
        print(f"\n✅ Updated prediction saved to: {filepath}")
        print(f"   Model confidence: {prediction['model_confidence']}% (POST-QUALIFYING)")
        print(f"\n   Top 3:")
        for i, result in enumerate(prediction['results'][:3], 1):
            print(f"   {i}. {result['name']} ({result['win_probability']:.1f}%)")
    

def main():
    if len(sys.argv) < 3:
        print("Usage: python generate_predictions_post_quali.py <race_code> <quali_json>")
        print("\nExample:")
        print("  python generate_predictions_post_quali.py MON monaco_quali.json")
        return
    
    race_code = sys.argv[1]
    quali_file = sys.argv[2]
    
    # Load actual qualifying times
    try:
        with open(quali_file, 'r') as f:
            actual_quali = json.load(f)
        
        print(f"✓ Loaded {len(actual_quali)} qualifying times from {quali_file}")
        
    except Exception as e:
        print(f"✗ Error loading qualifying file: {e}")
        return
    
    # Update prediction
    update_prediction_with_actual_quali(race_code, actual_quali)


if __name__ == "__main__":
    main()
