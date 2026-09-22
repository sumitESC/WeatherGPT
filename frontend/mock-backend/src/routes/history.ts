import { Router, type IRouter } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router: IRouter = Router();

// Path to historical data CSV (new dataset)
const HISTORY_CSV_PATH = path.resolve(
  __dirname,
  "../../../../../heatzone-weather-api/data/processed/ml_ready_historical_data.csv"
);

router.get("/history/:city", (req, res): void => {
  try {
    const city = Array.isArray(req.params.city) ? req.params.city[0] : req.params.city;
    if (!city) {
      res.status(400).json({ error: "City name is required" });
      return;
    }

    const startDateStr = (req.query.start_date as string) || "2000-01-01";
    const endDateStr = (req.query.end_date as string) || "2025-12-31";

    const startDt = new Date(startDateStr);
    const endDt = new Date(endDateStr);

    if (!fs.existsSync(HISTORY_CSV_PATH)) {
      res.status(404).json({ error: "Historical dataset not found on server" });
      return;
    }

    const targetCity = city.toLowerCase();
    
    // Aggregation map: key = YYYY-MM
    const monthlyData: Record<string, any> = {};

    const addVal = (monthKey: string, field: string, valStr: string) => {
      const val = parseFloat(valStr);
      if (!isNaN(val)) {
        monthlyData[monthKey][field].sum += val;
        monthlyData[monthKey][field].count += 1;
      }
    };

    const parser = fs.createReadStream(HISTORY_CSV_PATH, "utf-8").pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
      })
    );

    parser.on('readable', function () {
      let row;
      while ((row = parser.read()) !== null) {
        if (!row.City || row.City.toLowerCase() !== targetCity) continue;
        
        let rowDate: Date;
        if (row.Date) {
           rowDate = new Date(row.Date);
        } else if (row.Year && row.Month) {
           rowDate = new Date(`${row.Year}-${row.Month.padStart(2, '0')}-01`);
        } else {
           continue;
        }
        
        if (rowDate >= startDt && rowDate <= endDt) {
           const yyyy = row.Year || rowDate.getFullYear().toString();
           const mm = (row.Month || (rowDate.getMonth() + 1).toString()).padStart(2, '0');
           const monthKey = `${yyyy}-${mm}`;

           if (!monthlyData[monthKey]) {
             monthlyData[monthKey] = {
               year: yyyy,
               month: mm,
               city: row.City,
               max_temp: { sum: 0, count: 0 },
               min_temp: { sum: 0, count: 0 },
               avg_temp: { sum: 0, count: 0 },
               humidity: { sum: 0, count: 0 },
               wind: { sum: 0, count: 0 },
               ndvi: { sum: 0, count: 0 },
               ndbi: { sum: 0, count: 0 },
               savi: { sum: 0, count: 0 },
               evi: { sum: 0, count: 0 },
               bsi: { sum: 0, count: 0 },
               ui: { sum: 0, count: 0 },
               ndwi: { sum: 0, count: 0 },
               ndmi: { sum: 0, count: 0 },
               soil_moisture: { sum: 0, count: 0 },
               lst: { sum: 0, count: 0 },
               albedo: { sum: 0, count: 0 },
               radiation: { sum: 0, count: 0 },
               emission_index: { sum: 0, count: 0 },
             };
           }

           addVal(monthKey, 'max_temp', row.Temp_Max_C);
           addVal(monthKey, 'min_temp', row.Temp_Min_C);
           addVal(monthKey, 'avg_temp', row.Temp_Mean_C);
           addVal(monthKey, 'humidity', row.Humidity_Mean_pct);
           if (row.Wind_Speed_Max_kmh) addVal(monthKey, 'wind', (parseFloat(row.Wind_Speed_Max_kmh) / 3.6).toString());
           
           addVal(monthKey, 'ndvi', row.NDVI || row.ndvi || "0.22");
           addVal(monthKey, 'ndbi', row.NDBI || row.ndbi || "0.35");
           addVal(monthKey, 'savi', row.SAVI || row.savi || row.NDVI || "0.2");
           addVal(monthKey, 'evi', row.EVI || row.evi || row.NDVI || "0.25");
           addVal(monthKey, 'bsi', row.BSI || row.bsi || row.NDBI || "0.3");
           addVal(monthKey, 'ui', row.UI || row.ui || row.NDBI || "0.38");
           addVal(monthKey, 'ndwi', row.NDWI || row.ndwi || "-0.25");
           addVal(monthKey, 'ndmi', row.NDMI || row.ndmi || "-0.1");
           addVal(monthKey, 'soil_moisture', row.Soil_Moisture_0_7cm_m3m3 || row.Soil_Moisture || row.soil_moisture || "0.18");
           addVal(monthKey, 'lst', row.LST_Celsius || row.lst || row.Temp_Max_C || "32");
           addVal(monthKey, 'albedo', row.Albedo || row.albedo || "0.14");
           addVal(monthKey, 'radiation', row.Shortwave_Radiation_MJm2 || row.radiation || "18");
           addVal(monthKey, 'emission_index', row.Emission_Index || (parseFloat(row.NDBI || "0.35") * 10).toString());
        }
      }
    });

    parser.on('error', function (err: any) {
      console.error("[History API Parse Error]:", err);
      res.status(500).json({ error: "Failed to parse historical data" });
    });

    parser.on('end', function () {
      const results = Object.keys(monthlyData).sort().map(key => {
        const d = monthlyData[key];
        const getAvg = (field: string) => d[field].count > 0 ? (d[field].sum / d[field].count).toString() : "0";
        
        return {
          year: d.year,
          month: d.month,
          city: d.city,
          Date: `${d.year}-${d.month}-01`,
          max_temp_c: getAvg('max_temp'),
          min_temp_c: getAvg('min_temp'),
          avg_temp_c: getAvg('avg_temp'),
          humidity_pct: getAvg('humidity'),
          wind_speed_ms: getAvg('wind'),
          ndvi: getAvg('ndvi'),
          ndbi: getAvg('ndbi'),
          savi: getAvg('savi'),
          evi: getAvg('evi'),
          bsi: getAvg('bsi'),
          ui: getAvg('ui'),
          ndwi: getAvg('ndwi'),
          ndmi: getAvg('ndmi'),
          soil_moisture: getAvg('soil_moisture'),
          lst: getAvg('lst'),
          albedo: getAvg('albedo'),
          radiation: getAvg('radiation'),
          emission_index: getAvg('emission_index'),
          green_cover_ratio: getAvg('ndvi'),
        };
      });

      res.json({
        city,
        start_date: startDateStr,
        end_date: endDateStr,
        data: results
      });
    });

  } catch (error: any) {
    console.error("[History API Error]:", error);
    res.status(500).json({ error: "Failed to fetch historical data" });
  }
});

export default router;
