export const MOTIVOS_NOVEDAD = [
  "Turno medico",
  "Horas extras",
  "Feriado",
  "Personal",
  "Home Office",
  "Vehiculo",
  "Enfermedad",
  "Vacaciones",
  "Otro",
] as const;

export type MotivoNovedad = (typeof MOTIVOS_NOVEDAD)[number];
