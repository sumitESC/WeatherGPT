import { detectIntent, _setCachedCities } from "./intent.analyzer";
import { describe, it, expect, beforeAll } from "@jest/globals";

describe("Intent Analyzer", () => {
  beforeAll(() => {
    // Mock the database call
    _setCachedCities([
      { id: 1, name: "Kanpur" },
      { id: 2, name: "Lucknow" },
      { id: 3, name: "Agra" }
    ]);
  });

  describe("Report Intent", () => {
    const reportQueries = [
      "give me a full report for Kanpur",
      "detailed report on Lucknow",
      "Kanpur complete analytics",
      "generate report for Agra"
    ];
    reportQueries.forEach(query => {
      it(`should detect report intent for: "${query}"`, async () => {
        const intent = await detectIntent(query);
        expect(intent.type).toBe("report");
      });
    });
  });

  describe("Map Intent", () => {
    const mapQueries = [
      "show me the map of Kanpur",
      "Kanpur geospatial data",
      "satellite view of Lucknow",
      "where is Agra location"
    ];
    mapQueries.forEach(query => {
      it(`should detect map intent for: "${query}"`, async () => {
        const intent = await detectIntent(query);
        expect(intent.type).toBe("map");
      });
    });
  });

  describe("Comparison Intent", () => {
    const compQueries = [
      "compare Kanpur and Lucknow",
      "Lucknow vs Agra",
      "ranking of cities",
      "Kanpur versus Agra"
    ];
    compQueries.forEach(query => {
      it(`should detect comparison intent for: "${query}"`, async () => {
        const intent = await detectIntent(query);
        expect(intent.type).toBe("comparison");
      });
    });
  });

  describe("Forecast Intent", () => {
    const forecastQueries = [
      "what is the forecast for Kanpur",
      "next 5 days in Lucknow",
      "upcoming rain in Agra",
      "five day weather"
    ];
    forecastQueries.forEach(query => {
      it(`should detect forecast intent for: "${query}"`, async () => {
        const intent = await detectIntent(query);
        expect(intent.type).toBe("forecast");
      });
    });
  });

  describe("City Extraction", () => {
    it("should extract city name correctly", async () => {
      const intent = await detectIntent("weather in Kanpur");
      expect(intent.cityName).toBe("Kanpur");
      expect(intent.cityId).toBe(1);
    });

    it("should extract multiple cities for comparison", async () => {
      const intent = await detectIntent("compare Kanpur and Lucknow");
      expect(intent.type).toBe("comparison");
      expect(intent.cityNames).toContain("Kanpur");
      expect(intent.cityNames).toContain("Lucknow");
    });
  });

  describe("History Intent", () => {
    it("should detect history and extract year/month", async () => {
      const intent = await detectIntent("what was the weather in Kanpur in 2024 march");
      expect(intent.type).toBe("history");
      expect(intent.year).toBe("2024");
      expect(intent.month).toBe("03");
    });
  });
});
