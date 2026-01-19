from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
import pandas as pd
from datetime import datetime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from dotenv import load_dotenv

load_dotenv()

Base = declarative_base()


# --- Models ---
class Race(Base):
    __tablename__ = 'races'
    id = Column(Integer, primary_key=True)
    year = Column(Integer, index=True)
    round = Column(Integer)
    circuit_name = Column(String)
    race_name = Column(String)
    date = Column(DateTime) # Race Date (Sunday)
    # Weekend Timeline Sessions
    fp1_date = Column(DateTime)
    fp2_date = Column(DateTime)
    fp3_date = Column(DateTime)
    qualifying_date = Column(DateTime)
    sprint_date = Column(DateTime)
    sprint_qualifying_date = Column(DateTime) # For new Sprint formats if needed
    
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
    sector1_time = Column(Float)
    sector2_time = Column(Float)
    sector3_time = Column(Float)
    stint = Column(Integer)
    race = relationship("Race", back_populates="laps")

class Circuit(Base):
    __tablename__ = 'circuits'
    id = Column(Integer, primary_key=True)
    race_id = Column(Integer, ForeignKey('races.id'))
    x_json = Column(String) # JSON Array of X coordinates
    y_json = Column(String) # JSON Array of Y coordinates
    distance_json = Column(String) # JSON Array of Distance values
    corners_json = Column(String) # JSON Array of Corner Data {number, distance, angle, x, y}
    marshal_sectors_json = Column(String) # JSON Array of Marshal Sector positions
    marshal_lights_json = Column(String) # JSON Array of Marshal Light positions
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
    time_json = Column(String) # NEW for analysis delta
    race = relationship("Race", back_populates="telemetry_data")

class RaceStatus(Base):
    __tablename__ = 'race_status'
    id = Column(Integer, primary_key=True)
    race_id = Column(Integer, ForeignKey('races.id'))
    time = Column(Float)
    status = Column(String)
    weather = Column(String)
    category = Column(String) # 'FLAG' or 'MESSAGE'


# DB Connection
# STRICT: AWS RDS Only - No fallback to local sqlite unless explicitly intended for dev but user requested AWS usage.
# We will raise error if DATABASE_URL is not set to ensure we don't accidentally use proper sqlite.
DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    # Fail hard if no DB configured, or default to a dummy that fails connection if you prefer, 
    # but printing warning is safer for now if they forget env var.
    print("WARNING: DATABASE_URL not set. Service will likely fail.")
    DB_URL = "sqlite:///:memory:" # Fail-safe to avoid writing to disk if config missing

def get_db_engine():
    return create_engine(DB_URL, pool_pre_ping=True)

def get_db_session():
    engine = get_db_engine()
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
            "sessions": {
                "fp1": race.fp1_date.isoformat() if race.fp1_date else None,
                "fp2": race.fp2_date.isoformat() if race.fp2_date else None,
                "fp3": race.fp3_date.isoformat() if race.fp3_date else None,
                "qualifying": race.qualifying_date.isoformat() if race.qualifying_date else None,
                "sprint": race.sprint_date.isoformat() if race.sprint_date else None,
                "sprintQuali": race.sprint_qualifying_date.isoformat() if race.sprint_qualifying_date else None,
            },
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
        # 1. Try to find the latest race that HAS results
        latest_race = session.query(Race).join(Result).order_by(Race.date.desc()).first()
        
        # 2. If no race with results (e.g. start of season), find the NEXT upcoming race
        if not latest_race:
            latest_race = session.query(Race).filter(Race.date >= datetime.utcnow()).order_by(Race.date.asc()).first()
            
        if not latest_race:
            # Fallback for completely empty DB or end of time
            return None
            
        return get_race_results_by_id(latest_race.id)
    except Exception as e:
        print(f"Error fetching latest results: {e}")
        return None
    finally:
        session.close()



