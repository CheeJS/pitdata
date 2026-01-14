import sys
import os
import fastf1
from datetime import datetime
import pandas as pd

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))

from services.f1_service import get_db_session, Race, Result, Base, get_db_engine

def seed_year(year):
    print(f"Fetching {year} schedule from FastF1...")
    try:
        schedule = fastf1.get_event_schedule(year)
    except Exception as e:
        print(f"Failed to fetch {year}: {e}")
        return

    session = get_db_session()
    
    # Remove top-level skip to allow backfilling results
    # if session.query(Race).filter_by(year=year).first():
    #     print(f"Data for {year} already exists. Skipping.")
    #     session.close()
    #     return

    count = 0
    for i, row in schedule.iterrows():
        try:
            r_round = row['RoundNumber']
            r_name = row['EventName']
            r_date = row['EventDate'].to_pydatetime()
            r_circuit = row['Location']
            
            # Skip testing
            if "Testing" in r_name: continue

            # Check if race already exists
            existing_race = session.query(Race).filter_by(year=year, round=r_round).first()
            if existing_race:
                print(f"  Race {r_name} exists, checking results...")
                race = existing_race
            else:
                race = Race(
                    year=year,
                    round=r_round,
                    circuit_name=r_circuit,
                    race_name=r_name,
                    date=r_date
                )
                
                # Session Columns (try/except for older API versions or missing cols)
                for i in range(1, 6):
                    s_name = row.get(f'Session{i}', '')
                    s_date = row.get(f'Session{i}DateUtc')
                    
                    if pd.notna(s_date):
                         dt = s_date.to_pydatetime() if hasattr(s_date, 'to_pydatetime') else s_date
                         if s_name == 'Practice 1': race.fp1_date = dt
                         elif s_name == 'Practice 2': race.fp2_date = dt
                         elif s_name == 'Practice 3': race.fp3_date = dt
                         elif s_name == 'Qualifying': race.qualifying_date = dt
                         elif s_name == 'Sprint': race.sprint_date = dt
                         elif s_name == 'Sprint Qualifying': race.sprint_qualifying_date = dt

                session.add(race)
                session.flush() # flush to get race.id

            # Seed Basic Results (Winner/Podium) for Standings
            # Check if results exist
            result_count = session.query(Result).filter_by(race_id=race.id).count()
            if result_count > 0:
                print(f"  Results for {r_name} already exist ({result_count}). Skipping fetch.")
            else:
                try:
                    print(f"  Fetching results for {r_name}...")
                    ff1_session = fastf1.get_session(year, r_name, 'R')
                    # Load minimal data (no telemetry/weather/messages)
                    ff1_session.load(telemetry=False, weather=False, messages=False)
                    
                    if hasattr(ff1_session, 'results') and not ff1_session.results.empty:
                        # Clear existing results for this race to avoid dupes?
                        # session.query(Result).filter_by(race_id=race.id).delete()
                        
                        for _, driver in ff1_session.results.iterrows():
                            # Handle potential NaNs
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
                                session_type='R'
                            )
                            session.add(res)
                except Exception as res_e:
                    print(f"  Failed to load results: {res_e}")


            count += 1
        except Exception as e:
            print(f"Error processing {r_name}: {e}")
            continue
            
    session.commit()
    print(f"Seeded {count} races for {year}.")
    session.close()

if __name__ == "__main__":
    # Ensure tables exist (redundant if using existing DB but safe)
    engine = get_db_engine()
    Base.metadata.create_all(bind=engine)
    
    seed_year(2024)
    seed_year(2025)
