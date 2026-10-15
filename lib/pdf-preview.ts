let workerReady = false;

export async function pdfPageImages(src: string | ArrayBuffer): Promise<string[]> {
  if (typeof document === "undefined") return [];
  const pdfjs = await import("pdfjs-dist");
  if (!workerReady) {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    workerReady = true;
  }
  const doc = await pdfjs.getDocument(
    typeof src === "string" ? { url: src } : { data: new Uint8Array(src.slice(0)) }
  ).promise;
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
