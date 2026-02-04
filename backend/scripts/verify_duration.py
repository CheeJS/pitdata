from services.f1_service import get_db_session, Lap, Race

def check_duration():
    session = get_db_session()
    try:
        race = session.query(Race).filter(Race.year==2025, Race.race_name.ilike('%Australia%')).first()
        if not race: return

        # 1. Get Lap 1 Start (minStart)
        lap1 = session.query(Lap).filter_by(race_id=race.id, lap_number=1).first()
        min_start = lap1.cumulative_time - lap1.lap_time
        print(f"Min Start: {min_start}")

        # 2. Get Last Lap Finish (max)
        # Find max lap number
        max_lap = session.query(Lap).filter_by(race_id=race.id).order_by(Lap.lap_number.desc()).first().lap_number
        print(f"Total Laps: {max_lap}")

        # Get finishes for last lap
        last_laps = session.query(Lap).filter_by(race_id=race.id, lap_number=max_lap).all()
        last_finish = max(l.cumulative_time for l in last_laps)
        print(f"Last Finish: {last_finish}")

        duration = last_finish - min_start
        print(f"Calculated Duration: {duration}")
        
    finally:
        session.close()

if __name__ == "__main__":
    check_duration()
