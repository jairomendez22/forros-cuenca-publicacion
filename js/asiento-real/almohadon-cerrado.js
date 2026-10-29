// Generador de piezas "almohadón cerrado" (respaldo y cabecera del FC-20).
// Se construye en un marco local de la pieza: x (lateral), v (a lo largo de la pieza, hacia arriba)
// y w (hacia el frente). Estructura, igual que el cojín almohadón:
//  1) parche del panel delantero (rectángulo redondeado, malla tensorial con filas densas en las costuras);
//  2) anillo delantero: del borde del panel hacia afuera, a lo largo de rayos, hasta el contorno exterior
//     (almohadones laterales, franja y canto redondeado que cae en vertical);
//  3) pared lateral con un ligero abombado;
//  4) anillo trasero y parche trasero (cara trasera convexa) con la misma topología, sin huecos.
// Devuelve lo mismo que crearCuerpo / crearCojinAlmohadon (geometrías por zona con base3D, pespuntes,
// ribetes) para usarlo con mallasDeCuerpo. Medidas en mm.
import * as THREE from "../vendor/three-0.186.1-extra.min.js";

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
export const suave = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// Caída circular del canto: 0 lejos del borde y R justo en el borde (tangente vertical, sin aristas).
export const caida = (d, R) => (R > 0 && d < R ? R - Math.sqrt(Math.max(0, R * R - (R - d) * (R - d))) : 0);

// Intersección de un rayo (p + n·t) con un polígono cerrado; devuelve el menor t > 0.
function rayoPoligono(px, pv, nx, nv, poli) {
  let mejor = Infinity;
  const n = poli.length;
  for (let k = 0; k < n; k++) {
    const a = poli[k];
    const b = poli[(k + 1) % n];
    const ex = b[0] - a[0];
    const ev = b[1] - a[1];
    const den = nx * ev - nv * ex;
    if (Math.abs(den) < 1e-12) continue;
    const wx = a[0] - px;
    const wv = a[1] - pv;
    const t = (wx * ev - wv * ex) / den;
    const s = (wx * nv - wv * nx) / den;
    if (t > 1e-6 && s >= -1e-9 && s <= 1 + 1e-9 && t < mejor) mejor = t;
  }
  return mejor;
}

/**
 * def = {
 *   marco: { O, X, T, N, comba?(v) },            // origen y ejes (Vector3); comba desplaza w a lo largo de v
 *   panel: { hw, v0, v1, rcS, rcI, arco?(x, v) }, // rectángulo redondeado del panel (arco: curvatura del borde superior)
 *   contorno?: [[x, v], ...],                     // contorno exterior (polígono antihorario); o bien
 *   banda?: número,                               // ancho fijo del anillo (cabecera)
 *   franja?: mm,                                  // costura de la franja medida desde el borde exterior
 *   paso, grupos: [[v, n, ancho]], NC, NQ, NQt, nW, bulto,
 *   frente(x, v, c) -> { w, ao, ds },             // cara delantera (c: dp, t, T, d, q, ts, nx, nv, enPanel)
 *   trasera(x, v, c) -> { w, ao },                // cara trasera (w negativo)
 *   zonaPanel(x, v), zonaAnillo(esFranja), zonaPared, zonaFondo,
 *   relieve: Set de zonas con relieve liso, relieveLiso(zona, x, v, dp) -> { altura, ao },
 *   perforado(zona, sub), pespuntes(api) -> [{ zona, linea, puntada, soloLiso? }]
 * }
 */
