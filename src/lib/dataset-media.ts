const DATASET_MEDIA_PREFIX = "/exercise-media/";

export function resolveDatasetMedia(src: string | undefined) {
  if (!src) return "";
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("/")) {
    return src;
  }
  return `${DATASET_MEDIA_PREFIX}${src.replace(/^\.\//, "")}`;
}
