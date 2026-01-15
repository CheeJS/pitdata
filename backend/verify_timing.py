import fastf1
import pandas as pd

def check_t0():
    print("Loading Australia 2025...")
    session = fastf1.get_session(2025, 1, 'R')
    session.load(telemetry=False, weather=False, messages=False)
    
    print(f"Session.date: {session.date}")
    # fastf1 documentation says session.date is the start time of the session
    # let's look at the laps
    
    if session.laps.empty:
        print("No laps found")
        return

    try:
        lap1 = session.laps.pick_driver('VER').iloc[0]
        print(f"Lap 1 StartTime (Timedelta): {lap1['LapStartTime']}")
        print(f"Lap 1 Time (Cumulative): {lap1['Time']}")
        
        # Calculate implied wall clock time of Lap 1 Start
        implied_start = session.date + lap1['LapStartTime']
        print(f"Implied Wall Clock Start of Lap 1: {implied_start}")
    except Exception as e:
        print(f"Error picking laps: {e}")
    
    # Is there a t0?
    if hasattr(session, 't0_date'):
        print(f"Session t0_date: {session.t0_date}")

if __name__ == "__main__":
    check_t0()
