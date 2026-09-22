"""
fetch_india_context_satellite.py
=================================
Fetch Landsat scenes (2000-2026) for India's strategic sentinel cities
and extract the SAME 18 spectral/thermal features as the UP dataset.

These ~28 cities capture major weather corridors influencing UP:
  [MONSOON] Monsoon corridor     (Kerala -> Maharashtra -> MP -> UP)
  [HEAT] Heat wave corridor   (Thar desert -> Rajasthan -> UP)
  [WD] Western disturbances (J&K -> Punjab -> Uttarakhand -> UP)
  [BAY] Bay of Bengal        (Odisha -> WB -> Bihar -> eastern UP)

Reuses ALL processing logic from fetch_real_landsat_history.py -- only
the city source, output file, and progress file differ.

Output: data/india_context_satellite_indices.csv
"""

import os
import json
import csv
import math
import time
import gc
import traceback
import numpy as np
from datetime import datetime
import calendar
import concurrent.futures
import threading

# Reuse all the heavy lifting from the existing UP fetcher
from fetch_real_landsat_history import (
    compute_all_indices,
    process_single_scene,
    MAX_CLOUD_COVER,
    START_YEAR,
    END_YEAR,
    COLLECTION,
    RETRY_COUNT,
    RETRY_DELAY_BASE,
    STAC_API_URL,
    CSV_COLUMNS as UP_CSV_COLUMNS,
)

from pystac_client import Client
import planetary_computer

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION — Same tuning as UP fetcher
# ═══════════════════════════════════════════════════════════════════════════════
MAX_WORKERS = 16  # Threads (I/O-bound)

# Extended CSV columns with State and Zone for India-wide context
CSV_COLUMNS = [
    "City", "State", "Climate_Event", "Date", "Year", "Month", "Day",
    "NDVI", "NDBI", "NDWI", "NDMI", "SAVI", "EVI", "BSI", "UI", "MNDWI",
    "LST_Celsius", "Albedo",
    "Blue_Mean", "Green_Mean", "Red_Mean", "NIR_Mean", "SWIR1_Mean", "SWIR2_Mean",
    "Cloud_Cover", "Platform", "Scene_ID",
]

# ═══════════════════════════════════════════════════════════════════════════════
# Thread-safe globals
# ═══════════════════════════════════════════════════════════════════════════════
csv_lock = threading.Lock()
progress_lock = threading.Lock()
counter_lock = threading.Lock()

_scenes_written = [0]
_tasks_done = [0]


