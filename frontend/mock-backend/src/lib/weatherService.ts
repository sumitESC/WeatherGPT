import { simulateCurrentWeather, type BaseWeatherData } from "./weatherUtils.js";

// OpenWeatherMap uses legacy names for some renamed cities
const CITY_API_ALIASES: Record<string, string> = {
  "Prayagraj": "Allahabad",
};
interface OpenWeatherResponse {
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
    pressure: number;
  };
  wind: { speed: number };
  clouds: { all: number };
  weather: Array<{ main: string; description: string }>;
  rain?: { "1h"?: number; "3h"?: number };
}

export async function fetchCityWeather(cityName: string): Promise<BaseWeatherData | null> {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  const BASE_URL = "https://api.openweathermap.org/data/2.5/weather";

  if (!apiKey) {
    console.warn("OPENWEATHER_API_KEY not set, using simulated data");
    return simulateCurrentWeather(cityName);
  }

  try {
    const queryName = CITY_API_ALIASES[cityName] ?? cityName;
    const url = `${BASE_URL}?q=${encodeURIComponent(queryName)},IN&appid=${apiKey}&units=metric`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Weather API error for ${cityName}: ${response.status}`);
      return simulateCurrentWeather(cityName);
    }

    const data = (await response.json()) as OpenWeatherResponse;

    return {
      temperature: Math.round(data.main.temp * 10) / 10,
      feelsLike: Math.round(data.main.feels_like * 10) / 10,
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind.speed * 10) / 10,
      pressure: data.main.pressure,
      cloudCover: data.clouds.all,
      rainfall: data.rain?.["1h"] ?? data.rain?.["3h"] ?? 0,
      weatherMain: data.weather[0]?.main ?? "Clear",
      weatherDescription: data.weather[0]?.description ?? "clear sky",
    };
  } catch (err) {
    console.error(`Failed to fetch weather for ${cityName}:`, err);
    return simulateCurrentWeather(cityName);
  }
}
