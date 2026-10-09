const coordenadasExactas = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

function normalizarCoordenadas(valor: string): string | null {
  const match = valor.match(coordenadasExactas);
  if (!match) return null;
  const latitud = Number(match[1]);
  const longitud = Number(match[2]);
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud) || Math.abs(latitud) > 90 || Math.abs(longitud) > 180) return null;
  return `${latitud},${longitud}`;
}

function esGoogleMapsHost(host: string) {
  return host === "google.com" || host.endsWith(".google.com") || host === "goo.gl" || host.endsWith(".goo.gl");
}

export function esEnlaceCortoMaps(valor: string) {
  try {
    const url = new URL(valor);
    return url.protocol === "https:" && ["maps.app.goo.gl", "goo.gl"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function normalizarUbicacionMaps(valor: string): string | null {
  const texto = valor.trim();
  const coordenadas = normalizarCoordenadas(texto);
  if (coordenadas) return coordenadas;
  if (texto.startsWith("place_id:") && texto.length > "place_id:".length) return texto;

  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return texto || null;
  }
  if (url.protocol !== "https:" || !esGoogleMapsHost(url.hostname)) return null;

  const coordenadaEnUrl = texto.match(/@(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/)
    ?? texto.match(/!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/);
  if (coordenadaEnUrl) {
    const ubicacion = normalizarCoordenadas(`${coordenadaEnUrl[1]},${coordenadaEnUrl[2]}`);
    if (ubicacion) return ubicacion;
  }

  for (const clave of ["q", "query", "destination", "daddr", "ll", "center"]) {
    const valorParametro = url.searchParams.get(clave);
    if (!valorParametro) continue;
    const punto = normalizarCoordenadas(valorParametro);
    if (punto) return punto;
    if (["q", "query", "destination", "daddr"].includes(clave) && !valorParametro.startsWith("loc:")) return valorParametro.trim();
  }

  for (const clave of ["query_place_id", "destination_place_id", "place_id"]) {
    const placeId = url.searchParams.get(clave);
    if (placeId) return `place_id:${placeId}`;
  }

  const segmento = url.pathname.match(/\/(?:place|search)\/([^/]+)/)?.[1];
  if (segmento) {
    try {
      const nombre = decodeURIComponent(segmento.replace(/\+/g, " ")).trim();
      const punto = normalizarCoordenadas(nombre);
      if (punto) return punto;
      if (nombre) return nombre;
    } catch {
      return null;
    }
  }

  return null;
}
