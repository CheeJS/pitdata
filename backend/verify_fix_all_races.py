"""
Universal Race Timestamp Verification and Fix Script
Checks and fixes alignment between:
- Message timestamps
- Flag timestamps  
- Lap data timestamps
- Slider duration

For all races in 2024 and 2025.
"""
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))

from services.f1_service import get_db_session, RaceStatus, Race, Lap
from datetime import timedelta

def verify_and_fix_race(session, race, fix=True):
    """
    Verify and optionally fix timestamp alignment for a single race.
    Returns a dict with verification results.
    """
    result = {
        'race': race.race_name,
        'year': race.year,
        'has_lap_data': False,
        'has_messages': False,
        'lap1_start': None,
        'green_light_time': None,
        'drift': None,
        'fixed': False,
        'erroneous_flags_deleted': 0,
        'status': 'UNKNOWN'
    }
    
    try:
        # 1. Check for Lap Data
        lap1 = session.query(Lap).filter_by(race_id=race.id, lap_number=1).first()
        if not lap1:
            result['status'] = 'NO_LAP_DATA'
            return result
        
        result['has_lap_data'] = True
        lap1_start = lap1.cumulative_time - lap1.lap_time
        result['lap1_start'] = lap1_start
        
        # Get race end time
        max_lap_obj = session.query(Lap).filter_by(race_id=race.id).order_by(Lap.lap_number.desc()).first()
        if not max_lap_obj:
            result['status'] = 'NO_MAX_LAP'
            return result
        max_lap = max_lap_obj.lap_number
        last_laps = session.query(Lap).filter_by(race_id=race.id, lap_number=max_lap).all()
        race_end_time = max(l.cumulative_time for l in last_laps)
        
        # 2. Check for Messages/Flags
        events = session.query(RaceStatus).filter_by(race_id=race.id).order_by(RaceStatus.time).all()
        if not events:
            result['status'] = 'NO_MESSAGES'
            return result
        
        result['has_messages'] = True
        
        # 3. Find the Race Start GREEN LIGHT
        # Look for GREEN LIGHT after FORMATION LAP message (if exists)
        formation_msg = next((e for e in events if 'FORMATION LAP' in (e.status or '').upper()), None)
        if formation_msg:
            green_light = next((e for e in events if e.time > formation_msg.time and 'GREEN LIGHT' in (e.status or '').upper()), None)
        else:
            # Find any GREEN LIGHT - prefer ones with "PIT EXIT" to avoid false positives
            green_lights = [e for e in events if 'GREEN LIGHT' in (e.status or '').upper()]
            if len(green_lights) > 1:
                # If multiple, take the one closest to lap1_start
                green_light = min(green_lights, key=lambda e: abs(e.time - lap1_start))
            elif green_lights:
                green_light = green_lights[0]
            else:
                green_light = None
        
        if not green_light:
            # If no GREEN LIGHT, try to use first FLAG event near lap1_start
            flags_near_start = [e for e in events if e.category == 'FLAG' and abs(e.time - lap1_start) < 600]
            if flags_near_start:
                green_light = min(flags_near_start, key=lambda e: abs(e.time - lap1_start))
            else:
                result['status'] = 'NO_GREEN_LIGHT'
                return result
        
        result['green_light_time'] = green_light.time
        
        # 4. Calculate Drift
        drift = lap1_start - green_light.time
        result['drift'] = drift
        
        # 5. Check if alignment is needed (> 2 minutes drift)
        if abs(drift) < 120:
            result['status'] = 'ALIGNED'
            
            # Even if aligned, check for erroneous post-race flags
            if fix:
                deleted = cleanup_erroneous_flags(session, race.id, race_end_time, events)
                result['erroneous_flags_deleted'] = deleted
            
            return result
        
        # 6. Fix alignment if requested
        if fix:
            print(f"    Applying offset of {drift:.1f}s to {len(events)} events...")
            for e in events:
                e.time = e.time + drift
            session.commit()
            result['fixed'] = True
            
            # Also cleanup erroneous flags
            # Re-fetch events after shift
            events = session.query(RaceStatus).filter_by(race_id=race.id).order_by(RaceStatus.time).all()
            deleted = cleanup_erroneous_flags(session, race.id, race_end_time, events)
            result['erroneous_flags_deleted'] = deleted
        
        result['status'] = 'FIXED' if fix else 'NEEDS_FIX'
        return result
        
    except Exception as e:
        result['status'] = f'ERROR: {str(e)}'
        return result


