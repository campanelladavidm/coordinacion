export const PENDIENTE_CATEGORIAS = [
  { id: "instalaciones_fibra", label: "Instalaciones fibra", color: "#32c5e8" },
  { id: "instalaciones_wireless", label: "Instalaciones wireless", color: "#4f91f7" },
  { id: "instalaciones_iptv", label: "Instalaciones + IPTV", color: "#a27aee" },
  { id: "iptv_insitu", label: "IPTV insitu", color: "#e3b44c" },
  { id: "cambio_tecnologia", label: "Cambio de tecnología", color: "#46c79a" },
  { id: "anti_baja_retencion", label: "Anti-baja retención", color: "#e77f92" },
  { id: "traslado_externo", label: "Traslado externo", color: "#78a9d8" },
  { id: "gamer", label: "Gamer", color: "#c18ce8" },
  { id: "home_max", label: "Home max", color: "#7fbf75" },
  { id: "garantias_criticas", label: "Garantías críticas", color: "#f08b55" },
  { id: "garantias_no_criticas", label: "Garantías no críticas", color: "#7cb9b5" },
] as const;

export type PendienteCategoria = (typeof PENDIENTE_CATEGORIAS)[number]["id"];
export type PendienteRegistro = { fecha: string; categoria: PendienteCategoria; cantidad: number };
