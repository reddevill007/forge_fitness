"use client";

import { useId } from "react";
import { formatVolume } from "@/src/lib/firebase/stats";

export type ChartPoint = { label: string; value: number };

function chartBounds(values: number[]) {
  const max = Math.max(...values, 1);
  const min = 0;
  return { min, max, span: max - min || 1 };
}

export function AreaChart({
  points,
  color = "var(--lime)",
  unit = "kg",
}: {
  points: ChartPoint[];
  color?: string;
  unit?: string;
}) {
  const rawId = useId();
  const id = rawId.replace(/:/g, "");
  const width = 360;
  const height = 168;
  const pad = { top: 18, right: 10, bottom: 28, left: 10 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const { max } = chartBounds(points.map((point) => point.value));
  const coords = points.map((point, index) => {
    const x = pad.left + (points.length <= 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
    const y = pad.top + innerH - (point.value / max) * innerH;
    return { ...point, x, y };
  });
  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${pad.left},${pad.top + innerH} ${line} ${pad.left + innerW},${pad.top + innerH}`;
  const latest = coords.at(-1);

  return (
    <div className="forge-chart forge-chart-area">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Weekly volume">
        <defs>
          <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.55" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((frac) => (
          <path
            key={frac}
            d={`M${pad.left} ${pad.top + innerH * frac}H${pad.left + innerW}`}
            stroke="currentColor"
            opacity=".1"
            strokeDasharray="3 5"
          />
        ))}
        {coords.length > 1 && <polygon points={area} fill={`url(#area-${id})`} />}
        {coords.length > 1 && (
          <polyline
            points={line}
            fill="none"
            stroke={color}
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {coords.map((point) => (
          <circle key={`${point.label}-${point.x}`} cx={point.x} cy={point.y} r={point === latest ? 4 : 2.4} fill={color} />
        ))}
        {coords.map((point, index) => (
          index % Math.ceil(coords.length / 4) === 0 || index === coords.length - 1 ? (
            <text key={`label-${point.label}`} x={point.x} y={height - 8} textAnchor="middle" fill="currentColor" opacity=".55" fontSize="9">
              {point.label}
            </text>
          ) : null
        ))}
      </svg>
      {latest ? (
        <div className="forge-chart-callout">
          <strong>{formatVolume(latest.value)}</strong>
          <small>{unit} this week</small>
        </div>
      ) : null}
    </div>
  );
}

export function VolumeBars({
  points,
  color = "var(--lime)",
}: {
  points: ChartPoint[];
  color?: string;
}) {
  const max = Math.max(...points.map((point) => point.value), 1);
  return (
    <div className="forge-bars" style={{ gridTemplateColumns: `repeat(${Math.max(points.length, 1)}, minmax(0, 1fr))` }}>
      {points.map((point, index) => {
        const active = index === points.length - 1;
        const height = Math.max(8, Math.round((point.value / max) * 100));
        return (
          <div key={`${point.label}-${index}`} className={active ? "is-active" : ""}>
            <span>{point.value ? formatVolume(point.value) : ""}</span>
            <i style={{ height: `${height}%`, background: active ? color : undefined }} />
            <small>{point.label}</small>
          </div>
        );
      })}
    </div>
  );
}

export function WeekActivity({ points }: { points: ChartPoint[] }) {
  const max = Math.max(...points.map((point) => point.value), 1);
  const today = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()];
  return (
    <div className="week-activity">
      {points.map((point) => {
        const height = point.value ? Math.max(18, Math.round((point.value / max) * 100)) : 8;
        const isToday = point.label === today || (today === "Sun" && point.label === "Sun");
        return (
          <div key={point.label} className={isToday ? "is-today" : ""}>
            <i style={{ height: `${height}%` }} data-count={point.value || undefined} />
            <span>{point.label.slice(0, 2)}</span>
          </div>
        );
      })}
    </div>
  );
}

export { MiniChart as SparkArea } from "@/src/components/doodles";

