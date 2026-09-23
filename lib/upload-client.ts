export type UploadResult = {
  id?: string;
  url: string;
  name: string;
  type: string;
  size: number;
};

export type UploadProgress = {
  percent: number;
  remainingSeconds: number | null;
};

export type LocalUpload = {
  id: string;
  file: File;
  previewUrl: string;
  type: "image" | "video" | "audio" | "file";
  name: string;
};

export function mediaKind(type: string): LocalUpload["type"] {
  if (type.startsWith("video")) return "video";
  if (type.startsWith("audio")) return "audio";
  if (type.startsWith("image")) return "image";
  return "file";
}

export function createLocalUpload(file: File): LocalUpload {
  return {
    id: crypto.randomUUID(),
    file,
    previewUrl: URL.createObjectURL(file),
    type: mediaKind(file.type),
    name: file.name,
  };
}

export function uploadWithProgress(
  file: File,
  extras: Record<string, string>,
  onProgress: (info: UploadProgress) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file);
    for (const [key, value] of Object.entries(extras)) {
      form.append(key, value);
    }

    const startedAt = Date.now();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.max(0, Math.min(99, Math.round((event.loaded / event.total) * 100)));
      const elapsed = Date.now() - startedAt;
      const remainingSeconds =
        event.loaded > 0 && elapsed > 400
          ? Math.max(1, Math.round(((event.total - event.loaded) * elapsed) / event.loaded / 1000))
          : null;
      onProgress({ percent, remainingSeconds });
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText) as UploadResult & { error?: string };
        if (xhr.status >= 200 && xhr.status < 300 && data.url) {
          onProgress({ percent: 100, remainingSeconds: 0 });
          resolve(data);
          return;
        }
        reject(new Error(data.error || "העלאה נכשלה"));
      } catch {
        reject(new Error("העלאה נכשלה"));
      }
    };
    xhr.onerror = () => reject(new Error("העלאה נכשלה"));
    xhr.send(form);
  });
}
