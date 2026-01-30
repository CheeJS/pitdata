#!/bin/bash
set -e

# Flexible entrypoint for F1 Backend
# Supports running the Flask app (default) or executing seeding scripts

if [ "$1" = "seed" ]; then
    # Run seeding script with year argument
    YEAR=${2:-2025}
    echo "Running seed_year_data.py for year $YEAR..."
    exec python seed_year_data.py "$YEAR"
elif [ "$1" = "seed-history" ]; then
    # Run historical data seeding
    echo "Running seed_history.py..."
    exec python seed_history.py "${@:2}"
elif [ "$1" = "seed-qualifying" ]; then
    # Run qualifying seeding
    echo "Running seed_qualifying.py..."
    exec python seed_qualifying.py "${@:2}"
elif [ "$1" = "python" ]; then
    # Allow arbitrary Python scripts
    exec "$@"
else
    # Default: Run the Flask app with gunicorn
    echo "Starting Flask application with gunicorn..."
    exec gunicorn -w 4 -b 0.0.0.0:5000 app:app
fi
