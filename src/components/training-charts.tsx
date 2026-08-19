"use client";

import { useId, useState } from "react";
import { formatVolume } from "@/src/lib/firebase/stats";

export type ChartPoint = { label: string; value: number };

type Coord = ChartPoint & { x: number; y: number };

function chartBounds(values: number[], fit = false) {
  const maxRaw = Math.max(...values, 1);
  if (!fit) return { min: 0, max: maxRaw, span: maxRaw || 1 };
  const minRaw = Math.min(...values);
  const pad = Math.max(0.6, (maxRaw - minRaw) * 0.22 || maxRaw * 0.04);
  const min = Math.max(0, minRaw - pad);
  const max = maxRaw + pad;
  return { min, max, span: max - min || 1 };
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

function niceTicks(min: number, max: number, count = 4) {
  const span = max - min || 1;
  const step = span / (count - 1);
  return Array.from({ length: count }, (_, index) => {
    const value = max - step * index;
    return {
      value,
      label: value >= 100 ? String(Math.round(value)) : String(Math.round(value * 10) / 10),
    };
  });
}

export function AreaChart({
  points,
  color = "var(--lime)",
  unit = "kg",
  fit = false,
  callout,
  formatValue = formatVolume,
}: {
  points: ChartPoint[];
  color?: string;
  unit?: string;
  fit?: boolean;
  callout?: string | false;
  formatValue?: (value: number) => string;
}) {
  const rawId = useId();
  const id = rawId.replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const width = 560;
  const height = 248;
  const pad = { top: 28, right: 18, bottom: 34, left: 38 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const { min, max, span } = chartBounds(points.map((point) => point.value), fit);
  if (points.length === 0) {
    return <p className="chart-empty">Nothing to chart yet.</p>;
  }
  const coords = points.map((point, index) => {
    const x = pad.left + (points.length <= 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
    const y = pad.top + innerH - ((point.value - min) / span) * innerH;
    return { ...point, x, y };
  });
  const line = smoothLine(coords);
  const latest = coords.at(-1);
  const peak = coords.reduce((best, point) => (point.value > best.value ? point : best), coords[0]);
  const shown = hover != null ? coords[hover] : latest;
  const ticks = niceTicks(min, max);
  const labelEvery = Math.max(1, Math.ceil(coords.length / 6));

  return (
    <div className="forge-chart forge-chart-area">
      <div className="forge-chart-well">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${unit} over time`}>
          <defs>
            <pattern id={`dots-${id}`} width="8" height="8" patternUnits="userSpaceOnUse">
              <circle cx="1.2" cy="1.2" r="0.7" fill="currentColor" opacity="0.14" />
            </pattern>
            <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.55" />
              <stop offset="48%" stopColor={color} stopOpacity="0.16" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`stroke-${id}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={color} stopOpacity="0.55" />
              <stop offset="70%" stopColor={color} />
              <stop offset="100%" stopColor={color} />
            </linearGradient>
            <filter id={`glow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect
            x={pad.left}
            y={pad.top}
            width={innerW}
            height={innerH}
            fill={`url(#dots-${id})`}
            opacity="0.9"
          />
          {ticks.map((tick) => {
            const y = pad.top + ((max - tick.value) / span) * innerH;
            return (
              <g key={tick.label} className="forge-chart-grid">
                <path d={`M${pad.left} ${y}H${pad.left + innerW}`} />
                <text x={pad.left - 8} y={y + 3} textAnchor="end">{tick.label}</text>
              </g>
            );
          })}
          {coords.length > 1 && (
            <path
              className="forge-chart-fill"
              d={areaFromLine(line, pad.left, pad.left + innerW, pad.top + innerH)}
              fill={`url(#area-${id})`}
            />
          )}
          {shown && (
            <path
              className="forge-chart-now"
              d={`M${shown.x} ${pad.top}V${pad.top + innerH}`}
              stroke={color}
            />
          )}
          {coords.length > 1 && (
            <path
              className="forge-chart-line"
              d={line}
              fill="none"
              stroke={`url(#stroke-${id})`}
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={`url(#glow-${id})`}
              pathLength={1}
            />
          )}
          {peak && peak.value > 0 && (
            <g className="forge-chart-peak">
              <path d={`M${peak.x} ${peak.y - 14}l3.2-3.2 3.6.4-2.2 3.4 2.8 3.1-3.8-.7-2.8 2.6.2-3.8-3.4-1.8z`} fill="var(--orange)" />
              <text x={peak.x + 12} y={peak.y - 10}>peak</text>
            </g>
          )}
          {coords.map((point, index) => {
            const isLatest = point === latest;
            const isPeak = point === peak && point.value > 0;
            const isHover = hover === index;
            return (
              <g
                key={`${point.label}-${index}`}
                className={`forge-chart-dot${isLatest ? " is-now" : ""}${isHover ? " is-hover" : ""}`}
                onMouseEnter={() => setHover(index)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(index)}
                onBlur={() => setHover(null)}
              >
                <circle className="forge-chart-hit" cx={point.x} cy={point.y} r="14" />
                {isLatest ? <circle className="forge-chart-pulse" cx={point.x} cy={point.y} r="9" stroke={color} /> : null}
                <circle cx={point.x} cy={point.y} r={isPeak || isLatest || isHover ? 5.2 : 3.4} fill="var(--paper)" />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isPeak || isLatest || isHover ? 3.2 : 2.1}
                  fill={isPeak ? "var(--orange)" : color}
                />
              </g>
            );
          })}
          {coords.map((point, index) => (
            index % labelEvery === 0 || index === coords.length - 1 ? (
              <text key={`label-${point.label}-${index}`} className="forge-chart-xlabel" x={point.x} y={height - 10} textAnchor="middle">
                {point.label}
              </text>
            ) : null
          ))}
        </svg>
      </div>
      {shown && callout !== false ? (
        <div className="forge-chart-callout">
          <strong>{formatValue(shown.value)}</strong>
          <small>{hover != null ? shown.label : (callout ?? `${unit} this week`)}</small>
        </div>
      ) : null}
    </div>
  );
}

export function VolumeBars({
  points,
  color = "var(--lime)",
  compact = false,
  formatValue = formatVolume,
}: {
  points: ChartPoint[];
  color?: string;
  compact?: boolean;
  formatValue?: (value: number) => string;
}) {
  const max = Math.max(...points.map((point) => point.value), 1);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div
      className={`forge-bars${compact ? " is-daily" : ""}`}
      style={{ gridTemplateColumns: `repeat(${Math.max(points.length, 1)}, minmax(0, 1fr))` }}
    >
      {points.map((point, index) => {
        const active = index === points.length - 1 || hover === index;
        const height = point.value ? Math.max(12, Math.round((point.value / max) * 100)) : 8;
        return (
          <div
            key={`${point.label}-${index}`}
            className={active ? "is-active" : ""}
            style={{ ["--i" as string]: index }}
            onMouseEnter={() => setHover(index)}
            onMouseLeave={() => setHover(null)}
          >
            <span>{point.value ? formatValue(point.value) : ""}</span>
            <b>
              <i style={{ height: `${height}%`, background: active ? color : undefined, ["--bar" as string]: color }} />
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
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const gap = Math.min(12, circumference / (slices.length * 7));
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
      pct: Math.round((point.value / total) * 100),
    };
  });
  const top = arcs[0];

  return (
    <div className="forge-pie">
      <div className="forge-pie-ring">
        <svg viewBox="0 0 160 160" role="img" aria-label={`${unit} split`}>
          <defs>
            <filter id={`pie-shadow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="3" stdDeviation="3.5" floodColor="#171916" floodOpacity="0.16" />
            </filter>
          </defs>
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--paper-3)" strokeWidth="18" />
          <circle cx={cx} cy={cy} r={70} fill="none" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="2 6" />
          <g filter={`url(#pie-shadow-${id})`}>
            {arcs.map((slice) => (
              <circle
                key={slice.label}
                className="forge-pie-arc"
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth="18"
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
            <b>{slice.pct}%</b>
            <em style={{ ["--pct" as string]: `${slice.pct}%`, ["--swatch" as string]: slice.color }} />
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
      {points.map((point, index) => {
        const height = point.value ? Math.max(22, Math.round((point.value / max) * 100)) : 10;
        const isToday = point.label === today || (today === "Sun" && point.label === "Sun");
        return (
          <div key={point.label} className={isToday ? "is-today" : ""} style={{ ["--i" as string]: index }}>
            <i style={{ height: `${height}%` }} data-count={point.value || undefined} />
            <span>{point.label.slice(0, 2)}</span>
          </div>
        );
      })}
    </div>
  );
}

export { MiniChart as SparkArea } from "@/src/components/doodles";
