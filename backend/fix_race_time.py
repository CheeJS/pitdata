import fastf1
from services.f1_service import get_db_session, Race
import pandas as pd

def fix_race_time():
    print("Fixing Race Time for Australia 2025...")
    session = get_db_session()
    try:
        # Load FastF1
        ff1_session = fastf1.get_session(2025, 1, 'R')
        ff1_session.load(telemetry=False, laps=False, weather=False, messages=False)
        
        real_start = ff1_session.date
        print(f"FastF1 Session Date: {real_start} (Type: {type(real_start)})")

        # Update DB
        race = session.query(Race).filter(Race.year==2025, Race.race_name.ilike('%Australia%')).first()
        if race:
            print(f"Current DB Date: {race.date}")
            # Ensure we write a python datetime
            if isinstance(real_start, pd.Timestamp):
                real_start = real_start.to_pydatetime()
            
            # USER OVERRIDE: 
            # FastF1 data has 71 minute offset (Aborted Start + Padding).
            # User states actual delay was only 15 mins (15:00 -> 15:15).
            # To make the clock show 15:15 at Lap 1, we must shift the Session Start Time back by (71m - 15m) = 56 minutes.
            # 56 mins = 3360 seconds.
            import datetime
            adjusted_start = real_start - datetime.timedelta(seconds=3360)

            race.date = adjusted_start
            session.commit()
            print(f"Updated DB Date to: {race.date} (Adjusted for User Preference)")
        else:
            print("Race not found in DB")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    fix_race_time()
