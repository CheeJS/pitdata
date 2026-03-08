"""
Full F1 Data Seeder - Downloads ALL telemetry data for Race Replay, Analysis, etc.
WARNING: This will take 1-2 hours to run for 2024+2025 (48 races)
"""
import sys
import os
import json
import fastf1
from datetime import datetime
import pandas as pd
import numpy as np

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))
from services.f1_service import (
    get_db_session, get_db_engine, Race, Result, Lap, Circuit, Telemetry, RaceStatus, Base
)

# FastF1 Cache
CACHE_DIR = os.path.join(os.path.dirname(__file__), '..', 'data_pipeline', 'f1_cache')
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)
fastf1.Cache.enable_cache(CACHE_DIR)


def seed_full_race_data(year, race_round, race_id, session_db):
    """
    Seeds full telemetry data for a single race:
    - Lap data (for Race Replay)
    - Circuit data (for track maps)
    - Telemetry data (for analysis - fastest lap per driver)
    """
    try:
        print(f"    Loading full session data...")
        ff1_session = fastf1.get_session(year, race_round, 'R')
        ff1_session.load(telemetry=True, weather=True, messages=True)
        
        # --- LAP DATA ---
        print(f"    Processing lap data...")
        laps = ff1_session.laps
        
        # Check if we already have laps for this race
        existing_laps = session_db.query(Lap).filter_by(race_id=race_id).count()
        if existing_laps > 0:
            print(f"    Laps already exist ({existing_laps}), skipping...")
        else:
            lap_count = 0
            for _, lap in laps.iterrows():
                if pd.isna(lap['LapNumber']):
                    continue
                
                # Calculate cumulative time
                lap_time_sec = lap['LapTime'].total_seconds() if pd.notna(lap['LapTime']) else None
                
                # Get cumulative time (Time column is session elapsed time at lap end)
                cum_time = lap['Time'].total_seconds() if pd.notna(lap['Time']) else None
                
                lap_obj = Lap(
                    race_id=race_id,
                    driver=lap['Driver'],
                    lap_number=int(lap['LapNumber']),
                    position=int(lap['Position']) if pd.notna(lap['Position']) else None,
                    lap_time=lap_time_sec,
                    cumulative_time=cum_time,
                    tyre_compound=lap['Compound'] if pd.notna(lap['Compound']) else None,
                    sector1_time=lap['Sector1Time'].total_seconds() if pd.notna(lap['Sector1Time']) else None,
                    sector2_time=lap['Sector2Time'].total_seconds() if pd.notna(lap['Sector2Time']) else None,
                    sector3_time=lap['Sector3Time'].total_seconds() if pd.notna(lap['Sector3Time']) else None,
                    stint=int(lap['Stint']) if pd.notna(lap['Stint']) else None
                )
                session_db.add(lap_obj)
                lap_count += 1
            
            print(f"    Added {lap_count} laps")
        
        # --- CIRCUIT DATA ---
        print(f"    Processing circuit data...")
        existing_circuit = session_db.query(Circuit).filter_by(race_id=race_id).first()
        if existing_circuit:
            print(f"    Circuit data already exists, skipping...")
        else:
            try:
                circuit_info = ff1_session.get_circuit_info()
                
                # Get track shape from fastest lap telemetry
                fastest_lap = laps.pick_fastest()
                if fastest_lap is not None:
                    tel = fastest_lap.get_telemetry()
                    
                    # Downsample for storage (every 10th point)
                    x_coords = tel['X'].tolist()[::10]
                    y_coords = tel['Y'].tolist()[::10]
                    distances = tel['Distance'].tolist()[::10]
                    
                    # Corner data
                    corners = []
                    if circuit_info is not None and hasattr(circuit_info, 'corners'):
                        for _, corner in circuit_info.corners.iterrows():
                            corners.append({
                                'number': str(corner['Number']) + str(corner['Letter']),
                                'distance': float(corner['Distance']),
                                'angle': float(corner['Angle']) if 'Angle' in corner else 0
                            })
                    
                    circuit_obj = Circuit(
                        race_id=race_id,
                        x_json=json.dumps(x_coords),
                        y_json=json.dumps(y_coords),
                        distance_json=json.dumps(distances),
                        corners_json=json.dumps(corners)
                    )
                    session_db.add(circuit_obj)
                    print(f"    Added circuit data ({len(x_coords)} points, {len(corners)} corners)")
            except Exception as e:
                print(f"    Circuit data error: {e}")
        
        # --- TELEMETRY DATA (Fastest lap per driver for analysis) ---
        print(f"    Processing driver telemetry...")
        existing_telemetry = session_db.query(Telemetry).filter_by(race_id=race_id).count()
        if existing_telemetry > 0:
            print(f"    Telemetry already exists ({existing_telemetry} drivers), skipping...")
        else:
            drivers = laps['Driver'].unique()
            tel_count = 0
            for driver in drivers:
                try:
                    driver_laps = laps.pick_drivers(driver).pick_quicklaps()
                    if driver_laps.empty:
                        continue
                    
                    fastest = driver_laps.pick_fastest()
                    if fastest is None:
                        continue
                    
                    tel = fastest.get_telemetry()
                    
                    # Downsample for storage (every 20th point)
                    step = 20
                    tel_obj = Telemetry(
                        race_id=race_id,
                        driver=driver,
                        distance_json=json.dumps(tel['Distance'].tolist()[::step]),
                        speed_json=json.dumps(tel['Speed'].tolist()[::step]),
                        throttle_json=json.dumps(tel['Throttle'].tolist()[::step]),
                        brake_json=json.dumps([int(b) for b in tel['Brake'].tolist()[::step]]),
                        gear_json=json.dumps([int(g) for g in tel['nGear'].tolist()[::step]]),
                        rpm_json=json.dumps(tel['RPM'].tolist()[::step]) if 'RPM' in tel.columns else None,
                        time_json=json.dumps(tel['Time'].dt.total_seconds().tolist()[::step]) if 'Time' in tel.columns else None
                    )
                    session_db.add(tel_obj)
                    tel_count += 1
                except Exception as e:
                    print(f"      Telemetry error for {driver}: {e}")
                    continue
            
            print(f"    Added telemetry for {tel_count} drivers")

        # --- RACE STATUS (Flags, SC, VSC) via track_status + race_control_messages ---
        print(f"    Processing race control events...")
        existing_status = session_db.query(RaceStatus).filter_by(race_id=race_id).count()
        if existing_status > 0:
            print(f"    Clearing {existing_status} existing status events to re-seed with track_status...")
            session_db.query(RaceStatus).filter_by(race_id=race_id).delete()
            session_db.flush()

        count_ev = 0

        # --- PRIMARY: track_status — authoritative per-second flag state ---
        # Status codes: '1'=Green, '2'=Yellow, '4'=SC, '5'=Red, '6'=VSC, '7'=VSCEnding(→Green)
        # Message values: AllClear, Yellow, SCDeployed, SCEnding, Red, VSCDeployed, VSCEnding
        STATUS_CODE_MAP = {
            '1': 'GREEN', '2': 'YELLOW', '4': 'SC', '5': 'RED', '6': 'VSC', '7': 'GREEN'
        }
        MSG_MAP = {
            'AllClear': 'GREEN', 'Yellow': 'YELLOW', 'SCDeployed': 'SC',
            'SCEnding': 'SC', 'Red': 'RED', 'VSCDeployed': 'VSC', 'VSCEnding': 'GREEN'
        }
        try:
            ts = ff1_session.track_status
            if ts is not None and not ts.empty:
                for _, row in ts.iterrows():
                    raw_time = row['Time']
                    time_val = None
                    if pd.notna(raw_time):
                        if hasattr(raw_time, 'total_seconds'):
                            time_val = raw_time.total_seconds()
                        elif isinstance(raw_time, (int, float)):
                            time_val = float(raw_time)
                    if time_val is None:
                        continue

                    msg_str = str(row.get('Message', '')).strip()
                    code_str = str(row.get('Status', '')).strip()
                    status_val = MSG_MAP.get(msg_str) or STATUS_CODE_MAP.get(code_str)
                    if not status_val:
                        continue

                    session_db.add(RaceStatus(
                        race_id=race_id,
                        time=time_val,
                        status=status_val,
                        weather=None,
                        category='FLAG'
                    ))
                    count_ev += 1
                print(f"    Added {count_ev} track_status flag events")
        except Exception as ts_err:
            print(f"    track_status unavailable ({ts_err}), falling back to race_control_messages")

        # --- SECONDARY: race_control_messages — non-flag events (penalties, DRS, etc.) ---
        try:
            rc_msgs = ff1_session.race_control_messages
            if rc_msgs is not None and not rc_msgs.empty:
                msg_count = 0
                for _, row in rc_msgs.iterrows():
                    msg = str(row['Message'])
                    category = str(row.get('Category', ''))
                    flag = row['Flag'] if 'Flag' in row else None
                    msg_upper = msg.upper()
                    cat_upper = category.upper()

                    # Determine if this is a flag event (already covered by track_status)
                    is_flag = (
                        "SAFETY CAR" in msg_upper or "SAFETY CAR" in cat_upper or
                        "RED FLAG" in msg_upper or (flag == "Red" and "FLAG" in cat_upper) or
                        "YELLOW FLAG" in msg_upper or (flag == "Yellow" and "FLAG" in cat_upper) or
                        "GREEN FLAG" in msg_upper or (flag == "Green" and "FLAG" in cat_upper) or
                        "VIRTUAL" in msg_upper or "CHEQUERED" in msg_upper or "CHECKERED" in msg_upper
                    )
                    if is_flag:
                        continue  # Skip — covered by track_status

                    time_val = None
                    raw_time = row['Time']
                    if pd.notna(raw_time):
                        if hasattr(raw_time, 'total_seconds'): time_val = raw_time.total_seconds()
                        elif isinstance(raw_time, pd.Timedelta): time_val = raw_time.total_seconds()
                        elif isinstance(raw_time, (pd.Timestamp, datetime)):
                            try: time_val = (raw_time - ff1_session.date).total_seconds()
                            except: pass
                    if time_val is None:
                        continue

                    session_db.add(RaceStatus(
                        race_id=race_id,
                        time=time_val,
                        status=msg,
                        weather=None,
                        category='MESSAGE'
                    ))
                    msg_count += 1
                print(f"    Added {msg_count} race control message events")
        except Exception as rc_err:
            print(f"    race_control_messages error: {rc_err}")

        print(f"    Total status events: {count_ev}")
        
        session_db.commit()
        return True
        
    except Exception as e:
        print(f"    ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False


def seed_full_year(year):
    print(f"\n{'='*60}")
    print(f"SEEDING FULL DATA FOR {year}")
    print(f"{'='*60}")
    
    session_db = get_db_session()
    
    # Get all races for this year
    races = session_db.query(Race).filter_by(year=year).order_by(Race.round).all()
    
    if not races:
        print(f"No races found for {year}. Run seed_history.py first!")
        session_db.close()
        return
    
    print(f"Found {len(races)} races for {year}")
    
    for race in races:
        print(f"\n[{race.round}/{len(races)}] {race.race_name}")
        success = seed_full_race_data(year, race.round, race.id, session_db)
        if success:
            print(f"    ✓ Complete")
        else:
            print(f"    ✗ Failed")
    
    session_db.close()
    print(f"\n{'='*60}")
    print(f"COMPLETED {year}")
    print(f"{'='*60}")


if __name__ == "__main__":
    # Ensure tables exist
    engine = get_db_engine()
    Base.metadata.create_all(bind=engine)
    
    print("="*60)
    print("FULL F1 DATA SEEDER")
    print("This will download ALL telemetry data for Race Replay, Analysis, etc.")
    print("Estimated time: 1-2 hours for 2024+2025")
    print("="*60)
    
    # Seed 2024 and 2025
    seed_full_year(2024)
    seed_full_year(2025)
    
    print("\n" + "="*60)
    print("ALL DONE!")
    print("="*60)
