# F1 Insight - Strategy & Prediction Engine

A high-fidelity Formula 1 strategy simulation and community prediction platform. This application combines granular race data with physics-based modeling to simulate race strategies, visualize tyre degradation, and aggregate community predictions.

## Tech Stack

### Frontend
- **Framework**: React 18 (Vite)
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Visualization**: Recharts
- **Icons**: Lucide React

### Backend
- **Server**: Python (Flask)
- **Database**: SQLite (SQLAlchemy ORM)
- **Data Processing**: Pandas, NumPy
- **F1 Data Integration**: FastF1 Library

## Key Features

1. **Race Strategy Simulations**:
   - Compares 1-stop vs 2-stop strategies.
   - Accounts for tyre degradation, fuel load, and pit loss.
   - Supports "what-if" scenarios (Safety Cars, Traffic, Grid Position).

2. **Grand Prix Predictions**:
   - Community voting system for Race Winner and Safety Car probability.
   - Visualization of community confidence vs AI models.
   - Demo mode for historical/portfolio exploration.

3. **Live Telemetry Replay (Simulated)**:
   - Visualization of lap telemetry (Speed, Throttle, Brake).
   - Track dominance and sector analysis.

## Mathematical Models

The core of the application relies on a deterministic physics model coupled with stochastic elements for race disruptions.

### 1. Tyre Degradation Model
Tyre performance is modeled using a non-linear degradation curve. As the tyre ages, performance drops not linearly, but accelerates as it approaches its "cliff" (end of life).

**Formula:**
Current Degradation = (Lap * Base Deg) * Degradation Curve
Degradation Curve = 1 + 0.5 * (Tyre Age / Tyre Life)^4

This 4th-order polynomial ensures that tyres remain relatively stable during their prime window but degrade rapidly once they pass their expected lifespan, mimicking real Pirelli tyre characteristics.

### 2. Fuel Correction
Standard F1 cars start heavy (110kg fuel) and get lighter. The model applies a generic fuel correction factor.

**Formula:**
Lap Time Gain = Lap Number * 0.06s

### 3. Traffic & Pit Loss
- **Traffic**: A stochastic model injects time penalties based on Grid Position. If a car starts P11+, traffic probability increases by 2% per position.
- **Pit Stops**:
  - Normal Pit Loss: Circuit-dependent (e.g., 22s at Monza).
  - Safety Car Pit Loss: Reduced to 55% of normal time, incentivizing "cheap" stops.

## Data Pipeline

1. **Extraction**: The ETL pipeline uses `FastF1` to fetch session data (Laps, Telemetry, Weather) from the official F1 Livetiming API archives.
2. **Transformation**: Data is normalized, sector times are calculated, and circuit geometry (X, Y coordinates) is simplified for web rendering.
3. **Loading**: Processed data is stored in a normalized SQLite Schema (`races`, `results`, `laps`, `telemetry`).

## Project Structure

/backend
  /services
    - f1_service.py: Core data retrieval and simulation logic.
    - voting_service.py: Prediction aggregation logic.
  - app.py: REST API entry point.

/frontend
  /src/pages
    - Predictions.jsx: Voting interface.
    - Simulations.jsx: Strategy dashboard.

## Setup Instructions

1. Install Python dependencies:
   pip install -r requirements.txt

2. Run Backend:
   python backend/app.py

3. Install Node dependencies:
   cd frontend
   npm install

4. Run Frontend:
   npm run dev
