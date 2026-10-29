// Cómo trabajamos (estilo «Scrollable Images»): cada paso es una foto a pantalla completa. Encima queda fija la
// columna de palabras grandes: sube con el scroll suavizado, se rellena la del paso que se ve y se inclina según
// la velocidad. El texto del paso entra cuando la foto queda en su lugar.
const pasosSeccion = document.querySelector(".pasos");
if (pasosSeccion) {
  const fotos = [...pasosSeccion.querySelectorAll(".paso")];
  const fijo = pasosSeccion.querySelector(".pasos-fijo");
  const escenario = pasosSeccion.querySelector(".pasos-escenario");
  const columna = pasosSeccion.querySelector(".pasos-columna");
  const palabras = [...columna.children].map((el, i) => ({ el, relleno: el.querySelector(".relleno"), i }));
  const textos = [...pasosSeccion.querySelectorAll(".paso-texto")];
  const puntos = [...pasosSeccion.querySelectorAll(".pasos-puntos a")];
  const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
  const suave = (a, b, x) => { const t = limitar((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  console.assert(suave(0, 1, 0) === 0 && suave(0, 1, 1) === 1 && suave(0, 1, 0.5) === 0.5, "suave");

  pasosSeccion.classList.add("pasos-js");
  let alto = 0;
  const medir = () => {
    alto = palabras[0].el.offsetHeight;
    palabras.forEach((p) => { p.el.style.top = `${p.i * alto - alto / 2}px`; });
  };
  medir();
  window.addEventListener("resize", medir);
  document.fonts?.ready.then(medir);

  let mostrado = -1;
  let espera = 0;
  const mostrarTexto = (i) => {
    if (i === mostrado) return;
    mostrado = i;
    textos.forEach((t) => t.classList.remove("is-in"));
    clearTimeout(espera);
    if (i >= 0) espera = setTimeout(() => textos[i].classList.add("is-in"), 260);
  };

  // ir a un paso: llevar el scroll al inicio de su foto
  const irA = (i) => fotos[limitar(i, 0, fotos.length - 1)].scrollIntoView({ behavior: quieto ? "auto" : "smooth" });
  pasosSeccion.querySelectorAll("[data-ir]").forEach((enlace) => enlace.addEventListener("click", (evento) => {
    evento.preventDefault();
    irA(Number(enlace.dataset.ir));
  }));

  let actual = scrollY;
  let inclinacion = 0;
  let quietoDesde = 0;
  let cuadro = 0;
  const paso = (ahora) => {
    const destino = scrollY;
    actual += (destino - actual) * (quieto ? 1 : 0.14);
    if (Math.abs(destino - actual) < 0.05) actual = destino;
    const velocidad = destino - actual;

    const querida = quieto ? 0 : limitar(-velocidad * 0.055, -14, 14);
    inclinacion += (querida - inclinacion) * 0.18;
    escenario.style.transform = `skew(${(inclinacion * 0.55).toFixed(2)}deg, ${inclinacion.toFixed(2)}deg)`;

    // avance en pasos (0 a 3) medido desde que la primera foto llega debajo del menú
    const arriba = fotos[0].getBoundingClientRect().top + destino - parseFloat(getComputedStyle(fijo).top);
    const altoPaso = fotos[0].offsetHeight;
    const ultimo = fotos.length - 1;
    const p = limitar((actual - arriba) / altoPaso, 0, ultimo);
    columna.style.transform = `translate3d(0, ${(-p * alto).toFixed(2)}px, 0)`;
    palabras.forEach((w) => {
      const d = Math.abs(w.i - p);
      w.relleno.style.opacity = (1 - suave(0.2, 0.62, d)).toFixed(3);
      w.el.style.opacity = limitar(1.35 - d * 0.32, 0, 1).toFixed(3);
    });

    const real = (destino - arriba) / altoPaso;
    const activo = limitar(Math.round(real), 0, ultimo);
    puntos.forEach((a, i) => { if (i === activo) a.setAttribute("aria-current", "step"); else a.removeAttribute("aria-current"); });
    // el texto entra con la foto en su lugar, o si el scroll se detiene a medio camino
    if (Math.abs(velocidad) > 0.5) quietoDesde = ahora;
    if (Math.abs(real - Math.round(real)) < 0.12 || ahora - quietoDesde > 250) mostrarTexto(activo);
    else if (mostrado >= 0) mostrarTexto(-1);

    cuadro = requestAnimationFrame(paso);
  };
  // el bucle solo corre mientras la sección está en pantalla
  new IntersectionObserver(([e]) => {
    cancelAnimationFrame(cuadro);
    if (e.isIntersecting) { actual = scrollY; cuadro = requestAnimationFrame(paso); }
  }).observe(pasosSeccion);
}

// Reseñas en rompecabezas: el rompecabezas cubre toda la pantalla mientras el bloque está fijo y el avance del
// scroll hace aparecer y encajar las piezas una por una (--k de 1 revuelta e invisible a 0 en su lugar).
// Lo que no cabe a lo ancho se recorre deslizándolo de izquierda a derecha.
const resenas = document.querySelector(".resenas");
if (resenas) {
  const fijoR = resenas.querySelector(".resenas-fijo");
  const marco = resenas.querySelector(".rompecabezas-marco");
  const piezas = [...resenas.querySelectorAll(".pieza")];
  const quietoR = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const limitar = (v) => Math.min(1, Math.max(0, v));
  const salida = (t) => 1 - (1 - t) ** 3;
  let ancho = 0;
  const ajustar = () => {
    const w = marco.clientWidth;
    const h = marco.clientHeight;
    // llena el alto; en pantallas anchas también el ancho, recortando como mucho 60 px de alto
    const s = Math.max(h / 506.6, Math.min(w / 900, (h + 60) / 506.6));
    resenas.style.setProperty("--s", s.toFixed(3));
    ancho = Math.max(0, 900 * s - w);
  };
  const leer = () => {
    const r = resenas.getBoundingClientRect();
    const recorrido = Math.max(1, resenas.offsetHeight - fijoR.offsetHeight);
    const p = limitar((parseFloat(getComputedStyle(fijoR).top) - r.top) / recorrido);
    // 6 piezas en orden de armado; cada una tarda 0.26 del recorrido y la última termina en 0.9
    piezas.forEach((pieza) => {
      const i = Number(pieza.style.getPropertyValue("--orden"));
      const k = quietoR ? 0 : 1 - salida(limitar((p - 0.02 - i * 0.124) / 0.26));
      pieza.style.setProperty("--k", k.toFixed(4));
    });
    resenas.style.setProperty("--pan", `${(ancho / 2 - ancho * limitar((p - 0.05) / 0.85)).toFixed(1)}px`);
  };
  ajustar();
  leer();
  new ResizeObserver(() => { ajustar(); leer(); }).observe(resenas);
  let cuadroR = 0;
  window.addEventListener("scroll", () => {
    cancelAnimationFrame(cuadroR);
    cuadroR = requestAnimationFrame(leer);
  }, { passive: true });
}

// Marca roja que se desliza al elemento señalado y, al soltar, vuelve al que está "en reposo"
// (la sección que se ve, en el menú; el servicio abierto, en ¿Qué tapizamos?). Mismo gesto que los pasos.
const marcaQueViaja = (contenedor, objetivos, enReposo) => {
  const marca = document.createElement("span");
  marca.className = "marca-viaja";
  marca.setAttribute("aria-hidden", "true");
  contenedor.prepend(marca);
  contenedor.classList.add("con-marca");
  let senalado = null;
  const colocar = () => {
    const el = senalado || enReposo();
    if (!el || !el.offsetParent) {
      marca.classList.remove("is-visible");
      return;
    }
    const c = contenedor.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    // si estaba oculta aparece en su sitio, sin viajar desde la esquina
    marca.classList.toggle("sin-viaje", !marca.classList.contains("is-visible"));
    marca.style.width = `${r.width}px`;
    marca.style.height = `${r.height}px`;
    marca.style.translate = `${r.left - c.left}px ${r.top - c.top}px`;
    marca.classList.add("is-visible");
  };
  objetivos.forEach((el) => {
    el.addEventListener("pointerenter", (evento) => {
      if (evento.pointerType !== "mouse") return;
      senalado = el;
      colocar();
    });
    el.addEventListener("focus", () => {
      if (!el.matches(":focus-visible")) return;
      senalado = el;
      colocar();
    });
    el.addEventListener("blur", () => {
      senalado = null;
      colocar();
    });
  });
  contenedor.addEventListener("pointerleave", () => {
    senalado = null;
    colocar();
  });
  new ResizeObserver(colocar).observe(contenedor);
  return colocar;
};

const menu = document.querySelector(".site-nav");
if (menu) {
  const enlaces = [...menu.querySelectorAll('a[href^="#"]')];
  let seccionVista = null;
  const colocar = marcaQueViaja(menu, enlaces, () => seccionVista);
  const porSeccion = new Map(enlaces.map((a) => [document.querySelector(a.getAttribute("href")), a]).filter(([s]) => s));
  // la sección que cruza la mitad de la pantalla es la que se marca
  const vigia = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => {
      if (e.isIntersecting) seccionVista = porSeccion.get(e.target);
      else if (porSeccion.get(e.target) === seccionVista) seccionVista = null;
    });
    colocar();
  }, { rootMargin: "-50% 0px -50% 0px" });
  porSeccion.forEach((_, seccion) => vigia.observe(seccion));
}

