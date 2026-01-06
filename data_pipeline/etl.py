import fastf1
import pandas as pd
from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime
import os
import json

# --- Configuration ---
DB_URL = "sqlite:///f1_data.db" 

# FastF1 Cache
CACHE_DIR = os.path.join(os.getcwd(), 'cache')
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)
fastf1.Cache.enable_cache(CACHE_DIR)

# --- Database Schema ---
Base = declarative_base()

class Race(Base):
    __tablename__ = 'races'
    id = Column(Integer, primary_key=True)
    year = Column(Integer, index=True)
    round = Column(Integer)
    circuit_name = Column(String)
    race_name = Column(String)
    date = Column(DateTime)
    
    results = relationship("Result", back_populates="race")
    laps = relationship("Lap", back_populates="race")
    circuit_data = relationship("Circuit", back_populates="race", uselist=False)
    telemetry_data = relationship("Telemetry", back_populates="race")

class Result(Base):
    __tablename__ = 'results'
    id = Column(Integer, primary_key=True)
    race_id = Column(Integer, ForeignKey('races.id'))
    position = Column(Integer)
    driver_number = Column(String)
    driver_code = Column(String)
    driver_name = Column(String)
    team_name = Column(String)
    grid_position = Column(Integer)
    status = Column(String)
    points = Column(Float)
    time_str = Column(String)
    session_type = Column(String) # NEW: 'FP1', 'FP2', 'FP3', 'Q', 'S', 'R'
    race = relationship("Race", back_populates="results")

class Lap(Base):
    __tablename__ = 'laps'
    id = Column(Integer, primary_key=True)
    race_id = Column(Integer, ForeignKey('races.id'))
    driver = Column(String)
    lap_number = Column(Integer)
    position = Column(Integer)
    lap_time = Column(Float)
    cumulative_time = Column(Float) # NEW: Seconds from session start
    tyre_compound = Column(String) 
    race = relationship("Race", back_populates="laps")

class Circuit(Base): # NEW: Map Data
    __tablename__ = 'circuits'
    id = Column(Integer, primary_key=True)
    race_id = Column(Integer, ForeignKey('races.id'))
    x_json = Column(Text) # JSON Array of X coordinates
    y_json = Column(Text) # JSON Array of Y coordinates
    distance_json = Column(Text) # NEW: JSON Array of Distance values
    corners_json = Column(Text) # JSON Array of {number, letter, distance}
    race = relationship("Race", back_populates="circuit_data")

class Telemetry(Base): # NEW: Graph Data (Fastest Lap Reference)
    __tablename__ = 'telemetry'
    id = Column(Integer, primary_key=True)
    race_id = Column(Integer, ForeignKey('races.id'))
    driver = Column(String)
    distance_json = Column(Text)
    speed_json = Column(Text)
    throttle_json = Column(Text)
    brake_json = Column(Text)
    gear_json = Column(Text) # NEW
    rpm_json = Column(Text) # NEW
    race = relationship("Race", back_populates="telemetry_data")

class RaceStatus(Base): # NEW: Weather & Flags
    __tablename__ = 'race_status'
    id = Column(Integer, primary_key=True)
    race_id = Column(Integer, ForeignKey('races.id'))
    time = Column(Float) # Session Time (seconds)
    status = Column(String) # 'GREEN', 'SC', 'WEATHER', etc.
    weather = Column(String) # JSON or simple string
    race = relationship("Race", back_populates="status_data")

Race.status_data = relationship("RaceStatus", back_populates="race") # Backref

# --- ETL Logic ---
def init_db():
    engine = create_engine(DB_URL)
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()

