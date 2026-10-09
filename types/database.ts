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
      roles: Table<{ id: string; codigo: "COORDINADOR" | "SUPERVISOR" | "JEFE"; nombre: string; created_at: string }, { id?: string; codigo: "COORDINADOR" | "SUPERVISOR" | "JEFE"; nombre: string }>;
      usuarios: Table<{ id: string; nombre_completo: string | null; rol_id: string; activo: boolean; created_at: string; updated_at: string }, { id: string; nombre_completo?: string | null; rol_id: string; activo?: boolean }>;
      tercerizadas: Table<CatalogRow, CatalogInsert>;
      cuadrillas: Table<CatalogRow & { tercerizada_id: string | null; zona_id: string | null }, CatalogInsert & { tercerizada_id?: string | null; zona_id?: string | null }>;
      tecnologias: Table<CatalogRow, CatalogInsert>;
      categorias: Table<CatalogRow, CatalogInsert>;
      horarios: Table<CatalogRow, CatalogInsert>;
      zonas: Table<CatalogRow, CatalogInsert>;
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
      personal_interno: Table<CatalogRow, CatalogInsert>;
      feriados: Table<{ fecha: string; es_feriado: boolean; creado_por: string | null; created_at: string; updated_at: string }, { fecha: string; es_feriado?: boolean; creado_por?: string | null }>;
      feriado_personal: Table<{ fecha: string; personal_id: string; orden: number }, { fecha: string; personal_id: string; orden?: number }>;
      notas_equipo: Table<{ id: string; comentario: string; creado_por: string; created_at: string }, { id?: string; comentario: string; creado_por: string; created_at?: string }>;
    };
    Views: Record<string, never>;
    Functions: { mi_rol: { Args: Record<string, never>; Returns: string | null }; reordenar_coordinaciones: { Args: { p_ids: string[] }; Returns: undefined } };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
