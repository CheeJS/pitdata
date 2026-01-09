import requests
import json

response = requests.get('http://localhost:5000/api/races?year=2025')
data = response.json()

for race in data:
    print(f"{race['name']}: code='{race['code']}'")
