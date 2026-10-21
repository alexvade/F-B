"use client";

import { useEffect, useState } from "react";
import { MapPin, ChevronDown, ChevronUp, Droplets, Eye, Gauge } from "lucide-react";
import { bg, border, ink, inkSoft, navyText } from "@/lib/design-tokens";

// Bold, solid-shape weather glyphs — a single filled silhouette per
// condition group in its own colour (set via `style.color`, read as
// `currentColor`), rather than lucide's thin two-tone outline icons. Same
// cloud silhouette reused as the base for every non-sunny condition so
// they read as one consistent icon family.
type WeatherIconProps = { size?: number; style?: React.CSSProperties };
const CLOUD_PATH = "M7 19a4.5 4.5 0 0 1-.5-8.98A6 6 0 0 1 18 9a4.5 4.5 0 0 1-1 8.9V19H7Z";

function SunIcon({ size = 24, style }: WeatherIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <circle cx="12" cy="12" r="8" fill="currentColor" />
    </svg>
  );
}

function PartlyCloudyIcon({ size = 24, style }: WeatherIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <circle cx="16.5" cy="7.5" r="5" fill="currentColor" />
      <path d={CLOUD_PATH} fill="currentColor" />
    </svg>
  );
}

function CloudyIcon({ size = 24, style }: WeatherIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path d={CLOUD_PATH} fill="currentColor" />
    </svg>
  );
}

function FogIcon({ size = 24, style }: WeatherIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path d={CLOUD_PATH} fill="currentColor" opacity="0.85" />
      <rect x="4" y="20.2" width="16" height="1.6" rx="0.8" fill="currentColor" />
      <rect x="7" y="22.4" width="10" height="1.6" rx="0.8" fill="currentColor" />
    </svg>
  );
}

function RainIcon({ size = 24, style }: WeatherIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path d={CLOUD_PATH} fill="currentColor" />
      <path d="M8 19.3c0-.9.7-1.6 1-2.3.3.7 1 1.4 1 2.3a1 1 0 0 1-2 0Z" fill="currentColor" />
      <path d="M12.8 19.3c0-.9.7-1.6 1-2.3.3.7 1 1.4 1 2.3a1 1 0 0 1-2 0Z" fill="currentColor" />
      <path d="M17.6 19.3c0-.9.7-1.6 1-2.3.3.7 1 1.4 1 2.3a1 1 0 0 1-2 0Z" fill="currentColor" />
    </svg>
  );
}

function SnowIcon({ size = 24, style }: WeatherIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path d={CLOUD_PATH} fill="currentColor" />
      <circle cx="9" cy="19.3" r="1.3" fill="currentColor" />
      <circle cx="13.8" cy="19.3" r="1.3" fill="currentColor" />
      <circle cx="18.6" cy="19.3" r="1.3" fill="currentColor" />
    </svg>
  );
}

function StormIcon({ size = 24, style }: WeatherIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path d={CLOUD_PATH} fill="currentColor" />
      <path d="M13.2 16.5 9.8 21.2h2.6l-1 3.1 4.3-5.4h-2.6l1.1-2.4Z" fill="currentColor" />
    </svg>
  );
}

type DayForecast = { date: string; weatherCode: number; high: number; low: number };
type HourForecast = { time: string; label: string; tempC: number; weatherCode: number };
type WeatherData = {
  tempC: number;
  feelsLikeC: number;
  weatherCode: number;
  humidity: number;
  visibilityMi: number;
  uvIndex: number;
  daily: DayForecast[];
  hourly: HourForecast[];
};

