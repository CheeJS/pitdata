"""
Seed Qualifying Results for 2024-2025
This adds Qualifying session results to the database
"""
import sys
import os
import fastf1
import pandas as pd

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))
from services.f1_service import get_db_session, get_db_engine, Race, Result, Base

# FastF1 Cache
CACHE_DIR = os.path.join(os.path.dirname(__file__), '..', 'data_pipeline', 'f1_cache')
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)
fastf1.Cache.enable_cache(CACHE_DIR)


def seed_qualifying_results(year):
    print(f"\n{'='*60}")
    print(f"SEEDING QUALIFYING RESULTS FOR {year}")
    print(f"{'='*60}")
    
    session_db = get_db_session()
    
    # Get all races for this year
    races = session_db.query(Race).filter_by(year=year).order_by(Race.round).all()
    
    if not races:
        print(f"No races found for {year}.")
        session_db.close()
        return
    
    print(f"Found {len(races)} races for {year}")
    
    for race in races:
        print(f"\n[{race.round}/{len(races)}] {race.race_name}")
        
        # Check if Q results already exist
        existing_q = session_db.query(Result).filter_by(race_id=race.id, session_type='Q').count()
        if existing_q > 0:
            print(f"    Qualifying results already exist ({existing_q}), skipping...")
            continue
        
        try:
            print(f"    Fetching qualifying results...")
            ff1_session = fastf1.get_session(year, race.round, 'Q')
            ff1_session.load(telemetry=False, weather=False, messages=False)
            
            if not hasattr(ff1_session, 'results') or ff1_session.results.empty:
                print(f"    No qualifying data available")
                continue
            
            count = 0
            for _, driver in ff1_session.results.iterrows():
                # Format qualifying time
                q1 = str(driver['Q1']).replace('0 days ', '') if pd.notna(driver['Q1']) else None
                q2 = str(driver['Q2']).replace('0 days ', '') if pd.notna(driver['Q2']) else None
                q3 = str(driver['Q3']).replace('0 days ', '') if pd.notna(driver['Q3']) else None
                
                # Use best qualifying time
                best_time = q3 or q2 or q1 or ""
                
                pos = int(driver['Position']) if pd.notna(driver['Position']) else 0
                
                res = Result(
                    race_id=race.id,
                    position=pos,
                    driver_number=str(driver['DriverNumber']),
                    driver_code=driver['Abbreviation'],
                    driver_name=driver['FullName'],
                    team_name=driver['TeamName'],
                    grid_position=pos,  # Grid position = Qualifying position
                    status='Finished',
                    points=0,  # No points in qualifying
                    time_str=best_time,
                    session_type='Q'
                )
                session_db.add(res)
                count += 1
            
            session_db.commit()
            print(f"    ✓ Added {count} qualifying results")
            
        except Exception as e:
            print(f"    Error: {e}")
            continue
    
    session_db.close()
    print(f"\n{'='*60}")
    print(f"COMPLETED {year}")
    print(f"{'='*60}")


if __name__ == "__main__":
    # Ensure tables exist
    engine = get_db_engine()
    Base.metadata.create_all(bind=engine)
    
    print("="*60)
    print("QUALIFYING RESULTS SEEDER")
    print("="*60)
    
    seed_qualifying_results(2024)
    seed_qualifying_results(2025)
    
    print("\n" + "="*60)
    print("ALL DONE!")
    print("="*60)