const servicios = document.querySelector(".services-list");
if (servicios) {
  const detalles = [...servicios.querySelectorAll("details")];
  const colocar = marcaQueViaja(servicios, detalles.map((d) => d.querySelector("summary")), () => servicios.querySelector("details[open] > summary"));
  detalles.forEach((d) => {
    d.addEventListener("toggle", colocar);
    new ResizeObserver(colocar).observe(d);
  });
}

// Botones de cotizar: crecen un poco y se acercan al mouse a medida que se acerca (aumento por cercanía y botón magnético)
if (window.matchMedia("(hover: hover) and (pointer: fine)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const botones = [...document.querySelectorAll(".hero-primary, .header-quote, .quote-button, .closing-button, .map-link")];
  let cuadro = 0;
  document.addEventListener("pointermove", (evento) => {
    cancelAnimationFrame(cuadro);
    cuadro = requestAnimationFrame(() => {
      botones.forEach((boton) => {
        const r = boton.getBoundingClientRect();
        if (!r.width) return;
        const dx = Math.max(r.left - evento.clientX, 0, evento.clientX - r.right);
        const dy = Math.max(r.top - evento.clientY, 0, evento.clientY - r.bottom);
        const f = Math.max(0, 1 - Math.hypot(dx, dy) / 120);
        boton.style.scale = f ? (1 + 0.1 * f).toFixed(3) : "";
        // magnético: además se corre un poco hacia el mouse (máximo 6 px)
        const mx = Math.max(-6, Math.min(6, (evento.clientX - (r.left + r.width / 2)) * 0.12 * f));
        const my = Math.max(-6, Math.min(6, (evento.clientY - (r.top + r.height / 2)) * 0.12 * f));
        boton.style.translate = f ? `${mx.toFixed(1)}px ${my.toFixed(1)}px` : "";
      });
    });
  }, { passive: true });
}

// ---- Guía de movimiento (investigación de Gemini, 2026-10-28) ----
const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Split text: los títulos grandes entran palabra por palabra al aparecer (una sola vez).
if (!sinMovimiento && "IntersectionObserver" in window) {
  const titulos = [...document.querySelectorAll("h2")].filter((h) => h.querySelector(".line") || h.id === "process-title");
  const vigiaTitulos = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-visible");
      vigiaTitulos.unobserve(e.target);
    });
  }, { threshold: 0.2 });
  titulos.forEach((titulo) => {
    let i = 0;
    const textos = [];
    const recorrer = document.createTreeWalker(titulo, NodeFilter.SHOW_TEXT);
    while (recorrer.nextNode()) textos.push(recorrer.currentNode);
    textos.forEach((nodo) => {
      const partes = nodo.textContent.split(/(\s+)/);
      if (partes.every((p) => !p.trim())) return;
      const trozo = document.createDocumentFragment();
      partes.forEach((p) => {
        if (!p.trim()) { trozo.append(p); return; }
        const palabra = document.createElement("span");
        palabra.className = "palabra";
        palabra.style.setProperty("--i", i++);
        palabra.textContent = p;
        trozo.append(palabra);
      });
      nodo.replaceWith(trozo);
    });
    titulo.classList.add("titulo-partido");
    vigiaTitulos.observe(titulo);
  });
}

