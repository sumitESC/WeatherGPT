"""
fetch_real_landsat_history.py
=============================
Fetch EVERY available Landsat scene (2000–2026) for all UP cities and extract
18 spectral / thermal features per scene.

Performance design:
  - 16 concurrent I/O threads (matches Ryzen 7 7435HS logical cores)
  - Monthly STAC discovery → per-scene processing (reduces API calls ~97%)
  - Resume capability via progress JSON — safe to stop & restart
  - Exponential-backoff retries on transient API errors
  - Memory-safe: one scene at a time, explicit cleanup

Output: data/real_historical_satellite_indices.csv
  One row per (city × scene date) with 18+ features.
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

# Geospatial
from pystac_client import Client
import planetary_computer
import stackstac

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION — Tune these for your hardware and needs
# ═══════════════════════════════════════════════════════════════════════════════
MAX_WORKERS       = 16      # Threads (I/O-bound, so 1 per logical core is ideal)
MAX_CLOUD_COVER   = 30      # Max cloud cover % to accept a scene
START_YEAR        = 2000
END_YEAR          = 2026
COLLECTION        = "landsat-c2-l2"
RETRY_COUNT       = 3       # Max retries per STAC query
RETRY_DELAY_BASE  = 5       # Seconds, doubles each retry
STAC_API_URL      = "https://planetarycomputer.microsoft.com/api/stac/v1"

# Bands to load from each scene
BANDS_REFLECTANCE = ["blue", "green", "red", "nir08", "swir16", "swir22"]
BAND_THERMAL      = "lwir11"
ALL_BANDS         = BANDS_REFLECTANCE + [BAND_THERMAL]

# LST scale/offset for Landsat Collection 2 Level-2
LST_SCALE  = 0.00341802
LST_OFFSET = 149.0

# CSV column order
CSV_COLUMNS = [
    "City", "Date", "Year", "Month", "Day",
    "NDVI", "NDBI", "NDWI", "NDMI", "SAVI", "EVI", "BSI", "UI", "MNDWI",
    "LST_Celsius", "Albedo",
    "Blue_Mean", "Green_Mean", "Red_Mean", "NIR_Mean", "SWIR1_Mean", "SWIR2_Mean",
    "Cloud_Cover", "Platform", "Scene_ID",
]

# ═══════════════════════════════════════════════════════════════════════════════
# Thread-safe globals
# ═══════════════════════════════════════════════════════════════════════════════
csv_lock      = threading.Lock()
progress_lock = threading.Lock()
counter_lock  = threading.Lock()

# Shared mutable counters (wrapped in list for thread-safe mutation)
_scenes_written = [0]
_tasks_done     = [0]


# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE COMPUTATION
# ═══════════════════════════════════════════════════════════════════════════════
def compute_all_indices(blue, green, red, nir, swir1, swir2, lwir):
    """
    Compute all 18 features from raw band arrays.

    Returns a dict of {feature_name: float_value_or_NaN}.
    All index arrays are masked to valid pixels (> 0) before averaging.
    """
    eps = 1e-10
    valid = (blue > 0) & (green > 0) & (red > 0) & (nir > 0) & (swir1 > 0) & (swir2 > 0)

    result = {}

    if not np.any(valid):
        # No valid pixels at all
        for key in ["NDVI", "NDBI", "NDWI", "NDMI", "SAVI", "EVI", "BSI",
                     "UI", "MNDWI", "Albedo",
                     "Blue_Mean", "Green_Mean", "Red_Mean", "NIR_Mean",
                     "SWIR1_Mean", "SWIR2_Mean"]:
            result[key] = float("nan")
        result["LST_Celsius"] = float("nan")
        return result

    # Masked arrays
    b  = blue[valid].astype(np.float64)
    g  = green[valid].astype(np.float64)
    r  = red[valid].astype(np.float64)
    n  = nir[valid].astype(np.float64)
    s1 = swir1[valid].astype(np.float64)
    s2 = swir2[valid].astype(np.float64)

    # --- Spectral Indices ---
    result["NDVI"] = round(float(np.nanmean((n - r) / (n + r + eps))), 4)
    result["NDBI"] = round(float(np.nanmean((s1 - n) / (s1 + n + eps))), 4)
    result["NDWI"] = round(float(np.nanmean((g - n) / (g + n + eps))), 4)
    result["NDMI"] = round(float(np.nanmean((n - s1) / (n + s1 + eps))), 4)

    # SAVI (Soil Adjusted Vegetation Index) — L=0.5
    result["SAVI"] = round(float(np.nanmean(
        1.5 * (n - r) / (n + r + 0.5 + eps)
    )), 4)

    # EVI (Enhanced Vegetation Index)
    evi_arr = 2.5 * (n - r) / (n + 6.0 * r - 7.5 * b + 1.0 + eps)
    evi_arr = np.clip(evi_arr, -1.0, 1.0)  # Bound to physical range
    result["EVI"] = round(float(np.nanmean(evi_arr)), 4)

    # BSI (Bare Soil Index)
    result["BSI"] = round(float(np.nanmean(
        ((s1 + r) - (n + b)) / ((s1 + r) + (n + b) + eps)
    )), 4)

    # UI (Urban Index) — uses SWIR2
    result["UI"] = round(float(np.nanmean((s2 - n) / (s2 + n + eps))), 4)

    # MNDWI (Modified NDWI — better for urban water)
    result["MNDWI"] = round(float(np.nanmean((g - s1) / (g + s1 + eps))), 4)

    # --- Albedo (Liang 2001 broadband approximation for Landsat) ---
    # Albedo ≈ 0.356*Blue + 0.130*Red + 0.373*NIR + 0.085*SWIR1 + 0.072*SWIR2 - 0.0018
    albedo_arr = 0.356 * b + 0.130 * r + 0.373 * n + 0.085 * s1 + 0.072 * s2 - 0.0018
    result["Albedo"] = round(float(np.nanmean(albedo_arr)), 4)

    # --- Raw Band Means ---
    result["Blue_Mean"]  = round(float(np.nanmean(b)), 4)
    result["Green_Mean"] = round(float(np.nanmean(g)), 4)
    result["Red_Mean"]   = round(float(np.nanmean(r)), 4)
    result["NIR_Mean"]   = round(float(np.nanmean(n)), 4)
    result["SWIR1_Mean"] = round(float(np.nanmean(s1)), 4)
    result["SWIR2_Mean"] = round(float(np.nanmean(s2)), 4)

    # --- Land Surface Temperature ---
    # stackstac auto-applies scale/offset from STAC raster:bands metadata,
    # so lwir11 values are typically already in Kelvin (~200-350 range).
    # If raw DN values (>1000), we apply the scale/offset manually.
    if lwir is not None:
        lwir_valid = lwir[valid].astype(np.float64)
        lwir_valid = lwir_valid[lwir_valid > 0]  # Filter zero/nodata
        if lwir_valid.size > 0:
            median_val = float(np.nanmedian(lwir_valid))
            if median_val > 1000:
                # Raw DN values — apply scale/offset
                lst_k = lwir_valid * LST_SCALE + LST_OFFSET
            else:
                # Already in Kelvin (stackstac auto-scaled)
                lst_k = lwir_valid
            lst_c = lst_k - 273.15
            # Sanity check: LST should be between -60 and +80 Celsius
            lst_c = lst_c[(lst_c > -60) & (lst_c < 80)]
            if lst_c.size > 0:
                result["LST_Celsius"] = round(float(np.nanmean(lst_c)), 2)
            else:
                result["LST_Celsius"] = float("nan")
        else:
            result["LST_Celsius"] = float("nan")
    else:
        result["LST_Celsius"] = float("nan")

    return result


# ═══════════════════════════════════════════════════════════════════════════════
# SCENE PROCESSING
# ═══════════════════════════════════════════════════════════════════════════════
def process_single_scene(item, city_name, lat, lon, buffer_deg, bbox):
    """
    Process one signed STAC item: load bands, compute indices, return a dict row.
    Returns None on failure.
    """
    try:
        # Get scene metadata
        props    = item.properties
        scene_id = item.id
        platform = props.get("platform", "unknown")
        cloud_cover = props.get("eo:cloud_cover", -1)
        scene_dt = props.get("datetime", "")
        if isinstance(scene_dt, str) and scene_dt:
            dt = datetime.fromisoformat(scene_dt.replace("Z", "+00:00"))
        else:
            dt = datetime.fromisoformat(str(scene_dt))
        date_str = dt.strftime("%Y-%m-%d")
        year, month, day = dt.year, dt.month, dt.day

        # Determine which bands are available for this platform
        available_assets = set(item.assets.keys())
        bands_to_load = [b for b in ALL_BANDS if b in available_assets]

        if not bands_to_load:
            return None

        # Stack the single scene
        stack = stackstac.stack(
            [item],
            assets=bands_to_load,
            bounds_latlon=bbox,
            resolution=30,
            epsg=32644,
        )

        # Squeeze time dimension (single scene)
        data = stack.isel(time=0).values  # shape: (bands, y, x)

        # Build band arrays
        def get_band(name):
            if name in bands_to_load:
                idx = bands_to_load.index(name)
                arr = data[idx]
                if arr is not None:
                    return np.nan_to_num(arr, nan=0.0).astype(np.float64)
            return np.zeros_like(data[0], dtype=np.float64)

        blue  = get_band("blue")
        green = get_band("green")
        red   = get_band("red")
        nir   = get_band("nir08")
        swir1 = get_band("swir16")
        swir2 = get_band("swir22")
        lwir  = get_band(BAND_THERMAL) if BAND_THERMAL in bands_to_load else None

        # Compute all indices
        indices = compute_all_indices(blue, green, red, nir, swir1, swir2, lwir)

        row = {
            "City": city_name,
            "Date": date_str,
            "Year": year,
            "Month": month,
            "Day": day,
            "Cloud_Cover": round(cloud_cover, 1) if cloud_cover >= 0 else "N/A",
            "Platform": platform,
            "Scene_ID": scene_id,
        }
        row.update(indices)

        # Explicit cleanup
        del data, stack, blue, green, red, nir, swir1, swir2, lwir
        gc.collect()

        return row

    except Exception as e:
        # Log but don't crash — return None so the caller skips this scene
        print(f"    [WARN] Scene processing error for {city_name}: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# MONTHLY DISCOVERY + PROCESSING
# ═══════════════════════════════════════════════════════════════════════════════
def discover_and_process_month(city_name, lat, lon, buffer_deg, year, month,
                                csv_output_path, progress, progress_path, total_tasks):
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
            # Open a fresh client per call (thread-safety)
            catalog = Client.open(STAC_API_URL)
            search = catalog.search(
                collections=[COLLECTION],
                bbox=bbox,
                datetime=date_range,
                query={"eo:cloud_cover": {"lt": MAX_CLOUD_COVER}},
            )
            items = list(search.items())
            break  # Success — exit retry loop

        except Exception as e:
            wait = RETRY_DELAY_BASE * (2 ** (attempt - 1))
            if attempt < RETRY_COUNT:
                print(f"    [RETRY {attempt}/{RETRY_COUNT}] {city_name} {year}-{month:02d}: {e} — waiting {wait}s")
                time.sleep(wait)
            else:
                print(f"    [FAIL] {city_name} {year}-{month:02d}: {e} after {RETRY_COUNT} retries")
                # Mark as completed so we don't retry infinitely on persistent errors
                _mark_done(task_key, progress, progress_path, total_tasks)
                return

    if not items:
        with counter_lock:
            _tasks_done[0] += 1
            done = _tasks_done[0]
        pct = (done / total_tasks) * 100
        # Don't print for no-data months to reduce noise — they're very common
        _save_progress(task_key, progress, progress_path)
        return

    # Sign all items for data access
    try:
        signed_items = [planetary_computer.sign(item) for item in items]
    except Exception as e:
        print(f"    [WARN] Signing failed for {city_name} {year}-{month:02d}: {e}")
        _mark_done(task_key, progress, progress_path, total_tasks)
        return

    # Process each scene individually
    for item in signed_items:
        row = process_single_scene(item, city_name, lat, lon, buffer_deg, bbox)
        if row is not None:
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
    print(f"  [{pct:5.1f}%] {city_name} {year}-{month:02d}: "
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
        # Save every 50 completions to reduce disk I/O
        if len(progress) % 50 == 0:
            _flush_progress(progress, progress_path)


def _flush_progress(progress, progress_path):
    """Write progress dict to JSON file."""
    try:
        with open(progress_path, "w", encoding="utf-8") as f:
            json.dump(list(progress.keys()), f)
    except Exception:
        pass  # Non-critical — worst case we re-process some months


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN ORCHESTRATOR
# ═══════════════════════════════════════════════════════════════════════════════
def fetch_real_landsat_history():
    """
    Main entry point. Discovers and processes every Landsat scene from
    START_YEAR to END_YEAR for all cities in the JSON file.
    """
    project_dir    = os.path.dirname(os.path.abspath(__file__))
    data_dir       = os.path.join(project_dir, "data")
    cities_path    = os.path.join(data_dir, "all_up_cities.json")
    csv_output_path = os.path.join(data_dir, "real_historical_satellite_indices.csv")
    progress_path  = os.path.join(data_dir, "fetch_progress.json")

    # Fallback city file
    if not os.path.exists(cities_path):
        cities_path = os.path.join(data_dir, "up_cities.json")

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
        # Ensure file exists for append
        if not os.path.exists(csv_output_path):
            with open(csv_output_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
                writer.writeheader()

    # ── Build task list ─────────────────────────────────────────────────────
    tasks = []
    for city in cities:
        name = city["name"]
        lat, lon = city["latitude"], city["longitude"]
        area_sqkm = city.get("total_area_sqkm", 100)
        radius_km = math.sqrt(area_sqkm) / 2.0
        buffer_deg = radius_km / 111.0

        for year in range(START_YEAR, END_YEAR + 1):
            for month in range(1, 13):
                # Skip future months
                now = datetime.now()
                if year > now.year or (year == now.year and month > now.month):
                    continue
                tasks.append((name, lat, lon, buffer_deg, year, month))

    total_tasks = len(tasks)
    already_done = sum(1 for t in tasks if f"{t[0]}|{t[4]}|{t[5]}" in progress)

    print(f"""
