// Catálogos editables. Los `id` viajan en enlaces compartidos: no los cambies
// una vez publicados; edita etiquetas, colores, textos o agrega nuevos ítems.

export const COLORS = Object.freeze([
  { id: "negro", label: "Negro", hex: "#111214" },
  { id: "gris-oscuro", label: "Gris oscuro", hex: "#4d4f53" },
  { id: "gris", label: "Gris", hex: "#85878a" },
  { id: "beige", label: "Beige", hex: "#cdbb9b" },
  { id: "cafe", label: "Café", hex: "#70462e" },
  { id: "rojo", label: "Rojo", hex: "#c71d28" },
  { id: "azul", label: "Azul", hex: "#164f9d" },
  { id: "marino", label: "Azul marino", hex: "#162b4a" },
  { id: "turquesa", label: "Turquesa", hex: "#1594a6" },
  { id: "morado", label: "Morado", hex: "#6a3fa0" },
  { id: "verde", label: "Verde", hex: "#145a42" },
  { id: "naranja", label: "Naranja", hex: "#d86b1c" },
  { id: "blanco", label: "Blanco", hex: "#e9e9e6" },
  { id: "borgona", label: "Borgoña", hex: "#641c2a" },
]);

export const PATTERNS = Object.freeze([
  { id: "liso", label: "Liso", svgId: null },
  { id: "chevron", label: "Chevron (V)", svgId: "pattern-chevron" },
  { id: "diamante", label: "Rombos", svgId: "pattern-diamond" },
  { id: "ondas", label: "Ondas", svgId: "pattern-wave" },
  { id: "hexagonal", label: "Hexagonal", svgId: "pattern-hex" },
  { id: "deportivo", label: "Deportivo", svgId: "pattern-sport" },
  { id: "perforado", label: "Microperforado", svgId: "pattern-dots" },
]);

export const STITCH_COLORS = Object.freeze([
  { id: "roja", label: "Roja", hex: "#e50914" },
  { id: "blanca", label: "Blanca", hex: "#ffffff" },
  { id: "negra", label: "Negra", hex: "#111111" },
  { id: "azul", label: "Azul", hex: "#2776db" },
  { id: "beige", label: "Beige", hex: "#d7b986" },
  { id: "turquesa", label: "Turquesa", hex: "#1594a6" },
  { id: "morada", label: "Morada", hex: "#6a3fa0" },
  { id: "gris", label: "Gris", hex: "#9a9ba0" },
]);

// El ribete es global: enmarca los paneles y separa visualmente el centro de
// los bolsters. Sus `id` también forman parte de los enlaces compartidos.
export const PIPING_COLORS = Object.freeze([
  { id: "roja", label: "Rojo", hex: "#e50914" },
  { id: "blanca", label: "Blanco", hex: "#f4f1e8" },
  { id: "negra", label: "Negro", hex: "#111111" },
  { id: "beige", label: "Beige", hex: "#d7b986" },
  { id: "amarilla", label: "Amarillo", hex: "#f2c230" },
  { id: "azul", label: "Azul", hex: "#2776db" },
  { id: "turquesa", label: "Turquesa", hex: "#1594a6" },
  { id: "gris", label: "Gris", hex: "#9a9ba0" },
]);

export const MATERIALS = Object.freeze([
  { id: "americano", label: "Cuero Americano", short: "Liso y brillante" },
  { id: "colombiano", label: "Cuero Colombiano", short: "Grano marcado" },
]);

export const EMBROIDERIES = Object.freeze([
  { id: "ninguno", label: "Sin bordado" },
  { id: "forros-cuenca", label: "FORROS CUENCA" },
  { id: "nombre", label: "Nombre del cliente" },
  { id: "logo", label: "Logo" },
]);

// `parent` marca una sub-zona dibujada dentro de otra: si un diseño no la
// define, hereda el acabado de su zona madre.
export const PARTS = Object.freeze([
  { id: "back", number: 1, label: "Centro respaldo", short: "Respaldo", svgZoneIds: ["zone-back"], svgPatternIds: ["pattern-back"] },
  { id: "side", number: 2, label: "Laterales respaldo", short: "Laterales", svgZoneIds: ["zone-side-left", "zone-side-right"], svgPatternIds: ["pattern-side-left", "pattern-side-right"] },
  { id: "base", number: 3, label: "Centro cojín", short: "Cojín", svgZoneIds: ["zone-base"], svgPatternIds: ["pattern-base"] },
  { id: "head", number: 4, label: "Cabecera", short: "Cabecera", svgZoneIds: ["zone-head"], svgPatternIds: ["pattern-head"] },
  { id: "edge", number: 5, label: "Laterales cojín", short: "Bordes cojín", svgZoneIds: ["zone-edge"], svgPatternIds: ["pattern-edge"] },
  { id: "top", number: 6, parent: "back", label: "Panel superior respaldo", short: "Panel superior", svgZoneIds: ["zone-top"], svgPatternIds: ["pattern-top"] },
  { id: "headCenter", number: 7, parent: "head", label: "Centro cabecera", short: "Centro cabecera", svgZoneIds: ["zone-head-center"], svgPatternIds: ["pattern-head-center"] },
  { id: "front", number: 8, parent: "edge", label: "Frente del cojín", short: "Frente cojín", svgZoneIds: ["zone-front"], svgPatternIds: ["pattern-front"] },
]);

export const TABS = Object.freeze([
  { id: "color", label: "Color" }, { id: "pattern", label: "Patrón" },
  { id: "stitch", label: "Costura" }, { id: "piping", label: "Ribete" },
  { id: "material", label: "Material" },
  { id: "embroidery", label: "Bordado" },
]);

export const WHATSAPP_NUMBER = "593984353695";

// Escribe solo el número, sin símbolo de dólar. Ejemplo: "120".
// Déjalo vacío para mostrar únicamente "Cotizar en WhatsApp".
export const PRECIO_DESDE = "";

export function findById(collection, id) {
  return collection.find((item) => item.id === id);
}
