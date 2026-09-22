/**
 * ML Forecast Routes
 * Proxy routes that forward requests to the Python FastAPI ML engine.
 * All routes return a graceful error if the ML engine is offline.
 */
import { Router, type IRouter } from "express";
import {
  fetchMLForecast,
  fetchMLHistory,
  fetchMLSatModel,
  fetchMLContext,
  isMLEngineOnline,
} from "../lib/mlProxyService.js";

const router: IRouter = Router();

// GET /api/ml/status — Check if the Python ML engine is reachable
router.get("/ml/status", async (_req, res): Promise<void> => {
  const online = await isMLEngineOnline();
  res.json({
    status: online ? "online" : "offline",
    engine: "heatzone-weather-api (Python/FastAPI)",
    url: process.env.PYTHON_ML_API_URL || "http://127.0.0.1:8000/api/v1",
  });
});

// GET /api/ml/forecast/:city — 16-day AI ensemble forecast
router.get("/ml/forecast/:city", async (req, res): Promise<void> => {
  const city = Array.isArray(req.params.city) ? req.params.city[0] : req.params.city;
  if (!city) {
    res.status(400).json({ error: "City name is required" });
    return;
  }

  const data = await fetchMLForecast(city);
  if (!data) {
    res.status(503).json({
      error: "ML engine is offline or city not found",
      hint: "Ensure the Python FastAPI server is running on port 8000",
    });
    return;
  }

  res.json(data);
});

// GET /api/ml/history/:city — Historical weather data for ML validation
router.get("/ml/history/:city", async (req, res): Promise<void> => {
  const city = Array.isArray(req.params.city) ? req.params.city[0] : req.params.city;
  if (!city) {
    res.status(400).json({ error: "City name is required" });
    return;
  }

  const startDate = (req.query.start_date as string) || "";
  const endDate = (req.query.end_date as string) || "";

  if (!startDate || !endDate) {
    res.status(400).json({ error: "start_date and end_date query params are required (YYYY-MM-DD)" });
    return;
  }

  const data = await fetchMLHistory(city, startDate, endDate);
  if (!data) {
    res.status(503).json({
      error: "ML engine is offline or data not found",
      hint: "Ensure the Python FastAPI server is running on port 8000",
    });
    return;
  }

  res.json(data);
});

// GET /api/ml/sat/:city — Satellite diagnostics (NDVI, LST, upstream corridors)
router.get("/ml/sat/:city", async (req, res): Promise<void> => {
  const city = Array.isArray(req.params.city) ? req.params.city[0] : req.params.city;
  if (!city) {
    res.status(400).json({ error: "City name is required" });
    return;
  }

  const data = await fetchMLSatModel(city);
  if (!data) {
    res.status(503).json({
      error: "ML engine is offline or satellite data not available",
      hint: "Ensure the Python FastAPI server is running on port 8000",
    });
    return;
  }

  res.json(data);
});

// GET /api/ml/context/:city — Upstream weather corridor analysis
router.get("/ml/context/:city", async (req, res): Promise<void> => {
  const city = Array.isArray(req.params.city) ? req.params.city[0] : req.params.city;
  if (!city) {
    res.status(400).json({ error: "City name is required" });
    return;
  }

  const data = await fetchMLContext(city);
  if (!data) {
    res.status(503).json({
      error: "ML engine is offline or context data not available",
      hint: "Ensure the Python FastAPI server is running on port 8000",
    });
    return;
  }

  res.json(data);
});

export default router;
