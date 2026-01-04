
import sys
import os

# Ensure backend directory is in path
sys.path.append(os.path.join(os.getcwd(), 'backend'))
# Also add current dir if we run from top
sys.path.append(os.getcwd())

try:
    from backend.services.f1_service import run_monte_carlo_simulation
    print("Calling run_monte_carlo_simulation...")
    result = run_monte_carlo_simulation(year=2025, n_sims=100, chaos_factor=1.0, reliability=0.95)
    print("Result:", result)
except Exception as e:
    import traceback
    traceback.print_exc()
