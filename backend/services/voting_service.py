
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import json
import os
from dotenv import load_dotenv

load_dotenv()

Base = declarative_base()

class RaceAggregation(Base):
    __tablename__ = 'race_aggregation'
    race_id = Column(String, primary_key=True)
    data = Column(Text) # JSON of aggregated stats
    updated_at = Column(DateTime, default=datetime.utcnow)

class VoterLog(Base):
    __tablename__ = 'voter_log'
    race_id = Column(String, primary_key=True)
    client_id = Column(String, primary_key=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

# dedicated DB for votes to separate from ETL data
DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    print("WARNING: DATABASE_URL not set for Voting Service.")
    DB_URL = "sqlite:///:memory:"

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
        # 1. Check if user already voted for this race
        existing_log = session.query(VoterLog).filter_by(race_id=str(race_id), client_id=client_id).first()
        if existing_log:
             # In aggregated model, we prevent vote flipping effectively as we don't know what to subtract.
             # Strict lock: One vote per race.
             return {"error": "You have already voted for this race."}

        # 2. Fetch Aggregation
        agg = session.query(RaceAggregation).filter_by(race_id=str(race_id)).first()
        if not agg:
            # Init empty stats structure
            stats = {
                "total_votes": 0,
                "podium": {1: {}, 2: {}, 3: {}},
                "winningGap": {},
                "dnfPredictions": {},
                "safetyCar": {"yes": 0, "no": 0},
                "pitStrategy": {"stop_dist": {}, "avg_stops_acc": 0} # acc = accumulator
            }
            agg = RaceAggregation(race_id=str(race_id), data=json.dumps(stats))
            session.add(agg)
        
        # 3. Update Stats
        stats = json.loads(agg.data)
        
        # Payload validation
        val = value if isinstance(value, dict) else {}
        
        # 3a. Podium
        if "podium" in val:
            for pos, driver in val["podium"].items():
                if driver: 
                    p_key = str(pos) # JSON keys are strings
                    if p_key not in stats["podium"]: stats["podium"][p_key] = {}
                    stats["podium"][p_key][driver] = stats["podium"][p_key].get(driver, 0) + 1
        
        # 3b. Gap
        gap = val.get("winningGap")
        if gap:
            stats["winningGap"][gap] = stats["winningGap"].get(gap, 0) + 1

        # 3c. DNF
        for driver in val.get("dnfPredictions", []):
            stats["dnfPredictions"][driver] = stats["dnfPredictions"].get(driver, 0) + 1

        # 3d. Safety Car
        if val.get("safetyCar", {}).get("enabled"):
            stats["safetyCar"]["yes"] += 1
        else:
            stats["safetyCar"]["no"] += 1

        # 3e. Pit Strategy
        stops = val.get("pitStrategy", {}).get("stops")
        if stops is not None:
             s_key = str(stops)
             if "stop_dist" not in stats["pitStrategy"]: stats["pitStrategy"]["stop_dist"] = {}
             stats["pitStrategy"]["stop_dist"][s_key] = stats["pitStrategy"]["stop_dist"].get(s_key, 0) + 1
             # We can't easily do exact average without count, but total_votes is close enough approx if everyone votes on stops
             # Or we keep a separate count for strategy votes. For now, simplistic.

        stats["total_votes"] += 1
        
        # Save back
        agg.data = json.dumps(stats)
        agg.updated_at = datetime.utcnow()
        
        # 4. Log the Voter
        log = VoterLog(race_id=str(race_id), client_id=client_id)
        session.add(log)
        
        session.commit()
        return {"status": "success"}

    except Exception as e:
        session.rollback()
        print(f"Vote Error: {e}")
        return {"error": str(e)}
    finally:
        session.close()

def get_vote_stats(race_id):
    session = SessionLocal()
    try:
        agg = session.query(RaceAggregation).filter_by(race_id=str(race_id)).first()
        
        if not agg:
            return {
                "total_votes": 0,
                "podium": {1: [], 2: [], 3: []}, 
                "winningGap": {}, 
                "safetyCar": {"yes": 0, "no": 0, "avg_count": 0},
                "pitStrategy": {"avg_stops": 0, "stop_dist": {}}
            }

        stats = json.loads(agg.data)
        
        # Format for Frontend (Arrays for Charts etc)
        def format_podium(pos_data):
            # pos_data is { "VER": 10, "HAM": 5 }
            total = stats["total_votes"]
            sorted_items = sorted(pos_data.items(), key=lambda x: x[1], reverse=True)
            return [{"code": k, "count": v, "percent": round((v/max(1, total))*100, 1)} for k, v in sorted_items]

        # Ensure structure exists
        raw_podium = stats.get("podium", {})
        formatted_podium = {
            1: format_podium(raw_podium.get("1", {})),
            2: format_podium(raw_podium.get("2", {})),
            3: format_podium(raw_podium.get("3", {}))
        }

        # SC
        sc = stats.get("safetyCar", {"yes": 0, "no": 0})
        # Pit
        pit = stats.get("pitStrategy", {})
        stop_dist = pit.get("stop_dist", {})
        
        # Simple weighted avg for stops
        total_stops_votes = sum(stop_dist.values())
        weighted_sum = sum(int(k)*v for k,v in stop_dist.items())
        avg_stops = round(weighted_sum / max(1, total_stops_votes), 1)

        return {
            "total_votes": stats["total_votes"],
            "podium": formatted_podium,
            "winningGap": stats.get("winningGap", {}),
            "dnfPredictions": stats.get("dnfPredictions", {}),
            "safetyCar": {**sc, "avg_count": 1}, # Legacy field
            "pitStrategy": {"avg_stops": avg_stops, "stop_dist": stop_dist}
        }

    except Exception as e:
        print(f"Stats Error: {e}")
        return {"error": str(e)}
    finally:
        session.close()

# Auto-init on import
init_db()

def post_comment(race_id, client_id, nickname, content):
    session = SessionLocal()
    try:
        comment = Comment(
            race_id=str(race_id),
            client_id=client_id,
            nickname=nickname,
            content=content
        )
        session.add(comment)
        session.commit()
        return {"status": "success", "id": comment.id}
    except Exception as e:
        session.rollback()
        return {"error": str(e)}
    finally:
        session.close()

def get_comments(race_id):
    session = SessionLocal()
    try:
        comments = session.query(Comment).filter_by(race_id=str(race_id)).order_by(Comment.timestamp.desc()).all()
        return [{
            "id": c.id,
            "nickname": c.nickname,
            "content": c.content,
            "timestamp": c.timestamp.isoformat()
        } for c in comments]
    except Exception as e:
        print(f"Comments Error: {e}")
        return []
    finally:
        session.close()
