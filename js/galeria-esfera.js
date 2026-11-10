// Galería en esfera («Un estilo para cada vehículo»), recreada del diseño de @gabriell_lab:
// las fotos se arman en una esfera que gira, la cámara entra y adentro se arrastra para mirar;
// al tocar una foto se amplía al centro con el fondo desenfocado. WebGL2 sin librerías.
import { ATLAS, ASIENTOS } from "./galeria-esfera-datos.js";

// Medidas sacadas del video de referencia (ver ~/Documents/threejs/galeria-esfera/NOTAS.md).
// Adentro la cámara no está en el centro: está a 0,655 del centro, mirando la pared del fondo.
const FILAS = 9, COLUMNAS = 18, PASO_LAT = (16.66 * Math.PI) / 180;
const MEDIA = Math.tan((11.38 * Math.PI) / 360); // medio lado de cada foto (con marco) sobre la esfera de radio 1
const MARCO = 0.105, RADIO_MARCO = 0.039, RADIO_FOTO = 0.027; // en fracción del lado
const FOV_BASE = 48, CAM_DENTRO = 0.655;
const LLENADO = 0.72; // diámetro de la esfera afuera, en fracción del alto (con las fotos que sobresalen, 76 %)
const INCLINACION = 0.2; // afuera el polo norte se asoma un poco
const DERIVA = 0.035; // giro lento, en radianes por segundo (la cara de adelante va hacia la derecha)
const ACERCAR = 1.5; // lente más cerrado que el original: las fotos se ven 1,5 veces más grandes
// Todo va con el scroll: de 0 a 0,3 aparecen las fotos, hasta 0,38 la esfera queda quieta y luego la cámara entra.
const APARECER = 0.3, BUCEO = 0.38;

const VERTICES = `#version 300 es
in vec2 aEsquina;
in vec3 iN; in vec3 iE; in vec3 iU; in float iCelda; in float iRetraso;
uniform mat4 uProy; uniform mat3 uGiro; uniform float uCamZ, uTiempo; uniform int uOculta;
out vec2 vEsquina; flat out float vCelda;
void main() {
  float t = clamp((uTiempo - iRetraso) / 0.4, 0.0, 1.0);
  float e = 1.0 - pow(1.0 - t, 3.0);
  float escala = gl_InstanceID == uOculta ? 0.0 : e;
  escala *= smoothstep(0.2, 0.6, distance(uGiro * iN, vec3(0.0, 0.0, uCamZ))); // la foto que la cámara atraviesa se achica
  vec3 p = iN * (1.0 + 0.08 * (1.0 - e)) + (iE * aEsquina.x + iU * aEsquina.y) * ${MEDIA.toFixed(6)} * escala;
  vec3 m = uGiro * p;
  gl_Position = uProy * vec4(m.xy, m.z - uCamZ, 1.0);
  vEsquina = aEsquina; vCelda = iCelda;
}`;

const FRAGMENTOS = `#version 300 es
precision highp float;
in vec2 vEsquina; flat in float vCelda;
uniform sampler2D uAtlas; uniform vec3 uMarco;
out vec4 color;
float caja(vec2 p, float b, float r) { vec2 q = abs(p) - vec2(b - r); return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  vec2 p = vEsquina;
  float aa = length(fwidth(p));
  float alfa = 1.0 - smoothstep(-aa, aa * 0.5, caja(p, 1.0, ${(2 * RADIO_MARCO).toFixed(4)}));
  if (alfa <= 0.0) discard;
  float lado = ${(1 - 2 * MARCO).toFixed(4)};
  vec2 uv = clamp(p / lado * 0.5 + 0.5, 0.0, 1.0);
  if (!gl_FrontFacing) uv.x = 1.0 - uv.x; // por dentro la foto no sale al revés
  uv.y = 1.0 - uv.y;
  vec2 celda = vec2(mod(vCelda, ${ATLAS.columnas}.0), floor(vCelda / ${ATLAS.columnas}.0));
  vec2 st = (celda * ${ATLAS.celda}.0 + ${ATLAS.borde}.0 + uv * ${ATLAS.celda - 2 * ATLAS.borde}.0) / ${ATLAS.celda * ATLAS.columnas}.0;
  float foto = 1.0 - smoothstep(-aa, aa, caja(p, lado, ${(2 * RADIO_FOTO).toFixed(4)}));
  color = vec4(mix(uMarco, texture(uAtlas, st).rgb, foto), alfa);
}`;

