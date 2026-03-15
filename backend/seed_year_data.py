
import sys
import os
import argparse
import fastf1
import pandas as pd
import json
import numpy as np
from datetime import datetime

# Add backend to path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from services.f1_service import get_db_session, get_db_engine, Race, Result, Circuit, Lap, RaceStatus, Base
from services.utils import get_race_code_from_name

# =================================================================================================
# UTILITIES
# =================================================================================================

# setup_cache removed

def get_position_at_distance(x_coords, y_coords, distances, target_distance):
    """Interpolate X/Y position at a given distance along the track."""
    if not distances or target_distance < 0:
        return None, None
    
    # Find the two points to interpolate between
    for i in range(len(distances) - 1):
        if distances[i] <= target_distance <= distances[i + 1]:
            ratio = (target_distance - distances[i]) / (distances[i + 1] - distances[i])
            x = x_coords[i] + (x_coords[i + 1] - x_coords[i]) * ratio
            y = y_coords[i] + (y_coords[i + 1] - y_coords[i]) * ratio
            return float(x), float(y)
    
    return float(x_coords[-1]), float(y_coords[-1])

# =================================================================================================
# 1. SCHEDULE SEEDER
# =================================================================================================

def seed_schedule(year, session_db):
    print(f"\n--- 1. Schedule for {year} ---")
    try:
        schedule = fastf1.get_event_schedule(year)
    except Exception as e:
        print(f"Failed to fetch schedule: {e}")
        return False

    count = 0
    for i, row in schedule.iterrows():
        try:
            r_round = row['RoundNumber']
            r_name = row['EventName']
            r_date = row['EventDate'].to_pydatetime()
            # Skip testing
            if "Testing" in r_name: continue
            
            # Check or Create Race
            race = session_db.query(Race).filter_by(year=year, round=r_round).first()
            if not race:
                race = Race(
                    year=year,
                    round=r_round,
                    circuit_name=row['Location'],
                    race_name=r_name,
                    date=r_date
                )
                
                # Session info
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
                        elif s_name == 'Sprint Qualifying' or s_name == 'Sprint Shootout': race.sprint_qualifying_date = dt
                        elif s_name == 'Race' or s_name == 'Feature Race': race.date = dt
                
                session_db.add(race)
                count += 1
            else:
                 # Update dates even if exists
                 race.date = r_date
        except Exception as e:
            print(f"Error processing round {r_round}: {e}")
            continue

    session_db.commit()
    print(f"Schedule: {count} new races added.")
    return True

# =================================================================================================
# 2. RESULTS SEEDER (Race, Sprint, Qualifying)
# =================================================================================================

