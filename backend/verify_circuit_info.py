"""Check what circuit info is currently stored in the database."""
from services.f1_service import get_db_session, Circuit, Race

session = get_db_session()
try:
    # Get Australian GP 2025 circuit data
    c = session.query(Circuit).join(Race).filter(
        Race.year == 2025, 
        Race.race_name.ilike('%Australia%')
    ).first()
    
    if c:
        print(f"Circuit ID: {c.id}")
        print(f"Race ID: {c.race_id}")
        print(f"Has X/Y coords: {bool(c.x_json)}")
        print(f"Has Distance: {bool(c.distance_json)}")
        print(f"Has Corners: {bool(c.corners_json)}")
        
        if c.corners_json:
            import json
            corners = json.loads(c.corners_json)
            print(f"\nCorners data ({len(corners)} items):")
            for corner in corners[:5]:
                print(f"  {corner}")
    else:
        print("No circuit data found for Australian GP 2025")
finally:
    session.close()
