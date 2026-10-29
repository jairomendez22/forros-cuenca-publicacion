// Cálculo puro de texturas del cuero (sin Three.js ni DOM): se usa en el hilo
// principal y en el Web Worker de texturas-worker.js.
const potencia2 = (n) => 2 ** Math.round(Math.log2(Math.max(64, n)));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const fraccion = (x) => x - Math.floor(x);
const aEntero = (x) => Math.abs(x - Math.round(x));

function aleatorio(semilla) {
  let s = semilla >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

// Grano celular periódico (Worley F2 - F1): celdas de 1,2 a 1,8 mm con surcos suaves.
export function grano(w, h, cx, cy, semilla) {
  const rnd = aleatorio(semilla);
  const px = new Float32Array(cx * cy);
  const py = new Float32Array(cx * cy);
  for (let k = 0; k < cx * cy; k++) {
    px[k] = 0.14 + 0.72 * rnd();
    py[k] = 0.14 + 0.72 * rnd();
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const gy = ((y + 0.5) / h) * cy;
    const iy = Math.floor(gy);
    for (let x = 0; x < w; x++) {
      const gx = ((x + 0.5) / w) * cx;
      const ix = Math.floor(gx);
      let d1 = 9;
      let d2 = 9;
      for (let oy = -1; oy <= 1; oy++) {
        const cyy = iy + oy;
        const wy = ((cyy % cy) + cy) % cy;
        for (let ox = -1; ox <= 1; ox++) {
          const cxx = ix + ox;
          const wx = ((cxx % cx) + cx) % cx;
          const k = wy * cx + wx;
          const dx = cxx + px[k] - gx;
          const dy = cyy + py[k] - gy;
          const d = dx * dx + dy * dy;
          if (d < d1) {
            d2 = d1;
            d1 = d;
          } else if (d < d2) d2 = d;
        }
      }
      const surco = Math.pow(Math.min(1, (Math.sqrt(d2) - Math.sqrt(d1)) / 0.26), 0.52);
      const domo = 1 - Math.min(1, d1 * 1.05);
      out[y * w + x] = surco * (0.76 + 0.24 * domo);
    }
  }
  return out;
}

export function ruido(w, h, cx, cy, semilla) {
  const rnd = aleatorio(semilla);
  const red = new Float32Array(cx * cy);
  for (let k = 0; k < red.length; k++) red[k] = rnd();
  const out = new Float32Array(w * h);
  const s = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < h; y++) {
    const gy = (y / h) * cy;
    const y0 = Math.floor(gy);
    const fy = s(gy - y0);
    for (let x = 0; x < w; x++) {
      const gx = (x / w) * cx;
      const x0 = Math.floor(gx);
      const fx = s(gx - x0);
      const a = red[(y0 % cy) * cx + (x0 % cx)];
      const b = red[(y0 % cy) * cx + ((x0 + 1) % cx)];
      const c = red[((y0 + 1) % cy) * cx + (x0 % cx)];
      const d = red[((y0 + 1) % cy) * cx + ((x0 + 1) % cx)];
      out[y * w + x] = (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
    }
  }
  return out;
}

function distSeg(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const l2 = vx * vx + vy * vy || 1e-6;
  const u = clamp(((px - ax) * vx + (py - ay) * vy) / l2, 0, 1);
  const dx = px - (ax + u * vx);
  const dy = py - (ay + u * vy);
  return { d: Math.hypot(dx, dy), t: u * Math.sqrt(l2) };
}

// Geometría real de los patrones del catálogo (fotos 06, 08, 10, 15, 20 y 25)
// y profundidades de canal de taller (deep-research-asientos.md sección 4).
const PATRONES = {
  // Patrón deportivo real del catálogo (fotos 25 Soluto, 08 D-Max, 10 Hilux):
  // V anidadas abiertas (con punta recta hacia arriba en el centro, 0..34 mm) que
  // cruzan todo el ancho del panel oscuro y se repiten en el cojín, con paso de 74 mm.
  deportivo: {
    w: 260,
    h: 74,
    inflado: 2.4,
    relieve3D: 2.35,
    anchoSurco: 1.5,
    profSurco: 2.05,
    relieveNormal: 1.05,
    desfaseU: 0.5,
    f(x, y) {
      const ax = Math.abs(x - 130);
      const H = 74;
      let mejorD = 999;
      let mejorT = 0;

      const filaBase = Math.floor(y / H);
      for (let r = filaBase - 1; r <= filaBase + 2; r++) {
        const y0 = r * H;
        // 1. Punta recta central hacia arriba (ax: 0 -> 34 mm) en y = y0 + 54
        const s1 = distSeg(ax, y, 0, y0 + 54, 34, y0 + 54);
        if (s1.d < mejorD) {
          mejorD = s1.d;
          mejorT = s1.t;
        }
        // 2. Brazo diagonal descendente de la V anidada (ax: 34 -> 86 mm, baja de y0 + 54 a y0 + 14)
        const s2 = distSeg(ax, y, 34, y0 + 54, 86, y0 + 14);
        if (s2.d < mejorD) {
          mejorD = s2.d;
          mejorT = 34 + s2.t;
        }
        // 3. Prolongación lateral abierta que cruza hasta la costura del bolster (ax: 86 -> 142 mm)
        const s3 = distSeg(ax, y, 86, y0 + 14, 142, y0 + 40);
        if (s3.d < mejorD) {
          mejorD = s3.d;
          mejorT = 100 + s3.t;
        }
      }
      // Panel suave en todo el ancho con caída nítida en los 2,5 mm inmediatos a la costura en V
      const domo = 1 - Math.exp(-((mejorD / 2.6) ** 2));
      return { d: mejorD, t: mejorT, domo };
    },
  },

  // Rombos acolchados (foto 20 del catálogo): canal de 4,2 mm en campana suave,
  // almohadilla abombada sin aristas piramidales internas.
  diamante: {
    w: 62,
    h: 46,
    inflado: 5.2,
    relieve3D: 3.4,
    anchoSurco: 1.8,
    profSurco: 1.7,
    relieveNormal: 1.15,
    f(x, y) {
      const rx = 31;
      const ry = 23;
      const k = 1 / Math.hypot(1 / rx, 1 / ry);
      const u1 = (x / rx + y / ry - 1) / 2;
      const u2 = (x / rx - y / ry - 1) / 2;
      const f1 = aEntero(u1);
      const f2 = aEntero(u2);
      const d1 = f1 * 2 * k;
      const d2 = f2 * 2 * k;
      const d = Math.min(d1, d2);
      const t = d1 < d2 ? (x / rx - y / ry) * k : (x / rx + y / ry) * k;
      const s1 = Math.sin(Math.PI * clamp(f1 * 2, 0, 1));
      const s2 = Math.sin(Math.PI * clamp(f2 * 2, 0, 1));
      const domo = Math.pow(s1 * s2, 0.44);
      return { d, t, domo: clamp(domo, 0, 1) };
    },
  },

  // Chevron en V con espina central (fotos 06 y 15 del catálogo):
  // Paso amplio de 78 mm, V angular con tramo central casi recto y surco fino de 2..3 mm.
  chevron: {
    w: 260,
    h: 78,
    inflado: 2.2,
    relieve3D: 1.85,
    anchoSurco: 1.35,
    profSurco: 1.65,
    relieveNormal: 0.72,
    desfaseU: 0.5,
    f(x, y) {
      const ax = Math.abs(x - 130);
      const H = 78;
      let mejorD = Math.abs(ax - 1.4); // Doble pespunte vertical central (foto 15)
      let mejorT = y;

      const filaBase = Math.floor(y / H);
      for (let r = filaBase - 1; r <= filaBase + 2; r++) {
        const y0 = r * H;
        // Tramo interior casi plano con ligera caída hacia el centro (ax: 0 -> 46 mm)
        const s1 = distSeg(ax, y, 0, y0 + 18, 46, y0 + 24);
        if (s1.d < mejorD) {
          mejorD = s1.d;
          mejorT = s1.t;
        }
        // Brazo exterior ascendente del chevron (ax: 46 -> 126 mm)
        const s2 = distSeg(ax, y, 46, y0 + 24, 126, y0 + 64);
        if (s2.d < mejorD) {
          mejorD = s2.d;
          mejorT = 46 + s2.t;
        }
      }
      const domo = 1 - Math.exp(-((mejorD / 2.2) ** 2));
      return { d: mejorD, t: mejorT, domo };
    },
  },

  ondas: {
    w: 92,
    h: 40,
    inflado: 5.8,
    relieve3D: 4.2,
    f(x, y) {
      const fase = (2 * Math.PI * x) / 92;
      const g = (y - 20 - 7.5 * Math.sin(fase)) / 40;
      const fg = aEntero(g);
      const pendiente = ((7.5 * 2 * Math.PI) / 92) * Math.cos(fase);
      const d = (fg * 40) / Math.hypot(1, pendiente);
      const domo = 1 - Math.exp(-((d / 4.6) ** 1.8));
      return { d, t: x, domo };
    },
  },

  hexagonal: {
    w: 56,
    h: 32.3316,
    inflado: 5.8,
    relieve3D: 4.2,
    f(x, y) {
      const R = 18.6667;
      const ap = (Math.sqrt(3) / 2) * R;
      let mejor = null;
      const i0 = Math.round(x / (1.5 * R));
      for (let i = i0 - 1; i <= i0 + 1; i++) {
        const desf = ((i % 2) + 2) % 2 ? 0.5 : 0;
        const j0 = Math.round(y / (2 * ap) - desf);
        for (let j = j0 - 1; j <= j0 + 1; j++) {
          const cx = 1.5 * R * i;
          const cy = 2 * ap * (j + desf);
          const d2 = (x - cx) ** 2 + (y - cy) ** 2;
          if (!mejor || d2 < mejor.d2) mejor = { d2, cx, cy };
        }
      }
      const qx = x - mejor.cx;
      const qy = y - mejor.cy;
      let m = 0;
      for (const a of [Math.PI / 6, Math.PI / 2, (5 * Math.PI) / 6]) {
        m = Math.max(m, Math.abs(qx * Math.cos(a) + qy * Math.sin(a)));
      }
      const d = Math.max(0, ap - m);
      const domo = 1 - Math.exp(-((d / 4.4) ** 1.8));
      return { d, t: Math.atan2(qy, qx) * R, domo };
    },
  },
};

// Microperforado real del FC-20: orificios densos con bisel suave (mosaico escalonado de 9,0 x 9,0 mm)
const PERFORADO = { w: 9.0, h: 9.0 };  // paso ≈ 6,4 mm entre orificios (el FC-20 los muestra pequeños y espaciados)
function distanciaHueco(x, y) {
  let d = 99;
  const W = PERFORADO.w;
  const H = PERFORADO.h;
  for (const [cx, cy] of [
    [0, 0],
    [W, 0],
    [0, H],
    [W, H],
    [W * 0.5, H * 0.5],
  ]) {
    d = Math.min(d, Math.hypot(x - cx, y - cy));
  }
  return d;
}

export function desplazamientoPatron(patron, xm, ym) {
  const p = PATRONES[patron];
  if (p) {
    const xTex = (((xm + (p.desfaseU ?? 0) * p.w) % p.w) + p.w) % p.w;
    const yTex = ((ym % p.h) + p.h) % p.h;
    const { d, domo } = p.f(xTex, yTex);
    const wSurco = p.anchoSurco ?? 1.5;
    const pSurco = p.profSurco ?? 1.65;
    const surco = Math.exp(-((d / wSurco) ** 2));
    const altura = domo * p.relieve3D - surco * pSurco;
    const ao = 1 - 0.52 * Math.exp(-((d / (wSurco * 1.45)) ** 2));
    return { altura, ao };
  }
  return { altura: 0, ao: 1 };
}

export function normalDesdeAltura(alt, w, h, mmPorPxX, mmPorPxY) {
  const datos = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const ya = ((y - 1 + h) % h) * w;
    const yb = ((y + 1) % h) * w;
    for (let x = 0; x < w; x++) {
      const xa = (x - 1 + w) % w;
      const xb = (x + 1) % w;
      const dx = (alt[y * w + xb] - alt[y * w + xa]) / (2 * mmPorPxX);
      const dy = (alt[yb + x] - alt[ya + x]) / (2 * mmPorPxY);
      const nx = -dx;
      const ny = -dy;
      const inv = 1 / Math.hypot(nx, ny, 1);
      const o = (y * w + x) * 4;
      datos[o] = (nx * inv * 0.5 + 0.5) * 255;
      datos[o + 1] = (ny * inv * 0.5 + 0.5) * 255;
      datos[o + 2] = (inv * 0.5 + 0.5) * 255;
      datos[o + 3] = 255;
    }
  }
  return datos;
}

