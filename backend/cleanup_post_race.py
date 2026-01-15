"""
Delete all RaceStatus events that occur AFTER the Chequered Flag for Australia 2025.
These are probably from a different session (Qualifying/Practice) that got mixed in.
"""
from services.f1_service import get_db_session, RaceStatus, Race

def cleanup_post_race():
    session = get_db_session()
    try:
        race = session.query(Race).filter(Race.year==2025, Race.race_name.ilike('%Australia%')).first()
        if not race:
            print("Race not found!")
            return

        # Find Chequered Flag (the status column contains the full message)
        chequered = session.query(RaceStatus).filter_by(race_id=race.id).filter(
            RaceStatus.status.ilike('%CHEQUERED FLAG%')
        ).first()
        
        if not chequered:
            print("No Chequered Flag found!")
            return
            
        print(f"Chequered Flag at: {chequered.time:.2f}s")
        
        # Delete all events AFTER the Chequered Flag
        post_race = session.query(RaceStatus).filter(
            RaceStatus.race_id == race.id,
            RaceStatus.time > chequered.time
        ).all()
        
        print(f"Found {len(post_race)} events after Chequered Flag:")
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
    finally:
        session.close()

if __name__ == "__main__":
    cleanup_post_race()
