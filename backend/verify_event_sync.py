from services.f1_service import get_db_session, Lap, Race, RaceStatus

def check_sync():
    session = get_db_session()
    try:
        race = session.query(Race).filter(Race.year==2025, Race.race_name.ilike('%Australia%')).first()
        if not race: return

        print(f"Race: {race.race_name} (ID: {race.id})")

        # 1. First Lap
        lap1 = session.query(Lap).filter_by(race_id=race.id, lap_number=1).first()
        lap_start = lap1.cumulative_time - lap1.lap_time
        print(f"Lap 1 Start (Session Time): {lap_start}")

        # 2. Events/Status
        events = session.query(RaceStatus).filter_by(race_id=race.id).order_by(RaceStatus.time).all()
        print(f"Found {len(events)} events.")
        
        print("--- First 5 Events ---")
        for e in events[:5]:
            print(f"Time: {e.time} | Status: {e.status} | Cat: {e.category}")
            
        print("--- Events near Lap 1 Start ---")
        near_events = [e for e in events if abs(e.time - lap_start) < 300] # +/- 5 mins
        for e in near_events:
            print(f"Time: {e.time} | Status: {e.status} | Cat: {e.category}")

    finally:
        session.close()

if __name__ == "__main__":
    check_sync()
