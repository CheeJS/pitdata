"""
Historical F1 Data Ingestion Script
Fetches race results from 2020-2024 to build a rich dataset for Monte Carlo predictions.

Uses FastF1 to get:
- Race results (positions, points, DNFs)
- Driver info (names, codes)
- Team info
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import fastf1
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime

# Enable FastF1 cache
cache_dir = os.path.join(os.path.dirname(__file__), 'cache')
os.makedirs(cache_dir, exist_ok=True)
fastf1.Cache.enable_cache(cache_dir)

# Database setup
DB_PATH = os.path.join(os.path.dirname(__file__), 'f1_data.db')
engine = create_engine(f'sqlite:///{DB_PATH}')
Session = sessionmaker(bind=engine)

# Import models from f1_service
from backend.services.f1_service import Base, Race, Result

# Create tables if they don't exist
Base.metadata.create_all(engine)


def get_season_schedule(year):
    """Get all races for a season."""
    try:
        schedule = fastf1.get_event_schedule(year)
        # Filter to only official race weekends (not testing)
        races = schedule[schedule['EventFormat'].isin(['conventional', 'sprint', 'sprint_shootout'])]
        return races
    except Exception as e:
        print(f"Error getting {year} schedule: {e}")
        return None


def ingest_race_results(year, round_num, event_name):
    """Ingest race results for a specific race."""
    session_db = Session()
    
    try:
        # Check if already ingested
        existing = session_db.query(Race).filter(
            Race.year == year,
            Race.round == round_num
        ).first()
        
        if existing:
            print(f"  ⏭️  Already have {year} R{round_num} - skipping")
            session_db.close()
            return True
        
        # Load race session from FastF1
        race_session = fastf1.get_session(year, round_num, 'R')
        race_session.load(laps=False, telemetry=False, weather=False, messages=False)
        
        # Get results
        results = race_session.results
        if results is None or len(results) == 0:
            print(f"  ⚠️  No results for {year} R{round_num}")
            session_db.close()
            return False
        
        # Create Race entry
        race_date = race_session.date if hasattr(race_session, 'date') else datetime.now()
        new_race = Race(
            year=year,
            round=round_num,
            circuit_name=race_session.event['CircuitShortName'] if 'CircuitShortName' in race_session.event else event_name,
            race_name=event_name,
            date=race_date
        )
        session_db.add(new_race)
        session_db.flush()  # Get the race ID
        
        # Add results
        for _, row in results.iterrows():
            # Determine status
            status = str(row.get('Status', 'Finished'))
            position = row.get('Position')
            if position is not None:
                try:
                    position = int(position)
                except:
                    position = None
            
            points = row.get('Points', 0)
            if points is None:
                points = 0
            
            result = Result(
                race_id=new_race.id,
                position=position,
                driver_number=str(row.get('DriverNumber', '')),
                driver_code=str(row.get('Abbreviation', '')),
                driver_name=f"{row.get('FirstName', '')} {row.get('LastName', '')}".strip(),
                team_name=str(row.get('TeamName', '')),
                grid_position=int(row.get('GridPosition', 0)) if row.get('GridPosition') else None,
                status=status,
                points=float(points),
                time_str=str(row.get('Time', '')),
                session_type='R'
            )
            session_db.add(result)
        
        session_db.commit()
        print(f"  ✅ Ingested {year} R{round_num}: {event_name}")
        return True
        
    except Exception as e:
        print(f"  ❌ Error ingesting {year} R{round_num}: {e}")
        session_db.rollback()
        return False
    finally:
        session_db.close()


def ingest_year(year):
    """Ingest all races for a given year."""
    print(f"\n{'='*50}")
    print(f"📅 Processing {year} Season")
    print(f"{'='*50}")
    
    schedule = get_season_schedule(year)
    if schedule is None or len(schedule) == 0:
        print(f"No schedule found for {year}")
        return 0
    
    success_count = 0
    for _, event in schedule.iterrows():
        round_num = event['RoundNumber']
        event_name = event['EventName']
        
        # Skip if round 0 (testing) or no round number
        if round_num == 0 or round_num is None:
            continue
            
        print(f"\n  Processing Round {round_num}: {event_name}")
        if ingest_race_results(year, round_num, event_name):
            success_count += 1
    
    return success_count


def main():
    """Main ingestion function."""
    print("🏎️  F1 Historical Data Ingestion")
    print("=" * 50)
    
    # Years to ingest (2020-2024 for historical data)
    years = [2020, 2021, 2022, 2023, 2024]
    
    total_races = 0
    for year in years:
        count = ingest_year(year)
        total_races += count
        print(f"\n✅ {year}: {count} races ingested")
    
    print(f"\n{'='*50}")
    print(f"🏁 COMPLETE: {total_races} total races ingested")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
