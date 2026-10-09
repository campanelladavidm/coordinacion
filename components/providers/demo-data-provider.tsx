"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CatalogOption } from "@/lib/demo-data/catalogs";

export type DemoRole = "COORDINADOR" | "SUPERVISOR" | "JEFE";
export type FeriadoInterno = { fecha: string; esFeriado: boolean; personalInterno: string[] };
export type Coordinacion = {
  id: string; fecha: string; ticket: string; cliente: string; tercerizadaId: string | null;
  cuadrillaId: string | null; horarioId: string | null; tecnologiaId: string; categoriaId: string; ubicacion: string;
  observaciones: string; zona: string | null; estadoId: string; orden: number; extrasIds: string[];
};
export type NuevaCoordinacion = Omit<Coordinacion, "id" | "orden">;
export type TipoCustodia = "CUSTODIA" | "POLICIA";
export type SolicitudCustodia = { id: string; fecha: string; tipo: TipoCustodia; cuadrillaId: string; horarioId: string };
export type NuevaSolicitudCustodia = Omit<SolicitudCustodia, "id">;
export type CatalogoKey = "tercerizadas" | "cuadrillas" | "tecnologias" | "categorias" | "horarios" | "zonas" | "estados" | "extras";
export type CuadrillaCatalogo = CatalogOption & { tercerizadaId: string };
export type CatalogosDemo = {
  tercerizadas: CatalogOption[]; cuadrillas: CuadrillaCatalogo[]; tecnologias: CatalogOption[];
  categorias: CatalogOption[]; horarios: CatalogOption[]; zonas: CatalogOption[];
  estados: CatalogOption[]; extras: CatalogOption[];
};
export type NotaEquipo = { id: string; comentario: string; usuario: string; fechaHora: string };
export type UsuarioActual = { id: string; nombre: string; email: string };

const CATALOGOS_INICIALES: CatalogosDemo = {
  tercerizadas: [], cuadrillas: [], tecnologias: [], categorias: [], horarios: [],
  zonas: [], estados: [], extras: [],
};

type DemoContextValue = {
  coordinaciones: Coordinacion[]; custodias: SolicitudCustodia[]; feriados: FeriadoInterno[];
  notasEquipo: NotaEquipo[]; catalogos: CatalogosDemo; rolDemo: DemoRole; usuarioActual: UsuarioActual | null;
  ready: boolean; error: string | null;
  crearCoordinacion: (coordinacion: NuevaCoordinacion) => Promise<void>;
  actualizarCoordinacion: (id: string, coordinacion: NuevaCoordinacion) => Promise<void>;
  reordenarCoordinaciones: (ids: string[]) => Promise<void>;
  crearSolicitudCustodia: (solicitud: NuevaSolicitudCustodia) => Promise<void>;
  eliminarSolicitudCustodia: (id: string) => Promise<void>;
  guardarFeriado: (feriado: FeriadoInterno) => Promise<void>;
  quitarFeriado: (fecha: string) => Promise<void>;
  agregarNotaEquipo: (comentario: string) => Promise<void>;
  guardarCatalogo: (tipo: CatalogoKey, opciones: CatalogosDemo[CatalogoKey]) => Promise<void>;
};

const DemoContext = createContext<DemoContextValue | null>(null);

function lanzarError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function mapearCoordinacion(row: {
  id: string; fecha: string; ticket: string; cliente: string; tercerizada_id: string | null;
  cuadrilla_id: string | null; horario_id: string | null; tecnologia_id: string; categoria_id: string;
  observaciones: string | null; zona_id: string | null; estado_id: string; orden: number; ubicacion: string | null;
}, extrasIds: string[] = []): Coordinacion {
  return {
    id: row.id, fecha: row.fecha, ticket: row.ticket, cliente: row.cliente,
    tercerizadaId: row.tercerizada_id, cuadrillaId: row.cuadrilla_id, horarioId: row.horario_id,
    tecnologiaId: row.tecnologia_id, categoriaId: row.categoria_id, observaciones: row.observaciones ?? "",
    zona: row.zona_id, estadoId: row.estado_id, orden: row.orden, ubicacion: row.ubicacion ?? "", extrasIds,
  };
}

function mapearCustodia(row: { id: string; fecha: string; tipo: TipoCustodia; cuadrilla_id: string; horario_retiro: string }): SolicitudCustodia {
  return { id: row.id, fecha: row.fecha, tipo: row.tipo, cuadrillaId: row.cuadrilla_id, horarioId: row.horario_retiro };
}

