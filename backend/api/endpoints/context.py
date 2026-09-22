from fastapi import APIRouter, HTTPException
import pandas as pd
import config
from api.schemas import ContextResponse
from data.weather_db import query_context_weather

router = APIRouter()

@router.get("/india", response_model=ContextResponse)
async def get_india_context(date: str):
    """
    Get the context signals from sentinel cities across India for a given date.
    """
    try:
        date_df = query_context_weather(start_date=date, end_date=date)
        if date_df.empty:
            # Fallback: query any recent context records
            date_df = query_context_weather(limit_days=30)
            
        if date_df.empty:
            raise ValueError(f"No context data found for date '{date}'.")
            
        date_df['Date'] = date_df['Date'].dt.strftime('%Y-%m-%d')
        date_df = date_df.where(pd.notnull(date_df), None)
        
        context_signals = {}
        for _, row in date_df.iterrows():
            city = row.get('City', f"city_{_}")
            row_dict = row.to_dict()
            context_signals[city] = row_dict
            
        return ContextResponse(
            date=date,
            sentinel_cities_analyzed=len(context_signals),
            context_signals=context_signals
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{city}")
async def get_city_context(city: str, date: str = None):
    """
    Get context signals for a specific city or sentinel region.
    """
    target_date = date or "2026-05-15"
    try:
        date_df = query_context_weather(start_date=target_date, end_date=target_date)
        if date_df.empty:
            date_df = query_context_weather(limit_days=30)
            
        if date_df.empty:
            return {"city": city, "date": target_date, "sentinel_cities_analyzed": 0, "context_signals": {}}
            
        date_df['Date'] = date_df['Date'].dt.strftime('%Y-%m-%d')
        date_df = date_df.where(pd.notnull(date_df), None)
        
        context_signals = {}
        for _, row in date_df.iterrows():
            c_name = row.get('City', f"city_{_}")
            context_signals[c_name] = row.to_dict()
            
        return {
            "city": city,
            "date": target_date,
            "sentinel_cities_analyzed": len(context_signals),
            "context_signals": context_signals
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


