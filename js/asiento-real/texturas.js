// Texturas físicas y mapas de altura 3D real para cuero automotriz (americano y
// colombiano), los 7 patrones del configurador, costuras de hilo y bordados.
// Calibrado con los parámetros reales de taller de deep-research-asientos.md.
import * as THREE from "../vendor/three-0.186.1-extra.min.js";

import { calcularPatron, desplazamientoPatron, grano, normalDesdeAltura, ruido } from "./texturas-calculo.js?v=13";
export { desplazamientoPatron };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const cache = new Map();

function texturaDatos(datos, w, h, color) {
  const t = new THREE.DataTexture(datos, w, h, THREE.RGBAFormat);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}


export function texturaCueroReal(alCargar) {
  if (cache.has("cuero-real-normal")) return cache.get("cuero-real-normal");
  const w = 512;
  const g = grano(w, w, 64, 64, 91);
  const alt = new Float32Array(w * w);
  for (let k = 0; k < alt.length; k++) alt[k] = g[k] * 0.1;
  const datos = normalDesdeAltura(alt, w, w, 40 / w, 40 / w);

  if (typeof document === "undefined") {
    const t = texturaDatos(datos, w, w, false);
    t.repeat.set(2.8, 2.8);
    cache.set("cuero-real-normal", t);
    return t;
  }

  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = w;
  const ctx = cv.getContext("2d");
  ctx.putImageData(new ImageData(new Uint8ClampedArray(datos.buffer), w, w), 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2.8, 2.8);
  t.anisotropy = 8;
  t.colorSpace = THREE.NoColorSpace;
  cache.set("cuero-real-normal", t);

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    ctx.drawImage(img, 0, 0, w, w);
    t.needsUpdate = true;
    if (alCargar) alCargar();
  };
  img.src = new URL("../../assets/texturas/cuero-real-normal.webp", import.meta.url).href;
  return t;
}

function texturasDesdeDatos(d) {
  const resultado = {
    normal: texturaDatos(d.normal, d.w, d.h, false),
    sombra: texturaDatos(d.sombra, d.w, d.h, true),
    rugosidad: texturaDatos(d.rugosidad, d.w, d.h, false),
    hilo: d.hilo ? texturaDatos(d.hilo, d.w, d.h, false) : null,
    repeticion: new THREE.Vector2(d.repX, d.repY),
    desfase: new THREE.Vector2(d.offU, 0),
  };
  for (const t of [resultado.normal, resultado.sombra, resultado.rugosidad, resultado.hilo]) {
    if (!t) continue;
    t.repeat.copy(resultado.repeticion);
    t.offset.copy(resultado.desfase);
  }
  return resultado;
}

// Devuelve las texturas del patrón. Si todavía no se precalcularon, las calcula
// aquí mismo (puede tardar un segundo): por eso se precalientan en un Worker.
export function texturasPatron(patron, cuero) {
  const clave = `${patron}|${cuero}`;
  if (cache.has(clave)) return cache.get(clave);
  const resultado = texturasDesdeDatos(calcularPatron(patron, cuero));
  cache.set(clave, resultado);
  return resultado;
}

export const PATRONES_ID = ["liso", "chevron", "diamante", "ondas", "hexagonal", "deportivo", "perforado"];

// Calcula en segundo plano (Web Worker) las texturas de todos los patrones para
// que elegirlos después sea instantáneo. `primero` son los patrones en uso.
let trabajador = null;
const pendientes = new Set();
export function precalentarPatrones(cuero, primero = [], alListo = () => {}) {
  if (typeof Worker === "undefined") return;
  const orden = [...new Set([...primero, ...PATRONES_ID])].filter((p) => !cache.has(`${p}|${cuero}`) && !pendientes.has(`${p}|${cuero}`));
  if (!orden.length) return;
  if (!trabajador) {
    try {
      trabajador = new Worker(new URL("./texturas-worker.js?v=13", import.meta.url), { type: "module" });
    } catch {
      trabajador = false;
    }
    if (trabajador) {
      trabajador.onmessage = ({ data }) => {
        const clave = `${data.patron}|${data.cuero}`;
        pendientes.delete(clave);
        if (!cache.has(clave)) cache.set(clave, texturasDesdeDatos(data));
        alListo();
      };
      trabajador.onerror = () => {
        pendientes.clear();
        trabajador.terminate();
        trabajador = false;
      };
    }
  }
  if (!trabajador) return;
  for (const p of orden) {
    pendientes.add(`${p}|${cuero}`);
    trabajador.postMessage({ patron: p, cuero });
  }
}

export function texturaPlastico() {
  if (cache.has("plastico")) return cache.get("plastico");
  const w = 256;
  const r = ruido(w, w, 48, 48, 9);
  const g = grano(w, w, 44, 44, 17);
  const alt = new Float32Array(w * w);
  for (let k = 0; k < alt.length; k++) alt[k] = r[k] * 0.025 + g[k] * 0.035;
  const t = texturaDatos(normalDesdeAltura(alt, w, w, 28 / w, 28 / w), w, w, false);
  t.repeat.set(100 / 28, 100 / 28);
  cache.set("plastico", t);
  return t;
}

export function texturaSombraPiso() {
  if (cache.has("piso")) return cache.get("piso");
  const w = 256;
  const datos = new Uint8Array(w * w * 4);
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x / w - 0.5) * 2;
      const dy = (y / w - 0.5) * 2;
      const rx = Math.abs(dx);
      const ry = Math.abs(dy);
      const caja = Math.hypot(Math.max(0, rx - 0.22), Math.max(0, ry - 0.25)) / 0.76;
      const nucleo = Math.max(0, 1 - caja) ** 2.1;
      const halo = Math.max(0, 1 - Math.hypot(dx, dy)) ** 2.6;
      const a = clamp(nucleo * 0.72 + halo * 0.35, 0, 1);
      const o = (y * w + x) * 4;
      datos[o] = 0;
      datos[o + 1] = 0;
      datos[o + 2] = 0;
      datos[o + 3] = Math.round(a * 255);
    }
  }
  const t = new THREE.DataTexture(datos, w, w, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  cache.set("piso", t);
  return t;
}