// Marquee reactivo: la cinta de marcas acelera al bajar rápido y cambia de sentido al subir.
const cintas = [...document.querySelectorAll(".brands-track")];
const animCintas = cintas.flatMap((cinta) => cinta.getAnimations());
if (animCintas.length && !sinMovimiento) {
  // hacia atrás una animación termina al llegar a 0: se adelanta 1000 vueltas (no cambia lo que se ve) para que nunca llegue
  animCintas.forEach((a) => { a.currentTime += a.effect.getComputedTiming().duration * 1000; });
  let ultimoY = window.scrollY;
  let sentido = 1;
  let velocidad = 1;
  let cuadroCinta = 0;
  const animar = () => {
    // vuelve sola a la velocidad normal, sin perder el sentido
    velocidad += (sentido - velocidad) * 0.06;
    animCintas.forEach((a) => { a.playbackRate = velocidad; });
    cuadroCinta = Math.abs(velocidad - sentido) > 0.01 ? requestAnimationFrame(animar) : 0;
  };
  window.addEventListener("scroll", () => {
    const dy = window.scrollY - ultimoY;
    ultimoY = window.scrollY;
    if (!dy) return;
    sentido = dy > 0 ? 1 : -1;
    velocidad = sentido * Math.min(5, 1 + Math.abs(dy) / 18);
    if (!cuadroCinta) cuadroCinta = requestAnimationFrame(animar);
  }, { passive: true });
}

