
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from services.f1_service import RaceStatus, Race

load_dotenv()
DB_URL = os.getenv("DATABASE_URL")
engine = create_engine(DB_URL)
Session = sessionmaker(bind=engine)
session = Session()

def check_messages():
    print("🔍 Checking Race Status data...")
    # Get Australian 2025
    race = session.query(Race).filter(Race.year==2025, Race.race_name.ilike('%Australia%')).first()
    if not race:
        print("Race 'Australia' 2025 not found.")
        return

    print(f"Checking {race.year} {race.race_name} (ID: {race.id})")
    
    events = session.query(RaceStatus).filter_by(race_id=race.id).all()
    print(f"Found {len(events)} total events.")
    
    for e in events:
        print(f"  [{e.category}] {e.status} (Time: {e.time})")
            
    if not events:
        print("  ❌ NO events found!")

if __name__ == "__main__":
    check_messages()
