import pandas as pd
import requests
import time
import os
from datetime import datetime, timedelta

def main():
    csv_file = "data/processed/india_regional_weather.csv"
    print(f"Loading {csv_file}...")
    df = pd.read_csv(csv_file)
    df['Date'] = pd.to_datetime(df['Date'])
    
    max_date = df['Date'].max()
    start_date = (max_date + timedelta(days=1)).strftime('%Y-%m-%d')
    end_date = datetime.now().strftime('%Y-%m-%d')
    
    if start_date > end_date:
        print("Data is already up to date.")
        return
        
    print(f"Fetching data from {start_date} to {end_date}...")
    
    base_url = "https://archive-api.open-meteo.com/v1/archive"
    cities = df[['City']].drop_duplicates()
    
    # Needs lat/lon, let's get it from all_up_cities.json
    import json
    with open("data/all_up_cities.json", "r") as f:
        city_data = json.load(f)
        
    city_map = {}
    for c in city_data.get("cities", []) + city_data.get("all_75_districts", []):
        city_map[c["name"]] = {"lat": c["latitude"], "lon": c["longitude"]}
        
    daily_vars = [
        "temperature_2m_max", "temperature_2m_min", "temperature_2m_mean",
        "apparent_temperature_max", "apparent_temperature_min",
        "precipitation_sum", "rain_sum", "wind_speed_10m_max",
        "wind_gusts_10m_max", "wind_direction_10m_dominant",
        "shortwave_radiation_sum", "et0_fao_evapotranspiration",
        "relative_humidity_2m_mean", "relative_humidity_2m_max", "relative_humidity_2m_min",
        "dew_point_2m_mean", "pressure_msl_mean",
        "soil_temperature_0_to_7cm_mean", "soil_moisture_0_to_7cm_mean"
    ]
    
    new_rows = []
    
    for city in cities['City']:
        if city not in city_map:
            continue
            
        lat, lon = city_map[city]['lat'], city_map[city]['lon']
        
        params = {
            "latitude": lat,
            "longitude": lon,
            "start_date": start_date,
            "end_date": end_date,
            "daily": ",".join(daily_vars),
            "timezone": "Asia/Kolkata",
        }
        
        while True:
            try:
                resp = requests.get(base_url, params=params, timeout=30)
                if resp.status_code == 429:
                    time.sleep(5)
                    continue
                resp.raise_for_status()
                data = resp.json()
                break
            except Exception as e:
                print(f"Error {city}: {e}")
                time.sleep(2)
                continue
                
        daily = data.get("daily", {})
        times = daily.get("time", [])
        
        for i, date_str in enumerate(times):
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            row = [city, date_str, dt.year, dt.month, dt.day]
            for var in daily_vars:
                val = daily.get(var, [None] * len(times))
                row.append(val[i] if i < len(val) else None)
            new_rows.append(row)
            
        print(f"Fetched {city} ({len(times)} days)")
        time.sleep(1)
        
    if new_rows:
        cols = [
            "City", "Date", "Year", "Month", "Day",
            "Temp_Max_C", "Temp_Min_C", "Temp_Mean_C",
            "Apparent_Temp_Max_C", "Apparent_Temp_Min_C",
            "Precipitation_mm", "Rain_mm",
            "Wind_Speed_Max_kmh", "Wind_Gusts_Max_kmh", "Wind_Direction_Dominant_deg",
            "Shortwave_Radiation_MJm2", "ET0_Evapotranspiration_mm",
            "Humidity_Mean_pct", "Humidity_Max_pct", "Humidity_Min_pct",
            "Dew_Point_Mean_C", "Pressure_MSL_hPa",
            "Soil_Temp_0_7cm_C", "Soil_Moisture_0_7cm_m3m3"
        ]
        new_df = pd.DataFrame(new_rows, columns=cols)
        new_df['Date'] = pd.to_datetime(new_df['Date'])
        
        # Concat and deduplicate
        full_df = pd.concat([df, new_df])
        full_df = full_df.drop_duplicates(subset=["City", "Date"], keep="last")
        full_df.sort_values(by=["City", "Date"], inplace=True)
        
        full_df['Date'] = full_df['Date'].dt.strftime('%Y-%m-%d')
        full_df.to_csv(csv_file, index=False)
        print(f"Updated {csv_file} with {len(new_rows)} new records.")

if __name__ == "__main__":
    main()