// WMO weather codes → a short label, icon, and colour
// (https://open-meteo.com/en/docs). Colour is a deliberate, scoped exception
// to the app's black-and-white system (same spirit as the rota's shift
// colours and the Insights charts) — just the icon itself, so it reads at a
// glance the way a phone's own weather app does; everything else on this
// widget (numbers, labels, the hourly chart) stays plain black/white.
const CONDITIONS: Record<number, { label: string; Icon: (props: WeatherIconProps) => React.ReactElement; color: string }> = {
  0: { label: "Clear sky", Icon: SunIcon, color: "#F2A900" },
  1: { label: "Mostly clear", Icon: SunIcon, color: "#F2A900" },
  2: { label: "Partly cloudy", Icon: PartlyCloudyIcon, color: "#E0A62E" },
  3: { label: "Overcast", Icon: CloudyIcon, color: "#8A8F98" },
  45: { label: "Foggy", Icon: FogIcon, color: "#93A5B8" },
  48: { label: "Foggy", Icon: FogIcon, color: "#93A5B8" },
  51: { label: "Light drizzle", Icon: RainIcon, color: "#3B82C4" },
  53: { label: "Drizzle", Icon: RainIcon, color: "#3B82C4" },
  55: { label: "Heavy drizzle", Icon: RainIcon, color: "#2E6CA3" },
  56: { label: "Freezing drizzle", Icon: RainIcon, color: "#5B8FBF" },
  57: { label: "Freezing drizzle", Icon: RainIcon, color: "#5B8FBF" },
  61: { label: "Light rain", Icon: RainIcon, color: "#3B82C4" },
  63: { label: "Rain", Icon: RainIcon, color: "#2E6CA3" },
  65: { label: "Heavy rain", Icon: RainIcon, color: "#1F5485" },
  66: { label: "Freezing rain", Icon: RainIcon, color: "#5B8FBF" },
  67: { label: "Freezing rain", Icon: RainIcon, color: "#5B8FBF" },
  71: { label: "Light snow", Icon: SnowIcon, color: "#7FCBE0" },
  73: { label: "Snow", Icon: SnowIcon, color: "#63BBD6" },
  75: { label: "Heavy snow", Icon: SnowIcon, color: "#4AA7C4" },
  77: { label: "Snow grains", Icon: SnowIcon, color: "#7FCBE0" },
  80: { label: "Rain showers", Icon: RainIcon, color: "#3B82C4" },
  81: { label: "Rain showers", Icon: RainIcon, color: "#2E6CA3" },
  82: { label: "Heavy showers", Icon: RainIcon, color: "#1F5485" },
  85: { label: "Snow showers", Icon: SnowIcon, color: "#7FCBE0" },
  86: { label: "Snow showers", Icon: SnowIcon, color: "#63BBD6" },
  95: { label: "Thunderstorm", Icon: StormIcon, color: "#7C5CBF" },
  96: { label: "Thunderstorm", Icon: StormIcon, color: "#7C5CBF" },
  99: { label: "Thunderstorm", Icon: StormIcon, color: "#6246A3" },
};

const REFRESH_MS = 10 * 60 * 1000;

function dayLabel(dateStr: string, index: number): string {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" });
}