+======================================================================+
|           LANDSAT DAILY SCENE FETCHER - FULL EXTRACTION             |
+======================================================================+
|  Cities        : {len(cities):<5}                                          |
|  Year range    : {START_YEAR}-{END_YEAR}                                       |
|  Total tasks   : {total_tasks:<6} (city x month combinations)              |
|  Already done  : {already_done:<6} (from previous run)                     |
|  Remaining     : {total_tasks - already_done:<6}                                        |
|  Workers       : {MAX_WORKERS} threads (AMD Ryzen 7, I/O-bound)            |
|  Cloud filter  : <{MAX_CLOUD_COVER}%                                           |
|  Features      : 18 indices + metadata per scene                   |
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
            name, lat, lon, buffer_deg, year, month = task_args
            future = executor.submit(
                discover_and_process_month,
                name, lat, lon, buffer_deg, year, month,
                csv_output_path, progress, progress_path, total_tasks,
            )
            futures.append(future)

        # Wait for all futures; print any unexpected exceptions
        for future in concurrent.futures.as_completed(futures):
            try:
                future.result()
            except Exception as e:
                print(f"  [ERROR] Unhandled exception in worker: {e}")
                traceback.print_exc()

    # ── Final progress flush ────────────────────────────────────────────────
    _flush_progress(progress, progress_path)

    elapsed = time.time() - start_time
    hours   = int(elapsed // 3600)
    mins    = int((elapsed % 3600) // 60)
    secs    = int(elapsed % 60)

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
    fetch_real_landsat_history()
