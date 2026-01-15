from services.f1_service import get_db_session, RaceStatus, Race

session = get_db_session()
race = session.query(Race).filter(Race.year==2025, Race.race_name.ilike('%Australia%')).first()
events = session.query(RaceStatus).filter_by(race_id=race.id).order_by(RaceStatus.time.desc()).limit(25).all()
print("Last 25 events (Time | Category | Status):")
for e in events:
    print(f"{e.time:.2f} | {e.category} | {e.status}")
session.close()
