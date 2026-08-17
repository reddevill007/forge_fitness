"use client";

import { useEffect, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import type { CustomExerciseInput, Exercise } from "@/src/types/fitness";
import { IconButton } from "@/src/components/ui";
import { useUserData } from "@/src/lib/firebase/user-data-context";

const TARGETS = [
  "pectorals",
  "lats",
  "upper back",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "abs",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "adductors",
];

const MEDIA_ACCEPT = "image/gif,image/png,image/jpeg,image/webp,.gif,.png,.jpg,.jpeg,.webp";

export function CustomExerciseForm({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (exercise: CustomExerciseInput) => Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("pectorals");
  const [secondary, setSecondary] = useState("");
  const [equipment, setEquipment] = useState("body weight");
  const [bodyPart, setBodyPart] = useState("chest");
  const [instructions, setInstructions] = useState("");
  const [gifUrl, setGifUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [gifFile, setGifFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [gifPreview, setGifPreview] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (gifPreview.startsWith("blob:")) URL.revokeObjectURL(gifPreview);
      if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    };
  }, [gifPreview, imagePreview]);

  function setFile(
    kind: "gif" | "image",
    file: File | null,
    setFileState: (file: File | null) => void,
    setPreview: (url: string) => void,
    previousPreview: string,
  ) {
    if (previousPreview.startsWith("blob:")) URL.revokeObjectURL(previousPreview);
    setFileState(file);
    setPreview(file ? URL.createObjectURL(file) : "");
    if (file && kind === "gif") setGifUrl("");
    if (file && kind === "image") setImageUrl("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const steps = instructions
      .split("\n")
      .map((step) => step.trim())
      .filter(Boolean);
    try {
      await onSave({
        name: name.trim(),
        category: "custom",
        body_part: bodyPart.trim() || "other",
        equipment: equipment.trim() || "other",
        instructions: { en: steps[0] || `${name.trim()} — custom movement.` },
        instruction_steps: { en: steps.length ? steps : [`Perform ${name.trim()} with control.`] },
        muscle_group: target,
        secondary_muscles: secondary
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        target,
        image: imageUrl.trim(),
        gif_url: gifUrl.trim(),
        media_id: "",
        attribution: "Custom exercise",
        created_at: new Date().toISOString(),
        videoUrl: videoUrl.trim() || undefined,
        gifFile,
        imageFile,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save exercise.");
      setSaving(false);
      return;
    }
    setSaving(false);
  }

  async function generateWithCoach() {
    const prompt = name.trim();
    if (!prompt) {
      setError("Enter a name first, then generate.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch("/api/coach/generate-exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json() as {
        name?: string;
        target?: string;
        secondaryMuscles?: string[];
        equipment?: string;
        bodyPart?: string;
        instructions?: string[];
        error?: string;
      };
      if (!response.ok || data.error) {
        setError(data.error || "Coach could not generate that exercise.");
        return;
      }
      if (data.name) setName(data.name);
      if (data.target && TARGETS.includes(data.target)) setTarget(data.target);
      if (data.secondaryMuscles?.length) setSecondary(data.secondaryMuscles.join(", "));
      if (data.equipment) setEquipment(data.equipment);
      if (data.bodyPart) setBodyPart(data.bodyPart);
      if (data.instructions?.length) setInstructions(data.instructions.join("\n"));
    } catch {
      setError("Coach could not generate that exercise.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Create custom exercise">
      <form className="paper-panel custom-exercise-form" onSubmit={handleSubmit}>
        <header>
          <div>
            <span className="eyebrow">Custom movement</span>
            <h2>Add an exercise</h2>
          </div>
          <IconButton label="Close" onClick={onClose}><X size={20} /></IconButton>
        </header>
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cable face pull" required /></label>
        <button type="button" className="coach-chip" onClick={() => void generateWithCoach()} disabled={generating}>
          ✨ {generating ? "Generating…" : "Generate Exercise Data"}
        </button>
        <div className="form-grid">
          <label>
            Primary muscle
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {TARGETS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>Equipment<input value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="cable, barbell, dumbbell" /></label>
          <label>Body part<input value={bodyPart} onChange={(e) => setBodyPart(e.target.value)} placeholder="upper arms, back, waist" /></label>
          <label>Secondary muscles<input value={secondary} onChange={(e) => setSecondary(e.target.value)} placeholder="rear delts, traps" /></label>
        </div>
        <label>
          YouTube or video URL
          <input
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://youtu.be/… or an MP4 link"
          />
        </label>
        <fieldset className="media-fields">
          <legend>Demo media</legend>
          <p className="media-fields-copy">GIF/still for the catalog card, plus an optional looping YouTube clip for workouts.</p>
          <div className="media-slots">
            <MediaSlot
              label="GIF"
              hint="Animated demo"
              preview={gifPreview || gifUrl}
              url={gifUrl}
              fileName={gifFile?.name}
              onUrl={setGifUrl}
              onFile={(file) => setFile("gif", file, setGifFile, setGifPreview, gifPreview)}
            />
            <MediaSlot
              label="Image"
              hint="Still / thumbnail"
              preview={imagePreview || imageUrl}
              url={imageUrl}
              fileName={imageFile?.name}
              onUrl={setImageUrl}
              onFile={(file) => setFile("image", file, setImageFile, setImagePreview, imagePreview)}
            />
          </div>
        </fieldset>
        <label>
          How to perform
          <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} placeholder={"One step per line.\nStand tall.\nPull toward your face."} />
        </label>
        {error && <p className="login-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="outline-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save exercise"}</button>
        </div>
      </form>
    </div>
  );
}

function MediaSlot({
  label,
  hint,
  preview,
  url,
  fileName,
  onUrl,
  onFile,
}: {
  label: string;
  hint: string;
  preview: string;
  url: string;
  fileName?: string;
  onUrl: (value: string) => void;
  onFile: (file: File | null) => void;
}) {
  const inputId = `custom-media-${label.toLowerCase()}`;
  return (
    <div className="media-slot">
      <label className="media-drop" htmlFor={inputId}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={`${label} preview`} />
        ) : (
          <span>
            <ImagePlus size={22} />
            <strong>{label}</strong>
            <small>{hint}</small>
          </span>
        )}
        <input
          id={inputId}
          type="file"
          accept={MEDIA_ACCEPT}
          onChange={(event) => onFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <label className="media-url">
        <span className="sr-only">{label} URL</span>
        <input
          value={url}
          onChange={(event) => {
            onFile(null);
            onUrl(event.target.value);
          }}
          placeholder={`${label} URL`}
        />
      </label>
      {(preview || fileName) && (
        <button type="button" className="text-button" onClick={() => { onFile(null); onUrl(""); }}>
          Remove {label.toLowerCase()}
        </button>
      )}
    </div>
  );
}

export function CustomExerciseMediaEditor({ exercise }: { exercise: Exercise }) {
  const { uploadExerciseMedia, patchCustomExercise } = useUserData();
  const [gifUrl, setGifUrl] = useState(exercise.gif_url);
  const [imageUrl, setImageUrl] = useState(exercise.image);
  const [saving, setSaving] = useState<"gif" | "image" | "urls" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setGifUrl(exercise.gif_url);
    setImageUrl(exercise.image);
  }, [exercise.gif_url, exercise.image]);

  async function saveFile(kind: "gif" | "image", file: File | null) {
    if (!file) return;
    setSaving(kind);
    setError(null);
    try {
      await uploadExerciseMedia(exercise.id, kind, file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload media.");
    } finally {
      setSaving(null);
    }
  }

  async function saveUrls() {
    setSaving("urls");
    setError(null);
    try {
      await patchCustomExercise(exercise.id, {
        gif_url: gifUrl.trim(),
        image: imageUrl.trim() || gifUrl.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save media URLs.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <fieldset className="media-fields">
      <legend>Demo media</legend>
      <p className="media-fields-copy">Replace the GIF or still for this custom exercise.</p>
      <div className="media-slots">
        <MediaSlot
          label="GIF"
          hint={saving === "gif" ? "Uploading…" : "Animated demo"}
          preview={gifUrl}
          url={gifUrl}
          onUrl={setGifUrl}
          onFile={(file) => void saveFile("gif", file)}
        />
        <MediaSlot
          label="Image"
          hint={saving === "image" ? "Uploading…" : "Still / thumbnail"}
          preview={imageUrl}
          url={imageUrl}
          onUrl={setImageUrl}
          onFile={(file) => void saveFile("image", file)}
        />
      </div>
      {error && <p className="login-error" role="alert">{error}</p>}
      <button
        type="button"
        className="outline-button"
        onClick={() => void saveUrls()}
        disabled={saving !== null}
      >
        {saving === "urls" ? "Saving…" : "Save media URLs"}
      </button>
    </fieldset>
  );
}
