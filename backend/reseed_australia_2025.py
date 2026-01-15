"""
Re-seed Race Control Messages for Australian GP 2025.
This script aligns message timestamps with the Lap 1 start time.
"""
import sys
import os
import fastf1
import pandas as pd
from datetime import datetime

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))

from services.f1_service import get_db_session, get_db_engine, Race, RaceStatus, Lap

# FastF1 Cache
CACHE_DIR = os.path.join(os.path.dirname(__file__), '..', 'data_pipeline', 'f1_cache')
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)
fastf1.Cache.enable_cache(CACHE_DIR)

def reseed_australia_2025():
    session = get_db_session()
    
    try:
        race = session.query(Race).filter(Race.year==2025, Race.race_name.ilike('%Australia%')).first()
        if not race:
            print("Race not found!")
            return
        
        print(f"Re-seeding messages for: {race.race_name}")
        
        # 1. Get Lap 1 Start Time (Session Time when Lap 1 begins)
        lap1 = session.query(Lap).filter_by(race_id=race.id, lap_number=1).first()
        lap1_start_session_time = lap1.cumulative_time - lap1.lap_time
        print(f"Lap 1 Start (Session Time): {lap1_start_session_time:.2f}s")
        
        # 2. Delete existing messages
        count = session.query(RaceStatus).filter_by(race_id=race.id).count()
        print(f"Deleting {count} existing messages...")
        session.query(RaceStatus).filter_by(race_id=race.id).delete()
        session.commit()
        
        # 3. Load FastF1 data
        ff1_session = fastf1.get_session(2025, race.round, 'R')
        ff1_session.load(telemetry=False, weather=False, messages=True, laps=True)
        
        # 4. Get Session T0 from FastF1
        # For Australian 2025, LapStartDate may be NaT. Use race.date from DB as T0.
        # The DB race.date is the SESSION START (not Lap 1 start).
        session_t0_wall = pd.Timestamp(race.date).tz_localize('UTC')
        print(f"Session T0 (from DB race.date): {session_t0_wall}")
        
        # 5. Re-seed messages
        rc_msgs = ff1_session.race_control_messages
        if rc_msgs is None or rc_msgs.empty:
            print("No race control messages found!")
            return
        
        count_added = 0
        for _, row in rc_msgs.iterrows():
            msg = str(row['Message'])
            category = row['Category']
            flag = row.get('Flag', None)
            
            # Determine status value
            status_val = None
            msg_upper = msg.upper()
            cat_upper = str(category).upper()
            
            if "SAFETY CAR" in msg_upper or "SAFETY CAR" in cat_upper:
                if "VIRTUAL" in msg_upper or "VIRTUAL" in cat_upper: 
                    status_val = "VSC"
                else: 
                    status_val = "SC"
            elif "RED FLAG" in msg_upper or (flag == "Red" and "FLAG" in cat_upper): 
                status_val = "RED"
            elif "YELLOW FLAG" in msg_upper or (flag == "Yellow" and "FLAG" in cat_upper): 
                status_val = "YELLOW"
            elif "GREEN FLAG" in msg_upper or (flag == "Green" and "FLAG" in cat_upper): 
                status_val = "GREEN"
            elif "CHEQUERED" in msg_upper or "CHECKERED" in msg_upper: 
                status_val = "CHEQUERED"
            
            category_val = "MESSAGE"
            if status_val:
                category_val = "FLAG"
            else:
                status_val = msg  # Store raw message
            
            # Calculate time in Session Time (seconds from session start)
            time_val = None
            raw_time = row['Time']
            if pd.notna(raw_time):
                if isinstance(raw_time, pd.Timedelta):
                    time_val = raw_time.total_seconds()
                elif isinstance(raw_time, (pd.Timestamp, datetime)):
                    # Convert wall clock to session time
                    # Ensure timezone compatibility
                    if hasattr(raw_time, 'tzinfo') and raw_time.tzinfo is None:
                        raw_time = pd.Timestamp(raw_time).tz_localize('UTC')
                    delta = raw_time - session_t0_wall
                    time_val = delta.total_seconds()
            
            if time_val is not None:
                rs = RaceStatus(
                    race_id=race.id, 
                    time=time_val, 
                    status=status_val, 
                    weather=None,
                    category=category_val
                )
                session.add(rs)
                count_added += 1
        
        # 6. Also seed Track Status (Flags) from track_status API
        if hasattr(ff1_session, 'track_status') and ff1_session.track_status is not None and not ff1_session.track_status.empty:
            print("Adding track_status flags...")
            ts_data = ff1_session.track_status
            last_status = None
            
            for _, row in ts_data.iterrows():
                status_code = str(row['Status'])
                raw_time = row['Time']
                
                status_val = None
                if status_code == '1': status_val = 'GREEN'
                elif status_code == '2': status_val = 'YELLOW'
                elif status_code == '4': status_val = 'SC'
                elif status_code == '5': status_val = 'RED'
                elif status_code == '6': status_val = 'VSC'
                elif status_code == '7': status_val = 'GREEN'
                
                if status_val and status_val != last_status:
                    if isinstance(raw_time, pd.Timedelta):
                        time_val = raw_time.total_seconds()
                        rs = RaceStatus(
                            race_id=race.id,
                            time=time_val,
                            status=status_val,
                            weather=None,
                            category='FLAG'
                        )
                        session.add(rs)
                        count_added += 1
                        last_status = status_val
        
        session.commit()
        print(f"Added {count_added} messages/flags.")
        
        # 7. Verify sync
        print("\n=== Verification ===")
        events = session.query(RaceStatus).filter_by(race_id=race.id).order_by(RaceStatus.time).all()
        
        green_light = next((e for e in events if 'GREEN LIGHT' in (e.status or '').upper()), None)
        if green_light:
            diff = abs(green_light.time - lap1_start_session_time)
            print(f"Green Light Time: {green_light.time:.2f}s")
            print(f"Lap 1 Start Time: {lap1_start_session_time:.2f}s")
            print(f"Difference: {diff:.2f}s")
            if diff < 120:
                print("✓ Messages are now ALIGNED!")
            else:
                print(f"⚠️ Still out of sync by {diff:.2f}s")
        else:
            print("No 'GREEN LIGHT' message found.")
            
    except Exception as e:
        session.rollback()
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()

if __name__ == "__main__":
    reseed_australia_2025()
