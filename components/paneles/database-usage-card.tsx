import { createClient } from "@/lib/supabase/server";

const BYTES_PER_MB = 1024 * 1024;
const DEFAULT_LIMIT_MB = 500;

function formatSize(bytes: number) {
  if (bytes >= 1024 ** 3) {
    return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(bytes / 1024 ** 3)} GB`;
  }

  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(bytes / BYTES_PER_MB)} MB`;
}

export async function DatabaseUsageCard() {
  const supabase = await createClient();
  const { data: rol } = await supabase.rpc("mi_rol");
  if (rol !== "JEFE") return null;

  const { data: bytesUsadosRaw, error } = await supabase.rpc("obtener_uso_base_datos_bytes");
  const bytesUsados = typeof bytesUsadosRaw === "number" || typeof bytesUsadosRaw === "string"
    ? Number(bytesUsadosRaw)
    : Number.NaN;
  const bytesValidos = !error && Number.isFinite(bytesUsados) && bytesUsados >= 0;

  const limiteMbConfigurado = Number(process.env.SUPABASE_DATABASE_SIZE_LIMIT_MB);
  const limitePersonalizado = Number.isFinite(limiteMbConfigurado) && limiteMbConfigurado > 0;
  const limiteMb = limitePersonalizado ? limiteMbConfigurado : DEFAULT_LIMIT_MB;
  const limiteBytes = limiteMb * BYTES_PER_MB;
  const porcentaje = bytesValidos ? Math.round((bytesUsados / limiteBytes) * 100) : 0;
  const barra = Math.min(porcentaje, 100);
  const estado = !bytesValidos ? "No disponible" : porcentaje >= 90 ? "Cerca del límite" : "Dentro del límite";

  return (
    <section className="database-usage-card panel" aria-labelledby="database-usage-title">
      <span className="database-usage-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="7.5" ry="3"/><path d="M4.5 5v7c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V5M4.5 12v7c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-7"/><path d="M4.5 8c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/></svg>
      </span>

      <div className="database-usage-main">
        <div className="database-usage-copy">
          <div>
            <h2 id="database-usage-title">Espacio de base de datos</h2>
            <p>Uso actual de Supabase</p>
          </div>
          <span className={`database-usage-status${!bytesValidos ? " is-unavailable" : porcentaje >= 90 ? " is-warning" : ""}`}>
            {estado}
          </span>
        </div>
        <div className={`database-usage-progress${porcentaje >= 90 ? " is-warning" : ""}`} role="progressbar" aria-label="Uso del límite de base de datos" aria-valuemin={0} aria-valuemax={100} aria-valuenow={barra}>
          <span style={{ width: `${bytesValidos ? barra : 0}%` }} />
        </div>
        <span className="database-usage-footnote">
          {bytesValidos ? `Actualizado al cargar esta página · ${limitePersonalizado ? "Límite configurado" : "Referencia del plan Free"}: ${formatSize(limiteBytes)}` : "Aplicá la migración de uso de base de datos para activar esta métrica."}
        </span>
      </div>

      <div className="database-usage-values">
        <strong>{bytesValidos ? `${porcentaje}%` : "—"}<span>{bytesValidos ? " usado" : ""}</span></strong>
        <span>{bytesValidos ? `${formatSize(bytesUsados)} de ${formatSize(limiteBytes)}` : "No se pudo consultar el uso"}</span>
        {bytesValidos && porcentaje < 100 ? <small>{formatSize(limiteBytes - bytesUsados)} disponibles</small> : null}
      </div>
    </section>
  );
}
