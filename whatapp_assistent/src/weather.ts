import { Env } from './types';

export async function getCurrentWeather(city: string, env: Env): Promise<any> {
  const apiKey = env.OPENWEATHER_API_KEY || '';
  if (!apiKey) throw new Error('OPENWEATHER_API_KEY is missing');
  
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API error: ${res.statusText}`);
  return await res.json();
}

export async function getCurrentWeatherByCoords(lat: number, lon: number, env: Env): Promise<any> {
  const apiKey = env.OPENWEATHER_API_KEY || '';
  if (!apiKey) throw new Error('OPENWEATHER_API_KEY is missing');

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API error: ${res.statusText}`);
  return await res.json();
}

export async function get5DayForecast(city: string, env: Env): Promise<any> {
  const apiKey = env.OPENWEATHER_API_KEY || '';
  if (!apiKey) throw new Error('OPENWEATHER_API_KEY is missing');

  const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Forecast API error: ${res.statusText}`);
  return await res.json();
}

export async function getAirPollution(lat: number, lon: number, env: Env): Promise<any> {
  const apiKey = env.OPENWEATHER_API_KEY || '';
  if (!apiKey) throw new Error('OPENWEATHER_API_KEY is missing');

  const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pollution API error: ${res.statusText}`);
  return await res.json();
}

export async function getGeocoding(city: string, env: Env): Promise<any> {
  const apiKey = env.OPENWEATHER_API_KEY || '';
  if (!apiKey) throw new Error('OPENWEATHER_API_KEY is missing');

  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return await res.json();
}

export async function getReverseGeocoding(lat: number, lon: number, env: Env): Promise<any> {
  const apiKey = env.OPENWEATHER_API_KEY || '';
  if (!apiKey) throw new Error('OPENWEATHER_API_KEY is missing');

  const url = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return await res.json();
}

export function formatWeatherCard(data: any): string {
  const city = data.name || 'Unknown City';
  const country = data.sys?.country || '';
  const temp = Math.round(data.main?.temp ?? 0);
  const feelsLike = Math.round(data.main?.feels_like ?? 0);
  const condition = data.weather?.[0]?.description ? capitalize(data.weather[0].description) : 'Clear';
  const humidity = data.main?.humidity ?? 0;
  const windSpeed = data.wind?.speed ?? 0;

  return (
    `📍 *${city}, ${country}*\n` +
    `🌡️ *Temperature:* ${temp}°C (Feels like ${feelsLike}°C)\n` +
    `🌤️ *Condition:* ${condition}\n` +
    `💧 *Humidity:* ${humidity}%\n` +
    `💨 *Wind:* ${windSpeed} m/s`
  );
}

export function formatAqiCard(city: string, data: any): string {
  const aqiVal = data.list?.[0]?.main?.aqi ?? 1;
  const aqiLabels: Record<number, string> = {
    1: 'Good 🟢',
    2: 'Fair 🟡',
    3: 'Moderate 🟠',
    4: 'Poor 🔴',
    5: 'Very Poor 🟣',
  };
  return `🍃 *Air Quality Index for ${city}:* Level ${aqiVal} (${aqiLabels[aqiVal] || 'Unknown'})`;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
