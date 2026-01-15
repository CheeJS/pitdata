"""Add marshal_sectors_json and marshal_lights_json columns to circuits table."""
from services.f1_service import get_db_engine
from sqlalchemy import text

def migrate():
    engine = get_db_engine()
    with engine.connect() as conn:
        # PostgreSQL syntax
        try:
            conn.execute(text("ALTER TABLE circuits ADD COLUMN marshal_sectors_json TEXT"))
            print("Added marshal_sectors_json column")
        except Exception as e:
            print(f"marshal_sectors_json: {e}")
        
        try:
            conn.execute(text("ALTER TABLE circuits ADD COLUMN marshal_lights_json TEXT"))
            print("Added marshal_lights_json column")
        except Exception as e:
            print(f"marshal_lights_json: {e}")
        
        conn.commit()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
