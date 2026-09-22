from fastapi import APIRouter, HTTPException
import pandas as pd
import config
from api.schemas import HistoryResponse
from data.weather_db import query_city_weather

router = APIRouter()

@router.get("/{city}", response_model=HistoryResponse)
async def get_historical_weather(city: str, start_date: str, end_date: str):
    """
    Get historical weather data for a city.
    """
    try:
        filtered_df = query_city_weather(city, start_date=start_date, end_date=end_date)
        if filtered_df.empty:
            raise ValueError(f"No historical data found for city '{city}' between {start_date} and {end_date}.")
            
        filtered_df['Date'] = filtered_df['Date'].dt.strftime('%Y-%m-%d')
        filtered_df = filtered_df.where(pd.notnull(filtered_df), None)
        
        data = filtered_df.to_dict(orient='records')
        
        return HistoryResponse(
            city=city,
            start_date=start_date,
            end_date=end_date,
            data=data
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

