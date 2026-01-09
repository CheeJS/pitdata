import sys
import os

# Add the current directory to sys.path so we can import services
sys.path.append(os.getcwd())

from services.f1_service import get_db_session, Race, get_race_control_messages
import fastf1
import pandas as pd

def debug_race_control_messages(race_id):
    print(f"DEBUG: Calling service for race {race_id}...")
    try:
        result = get_race_control_messages(race_id)
        if "error" in result:
             print(f"Service returned error: {result['error']}")
        else:
             msgs = result.get('messages', [])
             print(f"Success! Got {len(msgs)} messages.")
             if msgs:
                 print("First message:", msgs[0])
    except Exception as e:
        print(f"CRITICAL SERVICE FAILURE: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    db_session = get_db_session()
    races = db_session.query(Race).limit(5).all()
    print(f"DEBUG: Found {len(races)} races in DB:")
    for r in races:
        print(f" - ID: {r.id}, Year: {r.year}, Name: {r.race_name}")
    
    if races:
        target_id = races[0].id
        # Try to find ID 72 if user mentioned it
        r72 = db_session.query(Race).filter_by(id=72).first()
        if r72: 
            target_id = 72
            print("Found Race 72, using it.")
        
        debug_race_control_messages(target_id)
    else:
        print("No races found in DB to test.")
    db_session.close()
