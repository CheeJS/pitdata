"""
Seed historical weather data for F1 races using Open-Meteo API.
Run: python seed_weather.py
"""

import os
import sys
import requests
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, Column, Integer, Float, String, ForeignKey
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from services.f1_service import Base, Race, get_db_engine

# Circuit coordinates (lat, lon)
CIRCUIT_COORDS = {
    # 2024-2025 calendar circuits
    "Bahrain": (26.0325, 50.5106),
    "Saudi Arabia": (21.6319, 39.1044),
    "Jeddah": (21.6319, 39.1044),
    "Australia": (-37.8497, 144.968),
    "Melbourne": (-37.8497, 144.968),
    "Japan": (34.8431, 136.5407),
    "Suzuka": (34.8431, 136.5407),
    "China": (31.3389, 121.2197),
    "Shanghai": (31.3389, 121.2197),
    "Miami": (25.9581, -80.2389),
    "Emilia Romagna": (44.3439, 11.7167),
    "Imola": (44.3439, 11.7167),
    "Monaco": (43.7347, 7.4206),
    "Canada": (45.5017, -73.5228),
    "Montreal": (45.5017, -73.5228),
    "Spain": (41.57, 2.2611),
    "Barcelona": (41.57, 2.2611),
    "Austria": (47.2197, 14.7647),
    "Spielberg": (47.2197, 14.7647),
    "Great Britain": (52.0786, -1.0169),
    "Silverstone": (52.0786, -1.0169),
    "Hungary": (47.5789, 19.2486),
    "Budapest": (47.5789, 19.2486),
    "Belgium": (50.4372, 5.9714),
    "Spa": (50.4372, 5.9714),
    "Netherlands": (52.3888, 4.5409),
    "Zandvoort": (52.3888, 4.5409),
    "Italy": (45.6156, 9.2811),
    "Monza": (45.6156, 9.2811),
    "Azerbaijan": (40.3725, 49.8533),
    "Baku": (40.3725, 49.8533),
    "Singapore": (1.2914, 103.8644),
    "United States": (30.1328, -97.6411),
    "Austin": (30.1328, -97.6411),
    "Mexico": (19.4042, -99.0907),
    "Brazil": (-23.7036, -46.6997),
    "Interlagos": (-23.7036, -46.6997),
    "Las Vegas": (36.1147, -115.1728),
    "Qatar": (25.49, 51.4542),
    "Lusail": (25.49, 51.4542),
    "Abu Dhabi": (24.4672, 54.6031),
    "Yas Marina": (24.4672, 54.6031),
}


class RaceWeather(Base):
    """Weather data for each race."""
    __tablename__ = 'race_weather'
    
    id = Column(Integer, primary_key=True)
    race_id = Column(Integer, ForeignKey('races.id'), unique=True)
    temperature = Column(Float)  # Celsius
    precipitation = Column(Float)  # mm
    conditions = Column(String)  # "Dry", "Wet", "Mixed"


def get_coords_for_race(race_name):
    """Find coordinates for a race by matching name."""
    race_name_lower = race_name.lower()
    for name, coords in CIRCUIT_COORDS.items():
        if name.lower() in race_name_lower or race_name_lower in name.lower():
            return coords
    return None


def fetch_weather(lat, lon, date):
    """Fetch weather from Open-Meteo for a specific date."""
    date_str = date.strftime("%Y-%m-%d")
    
    url = (
        f"https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={lat}&longitude={lon}"
        f"&start_date={date_str}&end_date={date_str}"
        f"&hourly=temperature_2m,precipitation"
    )
    
    try:
        resp = requests.get(url, timeout=10)
        data = resp.json()
        
        if 'hourly' not in data:
            return None
        
        temps = data['hourly'].get('temperature_2m', [])
        precip = data['hourly'].get('precipitation', [])
        
        # Average temperature (race hours 14:00-16:00 local is indices 14-16)
        race_temps = temps[12:18] if len(temps) >= 18 else temps
        avg_temp = sum(race_temps) / len(race_temps) if race_temps else 25
        
        # Total precipitation during race hours
        race_precip = precip[12:18] if len(precip) >= 18 else precip
        total_precip = sum(race_precip) if race_precip else 0
        
        # Determine conditions
        if total_precip > 5:
            conditions = "Wet"
        elif total_precip > 0.5:
            conditions = "Mixed"
        else:
            conditions = "Dry"
        
        return {
            'temperature': round(avg_temp, 1),
            'precipitation': round(total_precip, 1),
            'conditions': conditions
        }
    except Exception as e:
        print(f"      Weather API error: {e}")
        return None


def seed_weather():
    """Seed weather data for all races."""
    engine = get_db_engine()
    
    # Create table if not exists
    RaceWeather.__table__.create(engine, checkfirst=True)
    
    Session = sessionmaker(bind=engine)
    session = Session()
    
    print("="*60)
    print("SEEDING WEATHER DATA")
    print("="*60)
    
    # Get all races
    races = session.query(Race).filter(Race.year >= 2022).order_by(Race.year, Race.round).all()
    
    seeded = 0
    skipped = 0
    
    for race in races:
        # Check if already exists
        existing = session.query(RaceWeather).filter(RaceWeather.race_id == race.id).first()
        if existing:
            skipped += 1
            continue
        
        coords = get_coords_for_race(race.race_name or race.circuit_name or "")
        
        if not coords:
            print(f"  [SKIP] {race.year} {race.race_name} - No coordinates")
            skipped += 1
            continue
        
        if not race.date:
            print(f"  [SKIP] {race.year} {race.race_name} - No date")
            skipped += 1
            continue
        
        weather = fetch_weather(coords[0], coords[1], race.date)
        
        if weather:
            rw = RaceWeather(
                race_id=race.id,
                temperature=weather['temperature'],
                precipitation=weather['precipitation'],
                conditions=weather['conditions']
            )
            session.add(rw)
            session.commit()
            seeded += 1
            print(f"  [OK] {race.year} R{race.round} {race.race_name}: {weather['conditions']} ({weather['temperature']}°C, {weather['precipitation']}mm)")
        else:
            skipped += 1
    
    session.close()
    
    print(f"\nSeeded: {seeded}, Skipped: {skipped}")
    print("="*60)


if __name__ == "__main__":
    seed_weather()
