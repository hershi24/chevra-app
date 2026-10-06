type PdfPreview = {
  text: string;
  image: string;
};

let workerReady = false;

export async function readPdf(src: string | ArrayBuffer): Promise<PdfPreview> {
  const pdfjs = await import("pdfjs-dist");
  if (!workerReady) {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    workerReady = true;
  }
  const doc = await pdfjs.getDocument(
    typeof src === "string" ? { url: src } : { data: new Uint8Array(src.slice(0)) }
  ).promise;
  try {
    const pages = Math.min(doc.numPages, 3);
    const lines: string[] = [];
    for (let number = 1; number <= pages; number += 1) {
      const page = await doc.getPage(number);
      const content = await page.getTextContent();
      let line = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        line += item.str;
        if (item.hasEOL) {
          const clean = line.trim();
          if (clean) lines.push(clean);
          line = "";
        }
      }
      const tail = line.trim();
      if (tail) lines.push(tail);
    }
    const text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 2000);
    let image = "";
    if (text.length < 20 && typeof document !== "undefined") {
      const page = await doc.getPage(1);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const context = canvas.getContext("2d");
      if (context) {
        await page.render({ canvasContext: context, viewport }).promise;
        image = canvas.toDataURL("image/jpeg", 0.86);
      }
    }
    return { text, image };
  } finally {
    await doc.destroy();
  }
}
