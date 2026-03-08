"""
Seed full telemetry + lap data for a single race (for Race Replay).
Usage:
    python3 seed_race_telemetry.py 2026 1         # 2026 Round 1 (AUS)
    python3 seed_race_telemetry.py 2026 2         # 2026 Round 2 (CHN) etc.
    python3 seed_race_telemetry.py 2026           # All 2026 races with data
"""
import sys, os
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from seed_full_telemetry import seed_full_race_data, seed_full_year
from services.f1_service import get_db_session, get_db_engine, Race, Base

if len(sys.argv) < 2:
    print(__doc__)
    sys.exit(1)

year = int(sys.argv[1])
engine = get_db_engine()
Base.metadata.create_all(bind=engine)
session_db = get_db_session()

if len(sys.argv) >= 3:
    # Single race by round number
    race_round = int(sys.argv[2])
    race = session_db.query(Race).filter_by(year=year, round=race_round).first()
    if not race:
        print(f"Race not found: year={year} round={race_round}")
        print("Run seed_year_data.py first to populate the schedule.")
        sys.exit(1)
    print(f"Seeding: {race.race_name} ({year} Round {race_round}) id={race.id}")
    success = seed_full_race_data(year, race_round, race.id, session_db)
    print("✓ Done" if success else "✗ Failed")
else:
    # All races in the year that have results
    seed_full_year(year)

session_db.close()
