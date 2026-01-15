
import sys
import os
from sqlalchemy import func

# Add backend to path specifically
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app
from services.f1_service import get_db_session, Result, Race, get_season_standings

def verify_standings(year=2024):
    print(f"--- Verifying Standings for {year} ---")
    
    # 1. Get API Standings (Current Logic)
    api_data = get_season_standings(year)
    if not api_data or "error" in api_data:
        print("Error getting API data")
        return

    api_constructors = {c['name']: c['points'] for c in api_data.get('constructors', [])}
    
    # 2. Calculate Raw Sum from DB
    session = get_db_session()
    raw_results = session.query(Result.team_name, func.sum(Result.points))\
        .join(Race)\
        .filter(Race.year == year)\
        .group_by(Result.team_name)\
        .all()
    
    db_constructors = {r[0]: float(r[1]) for r in raw_results}
    
    print(f"{'Team':<25} | {'API':<10} | {'DB Raw':<10} | {'Diff':<10}")
    print("-" * 65)
    
    mismatch = False
    all_teams = set(api_constructors.keys()) | set(db_constructors.keys())
    
    for team in sorted(list(all_teams)):
        api_pts = api_constructors.get(team, 0)
        db_pts = db_constructors.get(team, 0)
        diff = api_pts - db_pts
        
        if abs(diff) > 0.1:
            mismatch = True
            print(f"{team:<25} | {api_pts:<10} | {db_pts:<10} | {diff:<10} <--- MISMATCH")
        else:
            print(f"{team:<25} | {api_pts:<10} | {db_pts:<10} | {diff:<10}")
            
    if mismatch:
        print("\n[!] Discrepancy detected in CONSTRUCTORS!")
    else:
        print("\n[OK] API logic matches raw database sums for Constructors.")

    # 3. Verify Drivers
    print(f"\n--- Verifying Drivers for {year} ---")
    api_drivers = {d['code']: d['points'] for d in api_data.get('drivers', [])}
    
    raw_driver_results = session.query(Result.driver_code, func.sum(Result.points))\
        .join(Race)\
        .filter(Race.year == year)\
        .group_by(Result.driver_code)\
        .all()
    
    db_drivers = {r[0]: float(r[1]) for r in raw_driver_results}
    
    print(f"{'Driver':<10} | {'API':<10} | {'DB Raw':<10} | {'Diff':<10}")
    print("-" * 50)
    
    driver_mismatch = False
    all_drivers = set(api_drivers.keys()) | set(db_drivers.keys())
    
    for d in sorted(list(all_drivers)):
        api_pts = api_drivers.get(d, 0)
        db_pts = db_drivers.get(d, 0)
        diff = api_pts - db_pts
        
        if abs(diff) > 0.1:
            driver_mismatch = True
            print(f"{d:<10} | {api_pts:<10} | {db_pts:<10} | {diff:<10} <--- MISMATCH")
        else:
            print(f"{d:<10} | {api_pts:<10} | {db_pts:<10} | {diff:<10}")

    if driver_mismatch:
        print("\n[!] Discrepancy detected in DRIVERS!")
    else:
        print("\n[OK] API logic matches raw database sums for Drivers.")

if __name__ == "__main__":
    verify_standings(2025)
    verify_standings(2024)