// WhatsApp que sabe dónde estás: el botón de abajo (celular) y el mensaje dicen lo que el cliente está viendo.
const botonMovil = document.querySelector("#mobile-quote-button");
const servicioAbierto = () => document.querySelector(".services-list details[open] summary strong")?.textContent.trim();
const contextos = {
  trabajos: () => ({ etiqueta: "Cotizar un diseño como estos", interes: "un diseño de forro como los de la web" }),
  servicios: () => {
    const s = servicioAbierto();
    return s ? { etiqueta: `Cotizar ${s.toLowerCase()}`, interes: s.toLowerCase() } : null;
  },
  configurador: () => ({ etiqueta: "Cotizar mi diseño", interes: "" }),
};
if (botonMovil && "IntersectionObserver" in window) {
  let seccionActual = "";
  const aplicar = () => {
    const c = contextos[seccionActual]?.() || { etiqueta: "Cotizar en WhatsApp", interes: "" };
    if (c.interes) document.documentElement.dataset.interes = c.interes;
    else delete document.documentElement.dataset.interes;
    if (botonMovil.dataset.etiqueta === c.etiqueta) return;
    botonMovil.dataset.etiqueta = c.etiqueta;
    const precio = botonMovil.textContent.split(" · ")[1];
    botonMovil.textContent = precio ? `${c.etiqueta} · ${precio}` : c.etiqueta;
    if (!sinMovimiento) botonMovil.animate([{ opacity: 0.35, transform: "translateY(3px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "ease-out" });
  };
  const vigiaSecciones = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => {
      if (e.isIntersecting) seccionActual = e.target.id;
      else if (seccionActual === e.target.id) seccionActual = "";
    });
    aplicar();
  }, { rootMargin: "-45% 0px -45% 0px" });
  document.querySelectorAll("main section[id]").forEach((s) => vigiaSecciones.observe(s));
  document.querySelectorAll(".services-list details").forEach((d) => d.addEventListener("toggle", aplicar));
}