# ═══════════════════════════════════════════════════════════════════════════════
# MONTHLY DISCOVERY + PROCESSING (adapted for India context)
# ═══════════════════════════════════════════════════════════════════════════════
def discover_and_process_month(city_name, state, climate_event, lat, lon, buffer_deg,
                                year, month, csv_output_path, progress,
                                progress_path, total_tasks):
    """
    Query STAC for all scenes in one month for one city, process each scene
    individually, and write rows to CSV.
    """
    task_key = f"{city_name}|{year}|{month}"

    # Skip if already completed (resume support)
    with progress_lock:
        if task_key in progress:
            with counter_lock:
                _tasks_done[0] += 1
            return

    bbox = [lon - buffer_deg, lat - buffer_deg, lon + buffer_deg, lat + buffer_deg]
    last_day = calendar.monthrange(year, month)[1]
    date_range = f"{year}-{month:02d}-01/{year}-{month:02d}-{last_day}"

    rows_to_write = []

    for attempt in range(1, RETRY_COUNT + 1):
        try:
            catalog = Client.open(STAC_API_URL)
            search = catalog.search(
                collections=[COLLECTION],
                bbox=bbox,
                datetime=date_range,
                query={"eo:cloud_cover": {"lt": MAX_CLOUD_COVER}},
            )
            items = list(search.items())
            break
        except Exception as e:
            wait = RETRY_DELAY_BASE * (2 ** (attempt - 1))
            if attempt < RETRY_COUNT:
                print(f"    [RETRY {attempt}/{RETRY_COUNT}] {city_name} {year}-{month:02d}: {e} — waiting {wait}s")
                time.sleep(wait)
            else:
                print(f"    [FAIL] {city_name} {year}-{month:02d}: {e} after {RETRY_COUNT} retries")
                _mark_done(task_key, progress, progress_path, total_tasks)
                return

    if not items:
        with counter_lock:
            _tasks_done[0] += 1
            done = _tasks_done[0]
        _save_progress(task_key, progress, progress_path)
        return

    # Sign all items for data access
    try:
        signed_items = [planetary_computer.sign(item) for item in items]
    except Exception as e:
        print(f"    [WARN] Signing failed for {city_name} {year}-{month:02d}: {e}")
        _mark_done(task_key, progress, progress_path, total_tasks)
        return

    # Process each scene individually (reuses process_single_scene from UP fetcher)
    for item in signed_items:
        row = process_single_scene(item, city_name, lat, lon, buffer_deg, bbox)
        if row is not None:
            # Add State and Zone columns
            row["State"] = state
            row["Climate_Event"] = climate_event
            rows_to_write.append(row)

    # Write all rows for this month atomically
    if rows_to_write:
        with csv_lock:
            with open(csv_output_path, "a", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
                for row in rows_to_write:
                    writer.writerow(row)
        with counter_lock:
            _scenes_written[0] += len(rows_to_write)

    _mark_done(task_key, progress, progress_path, total_tasks)

    # Log with progress
    with counter_lock:
        done = _tasks_done[0]
        scenes = _scenes_written[0]
    pct = (done / total_tasks) * 100 if total_tasks > 0 else 100
    print(f"  [{pct:5.1f}%] {city_name} ({state}) {year}-{month:02d}: "
          f"{len(rows_to_write)} scenes | Total scenes: {scenes} | "
          f"Tasks: {done}/{total_tasks}")


def _mark_done(task_key, progress, progress_path, total_tasks):
    """Thread-safe: mark task as done in progress dict and increment counter."""
    _save_progress(task_key, progress, progress_path)
    with counter_lock:
        _tasks_done[0] += 1


def _save_progress(task_key, progress, progress_path):
    """Thread-safe: save progress to disk."""
    with progress_lock:
        progress[task_key] = True
        if len(progress) % 50 == 0:
            _flush_progress(progress, progress_path)


def _flush_progress(progress, progress_path):
    """Write progress dict to JSON file."""
    try:
        with open(progress_path, "w", encoding="utf-8") as f:
            json.dump(list(progress.keys()), f)
    except Exception:
        pass


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════
def main():
    project_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(project_dir, "data")
    cities_path = os.path.join(data_dir, "india_context_cities.json")
    csv_output_path = os.path.join(data_dir, "india_context_satellite_indices.csv")
    progress_path = os.path.join(data_dir, "india_context_satellite_progress.json")

    with open(cities_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    cities = data["cities"]

    # ── Load resume progress ────────────────────────────────────────────────
    progress = {}
    if os.path.exists(progress_path):
        try:
            with open(progress_path, "r", encoding="utf-8") as f:
                done_keys = json.load(f)
                progress = {k: True for k in done_keys}
            print(f">> Resuming -- {len(progress)} tasks already completed.")
        except Exception:
            progress = {}

    # ── Initialize CSV (only if starting fresh) ─────────────────────────────
    if not progress:
        with open(csv_output_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
            writer.writeheader()
        print(">> Starting fresh -- CSV initialized with headers.")
    else:
        if not os.path.exists(csv_output_path):
            with open(csv_output_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
                writer.writeheader()

    # ── Build task list ─────────────────────────────────────────────────────
    tasks = []
    for city in cities:
        name = city["name"]
        state = city.get("state", "Unknown")
        climate_event = city.get("climate_event", "unknown")
        lat, lon = city["latitude"], city["longitude"]
        area_sqkm = city.get("total_area_sqkm", 150)
        radius_km = math.sqrt(area_sqkm) / 2.0
        buffer_deg = radius_km / 111.0

        for year in range(START_YEAR, END_YEAR + 1):
            for month in range(1, 13):
                now = datetime.now()
                if year > now.year or (year == now.year and month > now.month):
                    continue
                tasks.append((name, state, climate_event, lat, lon, buffer_deg, year, month))

    total_tasks = len(tasks)
    already_done = sum(1 for t in tasks if f"{t[0]}|{t[6]}|{t[7]}" in progress)

    # Climate event breakdown
    event_counts = {}
    for city in cities:
        e = city.get("climate_event", "unknown")
        event_counts[e] = event_counts.get(e, 0) + 1

    print(f"""
+======================================================================+
|      INDIA CONTEXT SATELLITE FETCHER - LANDSAT SCENE EXTRACTION     |
|              Strategic Sentinel Cities for UP Climate               |
+======================================================================+
|  Cities        : {len(cities):<5}                                          |
|  Events        : {', '.join(f'{k}({v})' for k,v in sorted(event_counts.items()))} |
|  Year range    : {START_YEAR}-{END_YEAR}                                       |
|  Total tasks   : {total_tasks:<6} (city x month combinations)              |
|  Already done  : {already_done:<6} (from previous run)                     |
|  Remaining     : {total_tasks - already_done:<6}                                        |
|  Workers       : {MAX_WORKERS} threads (I/O-bound)                          |
|  Cloud filter  : <{MAX_CLOUD_COVER}%                                           |
|  Features      : 18 indices + State/Zone metadata per scene         |
|  Output        : {os.path.basename(csv_output_path):<40}       |
+======================================================================+
""")

    # Reset counters
    _scenes_written[0] = 0
    _tasks_done[0] = 0

    start_time = time.time()

    # ── Execute with thread pool ────────────────────────────────────────────
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = []
        for task_args in tasks:
            name, state, climate_event, lat, lon, buffer_deg, year, month = task_args
            future = executor.submit(
                discover_and_process_month,
                name, state, climate_event, lat, lon, buffer_deg, year, month,
                csv_output_path, progress, progress_path, total_tasks,
            )
            futures.append(future)

        for future in concurrent.futures.as_completed(futures):
            try:
                future.result()
            except Exception as e:
                print(f"  [ERROR] Unhandled exception in worker: {e}")
                traceback.print_exc()

    # ── Final progress flush ────────────────────────────────────────────────
    _flush_progress(progress, progress_path)

    elapsed = time.time() - start_time
    hours = int(elapsed // 3600)
    mins = int((elapsed % 3600) // 60)
    secs = int(elapsed % 60)

    print(f"""
+======================================================================+
|                         COMPLETE                                   |
+======================================================================+
|  Total scenes written : {_scenes_written[0]:<8}                                |
|  Total time           : {hours}h {mins}m {secs}s                                |
|  Output file          : {os.path.basename(csv_output_path):<40}       |
+======================================================================+
""")


if __name__ == "__main__":
    main()
