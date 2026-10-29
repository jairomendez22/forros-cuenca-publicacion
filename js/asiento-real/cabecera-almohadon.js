// Cabecera "almohada" del Kia Soluto (FC-20): frente abombado, contorno medido en la silueta del catálogo
// (cima en arco continuo, lados algo abombados, esquinas inferiores redondas), centro perforado (headCenter)
// que llega casi al canto, banda y pared laterales (head) y cara trasera convexa (head interior).
// Marco local: x lateral, v hacia arriba desde la base, w hacia el frente. Medidas en mm.
import { curva } from "./superficie.js";
import { caida, crearAlmohadonCerrado, suave } from "./almohadon-cerrado.js?v=2";

export function crearCabeceraAlmohadon(opc) {
  const P = {
    escala: 1,
    alto: 185, // alto del contorno (de la base a la cima)
    banda: 10, // de la costura del centro al canto (visto de frente)
    Df: 46,
    Db: 44,
    domo: 15, // abombado del frente (mm)
    Rt: 28,
    Rb: 28,
    bulto: 4,
    doblePespunte: false,
    ...opc,
  };
  const vT = P.alto;
  const factorAncho = typeof P.ancho === "function" ? P.ancho : () => P.escala;
  // Medio ancho del contorno según s = √(distancia a la cima) (silueta del FC-20 menos el abombado de la pared)
  const lado = curva([
    [0, 16],
    [1.41, 42],
    [2.24, 57],
    [3.32, 72],
    [4.69, 87],
    [6.63, 101],
    [8.12, 110],
    [9.38, 115],
    [10.44, 118],
    [11.45, 119],
    [12.37, 117],
    [12.96, 114],
  ]);
  const rI = 32;
  const hwO = (v) => {
    const u = Math.min(1, Math.max(0, v / vT));
    const esc = factorAncho(u);
    if (v < rI) return (114 - rI + Math.sqrt(Math.max(0, rI * rI - (rI - v) ** 2))) * esc;
    return lado(Math.sqrt(Math.max(0, 185 * (1 - u)))) * esc;
  };
  // Mitad derecha del contorno (de abajo hacia la cima) y su desplazamiento hacia adentro = borde del centro
  const contorno = [];
  for (let k = 0; k <= 10; k++) {
    const a = -Math.PI / 2 + (k / 10) * (Math.PI / 2);
    const v = rI + rI * Math.sin(a);
    const esc = factorAncho(Math.min(1, Math.max(0, v / vT)));
    contorno.push([(114 - rI) * esc + rI * Math.cos(a), v]);
  }
  for (let k = 1; k <= 48; k++) {
    const s = Math.sqrt(vT - rI) * (1 - k / 48);
    const v = vT - s * s;
    contorno.push([hwO(v), v]);
  }
  const borde = [];
  for (let k = 0; k < contorno.length; k++) {
    const a = k > 0 ? contorno[k - 1] : [contorno[0][0] - 10, contorno[0][1]];
    const b = k < contorno.length - 1 ? contorno[k + 1] : [0, contorno[k][1]];
    const tx = b[0] - a[0];
    const tv = b[1] - a[1];
    const l = Math.hypot(tx, tv) || 1;
    borde.push([contorno[k][0] - (P.banda * tv) / l, contorno[k][1] + (P.banda * tx) / l]);
  }
  const v0 = P.banda;
  const v1 = vT - P.banda;
  const hwDe = (v) => {
    if (v <= borde[0][1]) return borde[0][0];
    for (let k = 1; k < borde.length; k++) {
      if (v <= borde[k][1]) {
        const t = (v - borde[k - 1][1]) / (borde[k][1] - borde[k - 1][1] || 1);
        return borde[k - 1][0] + t * (borde[k][0] - borde[k - 1][0]);
      }
    }
    return borde[borde.length - 1][0];
  };

  const vm = 0.5 * (v0 + v1);
  const domo = (x, v) => {
    const ex = Math.min(1, Math.abs(x) / (119 * P.escala + 20));
    const ev = Math.min(1, Math.abs(v - vm) / (0.5 * (v1 - v0) + 30));
    return (1 - ex * ex) * (1 - ev * ev);
  };
  const frente = (x, v, c) => {
    const dp = c.dp;
    // Domo de almohada (sin crestas) y caída circular del canto, que empieza dentro del centro perforado
    let w = P.Df + P.domo * domo(x, v);
    w -= caida(c.d, P.Rt);
    const g = Math.exp(-((dp / 2.0) ** 2));
    w -= 1.8 * g;
    const ao = (1 - 0.4 * g) * (0.84 + 0.16 * suave(-5, 40, v)) * (0.86 + 0.14 * suave(0, P.Rt, c.d));
    return { w, ao, ds: Math.abs(dp) };
  };
  const trasera = (x, v, c) => {
    const w = -(P.Db + 0.7 * P.domo * domo(x, v)) + caida(c.d, P.Rb);
    return { w, ao: 0.72 + 0.12 * suave(0, 60, v) };
  };
  return crearAlmohadonCerrado({
    marco: opc.marco,
    panel: { hw: 119 * P.escala, v0, v1, rcS: 50, rcI: 16, hwDe },
    banda: P.banda,
    paso: 5,
    grupos: [],
    NC: 44,
    NQ: 8,
    NQt: 8,
    nW: 7,
    bulto: P.bulto,
    aoPared: [0.86, 0.72],
    frente,
    trasera,
    zonaPanel: () => ({ zona: "headCenter", sub: "" }),
    zonaAnillo: () => ({ zona: "head", sub: "" }),
    zonaPared: { zona: "head", sub: "" },
    zonaFondo: { zona: "head", sub: "interior" },
    perforado: P.perforado ?? ((zona, sub) => zona === "headCenter" && !sub),
    pespuntes: (api) => {
      const offs = P.doblePespunte ? [2.4, 5.2] : [2.6];
      const out = [];
      for (const off of offs) out.push(...api.lineaAnillo(() => off, () => true, "head", 3.6));
      return out;
    },
  });
}