def get_active_drivers(year=2025):
    """
    Returns a list of active drivers for the season with their team and inferred stats.
    """
    session = get_db_session()
    try:
        # Get all results for the year to find active drivers
        # We use results to ensure they actually raced or are entered
        results = session.query(Result).join(Race).filter(Race.year == year).all()
        
        # If no results (start of season), try previous year for initial roster?
        # Or just return empty if it's truly empty.
        if not results:
             # Fallback to previous year if current year has no data yet (common in pre-season)
             results = session.query(Result).join(Race).filter(Race.year == year - 1).all()

        drivers = {}
        
        for r in results:
            if r.driver_code not in drivers and r.driver_code:
                # Basic Stats Mockup -> In future, calculate real probability based on points
                drivers[r.driver_code] = {
                    "code": r.driver_code,
                    "name": r.driver_name,
                    "team": r.team_name,
                    "color": TEAM_COLORS.get(r.team_name, "#333333"),
                    "probability": 0, # Placeholder
                    "dnfRisk": 10 # Placeholder default
                }
        
        return list(drivers.values())

    except Exception as e:
        print(f"Active Drivers Error: {e}")
        return []
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
            if "madrid" in n: return "mad"
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
            if "miami" in n: return "mia"
            if "las vegas" in n or "vegas" in n: return "lvg"
            if "mexico" in n or "mexican" in n: return "mex"
            if "madrid" in n: return "mad" # New for 2026
            if "brazil" in n or "são paulo" in n or "sao paulo" in n or "interlagos" in n: return "bra"
            if "vegas" in n: return "lvg"
            if "qatar" in n or "lusail" in n: return "qat"
            if "abu dhabi" in n or "yas marina" in n: return "abu"
            # Historical 2020-2022
            if "french" in n or "france" in n: return "fra"
            if "turkish" in n or "turkey" in n: return "tur"
            if "russian" in n or "russia" in n or "sochi" in n: return "rus"
            if "portuguese" in n or "portugal" in n or "algarve" in n: return "por"
            if "styrian" in n: return "sty"
            if "70th" in n: return "70a"
            if "eifel" in n: return "eif"
            if "tuscan" in n: return "tus"
            if "sakhir" in n: return "sak"
            # Fallback: Use first 3 chars + ID to ensure uniqueness
            return f"unk_{r.id}"

        result = []
        now = datetime.utcnow()

        for r in races:
            # Check circuit name first for specificity (e.g. Madrid vs Barcelona)
            name_to_check = r.circuit_name if r.circuit_name else r.race_name
            code = get_code(name_to_check)
            
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
            
            # Prediction Window Logic
            # Open: Monday before race (Race Date - 6 days) @ 00:00
            # Close: Qualifying Start Time (or 24h before race if Quali missing)
            
            # Assuming r.date is Sunday Race Time.
            # Monday Start:
            open_time = r.date - pd.Timedelta(days=6)
            open_time = open_time.replace(hour=0, minute=0, second=0)
            
            # Close Time: Qualifying
            close_time = r.qualifying_date if r.qualifying_date else (r.date - pd.Timedelta(hours=24))
            
            is_open = open_time <= now <= close_time
            
            result.append({
                "id": r.id,     # DB ID (Integer) for History/Results API
                "code": code,   # String Code ('aus') for Strategy/Simulations
                "name": r.race_name.replace(" Grand Prix", ""),
                "date": r.date.strftime("%d %b %Y"),
                "circuit": r.circuit_name,
                "round": r.round,
                "status": "Completed" if r.date < now else "Upcoming",
                "laps": laps,
                "conditions": f"{cond['weather']} • {cond['temp']} • {cond['deg']}",
                "sc_context": f"Based on {cond['sc_prob']} incident rate",
                "predictions": {
                    "is_open": is_open,
                    "open_time": open_time.isoformat(),
                    "close_time": close_time.isoformat()
                }
            })
        return result
    except Exception as e:
        print(f"Races List Error: {e}")
        return []
    finally:
        session.close()



# --- Constants ---
TEAM_COLORS = {
    "Red Bull Racing": "#3671C6", "Mercedes": "#6CD3BF", "Ferrari": "#F91536",
    "McLaren": "#F58020", "Aston Martin": "#358C75", "Alpine": "#2293D1",
    "Williams": "#37BEDD", "RB": "#6692FF", "Sauber": "#52E252", "Haas F1 Team": "#B6BABD",
    "Kick Sauber": "#52E252", "Racing Bulls": "#6692FF" # Aliases
}

