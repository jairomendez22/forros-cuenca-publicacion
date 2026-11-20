// «Un estilo para cada vehículo»: muro de fotos que se recorre con el scroll (pedido de Jairo, 19-nov-2026).
// Versión 2: solo las fotos, en formas distintas (vertical, cuadrada, apaisada) y en filas de distinto alto; sin textos.
// La cámara la mueve el scroll, como ScrollTrigger con «scrub»: la escena queda fija mientras se baja y el recorrido
// avanza o retrocede con la rueda o el dedo. Los movimientos son los de la plantilla «ATHER» de @ux_rahul:
// de cerca en una foto → se aleja y aparece el muro → baja unas filas → se desliza de lado → se acerca a otra foto.
// Todo se dibuja en un lienzo 2D; cada foto se toma de la versión de 600 o de 1200 px según su tamaño en pantalla.
import { ASIENTOS } from "./galeria-esfera-datos.js";

// ---------- El muro: 9 filas de distinto alto; en cada fila, fotos de distintas formas ----------
const G = 5; // separación entre fotos (como en la referencia, ~5 % del alto)
const ALTURAS = [138, 92, 118, 78, 132, 100, 84, 124, 106]; // dos filas vecinas nunca miden lo mismo
const FORMAS = [0.75, 0.75, 0.75, 1, 1, 1.25, 1.5, 1.8]; // ancho / alto; vertical como la foto del asiento, la más común
const LARGO_FILA = 1500; // cada fila se repite cada ~1500 unidades (más de dos pantallas a lo ancho)
const FILAS = ALTURAS.length;
const ALTO = ALTURAS.reduce((a, h) => a + h + G, 0);
const H_REF = 100; // alto «típico» de una fila: con él se miden la vista amplia y los desplazamientos
const TOTAL = ASIENTOS.length;
const ANCHOS = new Set([37]); // FC-38 es una banca trasera: solo va en fotos cuadradas o apaisadas (si no, se corta)
const HEROE = 6; // FC-07 (rojo integral): la foto con la que abre el recorrido

const rutaFoto =
  window.MURO_RUTA || ((n, lado) => `./assets/galeria/fc-${String(n + 1).padStart(2, "0")}-${lado}.webp`);
const mod = (a, b) => ((a % b) + b) % b;
const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
const suave = (t) => t * t * (3 - 2 * t);

