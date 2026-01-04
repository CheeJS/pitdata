
from sqlalchemy import create_engine
import os

db_path = "c:/Users/User/Desktop/f1/data_pipeline/f1_data.db"
if not os.path.exists(db_path):
    print("DB missing")
    exit()

print(f"Inspecting {db_path}")
engine = create_engine(f'sqlite:///{db_path}')
connection = engine.connect()

try:
    cols = connection.execute("PRAGMA table_info(drivers);").fetchall()
    if not cols:
        print("Table 'drivers' not found")
    else:
        for col in cols:
            print(col)
except Exception as e:
    print(e)
connection.close()