def get_race_replay(race_id):
    session = get_db_session()
    try:
        # Laps
        laps = session.query(Lap).filter_by(race_id=race_id).order_by(Lap.lap_number, Lap.position).all()
        race = session.query(Race).get(race_id) # Fetch Race Object
        
        # Circuit Map
        circuit = session.query(Circuit).filter_by(race_id=race_id).first()
        map_data = None
        if circuit:
            import json
            try:
                map_data = {
                    "x": json.loads(circuit.x_json) if circuit.x_json else [],
                    "y": json.loads(circuit.y_json) if circuit.y_json else [],
                    "distance": json.loads(circuit.distance_json) if circuit.distance_json else [],
                    "corners": json.loads(circuit.corners_json) if circuit.corners_json else [],
                    "marshalSectors": json.loads(circuit.marshal_sectors_json) if circuit.marshal_sectors_json else [],
                    "marshalLights": json.loads(circuit.marshal_lights_json) if circuit.marshal_lights_json else []
                }
            except Exception as e:
                print(f"Error loading map data for race {race_id}: {e}")

        # Group by lap number
        replay_data = {}
        max_lap = 0
        
        if laps:
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
        results = session.query(Result).filter_by(race_id=race_id).all()
        
        if not results and not laps:
            return None # truly no data
            
        for r in results:
            # Try to match team color
            color = "#FFFFFF"
            for team_key, hex_val in TEAM_COLORS.items():
                if team_key in (r.team_name or ""):
                    color = hex_val
                    break
            
            driver_meta[r.driver_code] = {
                "name": r.driver_name,
                "team": r.team_name,
                "color": color,
                "grid": r.grid_position,
                "status": r.status
            }

        result = {
            "raceId": race_id,
            "totalLaps": max_lap,
            "startTime": f"{race.date.isoformat()}Z" if race.date else None,
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
                    "weather": json.loads(s.weather) if s.weather else None,
                    "category": s.category # Return category to frontend
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
    Computes deep-dive analysis using DB stored telemetry.
    """
    import numpy as np
    import json
    
    db_session = get_db_session()
    try:
        race = db_session.query(Race).filter_by(id=race_id).first()
        if not race: return {"error": "Race not found"}

        # Helper to get specific lap telemetry
        def get_lap_telemetry(driver, lap_num):
            # If lap_num is 'fastest' or None, we need logic to find it.
            # Currently our Telemetry table stores the FASTEST LAP only (from seed_full_telemetry).
            # If we want specific laps, we need to store ALL laps telemetry which is huge.
            # Assuming 'seed_full_telemetry.py' stores the generic fastest lap telemetry.
            # If the user wants specific laps, we might be limited by current DB schema unless we store all.
            # For now, we fetch the stored telemetry from the Telemetry table which represents the 'best' or 'reference' lap.
            
            # FUTURE: If we need specific lap telemetry, we must expand the Telemetry table to include lap_number
            # and seed EVERY lap (GBs of data). 
            # Current Requirement: "Stop using cache". 
            # We will use what we have in DB.
            
            t = db_session.query(Telemetry).filter_by(race_id=race_id, driver=driver).first()
            if not t: return None
            
            return {
                "distance": json.loads(t.distance_json),
                "speed": json.loads(t.speed_json),
                "throttle": json.loads(t.throttle_json),
                "brake": json.loads(t.brake_json),
                "gear": json.loads(t.gear_json) if t.gear_json else [],
                "rpm": json.loads(t.rpm_json) if t.rpm_json else [],
                "time": json.loads(t.time_json) if hasattr(t, 'time_json') and t.time_json else []
            }

        d1_tel = get_lap_telemetry(driver1, lap1_num)
        d2_tel = get_lap_telemetry(driver2, lap2_num)

        if not d1_tel or not d2_tel:
            return {"error": "Telemetry not available in DB for one or both drivers"}

        # 1. Delta Calculation (Manual Resampling)
        # We need to interpolate d2 to d1 distances
        d1_dist = np.array(d1_tel['distance'])
        d1_speed = np.array(d1_tel['speed'])
        
        d2_dist = np.array(d2_tel['distance'])
        d2_speed = np.array(d2_tel['speed'])
        
        # Interpolate D2 speed to D1 distances
        d2_speed_interp = np.interp(d1_dist, d2_dist, d2_speed)
        
        # Calculate Delta (Time)
        # Time = Distance / Speed. 
        # Integration method: dt = dx / v
        # We can approximate time at each point
        
        # Simple Speed Delta first
        speed_delta = d1_speed - d2_speed_interp
        
        # Time Delta Construction
        time_delta_vals = []
        if d1_tel.get('time') and d2_tel.get('time'):
             t1 = np.array(d1_tel['time'])
             t2 = np.array(d2_tel['time'])
             if len(t1) == len(d1_dist) and len(t2) == len(d2_dist):
                 # Interpolate t2 to d1_dist
                 t2_interp = np.interp(d1_dist, d2_dist, t2)
                 # Gap = Comp - Ref. (Positive if Ref is faster/ahead ... wait)
                 # Frontend expects: Negative value = Active Driver (D1) is Faster.
                 # If D1 is 10s, D2 is 11s. D1 is faster.
                 # Gap = D2 - D1 = 1s.
                 # We want NEGATIVE to indicate D1 is faster? 
                 # Previous code: `delta: round(-deltas[i], 4)` where deltas was from fastf1.
                 # fastf1 delta: D1 ahead -> Positive.
                 # -Positive -> Negative.
                 # So if D1 ahead, we send Negative.
                 # D2 - D1 = Positive.
                 # So we send -(D2 - D1) = D1 - D2? (= -1s).
                 # Correct.
                 time_delta_vals = t1 - t2_interp
             
        
        delta_series = []
        # Downsample
        step = 10
        for i in range(0, len(d1_dist), step):
            if i >= len(d2_speed_interp): break
            
            s1 = d1_speed[i]
            s2 = d2_speed_interp[i]
            
            d_val = 0
            if len(time_delta_vals) > i:
                 d_val = float(time_delta_vals[i])

            delta_series.append({
                "dist": round(d1_dist[i], 1),
                "delta": round(d_val, 4), 
                "speed": int(s1),
                "speed_compare": int(s2),
                "speed_delta": int(s1 - s2)
            })

        # 2. Corner Analysis
        # Fetch Circuit Corners
        circuit = db_session.query(Circuit).filter_by(race_id=race_id).first()
        corners = []
        if circuit and circuit.corners_json:
            corners_data = json.loads(circuit.corners_json)
            # Find closest points in telemetry
            for c in corners_data:
                dist = c['distance']
                # match closest index in d1
                idx = (np.abs(d1_dist - dist)).argmin()
                
                v1 = d1_speed[idx]
                v2 = d2_speed_interp[idx]
                
                # Get Gear
                d1_gear_val = "-"
                if d1_tel.get('gear') and len(d1_tel['gear']) > idx:
                     d1_gear_val = d1_tel['gear'][idx]
                
                # Get Delta at Apex
                delta_val = 0
                if len(time_delta_vals) > idx:
                    delta_val = float(time_delta_vals[idx])

                reason = "Balanced"
                if v1 > v2 + 5: reason = f"{driver1} Faster"
                elif v2 > v1 + 5: reason = f"{driver2} Faster"
                
                corners.append({
                    "number": c['number'],
                    "distance": dist,
                    "d1_min_speed": int(v1),
                    "d2_min_speed": int(v2),
                    "d1_gear": d1_gear_val,
                    "delta_at_apex": round(delta_val, 3),
                    "reason": reason
                })

        return {
            "driver1": driver1,
            "driver2": driver2,
            "delta_series": delta_series,
            "corners": corners,
            "conditions": {}, # simplified
            "color1": "#FFFFFF", 
            "color2": "#FFFFFF"
        }

    except Exception as e:
        print(f"Analysis DB Error: {e}")
        return {"error": str(e)}
    finally:
        db_session.close()

def get_race_control_messages(race_id):
    """
    Fetches Race Control Messages (Flags, SC, Penalties) for a race from DB.
    """
    db_session = get_db_session()
    try:
        msgs = db_session.query(RaceStatus).filter_by(race_id=race_id).order_by(RaceStatus.time).all()
        
        formatted_messages = []
        for m in msgs:
            # Format time
            m_sec = int(m.time)
            h = m_sec // 3600
            rem = m_sec % 3600
            mins = rem // 60
            secs = rem % 60
            time_str = f"+{h}:{mins:02d}:{secs:02d}" if h > 0 else f"+{mins}:{secs:02d}"
            
            formatted_messages.append({
                "time": time_str,
                "category": m.status,
                "message": f"{m.status} - {m.weather}" if m.weather else m.status,
                "flag": "RED" if "RED" in m.status else "YELLOW" if "YELLOW" in m.status else None
            })
            
        return {"messages": formatted_messages}

    except Exception as e:
        print(f"Error fetching race control messages: {e}")
        return {"messages": []}
    finally:
        db_session.close()

def get_driver_laps(race_id, driver_id):
    """
    Returns list of valid laps for a driver from DB.
    """
    db_session = get_db_session()
    try:
        # Query Laps table
        laps = db_session.query(Lap).filter_by(race_id=race_id, driver=driver_id).order_by(Lap.lap_number).all()
        
        result = []
        # Find fastest lap for marking
        min_time = min([l.lap_time for l in laps if l.lap_time]) if laps else 0
        
        for lap in laps:
            if not lap.lap_time: continue
            
            # Format Time helper
            def fmt(sec):
                if not sec: return "-"
                m = int(sec // 60)
                s = sec % 60
                return f"{m}:{s:06.3f}"

            result.append({
                "lap_number": lap.lap_number,
                "lap_time": fmt(lap.lap_time),
                "s1": fmt(lap.sector1_time),
                "s2": fmt(lap.sector2_time),
                "s3": fmt(lap.sector3_time),
                "compound": lap.tyre_compound,
                "stint": lap.stint if lap.stint else 0,
                "is_fastest": lap.lap_time == min_time
            })
        return result

    except Exception as e:
        print(f"Error fetching laps from DB: {e}")
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
            # Return empty structure for future/empty seasons instead of 404 error
            return {"drivers": [], "constructors": [], "races": []}

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

            # Skip Practice, Qualifying, and Entries for Standings Stats
            if stype not in ['R', 'S'] or str(r.status) == 'Entry':
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
        season_len = len(driver_list[0]["history"]) if driver_list else 0
        
        if season_len >= 2:
            prev_points_map = {}
            for d in driver_list:
                prev_points_map[d["code"]] = d["history"][-2] if len(d["history"]) >= 2 else 0
            
            sorted_prev = sorted(driver_list, key=lambda x: prev_points_map.get(x["code"], 0), reverse=True)
            for rank, d in enumerate(sorted_prev):
                d["prev_rank"] = rank + 1
            for rank, d in enumerate(driver_list):
                curr_rank = rank + 1
                prev = d.get("prev_rank", curr_rank)
                d["change"] = prev - curr_rank
        else:
            for d in driver_list: d["change"] = 0

        # --- Constructor Standings (Refactored) ---
        # Aggregate DIRECTLY from results to handle mid-season transfers correctly
        constructors = {}
        constructor_round_points = {}  # team -> {race_name -> points}

        for r, race in results:
            team = r.team_name
            if not team or team == "None": continue

            # Initialize Team Stats
            if team not in constructors:
                constructors[team] = {
                    "name": team,
                    "points": 0,
                    "wins": 0,
                    "podiums": 0,
                    "drivers": set(), # Use set to track unique drivers
                    "history": [] 
                }
            if team not in constructor_round_points:
                constructor_round_points[team] = {}
            if race.race_name not in constructor_round_points[team]:
                constructor_round_points[team][race.race_name] = 0

            # Determine Session Type
            stype = str(r.session_type).upper() if r.session_type else 'R'
            if stype not in ['R', 'S']: continue

            # Aggregate Points
            pts = r.points if r.points is not None else 0
            constructors[team]["points"] += pts
            constructor_round_points[team][race.race_name] += pts
            constructors[team]["drivers"].add(r.driver_code)

            # Aggregate Stats (Main Race Only)
            if stype == "R":
                 pos = r.position if r.position is not None else 999
                 if pos == 1: constructors[team]["wins"] += 1
                 if pos <= 3: constructors[team]["podiums"] += 1

        # Build Constructor History
        for team, c in constructors.items():
            cumulative = 0
            for race_obj in all_races:
                pts = constructor_round_points.get(team, {}).get(race_obj.race_name, 0)
                cumulative += pts
                c["history"].append(cumulative)
            # Convert driver set to list
            c["drivers"] = list(c["drivers"])

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
        
        # Calculate completed rounds (Races with valid results, excluding 'Entry')
        completed_count = 0
        # Iterate over all race IDs found in results (r_id is first element of tuple key in races_set? No, set was empty)
        # Using keys from 'results' list
        unique_race_ids = set(r.race_id for r, _ in results)
        for r_id in unique_race_ids:
            has_real_result = any(res.race_id == r_id and str(res.status) != 'Entry' for res, _ in results)
            if has_real_result:
                completed_count += 1
        
        total_completed = completed_count
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

        # NEW: Season Stats Calculation
        # NEW: Season Stats Calculation
        fastest_lap_record = None
        
        # Query Laps table for absolute fastest lap of the season
        # Ensure lap_time is valid (non-zero)
        try:
            best_lap = db_session.query(Lap, Race).join(Race).filter(
                Race.year == year, 
                Lap.lap_time > 0
            ).order_by(Lap.lap_time.asc()).first()
            
            if best_lap:
                lap, race = best_lap
                # Format time (seconds to MM:SS.ms)
                def fmt_time(s):
                    m = int(s // 60)
                    sec = s % 60
                    return f"{m}:{sec:06.3f}"
                
                fastest_lap_record = {
                    "time": fmt_time(lap.lap_time),
                    "driver": lap.driver, 
                    "circuit": race.circuit_name
                }
        except Exception as e:
            print(f"Fastest Lap Calc Error: {e}")


        return {
            "drivers": driver_list,
            "constructors": constructor_list,
            "races": race_list,
            "total_rounds": len(all_races) if len(all_races) > 0 else 24,
            "completed_rounds": total_completed,
            "consistency_leader": consistency_leader,
            "season_stats": {
                "fastest_lap": fastest_lap_record,
            }
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
    "qat": {"pit_loss": 23.5, "deg_factor": 1.5, "overtake_delta": 1.0, "laps": 57}, 
    "abu": {"pit_loss": 22.0, "deg_factor": 1.1, "overtake_delta": 1.3, "laps": 58},
    "mad": {"pit_loss": 21.0, "deg_factor": 1.0, "overtake_delta": 1.2, "laps": 55}, # Madrid (2026)
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
    
    deg_val = circuit.get('deg_factor', 1.0) * deg_multiplier
    reason = ""
    
    stops_diff = len(runner_up["pit_stops"]) - len(winner["pit_stops"])
    
    if objective == 'Track Position' and stops_diff > 0:
         reason = f"Saves {stops_diff} pit stop{'s' if stops_diff>1 else ''} to prioritize track position over raw pace ({net_delta}s slower)."
    elif stops_diff > 0: # Winner has fewer stops
         reason = f"Fewer stops strategy is faster by {net_delta}s as tire wear ({deg_val:.1f}x) allows extending stints."
    elif stops_diff < 0: # Winner has more stops
         reason = f"Aggressive strategy gains {net_delta}s; extra stop offset by {round(abs(pace_diff),1)}s pace advantage."
    else: # Same stops
         winner_compounds = "-".join([s[0][0] for s in winner["stints"]])
         reason = f"Optimal compound usage ({winner_compounds}) for {deg_val:.1f}x degradation conditions."

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


# ============================================================
# SIMULATION FUNCTIONS
# ============================================================

def get_championship_scenarios(year=2025):
    """
    Calculate who can mathematically still win the championship.
    Returns scenarios like "If VER wins next race, he clinches the title."
    """
    import random
    
    try:
        standings_data = get_season_standings(year)
        if not standings_data:
            return {"error": "Could not fetch standings"}
        
        drivers = standings_data.get("drivers", [])[:10]  # Top 10
        total_rounds = standings_data.get("total_rounds", 24)
        completed = standings_data.get("completed_rounds", 0)
        remaining_races = total_rounds - completed
        
        # Max points per race: 25 (win) + 1 (fastest lap) = 26
        # Sprint weekends add more but let's simplify
        max_pts_per_race = 26
        max_remaining_points = remaining_races * max_pts_per_race
        
        leader = drivers[0] if drivers else None
        leader_points = leader.get("points", 0) if leader else 0
        
        scenarios = []
        can_win_list = []
        
        for d in drivers:
            current_pts = d.get("points", 0)
            theoretical_max = current_pts + max_remaining_points
            can_win = theoretical_max >= leader_points
            gap_to_leader = leader_points - current_pts
            
            # Calculate "magic number" - points leader needs to clinch
            points_needed_to_clinch = max_remaining_points - gap_to_leader + 1 if gap_to_leader > 0 else 0
            
            can_win_list.append({
                "code": d.get("code"),
                "name": d.get("name"),
                "team": d.get("team"),
                "points": current_pts,
                "can_win": can_win,
                "gap": gap_to_leader,
                "theoretical_max": theoretical_max,
                "clinch_points": points_needed_to_clinch if d == leader else None
            })
        
        # Generate scenario headlines
        if remaining_races > 0 and leader:
            second = drivers[1] if len(drivers) > 1 else None
            gap_to_second = (leader.get("points", 0) - second.get("points", 0)) if second else 0
            
            if gap_to_second > max_pts_per_race:
                scenarios.append(f"🏆 {leader.get('code')} could clinch the title at the next race!")
            elif gap_to_second > 0:
                scenarios.append(f"📊 {leader.get('code')} leads by {int(gap_to_second)} pts. {second.get('code')} must outscore to stay in contention.")
            
            # Dramatic scenarios
            if remaining_races <= 3:
                scenarios.append(f"⚡ Only {remaining_races} races left! {max_remaining_points} points still available.")
        
        # Next race info
        next_race = None
        races_data = get_races_list(year)
        if races_data and len(races_data) > completed:
            next_race_data = races_data[completed] if completed < len(races_data) else None
            if next_race_data:
                next_race = {
                    "name": next_race_data.get("name"),
                    "code": next_race_data.get("code"),
                    "date": next_race_data.get("date"),
                    "laps": next_race_data.get("laps")
                }
        
        return {
            "standings": can_win_list,
            "scenarios": scenarios,
            "remaining_races": remaining_races,
            "max_points_available": max_remaining_points,
            "next_race": next_race,
            "leader": leader.get("code") if leader else None
        }
        
    except Exception as e:
        return {"error": str(e)}


def run_race_monte_carlo(race_code, num_simulations=1000, chaos_factor=1.0, prediction_year=None, lookback_years=2):
    """
    Monte Carlo simulation for race predictions.
    
    Args:
        race_code: Circuit code (e.g. "MON", "SPA")
        num_simulations: Number of simulations to run
        chaos_factor: Variance multiplier (1.0 = normal, 3.0 = chaotic)
        prediction_year: Year to predict for (default: current year + 1)
        lookback_years: Number of historical years to use (default: 2)
    
    Features:
        - Circuit-specific historical performance
        - Dynamic year weights (more recent = higher weight)
        - Fallback to global stats when circuit data is sparse
    """
    import random
    from datetime import datetime
    
    try:
        session = get_db_session()
        
        # ============================================================
        # 0. CONFIGURATION - Dynamic year handling
        # ============================================================
        
        if prediction_year is None:
            prediction_year = datetime.now().year + 1
        
        # Calculate historical years and their weights
        # More recent years get higher weight
        historical_years = [prediction_year - i for i in range(1, lookback_years + 1)]
        weight_sum = sum(range(1, lookback_years + 1))
        year_weights = {y: (lookback_years - i) / weight_sum 
                       for i, y in enumerate(historical_years)}
        
        # Most recent year for standings
        standings_year = prediction_year - 1
        
        # Strength calculation weights (configurable)
        STRENGTH_CONFIG = {
            "win_rate_weight": 0.35,
            "circuit_weight": 0.25,
            "points_weight": 0.20,
            "form_weight": 0.20
        }
        
        # ============================================================
        # 1. GET DRIVER LIST
        # ============================================================
        
        # Check season_entries.json first (for 2026+ support)
        import json
        import os
        drivers = []
        season_file = os.path.join(os.path.dirname(__file__), '..', 'data', 'season_entries.json')
        if os.path.exists(season_file):
            try:
                with open(season_file, 'r') as f:
                    entries = json.load(f)
                    if str(prediction_year) in entries:
                        drivers = entries[str(prediction_year)]
                        # Add mock points/podiums to match structure if needed
                        for d in drivers:
                            if "points" not in d: d["points"] = 0
            except Exception as e:
                print(f"Error loading season entries: {e}")

        # Fallback to standings if no JSON entry
        if not drivers:
            standings_data = get_season_standings(standings_year)
            if not standings_data:
                return {"error": f"Could not fetch {standings_year} standings"}
            drivers = standings_data.get("drivers", [])[:20]
        
        # ============================================================
        # 2. ANALYZE HISTORICAL PERFORMANCE
        # ============================================================
        
        driver_stats = {}
        for d in drivers:
            code = d.get("code")
            driver_stats[code] = {
                # Global stats (all circuits)
                "global_win_rate": 0,
                "global_podium_rate": 0,
                "global_dnf_rate": 0,
                "global_races": 0,
                # Circuit-specific stats
                "circuit_win_rate": 0,
                "circuit_podium_rate": 0,
                "circuit_avg_position": 0,
                "circuit_races": 0,
                "circuit_positions": [],
                # Recent form
                "recent_positions": [],
                "recent_wins": 0
            }
        
        # Process each historical year
        for year in historical_years:
            weight = year_weights.get(year, 0.5)
            races = session.query(Race).filter(Race.year == year).all()
            
            for race in races:
                is_target_circuit = (race.circuit_code == race_code if hasattr(race, 'circuit_code') 
                                    else race_code.upper() in (race.race_name or "").upper())
                
                race_results = session.query(Result).filter(
                    Result.race_id == race.id,
                    Result.session_type == 'R'
                ).all()
                
                for res in race_results:
                    code = res.driver_code
                    if code not in driver_stats:
                        continue
                    
                    stats = driver_stats[code]
                    
                    # Global stats
                    stats["global_races"] += weight
                    if res.position == 1:
                        stats["global_win_rate"] += weight
                    if res.position and res.position <= 3:
                        stats["global_podium_rate"] += weight
                    if res.status and ("DNF" in res.status.upper() or "Retired" in res.status):
                        stats["global_dnf_rate"] += weight
                    
                    # Circuit-specific stats
                    if is_target_circuit:
                        stats["circuit_races"] += weight
                        if res.position == 1:
                            stats["circuit_win_rate"] += weight
                        if res.position and res.position <= 3:
                            stats["circuit_podium_rate"] += weight
                        if res.position:
                            stats["circuit_positions"].append(res.position)
                    
                    # Recent form (most recent year only)
                    if year == standings_year and res.position:
                        stats["recent_positions"].append(res.position)
                        if res.position == 1:
                            stats["recent_wins"] += 1
        
        session.close()
        
        # ============================================================
        # 3. CALCULATE DRIVER STRENGTH (WITH CIRCUIT BONUS)
        # ============================================================
        
        driver_strength = {}
        circuit_data_available = {}
        total_strength = 0
        
        for d in drivers:
            code = d.get("code")
            stats = driver_stats.get(code, {})
            
            # Global win rate
            global_races = max(stats.get("global_races", 1), 0.1)
            global_win_rate = stats.get("global_win_rate", 0) / global_races
            
            # Circuit-specific performance
            circuit_races = stats.get("circuit_races", 0)
            has_circuit_data = circuit_races >= 1
            circuit_data_available[code] = has_circuit_data
            
            if has_circuit_data:
                circuit_positions = stats.get("circuit_positions", [])
                circuit_avg = sum(circuit_positions) / len(circuit_positions) if circuit_positions else 10
                circuit_score = max(0, (11 - circuit_avg) / 10)
            else:
                circuit_score = 0.5  # Neutral for unknown
            
            # Points share
            total_points = sum(x.get("points", 1) for x in drivers) or 1
            points_share = d.get("points", 0) / total_points
            
            # Recent form
            recent = stats.get("recent_positions", [])[-5:]
            avg_pos = sum(recent) / len(recent) if recent else 10
            form_score = max(0, (11 - avg_pos) / 10)
            
            # Combined strength with configurable weights
            cfg = STRENGTH_CONFIG
            if has_circuit_data:
                strength = (global_win_rate * cfg["win_rate_weight"] +
                           circuit_score * cfg["circuit_weight"] +
                           points_share * cfg["points_weight"] +
                           form_score * cfg["form_weight"])
            else:
                # No circuit data: redistribute circuit weight to other factors
                adjusted_win = cfg["win_rate_weight"] + cfg["circuit_weight"] * 0.5
                adjusted_points = cfg["points_weight"] + cfg["circuit_weight"] * 0.25
                adjusted_form = cfg["form_weight"] + cfg["circuit_weight"] * 0.25
                strength = (global_win_rate * adjusted_win +
                           points_share * adjusted_points +
                           form_score * adjusted_form)
            
            driver_strength[code] = strength
            total_strength += strength
        
        # Normalize
        if total_strength > 0:
            for code in driver_strength:
                driver_strength[code] /= total_strength
        
        # ============================================================
        # 4. CALCULATE RELIABILITY (DNF RATES)
        # ============================================================
        
        driver_dnf_rates = {}
        for d in drivers:
            code = d.get("code")
            stats = driver_stats.get(code, {})
            global_races = max(stats.get("global_races", 1), 0.1)
            base_dnf = stats.get("global_dnf_rate", 0) / global_races
            driver_dnf_rates[code] = min(base_dnf * chaos_factor, 0.5)
        
        # ============================================================
        # 5. RUN MONTE CARLO SIMULATIONS
        # ============================================================
        
        results = {d.get("code"): {"wins": 0, "podiums": 0, "points": 0} for d in drivers}
        
        for _ in range(num_simulations):
            race_results = []
            
            for d in drivers:
                code = d.get("code")
                dnf_rate = driver_dnf_rates.get(code, 0.05)
                
                if random.random() < dnf_rate:
                    race_results.append({"code": code, "pos": 99, "dnf": True})
                    continue
                
                base = driver_strength.get(code, 0.05)
                performance = base + random.gauss(0, 0.12 * chaos_factor)
                race_results.append({"code": code, "pos": 0, "perf": performance, "dnf": False})
            
            finishers = sorted(
                [r for r in race_results if not r["dnf"]],
                key=lambda x: x.get("perf", 0),
                reverse=True
            )
            
            pts_map = {1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1}
            for i, r in enumerate(finishers):
                pos = i + 1
                pts = pts_map.get(pos, 0)
                results[r["code"]]["points"] += pts
                if pos == 1:
                    results[r["code"]]["wins"] += 1
                if pos <= 3:
                    results[r["code"]]["podiums"] += 1
        
        # ============================================================
        # 6. COMPILE OUTPUT
        # ============================================================
        
        output = []
        for d in drivers:
            code = d.get("code")
            sim_stats = results.get(code, {})
            hist_stats = driver_stats.get(code, {})
            
            output.append({
                "code": code,
                "name": d.get("name"),
                "team": d.get("team"),
                "win_probability": round(sim_stats.get("wins", 0) / num_simulations * 100, 1),
                "podium_probability": round(sim_stats.get("podiums", 0) / num_simulations * 100, 1),
                "avg_points": round(sim_stats.get("points", 0) / num_simulations, 1),
                "recent_wins": hist_stats.get("recent_wins", 0),
                "circuit_races": round(hist_stats.get("circuit_races", 0)),
                "has_circuit_data": circuit_data_available.get(code, False),
                "reliability": round((1 - driver_dnf_rates.get(code, 0.05)) * 100, 0)
            })
        
        output.sort(key=lambda x: x.get("win_probability", 0), reverse=True)
        
        # Count races with circuit data
        total_circuit_races = sum(1 for code in circuit_data_available if circuit_data_available[code])
        
        return {
            "race": race_code,
            "simulations": num_simulations,
            "chaos_factor": chaos_factor,
            "prediction_year": prediction_year,
            "historical_years": historical_years,
            "year_weights": {str(k): round(v, 2) for k, v in year_weights.items()},
            "results": output[:10],
            "avg_dnf_rate": round(sum(driver_dnf_rates.values()) / max(len(driver_dnf_rates), 1) * 100, 1),
            "drivers_with_circuit_data": total_circuit_races,
            "data_source": f"Historical data from {', '.join(map(str, historical_years))}"
        }
        
    except Exception as e:
        return {"error": str(e)}


def get_dashboard_data(year=2026):
    """
    Returns data for the dashboard hero section.
    Determines if we should show 'Latest Results' or 'Next Race' based on date.
    - If a race finished within the last 3 days: Show Results.
    - Otherwise: Show Next Race.
    """
    session = get_db_session()
    try:
        current_time = datetime.utcnow()
        
        # 1. Check for Completed Races in the last 3 days
        # Get latest result
        latest_race_q = session.query(Race).join(Result).filter(Race.year == year).order_by(Race.date.desc()).first()
        
        mode = "NEXT_RACE" # Default
        target_race_id = None
        
        if latest_race_q:
            # Check time since race
            delta = current_time - latest_race_q.date
            if 0 <= delta.days <= 3:
                mode = "LATEST_RESULTS"
                target_race_id = latest_race_q.id

        # 2. Find Next Race
        # If not showing results, find the next upcoming race
        if mode == "NEXT_RACE":
            next_race = session.query(Race).filter(Race.year == year, Race.date >= current_time).order_by(Race.date.asc()).first()
            
            # If no race left, fallback to latest result (End of Season)
            if not next_race:
                if latest_race_q:
                    mode = "LATEST_RESULTS"
                    target_race_id = latest_race_q.id
                else:
                    return None # No data at all?
            else:
                target_race_id = next_race.id
                
        # 3. Fetch Data for Target Race
        race = session.query(Race).get(target_race_id)
        if not race: return None

        # Build payload
        payload = {
            "mode": mode,
            "raceId": race.id,
            "raceName": race.race_name,
            "circuit": race.circuit_name,
            "date": race.date.isoformat(),
            "round": race.round,
            "sessions": {
                "fp1": race.fp1_date.isoformat() if race.fp1_date else None,
                "fp2": race.fp2_date.isoformat() if race.fp2_date else None,
                "fp3": race.fp3_date.isoformat() if race.fp3_date else None,
                "qualifying": race.qualifying_date.isoformat() if race.qualifying_date else None,
                "sprint": race.sprint_date.isoformat() if race.sprint_date else None,
            },
            # NEW: Circuit Intel + Strategy HQ Data
            "circuit_stats": {
                "length": "5.278 km", # Placeholder - ideally fetch from Circuit model
                "laps": 58,
                "distance": "306.124 km",
                "record": {"time": "1:20.260", "driver": "LEC", "year": "2022"}
            },
            "strategy_hq": {
                "tyres": ["C3", "C4", "C5"], # Softest range
                "pit_loss": 20.5,
                "weather": {"temp": 24, "rain_prob": 10, "condition": "Sunny"}
            },
            # If results mode, include top 3 + winner
            "results": None
        }

        # Always fetch results if available (even for Next Race if Q happened?)
        # Logic: If LATEST_RESULTS, we definitely have them.
        # If NEXT_RACE, we might have Qualifying but not Race.
        # Let's try to fetch what exists for this race_id.
        
        # 1. Qualifying Results
        q_results = session.query(Result).filter(Result.race_id == race.id, Result.session_type == 'Q').order_by(Result.position).all()
        q_list = [{
            "pos": r.position,
            "driver": r.driver_code,
            "team": r.team_name,
            "time": r.time_str
        } for r in q_results]

        # 2. Race Results
        # Filter out 'Entry' placeholders (position 0) so we correctly show "Upcoming" state
        r_results = session.query(Result).filter(
            Result.race_id == race.id, 
            Result.session_type == 'R',
            Result.position > 0  # Only actual classified results
        ).order_by(Result.position).all()
        
        r_list = [{
            "pos": r.position,
            "driver": r.driver_code,
            "team": r.team_name,
            "time": r.time_str,
            "pts": r.points
        } for r in r_results]

        # 3. Constructor Results (Event Specific)
        team_points = {}
        for r in r_results:
            t = r.team_name
            if t not in team_points: team_points[t] = 0
            team_points[t] += (r.points or 0)
        
        c_list = [{"team": t, "pts": p} for t, p in team_points.items()]
        c_list.sort(key=lambda x: x['pts'], reverse=True)

        payload["results"] = {
            "Q": q_list,
            "R": r_list,
            "C": c_list
        }

        # If we are in results mode, set the winner info for Hero
        if mode == "LATEST_RESULTS" and r_results:
             winner = r_results[0]
             payload["winner"] = winner.driver_name
             payload["winnerTeam"] = winner.team_name

        return payload

    except Exception as e:
        print(f"Dashboard Error: {e}")
        return {"error": str(e)}
    finally:
        session.close()



