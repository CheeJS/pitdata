
import fastf1

def check_raw():
    print("🔍 Loading FastF1 Session (Australia 2025)...")
    # Using explicit round number might be safer if name fails, but let's try strict name first
    # 2025 round 1 is Australia usually.
    session = fastf1.get_session(2025, 1, 'R')
    session.load(telemetry=False, weather=False, messages=True)
    
    msgs = session.race_control_messages
    if msgs is None:
        print("Raw Messages is None")
        return

    print(f"Total Raw Messages: {len(msgs)}")
    
    # Print first 20 non-flag messages to verify content
    count = 0
    for i, row in msgs.iterrows():
        msg = str(row['Message'])
        time_val = row['Time']
        time_type = type(time_val)
        print(f"Msg: {msg} | Cat: {row['Category']} | Time: {time_val} ({time_type})")
        count += 1
        if count > 20: break

if __name__ == "__main__":
    check_raw()
