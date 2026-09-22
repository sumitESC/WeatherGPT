/**
 * Shared utility for weather simulation and base city data.
 * Ensures consistent fallbacks when OpenWeather API is unavailable.
 */

export interface BaseWeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  pressure: number;
  cloudCover: number;
  rainfall: number;
  weatherMain: string;
  weatherDescription: string;
}

export interface ForecastDay extends BaseWeatherData {
  date: string;
  tempMin: number;
  tempMax: number;
  tempAvg: number;
  weatherIcon: string;
}

export const CITY_BASE_TEMPS: Record<string, number> = {
  Lucknow: 32,
  Kanpur: 34,
  Varanasi: 33,
  Prayagraj: 35,
  Agra: 36,
  Ghaziabad: 35,
  Noida: 34,
  Meerut: 33,
  Bareilly: 34,
  Aligarh: 35,
  Moradabad: 33,
  Jhansi: 38,
  Gorakhpur: 34,
  Ayodhya: 34,
  Mathura: 37,
  Saharanpur: 33,
  Muzaffarnagar: 33,
  Firozabad: 36,
  Rampur: 34,
  Bijnor: 33,
  Etawah: 36,
  "Rae Bareli": 34,
  Sitapur: 34,
  Hardoi: 34,
};

export const WEATHER_CONDITIONS = ["Clear", "Clouds", "Haze", "Rain", "Mist"];
export const WEATHER_ICONS = ["01d", "03d", "50d", "10d", "50d"];

/**
 * Generates simulated current weather for a city.
 */
export function simulateCurrentWeather(cityName: string): BaseWeatherData {
  const base = CITY_BASE_TEMPS[cityName] ?? 33;
  const temp = base + (Math.random() * 4 - 2);
  const humidity = 55 + Math.floor(Math.random() * 30);
  const wind = 2 + Math.random() * 8;
  const condIdx = Math.floor(Math.random() * WEATHER_CONDITIONS.length);

  return {
    temperature: Math.round(temp * 10) / 10,
    feelsLike: Math.round((temp + 2) * 10) / 10,
    humidity,
    windSpeed: Math.round(wind * 10) / 10,
    pressure: 1000 + Math.floor(Math.random() * 20),
    cloudCover: Math.floor(Math.random() * 60),
    rainfall: condIdx === 3 ? Math.round(Math.random() * 5 * 10) / 10 : 0,
    weatherMain: WEATHER_CONDITIONS[condIdx],
    weatherDescription: WEATHER_CONDITIONS[condIdx].toLowerCase(),
  };
}

/**
 * Generates a 5-day simulated forecast for a city.
 */
export function simulateForecast(cityName: string): ForecastDay[] {
  const base = CITY_BASE_TEMPS[cityName] ?? 33;
  const days: ForecastDay[] = [];

  for (let i = 0; i < 5; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split("T")[0];
    
    // Use slightly different variation for each day
    const variation = (Math.random() - 0.5) * 6;
    const temp = base + variation;
    const condIdx = Math.floor(Math.random() * WEATHER_CONDITIONS.length);

    days.push({
      date: dateStr,
      tempMin: Math.round((temp - 3) * 10) / 10,
      tempMax: Math.round((temp + 4) * 10) / 10,
      tempAvg: Math.round(temp * 10) / 10,
      temperature: Math.round(temp * 10) / 10, // Day's current-representative temp
      feelsLike: Math.round((temp + 2) * 10) / 10,
      humidity: 50 + Math.floor(Math.random() * 35),
      windSpeed: Math.round((2 + Math.random() * 6) * 10) / 10,
      pressure: 1000 + Math.floor(Math.random() * 18),
      cloudCover: Math.floor(Math.random() * 70),
      rainfall: condIdx === 3 ? Math.round(Math.random() * 15 * 10) / 10 : 0,
      weatherMain: WEATHER_CONDITIONS[condIdx],
      weatherDescription: WEATHER_CONDITIONS[condIdx].toLowerCase(),
      weatherIcon: WEATHER_ICONS[condIdx],
    });
  }

  return days;
}
