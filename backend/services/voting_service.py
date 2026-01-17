
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import json
import os
from dotenv import load_dotenv

load_dotenv()

Base = declarative_base()

class Prediction(Base):
    __tablename__ = 'predictions'
    id = Column(Integer, primary_key=True)
    race_id = Column(String) # "2025_1", "2025_monaco", etc.
    client_id = Column(String) # UUID
    category = Column(String) # "podium", "winner", "h2h"
    value = Column(Text) # JSON string
    timestamp = Column(DateTime, default=datetime.utcnow)

# dedicated DB for votes to separate from ETL data
# dedicated DB for votes to separate from ETL data
# In production, we use the same DATABASE_URL for simplicity (Postgres schema or tables)
DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    print("WARNING: DATABASE_URL not set for Voting Service.")
    DB_URL = "sqlite:///:memory:" # Fallback to memory to prevent disk writes, or fail.

if "sqlite" in str(DB_URL):
    engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DB_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)

def submit_vote(race_id, client_id, category, value):
    session = SessionLocal()
    try:
        # Check if vote exists (Upsert logic)
        existing = session.query(Prediction).filter_by(
            race_id=str(race_id), 
            client_id=client_id, 
            category=category
        ).first()

        json_val = json.dumps(value)

        if existing:
            existing.value = json_val
            existing.timestamp = datetime.utcnow()
        else:
            vote = Prediction(
                race_id=str(race_id),
                client_id=client_id,
                category=category,
                value=json_val
            )
            session.add(vote)
        
        session.commit()
        return {"status": "success"}
    except Exception as e:
        session.rollback()
        return {"error": str(e)}
    finally:
        session.close()


def get_vote_stats(race_id):
    session = SessionLocal()
    try:
        votes = session.query(Prediction).filter_by(race_id=str(race_id)).all()
        
        stats = {
            "total_votes": len(votes),
            "podium": {1: {}, 2: {}, 3: {}}, # {pos: {driver: count}}
            "winningGap": {}, # {gap: count}
            "dnfPredictions": {}, # {driver: count}
            "safetyCar": {"yes": 0, "no": 0, "avg_count": 0},
            "pitStrategy": {"avg_stops": 0, "tyres": {}} # {stint_idx: {tyre: count}}
        }
        
        if not votes:
            return stats

        sc_counts = []
        stops_counts = []

        for v in votes:
            try:
                # Value is stored as JSON string
                val = json.loads(v.value)
                
                # Check format version. New payload has 'podium' key.
                if isinstance(val, dict) and "podium" in val:
                    # 1. Podium
                    for pos, driver in val.get("podium", {}).items():
                        if not driver: continue
                        p_key = int(pos)
                        stats["podium"][p_key][driver] = stats["podium"][p_key].get(driver, 0) + 1
                    
                    # 2. Winning Gap
                    gap = val.get("winningGap")
                    if gap:
                        stats["winningGap"][gap] = stats["winningGap"].get(gap, 0) + 1
                    
                    # 3. DNFs
                    for driver in val.get("dnfPredictions", []):
                        stats["dnfPredictions"][driver] = stats["dnfPredictions"].get(driver, 0) + 1
                    
                    # 4. Safety Car
                    sc = val.get("safetyCar", {})
                    if sc.get("enabled"):
                        stats["safetyCar"]["yes"] += 1
                        if "count" in sc: sc_counts.append(sc["count"])
                    else:
                        stats["safetyCar"]["no"] += 1
                        
                    # 5. Pit Strategy
                    strat = val.get("pitStrategy", {})
                    if "stops" in strat:
                        stops_counts.append(strat["stops"])
                    
                # Support Legacy "Winner" votes if any exist (graceful fallback)
                elif isinstance(val, dict) and "code" in val:
                     # Just count as P1
                     driver = val.get("code")
                     if driver:
                         stats["podium"][1][driver] = stats["podium"][1].get(driver, 0) + 1

            except Exception as e:
                print(f"Error parsing vote {v.id}: {e}")
                continue

        # Post-Processing / Formatting
        # Convert Podium dicts to sorted lists
        def format_podium(pos_data):
            # Sort by count desc
            sorted_items = sorted(pos_data.items(), key=lambda x: x[1], reverse=True)
            # Take top 5?
            return [{"code": k, "count": v, "percent": round((v/max(1, len(votes)))*100, 1)} for k, v in sorted_items]

        stats["podium"] = {
            1: format_podium(stats["podium"][1]),
            2: format_podium(stats["podium"][2]),
            3: format_podium(stats["podium"][3])
        }
        
        # Aggregates
        if sc_counts:
            stats["safetyCar"]["avg_count"] = round(sum(sc_counts) / len(sc_counts), 1)
            
        if stops_counts:
            stats["pitStrategy"]["avg_stops"] = round(sum(stops_counts) / len(stops_counts), 1)
            dist = {1: 0, 2: 0, 3: 0}
            for s in stops_counts:
                if s in dist:
                    dist[s] += 1
            stats["pitStrategy"]["stop_dist"] = dist

        return stats
    except Exception as e:
        print(f"Stats Error: {e}")
        return {"error": str(e)}
    finally:
        session.close()

# Auto-init on import
init_db()
