import type { NextRequest } from "next/server";

export function requestOriginIsAllowed(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") return false;
  if (fetchSite === "same-origin") return true;

  try {
    const originHost = new URL(origin).host.toLowerCase();
    const requestHosts = [request.headers.get("host"), request.headers.get("x-forwarded-host"), request.nextUrl.host]
      .flatMap((value) => value ? value.split(",").map((host) => host.trim().toLowerCase()) : []);
    return requestHosts.includes(originHost);
  } catch {
    return false;
  }
}
