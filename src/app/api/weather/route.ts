import { NextResponse } from "next/server";

// Wood Hall Hotel & Spa, Wetherby — LS22 4JA. Coordinates looked up once via
// postcodes.io and hardcoded, since the venue's location never changes and
// this avoids a geocoding call on every request. Open-Meteo needs no API
// key, unlike Google's Weather API which requires a billed Cloud project.
const LATITUDE = 53.916112;
const LONGITUDE = -1.440281;

export async function GET() {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
    `&current=temperature_2m,apparent_temperature,weather_code` +
    `&daily=temperature_2m_max,temperature_2m_min` +
    `&timezone=Europe%2FLondon&forecast_days=1`;

  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) {
    return NextResponse.json({ error: "Couldn't fetch weather" }, { status: 502 });
  }
  const data = await res.json();

  return NextResponse.json({
    tempC: Math.round(data.current.temperature_2m),
    feelsLikeC: Math.round(data.current.apparent_temperature),
    weatherCode: data.current.weather_code as number,
    todayHigh: Math.round(data.daily.temperature_2m_max[0]),
    todayLow: Math.round(data.daily.temperature_2m_min[0]),
  });
}
