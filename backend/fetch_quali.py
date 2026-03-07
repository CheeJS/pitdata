"""Fetch qualifying results for any race/year and save to JSON.

Usage:
    python fetch_quali.py "Australian Grand Prix" AUS
    python fetch_quali.py "Chinese Grand Prix" CHN
    python fetch_quali.py "Japanese Grand Prix" JPN
    python fetch_quali.py "Bahrain Grand Prix" BAH
    python fetch_quali.py "Saudi Arabian Grand Prix" SAU
    # etc.

Output: <RACE_CODE>_quali_2026.json  (e.g. CHN_quali_2026.json)
Next:   python generate_predictions_post_quali.py CHN CHN_quali_2026.json
"""
import sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fastf1
import pandas as pd

if len(sys.argv) < 3:
    print(__doc__)
    sys.exit(1)

race_name = sys.argv[1]   # e.g. "Chinese Grand Prix"
race_code = sys.argv[2].upper()   # e.g. CHN
year = int(sys.argv[3]) if len(sys.argv) > 3 else 2026
output_file = os.path.join(os.path.dirname(__file__), f'{race_code}_quali_{year}.json')

CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data_pipeline', 'f1_cache')
os.makedirs(CACHE_DIR, exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)

print(f'Fetching {year} {race_name} Qualifying...')
try:
    session = fastf1.get_session(year, race_name, 'Q')
    session.load(telemetry=False, weather=False, messages=True)

    results = session.results
    quali_times = {}

    for _, row in results.iterrows():
        code = row['Abbreviation']
        q3 = row['Q3']
        q2 = row['Q2']
        q1 = row['Q1']
        best = q3 if pd.notna(q3) else (q2 if pd.notna(q2) else q1)
        if pd.notna(best):
            quali_times[code] = round(best.total_seconds(), 3)

    print('\nGrid order:')
    for _, row in results.sort_values('Position').iterrows():
        pos = row['Position']
        pos_str = f'P{int(pos)}' if pd.notna(pos) else 'P?'
        code = row['Abbreviation']
        best_t = row['Q3'] if pd.notna(row['Q3']) else (row['Q2'] if pd.notna(row['Q2']) else row['Q1'])
        t_str = f"{best_t.total_seconds():.3f}s" if pd.notna(best_t) else 'No time'
        in_dict = '✓' if code in quali_times else '✗'
        print(f'  {pos_str}: {code}  {t_str}  {in_dict}')

    # Warn about missing drivers
    no_time = [row['Abbreviation'] for _, row in results.iterrows()
               if row['Abbreviation'] not in quali_times]
    if no_time:
        print(f'\n⚠ No time recorded for: {no_time}')
        print('  Add them manually to the JSON with an estimated time (slightly slower than last position)')

    with open(output_file, 'w') as f:
        json.dump(quali_times, f, indent=2)

    print(f'\nSaved {len(quali_times)} drivers to {output_file}')
    print(f'\nNext step:')
    print(f'  python generate_predictions_post_quali.py {race_code} {os.path.basename(output_file)}')

except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()
