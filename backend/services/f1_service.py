from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
import pandas as pd
from datetime import datetime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

Base = declarative_base()


# --- Models ---
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
    session_type = Column(String) # NEW: 'R', 'Q', 'S', etc.
    race = relationship("Race", back_populates="results")

class Lap(Base):
    __tablename__ = 'laps'
    id = Column(Integer, primary_key=True)
    race_id = Column(Integer, ForeignKey('races.id'))
    driver = Column(String)
    lap_number = Column(Integer)
    position = Column(Integer)
    lap_time = Column(Float)
    cumulative_time = Column(Float)
    tyre_compound = Column(String)
    race = relationship("Race", back_populates="laps")

class Circuit(Base):
    __tablename__ = 'circuits'
    id = Column(Integer, primary_key=True)
    race_id = Column(Integer, ForeignKey('races.id'))
    x_json = Column(String) # JSON Array of X coordinates
    y_json = Column(String) # JSON Array of Y coordinates
    distance_json = Column(String) # NEW: JSON Array of Distance values
    corners_json = Column(String) # NEW: JSON Array of Corner Data
    race = relationship("Race", back_populates="circuit_data")

class Telemetry(Base):
    __tablename__ = 'telemetry'
    id = Column(Integer, primary_key=True)
    race_id = Column(Integer, ForeignKey('races.id'))
    driver = Column(String)
    distance_json = Column(String)
    speed_json = Column(String)
    throttle_json = Column(String)
    brake_json = Column(String)
    gear_json = Column(String) # NEW
    rpm_json = Column(String) # NEW
    race = relationship("Race", back_populates="telemetry_data")

class RaceStatus(Base):
    __tablename__ = 'race_status'
    id = Column(Integer, primary_key=True)
    race_id = Column(Integer, ForeignKey('races.id'))
    time = Column(Float)
    status = Column(String)
    weather = Column(String)


# DB Connection
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'data_pipeline', 'f1_data.db')
DB_URL = f"sqlite:///{DB_PATH}"

def get_db_session():
    engine = create_engine(DB_URL)
    Session = sessionmaker(bind=engine)
    return Session()

