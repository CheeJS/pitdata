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
import os
from dotenv import load_dotenv
load_dotenv()

from generate_predictions_db import predict_race_advanced_with_actual_quali
from services.f1_service import get_db_session, Race

# S3 bucket config
S3_BUCKET = os.getenv('S3_PREDICTIONS_BUCKET', 'pitdata-prediction')
AWS_REGION = os.getenv('AWS_REGION', 'ap-southeast-2')


def upload_to_s3(local_filepath, race_code, year, stage='postquali'):
    """Upload prediction JSON to S3 at {year}/{stage}/{RACE}.json"""
    try:
        import boto3
        from botocore.exceptions import NoCredentialsError, ClientError

        s3 = boto3.client(
            's3',
            region_name=AWS_REGION,
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
        )

        s3_key = f"{year}/{stage}/{race_code.upper()}.json"

        s3.upload_file(
            local_filepath,
            S3_BUCKET,
            s3_key,
            ExtraArgs={'ContentType': 'application/json'}
        )

        print(f"\n✅ Uploaded to S3: s3://{S3_BUCKET}/{s3_key}")
        print(f"   Public URL: https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{s3_key}")
        return True

    except ImportError:
        print("\n⚠️  boto3 not installed. Run: pip install boto3")
        return False
    except NoCredentialsError:
        print("\n⚠️  AWS credentials not set. Add AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY to .env")
        return False
    except Exception as e:
        print(f"\n⚠️  S3 upload failed: {e}")
        return False

# Fallback race info for 2026 season (used when DB is unavailable)
RACE_INFO_2026 = {
    "AUS": {"circuit_name": "Melbourne",       "round": 1},
    "CHN": {"circuit_name": "Shanghai",        "round": 2},
    "JPN": {"circuit_name": "Suzuka",          "round": 3},
    "BHR": {"circuit_name": "Sakhir",          "round": 4},
    "SAU": {"circuit_name": "Jeddah",          "round": 5},
    "MIA": {"circuit_name": "Miami",           "round": 6},
    "EMI": {"circuit_name": "Imola",           "round": 7},
    "MON": {"circuit_name": "Monte Carlo",     "round": 8},
    "ESP": {"circuit_name": "Barcelona",       "round": 9},
    "CAN": {"circuit_name": "Montreal",        "round": 10},
    "AUT": {"circuit_name": "Spielberg",       "round": 11},
    "GBR": {"circuit_name": "Silverstone",     "round": 12},
    "BEL": {"circuit_name": "Spa",             "round": 13},
    "HUN": {"circuit_name": "Budapest",        "round": 14},
    "NED": {"circuit_name": "Zandvoort",       "round": 15},
    "ITA": {"circuit_name": "Monza",           "round": 16},
    "MAD": {"circuit_name": "Madrid",          "round": 17},
    "AZB": {"circuit_name": "Baku",            "round": 18},
    "SIN": {"circuit_name": "Marina Bay",      "round": 19},
    "USA": {"circuit_name": "Austin",          "round": 20},
    "MEX": {"circuit_name": "Mexico",          "round": 21},
    "BRA": {"circuit_name": "Sao Paulo",       "round": 22},
    "LVG": {"circuit_name": "Las Vegas",       "round": 23},
    "QAT": {"circuit_name": "Lusail",          "round": 24},
    "ABU": {"circuit_name": "Yas Marina",      "round": 25},
}

def update_prediction_with_actual_quali(race_code, actual_quali_times, output_dir='predictions/2026'):
    """
    Update prediction with actual qualifying times from Saturday
    """
    
    print(f"\n🏁 Updating {race_code} prediction with ACTUAL qualifying times")
    print(f"   This will be MUCH more accurate than estimated quali!\n")
    
    # Try DB first, fall back to local lookup
    circuit_name = None
    race_round = None
    try:
        session = get_db_session()
        race = session.query(Race).filter_by(year=2026).filter(
            Race.circuit_name.ilike(f"%{race_code}%")
        ).first()
        session.close()
        if race:
            circuit_name = race.circuit_name
            race_round = race.round
    except Exception as e:
        print(f"   (DB unavailable: {e.__class__.__name__} – using local fallback)")

    if circuit_name is None:
        info = RACE_INFO_2026.get(race_code.upper())
        if not info:
            print(f"✗ Race not found for code: {race_code}")
            return
        circuit_name = info["circuit_name"]
        race_round = info["round"]

    print(f"   Circuit: {circuit_name}  Round: {race_round}")
    
    # Generate prediction with actual quali
    prediction = predict_race_advanced_with_actual_quali(
        circuit_name,
        race_round,
        actual_quali_times,
        2026
    )
    
    if prediction:
        # Save locally
        os.makedirs(output_dir, exist_ok=True)
        filepath = f'{output_dir}/{race_code.upper()}.json'
        with open(filepath, 'w') as f:
            json.dump(prediction, f, indent=2)
        
        print(f"\n✅ Updated prediction saved to: {filepath}")
        print(f"   Model confidence: {prediction['model_confidence']}% (POST-QUALIFYING)")
        print(f"\n   Top 3:")
        for i, result in enumerate(prediction['results'][:3], 1):
            print(f"   {i}. {result['name']} ({result['win_probability']:.1f}%)")

        # Upload to S3
        upload_to_s3(filepath, race_code, 2026, stage='postquali')
    

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
