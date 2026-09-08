export type CoachImageAttachment = {
  mimeType: string;
  data: string;
  preview: string;
};

export const MAX_COACH_IMAGES = 6;
const MAX_BYTES = 12 * 1024 * 1024;
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.72;

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read that image."));
    };
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(file);
  });
}

function splitDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match?.[1] || !match[2]) throw new Error("Could not read that image.");
  return { mimeType: match[1].trim(), data: match[2].replace(/\s/g, "") };
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (!image.width || !image.height) reject(new Error("Could not decode that image."));
      else resolve(image);
    };
    image.onerror = () => reject(new Error("Could not decode that image."));
    image.src = dataUrl;
  });
}

function canvasToJpeg(image: HTMLImageElement, edge: number, quality: number) {
  const scale = Math.min(1, edge / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process that image.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  return splitDataUrl(canvas.toDataURL("image/jpeg", quality));
}

export async function fileToCoachImage(file: File): Promise<CoachImageAttachment> {
  if (file.size > MAX_BYTES) throw new Error("That photo is too large. Use a smaller scan.");
  const namedImage = /\.(jpe?g|png|webp|gif|heic|heif|bmp)$/i.test(file.name);
  if (file.type && !file.type.startsWith("image/") && file.type !== "application/octet-stream" && !namedImage) {
    throw new Error("Choose a photo of the report.");
  }
  const original = await readAsDataUrl(file);
  const image = await loadImage(original);
  const compressed = canvasToJpeg(image, MAX_EDGE, JPEG_QUALITY);
  const preview = canvasToJpeg(image, 240, 0.62);
  if (!compressed.data) throw new Error("Could not process that image.");
  return {
    mimeType: "image/jpeg",
    data: compressed.data,
    preview: `data:image/jpeg;base64,${preview.data}`,
  };
}

export function filesFromPicker(list: FileList | File[] | null | undefined) {
  return Array.from(list ?? []).filter((file) => file instanceof File);
}

export function coachScanPrompt(count = 1) {
  if (count > 1) {
    return `${count} photos of body composition reports are attached. Each photo or printed date is a SEPARATE check-in. Call save_body_composition with reports[] — one object per date or month. Never merge two months into one. Extract every readable number from each report. Update height, age, and sex if they are printed. Do not ask me to re-upload or type numbers that are already on the reports.`;
  }
  return "A photo of my body composition report is attached. Read the image, extract every readable number, and save it to my body analysis. Update height, age, and sex if they are printed. Do not ask me to re-upload or type numbers that are already on the report.";
}
