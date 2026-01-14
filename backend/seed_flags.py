import sys
import os
import fastf1
import pandas as pd
from datetime import datetime

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))

from services.f1_service import get_db_session, get_db_engine, Race, RaceStatus, Base

# FastF1 Cache
CACHE_DIR = os.path.join(os.path.dirname(__file__), '..', 'data_pipeline', 'f1_cache')
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)
fastf1.Cache.enable_cache(CACHE_DIR)

def seed_flags_for_year(year):
    print(f"Seeding flags for {year}...")
    session = get_db_session()
    
    races = session.query(Race).filter_by(year=year).all()
    print(f"Found {len(races)} races.")
    
    for race in races:
        print(f"Processing {race.race_name}...")
        
        # Clear existing flags to ensure update
        count = session.query(RaceStatus).filter_by(race_id=race.id).count()
        if count > 0:
            print(f"  Clearing {count} existing flags to re-seed...")
            session.query(RaceStatus).filter_by(race_id=race.id).delete()
            session.commit() # Commit delete immediately
            
        try:
            # Load session with messages=True AND laps data
            # Also try to load track_status if available
            ff1_session = fastf1.get_session(year, race.round, 'R')
            ff1_session.load(telemetry=False, weather=False, messages=True, laps=True)
            
            added_count = 0
            
            # Prefer track_status if available (more reliable timing)
            if hasattr(ff1_session, 'track_status') and ff1_session.track_status is not None and not ff1_session.track_status.empty:
                print("  Using track_status data for flags...")
                ts_data = ff1_session.track_status
                
                # drop duplicates to get unique status changes
                # But sometimes status flickers, so we just iterate and filter consecutive dupes effectively
                # FastF1 track_status usually has one row per status change
                
                last_status_val = None
                
                for _, row in ts_data.iterrows():
                    status_code = str(row['Status'])
                    raw_time = row['Time']
                    msg = str(row['Message'])
                    
                    status_val = None
                    
                    # Map codes to our statuses
                    # 1: Green
                    # 2: Yellow (Track Yellow)
                    # 4: SC
                    # 5: Red
                    # 6: VSC
                    # 7: VSC Ending (usually)
                    
                    if status_code == '1':
                        status_val = 'GREEN'
                    elif status_code == '2':
                        # Track yellow might be too noisy, but let's include it if user wants 'Track Status' flags
                        # Usually for whole track status we only care about SC/VSC/Red/Green
                        # But FastF1 documentation implies 2 is yellow. 
                        # Let's verify if we want to show every yellow flag.
                        # For now, let's map it but maybe user only wants major interruptions
                        status_val = 'YELLOW'
                    elif status_code == '4':
                        status_val = 'SC'
                    elif status_code == '5':
                        status_val = 'RED'
                    elif status_code == '6':
                        status_val = 'VSC'
                    elif status_code == '7':
                        # VSC Ending -> virtually Green but might transition to 1 shortly
                        # Let's map to GREEN or VSC? 
                        # If we map to GREEN it clears the VSC.
                        status_val = 'GREEN'
                        
                    if status_val:
                        # Filter out consecutive duplicates
                        if status_val == last_status_val:
                            continue
                            
                        # Track Status Time is reliably Timedelta from session start
                        if isinstance(raw_time, pd.Timedelta):
                            time_val = raw_time.total_seconds()
                            
                            rs = RaceStatus(
                                race_id=race.id,
                                time=time_val,
                                status=status_val,
                                weather=None
                            )
                            session.add(rs)
                            added_count += 1
                            last_status_val = status_val
                             
            else:
                # Fallback to race_control_messages
                print("  Using race_control_messages (fallback)...")
                rc_msgs = ff1_session.race_control_messages
                
                if rc_msgs is None or (hasattr(rc_msgs, 'empty') and rc_msgs.empty):
                    print("  No race control messages found.")
                    continue
                    
                for _, row in rc_msgs.iterrows():
                    msg = str(row['Message'])
                    category = row['Category']
                    flag = row['Flag'] if 'Flag' in row else None
                    
                    status_val = None
                    
                    # Clean up msg for check
                    msg_upper = msg.upper()
                    cat_upper = str(category).upper()
                    
                    if "SAFETY CAR" in msg_upper or "SAFETY CAR" in cat_upper:
                        if "VIRTUAL" in msg_upper or "VIRTUAL" in cat_upper:
                            if "ENDING" in msg_upper: 
                                 pass
                            else:
                                 status_val = "VSC"
                        else:
                            if "IN THIS LAP" in msg_upper:
                                pass # SC ending
                            else:
                                status_val = "SC" # Safety Car
                            
                    elif "RED FLAG" in msg_upper or (flag == "Red" and "FLAG" in cat_upper):
                        status_val = "RED"
                    elif "YELLOW FLAG" in msg_upper or (flag == "Yellow" and "FLAG" in cat_upper):
                        status_val = "YELLOW"
                    elif "GREEN FLAG" in msg_upper or (flag == "Green" and "FLAG" in cat_upper):
                        status_val = "GREEN"
                    elif "GREEN LIGHT" in msg_upper or "LIGHTS OUT" in msg_upper or "RACE START" in msg_upper:
                        status_val = "GREEN"
                    elif "TRACK CLEAR" in msg_upper or "CLEAR" in msg_upper:
                        status_val = "GREEN"
                    elif "CHEQUERED" in msg_upper or "CHECKERED" in msg_upper:
                        status_val = "CHEQUERED"
                    
                    if status_val:
                        # Get Time in seconds from session start
                        # FastF1 race_control_messages 'Time' can be Timedelta OR Timestamp
                        time_val = None
                        raw_time = row['Time']
                        if pd.notna(raw_time):
                            try:
                                if isinstance(raw_time, pd.Timedelta):
                                    # Timedelta - session elapsed time, use directly
                                    time_val = raw_time.total_seconds()
                                elif isinstance(raw_time, (pd.Timestamp, datetime)):
                                    # Timestamp - calculate delta from session T0
                                    # Calculate T0 from lap data (avoid lazy-loaded session properties)
                                    # T0 = (wall-clock at lap end) - (session elapsed at lap end)
                                    session_t0 = None
                                    laps = ff1_session.laps
                                    if laps is not None and not laps.empty:
                                        first_lap = laps.iloc[0]
                                        lap_start = first_lap.get('LapStartDate')
                                        lap_duration = first_lap.get('LapTime')  # Duration of the lap
                                        lap_end_session = first_lap.get('Time')  # Session time at lap end
                                        if pd.notna(lap_start) and pd.notna(lap_duration) and pd.notna(lap_end_session):
                                            # Wall-clock at lap end = LapStartDate + LapTime
                                            lap_end_wall = lap_start + lap_duration
                                            # Session T0 = wall-clock at lap end - session elapsed at lap end
                                            session_t0 = lap_end_wall - lap_end_session
                                    
                                    if session_t0 is None:
                                        # Final fallback: use session date (may be off by hours)
                                        session_t0 = pd.Timestamp(ff1_session.date)
                                        if session_t0.tzinfo is None and raw_time.tzinfo is not None:
                                            session_t0 = session_t0.tz_localize(raw_time.tzinfo)
                                    
                                    # Calculate flag time as session elapsed time
                                    delta = raw_time - session_t0
                                    time_val = delta.total_seconds()
                            except Exception as e:
                                print(f"    Warning: Could not convert time {raw_time} ({type(raw_time).__name__}): {e}")
                        
                        if time_val is not None:
                             rs = RaceStatus(
                                 race_id=race.id,
                                 time=time_val,
                                 status=status_val,
                                 weather=None
                             )
                             session.add(rs)
                             added_count += 1
            
            session.commit()
            print(f"  Added {added_count} flag events.")
            
        except Exception as e:
            print(f"  Error processing {race.race_name}: {e}")
            session.rollback()
            
    session.close()

if __name__ == "__main__":
    seed_flags_for_year(2024)
    seed_flags_for_year(2025)
