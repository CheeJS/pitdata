import sys
import os
import fastf1

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))

from services.f1_service import get_db_session, Race
from seed_full_telemetry import seed_full_race_data

def seed_missing_2025():
    print("Fixing 2025 Data (Rounds 16-24)...")
    
    session = get_db_session()
    races = session.query(Race).filter(Race.year == 2025, Race.round >= 16).order_by(Race.round).all()
    
    print(f"Found {len(races)} races to process.")
    
    for race in races:
        print(f"\nProcessing Round {race.round}: {race.race_name}")
        try:
            seed_full_race_data(2025, race.round, race.id, session)
            print(f"  ✓ Finished {race.race_name}")
        except Exception as e:
            print(f"  ❌ Failed {race.race_name}: {e}")
            
    session.close()

if __name__ == "__main__":
    # Cache setup
    CACHE_DIR = os.path.join(os.path.dirname(__file__), '..', 'data_pipeline', 'f1_cache')
    if not os.path.exists(CACHE_DIR):
        os.makedirs(CACHE_DIR)
    fastf1.Cache.enable_cache(CACHE_DIR)

    seed_missing_2025()
