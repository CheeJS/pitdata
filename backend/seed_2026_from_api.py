import sys
import os
import fastf1
from datetime import datetime
import pandas as pd

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))

from services.f1_service import get_db_session, Race, Base, get_db_engine

def seed_2026_from_api():
    print("Fetching 2026 schedule from FastF1 API...")
    try:
        schedule = fastf1.get_event_schedule(2026)
    except Exception as e:
        print(f"Failed to fetch from FastF1: {e}")
        return

    # Ensure tables exist
    engine = get_db_engine()
    Base.metadata.create_all(bind=engine)

    session = get_db_session()
    
    # 1. Clear existing 2026 data to avoid duplicates
    existing_races = session.query(Race).filter(Race.year == 2026).all()
    if existing_races:
        print(f"Clearing {len(existing_races)} existing 2026 races...")
        for r in existing_races:
            session.delete(r)
        session.commit()

    count = 0
    # Filter for official rounds only (RoundNumber > 0)
    # FastF1 returns pre-season testing as RoundNumber 0
    official_races = schedule[schedule['RoundNumber'] > 0]

    for index, row in official_races.iterrows():
        # FastF1 columns: RoundNumber, Country, Location, OfficialEventName, EventDate, EventName, etc.
        # We need to map these to our model.
        
        # Depending on FastF1 version, columns might vary slightly, but usually:
        # RoundNumber -> round
        # Location -> circuit_name (or close enough)
        # EventName -> race_name
        # EventDate -> date
        
        # Note: EventDate in FastF1 is usually the Sunday race date timestamp
        
        r_round = int(row['RoundNumber'])
        r_name = row['EventName']
        # 'Location' is often the City/Region, not exact Circuit Name in older versions, 
        # but 'Location' column serves well for "Circuit" field in our simple schema 
        # or we might want to combine Location + " Circuit" if generic.
        # However, checking my manual seed, I used explicit circuit names. 
        # FastF1 data usually has 'Location' = 'Melbourne', 'Sakhir', etc.
        # It DOES NOT always have the full circuit name in the schedule dataframe.
        # Let's check if 'OfficialEventName' or similar exists, or just use Location.
        # For layout consistency, users often prefer "Albert Park Circuit".
        # If FastF1 only gives "Melbourne", I might need a mapper or just accept accurate location.
        # Let's inspect columns effectively. 
        # Actually, let's use 'Country' and 'Location'.
        # Our DB `circuit_name` column is often displayed as the location/circuit.
        # I'll stick to 'Location' from FastF1 as it's authentic data.
        
        r_circuit = row['Location']
        r_date = row['EventDate'].to_pydatetime()
        
        race = Race(
            year=2026,
            round=r_round,
            circuit_name=r_circuit,
            race_name=r_name,
            date=r_date
        )

        # Dynamic Session Mapping
        # FastF1 columns: Session1, Session1DateUtc, etc.
        for i in range(1, 6):
            s_name = row.get(f'Session{i}', '')
            s_date = row.get(f'Session{i}DateUtc')
            
            if pd.notna(s_date):
                 # Convert to native datetime if needed (depending on pandas version)
                 # usually it's already a Timestamp or compatible
                 dt = s_date.to_pydatetime() if hasattr(s_date, 'to_pydatetime') else s_date
                 
                 if s_name == 'Practice 1': race.fp1_date = dt
                 elif s_name == 'Practice 2': race.fp2_date = dt
                 elif s_name == 'Practice 3': race.fp3_date = dt
                 elif s_name == 'Qualifying': race.qualifying_date = dt
                 elif s_name == 'Sprint': race.sprint_date = dt
                 elif s_name == 'Sprint Qualifying': race.sprint_qualifying_date = dt

        session.add(race)
        count += 1

    session.commit()
    print(f"Successfully seeded {count} races for 2026 from FastF1 API.")
    session.close()

if __name__ == "__main__":
    seed_2026_from_api()
