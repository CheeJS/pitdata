from flask import Flask, jsonify, request
from flask_cors import CORS
from services.f1_service import get_latest_race_results, run_monte_carlo_simulation, simulate_race_strategy

app = Flask(__name__)
CORS(app)

@app.route('/api/health')
def health_check():
    return jsonify({"status": "healthy", "service": "F1 Stats API"})

@app.route('/api/latest-results')
def latest_results():
    data = get_latest_race_results()
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
        return jsonify({"error": "Failed to fetch replay data"}), 404

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
    data = run_race_monte_carlo(race_code, num_sims, chaos)
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

# --- Crowd Prediction APIs ---
@app.route('/api/predictions/vote', methods=['POST'])
def submit_prediction():
    from services.voting_service import submit_vote
    data = request.json
    res = submit_vote(
        data.get('race_id'),
        data.get('client_id'),
        data.get('category'),
        data.get('value')
    )
    return jsonify(res)

@app.route('/api/predictions/stats')
def prediction_stats():
    from services.voting_service import get_vote_stats
    race_id = request.args.get('race_id')
    data = get_vote_stats(race_id)
    return jsonify(data)

if __name__ == '__main__':
    app.run(debug=True)

