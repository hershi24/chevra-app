import path from "path";

const MAX_PDF_BYTES = 16 * 1024 * 1024;

export function maxBoardPdfBytes() {
  return MAX_PDF_BYTES;
}

/** A board PDF the server is allowed to read. Local paths stay inside public materials/uploads. Remote URLs must be the configured file host. */
export function boardFileTarget(raw: string): { kind: "local"; relative: string } | { kind: "remote"; href: string } | null {
  const value = raw.trim();
  if (!value || value.length > 400) return null;

  if (value.startsWith("/") && !value.startsWith("//")) {
    let pathname = value.split("?")[0] ?? "";
    try {
      pathname = decodeURIComponent(pathname);
    } catch {
      return null;
    }
    if (pathname.includes("..") || pathname.includes("\\") || pathname.includes("\0")) return null;
    if (!pathname.toLowerCase().endsWith(".pdf")) return null;
    if (!pathname.startsWith("/materials/") && !pathname.startsWith("/uploads/")) return null;
    return { kind: "local", relative: pathname.slice(1) };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  const base = process.env.R2_PUBLIC_URL;
  if (!base) return null;
  let allowed: URL;
  try {
    allowed = new URL(base);
  } catch {
    return null;
  }
  if (parsed.origin !== allowed.origin) return null;
  if (parsed.username || parsed.password) return null;
  if (parsed.pathname.includes("..") || parsed.pathname.includes("\\")) return null;
  if (!parsed.pathname.toLowerCase().endsWith(".pdf")) return null;
  return { kind: "remote", href: parsed.href };
}

export function localBoardPdfPath(relative: string) {
  const root = path.join(process.cwd(), "public");
  const file = path.resolve(root, relative);
  const materials = path.resolve(root, "materials");
  const uploads = path.resolve(root, "uploads");
  if (file !== materials && !file.startsWith(materials + path.sep) && file !== uploads && !file.startsWith(uploads + path.sep)) {
    return null;
  }
  return file;
}