def get_race_results_by_id(race_id):
    session = get_db_session()
    try:
        race = session.query(Race).filter(Race.id == race_id).first()
        if not race: return None

        # Fetch all results for this race
        # We want to group them by session_type? Or just return flat list and frontend filters?
        # Backend grouping is cleaner.
        results = session.query(Result).filter(Result.race_id == race_id).all()
        
        # Helper to format result row
        def format_res(r):
            return {
                "pos": r.position,
                "driver": r.driver_name,
                "code": r.driver_code,
                "team": r.team_name,
                "time": r.time_str,
                "pts": r.points,
                "status": r.status,
                "grid": r.grid_position,
                "session": r.session_type if r.session_type else 'R' # Default to Race if null
            }

        grouped_results = {}
        # Pre-initialize common sessions to ensure order? Frontend can handle order.
        
        for r in results:
            stype = r.session_type if r.session_type else 'R'
            if stype not in grouped_results: grouped_results[stype] = []
            grouped_results[stype].append(format_res(r))
            
        # Query Fastest Lap from Laps table
        fastest_lap = session.query(Lap).filter(Lap.race_id == race_id, Lap.lap_time.isnot(None))\
            .order_by(Lap.lap_time.asc()).first()
            
        fl_data = { "driver": "N/A", "time": "N/A" }
        if fastest_lap:
            # Format time: seconds to M:SS.ms
            m = int(fastest_lap.lap_time // 60)
            s = fastest_lap.lap_time % 60
            fl_data = {
                "driver": fastest_lap.driver,
                "time": f"{m}:{s:.3f}"
            }
        
        response = {
            "raceId": race.id,
            "raceName": race.race_name,
            "circuit": race.circuit_name,
            "date": race.date.strftime("%d %b %Y"),
            "results": grouped_results,
            "fastestLap": fl_data,
            "winner": "N/A",
            "winnerTeam": "N/A"
        }
        
        # Add 'winner' info from Race session
        race_results = grouped_results.get('R', [])
        if race_results:
            # Sort by pos
            race_results.sort(key=lambda x: int(x['pos']) if isinstance(x['pos'], int) else 999)
            if race_results:
                winner = race_results[0]
                response["winner"] = winner["driver"]
                response["winnerTeam"] = winner["team"]
        
        return response

    except Exception as e:
        print(f"Error fetching race results: {e}")
        return None
    finally:
        session.close()

def get_latest_race_results():
    session = get_db_session()
    try:
        latest_race = session.query(Race).join(Result).order_by(Race.date.desc()).first()
        if not latest_race: return None
        return get_race_results_by_id(latest_race.id)
    except Exception as e:
        print(f"Error fetching latest results: {e}")
        return None
    finally:
        session.close()


def get_races_list(year=None):
    session = get_db_session()
    try:
        query = session.query(Race)
        if year:
            query = query.filter(Race.year == year)
            
        races = query.order_by(Race.date).all()
        
        # Helper map (Name -> Code)
        # We can try to infer from CIRCUIT_DATA keys or hardcode logic
        def get_code(name):
            n = name.lower()
            if "bahrain" in n: return "bhr"
            if "saudi" in n or "jeddah" in n: return "sau"
            if "australia" in n or "melbourne" in n: return "aus"
            if "japan" in n or "suzuka" in n: return "jpn"
            if "chinese" in n or "china" in n or "shanghai" in n: return "chn"
            if "miami" in n: return "mia"
            if "emilia" in n or "imola" in n: return "emi"
            if "monaco" in n or "monte carlo" in n: return "mon"
            if "canadian" in n or "canada" in n or "montreal" in n: return "can"
            if "spain" in n or "spanish" in n or "barcelona" in n: return "esp"
            if "austria" in n or "spielberg" in n: return "aut"
            if "britain" in n or "british" in n or "silverstone" in n: return "gbr"
            if "hungary" in n or "hungarian" in n or "budapest" in n: return "hun"
            if "belgium" in n or "belgian" in n or "spa" in n: return "bel"
            if "netherlands" in n or "dutch" in n or "zandvoort" in n: return "ned"
            if "italy" in n or "italian" in n or "monza" in n: return "ita"
            if "azerbaijan" in n or "baku" in n: return "azb"
            if "singapore" in n or "marina bay" in n: return "sin"
            if "united states" in n or "usa" in n or "austin" in n or "cota" in n: return "usa"
            if "mexico" in n or "mexican" in n: return "mex"
            if "brazil" in n or "são paulo" in n or "sao paulo" in n or "interlagos" in n: return "bra"
            if "vegas" in n: return "lvg"
            if "qatar" in n or "lusail" in n: return "qat"
            if "abu dhabi" in n or "yas marina" in n: return "abu"
            # Fallback: Use first 3 chars + ID to ensure uniqueness
            return f"unk_{r.id}"

        result = []
        for r in races:
            code = get_code(r.race_name)
            
            # Circuit Context Mock/Map
            cond = {"weather": "Dry", "temp": "25°C", "deg": "Med Deg", "sc_prob": "Low"}
            if code in ['sin', 'mon', 'baku', 'jed', 'lvg']:
                 cond = {"weather": "Humid", "temp": "29°C", "deg": "High Deg", "sc_prob": "High (Street)"}
            elif code in ['spa', 'gbr', 'ned', 'can']:
                 cond = {"weather": "Mixed", "temp": "18°C", "deg": "Med Deg", "sc_prob": "Med (Weather)"}
            elif code in ['bhr', 'abud', 'qat', 'sau']:
                 cond = {"weather": "Dry", "temp": "28°C", "deg": "High Deg", "sc_prob": "Low-Med"}
            elif code in ['aut', 'ita', 'usa', 'mex']:
                 cond = {"weather": "Dry", "temp": "26°C", "deg": "Med Deg", "sc_prob": "Med"}
            
            circuit_info = CIRCUIT_DATA.get(code, {})
            laps = circuit_info.get("laps", 50) 
            
            result.append({
                "id": r.id,     # DB ID (Integer) for History/Results API
                "code": code,   # String Code ('aus') for Strategy/Simulations
                "name": r.race_name.replace(" Grand Prix", ""),
                "date": r.date.strftime("%d %b %Y"),
                "circuit": r.circuit_name,
                "round": r.round,
                "status": "Completed" if r.date < datetime.now() else "Upcoming",
                "laps": laps,
                "conditions": f"{cond['weather']} • {cond['temp']} • {cond['deg']}",
                "sc_context": f"Based on {cond['sc_prob']} incident rate"
            })
        return result
    except Exception as e:
        print(f"Races List Error: {e}")
        return []
    finally:
        session.close()

def get_race_replay(race_id):
    session = get_db_session()
    try:
        # Laps
        laps = session.query(Lap).filter_by(race_id=race_id).order_by(Lap.lap_number, Lap.position).all()
        
        # Circuit Map
        circuit = session.query(Circuit).filter_by(race_id=race_id).first()
        map_data = None
        if circuit:
            import json
            try:
                map_data = {
                    "x": json.loads(circuit.x_json),
                    "y": json.loads(circuit.y_json),
                    "distance": json.loads(circuit.distance_json) if circuit.distance_json else [], # NEW
                    "corners": json.loads(circuit.corners_json) if circuit.corners_json else []
                }
            except:
                pass

        if not laps: return None
            
        # Group by lap number
        replay_data = {}
        max_lap = 0
        
        for lap in laps:
            if lap.lap_number not in replay_data:
                replay_data[lap.lap_number] = []
            
            replay_data[lap.lap_number].append({
                "driver": lap.driver,
                "position": lap.position,
                "time": lap.lap_time,
                "cummulative": lap.cumulative_time,
                "tyre": lap.tyre_compound
            })
            if lap.lap_number > max_lap:
                max_lap = lap.lap_number
                
        # Driver Metadata (Teams & Colors)
        driver_meta = {}
        team_colors = {
            "Red Bull Racing": "#3671C6", "Mercedes": "#6CD3BF", "Ferrari": "#F91536",
            "McLaren": "#F58020", "Aston Martin": "#358C75", "Alpine": "#2293D1",
            "Williams": "#37BEDD", "RB": "#6692FF", "Sauber": "#52E252", "Haas F1 Team": "#B6BABD",
            "Kick Sauber": "#52E252", "Racing Bulls": "#6692FF" # Aliases
        }
        results = session.query(Result).filter_by(race_id=race_id).all()
        for r in results:
            # Try to match team color
            color = "#FFFFFF"
            for team_key, hex_val in team_colors.items():
                if team_key in (r.team_name or ""):
                    color = hex_val
                    break
            
            driver_meta[r.driver_code] = {
                "name": r.driver_name,
                "team": r.team_name,
                "color": color
            }

        result = {
            "raceId": race_id,
            "totalLaps": max_lap,
            "data": replay_data,
            "map": map_data,
            "drivers": driver_meta,
            "events": []
        }
        
        # Events
        status_rows = session.query(RaceStatus).filter_by(race_id=race_id).order_by(RaceStatus.time).all()
        if status_rows:
            import json
            for s in status_rows:
                ev = {
                    "time": s.time,
                    "status": s.status,
                    "weather": json.loads(s.weather) if s.weather else None
                }
                result["events"].append(ev)
        
        return result
        
    except Exception as e:
        print(f"Replay Error: {e}")
        import traceback
        traceback.print_exc()
        return None
    finally:
        session.close()

def get_telemetry(race_id, driver=None):
    session = get_db_session()
    try:
        query = session.query(Telemetry).filter_by(race_id=race_id)
        if driver:
            query = query.filter_by(driver=driver)
            
        telemetry = query.first()
        
        # Fallback if specific driver not found (e.g. at start)
        if not telemetry and driver:
             telemetry = session.query(Telemetry).filter_by(race_id=race_id).first()

        if not telemetry: return None

        import json
        return {
            "driver": telemetry.driver,
            "distance": json.loads(telemetry.distance_json),
            "speed": json.loads(telemetry.speed_json),
            "throttle": json.loads(telemetry.throttle_json),
            "brake": json.loads(telemetry.brake_json),
            "gear": json.loads(telemetry.gear_json) if telemetry.gear_json else [],
            "rpm": json.loads(telemetry.rpm_json) if telemetry.rpm_json else []
        }
    except Exception as e:
        print(f"Telemetry Error: {e}")
        return None
    finally:
        session.close()

# --- Analysis Service ---
def get_analysis_data(race_id, driver1, driver2, lap1_num=None, lap2_num=None):
    """
    Computes deep-dive analysis. Now supports specific Laps.
    """
    import fastf1
    import fastf1.utils
    import numpy as np
    
    db_session = get_db_session()
    try:
        print(f"Analyzing Race {race_id}: {driver1} vs {driver2} (Laps: {lap1_num}, {lap2_num})")
        race = db_session.query(Race).filter_by(id=race_id).first()
        if not race: return {"error": "Race not found"}

        # Cache Setup
        cache_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'data_pipeline', 'f1_cache')
        if not os.path.exists(cache_dir): os.makedirs(cache_dir)
        fastf1.Cache.enable_cache(cache_dir)

    # Load Session
        # Enable weather for context, telemetry is already True
        session = fastf1.get_session(race.year, race.round, 'R')
        session.load(telemetry=True, weather=True, messages=False)

        # Get Laps
        laps = session.laps.pick_quicklaps()
        
        # Helper to pick lap
        def pick_lap(driver, lap_num):
            d_laps = laps.pick_drivers(driver)
            if not lap_num or str(lap_num) == 'fastest':
                return d_laps.pick_fastest()
            else:
                # Find specific lap
                try:
                    ln = float(lap_num)
                    l = d_laps[d_laps['LapNumber'] == ln]
                    if not l.empty: return l.iloc[0]
                except: pass
                return d_laps.pick_fastest() # Fallback

        d1_lap = pick_lap(driver1, lap1_num)
        d2_lap = pick_lap(driver2, lap2_num)

        if d1_lap is None or d2_lap is None:
            return {"error": "Telemetry not available for one or both drivers"}

        # 0. Weather Conditions (Context)
        conditions = {}
        try:
            # session.weather_data is a DataFrame with cols: Time, AirTemp, Humidity, Pressure, Rainfall, TrackTemp, WindDirection, WindSpeed
            # We'll take the weather closest to the start of the reference lap
            w_data = session.weather_data
            if not w_data.empty:
                # Find weather at lap start time
                # d1_lap['LapStartTime'] is a Timedelta relative to session start? 
                # Actually FastF1 weather is indexed by Time usually or available as stream.
                # Let's just pick the mean or the first row if we can't sync perfectly easily, 
                # but better to sync.
                # lap start time is d1_lap['LapStartTime'] (timedelta)
                # match closest in w_data['Time']
                lap_start = d1_lap['LapStartTime']
                # find row with closest Time
                idx = (w_data['Time'] - lap_start).abs().idxmin()
                w_row = w_data.loc[idx]
                conditions = {
                    "airTemp": float(w_row['AirTemp']),
                    "trackTemp": float(w_row['TrackTemp']),
                    "humidity": float(w_row['Humidity']),
                    "pressure": float(w_row['Pressure']),
                    "windSpeed": float(w_row['WindSpeed']),
                    "rain": bool(w_row['Rainfall'])
                }
        except Exception as e:
            print(f"Weather error: {e}")
            pass

        # 1. Time Delta (Gap) & Speed/Throttle Delta
        # delta_time returns the time gap at specific distances of the reference lap (d1_lap)
        delta_time, ref_tel, def_tel = fastf1.utils.delta_time(d1_lap, d2_lap)
        
        # Prepare Delta Series for Chart & Map
        # ref_tel['Distance'] is the x-axis
        delta_series = []
        dists = ref_tel['Distance'].tolist()
        deltas = delta_time.tolist()
        
        # Reference Data
        ref_speeds = ref_tel['Speed'].tolist()
        ref_throttle = ref_tel['Throttle'].tolist()
        ref_gear = ref_tel['nGear'].tolist()

        # Compare Data (Need to interpolate to align with ref distances for "Delta")
        # fastf1.utils.delta_time aligns them internally but returns ref_tel and def_tel separate?
        # Actually ref_tel is the reference telemetry interpolated to a common index?
        # No, delta_time returns "ref_tel" (aligned to distance?)
        # Let's double check fastf1 docs logic:
        # "ref_tel" is the telemetry of the reference lap. "def_tel" is the comparison lap telemetry REMAPPED to ref_tel distance?
        # Typically people assume def_tel is aligned. Let's assume lengths match?
        # If lengths don't match, we need to interpolate def_tel to ref_tel['Distance'].
        
        # Interpolate Compare Telemetry to Reference Distances
        # We use numpy interp
        comp_speeds = np.interp(dists, def_tel['Distance'], def_tel['Speed'])
        comp_throttle = np.interp(dists, def_tel['Distance'], def_tel['Throttle'])
        comp_gear = np.interp(dists, def_tel['Distance'], def_tel['nGear']) # Gear interp is slightly weird but OK for vis

        # Downsample for frontend performance (every 10th point)
        for i in range(0, len(dists), 10):
            delta_series.append({
                "dist": round(dists[i], 1),
                "delta": round(-deltas[i], 4), # Invert: Gap > 0 (Ahead) -> Delta < 0 (Faster)
                "speed": int(ref_speeds[i]),
                "gear": int(ref_gear[i]),
                "throttle": int(ref_throttle[i]),
                # Extended Data
                "speed_compare": int(comp_speeds[i]),
                "throttle_compare": int(comp_throttle[i]),
                "gear_compare": int(comp_gear[i]),
                "speed_delta": int(ref_speeds[i] - comp_speeds[i]),
                "throttle_delta": int(ref_throttle[i] - comp_throttle[i])
            })

        # 2. Corner Analysis
        circuit_info = session.get_circuit_info()
        corners = []
        
        # Helper to get specific speed at distance
        def get_speed_at(telemetry, target_dist):
            # Find closest point
            idx = (np.abs(telemetry['Distance'] - target_dist)).argmin()
            if idx < 0 or idx >= len(telemetry): return 0
            return telemetry.iloc[idx]['Speed']

        # Helper to get min speed in a window around a distance
        def get_corner_stats(telemetry, center_dist, window=50):
            mask = (telemetry['Distance'] > center_dist - window) & (telemetry['Distance'] < center_dist + window)
            sector = telemetry[mask]
            if sector.empty: return 0, 0
            return sector['Speed'].min(), sector['nGear'].mode().max() if not sector['nGear'].mode().empty else 0

        if circuit_info is not None:
            # Iterate through corners
            for index, row in circuit_info.corners.iterrows():
                num = row['Number']
                dist = row['Distance']
                
                # Apex Stats
                v_min_1, gear_1 = get_corner_stats(d1_lap.get_telemetry(), dist)
                v_min_2, gear_2 = get_corner_stats(d2_lap.get_telemetry(), dist)
                
                # Entry/Exit Stats (approx +/- 30m from apex)
                v_entry_1 = get_speed_at(d1_lap.get_telemetry(), dist - 30)
                v_entry_2 = get_speed_at(d2_lap.get_telemetry(), dist - 30)
                v_exit_1 = get_speed_at(d1_lap.get_telemetry(), dist + 30)
                v_exit_2 = get_speed_at(d2_lap.get_telemetry(), dist + 30)

                # Time Delta at this corner (approximate from delta series)
                idx = (np.abs(ref_tel['Distance'] - dist)).argmin()
                time_lost = -delta_time.iloc[idx] # Invert to match Delta convention
                
                # Determine "Reason"
                # Heuristic: Compare speed profiles
                reason = "Balanced"
                if abs(time_lost) > 0.05: # Only significant gaps
                    # Check who is faster based on delta trend or just raw speeds
                    # If time_lost (D1 - D2?) is NEGATIVE -> D1 is AHEAD/FASTER? 
                    # fastf1 delta: Ref(D1) - Comp(D2). + means D1 is AHEAD (Faster if strictly gap... wait)
                    # "Positive value means that 'ref' is ahead of 'comp'" => Ref time < Comp time?
                    # Usually "Gap" = Ref - Comp. If Ref is 10s, Comp 11s. Gap = -1s? 
                    # No, usually Gap = Leader - Car. 
                    # Let's rely on stored delta. Frontend treats < 0 as "Active Driver Faster".
                    
                    winner = 1 if time_lost < 0 else 2 # Who has the advantage (time_lost is accumulated gap?)
                    # Wait, 'delta_time' is CUMULATIVE GAP.
                    # We need LOCAL gain/loss.
                    # 'time_lost' here is just the gap value at that point. 
                    # Use local speed diffs to explain the STATE at that corner.
                    
                    if v_min_1 > v_min_2 + 5: reason = f"{driver1} Higher Apex Speed"
                    elif v_min_2 > v_min_1 + 5: reason = f"{driver2} Higher Apex Speed"
                    elif v_exit_1 > v_exit_2 + 5: reason = f"{driver1} Better Exit"
                    elif v_exit_2 > v_exit_1 + 5: reason = f"{driver2} Better Exit"
                    elif v_entry_1 > v_entry_2 + 5: reason = f"{driver1} Later Braking"
                    elif v_entry_2 > v_entry_1 + 5: reason = f"{driver2} Later Braking"
                
                corners.append({
                    "number": str(num) + str(row['Letter']),
                    "distance": dist,
                    "d1_min_speed": round(v_min_1, 1),
                    "d2_min_speed": round(v_min_2, 1),
                    "d1_gear": int(gear_1),
                    "d2_gear": int(gear_2),
                    "delta_at_apex": round(time_lost, 3),
                    "reason": reason
                })

        return {
            "driver1": driver1,
            "driver2": driver2,
            "session_name": session.name,
            "lap_time_diff": round(d1_lap.LapTime.total_seconds() - d2_lap.LapTime.total_seconds(), 3),
            "delta_series": delta_series,
            "corners": corners,
            "conditions": conditions,
            "lap1_time": d1_lap['LapTime'].total_seconds(),
            "lap2_time": d2_lap['LapTime'].total_seconds(),
            "lap1_compound": d1_lap['Compound'],
            "lap2_compound": d2_lap['Compound'],
            "color1": "#FFFFFF", 
            "color2": "#FFFFFF"
        }

    except Exception as e:
        print(f"Analysis Error: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}
    finally:
        db_session.close()

def get_race_control_messages(race_id):
    """
    Fetches Race Control Messages (Flags, SC, Penalties) for a race.
    """
    import fastf1
    db_session = get_db_session()
    try:
        race = db_session.query(Race).filter_by(id=race_id).first()
        if not race: return {"error": "Race not found"}

        # Cache Setup
        cache_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'data_pipeline', 'f1_cache')
        if not os.path.exists(cache_dir):
            os.makedirs(cache_dir)
        fastf1.Cache.enable_cache(cache_dir)
        
        session = fastf1.get_session(race.year, race.round, 'R')
        session.load(telemetry=False, weather=False, messages=True) # Load ONLY messages for speed
        
        messages = session.race_control_messages
        # Ensure we have a valid DataFrame (session.load can sometimes result in None or empty structures if no data)
        # messages is a property, usually returning None or DataFrame
        if messages is None or (hasattr(messages, 'empty') and messages.empty):
            # Try to return at least something
            messages = pd.DataFrame() 

        # Format Messages
        # Columns available: 'Time', 'Category', 'Message', 'lap', 'Sector', 'Status'
        formatted_messages = []
        for _, row in messages.iterrows():
            # Inferred Category if missing
            category = row['Category']
            msg_text = str(row['Message'])
            
            if "SAFETY CAR" in msg_text or "VIRTUAL SAFETY CAR" in msg_text:
                category = "SafetyCar"
            elif "PENALTY" in msg_text or "INVESTIGATION" in msg_text:
                category = "Penalty"
            elif "FLAG" in msg_text:
                category = "Flag"
            elif category == "Other":
                category = "General"

            # Format Time
            # We want a string for display: "HH:MM:SS" or "+1:23.456"
            time_display = ""
            # ... (Time format logic same)
            raw_time = row['Time']
            if not pd.isna(raw_time):
                 if hasattr(raw_time, 'total_seconds'):
                     s = int(raw_time.total_seconds())
                     h = s // 3600
                     m = (s % 3600) // 60
                     s = s % 60
                     if h > 0: time_display = f"+{h}:{m:02d}:{s:02d}"
                     else: time_display = f"+{m}:{s:02d}"
                 elif hasattr(raw_time, 'strftime'):
                      try: time_display = raw_time.strftime("%H:%M:%S")
                      except: time_display = str(raw_time)
                 else:
                      time_display = str(raw_time)

            formatted_messages.append({
                "time": time_display,
                "lap": int(row['Lap']) if 'Lap' in row and not pd.isna(row['Lap']) else None,
                "category": category,
                "message": msg_text,
                "flag": row['Flag'] if 'Flag' in row and not pd.isna(row['Flag']) else None
            })
            
        return {"messages": formatted_messages}

    except Exception as e:
        print(f"Error fetching race control messages: {e}")
        return {"error": str(e)}
    finally:
        db_session.close()