function semilla(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function armarMuro() {
  const azar = semilla(20261119);
  const usos = new Array(TOTAL).fill(0);
  const filas = [];
  let y = 0;
  for (let r = 0; r < FILAS; r++) {
    const h = ALTURAS[r];
    const fotos = [];
    let x = 0;
    let antes = 0;
    while (x < LARGO_FILA) {
      let f;
      do f = FORMAS[Math.floor(azar() * FORMAS.length)];
      while (f === antes && f !== 0.75);
      antes = f;
      const w = Math.round(h * f);
      fotos.push({ x, w, f, n: -1 });
      x += w + G;
    }
    filas.push({ h, y, P: x, off: azar() * x, fotos });
    y += h + G;
  }
  // Diseños: en cada fila no se repiten, y tampoco con la fila de arriba ni la de abajo (así nunca quedan dos fotos
  // iguales pegadas). Se elige el menos usado hasta ese momento, para que los 58 salgan parejo.
  const enFila = (r) => new Set(filas[mod(r, FILAS)].fotos.map((t) => t.n).filter((n) => n >= 0));
  const heroe = { r: 0, i: filas[0].fotos.findIndex((t) => t.f === 0.75) };
  filas[0].fotos[heroe.i].n = HEROE;
  usos[HEROE]++;
  for (let r = 0; r < FILAS; r++) {
    const prohibidos = new Set([...enFila(r - 1), ...enFila(r + 1), ...enFila(r)]);
    for (const t of filas[r].fotos) {
      if (t.n >= 0) continue;
      let mejor = -1;
      let menos = Infinity;
      const inicio = Math.floor(azar() * TOTAL);
      for (let k = 0; k < TOTAL; k++) {
        const n = (inicio + k) % TOTAL;
        if (prohibidos.has(n) || (ANCHOS.has(n) && t.f < 1)) continue;
        if (usos[n] < menos) {
          menos = usos[n];
          mejor = n;
        }
      }
      t.n = mejor;
      usos[mejor]++;
      prohibidos.add(mejor);
    }
  }
  return { filas, heroe };
}

// ---------- Resorte crítico (solución exacta: estable con cualquier paso de tiempo) ----------
function resorte(c, tau, dt) {
  if (tau <= 0) {
    c.v = c.t;
    c.u = 0;
    return;
  }
  const w = 1 / tau;
  const x0 = c.v - c.t;
  const b = c.u + w * x0;
  const e = Math.exp(-w * dt);
  c.v = c.t + (x0 + b * dt) * e;
  c.u = (c.u - w * b * dt) * e;
}
const quieto = (c) => Math.abs(c.v - c.t) < 1e-4 && Math.abs(c.u) < 1e-4;

// ---------- Inicio ----------
function iniciarMuro(raiz) {
  const escena = raiz.querySelector(".gm-escena");
  const lienzo = raiz.querySelector("canvas");
  const ctx = lienzo.getContext("2d");
  const sinMovimiento = matchMedia("(prefers-reduced-motion: reduce)");
  const conMouse = matchMedia("(hover: hover) and (pointer: fine)");
  const { filas, heroe } = armarMuro();

  const lista = raiz.querySelector(".gm-lista");
  if (lista) lista.replaceChildren(...ASIENTOS.map(([c, n]) => Object.assign(document.createElement("li"), { textContent: `${c}: ${n}` })));

  // ----- Fotos -----
  const fotos = ASIENTOS.map(() => ({ chica: { lado: 600 }, grande: { lado: 1200 } }));
  const grandesListas = [];
  // La primera vez que se dibuja una foto, el navegador la sube a la tarjeta gráfica (varios ms). Para que no caigan
  // muchas en el mismo cuadro (tirón), cada cuadro «estrena» a lo sumo 1 grande y 3 chicas; mientras tanto se ve la
  // versión que ya estaba (ver conocimiento/gotchas/2026-11-19-canvas-muchas-fotos-nuevas-en-un-cuadro-da-tiron.md).
  let estrenosGrandes = 0;
  let estrenosChicas = 0;
  let seguir = false;
  function cargar(n, cual) {
    const f = fotos[n][cual];
    if (f.el) return;
    const img = new Image();
    img.decoding = "async";
    img.src = rutaFoto(n, f.lado);
    f.el = img;
    img
      .decode()
      .then(() => {
        if (f.el !== img) return;
        f.lista = true;
        if (cual === "grande") {
          grandesListas.push(n);
          while (grandesListas.length > 24) {
            const vieja = fotos[grandesListas.shift()].grande;
            vieja.el = null;
            vieja.lista = false;
            vieja.usada = false;
          }
        }
        despertar();
      })
      .catch(() => {
        if (f.el === img) f.el = null;
      });
  }
  let chicasPedidas = false;
  function pedirChicas() {
    if (chicasPedidas) return;
    chicasPedidas = true;
    for (let n = 0; n < TOTAL; n++) cargar((HEROE + n) % TOTAL, "chica");
  }

  // ----- Tamaños -----
  let vw = 1;
  let vh = 1;
  let dpr = 1;
  let sLejos = 1; // px de pantalla por unidad, vista amplia
  const cerca = (t) => {
    // De cerca: la foto ocupa ~74 % del alto (o 86 % del ancho), sin pasar de la resolución de la foto grande.
    const s = Math.min((0.74 * vh) / t.h, (0.86 * vw) / t.w, 1150 / (t.h * dpr));
    return Math.max(s, sLejos * 1.6);
  };
  function medir() {
    const r = escena.getBoundingClientRect();
    vw = Math.max(1, r.width);
    vh = Math.max(1, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    lienzo.width = Math.round(vw * dpr);
    lienzo.height = Math.round(vh * dpr);
    // Lejos: una fila típica mide el 21 % del alto (se ven ~5 filas); en celular, ~3 fotos verticales a lo ancho.
    sLejos = Math.min((0.21 * vh) / H_REF, (0.3 * vw) / H_REF);
    armarRecorrido();
    despertar();
  }

  // ----- Recorrido (cuadros clave según el avance del scroll, de 0 a 1) -----
  const centroDe = (r, i, rep = 0) => {
    const fila = filas[r];
    const t = fila.fotos[i];
    return { x: fila.off + rep * fila.P + t.x + t.w / 2, y: fila.y + fila.h / 2, t: { ...t, h: fila.h } };
  };
  function fotoParaCerrar(x, y) {
    // La foto vertical o cuadrada de fila alta más cercana a (x, y), para terminar de cerca en ella.
    let mejor = null;
    const base = Math.floor(y / ALTO) * ALTO;
    for (let dr = -1; dr <= 1; dr++) {
      for (const fila of filas) {
        const fy = base + dr * ALTO + fila.y + fila.h / 2;
        if (Math.abs(fy - y) > 2.2 * H_REF || fila.h < 110) continue;
        const k0 = Math.floor((x - fila.off) / fila.P);
        for (let k = k0 - 1; k <= k0 + 1; k++)
          for (const t of fila.fotos) {
            if (t.f > 1) continue;
            const fx = fila.off + k * fila.P + t.x + t.w / 2;
            const d = Math.hypot(fx - x, (fy - y) * 1.4);
            if (!mejor || d < mejor.d) mejor = { d, x: fx, y: fy, t: { ...t, h: fila.h } };
          }
      }
    }
    return mejor;
  }
  let claves = [];
  function armarRecorrido() {
    const h = centroDe(heroe.r, heroe.i);
    const zL = Math.log(sLejos);
    const z0 = Math.log(cerca(h.t));
    const bajada = 3 * H_REF;
    const lado = -2.6 * 1.2 * H_REF; // el muro se corre hacia la derecha, como en la referencia
    const fin = fotoParaCerrar(h.x + lado, h.y + bajada);
    claves = [
      { p: 0, x: h.x, y: h.y, z: z0 }, // de cerca en FC-07
      { p: 0.06, x: h.x, y: h.y, z: z0 }, // un momento quieta
      { p: 0.36, x: h.x, y: h.y + 0.4 * H_REF, z: zL }, // se aleja: aparece el muro
      { p: 0.56, x: h.x, y: h.y + bajada, z: zL }, // baja ~3 filas
      { p: 0.82, x: h.x + lado, y: h.y + bajada, z: zL + Math.log(1.3) }, // se desliza y se acerca un poco
      { p: 1, x: fin.x, y: fin.y, z: Math.log(cerca(fin.t)) }, // termina de cerca en otra foto
    ];
    final = fin;
  }
  let final = null;
  function enRecorrido(p) {
    let i = 0;
    while (i < claves.length - 2 && p > claves[i + 1].p) i++;
    const a = claves[i];
    const b = claves[i + 1];
    const t = suave(limitar((p - a.p) / (b.p - a.p), 0, 1));
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
  }
  function avance() {
    // 0 cuando la escena se fija arriba; 1 cuando termina el tramo fijo (como ScrollTrigger con start y end).
    if (sinMovimiento.matches) return 0.36;
    const r = raiz.getBoundingClientRect();
    const tope = parseFloat(getComputedStyle(escena).top) || 0;
    const rango = r.height - escena.offsetHeight;
    return rango > 0 ? limitar((tope - r.top) / rango, 0, 1) : 0;
  }

  // ----- Cámara: sigue al scroll con un resorte corto (como «scrub»); más un leve desvío hacia el mouse -----
  const cam = { x: { v: 0, u: 0, t: 0 }, y: { v: 0, u: 0, t: 0 }, z: { v: 0, u: 0, t: 0 } };
  const par = { x: { v: 0, u: 0, t: 0 }, y: { v: 0, u: 0, t: 0 } };
  const escala = () => Math.exp(cam.z.v);
  let p = 0;

  // ----- Dibujo -----
  function pintarFoto(n, x, y, w, h) {
    const f = fotos[n];
    const grande = h > 600; // la chica mide 600 px: más arriba se vería estirada
    if (grande) cargar(n, "grande");
    const puede = (v, chica) => {
      if (!v.lista) return false;
      if (v.usada) return true;
      if (chica ? estrenosChicas >= 3 : estrenosGrandes >= 1) {
        seguir = true;
        return false;
      }
      if (chica) estrenosChicas++;
      else estrenosGrandes++;
      v.usada = true;
      return true;
    };
    let img = null;
    if (grande && puede(f.grande, false)) img = f.grande;
    else if (puede(f.chica, true)) img = f.chica;
    else if (f.grande.usada && f.grande.lista) img = f.grande;
    if (!img) {
      ctx.fillStyle = "#0b0b0c";
      ctx.fillRect(x, y, w, h);
      pedirChicas();
      return;
    }
    const el = img.el;
    const S = el.naturalWidth || img.lado;
    const a = w / h;
    if (a <= 1) {
      // vertical o cuadrada: se recortan los costados (fondo negro del estudio; el asiento ocupa ≤ 60 % del ancho)
      const sw = S * a;
      ctx.drawImage(el, (S - sw) / 2, 0, sw, S, x, y, w, h);
    } else {
      // apaisada: la foto entera a lo alto y los costados se completan estirando su primera y su última columna
      const dx = x + (w - h) / 2;
      ctx.drawImage(el, 0, 0, 1, S, x, y, dx - x + 1, h);
      ctx.drawImage(el, S - 1, 0, 1, S, dx + h - 1, y, x + w - (dx + h) + 1, h);
      ctx.drawImage(el, 0, 0, S, S, dx, y, h, h);
    }
  }
  function pintar() {
    const s = escala();
    const k = s * dpr;
    const cx = cam.x.v + par.x.v / s;
    const cy = cam.y.v + par.y.v / s;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, lienzo.width, lienzo.height); // los huecos dejan ver el papel de la sección
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    estrenosGrandes = 0;
    estrenosChicas = 0;
    const x0 = cx - vw / 2 / s;
    const x1 = cx + vw / 2 / s;
    const y0 = cy - vh / 2 / s;
    const y1 = cy + vh / 2 / s;
    let base = Math.floor(y0 / ALTO) * ALTO;
    let r = 0;
    while (r < FILAS - 1 && base + filas[r].y + filas[r].h < y0) r++;
    for (let vuelta = 0; vuelta < FILAS * 4; vuelta++) {
      const fila = filas[r];
      const fy = base + fila.y;
      if (fy > y1) break;
      if (fy + fila.h >= y0) {
        const Y = ((fy - cy) * s + vh / 2) * dpr;
        const lx = mod(x0 - fila.off, fila.P);
        let rep = x0 - lx; // comienzo de la repetición de la fila que contiene x0
        let i = 0;
        while (i < fila.fotos.length - 1 && fila.fotos[i].x + fila.fotos[i].w < lx) i++;
        for (let n = 0; n < 300; n++) {
          const t = fila.fotos[i];
          const fx = rep + t.x;
          if (fx > x1) break;
          pintarFoto(t.n, ((fx - cx) * s + vw / 2) * dpr, Y, t.w * k, fila.h * k);
          if (++i === fila.fotos.length) {
            i = 0;
            rep += fila.P;
          }
        }
      }
      if (++r === FILAS) {
        r = 0;
        base += ALTO;
      }
    }
  }

  // ----- Bucle -----
  let raf = 0;
  let antes = 0;
  let visible = false;
  function despertar() {
    if (!raf && visible) raf = requestAnimationFrame(cuadro);
  }
  function cuadro(ahora) {
    raf = 0;
    const dt = antes ? Math.min(0.05, (ahora - antes) / 1000) : 1 / 60;
    antes = ahora;
    p = avance();
    const obj = enRecorrido(p);
    cam.x.t = obj.x;
    cam.y.t = obj.y;
    cam.z.t = obj.z;
    // antes de llegar al final, pedir las fotos grandes de la última foto
    if (p > 0.6 && final && final.t.h * cerca(final.t) * dpr > 600) cargar(final.t.n, "grande");
    const tau = sinMovimiento.matches ? 0 : 0.2;
    resorte(cam.x, tau, dt);
    resorte(cam.y, tau, dt);
    resorte(cam.z, tau, dt);
    resorte(par.x, 0.45, dt);
    resorte(par.y, 0.45, dt);
    seguir = false;
    pintar();
    const enReposo = [cam.x, cam.y, cam.z, par.x, par.y].every(quieto);
    if (visible && (seguir || !enReposo)) raf = requestAnimationFrame(cuadro);
    else antes = 0;
  }

  // ----- Eventos -----
  addEventListener("scroll", despertar, { passive: true });
  lienzo.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || !conMouse.matches || sinMovimiento.matches) return;
    const r = lienzo.getBoundingClientRect();
    // la cámara se inclina un poco hacia el cursor
    par.x.t = ((e.clientX - r.left) / vw - 0.5) * vw * 0.04;
    par.y.t = ((e.clientY - r.top) / vh - 0.5) * vh * 0.04;
    despertar();
  });
  lienzo.addEventListener("pointerleave", () => {
    par.x.t = 0;
    par.y.t = 0;
    despertar();
  });
  new ResizeObserver(medir).observe(escena);
  new IntersectionObserver((entradas) => {
    for (const en of entradas) {
      visible = en.isIntersecting;
      if (visible) {
        pedirChicas();
        despertar();
      } else {
        cancelAnimationFrame(raf);
        raf = 0;
        antes = 0;
      }
    }
  }).observe(raiz);
  // Las fotos chicas, y la grande de la primera foto, se piden un poco antes de que llegue la sección.
  new IntersectionObserver(
    (en) => {
      if (!en.some((x) => x.isIntersecting)) return;
      pedirChicas();
      const h = centroDe(heroe.r, heroe.i);
      if (h.t.h * cerca(h.t) * dpr > 600) cargar(HEROE, "grande");
    },
    { rootMargin: "900px 0px" },
  ).observe(raiz);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
      antes = 0;
    } else despertar();
  });
  sinMovimiento.addEventListener?.("change", despertar);

  medir();
  {
    const o = enRecorrido(avance());
    cam.x.v = cam.x.t = o.x;
    cam.y.v = cam.y.t = o.y;
    cam.z.v = cam.z.t = o.z;
  }

  // Para las pruebas (no cambia nada de lo que se ve).
  raiz.muro = {
    estado: () => ({ x: cam.x.v, y: cam.y.v, z: cam.z.v, escala: escala(), p, sLejos, vw, vh, dpr }),
    claves: () => claves.map((c) => ({ ...c })),
    final: () => final && { n: final.t.n, f: final.t.f, h: final.t.h },
    filas,
    heroe,
  };
}

const raizMuro = document.querySelector("[data-galeria-muro]");
if (raizMuro) iniciarMuro(raizMuro);
