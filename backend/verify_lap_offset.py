from services.f1_service import get_db_session, Lap, Race

def check_laps():
    session = get_db_session()
    try:
        race = session.query(Race).filter(Race.year==2025, Race.race_name.ilike('%Australia%')).first()
        if not race:
            print("Race not found")
            return

        print(f"Race Date: {race.date}")
        
        # Get Lap 1 for a driver
        lap1 = session.query(Lap).filter_by(race_id=race.id, lap_number=1).first()
        if lap1:
            print(f"Lap 1 Driver: {lap1.driver}")
            print(f"Lap Time: {lap1.lap_time}")
            print(f"Cumulative: {lap1.cumulative_time}")
            # Ensure types are float
            try:
                c = float(lap1.cumulative_time)
                t = float(lap1.lap_time)
                print(f"Start Offset (Calc): {c - t}")
            except:
                print("Could not calc offset")
            
    except Exception as e:
        print(e)
    finally:
        session.close()

if __name__ == "__main__":
    check_laps()
