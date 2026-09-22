"""
==========================================================================
  INDIA REGIONAL WEATHER DATASET FETCHER
  Source: Open-Meteo Historical Weather API (ERA5 reanalysis)
  No API key required | Free for non-commercial use
==========================================================================

Fetches daily weather data for all 75 UP cities (2000-2026).
Uses BULK mode: 1 API request per city for the FULL date range.
This means only ~75 requests total instead of ~2,025.

Output: data/india_regional_weather.csv
"""

import json
import csv
import os
import time
import requests
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

# ── Configuration ──────────────────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
CITIES_FILE = os.path.join(DATA_DIR, "all_up_cities.json")
OUTPUT_CSV = os.path.join(DATA_DIR, "india_regional_weather.csv")
PROGRESS_FILE = os.path.join(DATA_DIR, "weather_fetch_progress.json")

BASE_URL = "https://archive-api.open-meteo.com/v1/archive"

START_DATE = "2000-01-01"
END_DATE = datetime.now().strftime("%Y-%m-%d")

# Daily weather variables to fetch
DAILY_VARS = [
    "temperature_2m_max",
    "temperature_2m_min",
    "temperature_2m_mean",
    "apparent_temperature_max",
    "apparent_temperature_min",
    "precipitation_sum",
    "rain_sum",
    "wind_speed_10m_max",
    "wind_gusts_10m_max",
    "wind_direction_10m_dominant",
    "shortwave_radiation_sum",
    "et0_fao_evapotranspiration",
    "relative_humidity_2m_mean",
    "relative_humidity_2m_max",
    "relative_humidity_2m_min",
    "dew_point_2m_mean",
    "pressure_msl_mean",
    "soil_temperature_0_to_7cm_mean",
    "soil_moisture_0_to_7cm_mean",
]

# CSV column names (more readable)
CSV_COLUMNS = [
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

# Concurrency: very conservative to avoid aggressive rate limits
MAX_WORKERS = 1
REQUEST_DELAY = 3.0  # seconds between requests per thread

# ── Globals ────────────────────────────────────────────────────────────
csv_lock = threading.Lock()
progress_lock = threading.Lock()
total_rows_written = 0
tasks_completed = 0


def load_cities():
    """Load city names + coordinates from all_up_cities.json."""
    with open(CITIES_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    cities = []
    for city in data["cities"]:
        cities.append({
            "name": city["name"],
            "lat": city["latitude"],
            "lon": city["longitude"],
        })

    # Also include cities from all_75_districts if present
    if "all_75_districts" in data:
        existing_names = {c["name"] for c in cities}
        for city in data["all_75_districts"]:
            if city["name"] not in existing_names:
                cities.append({
                    "name": city["name"],
                    "lat": city["latitude"],
                    "lon": city["longitude"],
                })

    return cities


def load_progress():
    """Load progress from previous run."""
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, "r") as f:
            return json.load(f)
    return {"completed_cities": []}


def save_progress(progress):
    """Save progress to disk."""
    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress, f)


