from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from api.services.sat_model_service import run_satellite_analysis

router = APIRouter()


class SatelliteForecastDay(BaseModel):
    date: str
    temp_max_c: Optional[float] = None
    temp_min_c: Optional[float] = None
    feels_like_c: Optional[float] = None
    heatwave_alert: str = "GREEN"
    heatwave_message: str = ""
    precipitation_probability_pct: float = 0
    precipitation_mm: float = 0
    wind_speed_kmh: Optional[float] = None
    wind_direction: str = "VAR"
    humidity_pct: Optional[float] = None
    pressure_hpa: Optional[float] = None
    sky_condition: str = "Unknown"
    radiation_mjm2: float = 0


class SatelliteAnalysisResponse(BaseModel):
    city: str
    state: str
    timestamp_ist: str
    base_date: str
    forecast_horizon_hours: int
    upstream_corridor_analysis: Dict[str, Any]
    local_diagnostics: Dict[str, Any]
    forecast_matrix: List[SatelliteForecastDay]
    meteorological_summary: Dict[str, str]


@router.get("/{city}", response_model=SatelliteAnalysisResponse)
async def get_satellite_forecast(city: str, horizon: int = 72):
    """
    🛰️ HeatZone-Vision: Full satellite meteorological analysis for a UP city.

    Executes a 3-stage pipeline:
    1. Upstream corridor analysis (LOO, Western Disturbance, Monsoon, Bay Depression)
    2. Local satellite index diagnostics (NDVI, NDBI, NDWI, Albedo, etc.)
    3. AI forecast with heatwave index and precipitation probability

    Usage: GET /api/v1/sat_model/{city}?horizon=72
    """
    try:
        result = run_satellite_analysis(city, horizon_hours=horizon)
        return SatelliteAnalysisResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Satellite analysis error: {str(e)}")


@router.get("/{city}/report", response_class=PlainTextResponse)
async def get_satellite_report(city: str, horizon: int = 72):
    """
    🛰️ HeatZone-Vision: Returns the full satellite analysis as structured Markdown.

    Usage: GET /api/v1/sat_model/{city}/report
    This is the --satellite--city command equivalent.
    """
    try:
        result = run_satellite_analysis(city, horizon_hours=horizon)
        report = _format_markdown_report(result)
        return PlainTextResponse(content=report, media_type="text/markdown")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Satellite analysis error: {str(e)}")


