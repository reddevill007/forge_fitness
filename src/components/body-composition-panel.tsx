"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/src/components/confirm-dialog";
import { AreaChart } from "@/src/components/training-charts";
import { SectionTitle } from "@/src/components/ui";
import { formatKg } from "@/src/lib/body-metrics";
import {
  BODY_MASS_PARTS,
  BODY_SEGMENTS,
  compositionDateLabel,
  compositionDelta,
  hasComposition,
} from "@/src/lib/body-composition";
import type { BodyMeasurement } from "@/src/types/fitness";

function signed(value?: number, unit = "kg") {
  if (value == null) return "—";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value} ${unit}`;
}

function deltaLabel(delta: number | null, unit: string) {
  if (delta == null) return null;
  const prefix = delta > 0 ? "+" : "";
  return `${prefix}${delta}${unit ? ` ${unit}` : ""}`;
}

function seriesFor(scans: BodyMeasurement[], key: "weight" | "bodyFat" | "skeletalMuscleKg") {
  return scans
    .filter((item) => item[key] != null)
    .map((item) => ({
      label: new Date(item.measuredAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: item[key] as number,
    }));
}

function ScanReadout({
  measurement,
  previous,
}: {
  measurement: BodyMeasurement;
  previous?: BodyMeasurement;
}) {
  const massTotal = BODY_MASS_PARTS.reduce((sum, part) => sum + (measurement[part.key] ?? 0), 0);
  const stamped = new Date(measurement.measuredAt);
  const weightDelta = compositionDelta(measurement.weight, previous?.weight);
  const fatDelta = compositionDelta(measurement.bodyFat, previous?.bodyFat);
  const muscleDelta = compositionDelta(measurement.skeletalMuscleKg, previous?.skeletalMuscleKg);

  return (
    <>
      <div className="body-scan-head">
        <div>
          <span className="eyebrow">Composition lab</span>
          <h2>{measurement.obesityType || "Scan readout"}</h2>
          <p>
            {stamped.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            {measurement.source === "scan" ? " · from report" : measurement.source === "chat" ? " · from Coach" : ""}
            {previous ? ` · vs ${compositionDateLabel(previous.measuredAt)}` : ""}
          </p>
        </div>
        <div className="body-scan-pills">
          {measurement.bodyAge != null ? <span>Body age <b>{measurement.bodyAge}</b></span> : null}
          {measurement.visceralFatIndex != null ? <span>Visceral <b>{measurement.visceralFatIndex}</b></span> : null}
          {measurement.healthScore != null ? <span>Score <b>{measurement.healthScore}</b></span> : null}
        </div>
      </div>

      {massTotal > 0 ? (
        <div className="body-comp-stack">
          <div className="body-comp-bar" aria-hidden="true">
            {BODY_MASS_PARTS.map((part) => {
              const value = measurement[part.key];
              if (!value) return null;
              return (
                <i
                  key={part.key}
                  style={{ width: `${Math.max(6, (value / massTotal) * 100)}%`, background: part.color }}
                />
              );
            })}
          </div>
          <ul className="body-comp-legend">
            {BODY_MASS_PARTS.map((part) => {
              const value = measurement[part.key];
              if (!value) return null;
              return (
                <li key={part.key}>
                  <i style={{ background: part.color }} />
                  <span>{part.label}</span>
                  <strong>{formatKg(value)} kg</strong>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="body-scan-stats">
        {[
          { label: "Weight", value: measurement.weight != null ? `${formatKg(measurement.weight)} kg` : "—", delta: deltaLabel(weightDelta, "kg") },
          { label: "Body fat", value: measurement.bodyFat != null ? `${measurement.bodyFat}%` : "—", delta: deltaLabel(fatDelta, "%") },
          { label: "Skeletal muscle", value: measurement.skeletalMuscleKg != null ? `${formatKg(measurement.skeletalMuscleKg)} kg` : "—", delta: deltaLabel(muscleDelta, "kg") },
          { label: "BMI", value: measurement.bmi != null ? String(measurement.bmi) : "—" },
          { label: "Fat mass", value: measurement.fatKg != null ? `${formatKg(measurement.fatKg)} kg` : "—" },
          { label: "Fat-free", value: measurement.fatFreeMassKg != null ? `${formatKg(measurement.fatFreeMassKg)} kg` : "—" },
        ].filter((item) => item.value !== "—").map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            {item.delta ? (
              <em className={`body-scan-delta ${item.delta.startsWith("+") ? "is-up" : "is-down"}`}>{item.delta}</em>
            ) : null}
          </div>
        ))}
      </div>

      {measurement.segmental && BODY_SEGMENTS.some((site) => measurement.segmental?.[site.id]) ? (
        <div className="body-seg-block">
          <span className="eyebrow">Segmental</span>
          <ul className="body-seg-grid">
            {BODY_SEGMENTS.map((site) => {
              const row = measurement.segmental?.[site.id];
              if (!row) return null;
              return (
                <li key={site.id}>
                  <strong>{site.label}</strong>
                  <span>{row.muscleKg != null ? `${formatKg(row.muscleKg)} kg muscle` : "—"}</span>
                  <em>{row.fatKg != null ? `${formatKg(row.fatKg)} kg fat` : ""}</em>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {(measurement.targetWeightKg != null || measurement.weightControlKg != null || measurement.basalMetabolismKcal != null) && (
        <div className="body-scan-targets">
          {measurement.targetWeightKg != null ? (
            <div>
              <span>Target</span>
              <strong>{formatKg(measurement.targetWeightKg)} kg</strong>
            </div>
          ) : null}
          {measurement.weightControlKg != null ? (
            <div>
              <span>Weight control</span>
              <strong>{signed(measurement.weightControlKg)}</strong>
            </div>
          ) : null}
          {measurement.fatControlKg != null ? (
            <div>
              <span>Fat control</span>
              <strong>{signed(measurement.fatControlKg)}</strong>
            </div>
          ) : null}
          {measurement.muscleControlKg != null ? (
            <div>
              <span>Muscle control</span>
              <strong>{signed(measurement.muscleControlKg)}</strong>
            </div>
          ) : null}
          {measurement.basalMetabolismKcal != null ? (
            <div>
              <span>BMR</span>
              <strong>{measurement.basalMetabolismKcal} kcal</strong>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}

export function BodyCompositionPanel({
  measurements,
  onDelete,
}: {
  measurements: BodyMeasurement[];
  onDelete: (ids: string[]) => Promise<void>;
}) {
  const scans = useMemo(
    () => measurements.filter((item) => hasComposition(item)),
    [measurements],
  );
  const chronological = useMemo(
    () => [...scans].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt)),
    [scans],
  );
  const [selectedId, setSelectedId] = useState(scans[0]?.id ?? "");
  const [pending, setPending] = useState<"one" | "all" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!scans.some((item) => item.id === selectedId)) {
      setSelectedId(scans[0]?.id ?? "");
    }
  }, [scans, selectedId]);

  const selected = scans.find((item) => item.id === selectedId) ?? scans[0];
  const previous = selected
    ? chronological[chronological.findIndex((item) => item.id === selected.id) - 1]
    : undefined;
  const weightPoints = useMemo(() => seriesFor(chronological, "weight"), [chronological]);
  const fatPoints = useMemo(() => seriesFor(chronological, "bodyFat"), [chronological]);
  const musclePoints = useMemo(() => seriesFor(chronological, "skeletalMuscleKg"), [chronological]);

  async function confirmDelete() {
    if (!pending || !selected) return;
    const ids = pending === "all" ? scans.map((item) => item.id) : [selected.id];
    setBusy(true);
    try {
      await onDelete(ids);
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  if (!selected) return null;

  return (
    <>
    <section className="body-scan-panel paper-panel reveal">
      {scans.length > 1 ? (
        <div className="body-scan-picker" role="tablist" aria-label="Saved reports">
          {scans.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === selected.id}
              className={item.id === selected.id ? "is-active" : ""}
              onClick={() => setSelectedId(item.id)}
            >
              <small>{compositionDateLabel(item.measuredAt)}</small>
              <strong>
                {item.weight != null ? `${formatKg(item.weight)} kg` : item.bodyFat != null ? `${item.bodyFat}% fat` : "Scan"}
              </strong>
            </button>
          ))}
        </div>
      ) : null}

      {chronological.length > 1 ? (
        <div className="body-scan-progress">
          <SectionTitle eyebrow="Progress" title={`${chronological.length} reports`} />
          <div className="body-scan-ledger" role="list">
            {chronological.map((item, index) => {
              const prior = chronological[index - 1];
              const fat = compositionDelta(item.bodyFat, prior?.bodyFat);
              const muscle = compositionDelta(item.skeletalMuscleKg, prior?.skeletalMuscleKg);
              return (
                <button
                  key={item.id}
                  type="button"
                  role="listitem"
                  className={`body-scan-ledger-row ${item.id === selected.id ? "is-active" : ""}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <strong>{compositionDateLabel(item.measuredAt)}</strong>
                  <span>{item.weight != null ? `${formatKg(item.weight)} kg` : "—"}</span>
                  <span>{item.bodyFat != null ? `${item.bodyFat}%` : "—"}</span>
                  <span>{item.skeletalMuscleKg != null ? `${formatKg(item.skeletalMuscleKg)} kg` : "—"}</span>
                  <em>
                    {[
                      fat != null ? `${fat > 0 ? "+" : ""}${fat}% fat` : null,
                      muscle != null ? `${muscle > 0 ? "+" : ""}${muscle} kg muscle` : null,
                    ].filter(Boolean).join(" · ") || (index === 0 ? "Baseline" : "")}
                  </em>
                </button>
              );
            })}
          </div>
          <div className="body-scan-charts">
            {weightPoints.length > 1 ? (
              <div>
                <span>Weight</span>
                <AreaChart points={weightPoints} color="var(--orange)" unit="kg" fit callout={false} formatValue={formatKg} />
              </div>
            ) : null}
            {fatPoints.length > 1 ? (
              <div>
                <span>Body fat</span>
                <AreaChart points={fatPoints} color="var(--lime)" unit="%" fit callout={false} formatValue={(value) => `${value}`} />
              </div>
            ) : null}
            {musclePoints.length > 1 ? (
              <div>
                <span>Skeletal muscle</span>
                <AreaChart points={musclePoints} color="var(--blue)" unit="kg" fit callout={false} formatValue={formatKg} />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <ScanReadout measurement={selected} previous={previous} />

      <div className="body-scan-toolbar">
        <button type="button" className="outline-button" onClick={() => setPending("one")}>
          <Trash2 size={16} /> Remove this report
        </button>
        {scans.length > 1 ? (
          <button type="button" className="danger-button" onClick={() => setPending("all")}>
            Remove all reports
          </button>
        ) : null}
      </div>
    </section>
    {pending ? (
      <ConfirmDialog
        title={pending === "all" ? "Remove every scan?" : "Remove this report?"}
        copy={
          pending === "all"
            ? "This deletes all saved composition reports so you can import a fresh set. Weigh-ins without scan data stay."
            : `Delete the ${compositionDateLabel(selected.measuredAt)} composition report. You can import a new scan after.`
        }
        confirmLabel={pending === "all" ? "Remove all" : "Remove report"}
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (!busy) setPending(null);
        }}
      />
    ) : null}
    </>
  );
}
