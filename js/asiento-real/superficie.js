// Cuerpo tapizado V3: superficie acolchada barrida a lo largo de una columna
// (respaldo, cojín o cabecera) con:
// - Desplazamiento 3D real de vértices (6-10 mm de relieve) para los patrones acolchados
// - Costuras longitudinales, transversales y curvas arbitrarias (escudo en U, costillas deportivas)
// - Pliegues suaves de tracción junto a las costuras y arrugas naturales de compresión
// - Doble pespunte 3D inclinado y vivo (ribete) cilíndrico sobresaliente.
import * as THREE from "../vendor/three-0.186.1-extra.min.js";
import { desplazamientoPatron } from "./texturas.js?v=13";

const TAU = Math.PI * 2;

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const spow = (b, e) => Math.sign(b) * Math.pow(Math.abs(b), e);

// Curva suave que pasa por [[v, valor], …] (Hermite con tangentes de Catmull-Rom).
export function curva(puntos) {
  return (v) => {
    const n = puntos.length;
    if (v <= puntos[0][0]) return puntos[0][1];
    if (v >= puntos[n - 1][0]) return puntos[n - 1][1];
    let i = 0;
    while (v > puntos[i + 1][0]) i++;
    const [v0, a] = puntos[i];
    const [v1, b] = puntos[i + 1];
    const h = v1 - v0;
    const t = (v - v0) / h;
    const m0 = i > 0 ? ((b - puntos[i - 1][1]) / (v1 - puntos[i - 1][0])) * h : b - a;
    const m1 = i < n - 2 ? ((puntos[i + 2][1] - a) / (puntos[i + 2][0] - v0)) * h : b - a;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * a + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * b + (t3 - t2) * m1;
  };
}

export const anguloFrente = (s, n) => Math.acos(Math.pow(clamp(s, 0, 1), n / 2));
export const anguloFrenteIzq = (s, n) => Math.PI - anguloFrente(s, n);
export const anguloTrasIzq = (s, n) => Math.PI + anguloFrente(s, n);
export const anguloTrasDer = (s, n) => TAU - anguloFrente(s, n);

const espaciar = (t, juntar) => lerp(t, 0.5 - 0.5 * Math.cos(Math.PI * t), juntar);

// Distancia mínima de un punto 3D P a una polilínea de puntos 3D.
function distPolilinea3D(px, py, pz, pts) {
  let dmin2 = Infinity;
  let arcoMejor = 0;
  let acc = 0;
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k];
    const b = pts[k + 1];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const vz = b.z - a.z;
    const l2 = vx * vx + vy * vy + vz * vz || 1e-6;
    const u = clamp(((px - a.x) * vx + (py - a.y) * vy + (pz - a.z) * vz) / l2, 0, 1);
    const dx = px - (a.x + u * vx);
    const dy = py - (a.y + u * vy);
    const dz = pz - (a.z + u * vz);
    const d2 = dx * dx + dy * dy + dz * dz;
    const segLen = Math.sqrt(l2);
    if (d2 < dmin2) {
      dmin2 = d2;
      arcoMejor = acc + u * segLen;
    }
    acc += segLen;
  }
  return { d: Math.sqrt(dmin2), arco: arcoMejor };
}