def fetch_and_store_results(year, race, session_type, session_db):
    type_map = {
        'R': 'Race', 
        'S': 'Sprint', 
        'Q': 'Qualifying',
        'SS': 'Sprint Qualifying',
        'FP1': 'Practice 1',
        'FP2': 'Practice 2',
        'FP3': 'Practice 3'
    }
    label = type_map.get(session_type, session_type)
    
    # Check bounds
    existing_q = session_db.query(Result).filter_by(race_id=race.id, session_type=session_type)
    existing_count = existing_q.count()
    
    if existing_count > 0:
        # Check if they are just placeholders ('Entry')
        # If all existing results are status='Entry', we can safely delete and re-seed 
        # (assuming the user might have updated the config)
        is_only_entries = existing_q.filter(Result.status != 'Entry').count() == 0
        
        if is_only_entries and session_type == 'R':
            print(f"    Refreshing Entry List for {race.race_name}...")
            existing_q.delete()
            session_db.commit()
        else:
            return f"Skipped (Exists: {existing_count})"

    try:
        # Map DB session codes to FastF1 identifiers
        # FastF1 accepts: 'FP1', 'FP2', 'FP3', 'Q', 'S', 'Sprint Qualifying' (for SS)
        ff1_identifier = session_type
        if session_type == 'S': ff1_identifier = 'Sprint'
        elif session_type == 'SS': ff1_identifier = 'Sprint Qualifying'
        
        # Verify Session Exists in Schedule
        if session_type == 'S' and not race.sprint_date: return "Skip (No Sprint)"
        if session_type == 'SS' and not race.sprint_qualifying_date: return "Skip (No SQ)"
        if session_type == 'FP3' and not race.fp3_date: return "Skip (No FP3)" # e.g. Sprint weekends
        
        # Try loading FastF1 data
        try:
            ff1_session = fastf1.get_session(year, race.round, ff1_identifier)
            ff1_session.load(telemetry=False, weather=False, messages=False)
        except Exception:
            # Fallback for SS naming variations
            if session_type == 'SS':
                try:
                    ff1_session = fastf1.get_session(year, race.round, 'Sprint Shootout')
                    ff1_session.load(telemetry=False, weather=False, messages=False)
                except:
                    ff1_session = None
            else:
                ff1_session = None

        if not ff1_session or not hasattr(ff1_session, 'results') or ff1_session.results.empty:
            # Fallback: Check for Entry List in Config (for future seasons)
            # Only apply for Race sessions to avoid dupes
            if session_type == 'R':
                config_path = os.path.join(os.path.dirname(__file__), 'data', 'season_entries.json')
                if os.path.exists(config_path):
                    with open(config_path, 'r') as f:
                        config = json.load(f)
                    
                    entries = config.get(str(year), [])
                    if entries:
                        count = 0
                        for entry in entries:
                            res = Result(
                                race_id=race.id,
                                position=0, # Entry list, no position
                                driver_number=entry['number'],
                                driver_code=entry['code'],
                                driver_name=entry['name'],
                                team_name=entry['team'],
                                grid_position=entry.get('grid', 0),
                                status='Entry',
                                points=0,
                                time_str="",
                                session_type='R'
                            )
                            session_db.add(res)
                            count += 1
                        return f"Seeded {count} (CFG)"
            
            return "No Data"

        count = 0
        for _, driver in ff1_session.results.iterrows():
            # Extract Data
            driver_num = str(driver['DriverNumber'])
            code = driver['Abbreviation']
            team = driver['TeamName']
            
            # Points/Pos
            pts = driver['Points'] if pd.notna(driver['Points']) else 0
            pos = int(driver['Position']) if pd.notna(driver['Position']) else 0
            grid = int(driver['GridPosition']) if pd.notna(driver['GridPosition']) else 0
            status = str(driver['Status'])
            
            # Time String
            if session_type in ['Q', 'SS']:
                # For Quali sessions, try Q3, then Q2, then Q1
                q1 = str(driver.get('Q1','')).replace('0 days ', '')
                q2 = str(driver.get('Q2','')).replace('0 days ', '')
                q3 = str(driver.get('Q3','')).replace('0 days ', '')
                t_str = q3 or q2 or q1 or ""
                
                # Fallback: If time is missing (common in Sprint Quali), check Laps
                if not t_str and session_type == 'SS':
                    try:
                        # Find driver's laps
                        d_laps = ff1_session.laps.pick_driver(driver_num)
                        if not d_laps.empty:
                            fastest_lap = d_laps.pick_fastest()
                            if fastest_lap is not None and pd.notna(fastest_lap['LapTime']):
                                # Format timedeltas: 0 days 00:01:35.123000 -> 0:01:35.123
                                t_str = str(fastest_lap['LapTime']).replace('0 days ', '')
                    except Exception as e:
                        pass # Keep empty if fails
            else:
                t_str = str(driver['Time']).replace('0 days ', '') if pd.notna(driver['Time']) else ""

            res = Result(
                race_id=race.id,
                position=pos,
                driver_number=driver_num,
                driver_code=code,
                driver_name=driver['FullName'],
                team_name=team,
                grid_position=grid,
                status=status,
                points=pts,
                time_str=t_str,
                session_type=session_type
            )
            session_db.add(res)
            count += 1
        
        return f"Added {count}"
    except Exception as e:
        return f"Error: {str(e)[:50]}"

