from services.f1_service import get_db_session, Race

def check_date():
    session = get_db_session()
    try:
        race = session.query(Race).filter(Race.year==2025, Race.race_name.ilike('%Australia%')).first()
        if race:
            print(f"Race: {race.race_name}")
            print(f"Date: {race.date} (Type: {type(race.date)})")
            # Check other fields
            print(f"FP1: {race.fp1_date}")
            print(f"Quali: {race.qualifying_date}")
        else:
            print("Race not found")
    finally:
        session.close()

if __name__ == "__main__":
    check_date()