const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Rejilla latitud/longitud con 17 filas y 28 columnas; cerca de los polos las fotos se amontonan, igual que en el original.
function crearTeselas(cantidad) {
  let semilla = 7;
  const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
  const orden = [...Array(cantidad).keys()].sort(() => azar() - 0.5);
  const datos = new Float32Array(FILAS * COLUMNAS * 11);
  const centros = [];
  let k = 0;
  for (let i = 0; i < FILAS; i++) {
    const lat = ((FILAS - 1) / 2 - i) * PASO_LAT; // sin fotos pegadas a los polos
    for (let j = 0; j < COLUMNAS; j++) {
      const lon = (j * 2 * Math.PI) / COLUMNAS;
      const n = [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
      const e = [Math.cos(lon), 0, -Math.sin(lon)];
      const u = [-Math.sin(lat) * Math.sin(lon), Math.cos(lat), -Math.sin(lat) * Math.cos(lon)];
      const celda = orden[(j * 7 + i * 23) % cantidad]; // vecinas siempre distintas
      datos.set([...n, ...e, ...u, celda, 0.15 + azar() * 0.9], k * 11); // aparecen entre 0,15 y 1,05 s, como en el video
      centros.push({ n, e, u, celda });
      k++;
    }
  }
  return { datos, centros };
}

function compilar(gl, tipo, fuente) {
  const s = gl.createShader(tipo);
  gl.shaderSource(s, fuente);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

const fotoPorDefecto = (i) => {
  const base = `./assets/galeria/fc-${String(i + 1).padStart(2, "0")}`;
  return { src: `${base}-1200.webp`, srcset: `${base}-600.webp 600w, ${base}-1200.webp 1200w` };
};

export function iniciarGaleriaEsfera(raiz, opciones = {}) {
  const atlasUrl = opciones.atlas || ATLAS.url;
  const fotoDe = opciones.foto || fotoPorDefecto;
  const lienzo = raiz.querySelector("canvas");
  const gl = lienzo.getContext("webgl2", { antialias: true, alpha: false, powerPreference: "high-performance" });
  if (!gl) return sinWebGL(raiz, fotoDe);

  const quieto = matchMedia("(prefers-reduced-motion: reduce)");
  const estilo = getComputedStyle(raiz);
  const rgb = (v) => {
    const c = document.createElement("canvas").getContext("2d");
    c.fillStyle = v;
    const h = c.fillStyle.slice(1);
    return [0, 2, 4].map((x) => parseInt(h.slice(x, x + 2), 16) / 255);
  };
  const fondo = rgb(estilo.getPropertyValue("--ge-fondo").trim() || "#f2f2f2");
  const marco = rgb(estilo.getPropertyValue("--ge-marco").trim() || "#dddadb");

  const programa = gl.createProgram();
  gl.attachShader(programa, compilar(gl, gl.VERTEX_SHADER, VERTICES));
  gl.attachShader(programa, compilar(gl, gl.FRAGMENT_SHADER, FRAGMENTOS));
  gl.linkProgram(programa);
  if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(programa));
  gl.useProgram(programa);
  const u = Object.fromEntries(["uProy", "uGiro", "uCamZ", "uTiempo", "uOculta", "uAtlas", "uMarco"].map((n) => [n, gl.getUniformLocation(programa, n)]));

  const { datos, centros } = crearTeselas(ASIENTOS.length);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const esquinas = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, esquinas);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aEsquina = gl.getAttribLocation(programa, "aEsquina");
  gl.enableVertexAttribArray(aEsquina);
  gl.vertexAttribPointer(aEsquina, 2, gl.FLOAT, false, 0, 0);
  const instancias = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, instancias);
  gl.bufferData(gl.ARRAY_BUFFER, datos, gl.STATIC_DRAW);
  [["iN", 3, 0], ["iE", 3, 3], ["iU", 3, 6], ["iCelda", 1, 9], ["iRetraso", 1, 10]].forEach(([nombre, tam, desde]) => {
    const loc = gl.getAttribLocation(programa, nombre);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, tam, gl.FLOAT, false, 44, desde * 4);
    gl.vertexAttribDivisor(loc, 1);
  });

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE); // bordes redondeados suaves sin ordenar las fotos
  gl.clearColor(fondo[0], fondo[1], fondo[2], 1);
  gl.uniform3fv(u.uMarco, marco);
  gl.uniform1i(u.uAtlas, 0);
  gl.uniform1i(u.uOculta, -1);

  const textura = gl.createTexture();
  let listo = false;
  const atlas = new Image();
  atlas.decoding = "async";
  atlas.src = atlasUrl;
  atlas.decode().then(() => {
    gl.bindTexture(gl.TEXTURE_2D, textura);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const ani = gl.getExtension("EXT_texture_filter_anisotropic");
    if (ani) gl.texParameterf(gl.TEXTURE_2D, ani.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(ani.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    listo = true;
    pedirCuadro();
  });

  // Estado de la cámara: afuera (camZ = distancia) o adentro (camZ = CAM_DENTRO, cerca de la pared de adelante).
  // giroX es lo que la persona arrastra; la inclinación de afuera la pone el scroll.
  const vista = { ancho: 1, alto: 1, focal: 1, fov: 1, afuera: 2.77 };
  let camZ = CAM_DENTRO, giroY = 0.6, giroX = 0, inclinacion = 0, velY = 0, velX = 0;
  let tiempoIntro = 99, adentro = true, abierta = null, objetivo = 0, progreso = 0;
  let visible = false, corriendo = false, ultimo = 0, cuadro = 0;

  function medir() {
    const r = lienzo.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    vista.ancho = r.width;
    vista.alto = r.height;
    lienzo.width = Math.round(r.width * dpr);
    lienzo.height = Math.round(r.height * dpr);
    const aspecto = r.width / r.height;
    // 48° como el original; en pantallas angostas se abre hasta 75° para que quepan más columnas. Luego se cierra con ACERCAR.
    const base = (Math.min(75, Math.max(FOV_BASE, (2 * Math.atan(0.52 / aspecto) * 180) / Math.PI)) * Math.PI) / 180;
    vista.fov = 2 * Math.atan(Math.tan(base / 2) / ACERCAR);
    vista.focal = r.height / 2 / Math.tan(vista.fov / 2);
    const radioPx = (LLENADO / 2) * Math.min(r.height, r.width);
    vista.afuera = 1 / Math.sin(Math.atan(radioPx / vista.focal));
    if (abierta) cerrar(true);
    leerScroll();
    colocar();
    pedirCuadro();
  }

  // Cuánto se recorrió la galería: 0 cuando su borde de arriba llega a media pantalla, 1 al soltarse la escena fija.
  const recorrido = () => {
    const r = raiz.getBoundingClientRect();
    return { arriba: r.top, largo: Math.max(1, r.height - innerHeight * 0.5) };
  };
  function leerScroll() {
    if (quieto.matches) return (objetivo = progreso = 1);
    const { arriba, largo } = recorrido();
    objetivo = Math.min(1, Math.max(0, (innerHeight * 0.5 - arriba) / largo));
  }
  // Lleva el scroll de la página al punto p del recorrido (para los botones).
  function irAlPunto(p, comportamiento = "smooth") {
    const { arriba, largo } = recorrido();
    scrollTo({ top: scrollY + arriba - innerHeight * 0.5 + p * largo, behavior: comportamiento });
  }

  function colocar() {
    tiempoIntro = Math.min(1, progreso / APARECER) * 1.45; // la última foto termina de aparecer a los 1,45
    const e = suave(Math.min(1, Math.max(0, (progreso - BUCEO) / (1 - BUCEO))));
    camZ = vista.afuera + (CAM_DENTRO - vista.afuera) * e;
    inclinacion = INCLINACION * (1 - e);
    adentro = e > 0.5;
  }

  function proyeccion() {
    const f = 1 / Math.tan(vista.fov / 2), a = vista.ancho / vista.alto, cerca = 0.004, lejos = 10;
    return new Float32Array([f / a, 0, 0, 0, 0, f, 0, 0, 0, 0, (lejos + cerca) / (cerca - lejos), -1, 0, 0, (2 * lejos * cerca) / (cerca - lejos), 0]);
  }

  // Giro de la esfera: primero sobre su eje (giroY) y luego se inclina (giroX). Matriz por columnas.
  function giro() {
    const x = giroX + inclinacion;
    const cy = Math.cos(giroY), sy = Math.sin(giroY), cx = Math.cos(x), sx = Math.sin(x);
    return [cy, sx * sy, -cx * sy, 0, cx, sx, sy, -sx * cy, cx * cy];
  }
  const aplicar = (m, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
  const aPantalla = (p) => {
    const z = camZ - p[2];
    return [vista.ancho / 2 + (vista.focal * p[0]) / z, vista.alto / 2 - (vista.focal * p[1]) / z, z];
  };

  function dibujar() {
    gl.viewport(0, 0, lienzo.width, lienzo.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!listo) return;
    gl.uniformMatrix4fv(u.uProy, false, proyeccion());
    gl.uniformMatrix3fv(u.uGiro, false, giro());
    gl.uniform1f(u.uCamZ, camZ);
    gl.uniform1f(u.uTiempo, tiempoIntro);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, centros.length);
  }

  const pausado = () => quieto.matches || document.documentElement.classList.contains("motion-paused");

  function paso(ahora) {
    corriendo = false;
    const dt = Math.min(0.05, (ahora - (ultimo || ahora)) / 1000);
    ultimo = ahora;
    // La cámara sigue al scroll con un poco de inercia, para que la rueda del mouse no dé saltos.
    progreso += (objetivo - progreso) * (1 - Math.exp(-dt * 7));
    if (Math.abs(objetivo - progreso) < 1e-4) progreso = objetivo;
    colocar();
    if (!abierta && !arrastre) {
      giroY += ((pausado() ? 0 : DERIVA) + velY) * dt;
      giroX = limitarX(giroX + velX * dt);
      const freno = Math.exp(-dt * 3.2);
      velY *= freno;
      velX *= freno;
    }
    dibujar();
    const sigue = (!pausado() && !abierta) || progreso !== objetivo || Math.abs(velY) + Math.abs(velX) > 1e-4;
    if (visible && sigue) pedirCuadro();
  }

  function pedirCuadro() {
    if (corriendo || !visible) return;
    corriendo = true;
    cuadro = requestAnimationFrame(paso);
  }

  const limitarX = (x) => Math.max(-0.75, Math.min(adentro ? 0.75 : 1.1, x));
  // Afuera se arrastra la cara de adelante; adentro, la pared del fondo: el sentido se invierte.
  const sensibilidad = () => (camZ > 1 ? Math.max(camZ - 1, 0.6) : -(1 + camZ)) / vista.focal;

  // Toca una foto: rayo desde la cámara contra el plano de cada foto.
  function fotoEn(x, y) {
    const m = giro();
    const inv = [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
    const d = aplicar(inv, [(x - vista.ancho / 2) / vista.focal, -(y - vista.alto / 2) / vista.focal, -1]);
    const o = aplicar(inv, [0, 0, camZ]);
    let mejor = -1, distancia = Infinity;
    centros.forEach((c, i) => {
      const dn = d[0] * c.n[0] + d[1] * c.n[1] + d[2] * c.n[2];
      if (Math.abs(dn) < 1e-6) return;
      const t = (1 - (o[0] * c.n[0] + o[1] * c.n[1] + o[2] * c.n[2])) / dn;
      if (t <= 0.004 || t >= distancia) return;
      const q = [o[0] + t * d[0] - c.n[0], o[1] + t * d[1] - c.n[1], o[2] + t * d[2] - c.n[2]];
      const a = (q[0] * c.e[0] + q[1] * c.e[1] + q[2] * c.e[2]) / MEDIA;
      const b = (q[0] * c.u[0] + q[1] * c.u[1] + q[2] * c.u[2]) / MEDIA;
      if (Math.abs(a) <= 1 && Math.abs(b) <= 1) {
        mejor = i;
        distancia = t;
      }
    });
    return mejor;
  }

  // Con el teclado se abre la foto más cercana al centro de la vista (y, entre dos alineadas, la de adelante).
  function fotoCercana() {
    const m = giro();
    let mejor = 0, puntaje = -Infinity;
    centros.forEach((c, i) => {
      const p = aplicar(m, c.n), z = p[2] - camZ, largo = Math.hypot(p[0], p[1], z);
      const valor = -z / largo - 0.02 * largo;
      if (valor > puntaje) {
        puntaje = valor;
        mejor = i;
      }
    });
    return mejor;
  }

  // Dónde se ve una foto en la pantalla (centro, lado y ángulo), para que la ampliada salga de ahí.
  function rectanguloDe(i) {
    const c = centros[i], m = giro(), caja = lienzo.getBoundingClientRect();
    const punto = (a, b) => aPantalla(aplicar(m, [c.n[0] + (c.e[0] * a + c.u[0] * b) * MEDIA, c.n[1] + (c.e[1] * a + c.u[1] * b) * MEDIA, c.n[2] + (c.e[2] * a + c.u[2] * b) * MEDIA]));
    const centro = punto(0, 0), der = punto(1, 0), izq = punto(-1, 0), arr = punto(0, 1), abj = punto(0, -1);
    let dx = der[0] - izq[0], dy = der[1] - izq[1];
    const cam = aplicar([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]], [0, 0, camZ]);
    if (cam[0] * c.n[0] + cam[1] * c.n[1] + cam[2] * c.n[2] < 1) {
      dx = -dx; // vista desde atrás: el shader voltea la foto
      dy = -dy;
    }
    const lado = (Math.hypot(dx, dy) + Math.hypot(arr[0] - abj[0], arr[1] - abj[1])) / 2;
    return { x: caja.left + centro[0], y: caja.top + centro[1], lado, angulo: Math.atan2(dy, dx) };
  }

  function abrir(i) {
    const celda = centros[i].celda;
    const [codigo, nombre] = ASIENTOS[celda];
    const desde = rectanguloDe(i);
    const lado = Math.min(innerHeight * 0.72, anchoVentana() * 0.86);
    const cubierta = document.createElement("div");
    cubierta.className = "ge-ampliada";
    cubierta.setAttribute("role", "dialog");
    cubierta.setAttribute("aria-label", `${codigo} · ${nombre}`);
    cubierta.style.cssText = `width:${lado}px;height:${lado}px;padding:${lado * MARCO}px;left:${(anchoVentana() - lado) / 2}px;top:${(innerHeight - lado) / 2}px;font-size:${Math.max(11, lado * 0.026)}px`;
    // Mientras carga la foto grande se ve la chica del atlas, ya en su sitio.
    const total = ATLAS.celda * ATLAS.columnas, util = ATLAS.celda - 2 * ATLAS.borde;
    const ladoFoto = lado * (1 - 2 * MARCO), escala = ladoFoto / util;
    const col = celda % ATLAS.columnas, fila = Math.floor(celda / ATLAS.columnas);
    const foto = document.createElement("div");
    foto.className = "ge-foto";
    foto.style.cssText = `background-image:url("${atlasUrl}");background-size:${total * escala}px;background-position:${-(col * ATLAS.celda + ATLAS.borde) * escala}px ${-(fila * ATLAS.celda + ATLAS.borde) * escala}px`;
    const img = new Image();
    const fuente = fotoDe(celda);
    img.alt = `Forro ${codigo}: ${nombre}`;
    img.decoding = "async";
    img.sizes = `${Math.round(ladoFoto)}px`;
    if (fuente.srcset) img.srcset = fuente.srcset;
    img.src = fuente.src;
    img.decode().then(() => img.classList.add("ge-cargada"), () => {});
    foto.append(img);
    const pie = document.createElement("p");
    pie.className = "ge-pie";
    pie.innerHTML = `<b>${codigo}</b> ${nombre}`;
    cubierta.append(foto, pie);
    document.body.append(cubierta);
    raiz.classList.add("ge-abierta");
    abierta = { i, cubierta, lado };
    gl.uniform1i(u.uOculta, i);
    pedirCuadro();
    cubierta.animate(desdeHacia(desde, lado), { duration: quieto.matches ? 1 : 620, easing: "cubic-bezier(.22,.8,.24,1)" });
    if (quieto.matches) cubierta.animate({ opacity: [0, 1] }, 200);
  }

  const anchoVentana = () => document.documentElement.clientWidth; // sin la barra de desplazamiento

  function desdeHacia(r, lado) {
    const dx = r.x - anchoVentana() / 2, dy = r.y - innerHeight / 2;
    return { transform: [`translate(${dx}px,${dy}px) rotate(${r.angulo}rad) scale(${r.lado / lado})`, "none"] };
  }

  function cerrar(rapido = false) {
    if (!abierta) return;
    const { i, cubierta, lado } = abierta;
    abierta = null;
    raiz.classList.remove("ge-abierta");
    const fin = () => {
      cubierta.remove();
      if (!abierta) gl.uniform1i(u.uOculta, -1);
      pedirCuadro();
    };
    if (rapido || quieto.matches) {
      cubierta.animate({ opacity: [1, 0] }, 180).finished.then(fin);
      return;
    }
    const ida = desdeHacia(rectanguloDe(i), lado);
    cubierta.animate({ transform: [...ida.transform].reverse() }, { duration: 520, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" }).finished.then(fin);
  }

  // Arrastrar para mirar; un toque sin arrastre amplía la foto.
  let arrastre = null;
  lienzo.addEventListener("pointerdown", (ev) => {
    if (abierta || ev.button > 0) return;
    arrastre = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, t: ev.timeStamp, movio: false, vy: 0, vx: 0 };
    velX = velY = 0;
  });
  lienzo.addEventListener("pointermove", (ev) => {
    if (!arrastre || ev.pointerId !== arrastre.id) return;
    const dx = ev.clientX - arrastre.x, dy = ev.clientY - arrastre.y;
    if (!arrastre.movio && Math.hypot(dx, dy) < 6) return;
    if (!arrastre.movio) {
      arrastre.movio = true;
      lienzo.setPointerCapture(ev.pointerId);
      raiz.classList.add("ge-arrastrando");
    }
    const k = sensibilidad(), dt = Math.max(1, ev.timeStamp - arrastre.t) / 1000;
    giroY += dx * k;
    giroX = limitarX(giroX + dy * k);
    arrastre.vy = (dx * k) / dt;
    arrastre.vx = (dy * k) / dt;
    arrastre.x = ev.clientX;
    arrastre.y = ev.clientY;
    arrastre.t = ev.timeStamp;
    pedirCuadro();
  });
  const soltar = (ev) => {
    if (!arrastre || ev.pointerId !== arrastre.id) return;
    const a = arrastre;
    arrastre = null;
    raiz.classList.remove("ge-arrastrando");
    if (a.movio) {
      const reciente = ev.timeStamp - a.t < 80;
      velY = reciente ? Math.max(-3, Math.min(3, a.vy)) : 0;
      velX = reciente ? Math.max(-3, Math.min(3, a.vx)) : 0;
      pedirCuadro();
    } else if (ev.type === "pointerup") {
      const caja = lienzo.getBoundingClientRect();
      const i = fotoEn(ev.clientX - caja.left, ev.clientY - caja.top);
      if (i >= 0) abrir(i);
    }
  };
  lienzo.addEventListener("pointerup", soltar);
  lienzo.addEventListener("pointercancel", soltar);

  lienzo.addEventListener("keydown", (ev) => {
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
    if (dir) {
      ev.preventDefault();
      const s = camZ > 1 ? -1 : 1;
      velY += s * dir[0] * 1.2;
      velX += s * dir[1] * 1.2;
      pedirCuadro();
    } else if ((ev.key === "Enter" || ev.key === " ") && !abierta) {
      ev.preventDefault();
      abrir(fotoCercana());
    }
  });
  addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && abierta) {
      cerrar();
      lienzo.focus({ preventScroll: true });
    }
  });
  addEventListener("pointerdown", (ev) => {
    if (abierta && !ev.target.closest?.(".ge-botones")) {
      ev.preventDefault();
      cerrar();
    }
  });
  addEventListener("scroll", () => {
    if (abierta) cerrar(true);
    leerScroll();
    pedirCuadro();
  }, { passive: true });

  // Los botones mueven la página: entrar = final del recorrido, salir = esfera completa afuera.
  raiz.querySelector('[data-ge="vista"]')?.addEventListener("click", () => irAlPunto(adentro ? (APARECER + BUCEO) / 2 : 1));
  raiz.querySelector('[data-ge="repetir"]')?.addEventListener("click", () => {
    irAlPunto(0, "instant");
    requestAnimationFrame(() => irAlPunto(1));
  });

  new ResizeObserver(medir).observe(lienzo);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (!visible) {
      cancelAnimationFrame(cuadro);
      corriendo = false;
      if (abierta) cerrar(true);
    } else {
      ultimo = 0;
      pedirCuadro();
    }
  }).observe(lienzo);
  document.addEventListener("visibilitychange", () => {
    ultimo = 0;
    if (!document.hidden) pedirCuadro();
  });
  new MutationObserver(() => pedirCuadro()).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  medir();
}

// Sin WebGL2: cuadrícula sencilla con las mismas fotos.
function sinWebGL(raiz, fotoDe) {
  raiz.classList.add("ge-sin-webgl");
  const lista = document.createElement("ul");
  ASIENTOS.forEach(([codigo, nombre], i) => {
    const li = document.createElement("li");
    const img = new Image();
    const f = fotoDe(i);
    img.src = f.srcset ? f.srcset.split(" ")[0] : f.src;
    img.alt = `Forro ${codigo}: ${nombre}`;
    img.loading = "lazy";
    li.append(img);
    lista.append(li);
  });
  raiz.replaceChildren(lista);
}

document.querySelectorAll("[data-galeria-esfera]").forEach((raiz) => iniciarGaleriaEsfera(raiz));