def get_driver_laps(race_id, driver_id):
    """
    Returns list of valid laps for a driver
    """
    import fastf1
    db_session = get_db_session()
    try:
        race = db_session.query(Race).filter_by(id=race_id).first()
        if not race: return []
        
        # Cache & Session Load
        cache_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'data_pipeline', 'f1_cache')
        fastf1.Cache.enable_cache(cache_dir)
        session = fastf1.get_session(race.year, race.round, 'R')
        session.load(telemetry=False, weather=False, messages=False) # Lighter load
        
        laps = session.laps.pick_drivers(driver_id).pick_quicklaps()
        result = []
        for i, lap in laps.iterrows():
            if pd.isna(lap['LapTime']): continue
            # Format Sectors
            def fmt_time(t):
               if pd.isna(t): return None
               return str(t).split('days')[-1].strip()

            result.append({
                "lap_number": int(lap['LapNumber']),
                "lap_time": fmt_time(lap['LapTime']),
                "s1": fmt_time(lap['Sector1Time']),
                "s2": fmt_time(lap['Sector2Time']),
                "s3": fmt_time(lap['Sector3Time']),
                "compound": lap['Compound'],
                "stint": int(lap['Stint']) if not pd.isna(lap['Stint']) else 0,
                "is_fastest": lap['LapTime'] == laps.pick_fastest()['LapTime']
            })
        return result
    except Exception as e:
        print(f"Error fetching laps: {e}")
        return []
    finally:
        db_session.close()

