from services.f1_service import get_db_session, RaceStatus, Race, Lap
from datetime import timedelta
import pytz

def dump_messages_time():
    session = get_db_session()
    try:
        race = session.query(Race).filter(Race.year==2025, Race.race_name.ilike('%Australia%')).first()
        if not race: return

        # Get session start time (UTC)
        start_time_utc = race.date.replace(tzinfo=pytz.UTC)
        # Convert to Local (Melbourne is UTC+11)
        # simplistic conversion for display
        start_time_local = start_time_utc + timedelta(hours=11)

        print(f"Race: {race.race_name}")
        print(f"Session Start (DB): {start_time_utc} UTC")
        print(f"Session Start (Local): {start_time_local} (Approx)")
        print("-" * 60)
        
        # Calculate Race Duration for Sync Check
        lap1 = session.query(Lap).filter_by(race_id=race.id, lap_number=1).first()
        min_start = lap1.cumulative_time - lap1.lap_time
        max_lap = session.query(Lap).filter_by(race_id=race.id).order_by(Lap.lap_number.desc()).first().lap_number
        last_laps = session.query(Lap).filter_by(race_id=race.id, lap_number=max_lap).all()
        last_finish = max(l.cumulative_time for l in last_laps)
        race_duration = last_finish - min_start
        race_end_session_time = min_start + race_duration
        
        print(f"Race End Session Time (Laps): {race_end_session_time}")

        events = session.query(RaceStatus).filter_by(race_id=race.id).order_by(RaceStatus.time).all()
        
        # Calculate Drift
        chequered = next((e for e in events if 'CHEQUERED' in (e.status or '').upper() or 'CHEQUERED' in (e.category or '').upper()), None)
        drift = 0
        if chequered:
            drift = race_end_session_time - chequered.time
            print(f"Detected Drift: {drift:.2f}s")
            
        print("-" * 60)
        print(f"{'LOCAL TIME (Raw)':<20} | {'LOCAL TIME (Sync)':<20} | STATUS")
        print("-" * 60)

        for e in events:
            # Raw Time
            t_raw = start_time_local + timedelta(seconds=e.time)
            # Synced Time
            t_sync = start_time_local + timedelta(seconds=e.time + drift)
            
            time_str_raw = t_raw.strftime("%I:%M:%S %p")
            time_str_sync = t_sync.strftime("%I:%M:%S %p")
            
            print(f"{time_str_raw:<20} | {time_str_sync:<20} | {e.status}")
            
    finally:
        session.close()

if __name__ == "__main__":
    dump_messages_time()
