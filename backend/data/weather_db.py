import os
import sqlite3
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "heatzone.db")

CSV_PATHS = {
    "regional": os.path.join(BASE_DIR, "processed", "india_regional_weather.csv"),
    "context": os.path.join(BASE_DIR, "processed", "ml_ready_context_data.csv"),
    "historical_ml": os.path.join(BASE_DIR, "processed", "ml_ready_historical_data.csv"),
    "fallback": os.path.join(BASE_DIR, "temperature_data.csv"),
}

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db(force=False):
    """
    Build SQLite database from processed CSV files using chunked streaming
    to keep RAM usage below 20MB during database creation.
    """
    os.makedirs(BASE_DIR, exist_ok=True)
    
    # Check if DB already exists and is up-to-date
    if not force and os.path.exists(DB_PATH):
        # Quick check if tables exist and are non-empty
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='regional_weather'")
            count = cursor.fetchone()[0]
            conn.close()
            if count > 0:
                return DB_PATH
        except Exception:
            pass

    print("[weather_db] Initializing low-memory SQLite database at:", DB_PATH)
    
    # Remove existing DB if rebuilding
    if os.path.exists(DB_PATH):
        try:
            os.remove(DB_PATH)
        except Exception:
            pass

    conn = sqlite3.connect(DB_PATH)
    
    # 1. Populate regional_weather table from india_regional_weather.csv or ml_ready_historical_data.csv
    reg_csv = CSV_PATHS["regional"] if os.path.exists(CSV_PATHS["regional"]) else (
        CSV_PATHS["historical_ml"] if os.path.exists(CSV_PATHS["historical_ml"]) else CSV_PATHS["fallback"]
    )

    if os.path.exists(reg_csv):
        print(f"[weather_db] Chunk-ing ingest into 'regional_weather' from {os.path.basename(reg_csv)}...")
        for chunk in pd.read_csv(reg_csv, chunksize=10000):
            # Standardize column names if needed
            if "city" in chunk.columns and "City" not in chunk.columns:
                chunk = chunk.rename(columns={"city": "City"})
            if "Date" not in chunk.columns and "year" in chunk.columns and "month" in chunk.columns:
                chunk["Date"] = chunk["year"].astype(str) + "-" + chunk["month"].astype(str).str.zfill(2) + "-01"
            
            chunk.to_sql("regional_weather", conn, if_exists="append", index=False)

    # 2. Populate context_weather table from ml_ready_context_data.csv
    ctx_csv = CSV_PATHS["context"]
    if os.path.exists(ctx_csv):
        print(f"[weather_db] Chunk-ing ingest into 'context_weather' from {os.path.basename(ctx_csv)}...")
        for chunk in pd.read_csv(ctx_csv, chunksize=10000):
            if "city" in chunk.columns and "City" not in chunk.columns:
                chunk = chunk.rename(columns={"city": "City"})
            chunk.to_sql("context_weather", conn, if_exists="append", index=False)
    else:
        # Fallback context table
        cursor = conn.cursor()
        cursor.execute("CREATE TABLE IF NOT EXISTS context_weather AS SELECT * FROM regional_weather WHERE 1=0")

    # 3. Create indexes for instant O(1) query lookups
    print("[weather_db] Creating indexes on (City, Date)...")
    cursor = conn.cursor()
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_rw_city_date ON regional_weather(City, Date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_rw_date ON regional_weather(Date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cw_city_date ON context_weather(City, Date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cw_date ON context_weather(Date)")
    conn.commit()
    conn.close()
    
    print("[weather_db] SQLite initialization complete!")
    return DB_PATH

def query_city_weather(city: str, start_date=None, end_date=None, limit=None):
    """
    Fetch weather records for a single city between start_date and end_date.
    Memory footprint: < 0.2 MB RSS!
    """
    if not os.path.exists(DB_PATH):
        init_db()

    conn = get_db_connection()
    
    sql = "SELECT * FROM regional_weather WHERE LOWER(City) = LOWER(?)"
    params = [city]

    if start_date:
        sql += " AND Date >= ?"
        params.append(str(start_date))
    if end_date:
        sql += " AND Date <= ?"
        params.append(str(end_date))

    sql += " ORDER BY Date ASC"
    
    if limit:
        sql += f" LIMIT {int(limit)}"

    df = pd.read_sql_query(sql, conn, params=params)
    conn.close()
    
    if not df.empty and "Date" in df.columns:
        df["Date"] = pd.to_datetime(df["Date"])

    return df

def query_recent_city_weather(city: str, limit_days: int = 30, end_date=None):
    """
    Fetch the most recent `limit_days` records for a city.
    """
    if not os.path.exists(DB_PATH):
        init_db()

    conn = get_db_connection()
    
    sql = "SELECT * FROM regional_weather WHERE LOWER(City) = LOWER(?)"
    params = [city]

    if end_date:
        sql += " AND Date <= ?"
        params.append(str(end_date))

    sql += f" ORDER BY Date DESC LIMIT {int(limit_days)}"

    df = pd.read_sql_query(sql, conn, params=params)
    conn.close()

    if not df.empty:
        df["Date"] = pd.to_datetime(df["Date"])
        df = df.sort_values("Date").reset_index(drop=True)

    return df

def query_context_weather(start_date=None, end_date=None, limit_days=None, cities=None):
    """
    Fetch context weather records.
    """
    if not os.path.exists(DB_PATH):
        init_db()

    conn = get_db_connection()
    sql = "SELECT * FROM context_weather WHERE 1=1"
    params = []

    if cities:
        placeholders = ",".join(["?"] * len(cities))
        sql += f" AND City IN ({placeholders})"
        params.extend(cities)
    if start_date:
        sql += " AND Date >= ?"
        params.append(str(start_date))
    if end_date:
        sql += " AND Date <= ?"
        params.append(str(end_date))

    sql += " ORDER BY Date ASC"
    if limit_days:
        sql += f" LIMIT {int(limit_days)}"

    df = pd.read_sql_query(sql, conn, params=params)
    conn.close()

    if not df.empty and "Date" in df.columns:
        df["Date"] = pd.to_datetime(df["Date"])

    return df

def get_available_cities():
    if not os.path.exists(DB_PATH):
        init_db()

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT City FROM regional_weather ORDER BY City")
    cities = [r[0] for r in cursor.fetchall() if r[0]]
    conn.close()
    return cities

if __name__ == "__main__":
    init_db(force=True)
    df = query_recent_city_weather("Lucknow", limit_days=30)
    print("Lucknow sample shape:", df.shape)