export function crearAlmohadonCerrado(def) {
  const { O, X, T, N } = def.marco;
  const comba = def.marco.comba ?? (() => 0);
  const pan = def.panel;
  const vm = 0.5 * (pan.v0 + pan.v1);
  const hh = 0.5 * (pan.v1 - pan.v0);
  const arco = pan.arco ?? null;
  const escX = pan.escalaX ?? null; // factor de ancho del panel según la altura (opcional)
  const NC = def.NC ?? 56;
  const NQ = def.NQ ?? 24;
  const NQt = def.NQt ?? 10;
  const nW = def.nW ?? 8;
  const bulto = def.bulto ?? 6;

  // Distancia con signo al panel (negativa dentro), en coordenadas sin el arco del borde superior.
  const sdfRect = (x, v) => {
    const r = v > vm ? pan.rcS : pan.rcI;
    const qx = Math.abs(x) - (pan.hw - r);
    const qy = Math.abs(v - vm) - (hh - r);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  };
  const dpAt = (x, v) => sdfRect(escX ? x / escX(v) : x, arco ? v - arco(x, v) : v);
  const hwFila = (v) => {
    if (pan.hwDe) return pan.hwDe(v); // forma libre (medio ancho por altura), p. ej. la cabecera
    if (v > pan.v1 - pan.rcS) {
      const dv = v - (pan.v1 - pan.rcS);
      return pan.hw - pan.rcS + Math.sqrt(Math.max(0, pan.rcS * pan.rcS - dv * dv));
    }
    if (v < pan.v0 + pan.rcI) {
      const dv = pan.v0 + pan.rcI - v;
      return pan.hw - pan.rcI + Math.sqrt(Math.max(0, pan.rcI * pan.rcI - dv * dv));
    }
    return pan.hw;
  };

  // ---------------------------------------------------------- vértices
  const P = { X: [], Y: [], Z: [], lx: [], lv: [], dp: [], ao: [], ds: [], u: [], v: [] };
  const addV = (x, v, w, dp, ao, ds, u, vv) => {
    const ww = w + comba(v);
    P.X.push(O.x + X.x * x + T.x * v + N.x * ww);
    P.Y.push(O.y + X.y * x + T.y * v + N.y * ww);
    P.Z.push(O.z + X.z * x + T.z * v + N.z * ww);
    P.lx.push(x);
    P.lv.push(v);
    P.dp.push(dp);
    P.ao.push(ao);
    P.ds.push(ds);
    P.u.push(u);
    P.v.push(vv);
    return P.X.length - 1;
  };
  const mundo = (x, v, w) => {
    const ww = w + comba(v);
    return new THREE.Vector3(O.x + X.x * x + T.x * v + N.x * ww, O.y + X.y * x + T.y * v + N.y * ww, O.z + X.z * x + T.z * v + N.z * ww);
  };
  const cPanel = (dp) => ({ dp, t: 0, T: def.banda ?? Infinity, d: def.banda !== undefined ? def.banda - dp : Infinity, q: 0, ts: 0, nx: 0, nv: 0, enPanel: true });

  // --- 1) filas del panel: paso base + grupos densos en las costuras + esquinas redondeadas (sin solapar bucles)
  const vs = new Set();
  const red = (v) => Math.round(v * 100) / 100;
  const paso = def.paso ?? 5.2;
  const vA = pan.v0 + (pan.rcI || 0), vB = pan.v1 - (pan.rcS || 0);
  const nEsqS = Math.max(8, Math.round(((pan.rcS || 20) * Math.PI) / (2 * paso)));
  const nEsqI = Math.max(8, Math.round(((pan.rcI || 16) * Math.PI) / (2 * paso)));
  for (let k = 0; k <= nEsqS; k++) {
    const t = k / nEsqS;
    vs.add(red(pan.v1 - pan.rcS * (1 - Math.cos((t * Math.PI) / 2))));
  }
  for (let k = 0; k <= nEsqI; k++) {
    const t = k / nEsqI;
    vs.add(red(pan.v0 + pan.rcI * (1 - Math.cos((t * Math.PI) / 2))));
  }
  const grupos = def.grupos ?? [];
  for (const [vc, n, ancho] of grupos) for (let k = -n; k <= n; k++) vs.add(red(vc + (k * ancho) / n));
  const nMid = Math.max(2, Math.round((vB - vA) / paso));
  for (let k = 1; k < nMid; k++) {
    const v = vA + ((vB - vA) * k) / nMid;
    if (grupos.every(([vc, , ancho]) => Math.abs(v - vc) > ancho + 0.55 * paso)) {
      vs.add(red(v));
    }
  }
  vs.add(pan.v0);
  vs.add(pan.v1);
  const filas = [...vs].filter((v) => v >= pan.v0 && v <= pan.v1).sort((a, b) => a - b);
  const NR = filas.length;
  const sCol = [];
  for (let i = 0; i < NC; i++) {
    const lin = (2 * i) / (NC - 1) - 1;
    sCol.push(0.72 * lin + 0.28 * Math.sin((Math.PI / 2) * lin));
  }
  // Posiciones (x, v) del panel, con el arco aplicado
  const gx = [];
  const gv = [];
  for (let j = 0; j < NR; j++) {
    const hw = hwFila(filas[j]) * (escX ? escX(filas[j]) : 1);
    const fx = [];
    const fv = [];
    for (let i = 0; i < NC; i++) {
      const x = sCol[i] * hw;
      fx.push(x);
      fv.push(arco ? filas[j] + arco(x, filas[j]) : filas[j]);
    }
    gx.push(fx);
    gv.push(fv);
  }
  const enBorde = (i, j) => i === 0 || j === 0 || i === NC - 1 || j === NR - 1;

  // Lazo del borde del panel (antihorario visto de frente)
  const lazoIJ = [];
  for (let j = 0; j < NR; j++) lazoIJ.push([NC - 1, j]);
  for (let i = NC - 2; i >= 0; i--) lazoIJ.push([i, NR - 1]);
  for (let j = NR - 2; j >= 0; j--) lazoIJ.push([0, j]);
  for (let i = 1; i < NC - 1; i++) lazoIJ.push([i, 0]);
  const NB = lazoIJ.length;
  // Con forma libre, la distancia al borde se mide exactamente contra el lazo (polilínea cerrada).
  const lazoX = lazoIJ.map(([i, j]) => gx[j][i]);
  const lazoV = lazoIJ.map(([i, j]) => gv[j][i]);
  const distLazo = (x, v) => {
    let m = Infinity;
    for (let k = 0; k < NB; k++) {
      const ax = lazoX[k], av = lazoV[k];
      const ex = lazoX[(k + 1) % NB] - ax, ev = lazoV[(k + 1) % NB] - av;
      const t = clamp(((x - ax) * ex + (v - av) * ev) / (ex * ex + ev * ev || 1), 0, 1);
      const dd = (x - ax - t * ex) ** 2 + (v - av - t * ev) ** 2;
      if (dd < m) m = dd;
    }
    return -Math.sqrt(m); // solo se usa para puntos interiores
  };
  const dpPanel = pan.hwDe ? distLazo : dpAt;
  const idxF = [];
  const dpGrid = [];
  for (let j = 0; j < NR; j++) {
    const fila = [];
    const filaDp = [];
    for (let i = 0; i < NC; i++) {
      const x = gx[j][i];
      const v = gv[j][i];
      const dp = enBorde(i, j) ? 0 : Math.min(-1e-6, dpPanel(x, v));
      filaDp.push(dp);
      const r = def.frente(x, v, cPanel(dp));
      fila.push(addV(x, v, r.w, dp, r.ao, r.ds, x, v));
    }
    idxF.push(fila);
    dpGrid.push(filaDp);
  }

  // --- 2) rayos hacia afuera desde el borde del panel (con normales suavizadas para evitar pellizcos en los hombros)
  let dirRayos = [];
  for (let k = 0; k < NB; k++) {
    const [ia, ja] = lazoIJ[(k - 1 + NB) % NB];
    const [ib, jb] = lazoIJ[(k + 1) % NB];
    const tx = gx[jb][ib] - gx[ja][ia];
    const tv = gv[jb][ib] - gv[ja][ia];
    const l = Math.hypot(tx, tv) || 1;
    dirRayos.push([tv / l, -tx / l]);
  }
  const nSuav = pan.hwDe ? 0 : 6;
  for (let p = 0; p < nSuav; p++) {
    dirRayos = dirRayos.map((d, k) => {
      const da = dirRayos[(k - 1 + NB) % NB], db = dirRayos[(k + 1) % NB];
      const nx = da[0] + 2 * d[0] + db[0], nv = da[1] + 2 * d[1] + db[1];
      const l = Math.hypot(nx, nv) || 1;
      return [nx / l, nv / l];
    });
  }
  const rayos = [];
  for (let k = 0; k < NB; k++) {
    const [i, j] = lazoIJ[k];
    const [nx, nv] = dirRayos[k];
    const x0 = gx[j][i];
    const v0 = gv[j][i];
    const Tr = def.contorno ? rayoPoligono(x0, v0, nx, nv, def.contorno) : def.banda;
    const aTs = Tr - (def.franja ?? 0);
    const bTs = 0.55 * Tr;
    const ts = def.franja !== undefined ? 0.5 * (aTs + bTs + Math.hypot(aTs - bTs, 6)) : 0.5 * Tr;
    rayos.push({ k, i, j, x0, v0, nx, nv, T: Tr, ts });
  }
  const gq = (q) => q - (0.58 * Math.sin(2 * Math.PI * q)) / (2 * Math.PI);
  const gqOuter = (u) => Math.sin((Math.PI / 2) * Math.pow(clamp(u, 0, 1), 0.78));
  const NA = def.franja !== undefined ? Math.round(NQ * 0.62) : NQ;
  const muestrasT = (r) => {
    const out = [];
    for (let m = 0; m <= NQ; m++) {
      if (def.franja === undefined) {
        const u = m / NQ;
        out.push(r.T * (0.4 * gq(u) + 0.6 * gqOuter(u)));
      } else {
        out.push(m <= NA ? r.ts * gq(m / NA) : r.ts + (r.T - r.ts) * gqOuter((m - NA) / (NQ - NA)));
      }
    }
    return out;
  };
  const cAnillo = (r, t) => ({ dp: t, t, T: r.T, d: Math.max(0, r.T - t), q: t / r.T, ts: r.ts, nx: r.nx, nv: r.nv, enPanel: false });

  // Longitud de arco medida a mitad del almohadón (coordenada u continua e isométrica en hombros y esquinas)
  const sLazo = [0];
  for (let k = 1; k < NB; k++) {
    const ra = rayos[k - 1], rb = rayos[k];
    const xa = ra.x0 + 0.5 * ra.T * ra.nx, va = ra.v0 + 0.5 * ra.T * ra.nv;
    const xb = rb.x0 + 0.5 * rb.T * rb.nx, vb = rb.v0 + 0.5 * rb.T * rb.nv;
    sLazo.push(sLazo[k - 1] + Math.hypot(xb - xa, vb - va));
  }

  const anilloF = [];
  const tAnillo = [];
  const vFinAnillo = [];
  for (const r of rayos) {
    const ts = muestrasT(r);
    tAnillo.push(ts);
    const fila = [];
    let vAcum = 0;
    let prev = null;
    for (let m = 0; m <= NQ; m++) {
      const t = ts[m];
      const x = r.x0 + r.nx * t;
      const v = r.v0 + r.nv * t;
      const res = def.frente(x, v, cAnillo(r, t));
      if (prev) vAcum += Math.hypot(x - prev[0], v - prev[1], res.w - prev[2]);
      prev = [x, v, res.w];
      // m = 0 duplica el vértice del borde del panel (misma posición): la costura queda nítida
      fila.push(addV(x, v, res.w, t, res.ao, res.ds, sLazo[r.k], vAcum));
    }
    vFinAnillo.push(vAcum);
    anilloF.push(fila);
  }

  // --- 3) parche y anillo traseros (misma topología que el frente)
  const idxB = [];
  for (let j = 0; j < NR; j++) {
    const fila = [];
    for (let i = 0; i < NC; i++) {
      const x = gx[j][i];
      const v = gv[j][i];
      const dp = dpGrid[j][i];
      const r = def.trasera(x, v, cPanel(dp));
      fila.push(addV(x, v, r.w, dp, r.ao, 99, x, v));
    }
    idxB.push(fila);
  }
  const anilloB = [];
  for (const r of rayos) {
    const fila = [idxB[r.j][r.i]];
    for (let m = 1; m <= NQt; m++) {
      const t = r.T * Math.sin((Math.PI / 2) * Math.pow(m / NQt, 0.78));
      const x = r.x0 + r.nx * t;
      const v = r.v0 + r.nv * t;
      const res = def.trasera(x, v, cAnillo(r, t));
      fila.push(addV(x, v, res.w, t, res.ao, 99, x, v));
    }
    anilloB.push(fila);
  }

  // --- 4) pared lateral entre el canto delantero y el trasero (arco continuo sin aristas)
  const pared = [];
  const aoPared = def.aoPared ?? [0.92, 0.7];
  for (let k = 0; k < NB; k++) {
    const iF = anilloF[k][NQ];
    const iB = anilloB[k][NQt];
    const kp = (k + 1) % NB;
    const km = (k - 1 + NB) % NB;
    const ex = P.lx[anilloF[kp][NQ]] - P.lx[anilloF[km][NQ]];
    const ev = P.lv[anilloF[kp][NQ]] - P.lv[anilloF[km][NQ]];
    const l = Math.hypot(ex, ev) || 1;
    let ox = ev / l;
    let ov = -ex / l;
    if (ox * rayos[k].nx + ov * rayos[k].nv < 0) {
      ox = -ox;
      ov = -ov;
    }
    const x = P.lx[iF];
    const v = P.lv[iF];
    const wF = localW(iF);
    const wB = localW(iB);
    const fila = [iF];
    for (let s = 1; s < nW; s++) {
      const tau = s / nW;
      const b = bulto * Math.pow(Math.sin(Math.PI * tau), 1.25);
      const xx = x + ox * b;
      const vv = v + ov * b;
      fila.push(addV(xx, vv, lerp(wF, wB, tau), 99, lerp(aoPared[0], aoPared[1], tau), 99, sLazo[k], vFinAnillo[k] + Math.abs(wF - wB) * tau));
    }
    fila.push(iB);
    pared.push(fila);
  }
  function localW(i) {
    const dx = P.X[i] - O.x;
    const dy = P.Y[i] - O.y;
    const dz = P.Z[i] - O.z;
    return dx * N.x + dy * N.y + dz * N.z - comba(P.lv[i]);
  }

  // ---------------------------------------------------------- triángulos por grupo, orientados hacia afuera
  const tris = []; // [a, b, c, zona, sub]
  const nrm = (a, b, c) => {
    const ux = P.X[b] - P.X[a], uy = P.Y[b] - P.Y[a], uz = P.Z[b] - P.Z[a];
    const wx = P.X[c] - P.X[a], wy = P.Y[c] - P.Y[a], wz = P.Z[c] - P.Z[a];
    return [uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx];
  };
  const agregarGrupo = (lista, refDe) => {
    let suma = 0;
    for (const t of lista) {
      const n = nrm(t[0], t[1], t[2]);
      const r = refDe(t);
      suma += n[0] * r[0] + n[1] * r[1] + n[2] * r[2];
    }
    for (const t of lista) {
      if (suma < 0) {
        const tmp = t[1];
        t[1] = t[2];
        t[2] = tmp;
      }
      tris.push(t);
    }
  };
  const refN = [N.x, N.y, N.z];
  const refNn = [-N.x, -N.y, -N.z];
  const quad = (lista, a, b, c, d, zona, sub) => {
    lista.push([a, b, c, zona, sub], [a, c, d, zona, sub]);
  };
  {
    const g = [];
    for (let j = 0; j < NR - 1; j++) {
      for (let i = 0; i < NC - 1; i++) {
        const xc = 0.25 * (gx[j][i] + gx[j][i + 1] + gx[j + 1][i] + gx[j + 1][i + 1]);
        const vc = 0.25 * (gv[j][i] + gv[j][i + 1] + gv[j + 1][i] + gv[j + 1][i + 1]);
        const z = def.zonaPanel(xc, vc);
        quad(g, idxF[j][i], idxF[j][i + 1], idxF[j + 1][i + 1], idxF[j + 1][i], z.zona, z.sub);
      }
    }
    agregarGrupo(g, () => refN);
  }
  {
    const g = [];
    for (let k = 0; k < NB; k++) {
      const A = anilloF[k];
      const B = anilloF[(k + 1) % NB];
      for (let m = 0; m < NQ; m++) {
        const z = def.zonaAnillo(m >= NA);
        quad(g, A[m], B[m], B[m + 1], A[m + 1], z.zona, z.sub);
      }
    }
    agregarGrupo(g, () => refN);
  }
  {
    const g = [];
    for (let k = 0; k < NB; k++) {
      const A = pared[k];
      const B = pared[(k + 1) % NB];
      for (let s = 0; s < nW; s++) quad(g, A[s], B[s], B[s + 1], A[s + 1], def.zonaPared.zona, def.zonaPared.sub);
    }
    // referencia: hacia afuera del eje central de la pieza, en el plano local
    agregarGrupo(g, (t) => {
      const x = P.lx[t[0]];
      const v = P.lv[t[0]];
      const dv = v - clamp(v, pan.v0 + pan.rcI, pan.v1 - pan.rcS);
      return [X.x * x + T.x * dv, X.y * x + T.y * dv, X.z * x + T.z * dv];
    });
  }
  {
    const g = [];
    for (let k = 0; k < NB; k++) {
      const A = anilloB[k];
      const B = anilloB[(k + 1) % NB];
      for (let m = 0; m < NQt; m++) quad(g, A[m], B[m], B[m + 1], A[m + 1], def.zonaFondo.zona, def.zonaFondo.sub);
    }
    agregarGrupo(g, () => refNn);
  }
  {
    const g = [];
    for (let j = 0; j < NR - 1; j++) {
      for (let i = 0; i < NC - 1; i++) quad(g, idxB[j][i], idxB[j][i + 1], idxB[j + 1][i + 1], idxB[j + 1][i], def.zonaFondo.zona, def.zonaFondo.sub);
    }
    agregarGrupo(g, () => refNn);
  }

  // ---------------------------------------------------------- normales (promedio ponderado por área)
  const nV = P.X.length;
  const normal = new Float32Array(nV * 3);
  for (const t of tris) {
    const n = nrm(t[0], t[1], t[2]);
    for (let s = 0; s < 3; s++) {
      const i = t[s] * 3;
      normal[i] += n[0];
      normal[i + 1] += n[1];
      normal[i + 2] += n[2];
    }
  }
  for (let i = 0; i < nV; i++) {
    const l = Math.hypot(normal[i * 3], normal[i * 3 + 1], normal[i * 3 + 2]) || 1;
    normal[i * 3] /= l;
    normal[i * 3 + 1] /= l;
    normal[i * 3 + 2] /= l;
  }

  // ---------------------------------------------------------- piezas por zona
  const piezas = new Map();
  for (const t of tris) {
    const clave = t[4] ? `${t[3]}|${t[4]}` : t[3];
    if (!piezas.has(clave)) piezas.set(clave, { zona: t[3], sub: t[4], tris: [] });
    piezas.get(clave).tris.push(t);
  }
  const relieve = def.relieve ?? new Set();
  const geometrias = new Map();
  for (const [clave, pz] of piezas) {
    const mapa = new Map();
    const Pp = [], Nn = [], U = [], Cc = [], ao = [], xm = [], ym = [], masc = [], altL = [], aoL = [];
    const idx = [];
    const conRelieve = !pz.sub && relieve.has(pz.zona);
    let tieneRelieve = false;
    const vert = (g) => {
      let k = mapa.get(g);
      if (k !== undefined) return k;
      k = Pp.length / 3;
      mapa.set(g, k);
      Pp.push(P.X[g], P.Y[g], P.Z[g]);
      Nn.push(normal[g * 3], normal[g * 3 + 1], normal[g * 3 + 2]);
      U.push(P.u[g] / 100, P.v[g] / 100);
      Cc.push(P.ao[g], P.ao[g], P.ao[g]);
      ao.push(P.ao[g]);
      xm.push(P.u[g]);
      ym.push(P.v[g]);
      masc.push(pz.sub === "interior" ? 0 : suave(1.8, 7.5, P.ds[g]));
      if (conRelieve) {
        const rl = def.relieveLiso(pz.zona, P.lx[g], P.lv[g], P.dp[g]);
        if (Math.abs(rl.altura) > 1e-4 || rl.ao < 0.999) tieneRelieve = true;
        altL.push(rl.altura);
        aoL.push(rl.ao);
      } else {
        altL.push(0);
        aoL.push(1);
      }
      return k;
    };
    for (const t of pz.tris) idx.push(vert(t[0]), vert(t[1]), vert(t[2]));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(Pp, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(Nn, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(Cc, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    g.userData.zona = pz.zona;
    g.userData.subZona = pz.sub;
    g.userData.perforadoDeFabrica = !!def.perforado?.(pz.zona, pz.sub);
    g.userData.patronAplicado = tieneRelieve ? "" : "liso";
    g.userData.base3D = {
      posBase: new Float32Array(Pp),
      normBase: new Float32Array(Nn),
      aoBase: new Float32Array(ao),
      xm: new Float32Array(xm),
      ym: new Float32Array(ym),
      mascara: new Float32Array(masc),
      tieneRelieveLiso: tieneRelieve,
      altLiso: new Float32Array(altL),
      aoLiso: new Float32Array(aoL),
    };
    geometrias.set(clave, g);
  }

  // ---------------------------------------------------------- pespuntes
  const normalEn = (a, b, w) => {
    const v = new THREE.Vector3(lerp(normal[a * 3], normal[b * 3], w), lerp(normal[a * 3 + 1], normal[b * 3 + 1], w), lerp(normal[a * 3 + 2], normal[b * 3 + 2], w));
    return v.normalize();
  };
  const api = {
    filas,
    rayos,
    hwFila,
    mundo,
    // Línea sobre el anillo delantero a una distancia t(rayo) del borde del panel; null corta la línea.
    lineaAnillo(tDe, filtro, zona, puntada, extra = {}) {
      const tramos = [];
      let actual = [];
      const cerrar = () => {
        if (actual.length > 2) tramos.push(actual);
        actual = [];
      };
      let inicio = 0;
      for (let k = 0; k < NB; k++) {
        const t = tDe(rayos[k]);
        if (t === null || !filtro(rayos[k])) {
          inicio = (k + 1) % NB;
          break;
        }
      }
      for (let n = 0; n < NB; n++) {
        const k = (inicio + n) % NB;
        const r = rayos[k];
        const t = tDe(r);
        if (t === null || !filtro(r)) {
          cerrar();
          continue;
        }
        const x = r.x0 + r.nx * t;
        const v = r.v0 + r.nv * t;
        const res = def.frente(x, v, cAnillo(r, t));
        const ts = tAnillo[k];
        let m = 0;
        while (m < NQ - 1 && ts[m + 1] < t) m++;
        const w = clamp((t - ts[m]) / Math.max(1e-6, ts[m + 1] - ts[m]), 0, 1);
        actual.push({ p: mundo(x, v, res.w), n: normalEn(anilloF[k][m], anilloF[k][m + 1], w) });
      }
      cerrar();
      return tramos.map((linea) => ({ zona, linea, puntada, ...extra }));
    },
    // Línea sobre el panel a la altura v (número o función v(x)), con el relieve liso opcional.
    lineaPanel(v, margen, zona, puntada, conRelieve = false, extra = {}) {
      const vFn = typeof v === "function" ? v : () => v;
      const vRef = vFn(0);
      const hw = hwFila(vRef) * (escX ? escX(vRef) : 1) - margen;
      const linea = [];
      const S = (x, vv) => {
        const dp = dpPanel(x, vv);
        return mundo(x, vv, def.frente(x, vv, cPanel(Math.min(-1e-6, dp))).w);
      };
      for (let i = 0; i <= 72; i++) {
        const x = lerp(-hw, hw, i / 72);
        const vv = vFn(x);
        const p = S(x, vv);
        const e = 0.6;
        const a = S(x + e, vv).sub(S(x - e, vv));
        const b = S(x, vv + e).sub(S(x, vv - e));
        const n = new THREE.Vector3().crossVectors(a, b).normalize();
        if (n.dot(N) < 0) n.negate();
        if (conRelieve) p.addScaledVector(n, def.relieveLiso(zona, x, vv, dpPanel(x, vv)).altura);
        linea.push({ p, n });
      }
      return { zona, linea, puntada, ...extra };
    },
  };
  const pespuntes = def.pespuntes ? def.pespuntes(api) : [];
  const ribetes = def.ribetes ? def.ribetes(api) : [];

  // Borde exterior (local) para colocar piezas vecinas
  const borde = rayos.map((r, k) => ({ x: P.lx[anilloF[k][NQ]], v: P.lv[anilloF[k][NQ]], wF: localW(anilloF[k][NQ]), wB: localW(anilloB[k][NQt]) }));

  return { geometrias, pespuntes, ribetes, borde, mundo, filas, rayos };
}
