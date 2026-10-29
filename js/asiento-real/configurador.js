// Conecta el asiento 3D V3 con el configurador del sitio: reemplaza el dibujo
// plano cuando el navegador tiene WebGL, pinta el diseño elegido con relieve 3D
// real y permite tocar una zona del asiento para seleccionarla.
import { crearVisor } from "./escena.js?v=52";
import { aplicarDiseno, liberarAsiento } from "./materiales.js?v=51";
import { precalentarPatrones } from "./texturas.js?v=13";
import * as dmax from "./modelos/chevrolet-dmax.js?v=53";
import * as soluto from "./modelos/kia-soluto-2019.js?v=53";
import * as hilux from "./modelos/toyota-hilux.js?v=53";

// Cada asiento propio sale solo con su vehículo. Los demás modelos muestran el
// asiento de referencia hasta que tengan el suyo.
const MODELOS = [
  { coincide: /\bsoluto\b/i, modulo: soluto },
  { coincide: /\bd-?\s*max\b/i, modulo: dmax },
  { coincide: /\bhilux\b/i, modulo: hilux },
];
const REFERENCIA = soluto;

function modeloPara(vehiculo) {
  const texto = `${vehiculo?.model ?? ""}`;
  return (MODELOS.find((m) => m.coincide.test(texto)) ?? { modulo: REFERENCIA }).modulo;
}

// Prepara en segundo plano las texturas de todos los patrones (en un Worker)
// para que elegir un patrón o cambiar de cuero sea instantáneo.
let temporizador = 0;
function programarPrecalentamiento(config) {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    const usados = [...new Set(Object.values(config.zones).map((z) => z.pattern))];
    const otro = config.material === "colombiano" ? "americano" : "colombiano";
    precalentarPatrones(config.material, usados);
    precalentarPatrones(otro, usados);
  }, 1200);
}

function soportaWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function iniciarAsiento3D(escenario, { alElegirZona } = {}) {
  if (!escenario || !soportaWebGL()) return null;
  const contenedor = document.createElement("div");
  contenedor.className = "seat-3d";
  escenario.append(contenedor);

  let visor;
  try {
    visor = crearVisor(contenedor, {
      etiqueta: "Asiento en 3D: arrastra para girarlo y toca una zona para elegirla",
      alElegirZona,
    });
  } catch {
    contenedor.remove();
    return null;
  }
  escenario.classList.add("has-3d");

  const vigia = new IntersectionObserver(([e]) => visor.pausar(!e.isIntersecting));
  vigia.observe(escenario);

  let modulo = null;
  let asiento = null;
  let zonaActiva = null;
  let destello = 0;

  function resaltar(zonaId) {
    const mats = asiento?.userData.materiales;
    if (!mats) return;
    cancelAnimationFrame(destello);
    for (const m of mats.zona.values()) m.emissive.setRGB(0, 0, 0);
    const m = mats.zona.get(zonaId);
    if (!m) return;
    const inicio = performance.now();
    const paso = (ahora) => {
      const t = (ahora - inicio) / 1100;
      const k = t < 1 ? Math.sin(Math.PI * Math.min(1, t)) * 0.28 : 0;
      m.emissive.setRGB(0.9 * k, 0.04 * k, 0.08 * k);
      visor.pedir();
      if (t < 1) destello = requestAnimationFrame(paso);
    };
    destello = requestAnimationFrame(paso);
  }

  return {
    actualizar(config, parteActiva) {
      const nuevo = modeloPara(config.vehicle);
      if (nuevo !== modulo) {
        if (asiento) {
          visor.quitarAsiento();
          liberarAsiento(asiento);
        }
        modulo = nuevo;
        asiento = modulo.crear();
        zonaActiva = null;
      }
      aplicarDiseno(asiento, config);
      programarPrecalentamiento(config);
      if (!asiento.parent) visor.ponerAsiento(asiento);
      if (parteActiva !== zonaActiva) {
        if (zonaActiva !== null) resaltar(parteActiva);
        zonaActiva = parteActiva;
      }
      visor.pedir();
    },
  };
}
