from services.f1_service import get_db_session, RaceStatus, Race, Lap
from datetime import timedelta
import pytz

def verify_sync():
    session = get_db_session()
    try:
        race = session.query(Race).filter(Race.year==2025, Race.race_name.ilike('%Australia%')).first()
        if not race:
            print("Race not found!")
            return

        # 1. Get Session Start Time
        start_time_utc = race.date.replace(tzinfo=pytz.UTC)
        start_time_local = start_time_utc + timedelta(hours=11) # Melbourne is UTC+11
        print(f"=== Race: {race.race_name} ===")
        print(f"DB Start Time (UTC): {start_time_utc}")
        print(f"DB Start Time (Local): {start_time_local}")

        # 2. Get Lap 1 Start Time
        lap1 = session.query(Lap).filter_by(race_id=race.id, lap_number=1).first()
        lap1_start = lap1.cumulative_time - lap1.lap_time
        lap1_start_local = start_time_local + timedelta(seconds=lap1_start)
        print(f"\nLap 1 Start (Session Time): {lap1_start:.2f}s")
        print(f"Lap 1 Start (Local Time): {lap1_start_local.strftime('%I:%M:%S %p')}")
        print(f"Expected: 03:15:XX PM")

        # 3. Get Key Events
        events = session.query(RaceStatus).filter_by(race_id=race.id).order_by(RaceStatus.time).all()
        
        print("\n=== Key Events ===")
        keywords = ['FORMATION', 'ABORTED', 'GREEN LIGHT', 'CHEQUERED', 'SAFETY CAR DEPLOYED']
        for e in events:
            status = e.status or ''
            for kw in keywords:
                if kw in status.upper():
                    event_local = start_time_local + timedelta(seconds=e.time)
                    print(f"[{event_local.strftime('%I:%M:%S %p')}] {status[:60]}")
                    break

        # 4. Check if Lap 1 aligns with GREEN LIGHT (after formation lap)
        formation_msg = next((e for e in events if 'FORMATION LAP' in (e.status or '').upper()), None)
        if formation_msg:
            green_light = next((e for e in events if e.time > formation_msg.time and 'GREEN LIGHT' in (e.status or '').upper()), None)
        else:
            green_light = next((e for e in events if 'GREEN LIGHT' in (e.status or '').upper()), None)
        if green_light:
            green_local = start_time_local + timedelta(seconds=green_light.time)
            diff = abs(green_light.time - lap1_start)
            print(f"\n=== Sync Check ===")
            print(f"Green Light (Session Time): {green_light.time:.2f}s")
            print(f"Lap 1 Start (Session Time): {lap1_start:.2f}s")
            print(f"Difference: {diff:.2f}s")
            if diff > 120:
                print(f"⚠️ WARNING: Messages are OUT OF SYNC by {diff:.2f}s")
            else:
                print(f"✓ Messages are ALIGNED (within 2 mins)")
        else:
            print("\n⚠️ No 'GREEN LIGHT' message found in DB.")

    finally:
        session.close()

if __name__ == "__main__":
    verify_sync()
