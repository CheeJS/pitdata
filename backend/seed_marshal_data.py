"""
Seed Marshal Sectors and Marshal Lights data for all circuits.
Uses FastF1's get_circuit_info() to fetch the data.
"""
import sys
import os
import json
import numpy as np

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))

import fastf1
from services.f1_service import get_db_session, Circuit, Race

# FastF1 Cache
CACHE_DIR = os.path.join(os.path.dirname(__file__), '..', 'data_pipeline', 'f1_cache')
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)
fastf1.Cache.enable_cache(CACHE_DIR)


def get_position_at_distance(x_coords, y_coords, distances, target_distance):
    """Interpolate X/Y position at a given distance along the track."""
    if not distances or target_distance < 0:
        return None, None
    
    # Find the two points to interpolate between
    for i in range(len(distances) - 1):
        if distances[i] <= target_distance <= distances[i + 1]:
            # Linear interpolation
            ratio = (target_distance - distances[i]) / (distances[i + 1] - distances[i])
            x = x_coords[i] + (x_coords[i + 1] - x_coords[i]) * ratio
            y = y_coords[i] + (y_coords[i + 1] - y_coords[i]) * ratio
            return float(x), float(y)
    
    # If target is beyond track length, use last point
    return float(x_coords[-1]), float(y_coords[-1])


def seed_marshal_data_for_race(session, race):
    """Seed marshal sectors and lights for a single race."""
    circuit = session.query(Circuit).filter_by(race_id=race.id).first()
    if not circuit:
        print(f"  No circuit data for {race.race_name}")
        return False
    
    # Check if already seeded
    if circuit.marshal_sectors_json and circuit.marshal_lights_json:
        print(f"  Already seeded")
        return True
    
    try:
        ff1_session = fastf1.get_session(race.year, race.round, 'R')
        ff1_session.load(telemetry=False, weather=False, messages=False, laps=True)
        
        circuit_info = ff1_session.get_circuit_info()
        
        # Get track coordinates for position interpolation
        x_coords = json.loads(circuit.x_json) if circuit.x_json else []
        y_coords = json.loads(circuit.y_json) if circuit.y_json else []
        distances = json.loads(circuit.distance_json) if circuit.distance_json else []
        
        # Process Marshal Sectors
        marshal_sectors = []
        if hasattr(circuit_info, 'marshal_sectors') and circuit_info.marshal_sectors is not None:
            for _, row in circuit_info.marshal_sectors.iterrows():
                dist = float(row.get('Distance', 0))
                x, y = get_position_at_distance(x_coords, y_coords, distances, dist)
                marshal_sectors.append({
                    'number': str(row.get('MarshalSector', row.name + 1)),
                    'distance': dist,
                    'x': x,
                    'y': y
                })
        
        # Process Marshal Lights
        marshal_lights = []
        if hasattr(circuit_info, 'marshal_lights') and circuit_info.marshal_lights is not None:
            for _, row in circuit_info.marshal_lights.iterrows():
                dist = float(row.get('Distance', 0))
                x, y = get_position_at_distance(x_coords, y_coords, distances, dist)
                marshal_lights.append({
                    'distance': dist,
                    'x': x,
                    'y': y
                })
        
        # Also update corners with X/Y positions if not already present
        if circuit.corners_json:
            corners = json.loads(circuit.corners_json)
            for corner in corners:
                if 'x' not in corner or 'y' not in corner:
                    dist = corner.get('distance', 0)
                    x, y = get_position_at_distance(x_coords, y_coords, distances, dist)
                    corner['x'] = x
                    corner['y'] = y
            circuit.corners_json = json.dumps(corners)
        
        circuit.marshal_sectors_json = json.dumps(marshal_sectors)
        circuit.marshal_lights_json = json.dumps(marshal_lights)
        session.commit()
        
        print(f"  Added {len(marshal_sectors)} sectors, {len(marshal_lights)} lights")
        return True
        
    except Exception as e:
        print(f"  Error: {e}")
        return False


def seed_all_marshal_data(years=[2024, 2025]):
    """Seed marshal data for all races in given years."""
    session = get_db_session()
    
    try:
        for year in years:
            print(f"\n{'='*50}")
            print(f"SEEDING MARSHAL DATA FOR {year}")
            print(f"{'='*50}")
            
            races = session.query(Race).filter_by(year=year).order_by(Race.round).all()
            print(f"Found {len(races)} races.\n")
            
            for race in races:
                print(f"  [{race.round:02d}] {race.race_name}...", end=" ")
                seed_marshal_data_for_race(session, race)
        
        print("\nDone!")
        
    finally:
        session.close()


if __name__ == "__main__":
    seed_all_marshal_data(years=[2024, 2025])
