import sys
import os

# Add backend to path to import models
sys.path.append(os.path.abspath('c:\\Users\\User\\Desktop\\f1\\backend'))
from services.f1_service import get_season_standings

print("Calling get_season_standings(2025)...")
try:
    data = get_season_standings(2025)
    print("Result:", data)
except Exception as e:
    print("Exception:", e)
    import traceback
    traceback.print_exc()
