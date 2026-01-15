from services.f1_service import get_db_session, RaceStatus, Race, Lap

def fix_timestamps():
    session = get_db_session()
    try:
        race = session.query(Race).filter(Race.year==2025, Race.race_name.ilike('%Australia%')).first()
        if not race: return

        print(f"Fixing Timestamps for: {race.race_name} (2025)")

        # 1. Calculate Race End (Laps)
        lap1 = session.query(Lap).filter_by(race_id=race.id, lap_number=1).first()
        min_start = lap1.cumulative_time - lap1.lap_time
        
        # Find max lap
        max_lap = session.query(Lap).filter_by(race_id=race.id).order_by(Lap.lap_number.desc()).first().lap_number
        last_laps = session.query(Lap).filter_by(race_id=race.id, lap_number=max_lap).all()
        last_finish = max(l.cumulative_time for l in last_laps)
        
        race_end_session_time = last_finish # Absolute Session Time of Finish
        print(f"Race Finish (Laps): {race_end_session_time}")

        # 2. Find Chequered Flag (Messages)
        events = session.query(RaceStatus).filter_by(race_id=race.id).all()
        chequered = next((e for e in events if 'CHEQUERED' in (e.status or '').upper() or 'CHEQUERED' in (e.category or '').upper()), None)
        
        if not chequered:
            print("No Chequered Flag found. Aborting.")
            return

        print(f"Chequered Flag (Current DB): {chequered.time}")

        # 3. Calculate Drift
        # Expected Time for Chequered Flag = Race Finish (Laps)
        # We don't add 3200s blindly. We match the End.
        drift = race_end_session_time - chequered.time
        
        print(f"Calculated Drift: {drift:.2f}s")

        if abs(drift) < 60:
            print("Drift is small (< 1 min). No fix needed.")
            return

        # 4. Apply Fix
        print(f"Applying offset of +{drift:.2f}s to {len(events)} events...")
        for e in events:
            e.time = e.time + drift
        
        session.commit()
        print("Database updated successfully.")
        
        # Verify
        session.refresh(chequered)
        print(f"Chequered Flag (New DB): {chequered.time}")
            
    except Exception as e:
        session.rollback()
        print(f"Error: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    fix_timestamps()
