from pydantic import BaseModel
from typing import List, Optional

class DailyForecast(BaseModel):
    date: str
    Temp_Max_C: float
    Temp_Min_C: float
    Precipitation_mm: float
    Humidity_Mean_pct: float
    Wind_Speed_Max_kmh: float
    Pressure_MSL_hPa: float
    Shortwave_Radiation_MJm2: float
    heat_risk_score: Optional[float] = None
    heat_zone: Optional[str] = None
    primary_driver: Optional[str] = None

class ForecastResponse(BaseModel):
    city: str
    forecast_horizon: int
    predictions: List[DailyForecast]
    warnings: List[str] = []

class HistoryResponse(BaseModel):
    city: str
    start_date: str
    end_date: str
    data: List[dict]

class ContextResponse(BaseModel):
    date: str
    sentinel_cities_analyzed: int
    context_signals: dict
