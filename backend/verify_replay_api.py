"""Test the replay API function directly."""
from services.f1_service import get_race_replay

# Test race ID 25 (2024 Australian GP)
print("Testing race ID 25 (2024 Australian GP):")
result = get_race_replay(25)
if result:
    print(f"  totalLaps: {result.get('totalLaps')}")
    print(f"  has map: {bool(result.get('map'))}")
    print(f"  drivers count: {len(result.get('drivers', {}))}")
    print(f"  events count: {len(result.get('events', []))}")
else:
    print("  Result is None!")

# Test race ID 3 (2025 Australian GP)
print("\nTesting race ID 3 (2025 Australian GP):")
result = get_race_replay(3)
if result:
    print(f"  totalLaps: {result.get('totalLaps')}")
    print(f"  has map: {bool(result.get('map'))}")
    print(f"  drivers count: {len(result.get('drivers', {}))}")
    print(f"  events count: {len(result.get('events', []))}")
else:
    print("  Result is None!")