def fetch_city_bulk(city_name, lat, lon):
    """
    Fetch daily weather data for ONE city across the ENTIRE date range
    (2000-01-01 to today) in a SINGLE API request.

    Open-Meteo supports large date ranges — no need to split by year.
    """
    global total_rows_written, tasks_completed

    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": START_DATE,
        "end_date": END_DATE,
        "daily": ",".join(DAILY_VARS),
        "timezone": "Asia/Kolkata",
    }

    data = None
    attempt = 0
    while True:
        try:
            time.sleep(REQUEST_DELAY)
            resp = requests.get(BASE_URL, params=params, timeout=120)

            if resp.status_code == 429:
                # Rate limited — exponential backoff (cap at ~240s)
                wait = 15 * (2 ** min(attempt, 4))
                print(f"  [RATE LIMITED] {city_name} — waiting {wait}s (attempt {attempt+1})...")
                time.sleep(wait)
                attempt += 1
                continue

            resp.raise_for_status()
            data = resp.json()
            break
        except requests.exceptions.Timeout:
            wait = 10 * min(attempt + 1, 12) # Cap at 120s
            print(f"  [TIMEOUT] {city_name} — retrying in {wait}s (attempt {attempt+1})...")
            time.sleep(wait)
            attempt += 1
            continue
        except Exception as e:
            wait = 10 * min(attempt + 1, 12) # Cap at 120s
            print(f"  [ERROR] {city_name}: {e} — retrying in {wait}s...")
            time.sleep(wait)
            attempt += 1
            continue

    # Parse the response
    daily = data.get("daily", {})
    times = daily.get("time", [])

    if not times:
        print(f"  [WARN] {city_name}: no data returned")
        return 0

    rows = []
    for i, date_str in enumerate(times):
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        row = [
            city_name,
            date_str,
            dt.year,
            dt.month,
            dt.day,
        ]
        # Add all weather variables in order
        for var in DAILY_VARS:
            val = daily.get(var, [None] * len(times))
            row.append(val[i] if i < len(val) else None)
        rows.append(row)

    # Write to CSV
    with csv_lock:
        with open(OUTPUT_CSV, "a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerows(rows)
        total_rows_written += len(rows)

    tasks_completed += 1
    return len(rows)


def main():
    global total_rows_written, tasks_completed

    print("+" + "=" * 70 + "+")
    print("|" + " INDIA REGIONAL WEATHER DATASET FETCHER".center(70) + "|")
    print("|" + " Open-Meteo Historical API (ERA5 Reanalysis)".center(70) + "|")
    print("|" + " BULK MODE: 1 request per city, full date range".center(70) + "|")
    print("+" + "=" * 70 + "+")

    # Load cities
    cities = load_cities()
    print(f"|  Cities         : {len(cities)}")
    print(f"|  Date range     : {START_DATE} -> {END_DATE}")

    # Load progress — migrate from old format if needed
    progress = load_progress()

    # Handle migration from old per-year format
    if "completed" in progress and "completed_cities" not in progress:
        # Old format had "completed": ["Agra_2005", "Agra_2002", ...]
        # We need to start fresh with the new bulk approach
        progress = {"completed_cities": []}
        print("|  Note: migrated from per-year to bulk mode (starting fresh)")

    completed_set = set(progress.get("completed_cities", []))

    # Build task list: one per city
    remaining_cities = []
    for city in cities:
        if city["name"] not in completed_set:
            remaining_cities.append(city)

    total_cities = len(cities)
    already_done = total_cities - len(remaining_cities)

    print(f"|  Total cities   : {total_cities}")
    print(f"|  Already done   : {already_done}")
    print(f"|  Remaining      : {len(remaining_cities)}")
    print(f"|  API requests   : ~{len(remaining_cities)} (1 per city)")
    print(f"|  Workers        : {MAX_WORKERS} threads")
    print(f"|  Weather vars   : {len(DAILY_VARS)}")
    print("+" + "=" * 70 + "+")

    if not remaining_cities:
        print("\n  All cities already completed!")
        return

    # Initialize CSV if needed
    if not os.path.exists(OUTPUT_CSV) or already_done == 0:
        with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(CSV_COLUMNS)
        print("  CSV initialized with headers.")

    start_time = time.time()

    # Run tasks with thread pool
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {}
        for city in remaining_cities:
            future = executor.submit(
                fetch_city_bulk,
                city["name"], city["lat"], city["lon"]
            )
            futures[future] = city["name"]

        for future in as_completed(futures):
            city_name = futures[future]
            try:
                row_count = future.result()

                if row_count > 0:
                    # Save progress
                    with progress_lock:
                        progress.setdefault("completed_cities", []).append(city_name)
                        save_progress(progress)

                pct = (already_done + tasks_completed) / total_cities * 100
                elapsed = time.time() - start_time
                elapsed_str = time.strftime("%H:%M:%S", time.gmtime(elapsed))

                expected_days = row_count  # ~9,600 days for 26+ years
                print(
                    f"  [{pct:5.1f}%] ✓ {city_name}: "
                    f"{row_count:,} days | "
                    f"Total rows: {total_rows_written:,} | "
                    f"Cities: {already_done + tasks_completed}/{total_cities} | "
                    f"Elapsed: {elapsed_str}"
                )
            except Exception as e:
                print(f"  [ERROR] {city_name}: {e}")

    # Final progress save
    save_progress(progress)

    elapsed = time.time() - start_time
    elapsed_str = time.strftime("%Hh %Mm %Ss", time.gmtime(elapsed))

    print("+" + "=" * 70 + "+")
    print("|" + " COMPLETE".center(70) + "|")
    print("+" + "=" * 70 + "+")
    print(f"|  Total rows written : {total_rows_written:,}")
    print(f"|  Total time         : {elapsed_str}")
    print(f"|  Output file        : {OUTPUT_CSV}")
    print("+" + "=" * 70 + "+")


if __name__ == "__main__":
    main()
