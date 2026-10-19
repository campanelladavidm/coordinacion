type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type CatalogRow = { id: string; nombre: string; activo: boolean; orden: number; created_at: string };
type CatalogInsert = { id?: string; nombre: string; activo?: boolean; orden?: number };

export type Database = {
  public: {
    Tables: {
      roles: Table<{ id: string; codigo: "COORDINADOR" | "SUPERVISOR" | "JEFE" | "SOPORTE"; nombre: string; created_at: string }, { id?: string; codigo: "COORDINADOR" | "SUPERVISOR" | "JEFE" | "SOPORTE"; nombre: string }>;
      usuarios: Table<{ id: string; nombre_completo: string | null; rol_id: string; activo: boolean; created_at: string; updated_at: string }, { id: string; nombre_completo?: string | null; rol_id: string; activo?: boolean }>;
      tercerizadas: Table<CatalogRow, CatalogInsert>;
      cuadrillas: Table<CatalogRow & { tercerizada_id: string | null; zona_id: string | null }, CatalogInsert & { tercerizada_id?: string | null; zona_id?: string | null }>;
      tecnologias: Table<CatalogRow, CatalogInsert>;
      categorias: Table<CatalogRow, CatalogInsert>;
      horarios: Table<CatalogRow, CatalogInsert>;
      zonas: Table<CatalogRow & { latitud: number | null; longitud: number | null }, CatalogInsert & { latitud?: number | null; longitud?: number | null }>;
      estados: Table<CatalogRow, CatalogInsert>;
      extras: Table<CatalogRow, CatalogInsert>;
      coordinaciones: Table<
        { id: string; fecha: string; ticket: string; cliente: string; tercerizada_id: string | null; cuadrilla_id: string | null; horario_id: string | null; tecnologia_id: string; categoria_id: string; observaciones: string | null; zona_id: string | null; estado_id: string; orden: number; ubicacion: string | null; creado_por: string | null; created_at: string; updated_at: string },
        { id?: string; fecha: string; ticket: string; cliente: string; tercerizada_id?: string | null; cuadrilla_id?: string | null; horario_id?: string | null; tecnologia_id: string; categoria_id: string; observaciones?: string | null; zona_id?: string | null; estado_id: string; orden?: number; ubicacion?: string | null; creado_por?: string | null; created_at?: string; updated_at?: string }
      >;
      coordinacion_extras: Table<{ coordinacion_id: string; extra_id: string }, { coordinacion_id: string; extra_id: string }, never>;
      custodias: Table<
        { id: string; fecha: string; tipo: "CUSTODIA" | "POLICIA"; cuadrilla_id: string; horario_retiro_id: string | null; horario_retiro: string; observaciones: string | null; creado_por: string | null; created_at: string },
        { id?: string; fecha: string; tipo: "CUSTODIA" | "POLICIA"; cuadrilla_id: string; horario_retiro_id?: string | null; horario_retiro: string; observaciones?: string | null; creado_por?: string | null; created_at?: string }
      >;
      rangos_cuadrilla: Table<
        { fecha: string; cuadrilla_id: string; cantidad_tickets: number | null; no_trabaja: boolean; actualizado_por: string | null; created_at: string; updated_at: string },
        { fecha: string; cuadrilla_id: string; cantidad_tickets: number | null; no_trabaja?: boolean; actualizado_por?: string | null; created_at?: string; updated_at?: string }
      >;
      personal_interno: Table<CatalogRow, CatalogInsert>;
      feriados: Table<{ fecha: string; es_feriado: boolean; creado_por: string | null; created_at: string; updated_at: string }, { fecha: string; es_feriado?: boolean; creado_por?: string | null }>;
      feriado_personal: Table<{ fecha: string; personal_id: string; orden: number }, { fecha: string; personal_id: string; orden?: number }>;
      notas_equipo: Table<{ id: string; comentario: string; creado_por: string; created_at: string }, { id?: string; comentario: string; creado_por: string; created_at?: string }>;
      avisos: Table<{ id: string; texto: string; desde: string; hasta: string; creado_por: string; created_at: string }, { id?: string; texto: string; desde: string; hasta: string; creado_por: string; created_at?: string }>;
      aviso_destinatarios: Table<{ aviso_id: string; usuario_id: string }, { aviso_id: string; usuario_id: string }, never>;
      avisos_cerrados: Table<{ aviso_id: string; usuario_id: string; cerrado_at: string }, { aviso_id: string; usuario_id: string; cerrado_at?: string }>;
      novedades: Table<
        { id: string; fecha: string; motivo: string; descripcion: string; tiempo_devuelto: boolean; detalle_devolucion: string | null; creado_por: string; created_at: string },
        { id?: string; fecha: string; motivo: string; descripcion: string; tiempo_devuelto?: boolean; detalle_devolucion?: string | null; creado_por: string; created_at?: string }
      >;
      novedades_vistas: Table<{ novedad_id: string; jefe_id: string; revisado_at: string }, { novedad_id: string; jefe_id: string; revisado_at?: string }>;
      liquidaciones: Table<
        { id: string; tercerizada_id: string; mes: number; anio: number; estado: "BORRADOR" | "FINALIZADA"; conceptos: unknown[]; informacion_adicional: string; creado_por: string; finalizado_por: string | null; finalizado_at: string | null; created_at: string; updated_at: string },
        { id?: string; tercerizada_id: string; mes: number; anio: number; estado?: "BORRADOR" | "FINALIZADA"; conceptos?: unknown[]; informacion_adicional?: string; creado_por: string; finalizado_por?: string | null; finalizado_at?: string | null; created_at?: string; updated_at?: string }
      >;
      liquidaciones_exportaciones: Table<
        { id: string; mes: number; anio: number; nombre_archivo: string; storage_path: string; creado_por: string; created_at: string },
        { id?: string; mes: number; anio: number; nombre_archivo: string; storage_path: string; creado_por: string; created_at?: string }
      >;
      actuaciones_jefe: Table<
        { id: string; jefe_id: string | null; usuario_contexto_id: string | null; tabla: string; operacion: string; fila_id: string | null; datos_anteriores: unknown; datos_nuevos: unknown; created_at: string },
        { id?: string; jefe_id?: string | null; usuario_contexto_id?: string | null; tabla: string; operacion: string; fila_id?: string | null; datos_anteriores?: unknown; datos_nuevos?: unknown; created_at?: string }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      mi_rol: { Args: Record<string, never>; Returns: string | null };
      fechas_con_coordinaciones_calendario: { Args: Record<string, never>; Returns: { fecha: string }[] };
      obtener_uso_base_datos_bytes: { Args: Record<string, never>; Returns: number };
      reordenar_coordinaciones: { Args: { p_ids: string[] }; Returns: undefined };
      asignar_coordinaciones_a_cuadrilla: { Args: { p_ids: string[]; p_cuadrilla_id: string }; Returns: undefined };
      radar_semanal: { Args: { p_semana_inicio: string }; Returns: { fecha: string; zona_id: string | null; zona: string; cantidad: number }[] };
      radar_categorias_semanal: { Args: { p_semana_inicio: string }; Returns: { fecha: string; categoria_id: string; categoria: string; cantidad: number }[] };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
