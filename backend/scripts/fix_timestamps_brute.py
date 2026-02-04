"""
Brute-force fix: Shift all RaceStatus timestamps for Australian GP 2025
to align the first GREEN LIGHT with Lap 1 start.
"""
from services.f1_service import get_db_session, RaceStatus, Race, Lap

def fix_timestamps_brute():
    session = get_db_session()
    try:
        race = session.query(Race).filter(Race.year==2025, Race.race_name.ilike('%Australia%')).first()
        if not race:
            print("Race not found!")
            return

        print(f"Fixing timestamps for: {race.race_name}")

        # 1. Get Lap 1 Start Time
        lap1 = session.query(Lap).filter_by(race_id=race.id, lap_number=1).first()
        lap1_start = lap1.cumulative_time - lap1.lap_time
        print(f"Lap 1 Start (Session Time): {lap1_start:.2f}s")

        # 2. Get all events
        events = session.query(RaceStatus).filter_by(race_id=race.id).order_by(RaceStatus.time).all()
        
        # 3. Find the GREEN LIGHT that marks race start (after FORMATION LAP message)
        # The real race start GREEN LIGHT should be AFTER the "FORMATION LAP WILL START AT 15:15" message
        formation_msg = next((e for e in events if 'FORMATION LAP' in (e.status or '').upper()), None)
        if formation_msg:
            # Find first GREEN LIGHT after formation lap message
            green_light = next((e for e in events if e.time > formation_msg.time and 'GREEN LIGHT' in (e.status or '').upper()), None)
        else:
            # Fallback: find any GREEN LIGHT with PIT EXIT
            green_light = next((e for e in events if 'GREEN LIGHT' in (e.status or '').upper()), None)
        
        if not green_light:
            print("No GREEN LIGHT found!")
            return
            
        print(f"Race Start GREEN LIGHT (Current): {green_light.time:.2f}s")
        
        # 4. Calculate offset
        offset = lap1_start - green_light.time
        print(f"Offset to apply: {offset:.2f}s ({offset/60:.1f} mins)")
        
        if abs(offset) < 60:
            print("Offset is small (< 1 min). No fix needed.")
            return
        
        # 5. Apply offset to ALL events
        print(f"Applying offset to {len(events)} events...")
        for e in events:
            e.time = e.time + offset
        
        session.commit()
        print("Database updated.")
        
        # 6. Verify
        session.refresh(green_light)
        print(f"Race Start GREEN LIGHT (New): {green_light.time:.2f}s")
        print(f"Difference from Lap 1: {abs(green_light.time - lap1_start):.2f}s")
        
    except Exception as e:
        session.rollback()
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()

if __name__ == "__main__":
    fix_timestamps_brute()
