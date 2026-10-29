// Cojín "almohadón" modelado a partir del FC-20 del catálogo:
//  - panel central en trapecio con esquinas redondas, 3 canales abombados atrás y perforado al frente;
//  - almohadones laterales llenos (más altos atrás) que rodean el panel en "U" y se curvan alrededor
//    de las esquinas delanteras;
//  - franja delantera delgada y continua bajo el panel (nariz), con el borde inferior recto;
//  - pared lateral abombada que se enrolla por debajo (borde inferior redondo, sin aristas).
// Devuelve lo mismo que crearCuerpo (geometrías por zona, pespuntes, ribetes) para que el
// resto del sistema (colores, patrones, hilos) funcione igual. Medidas en mm.
// crearCarcasaAlmohadon arma la carcasa plástica a juego (costados, bandeja delantera con rebaje
// en trapecio, hueco oscuro bajo la bandeja y zócalo), siguiendo el contorno y el fondo del cojín.
import * as THREE from "../vendor/three-0.186.1-extra.min.js";

const { RoundedBoxGeometry } = THREE;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- geometría 2D (planta)

function insetPoligono(V, r) {
  const n = V.length;
  const lineas = [];
  for (let k = 0; k < n; k++) {
    const a = V[k];
    const b = V[(k + 1) % n];
    let dx = b[0] - a[0];
    let dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    dx /= len;
    dz /= len;
    const nx = dz;
    const nz = -dx; // normal hacia afuera (polígono antihorario en x, z)
    lineas.push({ px: a[0] - nx * r, pz: a[1] - nz * r, dx, dz, nx, nz });
  }
  const pts = [];
  for (let k = 0; k < n; k++) {
    const l1 = lineas[(k - 1 + n) % n];
    const l2 = lineas[k];
    const det = -l1.dx * l2.dz + l1.dz * l2.dx;
    const rx = l2.px - l1.px;
    const rz = l2.pz - l1.pz;
    const t = (rx * -l2.dz - rz * -l2.dx) / det;
    pts.push([l1.px + t * l1.dx, l1.pz + t * l1.dz]);
  }
  return { pts, lineas };
}

function sdfPoligono(x, z, pts, lineas) {
  const n = pts.length;
  let dmax = -1e9;
  let dseg = 1e9;
  for (let k = 0; k < n; k++) {
    const a = pts[k];
    const b = pts[(k + 1) % n];
    const l = lineas[k];
    const dk = (x - a[0]) * l.nx + (z - a[1]) * l.nz;
    if (dk > dmax) dmax = dk;
    const ex = b[0] - a[0];
    const ez = b[1] - a[1];
    const t = clamp(((x - a[0]) * ex + (z - a[1]) * ez) / (ex * ex + ez * ez), 0, 1);
    const dd = Math.hypot(x - (a[0] + t * ex), z - (a[1] + t * ez));
    if (dd < dseg) dseg = dd;
  }
  return dmax <= 0 ? dmax : dseg;
}

// Contorno de un polígono redondeado (offset r del polígono interior), muestreado cada `paso` mm.
function contornoRedondeado(pts, lineas, r, paso) {
  const out = [];
  const n = pts.length;
  for (let k = 0; k < n; k++) {
    const l = lineas[k];
    const a = pts[k];
    const b = pts[(k + 1) % n];
    const ax = a[0] + l.nx * r;
    const az = a[1] + l.nz * r;
    const bx = b[0] + l.nx * r;
    const bz = b[1] + l.nz * r;
    const largo = Math.hypot(bx - ax, bz - az);
    const m = Math.max(1, Math.round(largo / paso));
    for (let i = 0; i < m; i++) out.push([lerp(ax, bx, i / m), lerp(az, bz, i / m)]);
    // arco en el vértice b: de la normal de esta arista a la de la siguiente
    const l2 = lineas[(k + 1) % n];
    const a1 = Math.atan2(l.nz, l.nx);
    let a2 = Math.atan2(l2.nz, l2.nx);
    while (a2 < a1) a2 += Math.PI * 2;
    const arc = (a2 - a1) * r;
    const ma = Math.max(1, Math.round(arc / paso));
    for (let i = 0; i < ma; i++) {
      const ang = lerp(a1, a2, i / ma);
      out.push([b[0] + Math.cos(ang) * r, b[1] + Math.sin(ang) * r]);
    }
  }
  return out;
}

// ---------------------------------------------------------------- generador

