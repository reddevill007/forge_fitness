"use client";

import { useId } from "react";
import { formatVolume } from "@/src/lib/firebase/stats";

export type ChartPoint = { label: string; value: number };

type Coord = { x: number; y: number };

function chartBounds(values: number[]) {
  const max = Math.max(...values, 1);
  return { min: 0, max, span: max || 1 };
}

function smoothLine(points: Coord[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6} ${p2.x} ${p2.y}`;
  }
  return d;
}

function areaFromLine(line: string, left: number, right: number, bottom: number) {
  return `${line} L ${right} ${bottom} L ${left} ${bottom} Z`;
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
  const width = 420;
  const height = 196;
  const pad = { top: 22, right: 16, bottom: 32, left: 12 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const { max } = chartBounds(points.map((point) => point.value));
  const coords = points.map((point, index) => {
    const x = pad.left + (points.length <= 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
    const y = pad.top + innerH - (point.value / max) * innerH;
    return { ...point, x, y };
  });
  const line = smoothLine(coords);
  const latest = coords.at(-1);
  const peak = coords.reduce((best, point) => (point.value > best.value ? point : best), coords[0]);

  return (
    <div className="forge-chart forge-chart-area">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Weekly volume">
        <defs>
          <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.42" />
            <stop offset="55%" stopColor={color} stopOpacity="0.12" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <filter id={`glow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {[0, 0.33, 0.66, 1].map((frac) => (
          <path
            key={frac}
            d={`M${pad.left} ${pad.top + innerH * frac}H${pad.left + innerW}`}
            stroke="currentColor"
            opacity=".08"
            strokeDasharray="4 6"
          />
        ))}
        {coords.length > 1 && (
          <path d={areaFromLine(line, pad.left, pad.left + innerW, pad.top + innerH)} fill={`url(#area-${id})`} />
        )}
        {latest && (
          <path
            d={`M${latest.x} ${pad.top}V${pad.top + innerH}`}
            stroke={color}
            strokeOpacity=".45"
            strokeDasharray="3 5"
            strokeWidth="1.4"
          />
        )}
        {coords.length > 1 && (
          <path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#glow-${id})`}
            vectorEffect="non-scaling-stroke"
          />
        )}
        {coords.map((point) => (
          <g key={`${point.label}-${point.x}`}>
            <circle cx={point.x} cy={point.y} r={point === peak ? 7 : 5} fill="var(--paper-2)" />
            <circle cx={point.x} cy={point.y} r={point === peak ? 4 : 2.6} fill={point === peak ? "var(--orange)" : color} />
          </g>
        ))}
        {coords.map((point, index) => (
          index % Math.ceil(coords.length / 5) === 0 || index === coords.length - 1 ? (
            <text key={`label-${point.label}`} x={point.x} y={height - 10} textAnchor="middle" fill="currentColor" opacity=".45" fontSize="9">
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
        const height = Math.max(10, Math.round((point.value / max) * 100));
        return (
          <div key={`${point.label}-${index}`} className={active ? "is-active" : ""}>
            <span>{point.value ? formatVolume(point.value) : ""}</span>
            <b>
              <i style={{ height: `${height}%`, background: active ? color : undefined }} />
            </b>
            <small>{point.label}</small>
          </div>
        );
      })}
    </div>
  );
}

const PIE_COLORS = [
  "var(--lime)",
  "var(--orange)",
  "var(--blue)",
  "var(--yellow)",
  "var(--lime-dark)",
  "#d27bb0",
];

export function DonutChart({
  points,
  unit = "sets",
}: {
  points: ChartPoint[];
  unit?: string;
}) {
  const id = useId().replace(/:/g, "");
  const slices = points.filter((point) => point.value > 0);
  const total = slices.reduce((sum, point) => sum + point.value, 0);
  if (!total) {
    return <p className="chart-empty">Nothing to chart yet.</p>;
  }
  const cx = 80;
  const cy = 80;
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const gap = Math.min(10, circumference / (slices.length * 8));
  const usable = circumference - gap * slices.length;
  let offset = 0;
  const arcs = slices.map((point, index) => {
    const length = Math.max(usable * (point.value / total), 1);
    const dashoffset = circumference * 0.25 - offset;
    offset += length + gap;
    return {
      ...point,
      color: PIE_COLORS[index % PIE_COLORS.length],
      dash: `${length} ${circumference - length}`,
      dashoffset,
    };
  });
  const top = slices[0];

  return (
    <div className="forge-pie">
      <div className="forge-pie-ring">
        <svg viewBox="0 0 160 160" role="img" aria-label={`${unit} split`}>
          <defs>
            <filter id={`pie-shadow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#171916" floodOpacity="0.12" />
            </filter>
          </defs>
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--paper-3)" strokeWidth="22" />
          <g filter={`url(#pie-shadow-${id})`}>
            {arcs.map((slice) => (
              <circle
                key={slice.label}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth="22"
                strokeLinecap="round"
                strokeDasharray={slice.dash}
                strokeDashoffset={slice.dashoffset}
              />
            ))}
          </g>
        </svg>
        <div className="forge-pie-center">
          <strong>{total}</strong>
          <small>{unit}</small>
        </div>
      </div>
      <ul className="forge-pie-legend">
        {arcs.map((slice) => (
          <li key={slice.label}>
            <i style={{ background: slice.color }} />
            <span>{slice.label}</span>
            <b>{Math.round((slice.value / total) * 100)}%</b>
          </li>
        ))}
      </ul>
      {top ? <p className="forge-pie-note">{top.label} leads this split.</p> : null}
    </div>
  );
}

export function WeekActivity({ points }: { points: ChartPoint[] }) {
  const max = Math.max(...points.map((point) => point.value), 1);
  const today = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()];
  return (
    <div className="week-activity">
      {points.map((point) => {
        const height = point.value ? Math.max(18, Math.round((point.value / max) * 100)) : 10;
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
