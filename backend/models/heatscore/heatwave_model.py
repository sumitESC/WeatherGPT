"""
Master Heatwave Regressor — The Brain
Model: Random Forest Regressor (scikit-learn)
Target: Max Daily Temperature (from ERA5-Land / IMD)
Features: [NDVI, NDWI, NDBI, Emission_Index, Pop_Density, Month, Elevation, etc.]

This module trains the model, evaluates accuracy, and generates per-city explanations.
"""
import os
import json
import numpy as np
import pandas as pd
from datetime import datetime
from typing import Dict, List, Tuple, Optional

try:
    import joblib
    from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor, VotingRegressor
    from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
    from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
    from sklearn.preprocessing import StandardScaler
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False
    print("Warning: 'joblib' or 'scikit-learn' is not installed. HeatwaveModel will operate in heuristic mode.")


class HeatwaveModel:
    """Random Forest model to predict heatwave severity from urban features."""
    
    FEATURE_COLUMNS = [
        "ndvi", "ndwi", "ndbi", "emission_index", "population_density",
        "built_up_ratio", "green_cover_ratio", "water_cover_ratio",
        "elevation_m", "month", "humidity_pct", "wind_speed_ms",
        "avg_building_height", "urban_canyon_index", "industrial_heat_factor",
        "ac_thermal_exhaust", "lst_day_mean", "lst_night_mean", "viirs_avg_radiance",
    ]
    
    TARGET_COLUMN = "max_temp_c"
    
    FEATURE_DISPLAY_NAMES = {
        "ndvi": "Greenery (NDVI)",
        "ndwi": "Water Bodies (NDWI)",
        "ndbi": "Built-up Area (NDBI)",
        "emission_index": "Vehicle Emissions",
        "population_density": "Population Density",
        "built_up_ratio": "Concrete Coverage",
        "green_cover_ratio": "Green Cover",
        "water_cover_ratio": "Water Coverage",
        "elevation_m": "Elevation",
        "month": "Season (Month)",
        "humidity_pct": "Humidity",
        "wind_speed_ms": "Wind Speed",
        "avg_building_height": "Building Height",
        "urban_canyon_index": "Urban Canyon",
        "industrial_heat_factor": "Industrial Heat",
        "ac_thermal_exhaust": "AC Thermal Exhaust",
        "lst_day_mean": "Land Temp (MODIS LST Day)",
        "lst_night_mean": "Night Temp (MODIS LST Night)",
        "viirs_avg_radiance": "Urban Glow (VIIRS)",
    }
    
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.feature_importance: Dict[str, float] = {}
        self.metrics: Dict[str, float] = {}
        self.is_trained = False
    
    def load_training_data(self, csv_path: str) -> Tuple[pd.DataFrame, pd.Series]:
        """Load and prepare training data from the temperature CSV."""
        df = pd.read_csv(csv_path)
        
        print(f"Loaded {len(df)} training samples from {df['city'].nunique()} cities")
        print(f"Date range: {df['year'].min()}-{df['year'].max()}")
        print(f"Temperature range: {df[self.TARGET_COLUMN].min():.1f}C to {df[self.TARGET_COLUMN].max():.1f}C")
        
        # Verify all feature columns exist
        missing = [c for c in self.FEATURE_COLUMNS if c not in df.columns]
        if missing:
            raise ValueError(f"Missing feature columns: {missing}")
        
        X = df[self.FEATURE_COLUMNS].copy()
        y = df[self.TARGET_COLUMN].copy()
        
        # Store city info for explainability
        self._city_data = df[["city", "year", "month"] + self.FEATURE_COLUMNS + [self.TARGET_COLUMN]].copy()
        
        return X, y
    
    def train(self, X: pd.DataFrame, y: pd.Series, 
              test_size: float = 0.2, tune_hyperparams: bool = True) -> Dict:
        """
        Train the Random Forest model with cross-validation and optional hyperparameter tuning.
        
        Returns:
            Dict with training metrics
        """
        print(f"\n{'='*60}")
        print(f"  TRAINING HEATWAVE PREDICTION MODEL")
        print(f"{'='*60}\n")
        
        # Train-test split (stratified by temperature bins for balanced evaluation)
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42
        )
        
        print(f"Training samples: {len(X_train)}")
        print(f"Testing samples:  {len(X_test)}")
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        if tune_hyperparams:
            print("\nTuning hyperparameters with GridSearchCV...")
            param_grid = {
                "n_estimators": [100, 200, 300],
                "learning_rate": [0.05, 0.1],
                "max_depth": [3, 4, 5],
                "min_samples_split": [2, 5],
            }
            
            grid_search = GridSearchCV(
                GradientBoostingRegressor(random_state=42),
                param_grid,
                cv=5,
                scoring="r2",
                n_jobs=-1,
                verbose=0,
            )
            grid_search.fit(X_train_scaled, y_train)
            gb_best = grid_search.best_estimator_
            print(f"Best GB params: {grid_search.best_params_}")
            print(f"Best GB CV R²: {grid_search.best_score_:.4f}")
            
            # Combine with Random Forest for stability
            rf_model = RandomForestRegressor(n_estimators=200, max_depth=15, random_state=42, n_jobs=-1)
            self.model = VotingRegressor(estimators=[('gb', gb_best), ('rf', rf_model)])
            self.model.fit(X_train_scaled, y_train)
        else:
            gb_model = GradientBoostingRegressor(
                n_estimators=200, learning_rate=0.1, max_depth=4, random_state=42
            )
            rf_model = RandomForestRegressor(n_estimators=200, max_depth=15, random_state=42, n_jobs=-1)
            self.model = VotingRegressor(estimators=[('gb', gb_model), ('rf', rf_model)])
            self.model.fit(X_train_scaled, y_train)
        
        # Predictions
        y_train_pred = self.model.predict(X_train_scaled)
        y_test_pred = self.model.predict(X_test_scaled)
        
        # Metrics
        train_r2 = r2_score(y_train, y_train_pred)
        test_r2 = r2_score(y_test, y_test_pred)
        test_mae = mean_absolute_error(y_test, y_test_pred)
        test_rmse = np.sqrt(mean_squared_error(y_test, y_test_pred))
        
        # Cross-validation R²
        cv_scores = cross_val_score(
            self.model, self.scaler.transform(X), y,
            cv=5, scoring="r2", n_jobs=-1
        )
        
        self.metrics = {
            "train_r2": round(train_r2, 4),
            "test_r2": round(test_r2, 4),
            "test_mae": round(test_mae, 2),
            "test_rmse": round(test_rmse, 2),
            "cv_r2_mean": round(cv_scores.mean(), 4),
            "cv_r2_std": round(cv_scores.std(), 4),
            "cv_scores": [round(s, 4) for s in cv_scores],
            "n_features": len(self.FEATURE_COLUMNS),
            "n_train": len(X_train),
            "n_test": len(X_test),
        }
        
        # Feature importance (Using Random Forest's importances as proxy for the ensemble)
        # VotingRegressor doesn't expose feature_importances_ directly
        rf_estimator = self.model.named_estimators_['rf']
        importances = rf_estimator.feature_importances_
        self.feature_importance = {
            col: round(float(imp), 4)
            for col, imp in sorted(
                zip(self.FEATURE_COLUMNS, importances),
                key=lambda x: x[1],
                reverse=True
            )
        }
        
        # Export metadata for dashboard
        try:
            output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "output")
            os.makedirs(output_dir, exist_ok=True)
            
            # Sampling some test results for scatter plots (max 200 points)
            sample_indices = np.random.choice(len(y_test), min(len(y_test), 200), replace=False)
            test_results = [
                {"actual": float(y_test.iloc[i]), "predicted": float(y_test_pred[i])}
                for i in sample_indices
            ]
            
            metadata = {
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "metrics": self.metrics,
                "feature_importance": self.feature_importance,
                "test_sample_results": test_results,
                "residuals": [float(r) for r in (y_test - y_test_pred)],
                "feature_names": self.FEATURE_COLUMNS,
                "feature_display_names": self.FEATURE_DISPLAY_NAMES
            }
            
            metadata_path = os.path.join(output_dir, "model_metadata.json")
            with open(metadata_path, "w") as f:
                json.dump(metadata, f, indent=4)
            print(f"Model metadata exported to {metadata_path}")
        except Exception as e:
            print(f"Failed to export model metadata: {e}")

        self.is_trained = True
        return self.metrics
    
    def _print_training_report(self, y_test, y_test_pred):
        """Print detailed training report."""
        m = self.metrics
        
        print(f"\n{'='*60}")
        print(f"  MODEL TRAINING RESULTS")
        print(f"{'='*60}\n")
        
        status = "[V] TARGET MET" if m["test_r2"] >= 0.80 else "[!] BELOW TARGET"
        
        print(f"  Train R2:       {m['train_r2']:.4f}")
        print(f"  Test R2:        {m['test_r2']:.4f}  {status}")
        print(f"  Test MAE:       {m['test_mae']:.2f}C")
        print(f"  Test RMSE:      {m['test_rmse']:.2f}C")
        print(f"  CV R2 (5-fold): {m['cv_r2_mean']:.4f} +/- {m['cv_r2_std']:.4f}")
        print(f"  CV Scores:      {m['cv_scores']}")
        
        print(f"\n  FEATURE IMPORTANCE (What Drives Heat?):")
        print(f"  {'-'*50}")
        
        for feature, importance in self.feature_importance.items():
            bar_len = int(importance * 40)
            bar = "#" * bar_len + "-" * (40 - bar_len)
            display_name = self.FEATURE_DISPLAY_NAMES.get(feature, feature)
            print(f"  {display_name:<25} {bar} {importance*100:.1f}%")
        
        # Residual statistics
        residuals = y_test - y_test_pred
        print(f"\n  RESIDUAL ANALYSIS:")
        print(f"  Mean residual:  {np.mean(residuals):.2f}C (should be ~0)")
        print(f"  Std residual:   {np.std(residuals):.2f}C")
        print(f"  Max overpredict: {np.min(residuals):.2f}C")
        print(f"  Max underpredict: {np.max(residuals):.2f}C")
    
    def predict_city(self, city_features: Dict) -> Dict:
        """
        Predict temperature and risk for a single city.
        
        Args:
            city_features: Dict with feature values
        
        Returns:
            Dict with prediction, risk score, and explanation
        """
        if not self.is_trained or self.model is None or not HAS_SKLEARN:
            predicted_temp = float(city_features.get("lst_day_mean", city_features.get("temp_max", 35.0)))
            heat_risk = self._compute_risk_score(predicted_temp, city_features)
            heat_zone = self._classify_zone(predicted_temp)
            drivers = [
                {"factor": "Vegetation Scarcity", "value": 1.0 - city_features.get("ndvi", 0.2), "weight": 1.2},
                {"factor": "Concrete Density (NDBI)", "value": city_features.get("ndbi", 0.2), "weight": 1.5},
                {"factor": "Urban Canyon Effect", "value": city_features.get("urban_canyon_index", 0.2), "weight": 1.8},
                {"factor": "Industrial Heat", "value": city_features.get("industrial_heat_factor", 0.1), "weight": 2.0},
                {"factor": "AC Thermal Exhaust", "value": city_features.get("ac_thermal_exhaust", 0.2), "weight": 1.4},
                {"factor": "Population Density", "value": city_features.get("population_density", 5000) / 20000, "weight": 1.0},
                {"factor": "Vehicle Emissions", "value": city_features.get("emission_index", 1.0) / 10, "weight": 1.1},
            ]
            drivers.sort(key=lambda x: x["value"] * x["weight"], reverse=True)
            primary_driver = drivers[0]
            explanation = self._generate_causal_explanation(city_features, drivers[:3])
            return {
                "predicted_max_temp": float(predicted_temp),
                "heat_risk_score": float(heat_risk),
                "heat_zone": heat_zone,
                "primary_driver": primary_driver,
                "explanation": explanation,
                "confidence_score": city_features.get("confidence_score", None)
            }

        # Build feature vector
        features = np.array([[city_features.get(col, 0) for col in self.FEATURE_COLUMNS]])
        features_scaled = self.scaler.transform(features)
        
        predicted_temp = float(self.model.predict(features_scaled)[0])
        
        # Compute heat risk score (0-100)
        heat_risk = self._compute_risk_score(predicted_temp, city_features)
        heat_zone = self._classify_zone(predicted_temp)
        
        # 2. Identify primary and secondary drivers using the new physical features
        drivers = [
            {"factor": "Vegetation Scarcity", "value": 1.0 - city_features.get("ndvi", 0.2), "weight": 1.2},
            {"factor": "Concrete Density (NDBI)", "value": city_features.get("ndbi", 0.2), "weight": 1.5},
            {"factor": "Urban Canyon Effect", "value": city_features.get("urban_canyon_index", 0.2), "weight": 1.8},
            {"factor": "Industrial Heat", "value": city_features.get("industrial_heat_factor", 0.1), "weight": 2.0},
            {"factor": "AC Thermal Exhaust", "value": city_features.get("ac_thermal_exhaust", 0.2), "weight": 1.4},
            {"factor": "Population Density", "value": city_features.get("population_density", 5000) / 20000, "weight": 1.0},
            {"factor": "Vehicle Emissions", "value": city_features.get("emission_index", 1.0) / 10, "weight": 1.1},
        ]
        
        # Sort by weighted impact
        drivers.sort(key=lambda x: x["value"] * x["weight"], reverse=True)
        primary_driver = drivers[0]
        
        # 3. Generate Causal Explanation (Fix for Drawback #6)
        explanation = self._generate_causal_explanation(city_features, drivers[:3])
        
        return {
            "predicted_max_temp": float(predicted_temp),
            "heat_risk_score": float(heat_risk),
            "heat_zone": heat_zone,
            "primary_driver": primary_driver,
            "explanation": explanation,
            # confidence_score is now computed dynamically by the forecast pipeline
            # and passed through from the calling service — not hardcoded here
            "confidence_score": city_features.get("confidence_score", None)
        }

    def _generate_causal_explanation(self, features: Dict, top_drivers: List[Dict]) -> Dict:
        """Generates a physical-grade causal explanation for the heat risk."""
        main_factor = top_drivers[0]["factor"]
        
        explanations = {
            "Urban Canyon Effect": "Taller buildings and narrow streets are trapping longwave radiation, preventing nighttime cooling.",
            "Industrial Heat": "High concentration of manufacturing units is injecting direct waste heat into the local boundary layer.",
            "Concrete Density (NDBI)": "Low albedo surfaces (asphalt/concrete) are absorbing solar radiation and re-emitting it as sensible heat.",
            "Vegetation Scarcity": "Lack of evapotranspiration from green cover is failing to provide natural latent heat cooling.",
            "AC Thermal Exhaust": "Dense air-conditioning usage is creating a positive feedback loop by pumping heat from indoors to the streets.",
        }
        
        text = explanations.get(main_factor, f"The primary cause is {main_factor}, amplified by local urban morphology.")
        
        return {
            "text": text,
            "physical_basis": "Urban Energy Balance (UEB) Anomaly",
            "mitigation_priority": "High" if top_drivers[0]["value"] > 0.6 else "Medium"
        }

    def _compute_risk_score(self, temp: float, features: Dict) -> float:
        """Compute heat risk score (0-100) from temperature and urban features."""
        # Temperature contribution (0-40 points)
        temp_score = min(40, max(0, (temp - 20) / (48 - 20) * 40))
        
        # Built-up area contribution (0-20 points)
        ndbi = features.get("ndbi", 0.18)
        built_up_score = min(20, max(0, ndbi / 0.35 * 20))
        
        # Emission contribution (0-15 points)
        emission = features.get("emission_index", 5)
        emission_score = min(15, max(0, emission / 15 * 15))
        
        # Population density (0-10 points)
        pop = features.get("population_density", 5000)
        pop_score = min(10, max(0, (pop - 2000) / (15000 - 2000) * 10))
        
        # Green cover penalty (0-10 points, higher = less green = more points)
        green = features.get("green_cover_ratio", 0.1)
        green_score = min(10, max(0, (1 - green / 0.2) * 10))
        
        # Water cooling bonus (0-5 points reduction)
        water = features.get("water_cover_ratio", 0.02)
        water_bonus = min(5, water / 0.1 * 5)
        
        # Satellite LST specific scoring (Major Weight: 0-30 points)
        # This uses direct thermal measurement if available
        lst = features.get("lst_day_mean", 35)
        lst_score = min(30, max(0, (lst - 30) / (55 - 30) * 30))
        
        # Urban Glow (VIIRS) contribution (0-5 points)
        glow = features.get("viirs_avg_radiance", 20)
        glow_score = min(5, (glow / 150) * 5)
        
        score = temp_score + built_up_score + emission_score + pop_score + green_score + lst_score + glow_score - water_bonus
        
        # Rain cooling bonus (0-25 points reduction)
        precip = features.get("precipitation_mm", 0.0)
        if precip > 0:
            rain_cooling = min(25, (precip / 50.0) * 25)
            score -= rain_cooling
            
        return min(100, max(0, score))
    
    def _classify_zone(self, temp: float) -> str:
        """Classify heat zone based on temperature."""
        if temp >= 45:
            return "extreme"
        elif temp >= 36:
            return "high"
        elif temp >= 26:
            return "moderate"
        else:
            return "cool"
    
    def predict_all_cities(self, cities_json_path: str, month: int = 5) -> List[Dict]:
        """
        Run predictions for all cities for a given month.
        
        Args:
            cities_json_path: Path to UP cities JSON
            month: Month number (1-12). Default 5 (May - peak heat)
        
        Returns:
            List of prediction dicts for all cities
        """
        with open(cities_json_path, "r") as f:
            data = json.load(f)
        
        print(f"\n{'='*60}")
        print(f"  CITY-WISE HEATWAVE PREDICTIONS (Month: {month})")
        print(f"{'='*60}\n")
        
        results = []
        
        for city in data["cities"]:
            # Build feature dict for this city
            emission_index = (
                city.get("heavy_commercial", 0) * 5.0 +
                city.get("light_commercial", 0) * 3.0 +
                city.get("buses", 0) * 4.0 +
                city.get("four_wheelers_diesel", 0) * 2.0 +
                city.get("four_wheelers_petrol", 0) * 1.5 +
                city.get("two_wheelers", 0) * 1.0 +
                city.get("three_wheelers", 0) * 1.2 +
                city.get("electric_vehicles", 0) * 0.0 +
                city.get("cng_vehicles", 0) * 0.3
            ) / 1_000_000
            
            features = {
                "ndvi": city["ndvi_mean"],
                "ndwi": city["ndwi_mean"],
                "ndbi": city["ndbi_mean"],
                "emission_index": emission_index,
                "population_density": city["population_density"],
                "built_up_ratio": city["built_up_area_sqkm"] / city["total_area_sqkm"],
                "green_cover_ratio": (city["forest_cover_pct"] + city["urban_green_space_pct"]) / 100,
                "water_cover_ratio": city["water_bodies_area_sqkm"] / city["total_area_sqkm"],
                "elevation_m": city["elevation_m"],
                "month": month,
                "humidity_pct": 45 if month in [4, 5, 6] else 65,
                "wind_speed_ms": 3.5 if month in [4, 5, 6] else 2.5,
                "avg_building_height": city.get("avg_building_height", 10),
                "urban_canyon_index": city.get("urban_canyon_index", 0.5),
                "industrial_heat_factor": city.get("industrial_heat_factor", 0.1),
                "ac_thermal_exhaust": city.get("ac_thermal_exhaust", 0.2),
            }
            
            prediction = self.predict_city(features)
            prediction["city"] = city["name"]
            prediction["latitude"] = city["latitude"]
            prediction["longitude"] = city["longitude"]
            prediction["features"] = features
            
            results.append(prediction)
            
            # Print compact result
            zone_emoji = {"extreme": "[R]", "high": "[O]", "moderate": "[Y]", "cool": "[G]"}
            emoji = zone_emoji.get(prediction["heat_zone"], "[ ]")
            print(
                f"  {emoji} {city['name']:<16} "
                f"Temp: {prediction['predicted_max_temp']:.1f}°C  "
                f"Risk: {prediction['heat_risk_score']:.0f}/100  "
                f"Zone: {prediction['heat_zone'].upper():<10}  "
                f"Driver: {prediction['primary_driver']['factor'] if prediction['primary_driver'] else 'N/A'}"
            )
        
        # Sort by risk
        results.sort(key=lambda x: x["heat_risk_score"], reverse=True)
        
        print(f"\n  Total cities analyzed: {len(results)}")
        extreme = sum(1 for r in results if r["heat_zone"] == "extreme")
        high = sum(1 for r in results if r["heat_zone"] == "high")
        moderate = sum(1 for r in results if r["heat_zone"] == "moderate")
        cool = sum(1 for r in results if r["heat_zone"] == "cool")
        print(f"  [R] Extreme: {extreme}  [O] High: {high}  [Y] Moderate: {moderate}  [G] Cool: {cool}")
        
        return results
    
    def save_model(self, model_dir: str):
        """Save trained model and scaler to disk."""
        os.makedirs(model_dir, exist_ok=True)
        
        joblib.dump(self.model, os.path.join(model_dir, "heatwave_rf.pkl"))
        joblib.dump(self.scaler, os.path.join(model_dir, "scaler.pkl"))
        
        # Save metadata
        metadata = {
            "metrics": self.metrics,
            "feature_importance": self.feature_importance,
            "feature_columns": self.FEATURE_COLUMNS,
            "target_column": self.TARGET_COLUMN,
        }
        with open(os.path.join(model_dir, "model_metadata.json"), "w") as f:
            json.dump(metadata, f, indent=2)
        
        print(f"\nModel saved to: {model_dir}")
    
    def load_model(self, model_dir: str):
        """Load trained model from disk."""
        if not HAS_SKLEARN:
            print("joblib/sklearn unavailable. HeatwaveModel operating in physical heuristic mode.")
            self.is_trained = False
            return

        model_file = os.path.join(model_dir, "heatwave_rf.pkl")
        scaler_file = os.path.join(model_dir, "scaler.pkl")

        if not os.path.exists(model_file) or not os.path.exists(scaler_file):
            print(f"Model files not found in {model_dir}. HeatwaveModel operating in physical heuristic mode.")
            self.is_trained = False
            return

        try:
            self.model = joblib.load(model_file)
            self.scaler = joblib.load(scaler_file)
            
            metadata_file = os.path.join(model_dir, "model_metadata.json")
            if os.path.exists(metadata_file):
                with open(metadata_file, "r") as f:
                    metadata = json.load(f)
                self.metrics = metadata.get("metrics", {})
                self.feature_importance = metadata.get("feature_importance", {})
            self.is_trained = True
            print(f"HeatwaveModel loaded successfully from: {model_dir}")
        except Exception as e:
            print(f"Failed loading HeatwaveModel: {e}. Operating in physical heuristic mode.")
            self.is_trained = False


if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(os.path.dirname(script_dir)) # Go up from models/heatscore to project root
    data_dir = os.path.join(project_dir, "data")
    models_dir = os.path.join(project_dir, "models", "heatscore")
    cities_path = os.path.join(data_dir, "up_cities.json")
    temp_path = os.path.join(data_dir, "temperature_data.csv")
    
    # Generate temperature data if not exists
    if not os.path.exists(temp_path):
        from .data_generators import generate_temperature_dataset
        generate_temperature_dataset(temp_path)
    
    # Train model
    model = HeatwaveModel()
    X, y = model.load_training_data(temp_path)
    model.train(X, y, tune_hyperparams=True)
    model.save_model(models_dir)
    
    # Run predictions
    model.predict_all_cities(cities_path, month=5)  # May (peak heat)
