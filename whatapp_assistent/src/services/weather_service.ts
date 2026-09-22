import { Env } from '../types';

export async function getCurrentWeather(city: string, env: Env): Promise<any> {
  const apiKey = env.OPENWEATHER_API_KEY;
  if (!apiKey) throw new Error('OPENWEATHER_API_KEY is not configured');

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) throw new Error(`City "${city}" not found.`);
    throw new Error(`OpenWeather API Error: ${res.statusText}`);
  }
  return await res.json();
}

export async function getCurrentWeatherByCoords(lat: number, lon: number, env: Env): Promise<any> {
  const apiKey = env.OPENWEATHER_API_KEY;
  if (!apiKey) throw new Error('OPENWEATHER_API_KEY is not configured');

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenWeather API Error: ${res.statusText}`);
  return await res.json();
}

export async function get5DayForecast(city: string, env: Env): Promise<any> {
  const apiKey = env.OPENWEATHER_API_KEY;
  if (!apiKey) throw new Error('OPENWEATHER_API_KEY is not configured');

  const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenWeather Forecast Error: ${res.statusText}`);
  return await res.json();
}

export async function getAirPollution(lat: number, lon: number, env: Env): Promise<any> {
  const apiKey = env.OPENWEATHER_API_KEY;
  if (!apiKey) throw new Error('OPENWEATHER_API_KEY is not configured');

  const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenWeather Pollution Error: ${res.statusText}`);
  return await res.json();
}

export async function getGeocoding(city: string, env: Env): Promise<any[]> {
  const apiKey = env.OPENWEATHER_API_KEY;
  if (!apiKey) return [];

  const url = `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return await res.json();
}

export async function getReverseGeocoding(lat: number, lon: number, env: Env): Promise<any[]> {
  const apiKey = env.OPENWEATHER_API_KEY;
  if (!apiKey) return [];

  const url = `http://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return await res.json();
}

export function formatWeatherCard(data: any): string {
  const name = data.name;
  const country = data.sys?.country ? `, ${data.sys.country}` : '';
  const temp = Math.round(data.main.temp);
  const feelsLike = Math.round(data.main.feels_like);
  const desc = data.weather[0].description;
  const capitalizedDesc = desc.charAt(0).toUpperCase() + desc.slice(1);
  const humidity = data.main.humidity;
  const windSpeed = Math.round(data.wind.speed * 3.6); // m/s to km/h

  let weatherEmoji = '🌤️';
  const mainCond = data.weather[0].main.toLowerCase();
  if (mainCond.includes('clear')) weatherEmoji = '☀️';
  else if (mainCond.includes('cloud')) weatherEmoji = '☁️';
  else if (mainCond.includes('rain') || mainCond.includes('drizzle')) weatherEmoji = '🌧️';
  else if (mainCond.includes('thunder')) weatherEmoji = '⛈️';
  else if (mainCond.includes('snow')) weatherEmoji = '❄️';
  else if (mainCond.includes('mist') || mainCond.includes('fog')) weatherEmoji = '🌫️';

  return (
    `${weatherEmoji} *Current Weather for ${name}${country}*\n\n` +
    `• *Condition:* ${capitalizedDesc}\n` +
    `• *Temperature:* ${temp}°C (Feels like ${feelsLike}°C)\n` +
    `• *Humidity:* ${humidity}%\n` +
    `• *Wind Speed:* ${windSpeed} km/h`
  );
}

export function formatAqiCard(cityName: string, data: any): string {
  const list = data.list?.[0];
  if (!list) return `Air quality data for ${cityName} unavailable.`;

  const aqi = list.main.aqi;
  const components = list.components;

  const aqiMap: Record<number, { text: string; emoji: string }> = {
    1: { text: 'Good', emoji: '🟢' },
    2: { text: 'Fair', emoji: '🟡' },
    3: { text: 'Moderate', emoji: '🟠' },
    4: { text: 'Poor', emoji: '🔴' },
    5: { text: 'Very Poor', emoji: '🟣' },
  };

  const currentAqi = aqiMap[aqi] || { text: 'Unknown', emoji: '⚪' };

  return (
    `🍃 *Air Quality Index (AQI) for ${cityName}*\n\n` +
    `• *Status:* ${currentAqi.text} ${currentAqi.emoji} (Level ${aqi}/5)\n` +
    `• *PM2.5:* ${components.pm2_5.toFixed(1)} µg/m³\n` +
    `• *PM10:* ${components.pm10.toFixed(1)} µg/m³\n` +
    `• *NO2:* ${components.no2.toFixed(1)} µg/m³\n` +
    `• *O3:* ${components.o3.toFixed(1)} µg/m³`
  );
}