def cleanup_erroneous_flags(session, race_id, race_end_time, events):
    """
    Remove FLAGS that appear after the race should have ended,
    or SC/RED flags in the final laps that don't match reality.
    """
    deleted = 0
    
    # Delete any events AFTER race end
    post_race = [e for e in events if e.time > race_end_time]
    for e in post_race:
        session.delete(e)
        deleted += 1
    
    # Check for suspicious SC/RED flags in final 10% of race
    race_duration = race_end_time - min(e.time for e in events) if events else 0
    late_race_threshold = race_end_time - (race_duration * 0.1)  # Last 10%
    
    # Find Chequered Flag
    chequered = next((e for e in events if 'CHEQUERED' in (e.status or '').upper()), None)
    if chequered:
        # Delete any SC/RED flags AFTER the Chequered Flag
        post_chequered_flags = [e for e in events if e.time > chequered.time and e.category == 'FLAG' and e.status in ['SC', 'RED', 'YELLOW']]
        for e in post_chequered_flags:
            session.delete(e)
            deleted += 1
    
    if deleted > 0:
        session.commit()
    
    return deleted


def verify_all_races(years=[2024, 2025], fix=True):
    """
    Verify and fix all races for the given years.
    """
    session = get_db_session()
    results = []
    
    try:
        for year in years:
            print(f"\n{'='*60}")
            print(f"VERIFYING {year} RACES")
            print(f"{'='*60}")
            
            races = session.query(Race).filter_by(year=year).order_by(Race.round).all()
            print(f"Found {len(races)} races.\n")
            
            for race in races:
                print(f"  [{race.round:02d}] {race.race_name}...")
                result = verify_and_fix_race(session, race, fix=fix)
                results.append(result)
                
                status_symbol = {
                    'ALIGNED': '✓',
                    'FIXED': '🔧',
                    'NEEDS_FIX': '⚠️',
                    'NO_LAP_DATA': '⏭',
                    'NO_MESSAGES': '📭',
                    'NO_GREEN_LIGHT': '🚦',
                }.get(result['status'], '❌')
                
                drift_str = f"drift={result['drift']:.1f}s" if result['drift'] is not None else "drift=N/A"
                flags_str = f"deleted {result['erroneous_flags_deleted']} bad flags" if result['erroneous_flags_deleted'] > 0 else ""
                
                print(f"       {status_symbol} {result['status']} ({drift_str}) {flags_str}")
        
        # Summary
        print(f"\n{'='*60}")
        print("SUMMARY")
        print(f"{'='*60}")
        
        aligned = sum(1 for r in results if r['status'] == 'ALIGNED')
        fixed = sum(1 for r in results if r['status'] == 'FIXED')
        no_data = sum(1 for r in results if r['status'] in ['NO_LAP_DATA', 'NO_MESSAGES'])
        errors = sum(1 for r in results if r['status'].startswith('ERROR'))
        total_flags_deleted = sum(r['erroneous_flags_deleted'] for r in results)
        
        print(f"  Already aligned: {aligned}")
        print(f"  Fixed: {fixed}")
        print(f"  No data (skipped): {no_data}")
        print(f"  Errors: {errors}")
        print(f"  Total erroneous flags deleted: {total_flags_deleted}")
        
    finally:
        session.close()
    
    return results


if __name__ == "__main__":
    verify_all_races(years=[2024, 2025], fix=True)
