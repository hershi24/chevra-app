export function inviteOrigin(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  const hosts = [request.headers.get("x-forwarded-host"), request.headers.get("host")];
  for (const raw of hosts) {
    const host = raw?.split(",")[0]?.trim();
    if (host && isPublicHost(host)) return `${forwardedProto}://${host}`;
  }
  const external = process.env.RENDER_EXTERNAL_URL?.replace(/\/$/, "");
  if (external) return external;
  return new URL(request.url).origin;
}

function isPublicHost(host: string) {
  const name = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "").toLowerCase();
  return name !== "0.0.0.0" && name !== "127.0.0.1" && name !== "localhost" && name !== "::1";
}
