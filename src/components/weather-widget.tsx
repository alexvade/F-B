"use client";

import { useEffect, useState } from "react";
import { Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning, MapPin } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { bg, border, ink, inkSoft, navyText, orange } from "@/lib/design-tokens";

type WeatherData = {
  tempC: number;
  feelsLikeC: number;
  weatherCode: number;
  todayHigh: number;
  todayLow: number;
};

// WMO weather codes → a short label and icon (https://open-meteo.com/en/docs).
const CONDITIONS: Record<number, { label: string; Icon: LucideIcon }> = {
  0: { label: "Clear sky", Icon: Sun },
  1: { label: "Mostly clear", Icon: Sun },
  2: { label: "Partly cloudy", Icon: CloudSun },
  3: { label: "Overcast", Icon: Cloud },
  45: { label: "Foggy", Icon: CloudFog },
  48: { label: "Foggy", Icon: CloudFog },
  51: { label: "Light drizzle", Icon: CloudDrizzle },
  53: { label: "Drizzle", Icon: CloudDrizzle },
  55: { label: "Heavy drizzle", Icon: CloudDrizzle },
  56: { label: "Freezing drizzle", Icon: CloudDrizzle },
  57: { label: "Freezing drizzle", Icon: CloudDrizzle },
  61: { label: "Light rain", Icon: CloudRain },
  63: { label: "Rain", Icon: CloudRain },
  65: { label: "Heavy rain", Icon: CloudRain },
  66: { label: "Freezing rain", Icon: CloudRain },
  67: { label: "Freezing rain", Icon: CloudRain },
  71: { label: "Light snow", Icon: CloudSnow },
  73: { label: "Snow", Icon: CloudSnow },
  75: { label: "Heavy snow", Icon: CloudSnow },
  77: { label: "Snow grains", Icon: CloudSnow },
  80: { label: "Rain showers", Icon: CloudRain },
  81: { label: "Rain showers", Icon: CloudRain },
  82: { label: "Heavy showers", Icon: CloudRain },
  85: { label: "Snow showers", Icon: CloudSnow },
  86: { label: "Snow showers", Icon: CloudSnow },
  95: { label: "Thunderstorm", Icon: CloudLightning },
  96: { label: "Thunderstorm", Icon: CloudLightning },
  99: { label: "Thunderstorm", Icon: CloudLightning },
};

const REFRESH_MS = 10 * 60 * 1000;

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/weather");
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) {
          setWeather(data);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const condition = weather ? CONDITIONS[weather.weatherCode] : undefined;
  const Icon = condition?.Icon ?? Cloud;

  return (
    <div
      className="flex items-center justify-between p-4 rounded-2xl"
      style={{ background: bg, border: `1px solid ${border}`, minHeight: 76 }}
    >
      <div>
        <div className="flex items-center gap-1 text-xs mb-1" style={{ color: inkSoft }}>
          <MapPin size={11} /> Wetherby, LS22
        </div>
        {weather ? (
          <>
            <div className="text-2xl font-semibold tabular-nums" style={{ color: navyText }}>
              {weather.tempC}°C
            </div>
            <div className="text-xs" style={{ color: ink }}>
              {condition?.label ?? "—"} · H{weather.todayHigh}° L{weather.todayLow}°
            </div>
          </>
        ) : (
          <p className="text-sm" style={{ color: inkSoft }}>
            {error ? "Couldn't load weather" : "Loading weather…"}
          </p>
        )}
      </div>
      <Icon size={32} style={{ color: orange, opacity: 0.8 }} />
    </div>
  );
}
