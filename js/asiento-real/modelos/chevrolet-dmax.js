// Asiento delantero del conductor del Chevrolet D-Max (2015 a hoy) — Versión 6 (almohadón FC-24):
// Calibrado con FC-24-chevrolet-dmax-negro-centro-horizontal.jpg:
// - Cojín almohadón (cojin-almohadon.js) con cuero liso de fábrica, 3 canales horizontales anchos,
//   almohadones laterales continuos en "U" y carcasa plástica redondeada a juego.
// - Respaldo almohadón (respaldo-almohadon.js): panel central en trapecio con arco superior, 4 canales
//   horizontales anchos y abombados (back), yugo superior liso (top), costuras diagonales con doble
//   pespunte en los hombros, laterales abombados sin pellizcos y cara trasera convexa.
// - Cabecera almohadón (cabecera-almohadon.js): cuero liso con costuras laterales de doble pespunte.
import * as THREE from "../../vendor/three-0.186.1-extra.min.js";
import { crearCojinAlmohadon, crearCarcasaAlmohadon } from "../cojin-almohadon.js?v=20";
import { crearRespaldoAlmohadon } from "../respaldo-almohadon.js?v=2";
import { crearCabeceraAlmohadon } from "../cabecera-almohadon.js?v=2";
import { mallasDeCuerpo, materialesBase, varilla } from "../piezas.js?v=7";
import { suave } from "../almohadon-cerrado.js?v=2";

export const INFO = {
  id: "chevrolet-dmax",
  nombre: "Chevrolet D-Max",
  generacion: "2015 a hoy",
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

export const AJUSTE = {
  cojin: 1.005,
  respaldo: [0.945, 0.995, 1.005, 1.005, 1.005, 1.0],
  cabecera: [0.99, 1.01, 1.03, 1.14, 1.28],
  base: 1.0,
};

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

  // ---------- 1. Cojín almohadón FC-24 (cuero liso, canales horizontales anchos) ----------
  const cojin = crearCojinAlmohadon({
    escala: factorAjuste("cojin", 0.5),
    perforado: false,
    costillas: [-112, -38, 36, 110, 182],
    bolster: 35,
    bolsterFrente: 0.92,
    bolsterNariz: 0.14,
    RtNariz: 28,
    RbNariz: 32,
    nariz: 96,
    panel: { hb: 140, hf: 192, zb: -172, zf: 252, rc: 102 },
  });
  raiz.add(mallasDeCuerpo(cojin, "cojin"));
  const carcasa = crearCarcasaAlmohadon(plastico, cojin.medidas);

  // ---------- 2. Respaldo almohadón FC-24 (trapecio con recorte superior, 4 canales anchos, hombros con costura diagonal) ----------
  const respaldo = crearRespaldoAlmohadon({
    ancho: (u) => factorAjuste("respaldo", u),
    hwPanel: 138,
    fraccionTop: 0.35,
    vC0: 92,
    nCanales: 4,
    altoCanal: 6.8,
    arcoCorte: 14,
    escalaX: (v) => 1 - 0.08 * suave(160, 460, v),
    costurasHombro: true,
    dobleCosturaTop: true,
    perforado: () => false,
  });
  raiz.add(mallasDeCuerpo(respaldo, "respaldo"));

  // ---------- 3. Cabecera almohadón FC-24 (lisa, doble pespunte lateral) ----------
  const ejeX = new THREE.Vector3(1, 0, 0);
  const sup = respaldo.superior;
  const wMed = 0.5 * (sup.wF + sup.wB);
  const Th = respaldo.marco.T.clone().applyAxisAngle(ejeX, THREE.MathUtils.degToRad(8)).normalize();
  const Nh = new THREE.Vector3(0, -Th.z, Th.y).normalize();
  const Oh = respaldo.mundo(0, sup.v - 8, wMed + 6);
  const cabecera = crearCabeceraAlmohadon({
    alto: 184,
    banda: 15,
    doblePespunte: true,
    perforado: () => false,
    ancho: (u) => factorAjuste("cabecera", u),
    marco: { O: Oh, X: ejeX, T: Th, N: Nh },
  });
  raiz.add(mallasDeCuerpo(cabecera, "cabecera"));

  for (const x of [-66, 66]) {
    const abajo = respaldo.mundo(x, sup.v - 46, wMed);
    const arriba = Oh.clone().addScaledVector(ejeX, x).addScaledVector(Th, 34);
    raiz.add(varilla(abajo, arriba, 5.5, cromo));
  }

  // ---------- 4. Carcasa plástica inferior redondeada ----------
  raiz.add(carcasa);

  raiz.scale.setScalar(0.001);
  return raiz;
}