def get_season_standings(year=2024):
    """
    Returns aggregated standings for the season.
    - Total Points
    - Position per race (for heatmap)
    - WDC Math (Max remaining points)
    """
    db_session = get_db_session()
    try:
        # Get all results for the year
        # Join Race to filter by year
        results = db_session.query(Result, Race).join(Race).filter(Race.year == year).all()
        
        if not results:
            return {"error": f"No data for {year}"}

        # Structure:
        # {
        #   "drivers": {
        #       "VER": { "points": 100, "wins": 2, "positions": { "Bahrain": 1, "Saudi": 1 } }
        #   },
        #   "races": ["Bahrain", "Saudi", ...], // Ordered by date
        #   "total_rounds": 24, // Hardcoded or estimated
        #   "completed_rounds": 2
        # }

        drivers = {}
        races_set = set()
        race_order = []

        # Get all races first to establish order
        all_races = db_session.query(Race).filter_by(year=year).order_by(Race.date).all()
        race_map = {r.id: r.race_name for r in all_races} # ID -> Name
        race_list = [r.race_name for r in all_races]
        
        # Process Results
        for r, race in results:
            d_code = r.driver_code
            if d_code not in drivers:
                drivers[d_code] = {
                    "code": d_code,
                    "name": r.driver_name,
                    "team": r.team_name,
                    "points": 0,
                    "wins": 0,
                    "podiums": 0,
                    "results": {} # race_name -> position
                }
            
            # Determine Session Type
            stype = str(r.session_type).upper() if r.session_type else 'R'

            # Skip Practice and Qualifying for Standings Stats
            # (Note: Pole positions could be tracked from Q, but not for "Wins"/"Points" in main table usually)
            if stype not in ['R', 'S']:
                continue

            # Update Stats
            points = r.points if r.points is not None else 0
            drivers[d_code]["points"] += points
            
            # Counts for MAIN RACES Only
            if stype == "R":
                # Count Starts
                if "starts" not in drivers[d_code]: drivers[d_code]["starts"] = 0
                drivers[d_code]["starts"] += 1
                
                # Count Finishes (Status "Finished" or "+" laps)
                # Simplistic check: if status is not 'R' or DNF-like words
                status_str = str(r.status).lower()
                if "not classified" not in status_str and "retired" not in status_str and "disqualified" not in status_str:
                     if "finishes" not in drivers[d_code]: drivers[d_code]["finishes"] = 0
                     drivers[d_code]["finishes"] += 1
                
                position = r.position if r.position is not None else 999
                if position == 1: drivers[d_code]["wins"] += 1
                if position <= 3: drivers[d_code]["podiums"] += 1
                
                # Heatmap Data (Positions per Race)
                drivers[d_code]["results"][race.race_name] = position

        # Post-process: Calculate History and Consistency
        driver_list = list(drivers.values())
        
        # Pre-calculate points per race for history
        # driver_round_points[driver_code][race_name] = total_points_in_round (Sprint + Race)
        driver_round_points = {}
        
        for r, race in results:
             d_code = r.driver_code
             if d_code not in driver_round_points: driver_round_points[d_code] = {}
             if race.race_name not in driver_round_points[d_code]: driver_round_points[d_code][race.race_name] = 0
             
             if r.points:
                 driver_round_points[d_code][race.race_name] += r.points

        for d in driver_list:
            d["history"] = []
            cumulative = 0
            # Look up result for each race in order
            for race_obj in all_races: # Iterate all season races
                 # Get points earned in this round (Sprint + Race + FL)
                 pts = driver_round_points.get(d["code"], {}).get(race_obj.race_name, 0)
                 
                 # Only append if race has happened (exists in ANY results or implies date passed)
                 # We check if *anyone* scored points or if it's in the results set
                 # Simplest: if we have points, add them. If 0, check if race status is completed.
                 # But we assume 'all_races' allows us to plot the whole season line?
                 # If future race, points are 0. Cumulative stays flat.
                 
                 cumulative += pts
                 d["history"].append(cumulative)
            
            d["final_points_calc"] = cumulative # Validation

        # Helper to calculate rank change
        # 1. Calculate points before the last round
        # We need to know which races count for "Current" vs "Previous"
        # Since 'all_races' are ordered, we assume the season is cumulative.
        # But `results` contains ALL results for the year.
        # To find "previous" rank, we look at `d.history[-2]` if available? 
        # d.history tracks cumulative points.
        # So Rank at index -2 vs Rank at index -1.
        
        # We need to sort drivers by history[-2] to get previous rank.
        
        # Check history length first
        season_len = len(driver_list[0]["history"]) if driver_list else 0
        
        if season_len >= 2:
            # Map driver_code -> prev_points
            prev_points_map = {}
            for d in driver_list:
                # history[-2] is points before last race?
                # history has one entry per race in `all_races`.
                # If race hasn't happened, points stay flat.
                # We want the change due to the LATEST result.
                # So we compare Rank(End) vs Rank(Start of Last Result).
                # Actually, simplest is just Sort by history[-2] and get Rank.
                prev_points_map[d["code"]] = d["history"][-2] if len(d["history"]) >= 2 else 0
            
            # Sort by prev points
            sorted_prev = sorted(driver_list, key=lambda x: prev_points_map.get(x["code"], 0), reverse=True)
            
            # Assign prev_rank
            for rank, d in enumerate(sorted_prev):
                d["prev_rank"] = rank + 1
                
            # Now compare with current rank (already sorted by points)
            for rank, d in enumerate(driver_list):
                curr_rank = rank + 1
                prev = d.get("prev_rank", curr_rank)
                d["change"] = prev - curr_rank # Positive = Gained places (e.g. 5 -> 3 = +2)
        else:
            for d in driver_list: d["change"] = 0

        # --- Constructor Standings ---
        constructors = {}
        # We also need constructor history to compute constructor arrows
        # Re-accumulate based on drivers
        
        # Initialize constructors
        for d in driver_list:
            team = d.get("team")
            if not team or team == "None": continue
            if team not in constructors:
                constructors[team] = {
                    "name": team,
                    "points": 0,
                    "wins": 0, 
                    "podiums": 0, 
                    "drivers": [],
                    "history": [0] * season_len # Initialize history array
                }
            constructors[team]["points"] += d.get("points", 0)
            constructors[team]["wins"] += d.get("wins", 0)
            constructors[team]["podiums"] += d.get("podiums", 0)
            constructors[team]["drivers"].append(d.get("code", "???"))
            
            # Sum history
            for i, pts in enumerate(d.get("history", [])):
                if i < len(constructors[team]["history"]):
                    constructors[team]["history"][i] += pts

        constructor_list = list(constructors.values())
        constructor_list.sort(key=lambda x: x["points"], reverse=True)
        
        # Calculate Constructor Delta
        if season_len >= 2:
            prev_cons_map = {}
            for c in constructor_list:
                prev_cons_map[c["name"]] = c["history"][-2] if len(c["history"]) >= 2 else 0
            
            sorted_prev_c = sorted(constructor_list, key=lambda x: prev_cons_map.get(x["name"], 0), reverse=True)
            
            for rank, c in enumerate(sorted_prev_c):
                c["prev_rank"] = rank + 1
                
            for rank, c in enumerate(constructor_list):
                curr = rank + 1
                prev = c.get("prev_rank", curr)
                c["change"] = prev - curr
        else:
            for c in constructor_list: c["change"] = 0

        # Calculate Consistency King (Restored)
        consistency_leader = None
        best_rate = -1
        total_completed = len(set(r.race_id for r, _ in results)) # Restored variable
        min_starts = 2 if total_completed > 2 else 0 
        
        for d in driver_list:
            starts = d.get("starts", 0)
            finishes = d.get("finishes", 0)
            rate = (finishes / starts * 100) if starts > 0 else 0
            d["finish_rate"] = round(rate, 1)
            
            if rate > best_rate and starts > min_starts: 
                best_rate = rate
                consistency_leader = {"name": d["name"], "rate": rate, "points": d["points"]}
            elif rate == best_rate and starts > min_starts:
                if d["points"] > (consistency_leader.get("points") if consistency_leader else -1):
                    consistency_leader = {"name": d["name"], "rate": rate, "points": d["points"]}

        # Final sort to ensure rank is correct
        driver_list.sort(key=lambda x: x["points"], reverse=True)

        return {
            "drivers": driver_list,
            "constructors": constructor_list,
            "races": race_list,
            "total_rounds": len(all_races) if len(all_races) > 0 else 24,
            "completed_rounds": total_completed,
            "consistency_leader": consistency_leader
        }

    except Exception as e:
        print(f"Standings Error: {e}")
        return {"error": str(e)}
    finally:
        db_session.close()

