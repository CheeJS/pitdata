from services.f1_service import get_db_session, RaceStatus, Race

def check_flag():
    session = get_db_session()
    try:
        race = session.query(Race).filter(Race.year==2025, Race.race_name.ilike('%Australia%')).first()
        events = session.query(RaceStatus).filter_by(race_id=race.id).all()
        found = False
        for e in events:
            if 'CHEQUERED' in (e.status or '').upper() or 'CHEQUERED' in (e.category or '').upper():
                 print(f"Time: {e.time} | Status: {e.status} | Cat: {e.category}")
                 found = True
        
        if not found:
            print("No CHEQUERED entry found.")
                 
    finally:
        session.close()

if __name__ == "__main__":
    check_flag()
