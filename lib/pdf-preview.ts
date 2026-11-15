let workerReady = false;

/** Same-origin address pdf.js can fetch. Files on the public host go through the server so the browser is not blocked. */
export function pdfViewUrl(src: string) {
  if (src.startsWith("/") && !src.startsWith("//")) return src;
  return `/api/board-file?url=${encodeURIComponent(src)}`;
}

async function pdfBytes(src: string | ArrayBuffer) {
  if (typeof src !== "string") return new Uint8Array(src.slice(0));
  const response = await fetch(pdfViewUrl(src), { credentials: "same-origin" });
  if (!response.ok) throw new Error("pdf");
  return new Uint8Array(await response.arrayBuffer());
}

export async function pdfPageImages(src: string | ArrayBuffer): Promise<string[]> {
  if (typeof document === "undefined") return [];
  const pdfjs = await import("pdfjs-dist");
  if (!workerReady) {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    workerReady = true;
  }
  const doc = await pdfjs.getDocument({ data: await pdfBytes(src), disableRange: true, disableStream: true }).promise;
  try {
    const images: string[] = [];
    const count = Math.min(doc.numPages, 6);
    for (let number = 1; number <= count; number += 1) {
      const page = await doc.getPage(number);
      const natural = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(1.7, 1400 / natural.width) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) continue;
      await page.render({ canvasContext: context, viewport }).promise;
      images.push(canvas.toDataURL("image/jpeg", 0.86));
    }
    return images;
  } finally {
    await doc.destroy();
  }
}
