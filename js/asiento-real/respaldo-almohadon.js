// Respaldo "almohadón" del Kia Soluto, modelado sobre el FC-20 del catálogo:
//  - panel central ancho (rectángulo de esquinas redondeadas) con la zona superior perforada (top)
//    y 4 canales abombados abajo (back; relieve del estado liso, otro patrón los reemplaza);
//  - laterales como almohadones gruesos y abombados que suben desde la costura del panel sin pared
//    interior, con una franja exterior y un canto redondeado que cae en vertical;
//  - hombros en arco continuo: el anillo de almohadones rodea el panel por arriba como una sola pieza;
//  - cara trasera convexa y paredes laterales abombadas.
// Marco local: x lateral, v a lo largo del respaldo (desde su base), w hacia el frente. Medidas en mm.
import * as THREE from "../vendor/three-0.186.1-extra.min.js";
import { curva } from "./superficie.js";
import { caida, crearAlmohadonCerrado, suave } from "./almohadon-cerrado.js?v=2";

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smin = (a, b, k = 6) => 0.5 * (a + b - Math.hypot(a - b, k));

export function crearRespaldoAlmohadon(opc = {}) {
  const P = {
    reclinacion: 10,
    base: [0, 236, -230],
    vTop: 587, // borde superior del contorno (centro)
    hwPanel: 141, // medio ancho del panel central
    v0: 34, // base del panel (oculta dentro del cojín; deja banda inferior amplia para redondear atrás)
    bandaSup: 32, // banda del arco de los hombros sobre el panel
    vC0: 92, // costura inferior del 4.º canal (justo sobre la línea del cojín)
    fraccionTop: 0.39, // alto de la zona perforada / alto visible del panel (FC-20)
    nCanales: 4,
    altoCanal: 6.5,
    vCosturas: 0, // pendiente en V de los canales (0 = horizontales; > 0 = chevrones en V hacia abajo)
    arcoCorte: 0, // curvatura central de la costura entre back y top (+ arco hacia arriba, - escudo en V)
    escalaX: null, // factor de ancho opcional del panel según v
    costurasHombro: false, // costuras diagonales en los hombros (FC-24 D-Max)
    dobleCosturaTop: false,
    pespuntesCanales: true,
    ribetePanel: false, // ribete curvo blanco sobre los almohadones laterales (FC-16 Hilux)
    perforado: null,
    franja: 16,
    Rt: 42,
    RtSup: 36,
    Rb: 48,
    bulto: 10,
    ancho: (u) => 1, // factor de ancho del contorno según la altura relativa u = v / vTop (calibración)
    ...opc,
  };
  const ang = THREE.MathUtils.degToRad(P.reclinacion);
  const O = new THREE.Vector3(...P.base);
  const X = new THREE.Vector3(1, 0, 0);
  const T = new THREE.Vector3(0, Math.cos(ang), -Math.sin(ang));
  const N = new THREE.Vector3(0, Math.sin(ang), Math.cos(ang));
  const L = 544;
  const comba = (v) => {
    const u = v / L;
    return 16 * u * u - 3 * u + 8 * Math.sin(Math.PI * Math.min(1, u));
  };

  const vTop = P.vTop;
  const v1 = vTop - P.bandaSup;
  const vS = v1 - P.fraccionTop * (v1 - P.vC0); // costura entre la zona superior y los canales
  const hCanal = (vS - P.vC0) / P.nCanales;
  const surcosCanal = Array.from({ length: P.nCanales }, (_, k) => P.vC0 + k * hCanal);
  const arcoEnS = (x) => P.arcoCorte * (1 - Math.min(1, (x / P.hwPanel) ** 2));

  // ---------- Contorno exterior (silueta frontal medida en el FC-20, sin oscilaciones en el hombro)
  // Arriba: medio ancho en función de s = √(distancia al borde superior) → hombros redondos y cima en arco continuo.
  const hombro = curva([
    [0, 104],
    [2.1, 128.6],
    [3.82, 148.8],
    [4.99, 160.2],
    [6.7, 175.6],
    [9.26, 194.2],
    [11.26, 209.4],
    [13.72, 226.2],
    [15.8, 241.5],
    [17.66, 248.5],
  ]);
  const ladoInf = curva([
    [0, 212],
    [130, 230],
    [200, 243],
    [vTop - 312, 248.5],
  ]);
  const hwOut = (v) => {
    const dy = vTop - v;
    const base = dy < 312 ? hombro(Math.sqrt(Math.max(0, dy))) : ladoInf(v);
    return base * P.ancho(v / vTop);
  };
  const contorno = [];
  {
    const rEsq = 42;
    const hw0 = hwOut(rEsq);
    const der = [];
    for (let v = rEsq; v < vTop - 312; v += 8) der.push([hwOut(v), v]);
    for (let k = 0; k <= 44; k++) {
      const s = Math.sqrt(312) * (1 - k / 44);
      const v = vTop - s * s;
      der.push([hwOut(v), v]);
    }
    const xTop = der[der.length - 1][0];
    contorno.push([-(hw0 - rEsq), 0], [hw0 - rEsq, 0]);
    for (let k = 1; k < 12; k++) {
      const a = -Math.PI / 2 + (k / 12) * (Math.PI / 2);
      contorno.push([hw0 - rEsq + rEsq * Math.cos(a), rEsq + rEsq * Math.sin(a)]);
    }
    for (const p of der) contorno.push(p);
    for (let k = 1; k < 16; k++) {
      const x = xTop * (1 - (2 * k) / 16);
      contorno.push([x, vTop + 3 * (1 - (x / xTop) ** 2)]);
    }
    for (let k = der.length - 1; k >= 0; k--) contorno.push([-der[k][0], der[k][1]]);
    for (let k = 1; k < 12; k++) {
      const a = Math.PI + (k / 12) * (Math.PI / 2);
      contorno.push([-(hw0 - rEsq) + rEsq * Math.cos(a), rEsq + rEsq * Math.sin(a)]);
    }
  }

  // ---------- Alturas
  const Dp = curva([
    [0, 86],
    [180, 84],
    [360, 77],
    [480, 70],
    [vTop, 62],
  ]);
  const lumbar = (v) => 10 * Math.exp(-(((v - 150) / 120) ** 2));
  const Alto = curva([
    [0, 26],
    [120, 34],
    [260, 37],
    [400, 32],
    [500, 23],
    [vTop, 15],
  ]);
  // En la base (v < 120) la cara trasera se recoge suavemente hacia adentro para unirse sin corte con el cojín
  const Db = curva([
    [0, 38],
    [70, 50],
    [150, 58],
    [320, 55],
    [vTop, 46],
  ]);
  const qc = 0.46;

  const frente = (x, v, c) => {
    const dp = c.dp;
    let w = Dp(v) + lumbar(v);
    let ao = 0.72 + 0.28 * suave(40, 130, v); // contacto con el cojín
    let ds;
    if (c.enPanel) {
      // Panel tenso con un ligero abombado desde las costuras; la zona superior se infla un poco más.
      // (caídas separables en x y v: sin crestas diagonales hacia las esquinas)
      const hwLocal = P.hwPanel * (P.escalaX ? P.escalaX(v) : 1);
      const ax = hwLocal - Math.abs(x);
      const vSC = vS + arcoEnS(x);
      const borde = suave(0, 2.5, -dp);
      const corona = 4.0 * suave(0, 60, ax) * suave(0, 50, v1 - v) * suave(0, 20, v - P.v0) * borde;
      const coronaTop = v > vSC ? 2.2 * suave(0, 36, ax) * suave(0, 30, v - vSC) * suave(0, 36, v1 - v) * borde : 0;
      const gS = Math.exp(-(((v - vSC) / 2.4) ** 2));
      w += corona + coronaTop - 3.0 * gS * suave(0, 4, -dp);
      ao *= 1 - 0.42 * gS;
      ds = Math.min(-dp, Math.abs(v - vSC));
    } else {
      // Almohadón lateral: sube redondeado desde la costura y baja con curvatura continua hacia el canto
      // (sin meseta plana ni cresta pellizcada al llegar al hombro o al cruzarse con el cojín).
      const q = c.q;
      const A = Alto(v) * suave(16, 62, c.T) * (0.75 + 0.25 * suave(15, 95, v));
      const prof = q < qc ? 1 - Math.pow(1 - q / qc, 2.0) : 1 - 0.30 * ((q - qc) / (1 - qc)) ** 2;
      const gF = Math.exp(-(((c.t - c.ts) / 2.1) ** 2));
      w += A * prof - 1.15 * gF;
      const RtBase = c.nv > 0 ? lerp(P.Rt, P.RtSup, suave(0.25, 0.9, c.nv)) : lerp(P.Rt, 28, suave(0.2, 0.85, -c.nv));
      const Rt = smin(RtBase, 0.88 * c.T, 6);
      w -= caida(c.d, Rt);
      ao *= 1 - 0.42 * gF;
      ao *= 0.8 + 0.2 * suave(0, Rt, c.d); // el canto se oscurece un poco al girar
      ds = Math.min(c.t, Math.abs(c.t - c.ts));
      if (P.costurasHombro && c.t < c.ts && v > vS - 24) {
        const dvH = v - (vS - 4 + 0.62 * c.t);
        const gH = Math.exp(-((dvH / 2.3) ** 2)) * suave(1, 5, c.t) * suave(c.ts, c.ts - 4, c.t);
        w -= 2.0 * gH;
        ao *= 1 - 0.38 * gH;
        ds = Math.min(ds, Math.abs(dvH));
      }
      if (P.ribetePanel && Math.abs(c.nx) > 0.7 && v >= 58 && v <= vS + 58) {
        const tR = 22 * Math.sin(Math.PI * clamp((v - 58) / (vS + 58 - 58), 0, 1));
        const gR = Math.exp(-(((c.t - tR) / 2.2) ** 2));
        w -= 1.4 * gR;
        ao *= 1 - 0.28 * gR;
      }
    }
    const gP = Math.exp(-((dp / 2.3) ** 2));
    w -= 2.6 * gP;
    ao *= 1 - 0.45 * gP;
    return { w, ao, ds };
  };

  const trasera = (x, v, c) => {
    // Cara trasera genuinamente convexa (domo suave en x y v) con bordes muy redondeados (Rb ~ 48 mm)
    const domoX = 24 * (1 - Math.min(1, (x / 242) ** 2));
    const domoV = 7 * Math.sin((Math.PI * clamp(v, 0, vTop)) / vTop);
    const caidaSuave = c.enPanel ? 0 : 10 * Math.pow(clamp(1 - c.d / Math.max(36, 0.85 * c.T), 0, 1), 2.2);
    let w = -(Db(v) + domoX + domoV - caidaSuave);
    const Rb = smin(P.Rb, 0.88 * c.T, 6);
    w += caida(c.d, Rb);
    return { w, ao: 0.72 + 0.16 * suave(50, 190, v) };
  };

  // Relieve del estado liso de la zona back: canales abombados (horizontales o en V) con surcos nítidos entre ellos.
  const relieveLiso = (zona, x, v, dp) => {
    if (zona !== "back") return { altura: 0, ao: 1 };
    let alt = 0;
    let ao = 1;
    const vEf = v - P.vCosturas * Math.abs(x);
    const vSC = vS + arcoEnS(x);
    const k = Math.floor((vEf - P.vC0) / hCanal);
    if (k >= 0 && k < P.nCanales && v < vSC - 1) {
      const f = (vEf - P.vC0 - k * hCanal) / hCanal;
      alt += P.altoCanal * (1 - Math.pow(2 * f - 1, 4));
    }
    for (const vc of surcosCanal) {
      const g = Math.exp(-(((vEf - vc) / 2.5) ** 2));
      alt -= 3.4 * g;
      ao = Math.min(ao, 1 - 0.55 * g);
    }
    const fade = suave(2, 12, -dp) * suave(vSC, vSC - 10, v);
    return { altura: alt * fade, ao: 1 - (1 - ao) * fade };
  };

  const grupos = [[vS, 5, 7]];
  if (P.vCosturas === 0) {
    for (const vc of surcosCanal) grupos.push([vc, 5, 7]);
  }

  const arcoSup = (x, v) =>
    (1 - Math.min(1, (x / P.hwPanel) ** 2)) *
    (6 * suave(vS, v1, v) + P.arcoCorte * suave(P.vC0 + 20, vS, v) * suave(v1 - 12, vS, v));
  const visible = (r) => r.v0 + r.nv * 4 > 56; // sin hilos ocultos dentro del cojín
  const tRibete = (r) => {
    if (Math.abs(r.nx) < 0.72 || r.v0 < 58 || r.v0 > vS + 58) return null;
    return 22 * Math.sin(Math.PI * clamp((r.v0 - 58) / (vS + 58 - 58), 0, 1));
  };
  const cuerpo = crearAlmohadonCerrado({
    marco: { O, X, T, N, comba },
    panel: { hw: P.hwPanel, v0: P.v0, v1, rcS: 28, rcI: 18, arco: arcoSup, escalaX: P.escalaX },
    contorno,
    franja: P.franja,
    paso: 5.2,
    grupos,
    NC: 56,
    NQ: 24,
    NQt: 14,
    nW: 8,
    bulto: P.bulto,
    aoPared: [0.84, 0.66],
    frente,
    trasera,
    zonaPanel: (x, v) => ({ zona: v < vS + arcoEnS(x) ? "back" : "top", sub: "" }),
    zonaAnillo: (esFranja) => ({ zona: "side", sub: esFranja ? "interior" : "" }),
    zonaPared: { zona: "side", sub: "interior" },
    zonaFondo: { zona: "side", sub: "interior" },
    relieve: new Set(["back"]),
    relieveLiso,
    perforado: P.perforado ?? ((zona, sub) => !sub && (zona === "back" || zona === "top")),
    pespuntes: (api) => {
      const out = [];
      // Doble pespunte del lado del almohadón a lo largo de la costura del panel
      for (const off of [3.2, 6.4]) out.push(...api.lineaAnillo(() => off, visible, "side", 3.8));
      // Pespunte de la franja exterior (sube por el lateral y cruza el arco de los hombros)
      out.push(...api.lineaAnillo((r) => r.ts - 2.6, visible, "side", 3.8));
      // Costura entre la zona superior y el primer canal
      out.push(api.lineaPanel((x) => vS + arcoEnS(x) - 3.2, 6, "back", 3.6, false));
      if (P.dobleCosturaTop) {
        out.push(api.lineaPanel((x) => vS + arcoEnS(x) + 3.0, 6, "top", 3.6, false));
      }
      // Pespuntes de los canales (solo con el panel liso)
      if (P.pespuntesCanales) {
        for (const vc of surcosCanal.slice(1)) {
          for (const dv of [-3.0, 3.0]) {
            out.push(api.lineaPanel((x) => vc + dv + P.vCosturas * Math.abs(x), 6, "back", 3.4, true, { soloLiso: true }));
          }
        }
        out.push(api.lineaPanel((x) => P.vC0 + 3.0 + P.vCosturas * Math.abs(x), 6, "back", 3.4, true, { soloLiso: true }));
      }
      // Costuras diagonales en los hombros (D-Max FC-24), ceñidas al anillo entre el panel y la franja
      if (P.costurasHombro) {
        for (const dv of [-2.6, 2.6]) {
          const tHombro = (r) => {
            if (Math.abs(r.nx) < 0.45) return null;
            const t = (r.v0 - (vS - 4 - dv)) / 0.62;
            return t >= 3.2 && t <= r.ts - 3.2 ? t : null;
          };
          out.push(...api.lineaAnillo(tHombro, visible, "side", 3.6));
        }
      }
      return out;
    },
    ribetes: (api) => (P.ribetePanel ? api.lineaAnillo(tRibete, visible, "side", 3.8).map((s) => s.linea) : []),
  });

  // Punto local del borde superior (para apoyar la cabecera y las varillas)
  let sup = cuerpo.borde[0];
  for (const b of cuerpo.borde) if (Math.abs(b.x) < 40 && b.v > sup.v) sup = b;
  cuerpo.marco = { O, X, T, N, comba };
  cuerpo.superior = { v: sup.v + P.bulto, wF: sup.wF, wB: sup.wB };
  cuerpo.vTop = vTop;
  return cuerpo;
}
