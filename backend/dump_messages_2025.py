from services.f1_service import get_db_session, RaceStatus, Race

def dump_messages():
    session = get_db_session()
    try:
        race = session.query(Race).filter(Race.year==2025, Race.race_name.ilike('%Australia%')).first()
        print(f"Messages for {race.race_name} (2025)\n" + "-"*50)
        
        events = session.query(RaceStatus).filter_by(race_id=race.id).order_by(RaceStatus.time).all()
        for e in events:
            # Format: [Time] [Category] Status: Message
            # Format: [Time: XXX] [Category] Status
            print(f"[Time: {e.time:<8}] [{e.category or 'UNK':<8}] {e.status or ''}")
            
    finally:
        session.close()

if __name__ == "__main__":
    dump_messages()
