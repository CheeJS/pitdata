from flask import Flask, jsonify, request
from flask.json.provider import DefaultJSONProvider
from flask_cors import CORS
from flask_caching import Cache
from services.f1_service import get_latest_race_results, run_monte_carlo_simulation, simulate_race_strategy
import json
import math
import os

# Custom JSON Provider to handle NaN/Infinity (which are invalid in JSON spec)
class SafeJSONProvider(DefaultJSONProvider):
    def dumps(self, obj, **kwargs):
        return json.dumps(self._sanitize(obj), **kwargs)
    
    def _sanitize(self, obj):
        if isinstance(obj, float):
            if math.isnan(obj) or math.isinf(obj):
                return None
            return obj
        elif isinstance(obj, dict):
            return {k: self._sanitize(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._sanitize(item) for item in obj]
        return obj

app = Flask(__name__)
app.json_provider_class = SafeJSONProvider
app.json = SafeJSONProvider(app)

# Cache Configuration (Simple In-Memory)
cache = Cache(config={'CACHE_TYPE': 'SimpleCache', 'CACHE_DEFAULT_TIMEOUT': 300})
cache.init_app(app)

# CORS Configuration: Allow specific origins in production, or all in development
cors_origins = os.getenv('CORS_ORIGINS', '*')  # Set CORS_ORIGINS=https://yourdomain.com in production
CORS(app, origins=cors_origins.split(',') if cors_origins != '*' else '*')

@app.route('/api/health')
def health_check():
    return jsonify({"status": "healthy", "service": "F1 Stats API"})

@app.route('/api/latest-results')
@cache.cached(timeout=60) # Cache for 1 minute
def latest_results():
    from services.f1_service import get_dashboard_data
    year = request.args.get('year', 2026, type=int) 
    data = get_dashboard_data(year)
    if data:
        return jsonify(data)
    else:
        return jsonify({"error": "Failed to fetch data"}), 500

@app.route('/api/results/<int:race_id>')
def race_results_detail(race_id):
    from services.f1_service import get_race_results_by_id
    data = get_race_results_by_id(race_id)
    if data:
        return jsonify(data)
    else:
        return jsonify({"error": "Results not found"}), 404

@app.route('/api/replay/<int:race_id>')
def race_replay(race_id):
    from services.f1_service import get_race_replay
    data = get_race_replay(race_id)
    if data:
        return jsonify(data)
    else:
        # Return 200 with error code to prevent browser console generated 404 errors for expected missing data
        return jsonify({"error": "Failed to fetch replay data", "code": "NO_DATA"}), 200

@app.route('/api/telemetry/<int:race_id>')
def race_telemetry(race_id):
    from flask import request
    from services.f1_service import get_telemetry
    driver = request.args.get('driver')
    data = get_telemetry(race_id, driver)
    if data:
        return jsonify(data)
    else:
        return jsonify({"error": "Failed to fetch telemetry"}), 404

@app.route('/api/races')
@cache.cached(timeout=300, query_string=True) # Cache for 5 mins, distinct by query params (year)
def get_races():
    from services.f1_service import get_races_list
    from flask import request
    year = request.args.get('year') # Optional
    if year: year = int(year)
    
    races = get_races_list(year=year)
    return jsonify(races)

@app.route('/api/analysis/compare')
def compare_analysis():
    from flask import request
    from services.f1_service import get_analysis_data
    
    race_id = request.args.get('raceId')
    d1 = request.args.get('driver1')
    d2 = request.args.get('driver2')
    lap1 = request.args.get('lap1')
    lap2 = request.args.get('lap2')
    
    if not race_id or not d1 or not d2:
        return jsonify({"error": "Missing parameters"}), 400
        
    data = get_analysis_data(int(race_id), d1, d2, lap1, lap2)
    if data:
        return jsonify(data)
    else:
        return jsonify({"error": "Analysis failed"}), 500

@app.route('/api/laps')
def get_laps():
    from flask import request
    from services.f1_service import get_driver_laps
    
    race_id = request.args.get('raceId')
    driver = request.args.get('driverId')
    
    if not race_id or not driver:
        return jsonify({"error": "Missing parameters"}), 400
        
    data = get_driver_laps(int(race_id), driver)
    return jsonify(data)

@app.route('/api/standings', methods=['GET'])
@cache.cached(timeout=300, query_string=True) # Cache for 5 mins
def standings():
    from services.f1_service import get_season_standings
    year = request.args.get('year', 2024)
    data = get_season_standings(int(year))
    if "error" in data:
        return jsonify(data), 404
    return jsonify(data)




@app.route('/api/simulations/monte-carlo')
def monte_carlo_simulation():
    year = request.args.get('year', 2025, type=int)
    sims = request.args.get('sims', 5000, type=int)
    chaos = request.args.get('chaos', 1.0, type=float)
    reliability = request.args.get('reliability', 0.95, type=float)
    
    # Parse mods: ?mods={"VER":1.5}
    import json
    mods_str = request.args.get('mods', '{}')
    try:
        driver_mods = json.loads(mods_str)
    except:
        driver_mods = {}

    data = run_monte_carlo_simulation(year, sims, chaos, driver_mods, reliability)
    return jsonify(data)

@app.route('/api/simulations/strategy')
def strategy_sim():
    laps = int(request.args.get('laps', 50))
    race_id = request.args.get('race_id', 'abu').lower()
    traffic = request.args.get('traffic', 'false').lower() == 'true'
    deg = float(request.args.get('deg', 1.0))
    
    # New Context
    grid_pos = int(request.args.get('grid_pos', 1))
    weather = request.args.get('weather', 'Dry')
    objective = request.args.get('objective', 'Minimise Time')
    
    # Parse Safety Car List (e.g. "12,35")
    sc_laps_str = request.args.get('sc_laps', '')
    sc_laps = [int(x) for x in sc_laps_str.split(',')] if sc_laps_str and sc_laps_str != 'null' else []

    # Run Simulation
    result = simulate_race_strategy(race_id=race_id, race_laps=laps, traffic=traffic, deg_multiplier=deg, safety_car_laps=sc_laps, grid_pos=grid_pos, weather=weather, objective=objective)
    return jsonify(result)

@app.route('/api/simulations/championship')
def championship_calc():
    from services.f1_service import get_championship_scenarios
    year = request.args.get('year', 2025, type=int)
    data = get_championship_scenarios(year)
    if "error" in data:
        return jsonify(data), 500
    return jsonify(data)

@app.route('/api/simulations/race-monte-carlo')
def race_monte_carlo():
    from services.f1_service import run_race_monte_carlo
    race_code = request.args.get('race', 'AUS')
    num_sims = request.args.get('sims', 1000, type=int)
    chaos = request.args.get('chaos', 1.0, type=float)
    year = request.args.get('year', None, type=int)
    lookback = request.args.get('lookback', 2, type=int)
    data = run_race_monte_carlo(race_code, num_sims, chaos, year, lookback)
    if "error" in data:
        return jsonify(data), 500
    return jsonify(data)

@app.route('/api/race-control/<int:race_id>')
def race_control_feed(race_id):
    from services.f1_service import get_race_control_messages
    data = get_race_control_messages(race_id)
    if "error" in data:
         return jsonify(data), 500
    return jsonify(data)


@app.route('/api/drivers')
@cache.cached(timeout=3600, query_string=True) # Cache for 1 hour (drivers don't change often)
def get_active_season_drivers():
    from services.f1_service import get_active_drivers
    year = request.args.get('year', 2026, type=int)
    drivers = get_active_drivers(year)
    return jsonify(drivers)

# --- Crowd Prediction APIs ---
@app.route('/api/predictions/vote', methods=['POST'])
def submit_prediction():
    from services.voting_service import submit_vote
    data = request.json
    
    # New Payload: { race_id, client_id, payload: { ... } }
    # Or flattened? Frontend sends:
    # { race_id, client_id, category: "winner", value: { ... } } -> Old way
    # New plan says: send full state.
    # Let's standardize on:
    # { race_id, client_id, data: { podium: ..., gap: ... } }
    # And store this whole object in 'value'. Category can be 'full_prediction'
    
    race_id = data.get('race_id')
    client_id = data.get('client_id')
    # If frontend sends "value" directly
    payload = data.get('value') or data.get('payload') or data
    
    res = submit_vote(
        race_id,
        client_id,
        "full_prediction", # Unified category
        payload
    )
    return jsonify(res)

@app.route('/api/predictions/stats')
def prediction_stats():
    from services.voting_service import get_vote_stats
    race_id = request.args.get('race_id')
    data = get_vote_stats(race_id)
    data = get_vote_stats(race_id)
    return jsonify(data)

@app.route('/api/predictions/comments', methods=['GET'])
def prediction_comments():
    from services.voting_service import get_comments
    race_id = request.args.get('race_id')
    data = get_comments(race_id)
    return jsonify(data)

@app.route('/api/predictions/comments', methods=['POST'])
def post_prediction_comment():
    from services.voting_service import post_comment
    data = request.json
    res = post_comment(
        data.get('race_id'),
        data.get('client_id'),
        data.get('nickname'),
        data.get('content')
    )
    return jsonify(res)


# --- AI PREDICTIONS ENDPOINT ---
@app.route('/api/predictions/ai')
def ai_prediction():
    try:
        from services.ml_service import predict_race
        race_code = request.args.get('race', 'AUS')
        year = request.args.get('year', None, type=int)
        data = predict_race(race_code, year)
        if "error" in data:
            return jsonify(data), 500
        return jsonify(data)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# --- PADDOCK (REDDIT-STYLE) ENDPOINTS ---
@app.route('/api/paddock/threads', methods=['GET'])
def paddock_threads():
    from services.paddock_service import get_threads
    return jsonify(get_threads())

@app.route('/api/paddock/threads', methods=['POST'])
def paddock_create_thread():
    from services.paddock_service import create_thread
    data = request.json
    res = create_thread(
        data.get('client_id'),
        data.get('nickname'),
        data.get('title'),
        data.get('content'),
        data.get('category')
    )
    return jsonify(res)

@app.route('/api/paddock/threads/<int:thread_id>', methods=['GET'])
def paddock_thread_detail(thread_id):
    from services.paddock_service import get_thread_detail
    viewer_id = request.args.get('client_id')
    res = get_thread_detail(thread_id, viewer_id)
    if not res: return jsonify({"error": "Thread not found"}), 404
    return jsonify(res)

@app.route('/api/paddock/threads/<int:thread_id>/comments', methods=['POST'])
def paddock_post_comment(thread_id):
    from services.paddock_service import post_comment
    data = request.json
    res = post_comment(
        thread_id,
        data.get('client_id'),
        data.get('nickname'),
        data.get('content')
    )
    return jsonify(res)

@app.route('/api/paddock/vote', methods=['POST'])
def paddock_vote():
    from services.paddock_service import cast_vote
    data = request.json
    res = cast_vote(
        data.get('client_id'),
        data.get('item_type'),
        data.get('item_id'),
        data.get('direction')
    )
    return jsonify(res)

if __name__ == '__main__':
    # Use FLASK_DEBUG=true in development, defaults to False for production
    debug_mode = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    app.run(debug=debug_mode)

