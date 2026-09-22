import os
import sys
import json
import time
import gc

# Prevent OpenMP deadlocks & multi-thread RAM explosion between PyTorch and XGBoost
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"

try:
    import torch
    torch.set_num_threads(1)
except ImportError:
    pass

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from api.services.ensemble_runner import generate_ensemble_forecast
from api.services.heatscore_service import predict_heatscores

def generate_all():
    data_path = os.path.join(os.path.dirname(__file__), "data", "all_up_cities.json")
    with open(data_path, "r") as f:
        cities_data = json.load(f)
    
    cities = cities_data.get("cities", [])
    print(f"Loaded {len(cities)} cities from config.")
    
    all_results = []
    output_dir = os.path.join(os.path.dirname(__file__), "data")
    os.makedirs(output_dir, exist_ok=True)
    out_path = os.path.join(output_dir, "all_cities_heatscore_forecast.json")
    
    for i, city_obj in enumerate(cities):
        city_name = city_obj["name"]
        print(f"\n[{i+1}/{len(cities)}] Processing {city_name}...")
        
        try:
            # 1. Get predicted forecast data (using ENSEMBLE model)
            forecast_res = generate_ensemble_forecast(city_name)
            predictions = forecast_res.get("predictions", [])
            base_date = forecast_res.get("base_date", "")
            
            # 2. Calculate Heatscore using the predicted forecast
            predictions_with_scores = predict_heatscores(city_name, predictions)
            
            # Save results for this city
            city_result = {
                "city": city_name,
                "base_date": base_date,
                "forecast": predictions_with_scores
            }
            all_results.append(city_result)
            
            # Quick summary of Day 1
            if predictions_with_scores:
                day1 = predictions_with_scores[0]
                print(f"  Day 1 -> Temp: {day1.get('Temp_Max_C', 0):.1f}°C | Risk Score: {day1.get('heat_risk_score', 0):.0f}/100 | Zone: {day1.get('heat_zone', 'N/A').upper()} | Driver: {day1.get('primary_driver', 'N/A')}")
                
            del forecast_res, predictions, predictions_with_scores
        except Exception as e:
            print(f"Failed processing {city_name}: {e}")
            
        gc.collect()

    # Save the consolidated JSON file
    with open(out_path, "w") as f:
        json.dump(all_results, f, indent=4)
        
    print(f"\nSuccessfully generated and saved forecast & heatscores for {len(all_results)} cities!")
    print(f"Saved to: {out_path}")

if __name__ == "__main__":
    generate_all()