export function DemoDataProvider({ children }: { children: ReactNode }) {
  const [coordinaciones, setCoordinaciones] = useState<Coordinacion[]>([]);
  const [custodias, setCustodias] = useState<SolicitudCustodia[]>([]);
  const [feriados, setFeriados] = useState<FeriadoInterno[]>([]);
  const [notasEquipo, setNotasEquipo] = useState<NotaEquipo[]>([]);
  const [catalogos, setCatalogos] = useState<CatalogosDemo>(CATALOGOS_INICIALES);
  const [rolDemo, setRolDemo] = useState<DemoRole>("COORDINADOR");
  const [usuarioActual, setUsuarioActual] = useState<UsuarioActual | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarDatos = useCallback(async (usuarioId: string, email: string) => {
    const supabase = createClient();
    setReady(false);
    setError(null);
    try {
      const perfilQuery = await supabase.from("usuarios").select("id,nombre_completo,rol_id,activo").eq("id", usuarioId).maybeSingle();
      lanzarError(perfilQuery.error);
      if (!perfilQuery.data || !perfilQuery.data.activo) throw new Error("Tu perfil no está activo en Coordinaciones WN.");
      const rolQuery = await supabase.from("roles").select("codigo").eq("id", perfilQuery.data.rol_id).single();
      lanzarError(rolQuery.error);
      if (!rolQuery.data) throw new Error("El perfil no tiene un rol válido asignado.");

      const [tercerizadasQ, cuadrillasQ, tecnologiasQ, categoriasQ, horariosQ, zonasQ, estadosQ, extrasQ,
        coordinacionesQ, relacionesExtrasQ, custodiasQ, feriadosQ, personalQ, relacionesPersonalQ, notasQ] = await Promise.all([
        supabase.from("tercerizadas").select("id,nombre,activo,orden").eq("activo", true).order("orden"),
        supabase.from("cuadrillas").select("id,nombre,tercerizada_id,zona_id,activo,orden").eq("activo", true).order("orden"),
        supabase.from("tecnologias").select("id,nombre,activo,orden").eq("activo", true).order("orden"),
        supabase.from("categorias").select("id,nombre,activo,orden").eq("activo", true).order("orden"),
        supabase.from("horarios").select("id,nombre,activo,orden").eq("activo", true).order("orden"),
        supabase.from("zonas").select("id,nombre,activo,orden").eq("activo", true).order("orden"),
        supabase.from("estados").select("id,nombre,activo,orden").eq("activo", true).order("orden"),
        supabase.from("extras").select("id,nombre,activo,orden").eq("activo", true).order("orden"),
        supabase.from("coordinaciones").select("id,fecha,ticket,cliente,tercerizada_id,cuadrilla_id,horario_id,tecnologia_id,categoria_id,observaciones,zona_id,estado_id,orden,ubicacion").order("fecha").order("created_at"),
        supabase.from("coordinacion_extras").select("coordinacion_id,extra_id"),
        supabase.from("custodias").select("id,fecha,tipo,cuadrilla_id,horario_retiro").order("fecha").order("created_at"),
        supabase.from("feriados").select("fecha,es_feriado,creado_por,created_at,updated_at").order("fecha"),
        supabase.from("personal_interno").select("id,nombre,activo,orden,created_at"),
        supabase.from("feriado_personal").select("fecha,personal_id,orden").order("orden"),
        supabase.from("notas_equipo").select("id,comentario,creado_por,created_at").order("created_at", { ascending: false }),
      ]);
      [tercerizadasQ, cuadrillasQ, tecnologiasQ, categoriasQ, horariosQ, zonasQ, estadosQ, extrasQ,
        coordinacionesQ, relacionesExtrasQ, custodiasQ, feriadosQ, personalQ, relacionesPersonalQ, notasQ].forEach((query) => lanzarError(query.error));

      const coordinacionExtras = new Map<string, string[]>();
      for (const relacion of relacionesExtrasQ.data ?? []) {
        coordinacionExtras.set(relacion.coordinacion_id, [...(coordinacionExtras.get(relacion.coordinacion_id) ?? []), relacion.extra_id]);
      }
      const nombresPersonal = new Map((personalQ.data ?? []).map((item) => [item.id, item.nombre]));
      const personalPorFecha = new Map<string, string[]>();
      for (const relacion of relacionesPersonalQ.data ?? []) {
        const nombre = nombresPersonal.get(relacion.personal_id);
        if (nombre) personalPorFecha.set(relacion.fecha, [...(personalPorFecha.get(relacion.fecha) ?? []), nombre]);
      }
      const autoresIds = [...new Set((notasQ.data ?? []).map((nota) => nota.creado_por))];
      const autoresQ = autoresIds.length ? await supabase.from("usuarios").select("id,nombre_completo").in("id", autoresIds) : { data: [], error: null };
      lanzarError(autoresQ.error);
      const autores = new Map((autoresQ.data ?? []).map((autor) => [autor.id, autor.nombre_completo]));

      setCatalogos({
        tercerizadas: (tercerizadasQ.data ?? []).map(({ id, nombre }) => ({ id, nombre })),
        cuadrillas: (cuadrillasQ.data ?? []).map(({ id, nombre, tercerizada_id }) => ({ id, nombre, tercerizadaId: tercerizada_id ?? "" })),
        tecnologias: (tecnologiasQ.data ?? []).map(({ id, nombre }) => ({ id, nombre })),
        categorias: (categoriasQ.data ?? []).map(({ id, nombre }) => ({ id, nombre })),
        horarios: (horariosQ.data ?? []).map(({ id, nombre }) => ({ id, nombre })),
        zonas: (zonasQ.data ?? []).map(({ id, nombre }) => ({ id, nombre })),
        estados: (estadosQ.data ?? []).map(({ id, nombre }) => ({ id, nombre })),
        extras: (extrasQ.data ?? []).map(({ id, nombre }) => ({ id, nombre })),
      });
      setCoordinaciones((coordinacionesQ.data ?? []).map((row) => mapearCoordinacion(row, coordinacionExtras.get(row.id) ?? [])));
      setCustodias((custodiasQ.data ?? []).map(mapearCustodia));
      setFeriados((feriadosQ.data ?? []).map((row) => ({ fecha: row.fecha, esFeriado: row.es_feriado, personalInterno: personalPorFecha.get(row.fecha) ?? [] })));
      setNotasEquipo((notasQ.data ?? []).map((row) => ({ id: row.id, comentario: row.comentario, usuario: autores.get(row.creado_por) || row.creado_por.slice(0, 8), fechaHora: row.created_at })));
      setRolDemo(rolQuery.data.codigo === "JEFE" || rolQuery.data.codigo === "SUPERVISOR" ? rolQuery.data.codigo : "COORDINADOR");
      setUsuarioActual({ id: usuarioId, nombre: perfilQuery.data.nombre_completo || email.split("@")[0], email });
      setReady(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar los datos de Supabase.");
      setReady(true);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let vigente = true;
    const cargarUsuario = async (user: { id: string; email?: string } | null) => {
      if (!vigente) return;
      if (!user) {
        setUsuarioActual(null);
        setRolDemo("COORDINADOR");
        setCoordinaciones([]); setCustodias([]); setFeriados([]); setNotasEquipo([]);
        setReady(true);
        return;
      }
      await cargarDatos(user.id, user.email ?? "");
    };

    void supabase.auth.getUser().then(({ data }) => cargarUsuario(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => { void cargarUsuario(session?.user ?? null); });
    });
    return () => { vigente = false; subscription.unsubscribe(); };
  }, [cargarDatos]);

  const crearCoordinacion = useCallback(async (nueva: NuevaCoordinacion) => {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const orden = coordinaciones.filter((item) => item.fecha === nueva.fecha && item.tercerizadaId === nueva.tercerizadaId && item.cuadrillaId === nueva.cuadrillaId).reduce((mayor, item) => Math.max(mayor, item.orden), -1) + 1;
    const { data, error: insertError } = await supabase.from("coordinaciones").insert({
      fecha: nueva.fecha, ticket: nueva.ticket, cliente: nueva.cliente, tercerizada_id: nueva.tercerizadaId,
      cuadrilla_id: nueva.cuadrillaId, horario_id: nueva.horarioId, tecnologia_id: nueva.tecnologiaId,
      categoria_id: nueva.categoriaId, observaciones: nueva.observaciones || null, zona_id: nueva.zona, orden, ubicacion: nueva.ubicacion || null,
      estado_id: nueva.estadoId, creado_por: auth.user?.id ?? null,
    }).select("id,fecha,ticket,cliente,tercerizada_id,cuadrilla_id,horario_id,tecnologia_id,categoria_id,observaciones,zona_id,estado_id,orden,ubicacion").single();
    lanzarError(insertError);
    if (!data) throw new Error("Supabase no devolvió la coordinación creada.");
    if (nueva.extrasIds.length) {
      const { error: extrasError } = await supabase.from("coordinacion_extras").insert(nueva.extrasIds.map((extraId) => ({ coordinacion_id: data.id, extra_id: extraId })));
      lanzarError(extrasError);
    }
    setCoordinaciones((actuales) => [...actuales, mapearCoordinacion(data, nueva.extrasIds)]);
  }, [coordinaciones]);

  const actualizarCoordinacion = useCallback(async (id: string, actualizacion: NuevaCoordinacion) => {
    const supabase = createClient();
    const anterior = coordinaciones.find((item) => item.id === id);
    const cambiaGrupo = anterior && (anterior.fecha !== actualizacion.fecha || anterior.tercerizadaId !== actualizacion.tercerizadaId || anterior.cuadrillaId !== actualizacion.cuadrillaId);
    const orden = cambiaGrupo
      ? coordinaciones.filter((item) => item.id !== id && item.fecha === actualizacion.fecha && item.tercerizadaId === actualizacion.tercerizadaId && item.cuadrillaId === actualizacion.cuadrillaId).reduce((mayor, item) => Math.max(mayor, item.orden), -1) + 1
      : anterior?.orden ?? 0;
    const { error: updateError } = await supabase.from("coordinaciones").update({
      fecha: actualizacion.fecha, ticket: actualizacion.ticket, cliente: actualizacion.cliente,
      tercerizada_id: actualizacion.tercerizadaId, cuadrilla_id: actualizacion.cuadrillaId,
      horario_id: actualizacion.horarioId, tecnologia_id: actualizacion.tecnologiaId,
      categoria_id: actualizacion.categoriaId, observaciones: actualizacion.observaciones || null,
      zona_id: actualizacion.zona, estado_id: actualizacion.estadoId, orden, ubicacion: actualizacion.ubicacion || null,
    }).eq("id", id);
    lanzarError(updateError);
    const { error: removeExtrasError } = await supabase.from("coordinacion_extras").delete().eq("coordinacion_id", id);
    lanzarError(removeExtrasError);
    if (actualizacion.extrasIds.length) {
      const { error: extrasError } = await supabase.from("coordinacion_extras").insert(actualizacion.extrasIds.map((extraId) => ({ coordinacion_id: id, extra_id: extraId })));
      lanzarError(extrasError);
    }
    setCoordinaciones((actuales) => actuales.map((item) => item.id === id ? { ...actualizacion, id, orden } : item));
  }, [coordinaciones]);

  const reordenarCoordinaciones = useCallback(async (ids: string[]) => {
    if (ids.length < 2) return;
    const supabase = createClient();
    const { error: ordenError } = await supabase.rpc("reordenar_coordinaciones", { p_ids: ids });
    lanzarError(ordenError);
    const ordenes = new Map(ids.map((id, index) => [id, index]));
    setCoordinaciones((actuales) => actuales.map((item) => ordenes.has(item.id) ? { ...item, orden: ordenes.get(item.id)! } : item));
  }, []);

  const crearSolicitudCustodia = useCallback(async (nueva: NuevaSolicitudCustodia) => {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const { data, error: insertError } = await supabase.from("custodias").insert({
      fecha: nueva.fecha, tipo: nueva.tipo, cuadrilla_id: nueva.cuadrillaId,
      horario_retiro: nueva.horarioId, creado_por: auth.user?.id ?? null,
    }).select("id,fecha,tipo,cuadrilla_id,horario_retiro").single();
    lanzarError(insertError);
    if (!data) throw new Error("Supabase no devolvió la solicitud creada.");
    setCustodias((actuales) => [mapearCustodia(data), ...actuales]);
  }, []);

  const eliminarSolicitudCustodia = useCallback(async (id: string) => {
    const supabase = createClient();
    const { data, error: deleteError } = await supabase.from("custodias").delete().eq("id", id).select("id").maybeSingle();
    lanzarError(deleteError);
    if (!data) throw new Error("No se encontró la solicitud o no tenés permiso para eliminarla.");
    setCustodias((actuales) => actuales.filter((solicitud) => solicitud.id !== id));
  }, []);

  const guardarFeriado = useCallback(async (feriado: FeriadoInterno) => {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const nombres = [...new Set(feriado.personalInterno.map((nombre) => nombre.trim()).filter(Boolean))];
    if (!feriado.esFeriado && nombres.length === 0) {
      const { error: deleteError } = await supabase.from("feriados").delete().eq("fecha", feriado.fecha);
      lanzarError(deleteError);
      setFeriados((actuales) => actuales.filter((item) => item.fecha !== feriado.fecha));
      return;
    }
    const { error: feriadoError } = await supabase.from("feriados").upsert({ fecha: feriado.fecha, es_feriado: feriado.esFeriado, creado_por: auth.user?.id ?? null });
    lanzarError(feriadoError);
    const { data: personal, error: personalError } = nombres.length
      ? await supabase.from("personal_interno").upsert(nombres.map((nombre, orden) => ({ nombre, orden })), { onConflict: "nombre" }).select("id,nombre")
      : { data: [], error: null };
    lanzarError(personalError);
    const { error: limpiarError } = await supabase.from("feriado_personal").delete().eq("fecha", feriado.fecha);
    lanzarError(limpiarError);
    if (personal?.length) {
      const { error: asociacionError } = await supabase.from("feriado_personal").insert(personal.map((item, orden) => ({ fecha: feriado.fecha, personal_id: item.id, orden })));
      lanzarError(asociacionError);
    }
    setFeriados((actuales) => [...actuales.filter((item) => item.fecha !== feriado.fecha), { ...feriado, personalInterno: nombres }].sort((a, b) => a.fecha.localeCompare(b.fecha)));
  }, []);

  const quitarFeriado = useCallback(async (fecha: string) => {
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("feriados").delete().eq("fecha", fecha);
    lanzarError(deleteError);
    setFeriados((actuales) => actuales.filter((item) => item.fecha !== fecha));
  }, []);

  const agregarNotaEquipo = useCallback(async (comentario: string) => {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("Iniciá sesión para agregar una nota.");
    const { data: perfil } = await supabase.from("usuarios").select("nombre_completo").eq("id", auth.user.id).maybeSingle();
    const { data, error: insertError } = await supabase.from("notas_equipo").insert({ comentario: comentario.trim(), creado_por: auth.user.id }).select("id,comentario,creado_por,created_at").single();
    lanzarError(insertError);
    if (!data) throw new Error("Supabase no devolvió la nota creada.");
    setNotasEquipo((actuales) => [{ id: data.id, comentario: data.comentario, usuario: perfil?.nombre_completo || auth.user.email?.split("@")[0] || "Usuario", fechaHora: data.created_at }, ...actuales]);
  }, []);

  const guardarCatalogo = useCallback(async (tipo: CatalogoKey, opciones: CatalogosDemo[CatalogoKey]) => {
    if (rolDemo === "COORDINADOR") throw new Error("Solo Supervisor y Jefe pueden administrar catálogos.");
    const supabase = createClient();
    const anteriores = catalogos[tipo] as CatalogOption[];
    const nuevas = opciones as CatalogOption[];
    const idsNuevos = new Set(nuevas.map((opcion) => opcion.id));
    const filas = tipo === "cuadrillas"
      ? (opciones as CuadrillaCatalogo[]).map((opcion, orden) => ({ id: opcion.id, nombre: opcion.nombre, tercerizada_id: opcion.tercerizadaId, activo: true, orden: (orden + 1) * 10 }))
      : nuevas.map((opcion, orden) => ({ id: opcion.id, nombre: opcion.nombre, activo: true, orden: (orden + 1) * 10 }));
    const { error: saveError } = await supabase.from(tipo).upsert(filas as never[], { onConflict: "id" });
    lanzarError(saveError);
    const eliminados = anteriores.map((opcion) => opcion.id).filter((id) => !idsNuevos.has(id));
    if (eliminados.length) {
      const { error: deleteError } = await supabase.from(tipo).delete().in("id", eliminados);
      lanzarError(deleteError);
    }
    setCatalogos((actuales) => ({ ...actuales, [tipo]: opciones }));
  }, [catalogos, rolDemo]);

  const value = useMemo(() => ({
    coordinaciones, custodias, feriados, notasEquipo, catalogos, rolDemo, usuarioActual,
    ready, error, crearCoordinacion, actualizarCoordinacion, reordenarCoordinaciones, crearSolicitudCustodia, eliminarSolicitudCustodia,
    guardarFeriado, quitarFeriado, agregarNotaEquipo, guardarCatalogo,
  }), [coordinaciones, custodias, feriados, notasEquipo, catalogos, rolDemo, usuarioActual, ready, error,
    crearCoordinacion, actualizarCoordinacion, reordenarCoordinaciones, crearSolicitudCustodia, eliminarSolicitudCustodia, guardarFeriado, quitarFeriado, agregarNotaEquipo, guardarCatalogo]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useCoordinacionesDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error("useCoordinacionesDemo debe usarse dentro de DemoDataProvider.");
  return context;
}
