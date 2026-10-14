import { NextResponse } from "next/server";

// Wood Hall Hotel & Spa, Wetherby — LS22 4JA. Coordinates looked up once via
// postcodes.io and hardcoded, since the venue's location never changes and
// this avoids a geocoding call on every request. Open-Meteo needs no API
// key, unlike Google's Weather API which requires a billed Cloud project.
const LATITUDE = 53.916112;
const LONGITUDE = -1.440281;

// Open-Meteo's `current` block doesn't carry visibility or UV index (only
// `hourly` does) — find the hourly row matching `current.time` so those two
// read as "right now" too, same as the current temperature/condition.
function findHourIndex(hourlyTimes: string[], currentTime: string): number {
  const exact = hourlyTimes.indexOf(currentTime);
  if (exact !== -1) return exact;
  // Fall back to the latest hour at or before "now".
  let best = 0;
  for (let i = 0; i < hourlyTimes.length; i++) {
    if (hourlyTimes[i] <= currentTime) best = i;
  }
  return best;
}

export async function GET() {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
    `&current=temperature_2m,apparent_temperature,weather_code,relative_humidity_2m` +
    `&hourly=temperature_2m,weather_code,visibility,uv_index` +
    `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
    `&timezone=Europe%2FLondon&forecast_days=7`;

  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) {
    return NextResponse.json({ error: "Couldn't fetch weather" }, { status: 502 });
  }
  const data = await res.json();

  const hourlyTimes = data.hourly.time as string[];
  const nowIdx = findHourIndex(hourlyTimes, data.current.time as string);
  // The next 6 hourly points starting at the current hour ("NOW"), for the
  // little forecast line under the main reading.
  const hourly = hourlyTimes.slice(nowIdx, nowIdx + 6).map((time, i) => ({
    time,
    label: i === 0 ? "NOW" : time.slice(11, 16),
    tempC: Math.round(data.hourly.temperature_2m[nowIdx + i]),
    weatherCode: data.hourly.weather_code[nowIdx + i] as number,
  }));

  return NextResponse.json({
    tempC: Math.round(data.current.temperature_2m),
    feelsLikeC: Math.round(data.current.apparent_temperature),
    weatherCode: data.current.weather_code as number,
    humidity: Math.round(data.current.relative_humidity_2m),
    visibilityMi: Math.round((data.hourly.visibility[nowIdx] / 1609.34) * 10) / 10,
    uvIndex: Math.round(data.hourly.uv_index[nowIdx]),
    daily: (data.daily.time as string[]).map((date, i) => ({
      date,
      weatherCode: data.daily.weather_code[i] as number,
      high: Math.round(data.daily.temperature_2m_max[i]),
      low: Math.round(data.daily.temperature_2m_min[i]),
    })),
    hourly,
  });
}
