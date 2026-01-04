
from sqlalchemy import create_engine
import os

if os.path.exists("backend/f1.db"):
    db_path = "backend/f1.db"
elif os.path.exists("f1.db"):
    db_path = "f1.db"
else:
    print("DB not found")
    exit()

print(f"Checking DB: {db_path}")
engine = create_engine(f'sqlite:///{db_path}')
connection = engine.connect()
result = connection.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [row[0] for row in result]
print("Tables:", tables)
connection.close()
