import sys
import os
import time
import argparse
import traceback
import subprocess
from datetime import datetime, timedelta

# Ensure correct working directory and path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
os.chdir(BASE_DIR)

from services.f1_service import get_db_session, Race, Result, Circuit, Telemetry, is_race_cancelled
from seed_year_data import seed_results
from seed_full_telemetry import seed_full_race_data


def run_pipeline(year):
    print(f"=== F1 Master Automation Pipeline (Year: {year}) ===")
    print(f"Started at: {datetime.utcnow().isoformat()}Z")
    
    session = get_db_session()
    try:
        # 1. Identify active races needing data
        # We look back 7 days to cover recently completed races that might have missing telemetry
        # and look forward 14 days for upcoming races.
        current_time = datetime.utcnow()
        active_window_start = current_time - timedelta(days=7)
        active_window_end = current_time + timedelta(days=14)
        
        races = session.query(Race).filter(
            Race.year == year,
            Race.date >= active_window_start,
            Race.date <= active_window_end
        ).order_by(Race.date.asc()).all()

        active_races = [r for r in races if not is_race_cancelled(r.race_name, year)]

        if not active_races:
            # If no race in window (e.g. summer break), just try to find the very next race
            next_race = session.query(Race).filter(
                Race.year == year,
                Race.date > current_time
            ).order_by(Race.date.asc()).first()
            if next_race and not is_race_cancelled(next_race.race_name, year):
                active_races = [next_race]
        
        if not active_races:
            print("No active races found in current window.")
            return

        for race in active_races:
            print(f"\n--- Processing: {race.race_name} (Round {race.round}) ---")
            
            # --- Phase 1: Results & Standings ---
            # Attempt to seed results. If race hasn't happened, this safely exits or seeds Qualifying.
            has_happened = race.date < current_time
            if has_happened:
                print("  [Phase 1] Seeding Results & Standings...")
                try:
                    subprocess.run([sys.executable, "seed_year_data.py", str(year)], check=True)
                except Exception as e:
                    print(f"  Error seeding results: {e}")
            else:
                print("  [Phase 1] Race is in the future. Skipping results seeding.")

            # --- Phase 2: Full Telemetry (Laps, Track Map, Race Control) ---
            if has_happened:
                print("  [Phase 2] Seeding Telemetry, Replay & Track Map...")
                try:
                    subprocess.run([sys.executable, "seed_race_telemetry.py", str(year), str(race.round)], check=True)
                except Exception as e:
                    print(f"  Error seeding telemetry: {e}")
                
                # --- Phase 3: Track Map Fallback ---
                # Since 2026 car coordinates are missing from FastF1 API for recent races,
                # we copy the 2025 track map coordinates JUST to draw the track on the web.
                # This does NOT affect race results, laps, or standings.
                print("  [Phase 3] Checking Fallbacks for Missing Track Maps...")
                try:
                    c_count = session.query(Circuit).filter_by(race_id=race.id).count()
                    if c_count == 0 and race.year == 2026:
                        r25 = session.query(Race).filter(Race.year == 2025, Race.circuit_name == str(race.circuit_name)).first()
                        if r25:
                            c25 = session.query(Circuit).filter_by(race_id=r25.id).first()
                            if c25:
                                session.add(Circuit(
                                    race_id=race.id, x_json=c25.x_json, y_json=c25.y_json,
                                    distance_json=c25.distance_json, corners_json=c25.corners_json
                                ))
                                session.commit()
                                print(f"    Restored {race.race_name} Track Map using 2025 coordinates.")
                except Exception as e:
                    print(f"  Error in fallback logic: {e}")

            # --- Phase 4: Machine Learning Predictions ---
            # Generate predictions if we are within 14 days of the race
            print("  [Phase 4] Generating ML Predictions...")
            try:
                subprocess.run([sys.executable, "generate_predictions_db.py", str(year)], check=True)
                print("    Predictions generated successfully.")
            except Exception as e:
                print(f"    Predictions error (might be too early/late or missing data): {e}")

        print("\n=== Master Pipeline Completed Successfully ===")
        
    except Exception as e:
        print(f"\nCRITICAL ERROR in Master Pipeline: {e}")
        traceback.print_exc()
    finally:
        session.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='F1 Master Automation Pipeline')
    parser.add_argument('year', type=int, nargs='?', default=2026, help='Year to process (default: 2026)')
    args = parser.parse_args()
    
    run_pipeline(args.year)
