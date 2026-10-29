// Asiento delantero del conductor del Kia Soluto (2019 a hoy) — Versión 5 (realismo FC-20):
// Calibrado con FC-20-kia-soluto-negro-canales-horizontales-OBJETIVO.jpg:
// - Respaldo "almohadón" (respaldo-almohadon.js): panel central ancho con zona superior perforada y 4 canales
//   abombados (relieve del estado liso), laterales como almohadones gruesos y redondeados sin pared interior,
//   hombros en arco continuo, franja exterior con pespunte, canto redondeado y cara trasera convexa.
// - Cabecera "almohada" (cabecera-almohadon.js): frente abombado de esquinas muy redondeadas, centro perforado
//   hasta casi el canto, borde superior en arco y varillas casi ocultas.
// - Cojín almohadón (cojin-almohadon.js) y carcasa plástica ancha a juego.
import * as THREE from "../../vendor/three-0.186.1-extra.min.js";
import { crearCojinAlmohadon, crearCarcasaAlmohadon } from "../cojin-almohadon.js?v=20";
import { crearRespaldoAlmohadon } from "../respaldo-almohadon.js?v=2";
import { crearCabeceraAlmohadon } from "../cabecera-almohadon.js?v=2";
import { mallasDeCuerpo, materialesBase, varilla } from "../piezas.js?v=7";

export const INFO = {
  id: "kia-soluto-2019",
  nombre: "Kia Soluto",
  generacion: "2019 a hoy",
  fabrica: {
    side: "negro",
    back: "negro",
    top: "negro",
    base: "negro",
    edge: "negro",
    front: "negro",
    head: "negro",
    headCenter: "negro",
  },
};

// Factores de ancho por parte (1 = medida base). Sirven para calibrar la silueta frontal contra el catálogo.
export const AJUSTE = { cojin: 1.0, respaldo: [1.0, 1.0], cabecera: 1.0, base: 1.0 };
// El factor puede ser un número o una lista [abajo, ..., arriba] que se interpola a lo largo de la altura (u de 0 a 1).
const factorAjuste = (clave, u) => {
  const k = AJUSTE[clave];
  if (!Array.isArray(k)) return k;
  const x = Math.min(1, Math.max(0, u)) * (k.length - 1);
  const i = Math.min(k.length - 2, Math.floor(x));
  return k[i] + (k[i + 1] - k[i]) * (x - i);
};

export function crear() {
  const raiz = new THREE.Group();
  raiz.name = INFO.id;
  const { plastico, cromo } = materialesBase();

  // ---------- 1. Cojín "almohadón" (panel trapecio con canales, almohadones laterales, nariz delgada) ----------
  const cojin = crearCojinAlmohadon({ escala: AJUSTE.cojin });
  raiz.add(mallasDeCuerpo(cojin, "cojin"));
  const carcasa = crearCarcasaAlmohadon(plastico, cojin.medidas);

  // ---------- 2. Respaldo almohadón FC-20 (panel ancho con canales, almohadones laterales, hombros en arco) ----------
  const respaldo = crearRespaldoAlmohadon({ ancho: (u) => factorAjuste("respaldo", u) });
  raiz.add(mallasDeCuerpo(respaldo, "respaldo"));

  // ---------- 3. Cabecera almohada FC-20, apoyada sobre el arco de los hombros ----------
  const ejeX = new THREE.Vector3(1, 0, 0);
  const sup = respaldo.superior;
  const wMed = 0.5 * (sup.wF + sup.wB);
  // La cabecera queda 8° más vertical que el respaldo (como en el catálogo)
  const Th = respaldo.marco.T.clone().applyAxisAngle(ejeX, THREE.MathUtils.degToRad(8)).normalize();
  const Nh = new THREE.Vector3(0, -Th.z, Th.y).normalize();
  // La base de la cabecera se apoya sobre el arco de los hombros (sin rendija visible)
  const Oh = respaldo.mundo(0, sup.v - 9, wMed + 6);
  const cabecera = crearCabeceraAlmohadon({ escala: factorAjuste("cabecera", 0.5), marco: { O: Oh, X: ejeX, T: Th, N: Nh } });
  raiz.add(mallasDeCuerpo(cabecera, "cabecera"));

  // Varillas cortas casi ocultas: entran en el respaldo y en la cabecera, solo asoman en la rendija
  for (const x of [-66, 66]) {
    const abajo = respaldo.mundo(x, sup.v - 46, wMed);
    const arriba = Oh.clone().addScaledVector(ejeX, x).addScaledVector(Th, 34);
    raiz.add(varilla(abajo, arriba, 5.5, cromo));
  }

  // ---------- 4. Carcasa plástica inferior ancha y redondeada (FC-20) ----------
  raiz.add(carcasa);

  raiz.scale.setScalar(0.001);
  return raiz;
}