// Valores PBR de grano (satinado mate tipo FC-20, mapa normalizado 0,90..0,99 para no reducir material.roughness):
const CUEROS = {
  americano: { celda: 1.35, relieve: 0.035, micro: 0.008, manchas: 0.012, rugBase: 0.90, rugSurco: 0.99 },
  colombiano: { celda: 1.7, relieve: 0.05, micro: 0.012, manchas: 0.02, rugBase: 0.92, rugSurco: 1.00 },
};

// Calcula los mapas de un patrón (normal, sombra, rugosidad e hilo) como datos
// crudos. Es puro: corre igual en el hilo principal o en un Web Worker.
export function calcularPatron(patron, cuero) {
  const c = CUEROS[cuero] ?? CUEROS.americano;
  const p = PATRONES[patron];
  const mosaico = p ?? (patron === "perforado" ? PERFORADO : { w: 44, h: 44 });
  const pxmm = patron === "perforado" ? 28 : p ? (mosaico.w > 120 ? 4.0 : 8.0) : 12;
  const w = Math.min(1024, potencia2(mosaico.w * pxmm));
  const h = Math.min(1024, potencia2(mosaico.h * pxmm));
  const mx = mosaico.w / w;
  const my = mosaico.h / h;

  const semilla = cuero === "colombiano" ? 71 : 23;
  const g1 = grano(w, h, Math.max(4, Math.round(mosaico.w / c.celda)), Math.max(4, Math.round(mosaico.h / c.celda)), semilla);
  const g2 = grano(w, h, Math.max(8, Math.round((mosaico.w / c.celda) * 2.2)), Math.max(8, Math.round((mosaico.h / c.celda) * 2.2)), semilla + 19);
  const r = ruido(w, h, Math.max(2, Math.round(mosaico.w / 11)), Math.max(2, Math.round(mosaico.h / 11)), semilla + 5);

  const alt = new Float32Array(w * h);
  const sombra = new Uint8Array(w * h * 4);
  const rugosidad = new Uint8Array(w * h * 4);
  const hilo = p ? new Uint8Array(w * h * 4) : null;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      const xm = (x + 0.5) * mx;
      const ym = (y + 0.5) * my;
      const pepita = g1[k] * 0.76 + g2[k] * 0.24;
      let a = pepita * c.relieve + (r[k] - 0.5) * c.micro;
      let s = 0.88 - c.manchas * (r[k] - 0.5) * 2 - (1 - pepita) * 0.04;
      let rug = c.rugBase + (1 - pepita) * (c.rugSurco - c.rugBase);

      if (p) {
        const { d, t, domo } = p.f(xm, ym);
        const wSurco = p.anchoSurco ?? 1.4;
        const rNormal = p.relieveNormal ?? 0.85;
        const surco = Math.exp(-((d / wSurco) ** 2));
        // Micro-ondulación de puntada (seam puckering cada 4,2 mm, amplitud 0,10 mm)
        const puckering = 0.09 * Math.exp(-((d / (wSurco * 2.0)) ** 2)) * Math.sin((t / 4.2) * Math.PI * 2);
        a += domo * rNormal - 1.05 * surco + puckering;
        // La meseta conserva el tono del cuero; el surco fino (2..3 mm) se marca con claridad
        s *= 1 - 0.52 * Math.exp(-((d / (wSurco * 1.45)) ** 2));
        rug = clamp(rug + 0.12 * surco, 0.75, 1.0);

        const enHilo = Math.max(0, 1 - Math.abs(d) / 0.65);
        const tramo = fraccion(t / 4.2);
        const puntada = Math.min(1, Math.max(0, (0.76 - Math.abs(tramo - 0.42) * 2) * 5.5));
        const vH = Math.round(255 * Math.min(1, enHilo * 1.75) * puntada);
        hilo[k * 4] = vH;
        hilo[k * 4 + 1] = vH;
        hilo[k * 4 + 2] = vH;
        hilo[k * 4 + 3] = 255;
      } else if (patron === "perforado") {
        const d = distanciaHueco(xm, ym);
        // Orificio oscuro nítido con anillo de bisel suave visible a distancia de catálogo (FC-20 / FC-16)
        const hueco = 1 - Math.min(1, Math.max(0, (d - 0.56) / 0.20));
        const biselHueco = Math.exp(-((d / 1.0) ** 2));
        const anilloBisel = Math.exp(-(((d - 0.9) / 0.3) ** 2));
        a -= hueco * 0.9 + 0.22 * biselHueco;
        s = (s + 0.12 * anilloBisel) * (1 - hueco * 0.94);
        rug = clamp(rug + hueco * 0.12, 0.82, 1.0);
      }
      alt[k] = a;
      const vS = Math.round(255 * clamp(s, 0, 1));
      sombra[k * 4] = vS;
      sombra[k * 4 + 1] = vS;
      sombra[k * 4 + 2] = vS;
      sombra[k * 4 + 3] = 255;

      const vR = Math.round(255 * clamp(rug, 0, 1));
      rugosidad[k * 4] = vR;
      rugosidad[k * 4 + 1] = vR;
      rugosidad[k * 4 + 2] = vR;
      rugosidad[k * 4 + 3] = 255;
    }
  }

  return {
    patron, cuero, w, h,
    normal: normalDesdeAltura(alt, w, h, mx, my), sombra, rugosidad, hilo,
    repX: 100 / mosaico.w, repY: 100 / mosaico.h, offU: mosaico.desfaseU ?? p?.desfaseU ?? 0,
  };
}
