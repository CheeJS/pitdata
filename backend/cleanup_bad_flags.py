"""
Delete specific erroneous flags near race end (SC/RED that don't belong).
The Australian 2025 race ended under GREEN conditions, not SC/RED.
"""
from services.f1_service import get_db_session, RaceStatus, Race

def cleanup_bad_flags():
    session = get_db_session()
    try:
        race = session.query(Race).filter(Race.year==2025, Race.race_name.ilike('%Australia%')).first()
        if not race:
            print("Race not found!")
            return

        # Find FLAGS after 9600s (around Lap 50+) that are SC or RED
        # The race finished normally under green
        bad_flags = session.query(RaceStatus).filter(
            RaceStatus.race_id == race.id,
            RaceStatus.category == 'FLAG',
            RaceStatus.time > 9600,  # After lap ~50
            RaceStatus.status.in_(['SC', 'RED', 'YELLOW'])
        ).all()
        
        print(f"Found {len(bad_flags)} suspicious FLAGS after lap 50:")
        for e in bad_flags:
            print(f"  {e.time:.2f} | {e.status}")
        
        if bad_flags:
            count = len(bad_flags)
            for e in bad_flags:
                session.delete(e)
            session.commit()
            print(f"Deleted {count} erroneous flags.")
        else:
            print("Nothing to delete.")
            
    except Exception as e:
        session.rollback()
        print(f"Error: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    cleanup_bad_flags()
