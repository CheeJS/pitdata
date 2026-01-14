# F1 Insight - Strategy & Prediction Platform

A high-fidelity Formula 1 strategy simulation and community prediction engine. This platform provides advanced race strategy modeling, historical data analysis, and simulated telemetry replay functionality.

## Technology Stack

### Frontend
- **Framework**: React 18 (Vite)
- **Styling**: Tailwind CSS
- **Visualization**: Recharts, D3.js (via simple SVG maps)
- **State Management**: React Context & Hooks

### Backend
- **Server**: Python (Flask)
- **Database**: PostgreSQL (Production) / SQLite (Development)
- **ORM**: SQLAlchemy
- **Data Source**: FastF1 Library (Official F1 Live Timing Archives)

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Cloud**: AWS RDS (PostgreSQL)

## Key Features

### 1. Strategy Simulation
Physics-based modeling to simulate race outcomes based on tyre degradation, fuel load, and pit stop strategies.
- **Tyre Model**: 4th-order polynomial degradation curves based on Pirelli data.
- **Race Variables**: Stochastic traffic modeling and safety car probability injection.
- **Scenarios**: Compare 1-stop vs 2-stop strategies under various conditions.

### 2. Telemetry Analysis & Replay
- **Data Visualization**: Lap-by-lap comparison of Speed, Throttle, and Brake telemetry.
- **Race Replay**: Simulated "live" playback of historical races with synchronized track map and leaderboards.
- **2026 Regulations**: Support for projected 2026 car performance metrics.

### 3. Community Predictions
- **Voting System**: Aggregated community predictions for race winners and safety car probabilities.
- **Analysis**: Compare user predictions against statistical model outputs.

## Setup Instructions

### Prerequisites
- Python 3.9+
- Node.js 16+
- PostgreSQL (optional, defaults to SQLite if unconfigured)

### Local Development

1. **Backend Setup**
   ```bash
   cd backend
   python -m venv venv
   # Activate venv (Windows: venv\Scripts\activate, Mac/Linux: source venv/bin/activate)
   pip install -r requirements.txt
   python app.py
   ```

2. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Database Seeding**
   The application requires baseline data to function.
   ```bash
   cd backend
   python seed_history.py
   ```

### Docker Deployment

To run the full stack using Docker:

```bash
docker-compose up --build
```

## Project Structure

- `backend/`: Flask API, data processing scripts, and simulation logic.
- `frontend/`: React application, UI components, and visualization modules.
- `data_pipeline/`: Scripts for fetching and normalizing FastF1 data.

## Configuration

Environment variables can be set in a `.env` file or directly in the environment.

- `DATABASE_URL`: Connection string for PostgreSQL (e.g., `postgresql://user:pass@host:5432/db`).
- `FLASK_ENV`: Set to `development` or `production`.

## License

Proprietary software. All rights reserved.
