"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";

export type ZoneActivityPoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  count: number;
};

type ZoneActivityMapProps = {
  points: ZoneActivityPoint[];
  selectedZoneId: string | null;
  onSelectZone: (id: string) => void;
};

const tileSize = 256;
const minZoom = 9;
const maxZoom = 17;
const tileBase = process.env.NEXT_PUBLIC_OSM_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

function project(latitude: number, longitude: number, zoom: number) {
  const scale = tileSize * 2 ** zoom;
  const safeLatitude = Math.max(-85.0511, Math.min(85.0511, latitude));
  const sin = Math.sin((safeLatitude * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

function unproject(x: number, y: number, zoom: number) {
  const scale = tileSize * 2 ** zoom;
  const longitude = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const latitude = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { latitude, longitude };
}

function tileUrl(zoom: number, x: number, y: number) {
  const tileCount = 2 ** zoom;
  const wrappedX = ((x % tileCount) + tileCount) % tileCount;
  return tileBase.replace("{z}", String(zoom)).replace("{x}", String(wrappedX)).replace("{y}", String(y));
}

export function ZoneActivityMap({ points, selectedZoneId, onSelectZone }: ZoneActivityMapProps) {
  const [center, setCenter] = useState({ latitude: -32.89, longitude: -68.84 });
  const [zoom, setZoom] = useState(11);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const mapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; clientX: number; clientY: number; worldX: number; worldY: number } | null>(null);

  useEffect(() => {
    const element = mapRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const centerWorld = project(center.latitude, center.longitude, zoom);
  const left = centerWorld.x - size.width / 2;
  const top = centerWorld.y - size.height / 2;
  const tileColumns = size.width ? Array.from({ length: Math.ceil(size.width / tileSize) + 2 }, (_, index) => Math.floor(left / tileSize) + index - 1) : [];
  const tileRows = size.height ? Array.from({ length: Math.ceil(size.height / tileSize) + 2 }, (_, index) => Math.floor(top / tileSize) + index - 1) : [];
  const maxCount = Math.max(1, ...points.map((point) => point.count));

  function cambiarZoom(delta: number) {
    const siguiente = Math.max(minZoom, Math.min(maxZoom, zoom + delta));
    if (siguiente === zoom) return;
    const posicion = project(center.latitude, center.longitude, zoom);
    setCenter(unproject(posicion.x * (2 ** siguiente / 2 ** zoom), posicion.y * (2 ** siguiente / 2 ** zoom), siguiente));
    setZoom(siguiente);
  }

  function iniciarArrastre(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button, a")) return;
    const posicion = project(center.latitude, center.longitude, zoom);
    dragRef.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, worldX: posicion.x, worldY: posicion.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moverMapa(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setCenter(unproject(drag.worldX - (event.clientX - drag.clientX), drag.worldY - (event.clientY - drag.clientY), zoom));
  }

  function terminarArrastre(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  return (
    <section className="radar-section radar-map-section" aria-label="Mapa de actividad por zonas">
      <header className="radar-map-heading">
        <div><h3>Mapa de actividad por zonas</h3><p>Mendoza · Semana actual</p></div>
        <span className="radar-map-filter">Todas las zonas · {points.length}</span>
      </header>
      <div ref={mapRef} className="radar-map" onPointerDown={iniciarArrastre} onPointerMove={moverMapa} onPointerUp={terminarArrastre} onPointerCancel={terminarArrastre}>
        <div className="radar-map-tiles" aria-hidden="true">
          {tileRows.flatMap((row) => tileColumns.map((column) => {
            const tileCount = 2 ** zoom;
            if (row < 0 || row >= tileCount) return null;
            const style: CSSProperties = { left: column * tileSize - left, top: row * tileSize - top };
            return <img key={`${zoom}-${column}-${row}`} className="radar-map-tile" src={tileUrl(zoom, column, row)} alt="" draggable={false} style={style} />;
          }))}
        </div>
        <div className="radar-map-heat" aria-hidden="true">
          {points.filter((point) => point.count > 0).map((point) => {
            const position = project(point.latitude, point.longitude, zoom);
            const x = position.x - left;
            const y = position.y - top;
            if (x < -120 || y < -120 || x > size.width + 120 || y > size.height + 120) return null;
            const intensity = point.count / maxCount;
            const diameter = 48 + intensity * 112;
            const style: CSSProperties = {
              left: x,
              top: y,
              width: diameter,
              height: diameter,
              opacity: 0.42 + intensity * 0.4,
              background: `radial-gradient(circle, rgba(255,236,59,.96) 0%, rgba(61,229,163,.73) 25%, rgba(0,198,204,.34) 52%, rgba(0,160,211,0) 74%)`,
            };
            return <span key={point.id} className="radar-map-glow" style={style} />;
          })}
        </div>
        <div className="radar-map-markers">
          {points.map((point) => {
            const position = project(point.latitude, point.longitude, zoom);
            const x = position.x - left;
            const y = position.y - top;
            if (x < -22 || y < -22 || x > size.width + 22 || y > size.height + 22) return null;
            const style: CSSProperties = { left: x, top: y };
            return <button key={point.id} type="button" className={`radar-map-marker${point.id === selectedZoneId ? " is-selected" : ""}`} title={`${point.name}: ${point.count} ${point.count === 1 ? "coordinación" : "coordinaciones"}`} aria-label={`Ver ${point.name}, ${point.count} coordinaciones`} style={style} onPointerDown={(event) => event.stopPropagation()} onClick={() => onSelectZone(point.id)}><span /></button>;
          })}
        </div>
        <div className="radar-map-zoom" aria-label="Controles de zoom"><button type="button" aria-label="Acercar mapa" disabled={zoom >= maxZoom} onClick={() => cambiarZoom(1)}>+</button><button type="button" aria-label="Alejar mapa" disabled={zoom <= minZoom} onClick={() => cambiarZoom(-1)}>−</button></div>
        {!points.length && <div className="radar-map-empty">No hay zonas con coordenadas para mostrar.</div>}
        <a className="radar-map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
        <div className="radar-map-legend"><span>Baja actividad</span><i /><span>Alta actividad</span></div>
      </div>
    </section>
  );
}