def seed_results(year, session_db):
    print(f"\n--- 2. Results for {year} ---")
    races = session_db.query(Race).filter_by(year=year).order_by(Race.round).all()
    
    # Header
    print(f"{'Rd':<3} | {'Race':<20} | {'FP1':<10} | {'FP2':<10} | {'FP3':<10} | {'Q':<10} | {'SS':<10} | {'S':<10} | {'R':<10}")
    print("-" * 110)
    
    for race in races:
        fp1 = fetch_and_store_results(year, race, 'FP1', session_db)
        fp2 = fetch_and_store_results(year, race, 'FP2', session_db)
        fp3 = fetch_and_store_results(year, race, 'FP3', session_db)
        q   = fetch_and_store_results(year, race, 'Q', session_db)
        ss  = fetch_and_store_results(year, race, 'SS', session_db)
        s   = fetch_and_store_results(year, race, 'S', session_db)
        r   = fetch_and_store_results(year, race, 'R', session_db)
        
        print(f"{race.round:<3} | {race.race_name[:20]:<20} | {fp1[:10]:<10} | {fp2[:10]:<10} | {fp3[:10]:<10} | {q[:10]:<10} | {ss[:10]:<10} | {s[:10]:<10} | {r[:10]:<10}")
        session_db.commit()

# =================================================================================================
# 3. TELEMETRY & CIRCUIT SEEDER
# =================================================================================================

