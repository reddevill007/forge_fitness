"use client";

import {
  Activity,
  Camera,
  Flame,
  Images,
  Plus,
  Ruler,
  Scale,
  Trash2,
  Upload,
  Utensils,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AnatomeBodyScan,
  BODY_SITES,
  measuredMusclesFromValues,
  trainingHeatFromSessions,
  type BodySiteId,
} from "@/src/components/anatome-body-scan";
import { ContextualAiActions } from "@/src/components/coach/contextual-actions";
import { MiniChart } from "@/src/components/doodles";
import { AreaChart, DonutChart, VolumeBars } from "@/src/components/training-charts";
import { PageIntro, SectionTitle } from "@/src/components/ui";
import { ACTIVITY_OPTIONS, computeBodyMetrics, formatKg, parsePositive } from "@/src/lib/body-metrics";
import { useCoachPage } from "@/src/lib/coach/context";
import type { ActivityLevel, BodySex } from "@/src/lib/firebase/types";
import { loggedSessions, sessionDate } from "@/src/lib/firebase/stats";
import { useUserData } from "@/src/lib/firebase/user-data-context";
import type { BodyPhotoPose } from "@/src/types/fitness";

const MEASUREMENT_FIELDS = [
  { key: "waist", label: "Waist", unit: "cm" },
  { key: "hips", label: "Hips", unit: "cm" },
  { key: "chest", label: "Chest", unit: "cm" },
  { key: "arms", label: "Arms", unit: "cm" },
  { key: "thighs", label: "Thighs", unit: "cm" },
  { key: "calves", label: "Calves", unit: "cm" },
  { key: "bodyFat", label: "Body fat", unit: "%" },
] as const;

const POSES: Array<{ id: BodyPhotoPose; label: string }> = [
  { id: "front", label: "Front" },
  { id: "side", label: "Side" },
  { id: "back", label: "Back" },
];

type FieldKey = (typeof MEASUREMENT_FIELDS)[number]["key"];

function todayInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function roundDelta(value: number) {
  return Math.round(value * 10) / 10;
}