export function crearCuerpo(def) {
  const n = def.n ?? 3;
  const juntar = def.juntar ?? 0.42;
  const X = new THREE.Vector3(1, 0, 0);
  const frente = def.frente.clone().normalize();

  // Filas: tapa inferior, cuerpo y tapa superior.
  const filas = [];
  const claveV = { inicio: 0 };
  const { tapaInf, tapaSup } = def;
  if (tapaInf) {
    for (let k = tapaInf.n; k >= 1; k--) filas.push({ region: -1, u: 0, alfa: (k / tapaInf.n) * (Math.PI / 2), seg: "tapaInf" });
  }
  filas.push({ region: 0, u: 0, alfa: 0, seg: tapaInf ? "tapaInf" : def.segV[0].nombre });
  claveV.cuerpo = filas.length - 1;
  let u0 = 0;
  for (const sg of def.segV) {
    const juntarSeg = sg.juntar ?? juntar;
    for (let k = 1; k <= sg.n; k++) filas.push({ region: 0, u: lerp(u0, sg.fin, espaciar(k / sg.n, juntarSeg)), alfa: 0, seg: sg.nombre });
    claveV[sg.nombre] = filas.length - 1;
    u0 = sg.fin;
  }
  if (tapaSup) {
    const tramos = tapaSup.segmentos ?? [{ nombre: "tapaSup", hasta: 1, n: tapaSup.n }];
    let a0 = 0;
    for (const tr of tramos) {
      for (let k = 1; k <= tr.n; k++) filas.push({ region: 1, u: 1, alfa: lerp(a0, tr.hasta, espaciar(k / tr.n, juntar)) * (Math.PI / 2), seg: tr.nombre });
      claveV[tr.nombre] = filas.length - 1;
      a0 = tr.hasta;
    }
  }
  claveV.fin = filas.length - 1;
  const NV = filas.length;

  // Columnas alrededor de la sección.
  const NP = def.segPhi.reduce((total, sg) => total + sg.n, 0);
  const claveP = {};
  const segDeColumna = [];
  {
    let c = 0;
    for (const sg of def.segPhi) {
      for (let k = 0; k < sg.n; k++) segDeColumna.push(sg.nombre);
      c += sg.n;
      claveP[sg.nombre] = c % NP;
    }
  }

  const marcoDe = (u) => {
    const e = 1e-3;
    const a = def.columna(clamp(u - e, 0, 1));
    const b = def.columna(clamp(u + e, 0, 1));
    const T = b.sub(a).normalize();
    const N = frente.clone().addScaledVector(T, -frente.dot(T)).normalize();
    return { C: def.columna(u), T, N };
  };
  const marcos = { 0: marcoDe(0), 1: marcoDe(1) };
  for (const f of filas) {
    f.uu = f.region < 0 ? 0 : f.region > 0 ? 1 : f.u;
    f.marco = f.region ? marcos[f.region > 0 ? 1 : 0] : marcoDe(f.u);
    const angulos = new Float64Array(NP + 1);
    let c = 0;
    let inicio = 0;
    for (const sg of def.segPhi) {
      const fin = sg.fin(f.uu);
      const juntarPhi = sg.juntar ?? juntar;
      for (let k = 0; k < sg.n; k++) angulos[c + k] = lerp(inicio, fin, espaciar(k / sg.n, juntarPhi));
      c += sg.n;
      inicio = fin;
    }
    angulos[NP] = TAU;
    f.angulos = angulos;
  }

  // Forma base antes de inflado de paneles y surcos de costura.
  const base = new Float64Array(NV * NP * 3);
  const lateral = new Float64Array(NV * NP);
  const uEfectivo = new Float64Array(NV * NP);
  const tmp = new THREE.Vector3();
  for (let j = 0; j < NV; j++) {
    const f = filas[j];
    const W0 = def.ancho(f.uu);
    const Dff = def.fondoDel(f.uu);
    const Dbf = def.fondoTras(f.uu);
    let k = 1;
    let avance = 0;
    let Wf = W0;
    let sa = 0;
    const tapa = f.region > 0 ? tapaSup : f.region < 0 ? tapaInf : null;
    if (tapa) {
      const ca = Math.cos(f.alfa);
      sa = Math.sin(f.alfa);
      k = ca;
      Wf = W0 * (1 - (1 - tapa.rho) * (0.28 * sa + 0.72 * (1 - ca)));
      avance = f.region * tapa.radio * sa;
    }
    for (let i = 0; i < NP; i++) {
      const phi = f.angulos[i];
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      const xs = spow(c, 2 / n);
      let u = f.uu;
      let C = f.marco.C;
      let T = f.marco.T;
      let N = f.marco.N;
      let W = Wf;
      let Df = Dff;
      let Db = Dbf;
      if (!f.region && def.desplazarU) {
        u = clamp(f.u + def.desplazarU(f.u, xs), 0, 1);
        if (u !== f.u) {
          ({ C, T, N } = marcoDe(u));
          W = def.ancho(u);
          Df = def.fondoDel(u);
          Db = def.fondoTras(u);
        }
      }
      let d;
      if (s >= 0) {
        d = Df * Math.pow(s, 2 / n) + (def.relieveDel ? def.relieveDel(xs, u, Df, s) * Math.pow(s, 0.58) : 0);
      } else {
        d = -(Db * Math.pow(-s, 2 / n) + (def.relieveTras ? def.relieveTras(xs, u, Db, -s) * Math.pow(-s, 0.58) : 0));
      }
      d *= k;
      let av = avance;
      if (tapa && tapa.arco) av += f.region * tapa.arco * (1 - xs * xs) * sa;
      tmp.copy(C).addScaledVector(T, av).addScaledVector(X, W * xs).addScaledVector(N, d);
      const o = (j * NP + i) * 3;
      base[o] = tmp.x;
      base[o + 1] = tmp.y;
      base[o + 2] = tmp.z;
      lateral[j * NP + i] = xs;
      uEfectivo[j * NP + i] = u;
    }
  }

  const normalesBase = normalesDeMalla(base, NV, NP, filas, def.frente);

  // Longitudes de arco alrededor de cada fila y a lo largo de cada columna.
  const arcoFila = new Float64Array(NV * (NP + 1));
  const perimetro = new Float64Array(NV);
  for (let j = 0; j < NV; j++) {
    let acc = 0;
    arcoFila[j * (NP + 1)] = 0;
    for (let i = 1; i <= NP; i++) {
      acc += distancia(base, j * NP + (i - 1), j * NP + (i % NP));
      arcoFila[j * (NP + 1) + i] = acc;
    }
    perimetro[j] = acc;
  }
  const arcoCol = new Float64Array(NV * NP);
  for (let i = 0; i < NP; i++) {
    let acc = 0;
    for (let j = 1; j < NV; j++) {
      acc += distancia(base, (j - 1) * NP + i, j * NP + i);
      arcoCol[j * NP + i] = acc;
    }
  }
  const distFila = (j, i, ic) => {
    const d = Math.abs(arcoFila[j * (NP + 1) + i] - arcoFila[j * (NP + 1) + ic]);
    return Math.min(d, perimetro[j] - d);
  };
  const distCol = (i, j, jc) => Math.abs(arcoCol[j * NP + i] - arcoCol[jc * NP + i]);

  // Zonas y subzonas por cuadro.
  const zonaCuadro = new Array((NV - 1) * NP);
  const subZonaCuadro = new Array((NV - 1) * NP);
  for (let j = 0; j < NV - 1; j++) {
    const sv = filas[j + 1].seg;
    const um = 0.5 * (filas[j].uu + filas[j + 1].uu);
    for (let i = 0; i < NP; i++) {
      const i1 = (i + 1) % NP;
      const sm = 0.5 * (lateral[j * NP + i] + lateral[j * NP + i1]);
      zonaCuadro[j * NP + i] = def.zona(segDeColumna[i], sv, um, sm, i, j);
      subZonaCuadro[j * NP + i] = def.subZona ? def.subZona(segDeColumna[i], sv, um, sm, i, j) : "";
    }
  }
  const zonaVertice = (i, j) => zonaCuadro[Math.min(j, NV - 2) * NP + i];

  // Costuras en malla (phi / v).
  const costuras = (def.costuras ?? []).map((c) => {
    if (c.phi) {
      return { ...c, tipo: "phi", ic: claveP[c.phi], j0: claveV[c.desde ?? "inicio"], j1: claveV[c.hasta ?? "fin"] };
    }
    return { ...c, tipo: "v", jc: claveV[c.v], i0: claveP[c.desde], i1: claveP[c.hasta] };
  });
  for (const c of costuras) {
    if (c.tipo === "phi" && (c.ic === undefined || c.j0 === undefined || c.j1 === undefined)) throw new Error(`Costura mal definida: ${c.phi}`);
    if (c.tipo === "v" && (c.jc === undefined || c.i0 === undefined || c.i1 === undefined)) throw new Error(`Costura mal definida: ${c.v}`);
  }
  const distCostura = (c, i, j) => {
    if (c.tipo === "phi") {
      const df = distFila(j, i, c.ic);
      if (j >= c.j0 && j <= c.j1) return df;
      const jc = j < c.j0 ? c.j0 : c.j1;
      return Math.hypot(df, distCol(i, j, jc));
    }
    const dv = distCol(i, j, c.jc);
    if (i >= c.i0 && i <= c.i1) return dv;
    const ic = i < c.i0 ? c.i0 : c.i1;
    return Math.hypot(dv, distFila(j, i, ic));
  };

  // Costuras curvas arbitrarias definidas por puntos [u, s] en la cara frontal.
  // Permiten modelar el escudo en U superior (KIA / Chevrolet / Toyota) y las
  // costillas diagonales deportivas de los bolsters reales del catálogo.
  const evalPuntoFront = (arrPos, arrNorm, uTarget, sTarget) => {
    let j = claveV.cuerpo;
    while (j < NV - 2 && filas[j + 1].region === 0 && filas[j + 1].u < uTarget) j++;
    const uA = filas[j].u;
    const uB = filas[j + 1]?.region === 0 ? filas[j + 1].u : uA;
    const wu = uB > uA ? clamp((uTarget - uA) / (uB - uA), 0, 1) : 0;
    const phiTarget = sTarget >= 0 ? anguloFrente(sTarget, n) : anguloFrenteIzq(-sTarget, n);
    let i = 0;
    while (i < NP - 1 && filas[j].angulos[i + 1] < phiTarget) i++;
    const pA = filas[j].angulos[i];
    const pB = filas[j].angulos[i + 1];
    const wp = pB > pA ? clamp((phiTarget - pA) / (pB - pA), 0, 1) : 0;
    const i1 = (i + 1) % NP;
    const j1 = Math.min(NV - 1, j + 1);
    const getP = (jj, ii) => new THREE.Vector3(arrPos[(jj * NP + ii) * 3], arrPos[(jj * NP + ii) * 3 + 1], arrPos[(jj * NP + ii) * 3 + 2]);
    const getN = (jj, ii) => new THREE.Vector3(arrNorm[(jj * NP + ii) * 3], arrNorm[(jj * NP + ii) * 3 + 1], arrNorm[(jj * NP + ii) * 3 + 2]);
    const p0 = getP(j, i).lerp(getP(j, i1), wp);
    const p1 = getP(j1, i).lerp(getP(j1, i1), wp);
    const n0 = getN(j, i).lerp(getN(j, i1), wp);
    const n1 = getN(j1, i).lerp(getN(j1, i1), wp);
    return { p: p0.lerp(p1, wu), n: n0.lerp(n1, wu).normalize() };
  };

  const costurasCurvas = (def.costurasCurvas ?? []).map((cc) => {
    const ptsBase = cc.puntos.map(([u, s]) => evalPuntoFront(base, normalesBase, u, s).p);
    return { ...cc, ptsBase };
  });

  // Inflado de paneles, surco de costuras, pliegues de tracción y oclusión.
  const pos = new Float32Array(NV * NP * 3);
  const ao = new Float32Array(NV * NP);
  const distCosturaMin = new Float32Array(NV * NP);
  for (let j = 0; j < NV; j++) {
    const f = filas[j];
    for (let i = 0; i < NP; i++) {
      const v = j * NP + i;
      const o = v * 3;
      let dmin = Infinity;
      let surco = 0;
      let sombra = 0;
      let arcoCercano = 0;
      for (const c of costuras) {
        const d = distCostura(c, i, j);
        if (d < dmin && c.inflar !== false) {
          dmin = d;
          arcoCercano = c.tipo === "phi" ? arcoCol[v] : arcoFila[j * (NP + 1) + i];
        }
        surco = Math.max(surco, c.hundido * Math.exp(-((d / c.ancho) ** 2)));
        sombra = Math.max(sombra, (c.sombra ?? 0.46) * Math.exp(-((d / (c.ancho * 1.9)) ** 2)));
      }
      for (const cc of costurasCurvas) {
        const { d, arco } = distPolilinea3D(base[o], base[o + 1], base[o + 2], cc.ptsBase);
        if (d < dmin && cc.inflar !== false) {
          dmin = d;
          arcoCercano = arco;
        }
        surco = Math.max(surco, cc.hundido * Math.exp(-((d / cc.ancho) ** 2)));
        sombra = Math.max(sombra, (cc.sombra ?? 0.44) * Math.exp(-((d / (cc.ancho * 1.85)) ** 2)));
      }
      distCosturaMin[v] = dmin;

      const zId = zonaVertice(i, j);
      const inf = def.inflado?.[zId] ?? { alto: 0, suave: 16 };
      const inflado = inf.alto * (1 - Math.exp(-((dmin / inf.suave) ** 2)));
      let extra = def.deformar ? def.deformar(f.uu, f.region, lateral[v], i, j) : 0;

      // Pliegues suaves y poco profundos solo donde el cuero tira:
      // bajo el hombro, junto a los surcos y en la línea de mordida.
      const arruga = def.arrugas?.[zId];
      if (arruga && f.region === 0) {
        const a2 = arcoCol[v];
        const as = Math.abs(lateral[v]);
        const cercaCostura = Math.exp(-((dmin / 14) ** 2)) * (1 - Math.exp(-((dmin / 2.2) ** 2)));
        const enHombro = smooth(0.75, 0.96, f.uu) * smooth(0.45, 0.82, as);
        const fruncidoRadial = 0.16 * enHombro * cercaCostura * Math.sin((arcoCercano / 18) * Math.PI * 2);

        const enMordida = (1 - smooth(0.01, 0.14, f.uu)) * (1 - smooth(0.32, 0.56, as));
        const asentamiento = 0.22 * enMordida * Math.sin((a2 / 18) * Math.PI);

        extra += arruga * (fruncidoRadial + asentamiento);
      }

      const desp = inflado - surco + extra;
      pos[o] = base[o] + normalesBase[o] * desp;
      pos[o + 1] = base[o + 1] + normalesBase[o + 1] * desp;
      pos[o + 2] = base[o + 2] + normalesBase[o + 2] * desp;
      let a = 1 - sombra;
      if (def.oclusion) a *= def.oclusion(f.uu, f.region, lateral[v], Math.sin(f.angulos[i]) >= 0 ? 1 : -1, f.alfa);
      ao[v] = clamp(a, 0, 1);
    }
  }

  const normales = normalesDeMalla(pos, NV, NP, filas, def.frente);

  // Coordenadas UV medidas en mm / 100 desde el centro exacto del frente.
  const iCentro = claveP[def.centro];
  const uvs = new Float32Array(NV * NP * 2);
  const xmArr = new Float32Array(NV * NP);
  const ymArr = new Float32Array(NV * NP);
  for (let j = 0; j < NV; j++) {
    for (let i = 0; i < NP; i++) {
      let du = arcoFila[j * (NP + 1) + i] - arcoFila[j * (NP + 1) + iCentro];
      if (du > perimetro[j] / 2) du -= perimetro[j];
      if (du < -perimetro[j] / 2) du += perimetro[j];
      const v = j * NP + i;
      xmArr[v] = -du;
      ymArr[v] = arcoCol[v];
      uvs[v * 2] = -du / 100;
      uvs[v * 2 + 1] = arcoCol[v] / 100;
    }
  }

  // Orientación de los triángulos según la normal del frente.
  const jm = claveV.cuerpo + Math.floor((claveV[def.segV[def.segV.length - 1].nombre] - claveV.cuerpo) / 2);
  const geo = (a, b) => new THREE.Vector3(pos[b * 3] - pos[a * 3], pos[b * 3 + 1] - pos[a * 3 + 1], pos[b * 3 + 2] - pos[a * 3 + 2]);
  const a0 = jm * NP + iCentro;
  const prueba = geo(a0, jm * NP + ((iCentro + 1) % NP)).cross(geo(a0, (jm + 1) * NP + iCentro));
  const nPrueba = new THREE.Vector3(normales[a0 * 3], normales[a0 * 3 + 1], normales[a0 * 3 + 2]);
  const invertir = prueba.dot(nPrueba) < 0;

  // Separa la malla por (zona, subZona) conservando las normales suaves en los bordes
  // y guardando los datos base para el desplazamiento 3D en tiempo real de los patrones.
  const porPieza = new Map();
  for (let j = 0; j < NV - 1; j++) {
    for (let i = 0; i < NP; i++) {
      const z = zonaCuadro[j * NP + i];
      if (!z) continue;
      const sz = subZonaCuadro[j * NP + i] || "";
      const clave = sz ? `${z}|${sz}` : z;
      if (!porPieza.has(clave)) porPieza.set(clave, { zona: z, subZona: sz, cuadros: [] });
      porPieza.get(clave).cuadros.push(j * NP + i);
    }
  }

  const geometrias = new Map();
  for (const [clave, { zona: z, subZona: sz, cuadros }] of porPieza) {
    const mapa = new Map();
    const P = [];
    const Nn = [];
    const U = [];
    const Cc = [];
    const xmL = [];
    const ymL = [];
    const mascL = [];
    const aoL = [];
    const altLisoL = [];
    const aoLisoL = [];
    let tieneRelieveLiso = false;
    const idx = [];
    const vert = (g) => {
      let k = mapa.get(g);
      if (k !== undefined) return k;
      k = P.length / 3;
      mapa.set(g, k);
      P.push(pos[g * 3], pos[g * 3 + 1], pos[g * 3 + 2]);
      Nn.push(normales[g * 3], normales[g * 3 + 1], normales[g * 3 + 2]);
      U.push(uvs[g * 2], uvs[g * 2 + 1]);
      Cc.push(ao[g], ao[g], ao[g]);
      xmL.push(xmArr[g]);
      ymL.push(ymArr[g]);
      aoL.push(ao[g]);
      const m = sz === "escudo" || sz === "franja" || sz === "interior" ? 0 : smooth(1.8, 7.5, distCosturaMin[g]);
      mascL.push(m);
      if (def.relieveLiso && !sz) {
        const jRow = Math.floor(g / NP);
        const rl = def.relieveLiso(z, filas[jRow].uu, lateral[g], xmArr[g], ymArr[g], distCosturaMin[g]);
        if (rl && (Math.abs(rl.altura) > 1e-4 || rl.ao < 0.999)) tieneRelieveLiso = true;
        altLisoL.push(rl?.altura ?? 0);
        aoLisoL.push(rl?.ao ?? 1);
      } else {
        altLisoL.push(0);
        aoLisoL.push(1);
      }
      return k;
    };
    for (const q of cuadros) {
      const j = Math.floor(q / NP);
      const i = q % NP;
      const i1 = (i + 1) % NP;
      const a = vert(j * NP + i);
      const b = vert(j * NP + i1);
      const c = vert((j + 1) * NP + i1);
      const d = vert((j + 1) * NP + i);
      if (invertir) idx.push(a, d, b, b, d, c);
      else idx.push(a, b, d, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(Nn, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(Cc, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    g.userData.zona = z;
    g.userData.subZona = sz;
    g.userData.perforadoDeFabrica = !!(def.perforadoLiso && def.perforadoLiso(z, sz));
    g.userData.patronAplicado = tieneRelieveLiso ? "" : "liso";
    g.userData.base3D = {
      posBase: new Float32Array(P),
      normBase: new Float32Array(Nn),
      aoBase: new Float32Array(aoL),
      xm: new Float32Array(xmL),
      ym: new Float32Array(ymL),
      mascara: new Float32Array(mascL),
      tieneRelieveLiso,
      altLiso: new Float32Array(altLisoL),
      aoLiso: new Float32Array(aoLisoL),
    };
    geometrias.set(clave, g);
  }

  // Muestreo de la superficie final para pespuntes y ribetes.
  const punto = (j, i) => new THREE.Vector3(pos[(j * NP + i) * 3], pos[(j * NP + i) * 3 + 1], pos[(j * NP + i) * 3 + 2]);
  const normal = (j, i) => new THREE.Vector3(normales[(j * NP + i) * 3], normales[(j * NP + i) * 3 + 1], normales[(j * NP + i) * 3 + 2]);
  const sobreFila = (j, objetivo) => {
    const P = perimetro[j];
    let t = ((objetivo % P) + P) % P;
    let i = 0;
    while (i < NP - 1 && arcoFila[j * (NP + 1) + i + 1] < t) i++;
    const a0 = arcoFila[j * (NP + 1) + i];
    const a1 = arcoFila[j * (NP + 1) + i + 1];
    const w = a1 > a0 ? (t - a0) / (a1 - a0) : 0;
    const i1 = (i + 1) % NP;
    return { p: punto(j, i).lerp(punto(j, i1), w), n: normal(j, i).lerp(normal(j, i1), w).normalize() };
  };
  const sobreColumna = (i, objetivo) => {
    let j = 0;
    while (j < NV - 2 && arcoCol[(j + 1) * NP + i] < objetivo) j++;
    const a0 = arcoCol[j * NP + i];
    const a1 = arcoCol[(j + 1) * NP + i];
    const w = clamp(a1 > a0 ? (objetivo - a0) / (a1 - a0) : 0, 0, 1);
    return { p: punto(j, i).lerp(punto(j + 1, i), w), n: normal(j, i).lerp(normal(j + 1, i), w).normalize() };
  };

  const pespuntes = [];
  const ribetes = [];
  for (const c of costuras) {
    if (c.pespunte) {
      for (const lado of c.pespunte.lados) {
        const linea = [];
        let zona = c.pespunte.zona;
        if (c.tipo === "phi") {
          for (let j = c.j0; j <= c.j1; j++) {
            linea.push(sobreFila(j, arcoFila[j * (NP + 1) + c.ic] + lado * c.pespunte.separacion));
          }
          if (!zona) {
            const jm2 = Math.floor((c.j0 + c.j1) / 2);
            zona = lado > 0 ? zonaCuadro[jm2 * NP + c.ic] : zonaCuadro[jm2 * NP + ((c.ic - 1 + NP) % NP)];
          }
        } else {
          for (let i = c.i0; i <= c.i1; i++) linea.push(sobreColumna(i, arcoCol[c.jc * NP + i] + lado * c.pespunte.separacion));
          if (!zona) {
            const im = Math.floor((c.i0 + c.i1) / 2);
            zona = lado > 0 ? zonaCuadro[c.jc * NP + im] : zonaCuadro[(c.jc - 1) * NP + im];
          }
        }
        if (zona) pespuntes.push({ zona, linea, puntada: c.pespunte.puntada ?? 3.8 });
      }
    }
    if (c.ribete) {
      const linea = [];
      if (c.tipo === "phi") for (let j = c.j0; j <= c.j1; j++) linea.push({ p: punto(j, c.ic), n: normal(j, c.ic) });
      else for (let i = c.i0; i <= c.i1; i++) linea.push({ p: punto(c.jc, i), n: normal(c.jc, i) });
      ribetes.push(linea);
    }
  }

  // Pespuntes y ribetes sobre las costuras curvas arbitrarias.
  for (const cc of costurasCurvas) {
    const muestras = cc.puntos.map(([u, s]) => evalPuntoFront(pos, normales, u, s));
    if (cc.pespunte && muestras.length >= 2) {
      for (const lado of cc.pespunte.lados) {
        const linea = [];
        for (let k = 0; k < muestras.length; k++) {
          const prev = muestras[Math.max(0, k - 1)].p;
          const next = muestras[Math.min(muestras.length - 1, k + 1)].p;
          const tang = next.clone().sub(prev).normalize();
          const binorm = new THREE.Vector3().crossVectors(tang, muestras[k].n).normalize();
          linea.push({
            p: muestras[k].p.clone().addScaledVector(binorm, lado * cc.pespunte.separacion),
            n: muestras[k].n.clone(),
          });
        }
        pespuntes.push({ zona: cc.pespunte.zona ?? "top", linea, puntada: cc.pespunte.puntada ?? 3.8 });
      }
    }
    if (cc.ribete && muestras.length >= 2) {
      ribetes.push(muestras);
    }
  }

  return { geometrias, pespuntes, ribetes, filas, NP, NV, claveP, claveV, pos, normales, evalPuntoFront: (u, s) => evalPuntoFront(pos, normales, u, s) };
}

/**
 * Desplaza físicamente los vértices 3D de una geometría de zona según el patrón
 * elegido (6–10 mm de relieve real en `deportivo`, `diamante`, `chevron`, `ondas`,
 * `hexagonal`) y recalcula sus normales 3D y la oclusión ambiental en los surcos.
 */
export function aplicarRelieveGeometria(geo, patron) {
  const b = geo?.userData?.base3D;
  if (!b || geo.userData.patronAplicado === patron) return;
  geo.userData.patronAplicado = patron;

  const { posBase, normBase, aoBase, xm, ym, mascara, tieneRelieveLiso, altLiso, aoLiso } = b;
  const posAttr = geo.getAttribute("position");
  const normAttr = geo.getAttribute("normal");
  const colAttr = geo.getAttribute("color");
  const P = posAttr.array;
  const N = normAttr.array;
  const C = colAttr.array;
  const nVerts = xm.length;
  const esLiso = !patron || patron === "liso";

  for (let k = 0; k < nVerts; k++) {
    const o = k * 3;
    const m = mascara[k];
    if (esLiso && tieneRelieveLiso) {
      const desp = altLiso[k];
      P[o] = posBase[o] + normBase[o] * desp;
      P[o + 1] = posBase[o + 1] + normBase[o + 1] * desp;
      P[o + 2] = posBase[o + 2] + normBase[o + 2] * desp;
      const a = aoBase[k] * aoLiso[k];
      C[o] = a;
      C[o + 1] = a;
      C[o + 2] = a;
    } else if (m <= 1e-4 || esLiso) {
      P[o] = posBase[o];
      P[o + 1] = posBase[o + 1];
      P[o + 2] = posBase[o + 2];
      N[o] = normBase[o];
      N[o + 1] = normBase[o + 1];
      N[o + 2] = normBase[o + 2];
      const a = aoBase[k];
      C[o] = a;
      C[o + 1] = a;
      C[o + 2] = a;
    } else {
      const { altura, ao } = desplazamientoPatron(patron, xm[k], ym[k]);
      const desp = altura * m;
      P[o] = posBase[o] + normBase[o] * desp;
      P[o + 1] = posBase[o + 1] + normBase[o + 1] * desp;
      P[o + 2] = posBase[o + 2] + normBase[o + 2] * desp;
      const a = aoBase[k] * (1 - (1 - ao) * m);
      C[o] = a;
      C[o + 1] = a;
      C[o + 2] = a;
    }
  }
  posAttr.needsUpdate = true;
  colAttr.needsUpdate = true;

  if (!esLiso || tieneRelieveLiso) {
    geo.computeVertexNormals();
    if (!esLiso) {
      // En la costura (mascara -> 0) restauramos la normal base para continuidad perfecta en patrones
      for (let k = 0; k < nVerts; k++) {
        const m = mascara[k];
        if (m < 0.99) {
          const o = k * 3;
          const nx = lerp(normBase[o], N[o], m);
          const ny = lerp(normBase[o + 1], N[o + 1], m);
          const nz = lerp(normBase[o + 2], N[o + 2], m);
          const inv = 1 / (Math.hypot(nx, ny, nz) || 1);
          N[o] = nx * inv;
          N[o + 1] = ny * inv;
          N[o + 2] = nz * inv;
        }
      }
    }
  }
  normAttr.needsUpdate = true;
}

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function ruido2(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0);
  const b = hash2(x0 + 1, y0);
  const c = hash2(x0, y0 + 1);
  const d = hash2(x0 + 1, y0 + 1);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

function distancia(arr, a, b) {
  return Math.hypot(arr[b * 3] - arr[a * 3], arr[b * 3 + 1] - arr[a * 3 + 1], arr[b * 3 + 2] - arr[a * 3 + 2]);
}

function normalesDeMalla(p, NV, NP, filas, frenteRef) {
  const out = new Float32Array(NV * NP * 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const get = (j, i, v) => v.set(p[(j * NP + i) * 3], p[(j * NP + i) * 3 + 1], p[(j * NP + i) * 3 + 2]);
  for (let j = 0; j < NV; j++) {
    const jp = Math.min(NV - 1, j + 1);
    const jm = Math.max(0, j - 1);
    for (let i = 0; i < NP; i++) {
      const ip = (i + 1) % NP;
      const im = (i - 1 + NP) % NP;
      get(j, ip, a).sub(get(j, im, b));
      get(jp, i, b).sub(get(jm, i, c));
      c.crossVectors(a, b);
      const len = c.length();
      if (len > 1e-9) c.divideScalar(len);
      const o = (j * NP + i) * 3;
      out[o] = c.x;
      out[o + 1] = c.y;
      out[o + 2] = c.z;
    }
  }
  const jMedio = Math.floor(NV / 2);
  let suma = 0;
  for (let i = 0; i < NP; i++) {
    const o = (jMedio * NP + i) * 3;
    const centro = filas[jMedio].marco.N;
    const sinPhi = Math.sin(filas[jMedio].angulos[i]);
    suma += Math.sign(sinPhi) * (out[o] * centro.x + out[o + 1] * centro.y + out[o + 2] * centro.z);
  }
  if (suma < 0) for (let k = 0; k < out.length; k++) out[k] = -out[k];
  for (const j of [0, NV - 1]) {
    if (!filas[j].region) continue;
    const vecina = j === 0 ? 1 : NV - 2;
    const N = filas[j].marco.N;
    for (let i = 0; i < NP; i++) {
      const o = (vecina * NP + i) * 3;
      c.set(out[o], out[o + 1], out[o + 2]);
      c.addScaledVector(N, -c.dot(N));
      if (c.lengthSq() < 1e-8) c.copy(filas[j].marco.T).multiplyScalar(j === 0 ? -1 : 1);
      c.normalize();
      const q = (j * NP + i) * 3;
      out[q] = c.x;
      out[q + 1] = c.y;
      out[q + 2] = c.z;
    }
  }
  void frenteRef;
  return out;
}

// Pespunte 3D real: puntadas cilíndricas redondeadas con relieve visible tono sobre tono.
const geoPuntada = (() => {
  // Puntada liviana (6 lados, 2 anillos por tapa): son miles de instancias de menos de 3 mm.
  const g = new THREE.CapsuleGeometry(0.56, 1.45, 2, 6);
  g.rotateZ(Math.PI / 2);
  g.rotateY(0.11); // Inclinación característica de máquina de doble arrastre
  return g;
})();

export function crearPespuntes(lineas, material) {
  const matrices = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const esc = new THREE.Vector3();
  const xA = new THREE.Vector3();
  const yA = new THREE.Vector3();
  const zA = new THREE.Vector3();
  const base = new THREE.Matrix4();
  for (const { linea, puntada } of lineas) {
    if (linea.length < 2) continue;
    const largos = [0];
    for (let k = 1; k < linea.length; k++) largos.push(largos[k - 1] + linea[k].p.distanceTo(linea[k - 1].p));
    const total = largos[largos.length - 1];
    const cuenta = Math.floor(total / puntada);
    let k = 0;
    for (let s = 0; s < cuenta; s++) {
      const t = (s + 0.5) * puntada;
      while (k < linea.length - 2 && largos[k + 1] < t) k++;
      const w = (t - largos[k]) / Math.max(1e-6, largos[k + 1] - largos[k]);
      const p = linea[k].p.clone().lerp(linea[k + 1].p, w);
      zA.copy(linea[k].n).lerp(linea[k + 1].n, w).normalize();
      xA.copy(linea[k + 1].p).sub(linea[k].p);
      xA.addScaledVector(zA, -xA.dot(zA)).normalize();
      yA.crossVectors(zA, xA);
      base.makeBasis(xA, yA, zA);
      q.setFromRotationMatrix(base);
      p.addScaledVector(zA, 0.34);
      esc.set((puntada * 0.68) / 2.3, 1.05, 0.84);
      m.compose(p, q, esc);
      matrices.push(m.clone());
    }
  }
  const malla = new THREE.InstancedMesh(geoPuntada, material, Math.max(1, matrices.length));
  matrices.forEach((mm, i) => malla.setMatrixAt(i, mm));
  malla.count = matrices.length;
  malla.instanceMatrix.needsUpdate = true;
  malla.computeBoundingSphere();
  return malla;
}

// Ribete (vivo) redondo que sobresale del canal de la costura con volumen real.
export function crearRibete(linea, radio, material) {
  const puntos = linea.map(({ p, n }) => p.clone().addScaledVector(n, radio * 0.52));
  const curvaR = new THREE.CatmullRomCurve3(puntos, false, "centripetal");
  const segmentos = Math.max(24, Math.round(curvaR.getLength() / 2.5));
  const malla = new THREE.Mesh(new THREE.TubeGeometry(curvaR, segmentos, radio, 12, false), material);
  return malla;
}
