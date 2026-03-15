"""
Race Weekend Automation Script
Runs on EC2 via a single cron entry every 15 minutes.
Reads session times from the DB — no hardcoded race times.

Cron setup (run once, works for every race all season):
    */15 * * * *  cd ~/pitdata/backend && python3 auto_weekend.py auto 2026 >> /var/log/f1_auto.log 2>&1

Manual override (still supported):
    python3 auto_weekend.py quali 2026   # force quali workflow now
    python3 auto_weekend.py race  2026   # force race workflow now

Auto mode logic (per invocation — no internal sleep loop):
- Finds the most recent race in the DB
- If qualifying ended 0–8 h ago AND Q results not yet seeded → run quali workflow
- If race ended 2–10 h ago AND laps not yet seeded → run race workflow
- Otherwise exits immediately (nothing to do)
- A lock file prevents two instances overlapping

The 2-hour grace period before acting on race data gives FastF1 time to
process the session. The 8/10-hour cutoffs prevent stale retries if
something went badly wrong.
"""

import sys
import os
import json
import subprocess
import traceback
from datetime import datetime, timezone, timedelta

# ── Config ────────────────────────────────────────────────────────────────────
# How long after session END time to start acting (gives FastF1 time to process)
QUALI_GRACE_MIN  = 45    # start polling this many minutes after quali ends
RACE_GRACE_MIN   = 90    # start polling this many minutes after race ends
# How many hours after session end to keep retrying before giving up
QUALI_WINDOW_H   = 8
RACE_WINDOW_H    = 10
# Typical session durations in minutes (used to estimate end time from start time)
QUALI_DURATION_MIN = 60
RACE_DURATION_MIN  = 110
# ─────────────────────────────────────────────────────────────────────────────

LOCK_FILE = '/tmp/f1_auto_weekend.lock'

sys.path.append(os.path.abspath(os.path.dirname(__file__)))
import fastf1
import pandas as pd
from services.f1_service import get_db_session, Race, Result, Lap

CACHE_DIR = os.path.join(os.path.dirname(__file__), '..', 'data_pipeline', 'f1_cache')
os.makedirs(CACHE_DIR, exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)


def log(msg):
    print(f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC] {msg}", flush=True)


def acquire_lock():
    """Return True if we got the lock, False if another instance is running."""
    if os.path.exists(LOCK_FILE):
        # Check if the PID inside is still alive
        try:
            with open(LOCK_FILE) as f:
                pid = int(f.read().strip())
            os.kill(pid, 0)  # raises if process doesn't exist
            return False  # still running
        except (ValueError, OSError):
            pass  # stale lock — take it over
    with open(LOCK_FILE, 'w') as f:
        f.write(str(os.getpid()))
    return True


def release_lock():
    try:
        os.remove(LOCK_FILE)
    except OSError:
        pass


def dt_utc(naive_dt):
    """Make a naive datetime timezone-aware (UTC)."""
    if naive_dt is None:
        return None
    if naive_dt.tzinfo is None:
        return naive_dt.replace(tzinfo=timezone.utc)
    return naive_dt


def get_current_race(year):
    """Return the most recent Race row for this year (past or current weekend)."""
    db = get_db_session()
    try:
        now = datetime.now(timezone.utc)
        # Race from the last 10 days or the next 4 days (covers the whole weekend)
        window_start = now - timedelta(days=10)
        window_end   = now + timedelta(days=4)
        race = (
            db.query(Race)
            .filter(Race.year == year, Race.date >= window_start, Race.date <= window_end)
            .order_by(Race.date.asc())
            .first()
        )
        return race
    finally:
        db.close()


def quali_needs_seeding(race_id):
    db = get_db_session()
    try:
        return db.query(Result).filter_by(race_id=race_id, session_type='Q').count() == 0
    finally:
        db.close()


def race_needs_seeding(race_id):
    db = get_db_session()
    try:
        return db.query(Lap).filter_by(race_id=race_id).count() == 0
    finally:
        db.close()


def get_quali_end_utc(race):
    """Estimate when qualifying ended in UTC."""
    if race.qualifying_date:
        return dt_utc(race.qualifying_date) + timedelta(minutes=QUALI_DURATION_MIN)
    # Fallback: race day − 1 day, assume ~14:00 UTC (rough but better than nothing)
    race_utc = dt_utc(race.date)
    return race_utc - timedelta(days=1)


def get_race_end_utc(race):
    """Estimate when the race ended in UTC."""
    return dt_utc(race.date) + timedelta(minutes=RACE_DURATION_MIN)