def seed_telemetry(year, session_db):
    print(f"\n--- 3. Telemetry & Circuit Data for {year} ---")
    races = session_db.query(Race).filter_by(year=year).order_by(Race.round).all()
    
    for race in races:
        print(f"\n[{race.round}] {race.race_name}")
        
        # Check if Laps already exist
        if session_db.query(Lap).filter_by(race_id=race.id).count() > 0:
            print("  Laps already exist. Checking Circuit/Marshals...")
        else:
            try:
                print("  Loading FastF1 session (telemetry=True)...")
                ff1_session = fastf1.get_session(year, race.round, 'R')
                ff1_session.load(telemetry=True, weather=False, messages=True) # Full load
                
                # --- LAPS ---
                laps = ff1_session.laps
                lap_count = 0
                lap_objects = []
                for _, lap in laps.iterrows():
                    if pd.isna(lap['LapNumber']): continue
                    
                    lap_obj = Lap(
                        race_id=race.id,
                        driver=lap['Driver'],
                        lap_number=int(lap['LapNumber']),
                        position=int(lap['Position']) if pd.notna(lap['Position']) else None,
                        lap_time=lap['LapTime'].total_seconds() if pd.notna(lap['LapTime']) else None,
                        cumulative_time=lap['Time'].total_seconds() if pd.notna(lap['Time']) else None,
                        tyre_compound=lap['Compound'] if pd.notna(lap['Compound']) else None,
                    )
                    lap_objects.append(lap_obj)
                    lap_count += 1
                
                session_db.add_all(lap_objects)
                print(f"  Added {lap_count} laps.")
                
                # --- MESSAGES (RaceStatus) ---
                if hasattr(ff1_session, 'race_control_messages') and not ff1_session.race_control_messages.empty:
                    msg_count = 0
                    for _, msg in ff1_session.race_control_messages.iterrows():
                        # Parse Time (Handle Timestamp vs Timedelta)
                        time_val = None
                        if pd.notna(msg['Time']):
                            if hasattr(msg['Time'], 'total_seconds'):
                                time_val = msg['Time'].total_seconds()
                            elif isinstance(msg['Time'], (pd.Timestamp, datetime)):
                                # Absolute time -> Session time
                                time_val = (msg['Time'] - ff1_session.date).total_seconds()
                        
                        category = msg['Category']
                        if category == 'Flag': status_val = msg['Flag']
                        elif category == 'SafetyCar': status_val = msg['Message']
                        else: status_val = msg['Message']

                        rs = RaceStatus(
                            race_id=race.id, 
                            time=time_val, 
                            status=status_val, 
                            weather=None,
                            category=category
                        )
                        session_db.add(rs)
                        msg_count += 1
                    print(f"  Added {msg_count} messages.")

            except Exception as e:
                print(f"  Error loading telemetry/messages: {e}")
                continue # Skip rest for this race if telemetry fails

        # --- CIRCUIT & MARSHALS ---
        # Can rely on ff1_session if loaded, or reload lightweight if skipped above?
        # Better to reuse. If skipped above, we need to load it now.
        
        circuit = session_db.query(Circuit).filter_by(race_id=race.id).first()
        if not circuit or not circuit.marshal_sectors_json:
            try:
                # Need session loaded
                ff1_session = fastf1.get_session(year, race.round, 'R')
                ff1_session.load(telemetry=True, weather=False, messages=False)
                
                circuit_info = ff1_session.get_circuit_info()
                laps = ff1_session.laps
                
                # Create Circuit if missing
                if not circuit:
                    fastest = laps.pick_fastest()
                    x_json, y_json, dist_json, corners_json = [], [], [], []
                    
                    if fastest is not None:
                        tel = fastest.get_telemetry()
                        # Downsample
                        x = tel['X'].tolist()[::10]
                        y = tel['Y'].tolist()[::10]
                        d = tel['Distance'].tolist()[::10]
                        
                        # Corners
                        c_list = []
                        if circuit_info and hasattr(circuit_info, 'corners'):
                            for _, c in circuit_info.corners.iterrows():
                                c_list.append({
                                    'number': str(c['Number']) + str(c['Letter']),
                                    'distance': float(c['Distance']),
                                    'angle': float(c['Angle']) if 'Angle' in c else 0
                                })
                        
                        circuit = Circuit(
                            race_id=race.id,
                            x_json=json.dumps(x),
                            y_json=json.dumps(y),
                            distance_json=json.dumps(d),
                            corners_json=json.dumps(c_list)
                        )
                        session_db.add(circuit)
                        session_db.flush() # Get ID
                        print("  Created Circuit data.")
                
                # Marshal Data (Interpolate)
                if circuit and not circuit.marshal_sectors_json:
                    print("  Calculating Marshal Sectors...")
                    x_coords = json.loads(circuit.x_json)
                    y_coords = json.loads(circuit.y_json)
                    distances = json.loads(circuit.distance_json)
                    
                    marshal_sectors = []
                    if circuit_info and hasattr(circuit_info, 'marshal_sectors'):
                        for _, row in circuit_info.marshal_sectors.iterrows():
                            dist = float(row.get('Distance', 0))
                            x, y = get_position_at_distance(x_coords, y_coords, distances, dist)
                            marshal_sectors.append({
                                'number': str(row.get('MarshalSector', row.name + 1)),
                                'distance': dist,
                                'x': x, 'y': y
                            })
                    circuit.marshal_sectors_json = json.dumps(marshal_sectors)
                    
                    # Marshal Lights
                    marshal_lights = []
                    if circuit_info and hasattr(circuit_info, 'marshal_lights'):
                        for _, row in circuit_info.marshal_lights.iterrows():
                             dist = float(row.get('Distance', 0))
                             x, y = get_position_at_distance(x_coords, y_coords, distances, dist)
                             marshal_lights.append({'distance': dist, 'x': x, 'y': y})
                    circuit.marshal_lights_json = json.dumps(marshal_lights)
                    print(f"  Added {len(marshal_sectors)} sectors.")

            except Exception as e:
                print(f"  Error processing circuit/marshals: {e}")

        session_db.commit()

# =================================================================================================
# MAIN
# =================================================================================================

def main():
    parser = argparse.ArgumentParser(description='Unified F1 Data Seeder')
    parser.add_argument('year', type=int, help='Season year to seed')
    parser.add_argument('--force', action='store_true', help='Force overwrite of data (Not fully impl)')
    args = parser.parse_args()
    
    year = args.year
    print(f"Starting Unified Seeding for {year} (No Cache)...")
    
    # Cache setup removed per user request
    # setup_cache()
    
    session = get_db_session()
    
    # 1. Schedule
    seed_schedule(year, session)
    
    # 2. Results
    seed_results(year, session)
    
    # 3. Telemetry/Circuit
    seed_telemetry(year, session)
    
    session.close()
    print(f"\n{'='*60}")
    print(f"SEEDING COMPLETE For {year}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
