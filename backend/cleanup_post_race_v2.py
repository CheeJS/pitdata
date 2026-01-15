"""
Delete all RaceStatus events after the race ends (based on Lap Data finish time).
"""
from services.f1_service import get_db_session, RaceStatus, Race, Lap

def cleanup_post_race_v2():
    session = get_db_session()
    try:
        race = session.query(Race).filter(Race.year==2025, Race.race_name.ilike('%Australia%')).first()
        if not race:
            print("Race not found!")
            return

        # Get Race End Time from Lap Data
        max_lap = session.query(Lap).filter_by(race_id=race.id).order_by(Lap.lap_number.desc()).first().lap_number
        last_laps = session.query(Lap).filter_by(race_id=race.id, lap_number=max_lap).all()
        race_end_time = max(l.cumulative_time for l in last_laps)
        print(f"Race End Time (Lap Data): {race_end_time:.2f}s")
        
        # Delete all events AFTER the race end
        post_race = session.query(RaceStatus).filter(
            RaceStatus.race_id == race.id,
            RaceStatus.time > race_end_time
        ).all()
        
        print(f"Found {len(post_race)} events after race end:")
        for e in post_race:
            print(f"  {e.time:.2f} | {e.category} | {e.status[:50]}")
        
        if post_race:
            count = len(post_race)
            for e in post_race:
                session.delete(e)
            session.commit()
            print(f"Deleted {count} post-race events.")
        else:
            print("Nothing to delete.")
            
    except Exception as e:
        session.rollback()
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()

if __name__ == "__main__":
    cleanup_post_race_v2()