function seriesFor(measurements: Array<{ measuredAt: string; [key: string]: string | number | undefined }>, key: FieldKey) {
  return [...measurements]
    .filter((item) => parsePositive(item[key]))
    .reverse()
    .slice(-10)
    .map((item) => ({
      label: new Date(item.measuredAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: item[key] as number,
    }));
}

export function BodyPage() {
  const {
    measurements,
    saveMeasurement,
    profile,
    updateUserProfile,
    bodyPhotos,
    saveBodyPhoto,
    deleteBodyPhoto,
    sessions,
    workouts,
    activeSession,
  } = useUserData();
  const [weight, setWeight] = useState("");
  const [measuredOn, setMeasuredOn] = useState(todayInputValue);
  const [extras, setExtras] = useState<Record<FieldKey, string>>({
    waist: "",
    hips: "",
    chest: "",
    arms: "",
    thighs: "",
    calves: "",
    bodyFat: "",
  });
  const [height, setHeight] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<BodySex | "">("");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderate");
  const [savingCheckin, setSavingCheckin] = useState(false);
  const [savingSpecs, setSavingSpecs] = useState(false);
  const [logging, setLogging] = useState(false);
  const [editingSpecs, setEditingSpecs] = useState(false);
  const [addingPhoto, setAddingPhoto] = useState(false);
  const [photoPose, setPhotoPose] = useState<BodyPhotoPose>("front");
  const [photoDate, setPhotoDate] = useState(todayInputValue);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [comparePose, setComparePose] = useState<BodyPhotoPose>("front");
  const [compareSplit, setCompareSplit] = useState(58);
  const cameraInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const [mapView, setMapView] = useState<"front" | "back" | "dual">("dual");
  const [selectedSite, setSelectedSite] = useState<BodySiteId | null>(null);
  useCoachPage({ currentPage: "body" });

  useEffect(() => {
    if (editingSpecs) return;
    setHeight(profile?.heightCm ? String(profile.heightCm) : "");
    setAge(profile?.age ? String(profile.age) : "");
    setSex(profile?.sex ?? "");
    setActivityLevel(profile?.activityLevel ?? "moderate");
  }, [profile?.heightCm, profile?.age, profile?.sex, profile?.activityLevel, editingSpecs]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview("");
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  useEffect(() => {
    if (!logging && !editingSpecs && !addingPhoto) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (logging && !savingCheckin) closeCheckin();
      if (editingSpecs && !savingSpecs) closeSpecs();
      if (addingPhoto && !savingPhoto) closePhoto();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [logging, editingSpecs, addingPhoto, savingCheckin, savingSpecs, savingPhoto]);

  const latest = measurements[0];
  const previous = measurements.find((item, index) => index > 0 && item.weight);
  const latestWeight = parsePositive(latest?.weight);
  const weightDelta = latestWeight && previous?.weight ? roundDelta(latestWeight - previous.weight) : null;
  const weights = measurements.map((item) => item.weight).filter((value): value is number => Boolean(parsePositive(value)));
  const lowWeight = weights.length ? Math.min(...weights) : null;
  const highWeight = weights.length ? Math.max(...weights) : null;
  const chartPoints = useMemo(
    () =>
      [...measurements]
        .filter((item) => parsePositive(item.weight))
        .reverse()
        .slice(-16)
        .map((item) => ({
          label: new Date(item.measuredAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          value: item.weight as number,
        })),
    [measurements],
  );
  const waistPoints = useMemo(() => seriesFor(measurements, "waist"), [measurements]);
  const fatPoints = useMemo(() => seriesFor(measurements, "bodyFat"), [measurements]);

  const metrics = computeBodyMetrics({
    weightKg: latestWeight,
    heightCm: parsePositive(height) ?? profile?.heightCm,
    age: parsePositive(age) ?? profile?.age,
    sex: sex || profile?.sex,
    activityLevel,
    goal: profile?.goal,
  });

  const macroPoints = metrics
    ? [
        { label: "Protein", value: metrics.proteinG * 4 },
        { label: "Carbs", value: metrics.carbsG * 4 },
        { label: "Fat", value: metrics.fatG * 9 },
      ]
    : [];

  const training = useMemo(() => loggedSessions(sessions, activeSession), [sessions, activeSession]);
  const recentTraining = useMemo(() => {
    const since = Date.now() - 21 * 24 * 60 * 60 * 1000;
    return training.filter((session) => new Date(sessionDate(session)).getTime() >= since);
  }, [training]);
  const trainingBySlug = useMemo(
    () => trainingHeatFromSessions(recentTraining, workouts),
    [recentTraining, workouts],
  );
  const siteValues = useMemo(
    () => ({
      chest: parsePositive(latest?.chest),
      waist: parsePositive(latest?.waist),
      hips: parsePositive(latest?.hips),
      arms: parsePositive(latest?.arms),
      thighs: parsePositive(latest?.thighs),
      calves: parsePositive(latest?.calves),
    }),
    [latest?.chest, latest?.waist, latest?.hips, latest?.arms, latest?.thighs, latest?.calves],
  );
  const measuredMuscles = useMemo(() => measuredMusclesFromValues(siteValues), [siteValues]);
  const tapedCount = BODY_SITES.filter((site) => siteValues[site.id]).length;
  const selected = BODY_SITES.find((site) => site.id === selectedSite) ?? null;
  const selectedValue = selected ? siteValues[selected.id] : null;
  const selectedDelta = selected
    ? (() => {
        const current = siteValues[selected.id];
        if (!current) return null;
        const prior = measurements.slice(1).find((item) => parsePositive(item[selected.id]));
        const previousValue = parsePositive(prior?.[selected.id]);
        return previousValue ? roundDelta(current - previousValue) : null;
      })()
    : null;
  const selectedMuscles = selected ? [...selected.muscles] : [];
  const gender = profile?.sex === "female" ? "female" : "male";
  const trainedSets = selected
    ? selected.muscles.reduce((total, slug) => total + (trainingBySlug.get(slug) ?? 0), 0)
    : [...trainingBySlug.values()].reduce((total, sets) => total + sets, 0);
  const activityLabel = ACTIVITY_OPTIONS.find((item) => item.id === (profile?.activityLevel ?? activityLevel))?.label;

  const healthIndex = useMemo(() => {
    let score = 28;
    if (latestWeight) score += 14;
    if (profile?.heightCm) score += 10;
    if (profile?.age && profile?.sex) score += 8;
    if (latest?.waist) score += 8;
    if (metrics) {
      if (metrics.bmi >= 18.5 && metrics.bmi < 25) score += 32;
      else if (metrics.bmi >= 17 && metrics.bmi < 30) score += 18;
      else score += 8;
    }
    return Math.min(100, score);
  }, [latestWeight, latest?.waist, profile?.heightCm, profile?.age, profile?.sex, metrics]);
  const bmiPin = metrics ? Math.min(96, Math.max(4, ((metrics.bmi - 15) / 25) * 100)) : 22;

  const posePhotos = bodyPhotos.filter((item) => item.pose === comparePose).slice().reverse();
  const beforePhoto = posePhotos[0];
  const afterPhoto = posePhotos.at(-1);
  const canCompare = Boolean(beforePhoto && afterPhoto && beforePhoto.id !== afterPhoto.id);

  async function handleCheckin(event: React.FormEvent) {
    event.preventDefault();
    const nextWeight = parsePositive(weight);
    const measuredAt = new Date(`${measuredOn || todayInputValue()}T12:00:00`).toISOString();
    const payload = Object.fromEntries(
      MEASUREMENT_FIELDS.flatMap((field) => {
        const value = parsePositive(extras[field.key]);
        return value ? [[field.key, value]] : [];
      }),
    );
    if (!nextWeight) return;
    setSavingCheckin(true);
    try {
      await saveMeasurement({
        measuredAt,
        weight: nextWeight,
        ...payload,
      });
      setWeight("");
      setExtras({ waist: "", hips: "", chest: "", arms: "", thighs: "", calves: "", bodyFat: "" });
      setMeasuredOn(todayInputValue());
      setLogging(false);
    } finally {
      setSavingCheckin(false);
    }
  }

  function closeCheckin() {
    if (savingCheckin) return;
    setLogging(false);
    setWeight("");
    setExtras({ waist: "", hips: "", chest: "", arms: "", thighs: "", calves: "", bodyFat: "" });
    setMeasuredOn(todayInputValue());
  }

  async function handleSpecs(event: React.FormEvent) {
    event.preventDefault();
    const heightCm = parsePositive(height);
    const nextAge = parsePositive(age);
    setSavingSpecs(true);
    try {
      await updateUserProfile({
        ...(heightCm ? { heightCm } : {}),
        ...(nextAge ? { age: Math.round(nextAge) } : {}),
        ...(sex ? { sex } : {}),
        activityLevel,
      });
      setEditingSpecs(false);
    } finally {
      setSavingSpecs(false);
    }
  }

  function closeSpecs() {
    if (savingSpecs) return;
    setEditingSpecs(false);
    setHeight(profile?.heightCm ? String(profile.heightCm) : "");
    setAge(profile?.age ? String(profile.age) : "");
    setSex(profile?.sex ?? "");
    setActivityLevel(profile?.activityLevel ?? "moderate");
  }

  function closePhoto() {
    if (savingPhoto) return;
    setAddingPhoto(false);
    setPhotoFile(null);
    setPhotoError("");
    setPhotoDate(todayInputValue());
    if (cameraInput.current) cameraInput.current.value = "";
    if (uploadInput.current) uploadInput.current.value = "";
  }

  function pickPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoFile(file);
    setPhotoError("");
  }

  async function handlePhoto(event: React.FormEvent) {
    event.preventDefault();
    if (!photoFile) {
      setPhotoError("Take a photo or upload one first.");
      return;
    }
    setSavingPhoto(true);
    setPhotoError("");
    try {
      await saveBodyPhoto({
        file: photoFile,
        pose: photoPose,
        takenAt: new Date(`${photoDate || todayInputValue()}T12:00:00`).toISOString(),
        weight: latestWeight,
      });
      setComparePose(photoPose);
      setAddingPhoto(false);
      setPhotoFile(null);
      setPhotoError("");
      setPhotoDate(todayInputValue());
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Could not upload that photo.");
    } finally {
      setSavingPhoto(false);
    }
  }

  return (
    <div>
      <PageIntro
        eyebrow="Body tracking"
        title="Change takes shape."
        copy="Anatome maps tape measurements and the last 21 days of training onto a real anatomical figure."
        action={
          <ContextualAiActions
            actions={[
              { label: "How is my weight trending?", prompt: "How have my body measurements changed? Use logged check-ins only." },
              { label: "What should I eat?", prompt: "Using my latest weight, height, age, sex, activity, and goal, tell me calories and protein. Use the logged body data only." },
            ]}
          />
        }
      />

      <section className="scan-shell reveal">
        <div className="scan-stage">
          <div className="scan-toolbar">
            <div className="view-toggle" role="tablist" aria-label="Anatomy view">
              {([
                ["dual", "Both"],
                ["front", "Front"],
                ["back", "Back"],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  className={mapView === id ? "active" : ""}
                  aria-selected={mapView === id}
                  onClick={() => setMapView(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="scan-credit">api.anatome.dev</span>
          </div>

          <div className="scan-figure">
            <AnatomeBodyScan
              gender={gender}
              view={mapView}
              measuredMuscles={measuredMuscles}
              selectedMuscles={selectedMuscles}
              trainingBySlug={trainingBySlug}
            />
            <div className="scan-key">
              <span><i className="is-tape" /> Taped</span>
              <span><i className="is-train" /> Trained · 21d</span>
            </div>
          </div>

          <div className="scan-chips" role="tablist" aria-label="Measurement sites">
            {BODY_SITES.map((site) => {
              const taped = Boolean(siteValues[site.id]);
              const active = selectedSite === site.id;
              return (
                <button
                  key={site.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`scan-chip-btn ${taped ? "is-taped" : ""} ${active ? "is-active" : ""}`}
                  onClick={() => setSelectedSite((current) => (current === site.id ? null : site.id))}
                >
                  <small>{site.label}</small>
                  <strong>{taped ? `${siteValues[site.id]}` : "—"}<em>{taped ? ` ${site.unit}` : ""}</em></strong>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="scan-result reveal delay-1">
          <div className="scan-result-head">
            <span className="eyebrow">Body scan result</span>
            <h2>{selected ? selected.label : metrics ? metrics.bmiLabel : "Ready to scan"}</h2>
            <p>
              {selected
                ? trainedSets
                  ? `${trainedSets} working sets on this region in the last 21 days.`
                  : "No recent training here — tape still maps this region."
                : tapedCount
                  ? `${tapedCount} of ${BODY_SITES.length} sites taped · lime marks tape, orange marks training.`
                  : "Log tape or train and the figure lights up in real time."}
            </p>
          </div>

          <div className="scan-figure-stat">
            <div>
              <span>{selected ? selected.label : "Weight"}</span>
              <strong>
                {selected
                  ? selectedValue ?? "—"
                  : latestWeight
                    ? formatKg(latestWeight)
                    : "—"}
                <em>{selected ? ` ${selected.unit}` : " kg"}</em>
              </strong>
            </div>
            <span className={`scan-chip ${((selected ? selectedDelta : weightDelta) ?? 0) > 0 ? "is-up" : "is-down"}`}>
              {selected
                ? selectedDelta == null
                  ? selectedValue ? "First tape" : "Not taped"
                  : `${selectedDelta > 0 ? "+" : ""}${selectedDelta} ${selected.unit}`
                : weightDelta == null
                  ? "New tracker"
                  : `${weightDelta > 0 ? "+" : ""}${formatKg(weightDelta)} kg`}
            </span>
          </div>

          <div className="scan-meter">
            <div className="scan-meter-head">
              <span>Health index</span>
              <strong>{healthIndex}<em>/100</em></strong>
            </div>
            <div className="scan-meter-track">
              <b style={{ width: `${healthIndex}%` }} />
              <i style={{ left: `${healthIndex}%` }} />
            </div>
          </div>

          <div className="scan-meter">
            <div className="scan-meter-head">
              <span>Your result · BMI</span>
              <strong>{metrics ? metrics.bmi : "—"}</strong>
            </div>
            <div className="scan-meter-track is-range">
              <i style={{ left: `${bmiPin}%` }} />
            </div>
            <div className="scan-range-legend">
              <span>Low</span>
              <span>Healthy</span>
              <span>High</span>
            </div>
          </div>

          <div className="scan-mini-stats">
            <div>
              <span>Calories</span>
              <strong>{metrics ? metrics.calories.toLocaleString() : "—"}</strong>
              <small>kcal / day</small>
            </div>
            <div>
              <span>Protein</span>
              <strong>{metrics ? `${metrics.proteinG}g` : "—"}</strong>
              <small>daily target</small>
            </div>
          </div>

          <div className="scan-actions">
            <button className="primary-button" type="button" onClick={() => setLogging(true)}>
              <Plus size={17} /> Log weigh-in
            </button>
            <button className="outline-button" type="button" onClick={() => setEditingSpecs(true)}>
              Body specs
            </button>
            <button className="outline-button" type="button" onClick={() => setAddingPhoto(true)}>
              <Camera size={17} /> Add photo
            </button>
          </div>
        </aside>
      </section>

      <section className="body-insight-grid">
        {[
          { label: "Weight", value: latestWeight ? `${formatKg(latestWeight)} kg` : "—", detail: weightDelta == null ? "Start the tracker" : `${weightDelta > 0 ? "+" : ""}${formatKg(weightDelta)} vs last`, values: chartPoints.map((point) => point.value), color: "var(--lime)", icon: Scale },
          { label: "Calories", value: metrics ? String(metrics.calories) : "—", detail: metrics ? metrics.calorieNote : "Needs body specs", values: metrics ? [metrics.bmr, metrics.tdee, metrics.calories] : [], color: "var(--orange)", icon: Flame },
          { label: "Protein", value: metrics ? `${metrics.proteinG}g` : "—", detail: "Daily target", values: metrics ? [metrics.proteinG * 0.8, metrics.proteinG, metrics.fatG] : [], color: "var(--blue)", icon: Utensils },
          { label: "Waist", value: latest?.waist ? `${latest.waist} cm` : "—", detail: waistPoints.length > 1 ? "Tape trend" : "Optional measurement", values: waistPoints.map((point) => point.value), color: "var(--yellow)", icon: Ruler },
        ].map(({ label, value, detail, values, color, icon: Icon }) => (
          <article key={label} className={`body-insight reveal delay-1${values.length > 1 ? "" : " is-plain"}`}>
            <div>
              <span className="body-insight-icon"><Icon size={18} /></span>
              <small>{label}</small>
              <strong>{value}</strong>
              <p>{detail}</p>
            </div>
            {values.length > 1 ? <MiniChart values={values} color={color} /> : null}
          </article>
        ))}
      </section>

      <section className="dash-charts">
        <article className="paper-panel reveal">
          <SectionTitle eyebrow="Trend" title="Body weight" />
          {chartPoints.length > 0 ? (
            <AreaChart points={chartPoints} color="var(--orange)" unit="kg" fit callout={false} formatValue={formatKg} />
          ) : (
            <p className="chart-empty">Save a weigh-in and the trend line starts here.</p>
          )}
        </article>
        <article className="paper-panel reveal delay-1">
          <SectionTitle eyebrow="Fuel" title="Daily split" />
          {metrics ? (
            <DonutChart points={macroPoints} unit="kcal" />
          ) : (
            <>
              <p className="chart-empty">Add height, age, and sex to unlock calories and macros.</p>
              <button className="text-button" type="button" onClick={() => setEditingSpecs(true)}>Add body specs</button>
            </>
          )}
        </article>
      </section>

      {(waistPoints.length > 0 || fatPoints.length > 0) && (
        <section className="dash-charts">
          {waistPoints.length > 0 && (
            <article className="paper-panel reveal">
              <SectionTitle eyebrow="Tape" title="Waist" />
              <VolumeBars points={waistPoints} color="var(--blue)" />
            </article>
          )}
          {fatPoints.length > 0 && (
            <article className="paper-panel reveal delay-1">
              <SectionTitle eyebrow="Composition" title="Body fat" />
              <AreaChart points={fatPoints} color="var(--lime)" unit="%" fit callout={false} formatValue={(value) => `${value}`} />
            </article>
          )}
        </section>
      )}

      <section className="lower-grid">
        <article className="paper-panel body-photos reveal">
          <SectionTitle
            eyebrow="Transformation"
            title="Progress photos"
            action={
              <div className="view-toggle compact-toggle" role="tablist" aria-label="Photo pose">
                {POSES.map((pose) => (
                  <button
                    key={pose.id}
                    type="button"
                    role="tab"
                    aria-selected={comparePose === pose.id}
                    className={comparePose === pose.id ? "active" : ""}
                    onClick={() => setComparePose(pose.id)}
                  >
                    {pose.label}
                  </button>
                ))}
              </div>
            }
          />
          {canCompare && beforePhoto && afterPhoto ? (
            <div className="body-compare">
              <img src={beforePhoto.url} alt={`${comparePose} before`} />
              <div className="body-compare-after" style={{ clipPath: `inset(0 ${100 - compareSplit}% 0 0)` }}>
                <img src={afterPhoto.url} alt={`${comparePose} after`} />
              </div>
              <input
                className="body-compare-range"
                type="range"
                min={4}
                max={96}
                value={compareSplit}
                onChange={(event) => setCompareSplit(Number(event.target.value))}
                aria-label="Compare before and after"
              />
              <span className="body-compare-tag is-before">
                {new Date(beforePhoto.takenAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
              </span>
              <span className="body-compare-tag is-after">
                {new Date(afterPhoto.takenAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
              </span>
            </div>
          ) : (
            <div className="empty-inline">
              <Images size={28} />
              <p>
                {bodyPhotos.length === 0
                  ? "Same pose, same light. Add two shots to slide before and after."
                  : `Add another ${comparePose} photo to compare.`}
              </p>
              <button className="outline-button" type="button" onClick={() => setAddingPhoto(true)}>
                <Camera size={16} /> Add photo
              </button>
            </div>
          )}
          {bodyPhotos.length > 0 && (
            <div className="body-photo-grid">
              {bodyPhotos.slice(0, 8).map((photo) => (
                <figure key={photo.id}>
                  <img src={photo.url} alt={`${photo.pose} progress`} />
                  <figcaption>
                    <strong>{photo.pose}</strong>
                    <span>{new Date(photo.takenAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  </figcaption>
                  <button type="button" className="icon-button" aria-label="Delete photo" onClick={() => void deleteBodyPhoto(photo.id)}>
                    <Trash2 size={15} />
                  </button>
                </figure>
              ))}
            </div>
          )}
        </article>

        <article className="paper-panel reveal delay-1">
          <SectionTitle
            eyebrow="Details"
            title="Check-ins"
            action={<button className="text-button" type="button" onClick={() => setEditingSpecs(true)}>Edit specs</button>}
          />
          <ul className="body-detail-list">
            <li><span>Height</span><strong>{profile?.heightCm ? `${profile.heightCm} cm` : "—"}</strong></li>
            <li><span>Age / sex</span><strong>{[profile?.age, profile?.sex].filter(Boolean).join(" · ") || "—"}</strong></li>
            <li><span>Activity</span><strong>{activityLabel ?? "—"}</strong></li>
            {lowWeight && highWeight ? <li><span>Range</span><strong>{formatKg(lowWeight)} – {formatKg(highWeight)} kg</strong></li> : null}
            {MEASUREMENT_FIELDS.filter((field) => latest?.[field.key]).map((field) => (
              <li key={field.key}><span>{field.label}</span><strong>{latest?.[field.key]} {field.unit}</strong></li>
            ))}
          </ul>
          {measurements.length > 0 ? (
            <div className="body-history">
              {measurements.slice(0, 6).map((item) => (
                <div key={item.id} className="measurement-row">
                  <strong>{new Date(item.measuredAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</strong>
                  <span>{item.weight ? `${formatKg(item.weight)} kg` : "—"}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="chart-empty">No weigh-ins logged yet.</p>
          )}
        </article>
      </section>

      <p className="body-disclaimer">
        <Activity size={14} /> BMI is a rough screen, not a diagnosis. Calories use Mifflin-St Jeor plus activity.
      </p>

      {logging && (
        <div className="modal-layer" role="presentation" onClick={closeCheckin}>
          <form
            className="confirm-card log-record-card body-log-card workout-create-form"
            aria-labelledby="log-weigh-in-title"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleCheckin}
          >
            <button type="button" className="rest-close" onClick={closeCheckin} aria-label="Close">
              <X size={16} />
            </button>
            <span className="log-record-mark"><Scale size={22} /></span>
            <h3 id="log-weigh-in-title">Log a weigh-in</h3>
            <p>Weight is required. Tape measurements are optional.</p>
            <div className="form-grid">
              <label>
                Weight (kg)
                <input autoFocus type="number" step="0.1" min="20" max="400" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="78.4" required />
              </label>
              <label>
                Date
                <input type="date" value={measuredOn} onChange={(event) => setMeasuredOn(event.target.value)} />
              </label>
            </div>
            <p className="body-form-hint">Skip any tape field you do not have today.</p>
            <div className="body-measure-grid">
              {MEASUREMENT_FIELDS.map((field) => (
                <label key={field.key}>
                  {field.label} ({field.unit})
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={extras[field.key]}
                    onChange={(event) => setExtras((current) => ({ ...current, [field.key]: event.target.value }))}
                  />
                </label>
              ))}
            </div>
            <div className="form-actions">
              <button type="button" className="outline-button" disabled={savingCheckin} onClick={closeCheckin}>Cancel</button>
              <button className="primary-button" type="submit" disabled={savingCheckin || !weight.trim()}>
                {savingCheckin ? "Saving…" : "Save check-in"}
              </button>
            </div>
          </form>
        </div>
      )}

      {editingSpecs && (
        <div className="modal-layer" role="presentation" onClick={closeSpecs}>
          <form
            className="confirm-card log-record-card body-log-card workout-create-form"
            aria-labelledby="body-specs-title"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleSpecs}
          >
            <button type="button" className="rest-close" onClick={closeSpecs} aria-label="Close">
              <X size={16} />
            </button>
            <span className="log-record-mark"><Ruler size={22} /></span>
            <h3 id="body-specs-title">Body specs</h3>
            <p>Used for BMI, calories, and protein. Nothing here is required.</p>
            <div className="form-grid">
              <label>
                Height (cm)
                <input autoFocus type="number" min="100" max="250" step="0.5" value={height} onChange={(event) => setHeight(event.target.value)} placeholder="178" />
              </label>
              <label>
                Age
                <input type="number" min="13" max="90" value={age} onChange={(event) => setAge(event.target.value)} placeholder="29" />
              </label>
            </div>
            <label>
              Sex
              <select value={sex} onChange={(event) => setSex(event.target.value as BodySex | "")}>
                <option value="">Skip for now</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>
            <label>
              Activity
              <select value={activityLevel} onChange={(event) => setActivityLevel(event.target.value as ActivityLevel)}>
                {ACTIVITY_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} — {option.hint}
                  </option>
                ))}
              </select>
            </label>
            <p className="body-form-hint">
              Goal stays in Settings ({profile?.goal === "strength" ? "get stronger" : profile?.goal === "general" ? "general fitness" : "build muscle"}).
            </p>
            <div className="form-actions">
              <button type="button" className="outline-button" disabled={savingSpecs} onClick={closeSpecs}>Cancel</button>
              <button className="primary-button" type="submit" disabled={savingSpecs}>
                {savingSpecs ? "Saving…" : "Save body specs"}
              </button>
            </div>
          </form>
        </div>
      )}

      {addingPhoto && (
        <div className="modal-layer" role="presentation" onClick={closePhoto}>
          <form
            className="confirm-card log-record-card body-log-card workout-create-form"
            aria-labelledby="add-photo-title"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handlePhoto}
          >
            <button type="button" className="rest-close" onClick={closePhoto} aria-label="Close">
              <X size={16} />
            </button>
            <span className="log-record-mark"><Camera size={22} /></span>
            <h3 id="add-photo-title">Add a progress photo</h3>
            <p>Same pose and lighting makes the slider honest.</p>
            {photoPreview ? <img className="body-photo-preview" src={photoPreview} alt="Selected progress photo" /> : null}
            <div className="body-photo-sources">
              <button type="button" className="body-photo-source" onClick={() => cameraInput.current?.click()}>
                <Camera size={20} />
                <strong>Camera</strong>
                <small>Take a new shot</small>
              </button>
              <button type="button" className="body-photo-source" onClick={() => uploadInput.current?.click()}>
                <Upload size={20} />
                <strong>Upload</strong>
                <small>Choose from gallery</small>
              </button>
            </div>
            <input
              ref={cameraInput}
              className="sr-only"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => {
                pickPhoto(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <input
              ref={uploadInput}
              className="sr-only"
              type="file"
              accept="image/*"
              onChange={(event) => {
                pickPhoto(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <div className="form-grid">
              <label>
                Pose
                <select value={photoPose} onChange={(event) => setPhotoPose(event.target.value as BodyPhotoPose)}>
                  {POSES.map((pose) => (
                    <option key={pose.id} value={pose.id}>{pose.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Date
                <input type="date" value={photoDate} onChange={(event) => setPhotoDate(event.target.value)} />
              </label>
            </div>
            {photoError ? <p className="coach-error" role="alert">{photoError}</p> : null}
            <div className="form-actions">
              <button type="button" className="outline-button" disabled={savingPhoto} onClick={closePhoto}>Cancel</button>
              <button className="primary-button" type="submit" disabled={savingPhoto || !photoFile}>
                {savingPhoto ? "Uploading…" : "Save photo"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
