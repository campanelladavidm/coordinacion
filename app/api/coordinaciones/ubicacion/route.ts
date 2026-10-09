import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { esEnlaceCortoMaps, normalizarUbicacionMaps } from "@/lib/maps/ubicacion";

function hostGooglePermitido(host: string) {
  return host === "google.com" || host.endsWith(".google.com") || host === "goo.gl" || host.endsWith(".goo.gl");
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Origen de solicitud no permitido." }, { status: 403 });
  }

  const supabase = await createClient();
  const [{ data: { user } }, { data: rol }] = await Promise.all([supabase.auth.getUser(), supabase.rpc("mi_rol")]);
  if (!user || !rol) return NextResponse.json({ error: "Iniciá sesión para continuar." }, { status: 401 });

  try {
    const body = await request.json() as { url?: unknown };
    const entrada = typeof body.url === "string" ? body.url.trim() : "";
    const directa = normalizarUbicacionMaps(entrada);
    if (directa) return NextResponse.json({ ubicacion: directa });
    if (!esEnlaceCortoMaps(entrada)) {
      return NextResponse.json({ error: "Pegá coordenadas o un enlace de Google Maps con una ubicación reconocible." }, { status: 400 });
    }

    let actual = new URL(entrada);
    for (let intento = 0; intento < 6; intento += 1) {
      if (normalizarUbicacionMaps(actual.toString())) {
        return NextResponse.json({ ubicacion: normalizarUbicacionMaps(actual.toString()) });
      }
      const response = await fetch(actual, {
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; CoordinacionesWN/1.0)" },
      });
      const redireccion = response.headers.get("location");
      if (redireccion && response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        const siguiente = new URL(redireccion, actual);
        if (siguiente.protocol !== "https:" || !hostGooglePermitido(siguiente.hostname)) {
          return NextResponse.json({ error: "El enlace redirige fuera de Google Maps." }, { status: 400 });
        }
        actual = siguiente;
        continue;
      }
      await response.body?.cancel();
      const ubicacion = normalizarUbicacionMaps(response.url || actual.toString());
      if (ubicacion) return NextResponse.json({ ubicacion });
      return NextResponse.json({ error: "No se pudo extraer la ubicación del enlace. Probá pegar las coordenadas o un enlace completo del lugar." }, { status: 400 });
    }
    return NextResponse.json({ error: "El enlace de Google Maps tiene demasiadas redirecciones." }, { status: 400 });
  } catch (cause) {
    const mensaje = cause instanceof Error && cause.name === "TimeoutError"
      ? "Google Maps tardó demasiado en resolver el enlace. Probá pegar las coordenadas."
      : "No se pudo leer el enlace de Google Maps. Probá pegar las coordenadas.";
    return NextResponse.json({ error: mensaje }, { status: 502 });
  }
}