def run_monte_carlo_simulation(year=2025, n_sims=5000, chaos_factor=1.0, driver_mods=None, reliability=0.95):
    """
    Advanced Monte Carlo Simulation (Gen 8)
    - Trajectory Analysis: P10, P50, P90 paths
    - Reliability: Random DNF chance
    - Circuit Physics: Overtake delta affects variance
    """
    session = get_db_session() # Use the proper session
    driver_mods = driver_mods or {} 
    
    try:
        # 1. Fetch Historical Data (Season so far)
        results = session.query(Result, Race).join(Race).filter(Race.year == year).all()
        
        driver_stats = {}
        active_drivers = []
        
        # Parse Results
        for res, race in results:
            d_code = res.driver_code
            if d_code not in driver_stats:
                driver_stats[d_code] = {"current_points": 0, "positions": [], "name": res.driver_name, "wins": 0}
            
            driver_stats[d_code]["current_points"] += res.points
            driver_stats[d_code]["positions"].append(res.position)
            
        active_drivers = list(driver_stats.keys())

        # Compute Recent Form (Last 5)
        import numpy as np
        for code in active_drivers:
            stats = driver_stats[code]
            recent = stats["positions"][-5:]
            if recent:
                stats["mean"] = np.mean(recent)
                stats["std"] = np.std(recent) if len(recent) > 1 else 3 
        
        # Fallback: Validation for Pre-Season (No results yet)
        if not active_drivers:
            # Fetch LAST YEAR's grid to seed the simulation
            last_year_results = session.query(Result).join(Race).filter(Race.year == year - 1).all()
            unique_drivers = {}
            for res in last_year_results:
                if res.driver_code not in unique_drivers:
                    unique_drivers[res.driver_code] = res.driver_name
            
            for code, name in unique_drivers.items():
                driver_stats[code] = {
                    "current_points": 0, "positions": [], "name": name, 
                    "mean": 10.0, "std": 5.0, "wins": 0
                }
                active_drivers.append(code)

        # Guard: If still no active drivers (Empty DB), return generic error or mock data
        if not active_drivers:
             return {"error": "No drivers found. Please seed the database."}

        # 2. Remaining Races
        all_races = session.query(Race).filter_by(year=year).order_by(Race.date).all()
        
        # Identify completed races
        if not results:
             completed_ids = set()
        else:
             completed_ids = set(r.id for _, r in results)

        remaining_races = [r for r in all_races if r.id not in completed_ids]

        # Points System
        points_map = {1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1}

        # Guard: If still no active drivers (Empty DB), return generic error or mock data
        if not active_drivers:
             return {"error": "No drivers found. Please seed the database."}

        # 3. Trajectory Containers
        # Store cumulative points at each race step for every simulation
        # trajectories[code][race_index] = [pts_sim1, pts_sim2, ...]
        trajectories = {code: [[] for _ in range(len(remaining_races))] for code in active_drivers}
        
        # 4. Simulation Loop
        final_points_tally = {code: [] for code in active_drivers}

        for _ in range(n_sims):
            # Simulation State
            sim_points = {code: driver_stats[code]["current_points"] for code in active_drivers}
            
            for race_idx, race in enumerate(remaining_races):
                # Circuit Physics Lookup
                # Helper to map race name to code (reused logic or simple mapping)
                # We need a robust way to link Race Object to CIRCUIT_DATA
                # For now, let's use the 'id' mapping logic or string matching
                r_name = race.race_name.lower()
                c_code = "unk"
                if "bahrain" in r_name: c_code = "bhr"
                elif "saudi" in r_name: c_code = "sau"
                elif "australia" in r_name: c_code = "aus"
                elif "japan" in r_name: c_code = "jpn"
                elif "china" in r_name: c_code = "chn"
                elif "miami" in r_name: c_code = "mia"
                elif "imola" in r_name or "emilia" in r_name: c_code = "emi"
                elif "monaco" in r_name: c_code = "mon"
                elif "canada" in r_name: c_code = "can"
                elif "spain" in r_name: c_code = "esp"
                elif "austria" in r_name: c_code = "aut"
                elif "britain" in r_name: c_code = "gbr"
                elif "hungary" in r_name: c_code = "hun"
                elif "belgium" in r_name: c_code = "bel"
                elif "netherlands" in r_name: c_code = "ned"
                elif "italy" in r_name: c_code = "ita"
                elif "azerbaijan" in r_name: c_code = "azb"
                elif "singapore" in r_name: c_code = "sin"
                elif "united states" in r_name: c_code = "usa"
                elif "mexico" in r_name: c_code = "mex"
                elif "brazil" in r_name: c_code = "bra"
                elif "vegas" in r_name: c_code = "lvg"
                elif "qatar" in r_name: c_code = "qat"
                elif "abu dhabi" in r_name: c_code = "abu"

                circuit_phys = CIRCUIT_DATA.get(c_code, {"overtake_delta": 1.0})
                overtake_mod = circuit_phys.get("overtake_delta", 1.0) # 0.5 (Monaco) to 2.0 (Spa)

                # Generate positions
                race_positions = []
                for code in active_drivers:
                    # Reliability Check (DNF)
                    if np.random.random() > reliability:
                        # DNF!
                        race_positions.append((code, 999)) # Last place effectively
                        continue

                    mean = driver_stats[code]["mean"]
                    if code in driver_mods:
                        mean -= driver_mods[code]

                    # Standard Deviation modulated by Chaos AND Circuit Physics
                    # Low overtake delta = Less variance (hard to pass, stick to mean)
                    # High overtake delta = More variance
                    std = driver_stats[code]["std"] * chaos_factor * overtake_mod
                    
                    pred_pos = np.random.normal(mean, std)
                    race_positions.append((code, pred_pos))
                
                # Sort and Award Points
                race_positions.sort(key=lambda x: x[1])
                for i, (code, raw_pos) in enumerate(race_positions):
                    if raw_pos == 999: continue # DNF gets 0

                    pos = i + 1
                    pts = points_map.get(pos, 0)
                    sim_points[code] += pts
                
                # Record Trajectory Step
                for code in active_drivers:
                    trajectories[code][race_idx].append(sim_points[code])
            
            # Winner Tally (End of Season)
            winner = max(sim_points, key=sim_points.get)
            driver_stats[winner]["wins"] += 1
            
            for code in active_drivers:
                final_points_tally[code].append(sim_points[code])

        # 5. Result Formatting
        # Process Trajectories into Percentiles
        trajectory_data = {}
        race_labels = [r.race_name.replace(" Grand Prix", "") for r in remaining_races]
        
        # Limit payload: Only top 5 drivers or user requested
        top_drivers_by_wins = sorted(active_drivers, key=lambda c: driver_stats[c]["wins"], reverse=True)[:5]

        for code in top_drivers_by_wins:
            driver_traj = []
            # Start point (Current Points)
            curr = driver_stats[code]["current_points"]
            driver_traj.append({"race": "Current", "p10": curr, "p50": curr, "p90": curr})

            for i, race_name in enumerate(race_labels):
                step_points = trajectories[code][i] # list of n_sims points
                # Calculate percentiles
                p10 = np.percentile(step_points, 10)
                p50 = np.percentile(step_points, 50)
                p90 = np.percentile(step_points, 90)
                
                driver_traj.append({
                    "race": race_name[:3].upper(), # Short name
                    "p10": int(p10),
                    "p50": int(p50),
                    "p90": int(p90)
                })
            trajectory_data[code] = driver_traj

        probabilities = []
        for code in active_drivers:
            wins = driver_stats[code]["wins"]
            prob = (wins / n_sims) * 100
            if prob > 0.1:
                probabilities.append({
                    "code": code,
                    "name": driver_stats[code]["name"],
                    "probability": round(prob, 1),
                    "sim_wins": wins
                })
        
        probabilities.sort(key=lambda x: x["probability"], reverse=True)
        
        return {
            "simulations": n_sims, 
            "results": probabilities,
            "trajectories": trajectory_data
        }

    except Exception as e:
        import traceback
        with open("backend_error.txt", "w") as f:
            f.write(traceback.format_exc())
        print(f"Monte Carlo Error: {e}")
        return {"error": str(e)}
    finally:
        session.close()

