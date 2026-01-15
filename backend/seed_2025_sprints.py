
import sys
import os
import fastf1
import pandas as pd

# Add backend to path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from services.f1_service import get_db_session, Race, Result

def seed_sprints_2025():
    session = get_db_session()
    
    # 2025 Sprint Rounds (approximate based on schedule)
    # China(2), Miami(6), Austria(11), USA(19), Brazil(21), Qatar(23)
    # We can also detect this by checking if sprint_date is set in Race table?
    
    sprint_races = session.query(Race).filter(
        Race.year == 2025,
        Race.sprint_date.isnot(None)
    ).all()
    
    if not sprint_races:
        # Fallback to hardcoded list if dates aren't populated
        print("No sprint dates found in DB, using hardcoded rounds.")
        target_rounds = [2, 6, 11, 19, 21, 23]
        sprint_races = session.query(Race).filter(
            Race.year == 2025,
            Race.round.in_(target_rounds)
        ).all()
    
    print(f"Found {len(sprint_races)} Sprint weekends to process.")
    
    for race in sprint_races:
        print(f"\nProcessing Sprint: {race.race_name} (Round {race.round})")
        
        # Check if Sprint results already exist
        existing = session.query(Result).filter_by(
            race_id=race.id, 
            session_type='S'
        ).count()
        
        if existing > 0:
            print(f"  Sprint results already exist ({existing}). Skipping.")
            continue
            
        try:
            # Fetch Sprint Session
            # FastF1 uses 'Sprint' as identifier
            ff1_session = fastf1.get_session(2025, race.round, 'Sprint')
            ff1_session.load(telemetry=False, weather=False, messages=False)
            
            if hasattr(ff1_session, 'results') and not ff1_session.results.empty:
                count = 0
                for _, driver in ff1_session.results.iterrows():
                    # Seed Result
                    pts = driver['Points'] if pd.notna(driver['Points']) else 0
                    pos = int(driver['Position']) if pd.notna(driver['Position']) else 0
                    grid = int(driver['GridPosition']) if pd.notna(driver['GridPosition']) else 0
                    status = str(driver['Status'])
                    t_str = str(driver['Time']).replace('0 days ', '') if pd.notna(driver['Time']) else ""
                    
                    res = Result(
                        race_id=race.id,
                        position=pos,
                        driver_number=str(driver['DriverNumber']),
                        driver_code=driver['Abbreviation'],
                        driver_name=driver['FullName'],
                        team_name=driver['TeamName'],
                        grid_position=grid,
                        status=status,
                        points=pts,
                        time_str=t_str,
                        session_type='S' # IMPORTANCE: Mark as Sprint
                    )
                    session.add(res)
                    count += 1
                
                print(f"  ✓ Added {count} sprint results.")
            else:
                print("  ⚠️ No result data found in FastF1.")
                
        except Exception as e:
            print(f"  ❌ Error fetching/processing sprint: {e}")
            
    session.commit()
    session.close()
    print("\nDone.")

if __name__ == "__main__":
    # Cache setup
    CACHE_DIR = os.path.join(os.path.dirname(__file__), '..', 'data_pipeline', 'f1_cache')
    if not os.path.exists(CACHE_DIR):
        os.makedirs(CACHE_DIR)
    fastf1.Cache.enable_cache(CACHE_DIR)
    
    seed_sprints_2025()