def _format_markdown_report(data: dict) -> str:
    """Format the analysis result as the structured Markdown report."""
    city = data["city"]
    state = data["state"]
    ts = data["timestamp_ist"]
    base_date = data["base_date"]

    lines = []
    lines.append(f"### 🛰️ Satellite Meteorological Analysis: {city}, {state}")
    lines.append(f"**Timestamp:** {ts}")
    lines.append(f"**Base Data Date:** {base_date}")
    lines.append(f"**Forecast Horizon:** {data['forecast_horizon_hours']}h")
    lines.append("")
    lines.append("---")
    lines.append("")

    # ── Section 1: Upstream Driver Assessment ──
    lines.append("#### 1. Upstream Driver Assessment (Regional Advection)")
    lines.append("")

    upstream = data.get("upstream_corridor_analysis", {})
    for evt_id, evt_data in upstream.items():
        if not isinstance(evt_data, dict):
            continue
        label = evt_data.get("label", evt_id)
        corridor = evt_data.get("corridor", "")
        strength = evt_data.get("signal_strength", "unknown")
        status = evt_data.get("status", "NO_DATA")

        strength_emoji = {"EXTREME": "🔴", "strong": "🟠", "moderate": "🟡", "weak": "🟢"}.get(strength, "⚪")

        lines.append(f"**{strength_emoji} {label}** ({status})")
        lines.append(f"- **Corridor:** {corridor}")
        lines.append(f"- **Signal Strength:** {strength.upper()}")

        if status == "ACTIVE":
            lead_time = evt_data.get("lead_time_days", "")
            lines.append(f"- **Lead Time:** {lead_time}")

            signals = evt_data.get("key_signals", {})
            if signals:
                sig_str = ", ".join(f"{k}: {v}" for k, v in signals.items())
                lines.append(f"- **Key Readings:** {sig_str}")

            trends = evt_data.get("trends", {})
            if trends:
                trend_str = ", ".join(f"{k}: {'+' if v > 0 else ''}{v}" for k, v in trends.items())
                lines.append(f"- **2-Day Trend:** {trend_str}")

            sat_idx = evt_data.get("satellite_indices", {})
            if sat_idx:
                sat_str = ", ".join(f"{k}: {v}" for k, v in sat_idx.items())
                lines.append(f"- **Satellite Indices:** {sat_str}")

            per_city = evt_data.get("per_city", {})
            if per_city:
                city_strs = []
                for c_name, c_data in per_city.items():
                    vals = ", ".join(f"{k}={v}" for k, v in c_data.items())
                    city_strs.append(f"{c_name} ({vals})")
                lines.append(f"- **Stations:** {'; '.join(city_strs)}")

        lines.append("")

    lines.append("---")
    lines.append("")

    # ── Section 2: Local Satellite Diagnostics ──
    lines.append("#### 2. Local Satellite & Feature Diagnostics")
    lines.append("")

    local = data.get("local_diagnostics", {})

    thermal = local.get("thermal_profile", {})
    if thermal:
        lines.append("**Surface Thermal Profile (LST):**")
        if "current_max_temp" in thermal:
            lines.append(f"- Current Max: {thermal['current_max_temp']}°C")
        if "current_min_temp" in thermal:
            lines.append(f"- Current Min: {thermal['current_min_temp']}°C")
        if "feels_like_max" in thermal:
            lines.append(f"- Feels-Like Max: {thermal['feels_like_max']}°C")
        if "soil_surface_temp" in thermal:
            lines.append(f"- Soil Surface: {thermal['soil_surface_temp']}°C")
        if "7day_trend_max" in thermal:
            trend_val = thermal["7day_trend_max"]
            lines.append(f"- 7-Day Max Trend: {'+' if trend_val > 0 else ''}{trend_val}°C")
        if "7day_avg_max" in thermal:
            lines.append(f"- 7-Day Avg Max: {thermal['7day_avg_max']}°C")
        lines.append("")

    sat_interp = local.get("satellite_interpretation", {})
    if sat_interp:
        lines.append("**Satellite Index Interpretation:**")
        for category, desc in sat_interp.items():
            lines.append(f"- **{category.title()}:** {desc}")
        lines.append("")

    cloud = local.get("cloud_moisture_profile", {})
    if cloud:
        lines.append("**Cloud & Moisture Profile:**")
        if "humidity_pct" in cloud:
            lines.append(f"- Relative Humidity: {cloud['humidity_pct']}%")
        if "dew_point_c" in cloud:
            lines.append(f"- Dew Point: {cloud['dew_point_c']}°C")
        if "soil_moisture" in cloud:
            lines.append(f"- Soil Moisture: {cloud['soil_moisture']} m³/m³")
        if "cloud_cover_pct" in cloud:
            lines.append(f"- Cloud Cover: {cloud['cloud_cover_pct']}%")
        lines.append("")

    corr = local.get("correlated_weather", {})
    if corr:
        lines.append("**Correlated Local CSV Metrics:**")
        for k, v in corr.items():
            lines.append(f"- {k}: {v}")
        lines.append("")

    lines.append("---")
    lines.append("")

    # ── Section 3: Forecast Matrix ──
    lines.append("#### 3. Forecast & Prediction Matrix")
    lines.append("")

    fm = data.get("forecast_matrix", [])
    if fm:
        # Table header
        lines.append("| Date | Max/Min °C | Feels-Like | Alert | Precip % | Wind | Sky |")
        lines.append("| :--- | :--- | :--- | :--- | :--- | :--- | :--- |")

        alert_emoji = {"RED": "🔴", "ORANGE": "🟠", "YELLOW": "🟡", "GREEN": "🟢"}

        for f in fm:
            date = f.get("date", "")
            temp_str = f"{f.get('temp_max_c', '--')} / {f.get('temp_min_c', '--')}"
            feels = f.get("feels_like_c", "--")
            alert = f.get("heatwave_alert", "GREEN")
            alert_str = f"{alert_emoji.get(alert, '')} {alert}"
            precip = f.get("precipitation_probability_pct", 0)
            wind = f"{f.get('wind_speed_kmh', '--')} km/h {f.get('wind_direction', '')}"
            sky = f.get("sky_condition", "--")

            lines.append(f"| {date} | {temp_str} | {feels} | {alert_str} | {precip}% | {wind} | {sky} |")

        lines.append("")

    lines.append("---")
    lines.append("")

    # ── Section 4: Summary & Advisory ──
    lines.append("#### 4. Meteorological Summary & Advisory")
    lines.append("")

    summary = data.get("meteorological_summary", {})
    key_driver = summary.get("key_driver", "")
    advisory = summary.get("public_advisory", "")

    lines.append(f"> **Key Driver:** {key_driver}")
    lines.append(f">")
    lines.append(f"> **Public / Heat Action Advisory:** {advisory}")
    lines.append("")

    return "\n".join(lines)
