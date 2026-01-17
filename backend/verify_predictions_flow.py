from app import app
import json
import sys

def verify():
    print("Starting Verification...")
    client = app.test_client()
    
    # 1. Check Drivers
    print("Testing /api/drivers...")
    res = client.get('/api/drivers?year=2026')
    if res.status_code != 200:
        print(f"FAILED: /api/drivers returned {res.status_code}")
        sys.exit(1)
        
    drivers = res.json
    print(f"Found {len(drivers)} drivers.")
    if len(drivers) == 0:
        print("FAILED: No drivers found for 2026 (should fallback or have data).")
        # Start DB might be empty or fallback logic failed? 
        # But we saw debug_drivers.py worked.
        sys.exit(1)
    
    # 2. Check Races & Pred Windows
    print("\nTesting /api/races...")
    res = client.get('/api/races?year=2026')
    races = res.json
    if len(races) == 0:
        print("FAILED: No races found for 2026")
        sys.exit(1)
        
    race0 = races[0]
    print(f"Race: {race0['name']}")
    if "predictions" not in race0:
        print("FAILED: 'predictions' key missing in race object")
        sys.exit(1)
        
    print(f"Window Open: {race0['predictions']['is_open']}")
    
    # 3. Submit Vote
    print("\nTesting /api/predictions/vote...")
    val = {
        "podium": {"1": "VER", "2": "NOR", "3": "LEC"},
        "winningGap": "5-10s",
        "safetyCar": {"enabled": True, "count": 2},
        "dnfPredictions": ["SAI"],
        "pitStrategy": {"stops": 2}
    }
    payload = {
        "race_id": race0['id'],
        "client_id": "test_verifier",
        "value": val
    }
    
    res = client.post('/api/predictions/vote', json=payload)
    print(f"Vote Result: {res.json}")
    if res.status_code != 200:
        print(f"FAILED: Vote submission failed {res.status_code}")
        sys.exit(1)
    
    # 4. Check Stats Aggregation
    print("\nTesting /api/predictions/stats...")
    res = client.get(f"/api/predictions/stats?race_id={race0['id']}")
    stats = res.json
    print(f"Total Votes: {stats.get('total_votes')}")
    
    if stats.get('total_votes', 0) == 0:
        print("FAILED: Stats show 0 votes after submission")
        sys.exit(1)
    
    # Check if our vote is reflected (basic check)
    safety_car_yes = stats.get('safetyCar', {}).get('yes', 0)
    print(f"Safety Car 'Yes' Votes: {safety_car_yes}")
    if safety_car_yes < 1:
        print("FAILED: Safety Car vote not counted")
        sys.exit(1)

    print("\nVERIFICATION SUCCESSFUL")

if __name__ == "__main__":
    verify()