def sync_season(session, year):
    print(f"Syncing Season {year}...")
    schedule = fastf1.get_event_schedule(year)
    
    # Filter only completed official races
    # Ensure compare timezone-aware datetimes
    now = pd.Timestamp.now(tz='UTC')
    completed_races = schedule[
        (schedule['EventFormat'] != 'testing') & 
        (schedule['Session5Date'] < now) 
    ]
    
    for _, event in completed_races.iterrows():
        race_name = event['EventName']
        round_num = event['RoundNumber']
        
        existing_race = session.query(Race).filter_by(year=year, round=round_num).first()
        if existing_race:
            print(f"  Reprocessing Round {round_num}: {race_name}...")
            session.delete(existing_race)
            session.commit()
            
        print(f"  Processing Round {round_num}: {race_name}...")
        
        race = Race(
            year=year,
            round=round_num,
            circuit_name=event['Location'],
            race_name=race_name,
            date=event['EventDate'].to_pydatetime()
        )
        session.add(race)
        session.commit()
        
        try:
            # Load FastF1 Session (Enable telemetry for map/graph)
            # Iterate through all possible sessions
            # Mapping: fp1, fp2, fp3, qualifying, sprint qualifying (shootout), sprint, race
            # FastF1 uses identifiers: 'FP1', 'FP2', 'FP3', 'Q', 'SS', 'S', 'R'
            
            session_types = ['FP1', 'FP2', 'FP3', 'Q', 'SS', 'S', 'R']
            
            for session_code in session_types:
                try:
                    f1_session = fastf1.get_session(year, round_num, session_code)
                    # Check if session exists (some weekends don't have Sprint, etc)
                    # FastF1 might raise error or return empty if not found? 
                    # actually get_session returns object, .load() is where it might fail or show "no data"
                    
                    print(f"    Processing Session: {session_code}...")
                    # Only load what's needed. Telemetry only for Race for now to save space/time, unless requested?
                    # User asked for RESULTS of these sessions.
                    # Telemetry loading is heavy. Let's load minimal data for non-Race sessions.
                    
                    if session_code == 'R':
                        f1_session.load(telemetry=True, weather=True, messages=True)
                    else:
                        f1_session.load(telemetry=False, weather=False, messages=False) # Lighter load for practice/quali results
                        
                    # 1. Results
                    if not hasattr(f1_session, 'results') or f1_session.results.empty:
                        print(f"      No results for {session_code}")
                        continue

                    results = f1_session.results
                    result_objects = []
                    for _, row in results.iterrows():
                        time_val = str(row['Time']).split('days')[-1].strip()
                        if pd.isna(row['Time']):
                            time_val = str(row['Status']) # e.g. "DnF"

                        # For Quali/Practice, "Time" might be best lap time?
                        # FastF1 `results` df has columns like 'Q1', 'Q2', 'Q3' for Quali.
                        # Standardization: Use 'Time' (Gap) for Race, 'BestLapTime' for others?
                        
                        display_time = time_val
                        if session_code in ['Q', 'FP1', 'FP2', 'FP3', 'S']:
                             # Try to get best time
                             if 'Time' in row and not pd.isna(row['Time']):
                                 display_time = str(row['Time']).split('days')[-1].strip()
                             elif not pd.isna(row.get('Q3')):
                                 display_time = str(row['Q3']).split('days')[-1].strip()
                             elif not pd.isna(row.get('Q2')):
                                 display_time = str(row['Q2']).split('days')[-1].strip()
                             elif not pd.isna(row.get('Q1')):
                                 display_time = str(row['Q1']).split('days')[-1].strip()
                        
                        result = Result(
                            race_id=race.id,
                            position=row['Position'],
                            driver_number=str(row['DriverNumber']),
                            driver_code=row['Abbreviation'],
                            driver_name=row['FullName'],
                            team_name=row['TeamName'],
                            grid_position=row.get('GridPosition', 0), # Grid pos irrelevant for FP
                            status=str(row['Status']),
                            points=row['Points'],
                            time_str=display_time,
                            session_type=session_code
                        )
                        result_objects.append(result)
                    
                    session.add_all(result_objects)
                    
                    # Only process Race-specific heavy data (Laps, Map, Telemetry) for the 'R' session as originally designed
                    if session_code == 'R':
                        # ... (Original Logic for Laps, Map, Telemetry) ...
                        pass # The indented block below handles this, need to ensure indentation matches
                
                except Exception as e_sess:
                     print(f"      Could not process session {session_code}: {e_sess}")
                     continue

            # Original Logic block for Laps/Map was indented under the single `f1_session` load.
            # Now we need to make sure we only run that logic if we have the 'R' session loaded.
            # So I will wrap the remaining logic in `if session_code == 'R':` block?
            # Or simpler: re-fetch the 'R' session specifically for the heavy lifting after the loop?
            # No, efficiency.
            
            # The tool call replace_file_content is tricky here because the original extraction logic follows immediately.
            # I should rewrite the extraction logic to be inside the loop, conditionally.

            
            # 2. Laps & Tyres (Race Only)
            # We need to ensure 'R' session runs this. 
            # The structure above is complex to refactor in one go via chunks.
            # Ideally, I'd split the Result extraction from the Lap/Telemetry extraction.
            # But ETL is a single script.
            
            # STRATEGY: 
            # 1. Loop types for RESULTS.
            # 2. Then, purely for 'R' session, load Laps/Telemetry.
            
            # Reloading 'R' might be cleaner for the replace logic than complex nesting.
            
            # Let's try this:
            # The chunk above replaces the Result Logic.
            # Then I add a specific 'R' session loader for the rest?
            
            # Actually, the user wants me to do this now.
            # I will modify extraction logic to be cleaner.

            # --- 2. Laps, Map & Telemetry (Race Session Only) ---
            # We explicitly reload the 'R' session to ensure we have the correct data for the heavy lifting.
            try:
                print("    Processing Full Race Data (Laps/Telemetry)...")
                f1_session = fastf1.get_session(year, round_num, 'R')
                f1_session.load(telemetry=True, weather=True, messages=True)

                # laps & Tyres
                print("    Fetching Lap Data...")
                laps = f1_session.laps
                lap_objects = []
                for _, row in laps.iterrows():
                    lt = row['LapTime'].total_seconds() if not pd.isna(row['LapTime']) else None
                    # Cumulative Time (Time when they crossed the line)
                    ct = row['Time'].total_seconds() if not pd.isna(row['Time']) else None
                    
                    pos = int(row['Position']) if not pd.isna(row['Position']) else None
                    
                    # Tyre info
                    compound = row['Compound'] if 'Compound' in row else 'UNKNOWN'

                    lap = Lap(
                        race_id=race.id,
                        driver=row['Driver'],
                        lap_number=int(row['LapNumber']),
                        position=pos,
                        lap_time=lt,
                        cumulative_time=ct,
                        tyre_compound=compound
                    )
                    lap_objects.append(lap)
                session.add_all(lap_objects)

                # 3. Map & Telemetry
                print("    Fetching Map & Telemetry...")
                
                # Circuit Map (Use overall fastest lap for reference line)
                fastest_lap = laps.pick_fastest()
                if fastest_lap is not None:
                    # Use get_telemetry() to get merged CarData + PosData + Distance
                    lap_tel = fastest_lap.get_telemetry().add_distance()
                    
                    # Circuit Info (Corners)
                    circuit_info = f1_session.get_circuit_info()
                    corners_data = [] 
                    if circuit_info is not None:
                        for _, c_row in circuit_info.corners.iterrows():
                            corners_data.append({
                                "number": c_row['Number'],
                                "letter": c_row['Letter'],
                                "distance": c_row['Distance'],
                                "angle": c_row['Angle']
                            })

                    # Circuit Map (Downsample)
                    x_vals = lap_tel['X'].iloc[::10].tolist()
                    y_vals = lap_tel['Y'].iloc[::10].tolist()
                    d_vals = lap_tel['Distance'].iloc[::10].tolist()
                    
                    circuit = Circuit(
                        race_id=race.id,
                        x_json=json.dumps(x_vals),
                        y_json=json.dumps(y_vals),
                        distance_json=json.dumps(d_vals),
                        corners_json=json.dumps(corners_data)
                    )
                    session.add(circuit)

                # Telemetry for ALL Drivers
                telemetry_objects = []
                unique_drivers = laps['Driver'].unique()
                
                for drv in unique_drivers:
                    try:
                        drv_laps = laps.pick_driver(drv)
                        if drv_laps.shape[0] == 0: continue
                        
                        fl = drv_laps.pick_fastest()
                        if fl is None: continue
                        
                        # Fetch Car Data
                        car_data = fl.get_car_data().add_distance()
                        
                        # Downsample
                        dist_vals = car_data['Distance'].iloc[::10].tolist()
                        speed_vals = car_data['Speed'].iloc[::10].tolist()
                        throttle_vals = car_data['Throttle'].iloc[::10].tolist()
                        brake_vals = car_data['Brake'].iloc[::10].tolist()
                        gear_vals = car_data['nGear'].iloc[::10].tolist()
                        rpm_vals = car_data['RPM'].iloc[::10].tolist()

                        telemetry = Telemetry(
                            race_id=race.id,
                            driver=drv,
                            distance_json=json.dumps(dist_vals),
                            speed_json=json.dumps(speed_vals),
                            throttle_json=json.dumps(throttle_vals),
                            brake_json=json.dumps(brake_vals),
                            gear_json=json.dumps(gear_vals),
                            rpm_json=json.dumps(rpm_vals)
                        )
                        telemetry_objects.append(telemetry)
                    except Exception as e:
                        print(f"      Skipping telemetry for {drv}: {e}")

                session.add_all(telemetry_objects)

                session.commit()
                print(f"    Saved Results, Laps, Map, and Telemetry.")

                # 6. Race Status & Weather
                # Track Status
                track_status = f1_session.track_status
                weather_data = f1_session.weather_data
                
                status_objects = []
                
                # Flags
                # Status: 1=Green, 2=Yellow, 3=SC, 4=Red, 5=VSC
                for _, row in track_status.iterrows():
                    val = str(row['Status'])
                    label = 'GREEN'
                    if '2' in val: label = 'YELLOW'
                    if '3' in val: label = 'SC'
                    if '4' in val: label = 'RED'
                    if '5' in val: label = 'VSC'
                    
                    s = RaceStatus(
                        race_id=race.id,
                        time=row['Time'].total_seconds(),
                        status=label,
                        weather=None
                    )
                    status_objects.append(s)

                # Weather (Sample every 5 mins or on change)
                for _, row in weather_data.iloc[::10].iterrows(): # Downsample
                     w_info = {
                         'temp': row['AirTemp'],
                         'track_temp': row['TrackTemp'],
                         'rain': row['Rainfall'],
                         'humidity': row['Humidity']
                     }
                     s = RaceStatus(
                        race_id=race.id,
                        time=row['Time'].total_seconds(),
                        status='WEATHER',
                        weather=json.dumps(w_info)
                     )
                     status_objects.append(s)
                
                session.add_all(status_objects)
                session.commit()
                print(f"    Saved Status and Weather events.")

            except Exception as e_race:
                print(f"    Error processing detailed race data: {e_race}")
                session.rollback()

        except Exception as e:
            print(f"    Error processing {race_name}: {e}")
            session.rollback()

if __name__ == "__main__":
    db_session = init_db()
    
    # Sync 2025
    try:
        # Sync specific year
        sync_season(db_session, 2025)
    except Exception as e:
        print(f"Failed to sync season: {e}")
            
    print("ETL Complete.")
