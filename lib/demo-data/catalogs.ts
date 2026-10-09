export type CatalogOption = { id: string; nombre: string };

export const tercerizadas: CatalogOption[] = [
  { id: "atinet", nombre: "Atinet" },
  { id: "elio-cogo", nombre: "Elio Cogo" },
  { id: "ipnet", nombre: "Ipnet" },
  { id: "ciro-martinez", nombre: "Ciro Martinez" },
  { id: "bronet", nombre: "Bronet" },
  { id: "ayr", nombre: "AyR" },
  { id: "galuminet", nombre: "Galuminet" },
  { id: "artec", nombre: "Artec" },
];

export const cuadrillas: (CatalogOption & { tercerizadaId: string })[] = [
  { id: "atinet-a1", nombre: "Pablo Vigon", tercerizadaId: "atinet" },
  { id: "atinet-a2", nombre: "Lautaro Biginay", tercerizadaId: "atinet" },
  { id: "atinet-ricardo-tarifa", nombre: "Ricardo Tarifa", tercerizadaId: "atinet" },
  { id: "atinet-ezequiel-funes", nombre: "Ezequiel Funes", tercerizadaId: "atinet" },
  { id: "atinet-jorge-huanca", nombre: "Jorge Huanca", tercerizadaId: "atinet" },
  { id: "atinet-fernando-alcazar", nombre: "Fernando Alcazar", tercerizadaId: "atinet" },
  { id: "atinet-david-gaspar", nombre: "David Gaspar", tercerizadaId: "atinet" },
  { id: "atinet-matias-guzman", nombre: "Matias Guzman", tercerizadaId: "atinet" },
  { id: "atinet-marcelo-chiarello", nombre: "Marcelo Chiarello", tercerizadaId: "atinet" },
  { id: "atinet-gonzalo-catacata", nombre: "Gonzalo Catacata", tercerizadaId: "atinet" },
  { id: "atinet-julio-castro", nombre: "Julio Castro", tercerizadaId: "atinet" },
  { id: "elio-e1", nombre: "Walter Zarate", tercerizadaId: "elio-cogo" },
  { id: "elio-cogo-elio-cogo", nombre: "Elio Cogo", tercerizadaId: "elio-cogo" },
  { id: "elio-daniel-zarate", nombre: "Daniel Zarate", tercerizadaId: "elio-cogo" },
  { id: "elio-nahuel-mora", nombre: "Nahuel Mora", tercerizadaId: "elio-cogo" },
  { id: "elio-diego-campos", nombre: "Diego Campos", tercerizadaId: "elio-cogo" },
  { id: "ipnet-i1", nombre: "Fernando Araya", tercerizadaId: "ipnet" },
  { id: "ipnet-i2", nombre: "Gabriel Bringas", tercerizadaId: "ipnet" },
  { id: "ciro-c1", nombre: "Ciro Martinez", tercerizadaId: "ciro-martinez" },
  { id: "bronet-b1", nombre: "Ricardo Cortez", tercerizadaId: "bronet" },
  { id: "bronet-matias-principe", nombre: "Matias Principe", tercerizadaId: "bronet" },
  { id: "ayr-emiliano-vallejos", nombre: "Emiliano Vallejos", tercerizadaId: "ayr" },
  { id: "ayr-brian-vallejos", nombre: "Brian Vallejos", tercerizadaId: "ayr" },
  { id: "ayr-enzo-campillay", nombre: "Enzo Campillay", tercerizadaId: "ayr" },
  { id: "galuminet-luis-carcamo", nombre: "Luis Carcamo", tercerizadaId: "galuminet" },
  { id: "artec-ar1", nombre: "Daniel Arangue", tercerizadaId: "artec" },
];

export const zonas: CatalogOption[] = [
  "Perdriel", "Ugarteche", "Agrelo", "Castrol", "Las Compuertas", "Gloria",
  "Russel", "Coquimbito", "Lunlunta", "San Francisco", "Rodeo de la Cruz",
  "Rodeo del Medio", "Km8", "Fray Luis", "Bombal", "Primavera", "Puente de Hierro",
  "Segovia", "Bermejo", "Lihue", "Las Heras", "Las Heras Yapeyu", "Las Heras Espejo",
  "Santa Teresita", "Favorita", "Challao", "Lavalle", "La Pega", "Costa Araujo",
  "Gustavo André", "Jocoli Viejo", "Jocoli", "Sauce", "Plumerillo", "Borbollón",
  "Corralitos", "Cruz de Piedra", "Godoy Cruz", "San José", "Dorrego", "Decimo",
  "Mendoza Norte", "Puerto Bizantino",
].map((nombre) => ({
  id: "zona-" + nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
  nombre,
}));

export const tecnologias: CatalogOption[] = [
  { id: "fibra", nombre: "Fibra" },
  { id: "wireless", nombre: "Wireless" },
];

export const categorias: CatalogOption[] = [
  "Instalaciones Fibra", "Instalaciones BP", "Instalaciones Programadas",
  "Instalaciones Wireless", "Garantía Critica", "Garantía NO Critica",
  "Cambio de tecnologia", "Traslado Externo", "Traslado Programado",
  "Anti-Baja Retención", "Instalaciones Extensible", "Instalaciones Fibra + IPTV",
  "Instalaciones Wireless + IPTV", "IPTV In Situ", "Instalaciones Home Max",
  "Instalaciones Gamer", "Instalaciones Home Max Económico",
].map((nombre) => ({ id: nombre.toLowerCase().replaceAll("+", "").replaceAll(" ", "-").replaceAll("--", "-"), nombre }));

export const horarios: CatalogOption[] = [
  { id: "manana", nombre: "Mañana (9 a 13)" },
  { id: "tarde", nombre: "Tarde (13 a 18)" },
  { id: "todo-el-dia", nombre: "Todo el día" },
  { id: "particular", nombre: "Particular" },
];

export const estados: CatalogOption[] = [
  { id: "contactado", nombre: "Contactado" },
  { id: "confirmado", nombre: "Confirmado" },
  { id: "cancelado", nombre: "Cancelado" },
  { id: "rechazado", nombre: "Rechazado" },
  { id: "espera", nombre: "Espera" },
];

export const extras: CatalogOption[] = [
  "Enojado", "Recoordinado", "Urgente", "Zonda", "Lluvia", "Huawei", "Policía", "Custodia",
].map((nombre) => ({ id: nombre.toLowerCase().replaceAll(" ", "-"), nombre }));

export function nombreDe(opciones: CatalogOption[], id: string | null) {
  return opciones.find((opcion) => opcion.id === id)?.nombre ?? "Sin asignar";
}

export function cuadrillasDeTercerizada(tercerizadaId: string | null) {
  return cuadrillas.filter((cuadrilla) => cuadrilla.tercerizadaId === tercerizadaId);
}