export function crearCojinAlmohadon(opc = {}) {
  const P = {
    escala: 1,
    bwAtras: 137, bwFrente: 64, bwNariz: 34,
    expAncho: 1.7, // el almohadón conserva su ancho hasta la mitad y se angosta hacia el frente: planta con costados abombados
    bwTrasera: 103, // ancho detrás del panel (bajo el respaldo): el contorno trasero queda en z0
    esquinaAtras: 0.06, // ensancha las esquinas traseras en diagonal (hombros del cojín más cuadrados)
    z0: -275, z1: 252,
    yTopAtras: 318, yTopFrente: 338,
    yBase: 205, // fondo del cojín bajo los almohadones (los costados de plástico arrancan aquí)
    zFondoSube: 140, // desde aquí el fondo sube hasta la franja delantera
    Rt: 70, RtAtras: 42, Rb: 40, nariz: 92, // Rt grande a los lados: el almohadón se enrolla redondo desde la cresta;
    // atrás más cerrado para que los hombros traseros queden llenos
    RtNariz: 30, RbNariz: 30, // frente: rollo redondo arriba y abajo (el borde inferior se enrolla igual que el superior)
    bolster: 32, // alto del almohadón sobre el panel
    bolsterAtras: 1.6, bolsterFrente: 0.7, bajaAtras: 0.5, // mucho más lleno atrás; bajo al frente, donde se une a la franja
    bolsterNariz: 0.05, // la "U" cruza el frente con un rollo bajo
    cresta: 0.55, // fracción del ancho donde está la cresta del almohadón
    caidaFuera: 0.55, caidaFueraAtras: 0.38, // cuánto baja la cresta hacia el borde exterior (atrás menos: hombros llenos)
    corona: 8, franja: 34,
    costillas: [-112, -54, 4],
    ribAlto: 9, // canales abombados (domos) en el estado liso del panel
    vCosturas: 0, // pendiente de las costillas en V (0 = rectas)
    bulto: 6, // la pared lateral se abomba hacia afuera (punto más ancho en su parte alta: abajo se recoge)
    labio: 24, // franja plana del fondo antes del abanico central
    paso: 5.2,
    ...opc,
  };
  P.panel = { hb: 138, hf: 196, zb: -172, zf: 252, rc: 104, ...(opc.panel || {}) };
  const pan = P.panel;
  pan.hb *= P.escala; pan.hf *= P.escala; pan.rc *= P.escala;
  P.bwAtras *= P.escala; P.bwFrente *= P.escala; P.bwTrasera *= P.escala;
  const trap = [[-pan.hb, pan.zb], [pan.hb, pan.zb], [pan.hf, pan.zf], [-pan.hf, pan.zf]];
  const ins = insetPoligono(trap, pan.rc);
  const dpAt = (x, z) => sdfPoligono(x, z, ins.pts, ins.lineas) - pan.rc;

  // Contorno exterior en planta en forma de "U" ancha y continua (intersección redondeada de arcos
  // laterales, frontal y trasero): garantiza radio constante >= 115 mm en las esquinas delanteras,
  // sin cortes diagonales ni tramos rectos duros, y distancia euclidiana exacta (|∇d| = 1).
  const Wmax = 291.2 * P.escala;
  const Zfront = 293.5 * P.escala;
  const Zback = -271.5 * P.escala;
  const Rside = 2200 * P.escala;
  const Rfront = 1850 * P.escala;
  const Rback = 820 * P.escala;
  const Rf = 118 * P.escala;
  const RbExt = 104 * P.escala;
  function sdfExterior(x, z) {
    const ax = Math.abs(x);
    const dSide = Math.hypot(ax + (Rside - Wmax), z - 42 * P.escala) - Rside;
    const dFront = Math.hypot(ax, z + (Rfront - Zfront)) - Rfront;
    const dSF = Math.hypot(Math.max(dSide + Rf, 0), Math.max(dFront + Rf, 0)) + Math.min(Math.max(dSide + Rf, dFront + Rf), 0) - Rf;
    const dBack = Math.hypot(ax, z - (Zback + Rback)) - Rback;
    return Math.hypot(Math.max(dSF + RbExt, 0), Math.max(dBack + RbExt, 0)) + Math.min(Math.max(dSF + RbExt, dBack + RbExt), 0) - RbExt;
  }
  // Gradiente C-infinito del polígono interior: evita saltos de segunda derivada en el paso de recta a esquina redonda
  function gradSuave(x, z, e = 28 * P.escala) {
    let gx = 0, gz = 0;
    for (const l of ins.lineas) {
      const dk = (x - l.px) * l.nx + (z - l.pz) * l.nz;
      const h = Math.hypot(dk, e);
      const w = 0.25 * (dk + h) * (1 + dk / h);
      gx += w * l.nx;
      gz += w * l.nz;
    }
    const len = Math.hypot(gx, gz) || 1;
    return [gx / len, gz / len];
  }
  function nzAt(x, z) {
    return gradSuave(x, z)[1];
  }
  // Franja delantera: frente al tramo frontal del panel; las esquinas son del almohadón (la "U").
  const frenteDe = (nz, z) => smooth(0.72, 0.93, nz) * smooth(-30, 40, z);
  const frenteW = (x, z) => frenteDe(nzAt(x, z), z);
  function dBorde(x, z) {
    return Math.max(0, -sdfExterior(x, z));
  }

  const yCentro = (z) => lerp(P.yTopAtras, P.yTopFrente, clamp((z - P.z0) / (P.z1 - P.z0), 0, 1));
  const enFrente = (x, z) => frenteW(x, z) > 0.5;
  // transición amplia (alrededor de la esquina delantera) de almohadón lateral a franja delantera
  const tGDe = (nz, z) => smooth(0.12, 0.96, nz) * smooth(-30, 40, z);
  // La costura de la franja exterior corre paralela al contorno exterior a distancia constante P.franja,
  // como en el FC-20, sin subir en diagonal hacia el panel en la esquina delantera (evita aristas y cortes de UV).
  const franjaD = () => P.franja;
  const costillaZ = P.costillas;
  const smin = (a, b, k = 8) => 0.5 * (a + b - Math.hypot(a - b, k));

  // Fondo del cojín: bajo en los costados y atrás; sube de forma gradual hacia la franja delantera
  // para que el borde inferior del frente quede recto y la esquina no forme un escalón ni papada.
  function fondoCojin(x, z) {
    const kk = smooth(P.zFondoSube - 65, P.zFondoSube + 115, z);
    return P.yBase + (yCentro(z) - P.nariz - P.yBase) * kk;
  }

  // Altura de la superficie superior (sin las costillas del estado "liso") y del fondo.
  function evalCapas(x, z) {
    const dp = dpAt(x, z);
    const nz = nzAt(x, z);
    const d = dBorde(x, z);
    const bw = Math.max(24, dp + d);
    const ax = Math.abs(x);
    const y0 = yCentro(z);
    const fw = frenteDe(nz, z);
    const bwLocal = bw;
    const q = clamp(dp / bwLocal, 0, 1);
    // Almohadón: más alto atrás, lleno en las esquinas delanteras y una "U" baja que cruza el frente.
    const zt = clamp((z - pan.zb) / (pan.zf - pan.zb), 0, 1);
    let alto = P.bolster * lerp(P.bolsterAtras, P.bolsterFrente, smooth(0.15, 1.0, zt));
    // la cresta baja de a poco alrededor de la esquina delantera hasta la franja (la "U" sin nudos);
    // los redondeos usan la misma transición amplia para que la esquina no tenga quiebres
    const tG = tGDe(nz, z);
    alto = lerp(alto, P.bolster * P.bolsterNariz, tG);
    // detrás del panel (bajo el respaldo) el almohadón se apaga de forma muy gradual hacia el centro
    alto *= 1 - (1 - smooth(0.35 * pan.hb, 0.96 * pan.hb, ax)) * smooth(pan.zb + 10, pan.zb - 85, z);
    // y su extremo trasero baja y se mete bajo el respaldo: el hombro queda redondo, sin punta
    alto *= 1 - P.bajaAtras * smooth(P.z0 + 95, P.z0, z);
    // perfil de almohada (domo sin meseta ni punta): parábola que sube desde la costura hasta la cresta y
    // baja suave hacia afuera, donde el borde (Rt) lo enrolla
    const caida = lerp(P.caidaFueraAtras, P.caidaFuera, smooth(0.05, 0.6, zt));
    const forma = q < P.cresta ? 1 - Math.pow(1 - q / P.cresta, 2) : 1 - caida * Math.pow((q - P.cresta) / (1 - P.cresta), 2);
    const almohadon = alto * forma;
    const corona = dp < 0 ? P.corona * smooth(0, 120, -dp) : 0; // el panel es ligeramente abombado
    const surcoPanel = 3.0 * Math.exp(-Math.pow(dp / 2.6, 2));
    const franjaMask = (1 - smooth(0.42, 0.86, nz)) * smooth(6, 16, dp);
    const fD = P.franja;
    const surcoFranja = 0.65 * Math.exp(-Math.pow((d - fD) / 2.4, 2)) * franjaMask;
    const yT0 = y0 + almohadon + corona - surcoPanel - surcoFranja;

    const yB0 = fondoCojin(x, z);
    const th = Math.max(8, yT0 - yB0);
    // El radio lateral se recoge gradualmente al acercarse al frente para igualar el radio de la nariz:
    // así el ecuador del borde (yT0 - Rt) no da un salto vertical en la esquina delantera.
    const RtLado = lerp(P.RtAtras, P.Rt, smooth(pan.zb - 40, pan.zb + 140, z)) * lerp(1, 0.62, smooth(50, 245, z));
    const abre = smooth(50, 200, ax);
    const RtFrente = lerp(P.RtNariz + 4, 42, abre), RbFrente = lerp(P.RbNariz + 2, 36, abre);
    const Rt = smin(lerp(RtLado, RtFrente, tG), 0.52 * (th - 4), 8);
    const Rb = smin(lerp(P.Rb, RbFrente, tG), 0.34 * (th - 4), 8);
    const caeT = d < Rt ? Rt - Math.sqrt(Math.max(0, Rt * Rt - (Rt - d) * (Rt - d))) : 0;
    return { yT: yT0 - caeT, yB: yB0, dp, d, th, Rt, Rb, yT0, yB0, surcoPanel, surcoFranja, fD, fw, tG };
  }
  const yTop = (x, z) => evalCapas(x, z).yT;
  const gradTop = (x, z) => {
    const e = 0.7;
    const gx = (yTop(x + e, z) - yTop(x - e, z)) / (2 * e);
    const gz = (yTop(x, z + e) - yTop(x, z - e)) / (2 * e);
    const l = Math.hypot(gx, 1, gz);
    return new THREE.Vector3(-gx / l, 1 / l, -gz / l);
  };

  // Costillas (estado liso del panel): canales abombados (domos llenos) con surcos entre ellos.
  function costilla(x, z, dp) {
    if (dp > 0) return { alt: 0, ao: 1 };
    const zs = [pan.zb, ...costillaZ];
    let alt = 0;
    let ao = 1;
    const zE = z - P.vCosturas * Math.abs(x); // con costillas en V, los surcos siguen z - v·|x| = const
    for (let k = 1; k < zs.length; k++) {
      const a = zs[k - 1];
      const b = zs[k];
      if (zE >= a && zE <= b) {
        const f = (zE - a) / (b - a);
        alt += P.ribAlto * Math.sin(Math.PI * f); // domo redondo: brillo amplio en el borde, sin aletas
      }
    }
    for (const zr of costillaZ) {
      const g = Math.exp(-Math.pow((zE - zr) / 1.7, 2));
      alt -= 0.9 * g;
      ao = Math.min(ao, 1 - 0.6 * g);
    }
    const fade = smooth(2, 12, -dp);
    return { alt: alt * fade, ao: 1 - (1 - ao) * fade };
  }

  // ---------------------------------------------------------- malla
  const pool = { x: [], y: [], z: [], ao: [], masc: [], alt: [], aol: [], u: [], v: [] };
  const addV = (x, y, z, ao, masc, alt, aol, u, v) => {
    pool.x.push(x); pool.y.push(y); pool.z.push(z);
    pool.ao.push(ao); pool.masc.push(masc); pool.alt.push(alt); pool.aol.push(aol);
    pool.u.push(u ?? x); pool.v.push(v ?? z - pan.zb);
    return pool.x.length - 1;
  };
  const tris = []; // { a, b, c, zona, sub, tipo, grupo }

  const distSeam = (x, z, c) => {
    let m = Math.abs(c.dp);
    if (c.dp > 6) m = Math.min(m, Math.abs(c.d - c.fD));
    if (c.dp < 0) for (const zr of costillaZ) m = Math.min(m, Math.abs(z - P.vCosturas * Math.abs(x) - zr));
    return m;
  };
  const aoDe = (x, z, c) => {
    let ao = 1;
    ao *= 1 - 0.55 * Math.exp(-Math.pow(c.dp / 2.6, 2)) * 0.45;
    ao *= 1 - 0.1 * Math.exp(-Math.pow((c.dp - 12) / 9, 2)) * smooth(-0.1, 0.1, c.dp);
    ao *= 1 - 0.32 * Math.exp(-Math.pow((c.d - c.fD) / 2.4, 2)) * (1 - 0.65 * c.fw) * smooth(6, 16, c.dp) * 0.7;
    ao *= 0.62 + 0.38 * smooth(P.z0, P.z0 + 90, z); // bajo el respaldo
    ao *= 0.8 + 0.2 * smooth(0, 38, c.d); // borde redondeado un poco más oscuro
    return clamp(ao, 0.2, 1);
  };

  const agregarSuperior = (x, z, u, v) => {
    const c = evalCapas(x, z);
    const rb = costilla(x, z, c.dp);
    return addV(x, c.yT, z, aoDe(x, z, c), smooth(1.8, 7.5, distSeam(x, z, c)), c.dp < 0 ? rb.alt : 0, c.dp < 0 ? rb.ao : 1, u, v);
  };

  // --- 1) Parche del panel: tensor (columnas × filas) con el contorno del panel como borde
  // Filas monótonas y suaves sin superposición de bucles (evita franjas alternadas de 0.3 mm y 5 mm en la esquina)
  const zbP = pan.zb;
  const zfP = pan.zf;
  const zs = new Set();
  const paso = P.paso;
  const nEsq = Math.round((pan.rc * Math.PI) / (2 * paso));
  const zA = zbP + pan.rc, zB = zfP - pan.rc;
  for (let k = 0; k <= nEsq; k++) {
    const t = k / nEsq;
    zs.add(Math.round((zfP - pan.rc * (1 - Math.cos((t * Math.PI) / 2))) * 100) / 100);
    zs.add(Math.round((zbP + pan.rc * (1 - Math.cos((t * Math.PI) / 2))) * 100) / 100);
  }
  const grupo = (c, n, ancho) => {
    for (let k = -n; k <= n; k++) zs.add(Math.round((c + (k * ancho) / n) * 100) / 100);
  };
  for (const zr of costillaZ) grupo(zr, 6, 9); // filas densas en los surcos: domos redondos sin facetas
  const nMid = Math.max(2, Math.round((zB - zA) / paso));
  for (let k = 1; k < nMid; k++) {
    const z = zA + ((zB - zA) * k) / nMid;
    if (costillaZ.every((zr) => Math.abs(z - zr) > 9 + 0.55 * paso)) {
      zs.add(Math.round(z * 100) / 100);
    }
  }
  zs.add(zbP);
  zs.add(zfP);
  const zRows = [...zs].filter((z) => z >= zbP && z <= zfP).sort((a, b) => a - b);
  const NR = zRows.length;
  const NC = 58;
  const sCol = [];
  for (let i = 0; i < NC; i++) {
    const u = i / (NC - 1);
    const lin = 2 * u - 1;
    const cl = Math.sin((Math.PI / 2) * lin);
    sCol.push(0.75 * lin + 0.25 * cl);
  }
  const hwRow = (z0) => {
    let lo = 0;
    let hi = pan.hf + 10;
    for (let it = 0; it < 28; it++) {
      const mid = 0.5 * (lo + hi);
      if (dpAt(mid, z0) <= 1e-7) lo = mid;
      else hi = mid;
    }
    return lo;
  };
  const idxPanel = [];
  for (let j = 0; j < NR; j++) {
    const z0 = zRows[j];
    const hw = hwRow(z0);
    const fila = [];
    for (let i = 0; i < NC; i++) {
      const x = sCol[i] * hw;
      fila.push(agregarSuperior(x, z0));
    }
    idxPanel.push(fila);
  }
  for (let j = 0; j < NR - 1; j++) {
    for (let i = 0; i < NC - 1; i++) {
      const a = idxPanel[j][i];
      const b = idxPanel[j][i + 1];
      const c = idxPanel[j + 1][i + 1];
      const d = idxPanel[j + 1][i];
      tris.push({ a, b, c, tipo: "top", grupo: 0 }, { a, b: c, c: d, tipo: "top", grupo: 0 });
    }
  }

  // --- 2) Anillo de almohadones: del borde del panel al contorno exterior
  const lazo = []; // índices del borde del panel, recorrido antihorario visto desde arriba
  for (let j = 0; j < NR; j++) lazo.push(idxPanel[j][NC - 1]); // lado derecho, de atrás hacia adelante
  for (let i = NC - 2; i >= 0; i--) lazo.push(idxPanel[NR - 1][i]); // frente, de derecha a izquierda
  for (let j = NR - 2; j >= 0; j--) lazo.push(idxPanel[j][0]); // lado izquierdo, hacia atrás
  for (let i = 1; i < NC - 1; i++) lazo.push(idxPanel[0][i]); // atrás, de izquierda a derecha
  const NL = lazo.length;
  // Direcciones radiales C-infinitas y suavizadas a lo largo del lazo para que los rayos se abran sin saltos
  let rayos = lazo.map((iv) => gradSuave(pool.x[iv], pool.z[iv], 24 * P.escala));
  for (let p = 0; p < 10; p++) {
    rayos = rayos.map((r, k) => {
      const ra = rayos[(k - 1 + NL) % NL], rb = rayos[(k + 1) % NL];
      const nx = ra[0] + 2 * r[0] + rb[0], nz = ra[1] + 2 * r[1] + rb[1];
      const l = Math.hypot(nx, nz) || 1;
      return [nx / l, nz / l];
    });
  }
  const NQ = 24;
  const gq = (q) => q - (0.56 * Math.sin(2 * Math.PI * q)) / (2 * Math.PI);
  // Muestreo cuadrático junto al borde exterior (d -> 0) para que la caída circular caeT tenga pasos verticales uniformes
  const gqOuter = (u) => Math.sin((Math.PI / 2) * Math.pow(clamp(u, 0, 1), 0.78));
  const anillo = [];
  const NA = Math.round(NQ * 0.62);
  const frenteK = [];
  const tsK = [];
  const vFin = [];
  const pCresta = [];
  for (let kk = 0; kk < NL; kk++) {
    const iv = lazo[kk];
    const x = pool.x[iv];
    const z = pool.z[iv];
    const [nx, nz] = rayos[kk];
    // distancia hasta el contorno exterior por bisección
    let lo = 0;
    let hi = 500;
    for (let it = 0; it < 30; it++) {
      const mid = 0.5 * (lo + hi);
      if (dBorde(x + nx * mid, z + nz * mid) > 1e-6) lo = mid;
      else hi = mid;
    }
    const T = lo;
    const xm = x + nx * (0.52 * T), zm = z + nz * (0.52 * T);
    pCresta.push([xm, evalCapas(xm, zm).yT, zm]);
    // m = 0 tiene su propio vértice con v = 0 para que las UV del anillo sean continuas desde la costura
    const fila = [agregarSuperior(x, z, 0, 0)];
    let vAcum = 0;
    let prev = [x, pool.y[iv], z];
    // Costura de la franja paralela al borde exterior con transición suave (sin quiebres en la esquina)
    const aTs = T - P.franja, bTs = 0.48 * T;
    const ts = 0.5 * (aTs + bTs + Math.hypot(aTs - bTs, 6));
    frenteK.push(frenteW(x, z) > 0.5);
    tsK.push(ts);
    for (let m = 1; m <= NQ; m++) {
      const t = m <= NA ? ts * gq(m / NA) : ts + (T - ts) * gqOuter((m - NA) / (NQ - NA));
      const xx = x + nx * t;
      const zz = z + nz * t;
      const cc = evalCapas(xx, zz);
      vAcum += Math.hypot(xx - prev[0], cc.yT - prev[1], zz - prev[2]);
      prev = [xx, cc.yT, zz];
      fila.push(agregarSuperior(xx, zz, 0, vAcum));
    }
    vFin.push(vAcum);
    anillo.push(fila);
  }
  // Longitud de arco longitudinal medida sobre la línea media del almohadón (0.52·T):
  // hace que la escala UV (u, v) sea isométrica, independiente de ts y continua entre `edge` y `front`.
  const sLazo = [0];
  for (let k = 1; k < NL; k++) {
    const A = pCresta[k - 1], B = pCresta[k];
    sLazo.push(sLazo[k - 1] + Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]));
  }
  for (let k = 0; k < NL; k++) {
    for (const idxV of anillo[k]) pool.u[idxV] = sLazo[k];
  }
  // zona de cada franja del anillo (entre la columna k y la k+1), evaluada en su punto medio: borde simétrico
  const frenteTramo = [];
  for (let k = 0; k < NL; k++) {
    const a = lazo[k], b = lazo[(k + 1) % NL];
    frenteTramo.push(frenteW(0.5 * (pool.x[a] + pool.x[b]), 0.5 * (pool.z[a] + pool.z[b])) > 0.5);
  }
  for (let k = 0; k < NL; k++) {
    const A = anillo[k];
    const B = anillo[(k + 1) % NL];
    const frente = frenteTramo[k];
    for (let m = 0; m < NQ; m++) {
      const cl = frente ? { zona: "front", sub: "interior" } : { zona: "edge", sub: m < NA ? "" : "interior" };
      tris.push({ a: A[m], b: B[m], c: B[m + 1], tipo: "top", cl, grupo: 3 }, { a: A[m], b: B[m + 1], c: A[m + 1], tipo: "top", cl, grupo: 3 });
    }
  }

  // --- 3) Pared lateral abombada, borde inferior redondo que se enrolla por debajo y fondo
  const borde = anillo.map((f) => f[NQ]);
  const NB = borde.length;
  const gradD = (x, z) => {
    const e = 0.6;
    const gx = dBorde(x + e, z) - dBorde(x - e, z);
    const gz = dBorde(x, z + e) - dBorde(x, z - e);
    const l = Math.hypot(gx, gz) || 1;
    return [-gx / l, -gz / l];
  };
  const nW = 6; // filas de la pared
  const nRb = 6; // filas del redondeo inferior
  const contorno = []; // contorno exterior con su normal hacia afuera (para la carcasa)
  const pared = [];
  for (let k = 0; k < NB; k++) {
    const iv = borde[k];
    const x = pool.x[iv];
    const z = pool.z[iv];
    let [ox, oz] = gradD(x, z);
    if (Math.abs(ox) + Math.abs(oz) < 0.2) { ox = x; oz = z; const l = Math.hypot(ox, oz) || 1; ox /= l; oz /= l; }
    contorno.push({ x, z, ox, oz });
    const c = evalCapas(x, z);
    const yArriba = pool.y[iv];
    const hBajo = Math.max(12, yArriba - c.yB0);
    const Rb = smin(c.Rb, 0.85 * hBajo, 6);
    const fila = [iv];
    let v = vFin[k];
    let prev = [x, yArriba, z];
    const empujar = (px, py, pz, ao) => {
      v += Math.hypot(px - prev[0], py - prev[1], pz - prev[2]);
      prev = [px, py, pz];
      fila.push(addV(px, py, pz, ao, 0, 0, 1, sLazo[k], v));
    };
    // Arco inferior único y 100 % convexo desde el ecuador (yArriba, tangente vertical) hasta el fondo (yB0, tangente horizontal):
    // elimina por completo la cintura cóncava y el doble reflejo bajo la esquina delantera.
    const nRoll = nW + nRb;
    for (let s = 1; s <= nRoll; s++) {
      const phi = ((s / nRoll) * Math.PI) / 2;
      const off = Rb * (1 - Math.cos(phi));
      const py = yArriba - hBajo * Math.sin(phi);
      empujar(x - ox * off, py, z - oz * off, lerp(0.86, 0.42, s / nRoll));
    }
    const offL = Rb + P.labio;
    empujar(x - ox * offL, c.yB0, z - oz * offL, 0.4);
    pared.push(fila);
  }
  const NP = pared[0].length;
  for (let k = 0; k < NB; k++) {
    const A = pared[k];
    const B = pared[(k + 1) % NB];
    const front = frenteTramo[k];
    for (let s = 0; s < NP - 1; s++) {
      tris.push({ a: A[s], b: B[s], c: B[s + 1], tipo: "pared", front, grupo: 1 }, { a: A[s], b: B[s + 1], c: A[s + 1], tipo: "pared", front, grupo: 1 });
    }
  }
  // fondo: abanico desde el centro, un poco más bajo que el labio (queda dentro de la carcasa)
  {
    let cx = 0, cz = 0, ymin = 1e9;
    for (let k = 0; k < NB; k++) {
      const v = pared[k][NP - 1];
      cx += pool.x[v]; cz += pool.z[v]; ymin = Math.min(ymin, pool.y[v]);
    }
    cx /= NB; cz /= NB;
    const centro = addV(cx, ymin - 4, cz, 0.4, 0, 0, 1);
    for (let k = 0; k < NB; k++) {
      tris.push({ a: centro, b: pared[k][NP - 1], c: pared[(k + 1) % NB][NP - 1], tipo: "fondo", front: false, grupo: 2 });
    }
  }

  // --- 4) Orientación por grupo (arriba, afuera, abajo) y normales suaves (analíticas en la cara superior)
  const nV = pool.x.length;
  const P3 = (i) => [pool.x[i], pool.y[i], pool.z[i]];
  const normalTri = (t) => {
    const A = P3(t.a), B = P3(t.b), C = P3(t.c);
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
    const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx, (A[0] + B[0] + C[0]) / 3, (A[2] + B[2] + C[2]) / 3];
  };
  const zcCentro = 0.5 * (P.z0 + 276);
  const votos = [0, 0, 0, 0]; // 0 panel, 1 pared, 2 fondo, 3 anillo (cada grupo tiene un sentido de giro uniforme)
  for (const t of tris) {
    const [nx, ny, nz, mx, mz] = normalTri(t);
    if (t.grupo === 0 || t.grupo === 3) votos[t.grupo] += Math.sign(ny);
    else if (t.grupo === 1) votos[1] += Math.sign(nx * mx + nz * (mz - zcCentro));
    else votos[2] += Math.sign(-ny);
  }
  for (const t of tris) {
    if (votos[t.grupo] < 0) { const tmp = t.b; t.b = t.c; t.c = tmp; }
  }
  const normal = new Float32Array(nV * 3);
  for (const t of tris) {
    const [nx, ny, nz] = normalTri(t);
    for (const i of [t.a, t.b, t.c]) {
      normal[i * 3] += nx;
      normal[i * 3 + 1] += ny;
      normal[i * 3 + 2] += nz;
    }
  }
  for (let i = 0; i < nV; i++) {
    const l = Math.hypot(normal[i * 3], normal[i * 3 + 1], normal[i * 3 + 2]) || 1;
    normal[i * 3] /= l; normal[i * 3 + 1] /= l; normal[i * 3 + 2] /= l;
  }
  // En la superficie superior (panel y corona del almohadón) usamos la normal analítica exacta gradTop(x, z),
  // fundida suavemente hacia el borde vertical (d -> 0): elimina por completo las bandas por triangulación.
  const nTopMax = pared[0][0];
  for (let i = 0; i <= nTopMax; i++) {
    const x = pool.x[i], z = pool.z[i];
    if (dpAt(x, z) < -16) continue;
    const d = dBorde(x, z);
    const w = smooth(4, 22, d);
    if (w > 0) {
      const g = gradTop(x, z);
      const nx = lerp(normal[i * 3], g.x, w);
      const ny = lerp(normal[i * 3 + 1], g.y, w);
      const nz = lerp(normal[i * 3 + 2], g.z, w);
      const l = Math.hypot(nx, ny, nz) || 1;
      normal[i * 3] = nx / l; normal[i * 3 + 1] = ny / l; normal[i * 3 + 2] = nz / l;
    }
  }

  // --- 5) Piezas por zona
  const clasificar = (t) => {
    if (t.cl) return t.cl;
    if (t.tipo === "top") {
      const x = (pool.x[t.a] + pool.x[t.b] + pool.x[t.c]) / 3;
      const z = (pool.z[t.a] + pool.z[t.b] + pool.z[t.c]) / 3;
      const dp = dpAt(x, z);
      if (dp < -0.6) return { zona: "base", sub: "" };
      if (enFrente(x, z)) return { zona: "front", sub: "interior" };
      const d = dBorde(x, z);
      return { zona: "edge", sub: d > franjaD(x, z) ? "" : "interior" };
    }
    return { zona: t.front ? "front" : "edge", sub: "interior" };
  };
  const piezas = new Map();
  for (const t of tris) {
    const cl = clasificar(t);
    const clave = cl.sub ? `${cl.zona}|${cl.sub}` : cl.zona;
    if (!piezas.has(clave)) piezas.set(clave, { ...cl, tris: [] });
    piezas.get(clave).tris.push(t);
  }
  const geometrias = new Map();
  for (const [clave, pz] of piezas) {
    const mapa = new Map();
    const Pp = [], Nn = [], U = [], Cc = [], ao = [], xm = [], ym = [], masc = [], altL = [], aoL = [];
    const idx = [];
    const esBase = pz.zona === "base" && !pz.sub;
    const vert = (g) => {
      let k = mapa.get(g);
      if (k !== undefined) return k;
      k = Pp.length / 3;
      mapa.set(g, k);
      Pp.push(pool.x[g], pool.y[g], pool.z[g]);
      Nn.push(normal[g * 3], normal[g * 3 + 1], normal[g * 3 + 2]);
      U.push(pool.u[g] / 100, pool.v[g] / 100);
      Cc.push(pool.ao[g], pool.ao[g], pool.ao[g]);
      ao.push(pool.ao[g]);
      xm.push(pool.u[g]);
      ym.push(pool.v[g]);
      masc.push(pz.sub !== "interior" ? pool.masc[g] : 0); // el forro interior no recibe el relieve del patrón
      altL.push(esBase ? pool.alt[g] : 0);
      aoL.push(esBase ? pool.aol[g] : 1);
      return k;
    };
    for (const t of pz.tris) idx.push(vert(t.a), vert(t.b), vert(t.c));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(Pp, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(Nn, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(Cc, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    g.userData.zona = pz.zona;
    g.userData.subZona = pz.sub;
    g.userData.perforadoDeFabrica = esBase && (P.perforado ?? true);
    g.userData.patronAplicado = esBase ? "" : "liso";
    g.userData.base3D = {
      posBase: new Float32Array(Pp),
      normBase: new Float32Array(Nn),
      aoBase: new Float32Array(ao),
      xm: new Float32Array(xm),
      ym: new Float32Array(ym),
      mascara: new Float32Array(masc),
      tieneRelieveLiso: esBase,
      altLiso: new Float32Array(altL),
      aoLiso: new Float32Array(aoL),
    };
    geometrias.set(clave, g);
  }

  // Medidas del contorno final (para construir la carcasa a juego)
  let xMax = 0, zMin = 1e9, zMax = -1e9;
  for (const p of contorno) { xMax = Math.max(xMax, Math.abs(p.x)); zMin = Math.min(zMin, p.z); zMax = Math.max(zMax, p.z); }
  const medidasRim = {
    W: xMax, zc: (zMin + zMax) / 2, L: (zMax - zMin) / 2, yBase: P.yBase, hf: pan.hf, zf: pan.zf, nariz: P.nariz, yTopFrente: P.yTopFrente,
    contorno, // puntos del contorno exterior con su normal hacia afuera
    fondo: fondoCojin, // altura del fondo del cojín en (x, z)
  };

  // ---------------------------------------------------------- pespuntes y ribetes
  const sobre = (x, z, extraY = 0) => {
    const n = gradTop(x, z);
    const c = evalCapas(x, z);
    const rb = costilla(x, z, c.dp).alt;
    const y = c.yT + (c.dp < 0 ? rb : 0) + extraY;
    return { p: new THREE.Vector3(x, y, z), n };
  };
  const pespuntes = [];
  const ribetes = [];

  // Doble pespunte en el borde del panel, del lado del almohadón
  for (const off of [3.4, 6.8]) {
    const cont = contornoRedondeado(ins.pts, ins.lineas, pan.rc + off, 3.6);
    const linea = [];
    for (const [x, z] of cont) {
      if (z > pan.zb + 10) linea.push(sobre(x, z));
    }
    if (linea.length > 2) {
      pespuntes.push({ zona: "edge", linea, puntada: 3.8 });
    }
  }
  // Pespuntes de las costillas (solo cuando el panel está liso)
  for (const zr of costillaZ) {
    for (const dz of [-3.1, 3.1]) {
      const linea = [];
      const hMax = pan.hf - 6;
      for (let i = 0; i <= 90; i++) {
        const x = lerp(-hMax, hMax, i / 90);
        const z = zr + dz + P.vCosturas * Math.abs(x);
        if (z < pan.zb + 4 || z > pan.zf - 4 || dpAt(x, z) > -9) {
          if (linea.length > 2) pespuntes.push({ zona: "base", linea: linea.splice(0), puntada: 3.4, soloLiso: true });
          else linea.length = 0;
          continue;
        }
        linea.push(sobre(x, z));
      }
      if (linea.length > 2) pespuntes.push({ zona: "base", linea, puntada: 3.4, soloLiso: true });
    }
  }
  // Franja del almohadón: costura lateral que se curva con suavidad en la esquina para fundirse con el pespunte del panel
  {
    let linea = [];
    const cerrar = () => {
      if (linea.length > 2) pespuntes.push({ zona: "edge", linea, puntada: 3.8 });
      linea = [];
    };
    for (let k = 0; k < lazo.length; k++) {
      const fila = anillo[k];
      const x0 = pool.x[fila[0]], z0 = pool.z[fila[0]];
      const xe = pool.x[fila[NQ]], ze = pool.z[fila[NQ]];
      const T = Math.hypot(xe - x0, ze - z0);
      const c = smooth(0.36, 0.86, nzAt(x0, z0)) * smooth(-20, 40, z0);
      const tt = lerp(tsK[k] - 2.6, 6.8, c);
      if (c < 0.99 && tt > 6 && z0 > pan.zb + 6) {
        const f = tt / T;
        linea.push(sobre(lerp(x0, xe, f), lerp(z0, ze, f)));
      } else cerrar();
    }
    cerrar();
  }
  // Ribete lateral curvo opcional sobre los almohadones del cojín (FC-16 Hilux)
  if (P.ribetePanel) {
    const zIniR = pan.zb + 24, zFinR = pan.zf - 46;
    let linea = [];
    const cerrarR = () => {
      if (linea.length > 2) ribetes.push(linea);
      linea = [];
    };
    for (let k = 0; k < lazo.length; k++) {
      const fila = anillo[k];
      const x0 = pool.x[fila[0]], z0 = pool.z[fila[0]];
      const xe = pool.x[fila[NQ]], ze = pool.z[fila[NQ]];
      const T = Math.hypot(xe - x0, ze - z0) || 1;
      if (z0 >= zIniR && z0 <= zFinR && Math.abs(x0) > 95) {
        const u = clamp((z0 - zIniR) / (zFinR - zIniR), 0, 1);
        const f = (22 * Math.sin(Math.PI * u)) / T;
        linea.push(sobre(lerp(x0, xe, f), lerp(z0, ze, f), 0.4));
      } else cerrarR();
    }
    cerrarR();
  }

  return {
    geometrias, pespuntes, ribetes,
    // utilidades para construir la carcasa a juego
    medidas: medidasRim,
    capas: evalCapas,
    dBorde,
  };
}

// ---------------------------------------------------------------- carcasa plástica a juego

// Polígono con esquinas redondeadas (filete circular de radio r[k] en cada vértice), muestreado cada `paso` mm.
function poligonoRedondeado(V, radios, paso = 3) {
  const n = V.length;
  const out = [];
  for (let k = 0; k < n; k++) {
    const P0 = V[(k - 1 + n) % n], P1 = V[k], P2 = V[(k + 1) % n];
    let u1x = P0[0] - P1[0], u1y = P0[1] - P1[1];
    let u2x = P2[0] - P1[0], u2y = P2[1] - P1[1];
    const l1 = Math.hypot(u1x, u1y), l2 = Math.hypot(u2x, u2y);
    u1x /= l1; u1y /= l1; u2x /= l2; u2y /= l2;
    const cosT = clamp(u1x * u2x + u1y * u2y, -0.9999, 0.9999);
    const th = Math.acos(cosT);
    const r = Math.min(typeof radios === "number" ? radios : radios[k], 0.49 * Math.min(l1, l2) * Math.tan(th / 2));
    const t = r / Math.tan(th / 2);
    const bx = u1x + u2x, by = u1y + u2y;
    const bl = Math.hypot(bx, by) || 1;
    const dC = r / Math.sin(th / 2);
    const cx = P1[0] + (bx / bl) * dC, cy = P1[1] + (by / bl) * dC;
    const a1x = P1[0] + u1x * t, a1y = P1[1] + u1y * t;
    const a2x = P1[0] + u2x * t, a2y = P1[1] + u2y * t;
    let ang1 = Math.atan2(a1y - cy, a1x - cx);
    let ang2 = Math.atan2(a2y - cy, a2x - cx);
    let dA = ang2 - ang1;
    while (dA > Math.PI) dA -= 2 * Math.PI;
    while (dA < -Math.PI) dA += 2 * Math.PI;
    const m = Math.max(2, Math.ceil((Math.abs(dA) * r) / paso));
    for (let i = 0; i <= m; i++) {
      const a = ang1 + (dA * i) / m;
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    // tramo recto hasta el siguiente filete (se muestrea para que el abombado de la tapa sea suave)
    const Q = V[(k + 1) % n];
    const Q0 = V[(k + 2) % n];
    let w1x = P1[0] - Q[0], w1y = P1[1] - Q[1];
    let w2x = Q0[0] - Q[0], w2y = Q0[1] - Q[1];
    const m1 = Math.hypot(w1x, w1y), m2 = Math.hypot(w2x, w2y);
    w1x /= m1; w1y /= m1; w2x /= m2; w2y /= m2;
    const thQ = Math.acos(clamp(w1x * w2x + w1y * w2y, -0.9999, 0.9999));
    const rQ = Math.min(typeof radios === "number" ? radios : radios[(k + 1) % n], 0.49 * Math.min(m1, m2) * Math.tan(thQ / 2));
    const tQ = rQ / Math.tan(thQ / 2);
    const bxs = Q[0] + w1x * tQ, bys = Q[1] + w1y * tQ;
    const largo = Math.hypot(bxs - a2x, bys - a2y);
    const ms = Math.floor(largo / (paso * 3));
    for (let i = 1; i < ms; i++) out.push([lerp(a2x, bxs, i / ms), lerp(a2y, bys, i / ms)]);
  }
  return out;
}

// Remuestrea un contorno cerrado cada `paso` mm y lo suaviza (redondea las esquinas con radio ~ paso·√pasadas).
function suavizarContorno(pts, paso, pasadas) {
  const n = pts.length;
  const s = [0];
  for (let i = 1; i <= n; i++) s.push(s[i - 1] + Math.hypot(pts[i % n][0] - pts[i - 1][0], pts[i % n][1] - pts[i - 1][1]));
  const total = s[n];
  const m = Math.max(12, Math.round(total / paso));
  let out = [];
  let j = 0;
  for (let k = 0; k < m; k++) {
    const t = (k / m) * total;
    while (s[j + 1] < t) j++;
    const f = (t - s[j]) / (s[j + 1] - s[j] || 1);
    const A = pts[j % n], B = pts[(j + 1) % n];
    out.push([lerp(A[0], B[0], f), lerp(A[1], B[1], f)]);
  }
  for (let p = 0; p < pasadas; p++) {
    out = out.map((q, i) => {
      const a = out[(i - 1 + m) % m], b = out[(i + 1) % m];
      return [(a[0] + 2 * q[0] + b[0]) / 4, (a[1] + 2 * q[1] + b[1]) / 4];
    });
  }
  return out;
}

// Prisma de contorno redondeado: contorno 2D cerrado en el plano (a, b), extruido a lo largo de c entre
// c0 y c1 (números o funciones de (a, b)); los bordes de ambas tapas se redondean con un cuarto de círculo
// de radio r0 y r1. `ejes` dice qué eje del mundo es a, b y c (p. ej. "xzy": a = x, b = z, c = y).
function prismaRedondeado(contorno, { c0, c1, r0 = 3, r1 = 3, n0 = 4, n1 = 4, ejes = "xzy", escalaUV = 400 }) {
  let pts = contorno.slice();
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const A = pts[i], B = pts[(i + 1) % pts.length];
    area += A[0] * B[1] - B[0] * A[1];
  }
  if (area < 0) pts = pts.reverse(); // antihorario en (a, b)
  const n = pts.length;
  const C0 = typeof c0 === "function" ? c0 : () => c0;
  const C1 = typeof c1 === "function" ? c1 : () => c1;
  // normal hacia adentro en cada punto (bisectriz suave sin amplificación excesiva para evitar auto-intersecciones)
  const nin = pts.map((p, i) => {
    const pa = pts[(i - 1 + n) % n], pb = pts[(i + 1) % n];
    let e1x = p[0] - pa[0], e1y = p[1] - pa[1];
    const l1 = Math.hypot(e1x, e1y) || 1; e1x /= l1; e1y /= l1;
    let e2x = pb[0] - p[0], e2y = pb[1] - p[1];
    const l2 = Math.hypot(e2x, e2y) || 1; e2x /= l2; e2y /= l2;
    let nx = -e1y - e2y, ny = e1x + e2x;
    const ln = Math.hypot(nx, ny) || 1; nx /= ln; ny /= ln;
    const k = 1 / Math.max(0.75, nx * -e1y + ny * e1x);
    return [nx * k, ny * k];
  });
  const sArc = [0];
  for (let i = 1; i < n; i++) sArc.push(sArc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const construirAnillo = (off) => {
    let ring = pts.map((p, i) => [p[0] + nin[i][0] * off, p[1] + nin[i][1] * off]);
    const pasadas = Math.round(off * 0.9);
    for (let p = 0; p < pasadas; p++) {
      ring = ring.map((q, i) => {
        const a = ring[(i - 1 + n) % n], b = ring[(i + 1) % n];
        return [(a[0] + 2 * q[0] + b[0]) / 4, (a[1] + 2 * q[1] + b[1]) / 4];
      });
    }
    return ring;
  };
  // anillos: (desplazamiento hacia adentro, posición en c)
  const anillos = [];
  for (let k = 0; k <= n0; k++) {
    const t = (Math.PI / 2) * (1 - k / n0);
    const off = r0 * (1 - Math.cos(t));
    anillos.push({ off, ring: construirAnillo(off), c: (a, b) => C0(a, b) + r0 - r0 * Math.sin(t) });
  }
  for (let k = 0; k <= n1; k++) {
    const t = (Math.PI / 2) * (k / n1);
    const off = r1 * (1 - Math.cos(t));
    anillos.push({ off, ring: construirAnillo(off), c: (a, b) => C1(a, b) - r1 + r1 * Math.sin(t) });
  }
  const pos = [], uv = [];
  const ponerXYZ = (a, b, c) => {
    const v = [0, 0, 0];
    v["xyz".indexOf(ejes[0])] = a;
    v["xyz".indexOf(ejes[1])] = b;
    v["xyz".indexOf(ejes[2])] = c;
    pos.push(v[0], v[1], v[2]);
  };
  for (const an of anillos) {
    for (let i = 0; i < n; i++) {
      const a = an.ring[i][0];
      const b = an.ring[i][1];
      const c = an.c(pts[i][0], pts[i][1]);
      ponerXYZ(a, b, c);
      uv.push(sArc[i] / escalaUV, (c + an.off) / escalaUV);
    }
  }
  const idx = [];
  const NAn = anillos.length;
  for (let r = 0; r < NAn - 1; r++) {
    for (let i = 0; i < n; i++) {
      const a = r * n + i, b = r * n + ((i + 1) % n), c = (r + 1) * n + ((i + 1) % n), d = (r + 1) * n + i;
      idx.push(a, b, c, a, c, d);
    }
  }
  // tapas: triangulación del contorno más interior de cada extremo
  const tapa = (r, invertir) => {
    const v2 = [];
    for (let i = 0; i < n; i++) v2.push(new THREE.Vector2(anillos[r].ring[i][0], anillos[r].ring[i][1]));
    const caras = THREE.ShapeUtils.triangulateShape(v2, []);
    for (const f of caras) {
      if (invertir) idx.push(r * n + f[0], r * n + f[2], r * n + f[1]);
      else idx.push(r * n + f[0], r * n + f[1], r * n + f[2]);
    }
  };
  tapa(0, true);
  tapa(NAn - 1, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  // orientación: volumen con signo positivo = caras hacia afuera
  let vol = 0;
  for (let k = 0; k < idx.length; k += 3) {
    const A = idx[k] * 3, B = idx[k + 1] * 3, C = idx[k + 2] * 3;
    vol += pos[A] * (pos[B + 1] * pos[C + 2] - pos[B + 2] * pos[C + 1])
      - pos[A + 1] * (pos[B] * pos[C + 2] - pos[B + 2] * pos[C])
      + pos[A + 2] * (pos[B] * pos[C + 1] - pos[B + 1] * pos[C]);
  }
  if (vol < 0) {
    for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
    g.setIndex(idx);
  }
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// Barrido a lo largo de x de una sección cerrada en (z, y) que cambia con x (siempre con el mismo número de
// puntos). Los extremos se cierran con tapas planas (quedan escondidos dentro de los costados).
function barridoX(xs, seccion, escalaUV = 400) {
  const pos = [], uv = [], idx = [];
  const centros = [];
  let nS = 0;
  for (let i = 0; i < xs.length; i++) {
    const sec = seccion(xs[i]);
    nS = sec.length;
    let s = 0, cz = 0, cy = 0;
    for (let j = 0; j < nS; j++) {
      if (j) s += Math.hypot(sec[j][0] - sec[j - 1][0], sec[j][1] - sec[j - 1][1]);
      pos.push(xs[i], sec[j][1], sec[j][0]);
      uv.push(xs[i] / escalaUV, s / escalaUV);
      cz += sec[j][0]; cy += sec[j][1];
    }
    centros.push([cy / nS, cz / nS]);
  }
  const tubo = [];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < nS; j++) {
      const a = i * nS + j, b = i * nS + ((j + 1) % nS), c = (i + 1) * nS + ((j + 1) % nS), d = (i + 1) * nS + j;
      tubo.push(a, b, c, a, c, d);
    }
  }
  // sentido del tubo: las normales deben salir del eje de la sección
  let voto = 0;
  for (let k = 0; k < tubo.length; k += 3) {
    const A = tubo[k] * 3, B = tubo[k + 1] * 3, C = tubo[k + 2] * 3;
    const ux = pos[B] - pos[A], uy = pos[B + 1] - pos[A + 1], uz = pos[B + 2] - pos[A + 2];
    const vx = pos[C] - pos[A], vy = pos[C + 1] - pos[A + 1], vz = pos[C + 2] - pos[A + 2];
    const ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const fila = Math.floor(tubo[k] / nS);
    voto += Math.sign(ny * (pos[A + 1] - centros[fila][0]) + nz * (pos[A + 2] - centros[fila][1]));
  }
  if (voto < 0) for (let k = 0; k < tubo.length; k += 3) { const t = tubo[k + 1]; tubo[k + 1] = tubo[k + 2]; tubo[k + 2] = t; }
  idx.push(...tubo);
  // tapas con vértices propios (no mezclan normales con el tubo)
  for (const [i, sx] of [[0, -1], [xs.length - 1, 1]]) {
    const base = pos.length / 3;
    for (let j = 0; j < nS; j++) { const k = (i * nS + j) * 3; pos.push(pos[k], pos[k + 1], pos[k + 2]); uv.push(0, 0); }
    pos.push(xs[i], centros[i][0], centros[i][1]); uv.push(0, 0);
    const c = base + nS;
    for (let j = 0; j < nS; j++) {
      const a = base + j, b = base + ((j + 1) % nS);
      const A = a * 3, B = b * 3, Cc = c * 3;
      const nx = (pos[A + 1] - pos[Cc + 1]) * (pos[B + 2] - pos[Cc + 2]) - (pos[A + 2] - pos[Cc + 2]) * (pos[B + 1] - pos[Cc + 1]);
      if (nx * sx >= 0) idx.push(c, a, b); else idx.push(c, b, a);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// z del frente del contorno del cojín para cada |x| (interpolado entre los puntos del contorno).
function frenteContorno(C) {
  const paso = 4;
  const n = Math.ceil(400 / paso) + 1;
  const tabla = new Float32Array(n).fill(-1e9);
  // muestrear cada segmento del frente (z > 0) cada ~1 mm y quedarse con la z más adelantada por casilla de |x|
  for (let k = 0; k < C.length; k++) {
    const A = C[k], B = C[(k + 1) % C.length];
    if (A.z < 0 && B.z < 0) continue;
    const m = Math.max(1, Math.ceil(Math.hypot(B.x - A.x, B.z - A.z)));
    for (let j = 0; j <= m; j++) {
      const x = Math.abs(lerp(A.x, B.x, j / m)), z = lerp(A.z, B.z, j / m);
      const i = Math.round(x / paso);
      if (i < n && z > tabla[i]) tabla[i] = z;
    }
  }
  let ultimo = tabla[0] > -1e8 ? tabla[0] : 0;
  for (let i = 0; i < n; i++) { if (tabla[i] < -1e8) tabla[i] = ultimo - 30; ultimo = tabla[i]; }
  return (x) => {
    const f = clamp(Math.abs(x) / paso, 0, n - 1.001);
    const i = Math.floor(f);
    return lerp(tabla[i], tabla[i + 1], f - i);
  };
}

// Carcasa plástica del FC-20: costados anchos bajo los almohadones (con un escalón redondo abajo),
// bandeja delantera bajo la franja con rebaje en trapecio, hueco oscuro bajo la bandeja y zócalo
// escondido. Todas las piezas suben hasta meterse en el fondo del cojín y terminan con curvas suaves
// tanto en planta como en alzado, sin puntas ni cortes verticales duros.
export function crearCarcasaAlmohadon(plastico, m, { dy = 0, dz = 0 } = {}) {
  const grupo = new THREE.Group();
  grupo.name = "base-almohadon";
  const agregar = (geo, nombre) => {
    const mesh = new THREE.Mesh(geo, plastico);
    mesh.name = nombre;
    mesh.position.set(0, dy, dz);
    grupo.add(mesh);
  };
  const W = m.W;
  const C = m.contorno;
  const fondo = m.fondo;
  const solape = 16; // cuánto entra cada pieza en el fondo del cojín (sin rendijas)
  const xi = 0.675 * W; // borde interior de los costados (bien adentro detrás de la bandeja)
  const yPie = 98; // borde inferior visible de la carcasa (a la altura del FC-20)
  const zAtras = m.zc - m.L + 26;
  let zFrente = -1e9;
  for (const p of C) zFrente = Math.max(zFrente, p.z);

  // 1) Costados: el contorno del cojín metido `ins` mm hacia adentro, con extremos anchos y redondeados en planta y en alzado.
  //    Se filtra sobre las coordenadas base del contorno para que el pie quede 100 % anidado dentro del costado.
  const costado = (signo, ins, yAbajo, r0, nombre, yArriba, elevaAtras = 18, elevaFrente = 14) => {
    const lado = [];
    const xMin = xi + 8;
    const zMin = zAtras + 24, zMax = zFrente - 14;
    const dIn = Math.max(0, ins - 10);
    for (const p of C) {
      if (signo * p.x > xMin && p.z > zMin && p.z < zMax) {
        lado.push([p.x - p.ox * ins, p.z - p.oz * ins]);
      }
    }
    if (lado.length < 4) return;
    const ini = lado[0], fin = lado[lado.length - 1];
    const zIni = ini[1] + 0.45 * dIn, zFin = fin[1] - 0.45 * dIn, zMed = 0.5 * (zIni + zFin);
    const xIn = xi - 36 + dIn;
    const xMedFin = 0.5 * (Math.abs(fin[0]) + xIn), xMedIni = 0.5 * (Math.abs(ini[0]) + xIn);
    const poli = lado.concat([
      [signo * xMedFin, zFin + 6],
      [signo * (xIn + 10), zFin - 12],
      [signo * xIn, lerp(zFin, zMed, 0.35)],
      [signo * xIn, lerp(zIni, zMed, 0.35)],
      [signo * (xIn + 10), zIni + 12],
      [signo * xMedIni, zIni - 6],
    ]);
    const suave = suavizarContorno(poli, 4, 42);
    const c0 = (a, b) =>
      yAbajo +
      elevaAtras * Math.pow(1 - smooth(zIni - 10, zIni + 75, b), 1.6) +
      elevaFrente * Math.pow(smooth(zFin - 80, zFin + 10, b), 1.6) +
      7 * Math.pow(1 - smooth(xIn, xIn + 44, Math.abs(a)), 1.5);
    const top = yArriba ?? ((a, b) => fondo(a, b) + solape);
    agregar(prismaRedondeado(suave, { c0, c1: top, r0, r1: 8, n0: 8, n1: 4, ejes: "xzy" }), nombre);
  };
  for (const s of [1, -1]) {
    costado(s, 10, yPie + 40, 26, s > 0 ? "carcasa-costado-der" : "carcasa-costado-izq", null, 20, 18);
    costado(s, 21, yPie, 19, s > 0 ? "carcasa-pie-der" : "carcasa-pie-izq", (a, b) => Math.min(yPie + 80, fondo(a, b) + solape), 14, 11);
  }

  // 2) Bandeja delantera: barra redondeada bajo la franja, con rebaje en trapecio redondeado abajo;
  //    sus extremos se curvan hacia atrás con radio amplio (rPunta = 76) y quedan alojados dentro de los costados.
  const frenteEn = frenteContorno(C);
  const yFr = fondo(0, zFrente - 20); // fondo de la franja delantera
  const xb = xi + 26;
  const yb = yFr - 74; // borde inferior de la bandeja
  const hn = 17; // alto del rebaje
  const xn1 = 0.48 * W, xn2 = xn1 + 28; // transición amplia y suave del rebaje en trapecio
  const rPunta = 76;
  const zBand = (x) => {
    const u = Math.min(1, Math.max(0, Math.abs(x) - (xb - rPunta)) / rPunta);
    return frenteEn(x) - 18 - rPunta * (1 - Math.sqrt(Math.max(0, 1 - u * u)));
  };
  const seccionBandeja = (x) => {
    const ax = Math.abs(x);
    const zF = zBand(x), zB = zF - 145;
    const yT = Math.max(yFr + 8, fondo(x, zF) + solape - 2);
    const subePunta = 20 * Math.pow(smooth(xb - 64, xb, ax), 1.6);
    const yB = yb + hn * (1 - smooth(xn1, xn2, ax)) + subePunta;
    const rB = 19, rT = 14;
    const out = [];
    for (let i = 0; i < 4; i++) out.push([lerp(zB + 8, zF - rB, i / 4), yB]);
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * (Math.PI / 2); out.push([zF - rB + rB * Math.cos(a), yB + rB + rB * Math.sin(a)]); }
    for (let i = 0; i < 5; i++) out.push([zF, lerp(yB + rB, yT - rT, i / 5)]);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * (Math.PI / 2); out.push([zF - rT + rT * Math.cos(a), yT - rT + rT * Math.sin(a)]); }
    for (let i = 0; i < 3; i++) out.push([lerp(zF - rT, zB + 8, i / 3), yT]);
    for (let i = 0; i < 4; i++) { const a = Math.PI / 2 + (i / 3) * Math.PI; out.push([zB + 8 + 8 * Math.cos(a), 0.5 * (yT + yB) + 0.5 * (yT - yB) * Math.sin(a)]); }
    return out;
  };
  const xsB = [];
  const nB = Math.round(xb / 5.5);
  for (let i = -nB; i <= nB; i++) xsB.push((xb * i) / nB);
  for (const sg of [-1, 1]) for (let x = xn1 - 6; x <= xn2 + 6; x += 2) xsB.push(sg * x);
  for (const sg of [-1, 1]) for (let i = 1; i < 14; i++) xsB.push(sg * (xb - rPunta * (1 - Math.cos((i / 14) * (Math.PI / 2)))));
  xsB.sort((a, b) => a - b);
  agregar(barridoX(xsB.filter((x, i) => i === 0 || x - xsB[i - 1] > 0.8), seccionBandeja), "carcasa-bandeja");

  // 3) Cuerpo central entre los costados: su frente queda bien atrás de la bandeja (hueco en sombra) y su
  //    techo se mete en el fondo del cojín (cierra la vista desde abajo y desde atrás).
  const zHueco = zBand(0) - 120; // hueco hondo bajo la bandeja: queda en sombra, como en la foto
  const cuerpo = poligonoRedondeado([[-xi - 16, zAtras + 20], [xi + 16, zAtras + 20], [xi + 16, zHueco], [-xi - 16, zHueco]], [46, 46, 30, 30], 4);
  agregar(prismaRedondeado(cuerpo, { c0: yPie + 6, c1: (a, b) => fondo(a, b) + solape, r0: 18, r1: 4, n0: 6, n1: 2, ejes: "xzy" }), "carcasa-cuerpo");

  // 4) Zócalo escondido: muy redondeado para que visto desde abajo no tenga aristas duras
  {
    const z0 = zAtras + 18, z1 = -120;
    const ancho = 0.92 * W, prof = z1 - z0, alto = yPie + 14 - 30;
    const g = new RoundedBoxGeometry(ancho, alto, prof, 6, 22);
    const mesh = new THREE.Mesh(g, plastico);
    mesh.name = "carcasa-zocalo";
    mesh.position.set(0, 30 + alto / 2 + dy, z0 + prof / 2 + dz);
    grupo.add(mesh);
  }
  return grupo;
}
