"""Force re-seed JPN 2026 race results — deletes stale Entry records first."""
import os, sys
sys.path.insert(0, '/home/ubuntu/pitdata/backend')
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from dotenv import load_dotenv
load_dotenv('/home/ubuntu/pitdata/backend/.env')
db_url = os.environ['DATABASE_URL']
engine = create_engine(db_url)
Session = sessionmaker(bind=engine)
db = Session()

try:
    # Find JPN race
    r = db.execute(text("SELECT id, race_name FROM races WHERE year=2026 AND round=3")).fetchone()
    print(f"Race: {r.race_name} (id={r.id})")

    # Count and delete stale R session results (Entry records)
    count = db.execute(text("SELECT COUNT(*) FROM results WHERE race_id=:rid AND session_type='R'"), {"rid": r.id}).scalar()
    print(f"Deleting {count} existing R session records...")
    db.execute(text("DELETE FROM results WHERE race_id=:rid AND session_type='R'"), {"rid": r.id})
    db.commit()
    print("Deleted. Now re-seeding from FastF1...")
except Exception as e:
    db.rollback()
    print(f"Error: {e}")
    sys.exit(1)
finally:
    db.close()

# Now load FastF1 and seed results
import fastf1
fastf1.Cache.enable_cache('/home/ubuntu/pitdata/data_pipeline/f1_cache')
fastf1.set_log_level('WARNING')

from services.f1_service import get_db_session, Race, Result

sess = fastf1.get_session(2026, 3, 'R')
sess.load(laps=False, telemetry=False, weather=False, messages=False)

results_df = sess.results
if results_df is None or len(results_df) == 0:
    print("No FastF1 results available!")
    sys.exit(1)

db2 = get_db_session()
try:
    race = db2.query(Race).filter_by(year=2026, round=3).first()
    added = 0
    for _, row in results_df.iterrows():
        result = Result(
            race_id=race.id,
            session_type='R',
            driver_code=row.get('Abbreviation', ''),
            driver_name=f"{row.get('FirstName', '')} {row.get('LastName', '')}".strip(),
            team_name=row.get('TeamName', ''),
            position=int(row['Position']) if row.get('Position') is not None and str(row.get('Position')) not in ('nan', 'None', '') else 0,
            points=float(row['Points']) if row.get('Points') is not None else 0.0,
            status=str(row.get('Status', 'Finished')),
            grid_position=int(row['GridPosition']) if row.get('GridPosition') is not None and str(row.get('GridPosition')) not in ('nan', 'None', '') else 0,
        )
        db2.add(result)
        added += 1
    db2.commit()
    print(f"Seeded {added} race results for JPN 2026")
    # Print top 10
    for _, row in results_df[results_df['Position'].notna()].sort_values('Position').head(10).iterrows():
        print(f"  P{int(row['Position'])} {row['Abbreviation']}: {row['Points']}pts ({row['Status']})")
except Exception as e:
    db2.rollback()
    print(f"Seeding error: {e}")
    import traceback; traceback.print_exc()
finally:
    db2.close()