# Circuit DNA: Specific characteristics for each track
CIRCUIT_DATA = {
    "bhr": {"pit_loss": 23.0, "deg_factor": 1.3, "overtake_delta": 1.0, "laps": 57},
    "sau": {"pit_loss": 20.0, "deg_factor": 0.9, "overtake_delta": 0.8, "laps": 50},
    "aus": {"pit_loss": 21.0, "deg_factor": 1.1, "overtake_delta": 1.2, "laps": 58},
    "jpn": {"pit_loss": 22.5, "deg_factor": 1.4, "overtake_delta": 1.5, "laps": 53}, 
    "chn": {"pit_loss": 24.0, "deg_factor": 1.2, "overtake_delta": 1.1, "laps": 56},
    "mia": {"pit_loss": 20.5, "deg_factor": 0.8, "overtake_delta": 0.9, "laps": 57},
    "emi": {"pit_loss": 25.0, "deg_factor": 1.0, "overtake_delta": 1.8, "laps": 63}, 
    "mon": {"pit_loss": 28.0, "deg_factor": 0.5, "overtake_delta": 2.5, "laps": 78}, 
    "can": {"pit_loss": 18.0, "deg_factor": 0.9, "overtake_delta": 0.6, "laps": 70}, 
    "esp": {"pit_loss": 22.0, "deg_factor": 1.3, "overtake_delta": 1.4, "laps": 66},
    "aut": {"pit_loss": 20.0, "deg_factor": 1.1, "overtake_delta": 0.7, "laps": 71},
    "gbr": {"pit_loss": 21.5, "deg_factor": 1.3, "overtake_delta": 0.8, "laps": 52},
    "hun": {"pit_loss": 23.0, "deg_factor": 1.1, "overtake_delta": 2.0, "laps": 70},
    "bel": {"pit_loss": 19.5, "deg_factor": 1.2, "overtake_delta": 0.4, "laps": 44},
    "ned": {"pit_loss": 21.0, "deg_factor": 1.2, "overtake_delta": 1.9, "laps": 72},
    "ita": {"pit_loss": 24.0, "deg_factor": 1.1, "overtake_delta": 0.5, "laps": 53},
    "azb": {"pit_loss": 21.0, "deg_factor": 1.0, "overtake_delta": 0.6, "laps": 51},
    "sin": {"pit_loss": 27.0, "deg_factor": 0.9, "overtake_delta": 2.2, "laps": 62},
    "usa": {"pit_loss": 21.5, "deg_factor": 1.2, "overtake_delta": 0.9, "laps": 56},
    "mex": {"pit_loss": 22.0, "deg_factor": 0.8, "overtake_delta": 1.2, "laps": 71},
    "bra": {"pit_loss": 20.5, "deg_factor": 1.1, "overtake_delta": 0.7, "laps": 71},
    "lvg": {"pit_loss": 20.0, "deg_factor": 0.7, "overtake_delta": 0.5, "laps": 50},
    "qat": {"pit_loss": 23.5, "deg_factor": 1.5, "overtake_delta": 1.0, "laps": 57}, 
    "abu": {"pit_loss": 22.0, "deg_factor": 1.1, "overtake_delta": 1.3, "laps": 58},
}

