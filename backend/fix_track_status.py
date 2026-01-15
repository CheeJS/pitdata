
import os
import fastf1
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from services.f1_service import RaceStatus, Race, Base

# Load environment variables
load_dotenv()
DB_URL = os.getenv("DATABASE_URL")

if not DB_URL:
    print("❌ No DATABASE_URL set")
    exit(1)

# Connect to DB
engine = create_engine(DB_URL)
Session = sessionmaker(bind=engine)
session = Session()

def fix_track_status():
    print("🔧 STARTING TRACK STATUS FIX...")
    
    # 1. Add Column if not exists (Postgres specific safe alter)
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE race_status ADD COLUMN IF NOT EXISTS category TEXT"))
            conn.commit()
        print("✅ Schema updated (category column added)")
    except Exception as e:
        print(f"⚠️ Schema update warning (might already exist): {e}")

    # 2. Get all races
    races = session.query(Race).order_by(Race.year, Race.round).all()
    print(f"📊 Found {len(races)} races to process")

    for race in races:
        print(f"\nProcessing {race.year} Round {race.round}: {race.race_name}")
        
        # Wipe existing status for this race to avoid duplicates
        deleted = session.query(RaceStatus).filter_by(race_id=race.id).delete()
        session.commit()
        print(f"  - Cleared {deleted} old status entries")

        try:
            # Load FastF1 Session (Lightweight)
            # We assume cache is enabled in backend OR we download fresh
            # Since user deleted cache, this might re-download.
            ff1_session = fastf1.get_session(race.year, race.round, 'R')
            ff1_session.load(telemetry=False, weather=False, messages=True) # Minimal load
            
            new_events = []
            
            # --- A. TRACK STATUS (The real flags) ---
            # 'TrackStatus' is a dict of 'Time' -> 'Status' code
            # Codes: 1=Green, 2=Yellow, 4=SC, 5=Red, 6=VSC, 7=VSC Ending?
            # We accept: 1, 2, 4, 5, 6, 7
            
            # fastf1 3.0+ access might differ. 
            # Usually session.track_status is a DataFrame ['Time', 'Status', 'Message']
            
            ts_data = ff1_session.track_status
            if ts_data is not None and not ts_data.empty:
                for _, row in ts_data.iterrows():
                    status_code = str(row['Status'])
                    
                    # Time Handling
                    raw_time = row['Time']
                    time_val = 0.0
                    if hasattr(raw_time, 'total_seconds'):
                        time_val = raw_time.total_seconds()
                    else:
                        # Fallback for Timestamp objects (rare but possible in some versions)
                        # We try to subtract session start if available, or just skip if too complex
                        # But simpler: cast to timedelta if possible or ignore
                        continue

                    status_str = "GREEN" # Default
                    if status_code == '1': status_str = 'GREEN'
                    elif status_code == '2': status_str = 'YELLOW'
                    elif status_code == '4': status_str = 'SC'
                    elif status_code == '5': status_str = 'RED'
                    elif status_code == '6': status_str = 'VSC'
                    elif status_code == '7': status_str = 'GREEN' # VSC Ending -> Green
                    else: continue # Skip others
                    
                    new_events.append({
                        "time": time_val,
                        "status": status_str,
                        "category": "FLAG"
                    })
                    
            # --- B. MESSAGES (Generic info) ---
            msgs = ff1_session.race_control_messages
            if msgs is not None and not msgs.empty:
                for _, row in msgs.iterrows():
                    msg = str(row['Message'])
                    # Filter out standard flag messages to avoid double-ups with TrackStatus
                    # But be CAREFUL not to filter out 'Penalty' or 'Investigation' even if they mention flags
                    # Example: "Car 14 penalty for ignoring Blue Flags" -> Should KEEP
                    msg_upper = msg.upper()
                    
                    # If it's just a pure flag announcement, skip it (TrackStatus handles it)
                    # But if it has extra context, keep it.
                    is_pure_flag = msg_upper in ["YELLOW FLAG", "GREEN FLAG", "RED FLAG", "SAFETY CAR", "VIRTUAL SECURITY CAR", "VIRTUAL SAFETY CAR"]
                    
                    if is_pure_flag:
                         continue

                    # Robust Time
                    raw_time = row['Time']
                    time_val = 0.0
                    if hasattr(raw_time, 'total_seconds'): 
                        time_val = raw_time.total_seconds()
                    elif isinstance(raw_time, pd.Timedelta):
                        time_val = raw_time.total_seconds()
                    elif hasattr(raw_time, 'year'): # Timestamp/datetime check
                        # Calculate relative time from session start
                        try:
                            # Verify ff1_session.date exists and is comparable
                            start_time = ff1_session.date
                            delta = raw_time - start_time
                            time_val = delta.total_seconds()
                        except Exception as e:
                            print(f"      Time calc error: {e}")
                            continue
                    else:
                        continue

                    new_events.append({
                        "time": time_val,
                        "status": msg, # The content
                        "category": "MESSAGE"
                    })
            
            # Insert all
            for ev in new_events:
                rs = RaceStatus(
                    race_id=race.id,
                    time=ev['time'],
                    status=ev['status'],
                    category=ev['category']
                )
                session.add(rs)
            
            session.commit()
            print(f"  - Added {len(new_events)} new events")

        except Exception as e:
            print(f"  ❌ Error processing race: {e}")
            session.rollback()

    print("\n✅ All Done!")

if __name__ == "__main__":
    fix_track_status()
