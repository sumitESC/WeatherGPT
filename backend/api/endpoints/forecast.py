from fastapi import APIRouter, HTTPException
from api.schemas import ForecastResponse
from api.services import model_runner
from api.services.heatscore_service import predict_heatscores

router = APIRouter()

@router.get("/{city}", response_model=ForecastResponse)
async def get_forecast(city: str):
    """
    Get a 16-day weather forecast for a specific city.
    This triggers the AI model (LSTM + XGBoost) dynamically.
    """
    try:
        # Generate the forecast using the globally loaded AI models
        result = model_runner.generate_forecast(city)
        
        # Inject ML heat risk scores using the predicted forecast data
        predictions_with_heatscore = predict_heatscores(city, result["predictions"])
        
        return ForecastResponse(
            city=city,
            forecast_horizon=16,
            predictions=predictions_with_heatscore,
            warnings=[f"Forecast based on data up to {result['base_date']}"]
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