// A small sparkline for the next few hours — plain black/white to match the
// app's theme, styled after a typical weather app's hourly strip.
function HourlyChart({ hours }: { hours: HourForecast[] }) {
  if (hours.length < 2) return null;
  const width = 280;
  const height = 48;
  const pad = 8;
  const temps = hours.map((h) => h.tempC);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const span = Math.max(max - min, 1);
  const stepX = (width - pad * 2) / (hours.length - 1);
  const points = temps.map((t, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (t - min) / span) * (height - pad * 2);
    return { x, y };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
        <path d={path} fill="none" stroke={ink} strokeWidth={1.5} />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={i === 0 ? ink : bg} stroke={ink} strokeWidth={1.2} />
        ))}
      </svg>
      <div className="flex justify-between mt-1">
        {hours.map((h, i) => (
          <span key={i} className="text-[10px] tabular-nums" style={{ color: inkSoft, fontWeight: i === 0 ? 600 : 400 }}>
            {h.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);

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

  const todayCondition = weather ? CONDITIONS[weather.weatherCode] : undefined;
  const TodayIcon = todayCondition?.Icon ?? CloudyIcon;
  const today = weather?.daily[0];

  const selected = weather?.daily[selectedDay];
  const selectedCondition = selected ? CONDITIONS[selected.weatherCode] : undefined;
  const SelectedIcon = selectedCondition?.Icon ?? CloudyIcon;

  return (
    <>
      <div
        className="relative overflow-hidden p-4 rounded-2xl"
        style={{ background: bg, border: `1px solid ${border}`, minHeight: 76 }}
      >
        {/* A soft decorative glow behind the reading, echoing a phone weather
            app's background art — stays a plain greyscale circle regardless
            of condition; only the icon itself is coloured (CONDITIONS
            above), a deliberate, scoped exception to the app's otherwise
            black-and-white system. */}
        <div
          aria-hidden
          className="absolute rounded-full pointer-events-none"
          style={{ width: 160, height: 160, top: -70, right: -70, background: "radial-gradient(circle, #00000014, #00000000 70%)" }}
        />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1 text-xs mb-1" style={{ color: inkSoft }}>
              <MapPin size={11} /> Wetherby, LS22
            </div>
            {weather ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-semibold tabular-nums leading-none" style={{ color: navyText }}>
                    {weather.tempC}°
                  </span>
                  <span className="text-sm" style={{ color: ink }}>
                    {todayCondition?.label ?? "—"}
                  </span>
                </div>
                <div className="text-xs mt-1" style={{ color: inkSoft }}>
                  H{today?.high}° L{today?.low}°
                </div>
              </>
            ) : (
              <p className="text-sm" style={{ color: inkSoft }}>
                {error ? "Couldn't load weather" : "Loading weather…"}
              </p>
            )}
          </div>
          <div className="flex flex-col items-center gap-1 shrink-0">
            <TodayIcon size={30} style={{ color: todayCondition?.color ?? inkSoft }} />
            {weather && (
              <button
                onClick={() => setExpanded((e) => !e)}
                aria-label={expanded ? "Hide forecast" : "Show 7-day forecast"}
                style={{ color: inkSoft }}
              >
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
          </div>
        </div>
      </div>

      {expanded && weather && (
        <div
          className="p-3 rounded-2xl"
          style={{ gridColumn: "1 / -1", background: bg, border: `1px solid ${border}` }}
        >
          {/* Current conditions — always "right now", regardless of which
              day is picked below (there's no per-day humidity/UV forecast). */}
          <div className="grid grid-cols-3 gap-2 mb-3 pb-3" style={{ borderBottom: `1px solid ${border}` }}>
            <div className="flex flex-col items-center gap-0.5 text-center">
              <Droplets size={15} style={{ color: inkSoft }} />
              <span className="text-sm font-semibold" style={{ color: navyText }}>
                {weather.humidity}%
              </span>
              <span className="text-[10px]" style={{ color: inkSoft }}>
                Humidity
              </span>
            </div>
            <div className="flex flex-col items-center gap-0.5 text-center">
              <Eye size={15} style={{ color: inkSoft }} />
              <span className="text-sm font-semibold" style={{ color: navyText }}>
                {weather.visibilityMi}mi
              </span>
              <span className="text-[10px]" style={{ color: inkSoft }}>
                Visibility
              </span>
            </div>
            <div className="flex flex-col items-center gap-0.5 text-center">
              <Gauge size={15} style={{ color: inkSoft }} />
              <span className="text-sm font-semibold" style={{ color: navyText }}>
                {weather.uvIndex <= 2 ? "Low" : weather.uvIndex <= 5 ? "Moderate" : weather.uvIndex <= 7 ? "High" : "Very high"}{" "}
                {weather.uvIndex}
              </span>
              <span className="text-[10px]" style={{ color: inkSoft }}>
                UV Index
              </span>
            </div>
          </div>

          <HourlyChart hours={weather.hourly} />

          <div className="flex gap-1.5 overflow-x-auto pb-1 mt-3 mb-3" style={{ scrollbarWidth: "thin" }}>
            {weather.daily.map((d, i) => {
              const active = i === selectedDay;
              return (
                <button
                  key={d.date}
                  onClick={() => setSelectedDay(i)}
                  className="text-xs px-3 py-1.5 rounded-2xl shrink-0 whitespace-nowrap"
                  style={{
                    background: active ? "#000000" : "#FFFFFF",
                    color: active ? "#FFFFFF" : "#000000",
                    border: "1px solid #000000",
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {dayLabel(d.date, i)}
                </button>
              );
            })}
          </div>
          {selected && (
            <div className="flex items-center gap-3">
              <SelectedIcon size={28} style={{ color: selectedCondition?.color ?? inkSoft }} />
              <div>
                <div className="text-sm font-medium" style={{ color: navyText }}>
                  {selectedCondition?.label ?? "—"}
                </div>
                <div className="text-xs" style={{ color: inkSoft }}>
                  High {selected.high}° · Low {selected.low}°
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