def generate_strategies(total_laps, compounds):
    """
    Recursively generate valid pit strategies (1-stop and 2-stop).
    Limit to logical permutations to avoid combinatorial explosion.
    """
    valid_strats = []
    
    # 1-STOP PERMUTATIONS
    # Try all valid 2-compound combos
    for c1_name, c1 in compounds.items():
        for c2_name, c2 in compounds.items():
            if c1_name == c2_name and c1_name == "Soft": continue # Soft-Soft usually invalid for race distance
            if c1_name == c2_name: continue # Force mandatory compound change rule (simplified: must use different types implies using 2 sets)
            
            # Simple even split or optimized split? 
            # Let's try an optimized "sweet spot" split based on tyre life ratio
            total_life_potential = c1["life"] + c2["life"]
            if total_life_potential >= total_laps * 0.9: # Feasible
                # Bias stint length by compound durability
                stint1_len = int(total_laps * (c1["life"] / total_life_potential))
                # Clamp stint 1
                stint1_len = max(5, min(stint1_len, int(c1["life"] * 1.3))) 
                stint2_len = total_laps - stint1_len
                
                # Check soft clip
                if c1_name == "Soft" and stint1_len > 25: stint1_len = 25; stint2_len = total_laps - 25
                if c2_name == "Soft" and stint2_len > 25: stint1_len = total_laps - 25; stint2_len = 25
                
                valid_strats.append({
                    "name": f"1-Stop ({c1_name[0]}-{c2_name[0]})",
                    "stints": [(c1_name, stint1_len), (c2_name, stint2_len)]
                })

    # 2-STOP PERMUTATIONS
    # Fixed templates for 2-stops are often better generators than pure random
    # S-M-M, S-M-H, M-H-M
    templates = [
        ["Soft", "Medium", "Medium"],
        ["Soft", "Medium", "Hard"],
        ["Medium", "Hard", "Medium"],
        ["Soft", "Hard", "Soft"], # Aggressive
        ["Medium", "Hard", "Hard"],
    ]
    
    for t in templates:
        # Divide laps roughly evenly
        base = total_laps // 3
        rem = total_laps % 3
        s1, s2, s3 = base, base, base
        if rem == 1: s3 += 1
        if rem == 2: s2 += 1; s3 += 1
        
        # Bias: Soft stints shorter
        if t[0] == "Soft": s1 -= 4; s2 += 2; s3 += 2
        
        valid_strats.append({
            "name": f"2-Stop ({t[0][0]}-{t[1][0]}-{t[2][0]})",
            "stints": [(t[0], s1), (t[1], s2), (t[2], s3)]
        })

    return valid_strats

