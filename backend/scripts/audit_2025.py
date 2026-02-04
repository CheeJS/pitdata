import sys
import os
from collections import defaultdict

# Add backend to path to import models
sys.path.append(os.path.abspath('c:\\Users\\User\\Desktop\\f1\\backend'))
from services.f1_service import get_db_session, Race, Result

session = get_db_session()
races = session.query(Race).filter(Race.year == 2025).order_by(Race.date).all()
results = session.query(Result).join(Race).filter(Race.year == 2025).all()

race_counts = defaultdict(lambda: defaultdict(int))
race_names = {}

for r in races:
    race_names[r.id] = r.race_name
    # Initialize with 0
    race_counts[r.id]['R'] = 0

for res in results:
    sess = res.session_type if res.session_type else 'R'
    race_counts[res.race_id][sess] += 1

print(f"{'ID':<4} {'Race Name':<30} {'R':<5} {'Q':<5} {'S':<5} {'Oth':<5}")
print("-" * 60)

stats = {"total_races": 0, "completed": 0}
for r in races:
    c = race_counts[r.id]
    has_results = sum(c.values()) > 0
    is_completed = c.get('R', 0) > 0 # Has Race results
    stats["total_races"] += 1
    if is_completed: stats["completed"] += 1
    
    other = sum(v for k,v in c.items() if k not in ['R','Q','S'])
    print(f"{r.id:<4} {r.race_name:<30} {c.get('R',0):<5} {c.get('Q',0):<5} {c.get('S',0):<5} {other:<5}")

print(f"\nTotal Races: {stats['total_races']}")
print(f"Completed (Has Race Results): {stats['completed']}")
session.close()
