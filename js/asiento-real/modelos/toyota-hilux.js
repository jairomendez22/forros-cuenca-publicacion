// Asiento delantero del conductor del Toyota Hilux (2016 a hoy) — Versión 6 (almohadón FC-16):
// Calibrado con FC-16-toyota-hilux-negro-centro-perforado.jpg:
// - Cojín almohadón (cojin-almohadon.js) con centro perforado, costillas en V y ribete curvo blanco
//   sobre los almohadones laterales, más carcasa plástica redondeada a juego.
// - Respaldo almohadón (respaldo-almohadon.js): panel central con zona inferior perforada (back) y
//   5 costillas en V (chevrones hacia abajo), escudo superior liso (top) con costura en arco hacia abajo,
//   ribete blanco curvo sobre los almohadones laterales, hombros continuos sin pellizcos y trasera convexa.
// - Cabecera almohadón (cabecera-almohadon.js): cuero liso con costuras laterales de doble pespunte.
import * as THREE from "../../vendor/three-0.186.1-extra.min.js";
import { crearCojinAlmohadon, crearCarcasaAlmohadon } from "../cojin-almohadon.js?v=20";
import { crearRespaldoAlmohadon } from "../respaldo-almohadon.js?v=2";
import { crearCabeceraAlmohadon } from "../cabecera-almohadon.js?v=2";
import { mallasDeCuerpo, materialesBase, varilla } from "../piezas.js?v=7";
import { suave } from "../almohadon-cerrado.js?v=2";

export const INFO = {
  id: "toyota-hilux",
  nombre: "Toyota Hilux",
  generacion: "2016 a hoy",
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
  cojin: 0.985,
  respaldo: [0.95, 0.99, 0.995, 0.99, 1.0, 0.995],
  cabecera: [0.93, 0.94, 0.96, 0.98, 1.07],
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

  // ---------- 1. Cojín almohadón FC-16 (centro perforado, costillas en V y ribete curvo lateral) ----------
  const cojin = crearCojinAlmohadon({
    escala: factorAjuste("cojin", 0.5),
    vCosturas: 0, // costillas rectas: en V se veían dentadas
    ribetePanel: true,
    bolster: 36,
    bolsterFrente: 0.92,
    bolsterNariz: 0.14,
    RtNariz: 28,
    RbNariz: 32,
    nariz: 96,
    panel: { hb: 136, hf: 188, zb: -172, zf: 252, rc: 100 },
  });
  raiz.add(mallasDeCuerpo(cojin, "cojin"));
  const carcasa = crearCarcasaAlmohadon(plastico, cojin.medidas);

  // ---------- 2. Respaldo almohadón FC-16 (costillas en V en back perforado, escudo liso top, ribete curvo) ----------
  const respaldo = crearRespaldoAlmohadon({
    ancho: (u) => factorAjuste("respaldo", u),
    hwPanel: 135,
    fraccionTop: 0.35,
    vC0: 88,
    nCanales: 5,
    altoCanal: 6.2,
    vCosturas: 0.28,
    arcoCorte: -20,
    escalaX: (v) => 1 - 0.05 * suave(80, 380, v) + 0.08 * suave(360, 540, v),
    pespuntesCanales: false,
    ribetePanel: true,
    perforado: (zona, sub) => !sub && zona === "back",
  });
  raiz.add(mallasDeCuerpo(respaldo, "respaldo"));

  // ---------- 3. Cabecera almohadón FC-16 (lisa, doble pespunte lateral) ----------
  const ejeX = new THREE.Vector3(1, 0, 0);
  const sup = respaldo.superior;
  const wMed = 0.5 * (sup.wF + sup.wB);
  const Th = respaldo.marco.T.clone().applyAxisAngle(ejeX, THREE.MathUtils.degToRad(8)).normalize();
  const Nh = new THREE.Vector3(0, -Th.z, Th.y).normalize();
  const Oh = respaldo.mundo(0, sup.v - 8, wMed + 6);
  const cabecera = crearCabeceraAlmohadon({
    alto: 182,
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