def simulate_race_strategy(race_id='abu', race_laps=58, traffic=False, deg_multiplier=1.0, safety_car_laps=[], grid_pos=1, weather='Dry', objective='Minimise Time'):
    import numpy as np
    
    # LOAD CIRCUIT DNA
    circuit = CIRCUIT_DATA.get(race_id, CIRCUIT_DATA['abu'])
    
    # 1. Start Pos Influence on Traffic
    # If Start Pos > 8, auto-injection of traffic (unless overridden by traffic toggle)
    start_traffic_prob = 0.0
    if grid_pos > 8 and not traffic:
        start_traffic_prob = 0.15 + ((grid_pos - 8) * 0.02) # Increases with lower start
    
    # 2. Weather Influence
    # If Rain, lap times massive, S/M/H become invalid (simplified: just use wet modifier on pace/deg)
    weather_mult = 1.0
    if weather == 'Rain':
        weather_mult = 1.15
        deg_multiplier *= 0.8 # Wet tyres wear differently (simplified)
    
    # Physics Constants
    base_lap_time = 90.0 * weather_mult
    fuel_effect = 0.06
    pit_loss_normal = circuit["pit_loss"] * (1.1 if weather == 'Rain' else 1.0) # Slower stops in rain
    pit_loss_sc = pit_loss_normal * 0.55
    traffic_penalty = 0.5 * circuit["overtake_delta"]
    
    # Tyre Model
    df = circuit["deg_factor"] * deg_multiplier
    compounds = {
        "Soft":   {"delta": -1.2, "deg": 0.12 * df, "life": 18 / df, "color": "#FF3333"},
        "Medium": {"delta": -0.5, "deg": 0.06 * df, "life": 28 / df, "color": "#FFF200"},
        "Hard":   {"delta": 0.0,  "deg": 0.03 * df, "life": 45 / df, "color": "#FFFFFF"}
    }

    # GENERATE DYNAMIC STRATEGIES
    strategies = generate_strategies(race_laps, compounds)

    results = []
    
    for strat in strategies:
        lap_times = []
        total_time = 0
        current_lap_global = 1
        pit_stops = []
        
        time_lost_deg = 0
        time_lost_pits = 0

        for stint_idx, (compound_name, laps) in enumerate(strat["stints"]):
            c_data = compounds[compound_name]
            
            for lap_in_stint in range(1, laps + 1):
                # ... [Physics Logic Same as Before] ...
                tyre_age = lap_in_stint
                deg_curve = 1 + (0.5 * (tyre_age / c_data["life"])**4) 
                current_deg = (tyre_age * c_data["deg"]) * deg_curve
                
                fuel_gain = current_lap_global * fuel_effect
                raw_time = base_lap_time + c_data["delta"] + current_deg - fuel_gain
                
                # Dynamic Traffic Logic
                current_traffic = 0
                # Use explicit traffic toggle OR implicit grid_pos traffic
                t_prob = 0.25 if traffic else start_traffic_prob
                if 5 < current_lap_global < (race_laps - 5):
                     if np.random.random() < t_prob:
                         current_traffic = traffic_penalty
                
                final_time = raw_time + current_traffic
                time_lost_deg += current_deg

                # Pit Stop Logic
                is_pit_lap = False
                if lap_in_stint == laps and stint_idx < len(strat["stints"]) - 1:
                    current_pit_loss = pit_loss_normal
                    if safety_car_laps and any(abs(current_lap_global - sc) <= 1 for sc in safety_car_laps):
                        current_pit_loss = pit_loss_sc
                    
                    final_time += current_pit_loss
                    time_lost_pits += current_pit_loss
                    is_pit_lap = True
                    pit_stops.append(current_lap_global)

                lap_times.append({
                    "lap": current_lap_global,
                    "time": round(final_time, 3),
                    "compound": compound_name,
                    "pit_stop": is_pit_lap
                })
                
                total_time += final_time
                current_lap_global += 1
        
        # 3. Strategy Analysis Score (Objective Handling)
        metric_score = total_time
        if objective == 'Track Position':
            # Penalize every stop heavily to bias towards 1-stops
            metric_score += (len(pit_stops) * 15.0) 

        results.append({
            "name": strat["name"],
            "total_time": round(total_time, 2),
            "metric_score": round(metric_score, 2), # Internal sorting metric
            "lap_data": lap_times,
            "pit_stops": pit_stops,
            "color": "#3671C6" if "1-Stop" in strat["name"] else "#E8002D", 
            "analysis": {
                "deg_loss": round(time_lost_deg, 2),
                "pit_loss": round(time_lost_pits, 2)
            }
        })

    # FILTER & RANK using METRIC SCORE (Objective)
    sorted_res = sorted(results, key=lambda x: x["metric_score"])
    top_strategies = sorted_res[:3]

    winner = top_strategies[0]
    runner_up = top_strategies[1]
    
    # Verdict Logic ...
    net_delta = round(runner_up["total_time"] - winner["total_time"], 2)
    pit_gain = runner_up["analysis"]["pit_loss"] - winner["analysis"]["pit_loss"]
    pace_diff = winner["analysis"]["deg_loss"] - runner_up["analysis"]["deg_loss"] 
    
    reason = ""
    if objective == 'Track Position' and len(winner["pit_stops"]) < len(runner_up["pit_stops"]):
         reason = "Prioritizes track position with fewer stops, despite slower raw pace."
    elif pit_gain > 5.0:
        reason = f"Avoids extra pit stop (saves {round(pit_gain,1)}s), outweighing tyre wear."
    elif pit_gain < -5.0:
        reason = f"Fresh tyres provide {round(abs(pace_diff),1)}s pace advantage, overcoming pit loss."
    else:
        reason = f"Better compound suitability for {circuit.get('deg_factor', 1.0) * deg_multiplier:.1f}x degradation."

    verdict = {
        "recommended": winner["name"],
        "delta": net_delta,
        "reason": reason,
        "risk": "High" if deg_multiplier > 1.2 or safety_car_laps or grid_pos > 15 else "Medium",
        "breakdown": {
            "pit_gain": round(pit_gain, 2),
            "pace_loss": round(pace_diff, 2)
        }
    }
    
    for r in top_strategies:
        r["is_best"] = r["name"] == winner["name"]
        r["delta_to_best"] = round(r["total_time"] - winner["total_time"], 2)

    return {
        "strategies": top_strategies,
        "verdict": verdict,
        "pit_breakdown": {"entry": 3.5, "stationary": 2.5, "exit": pit_loss_normal - 6.0}
    }