def fastf1_has_quali_data(year, race_round):
    """Return True if FastF1 has qualifying session results available."""
    try:
        session = fastf1.get_session(year, race_round, 'Q')
        session.load(telemetry=False, weather=False, messages=False)
        return hasattr(session, 'results') and not session.results.empty
    except Exception as e:
        log(f"    FastF1 quali check failed: {e}")
        return False


def fastf1_has_race_data(year, race_round):
    """Return True if FastF1 has race lap data available."""
    try:
        session = fastf1.get_session(year, race_round, 'R')
        session.load(telemetry=False, weather=False, messages=False)
        laps = session.laps
        return laps is not None and len(laps) > 50  # at least some laps loaded
    except Exception as e:
        log(f"    FastF1 race check failed: {e}")
        return False


def run(cmd, desc):
    """Run a shell command, log output, return True on success."""
    log(f"  → {desc}")
    log(f"    CMD: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.stdout:
        for line in result.stdout.strip().splitlines():
            log(f"    {line}")
    if result.returncode != 0:
        log(f"    ✗ FAILED (exit {result.returncode})")
        if result.stderr:
            for line in result.stderr.strip().splitlines()[-10:]:
                log(f"    ERR: {line}")
        return False
    log(f"    ✓ OK")
    return True


def get_race_code(race_name):
    """Map race name → short code for quali JSON filename."""
    mapping = {
        'Australian':    'AUS', 'Chinese':       'CHN', 'Japanese':      'JPN',
        'Bahrain':       'BAH', 'Saudi':         'SAU', 'Miami':         'MIA',
        'Emilia':        'EMI', 'Monaco':        'MON', 'Spanish':       'ESP',
        'Canadian':      'CAN', 'Austrian':      'AUT', 'British':       'GBR',
        'Belgian':       'BEL', 'Hungarian':     'HUN', 'Dutch':         'NED',
        'Italian':       'ITA', 'Azerbaijan':    'AZE', 'Singapore':     'SIN',
        'United States': 'USA', 'Mexico':        'MEX', 'São Paulo':     'BRA',
        'Sao Paulo':     'BRA', 'Las Vegas':     'LVG', 'Qatar':         'QAT',
        'Abu Dhabi':     'ABU', 'Madrid':        'MAD',
    }
    for keyword, code in mapping.items():
        if keyword.lower() in race_name.lower():
            return code
    # Fallback: first 3 chars of first word
    return race_name.split()[0][:3].upper()


def auto_fill_missing_quali_times(json_path, year, race_round):
    """
    If any drivers have no time in the quali JSON, fill them with
    last_classified_time + 0.1s * position_offset to avoid blocking predictions.
    """
    try:
        session = fastf1.get_session(year, race_round, 'Q')
        session.load(telemetry=False, weather=False, messages=False)
        results = session.results.sort_values('Position')

        with open(json_path) as f:
            times = json.load(f)

        last_time = max(times.values()) if times else 90.0
        filled = []
        offset = 0.2
        for _, row in results.iterrows():
            code = row['Abbreviation']
            if code not in times:
                times[code] = round(last_time + offset, 3)
                offset += 0.2
                filled.append(code)

        if filled:
            log(f"    Auto-filled missing quali times for: {filled}")
            with open(json_path, 'w') as f:
                json.dump(times, f, indent=2)
        return True
    except Exception as e:
        log(f"    Could not auto-fill missing times: {e}")
        return False


# ── Main workflows ────────────────────────────────────────────────────────────

def run_quali_workflow(year, race):
    """Saturday: seed qualifying DB + fetch times + generate predictions."""
    log(f"Starting QUALI workflow for: {race.race_name} (Round {race.round})")
    here = os.path.dirname(os.path.abspath(__file__))
    py = sys.executable
    race_code = get_race_code(race.race_name)
    json_file = os.path.join(here, f'{race_code}_quali_{year}.json')

    # 1. Seed qualifying results to DB (for dashboard quali panel)
    ok = run([py, os.path.join(here, 'seed_qualifying.py'), str(year)], 'seed_qualifying.py')
    if not ok:
        log("Seed qualifying failed — will continue to predictions anyway")

    # 2. Fetch quali times to JSON
    ok = run([py, os.path.join(here, 'fetch_quali.py'), race.race_name, race_code, str(year)],
             f'fetch_quali.py → {os.path.basename(json_file)}')
    if not ok or not os.path.exists(json_file):
        log("fetch_quali.py failed — aborting predictions")
        return False

    # 3. Auto-fill any drivers with no recorded time
    auto_fill_missing_quali_times(json_file, year, race.round)

    # 4. Generate post-quali predictions and upload to S3
    ok = run([py, os.path.join(here, 'generate_predictions_post_quali.py'), race_code, json_file],
             'generate_predictions_post_quali.py')
    return ok


def run_race_workflow(year, race):
    """Sunday/Monday: seed results, replay laps, telemetry."""
    log(f"Starting RACE workflow for: {race.race_name} (Round {race.round})")
    here = os.path.dirname(os.path.abspath(__file__))
    py = sys.executable

    # 1. Race results + lap data (dashboard + standings)
    ok = run([py, os.path.join(here, 'seed_year_data.py'), str(year)], 'seed_year_data.py')
    if not ok:
        log("seed_year_data.py failed")
        return False

    # 2. Full telemetry for replay & analysis
    ok = run([py, os.path.join(here, 'seed_race_telemetry.py'), str(year), str(race.round)],
             f'seed_race_telemetry.py {year} {race.round}')
    if not ok:
        log("seed_race_telemetry.py failed — replay won't be available yet")

    return True


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    mode = sys.argv[1]
    year = int(sys.argv[2]) if len(sys.argv) >= 3 else 2026

    if mode not in ('auto', 'quali', 'race'):
        print(__doc__)
        sys.exit(1)

    log(f"{'='*60}")
    log(f"AUTO_WEEKEND  mode={mode}  year={year}")
    log(f"{'='*60}")

    if not acquire_lock():
        log("Another instance is already running — exiting.")
        sys.exit(0)

    try:
        _run(mode, year)
    finally:
        release_lock()


def _run(mode, year):
    now = datetime.now(timezone.utc)

    race = get_current_race(year)
    if not race:
        log("No race found in the current ±10 day window. Nothing to do.")
        return

    log(f"Current race: {race.race_name}  Round {race.round}  (id={race.id})")
    log(f"  Race start (UTC):  {dt_utc(race.date)}")
    if race.qualifying_date:
        log(f"  Quali start (UTC): {dt_utc(race.qualifying_date)}")

    quali_end = get_quali_end_utc(race)
    race_end  = get_race_end_utc(race)

    # ── Decide what to do ────────────────────────────────────────────────────

    do_quali = False
    do_race  = False

    if mode in ('auto', 'quali'):
        quali_act_start = quali_end + timedelta(minutes=QUALI_GRACE_MIN)
        quali_act_end   = quali_end + timedelta(hours=QUALI_WINDOW_H)
        if quali_act_start <= now <= quali_act_end:
            if quali_needs_seeding(race.id):
                log(f"Quali window active ({quali_act_start.strftime('%H:%M')}–"
                    f"{quali_act_end.strftime('%H:%M')} UTC) and Q not seeded → will run quali workflow")
                do_quali = True
            else:
                log("Quali window active but Q already seeded — skip")
        elif mode == 'quali':
            # Manual override — ignore time window
            log("Manual quali mode — ignoring time window")
            do_quali = True

    if mode in ('auto', 'race'):
        race_act_start = race_end + timedelta(minutes=RACE_GRACE_MIN)
        race_act_end   = race_end + timedelta(hours=RACE_WINDOW_H)
        if race_act_start <= now <= race_act_end:
            if race_needs_seeding(race.id):
                log(f"Race window active ({race_act_start.strftime('%H:%M')}–"
                    f"{race_act_end.strftime('%H:%M')} UTC) and laps not seeded → will run race workflow")
                do_race = True
            else:
                log("Race window active but laps already seeded — skip")
        elif mode == 'race':
            log("Manual race mode — ignoring time window")
            do_race = True

    if not do_quali and not do_race:
        log("Nothing to do right now — exiting.")
        return

    # ── Check FastF1 availability ─────────────────────────────────────────────

    if do_quali:
        if fastf1_has_quali_data(year, race.round):
            log("FastF1 quali data available ✓")
            success = run_quali_workflow(year, race)
            log("✅ Quali workflow done!" if success else "⚠ Quali workflow finished with errors")
        else:
            log("FastF1 quali data not ready yet — will retry next cron tick (15 min)")

    if do_race:
        if fastf1_has_race_data(year, race.round):
            log("FastF1 race data available ✓")
            success = run_race_workflow(year, race)
            log("✅ Race workflow done!" if success else "⚠ Race workflow finished with errors")
        else:
            log("FastF1 race data not ready yet — will retry next cron tick (15 min)")


if __name__ == '__main__':
    main()
