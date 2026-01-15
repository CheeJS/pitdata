
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

engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
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
            "podium": [],
            "winner": {},
            "total_votes": len(votes)
        }
        
        # Aggregation Logic
        winner_counts = {}
        sc_values = []
        
        for v in votes:
            try:
                val = json.loads(v.value)
                
                if v.category == "winner":
                    # Handle legacy string vs new object
                    driver = val.get("code") if isinstance(val, dict) else val
                    if driver:
                        winner_counts[driver] = winner_counts.get(driver, 0) + 1
                        
                elif v.category == "safety_car":
                    # Handle legacy "YES"/"NO" -> 100/0 map, or new distinct int
                    if val == "YES": sc_values.append(100)
                    elif val == "NO": sc_values.append(0)
                    elif isinstance(val, (int, float)): sc_values.append(val)
                    
            except:
                continue

        # Format Winner Stats
        total_winner_votes = sum(winner_counts.values()) or 1
        stats["winner"] = [
            {"code": k, "count": v, "percent": round((v/total_winner_votes)*100, 1)} 
            for k, v in winner_counts.items()
        ]
        stats["winner"].sort(key=lambda x: x["count"], reverse=True)
        
        # Format SC Stats
        stats["safety_car_avg"] = round(sum(sc_values) / len(sc_values)) if sc_values else 0

        return stats
    except Exception as e:
        return {"error": str(e)}
    finally:
        session.close()

# Auto-init on import
init_db()
