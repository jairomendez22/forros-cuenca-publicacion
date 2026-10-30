// Testimonios: carrusel de reseñas al estilo «Afterwords» (Fabian Albert, @fabiuix, para eleveight.studio).
// Arrastre de una tarjeta por gesto, imán, bordes que se desvanecen, avance solo cada 6 s y un punto que sigue
// al mouse dentro de la sección. Los valores salen del código del original.
const seccion = document.querySelector(".testimonios");
if (seccion) iniciar(seccion);

function iniciar(seccion) {
  const pista = seccion.querySelector(".tm-pista");
  const quieto = matchMedia("(prefers-reduced-motion: reduce)");
  // avance cada 6 s, espera de 140 ms tras el scroll, 12 px para pasar de tarjeta
  const INTERVALO = 6000, ESPERA = 140, PASO_MIN = 12, ARRASTRE_MIN = 2, FUNDIDO = 220;
  const INTERACTIVO = "a[href], button, input, textarea, select, [role='button']";

  const movil = () => innerWidth <= 809.98;
  const tarjetas = () => [...pista.children];
  const maximo = () => Math.max(0, pista.scrollWidth - pista.clientWidth);
  const limitar = (v) => Math.max(0, Math.min(v, maximo()));
  // posición de scroll de la tarjeta i: alineada al inicio (centrada en celular); la primera y la última, a los extremos
  const destino = (i) => {
    const t = tarjetas();
    if (i <= 0) return 0;
    if (i >= t.length - 1) return maximo();
    if (movil()) return limitar(t[i].offsetLeft - (pista.clientWidth - t[i].offsetWidth) / 2);
    return Math.min(t[i].offsetLeft, maximo());
  };
  const cercana = () => {
    let mejor = 0, menor = Infinity;
    tarjetas().forEach((_, i) => { const d = Math.abs(destino(i) - pista.scrollLeft); if (d < menor) { menor = d; mejor = i; } });
    return mejor;
  };
  // un gesto corto vuelve a la tarjeta más cercana; uno de 12 px o más avanza exactamente una
  const paso = (inicio, dx) => Math.abs(dx) < PASO_MIN ? cercana() : Math.max(0, Math.min(inicio + (dx < 0 ? 1 : -1), tarjetas().length - 1));

  const soltar = () => { pista.style.scrollSnapType = "none"; pista.style.scrollBehavior = "auto"; };
  const imantar = () => { pista.style.scrollSnapType = ""; pista.style.scrollBehavior = ""; };

  // el paso entre tarjetas se anima a mano con ease-out quart (300–520 ms): es la curva del video de referencia
  // (grabado en Safari); el scrollTo suave de Chrome arranca lento y se siente distinto
  let animacion = 0;
  const cortar = (reponer = false) => { cancelAnimationFrame(animacion); animacion = 0; if (reponer) imantar(); };
  const ir = (i) => {
    const x = destino(Math.max(0, Math.min(i, tarjetas().length - 1)));
    cortar();
    const desde = pista.scrollLeft, d = x - desde;
    soltar();
    if (quieto.matches || Math.abs(d) <= .5) { pista.scrollLeft = x; imantar(); return; }
    const dur = Math.min(520, Math.max(300, 240 + Math.abs(d) * .35)), t0 = performance.now();
    const cuadro = (t) => {
      const p = Math.min(1, Math.max(0, (t - t0) / dur));
      pista.scrollLeft = desde + d * (1 - (1 - p) ** 4);
      if (p < 1) { animacion = requestAnimationFrame(cuadro); return; }
      pista.scrollLeft = x;
      animacion = requestAnimationFrame(() => { animacion = 0; imantar(); });
    };
    animacion = requestAnimationFrame(cuadro);
  };

  // desvanecido de los bordes: el derecho mientras queden tarjetas; el izquierdo al moverse o al llegar al final
  const masc = { izq: 0, der: 1, metaIzq: -1, metaDer: -1, desdeIzq: 0, desdeDer: 1, t0: 0, cuadro: 0 };
  const pintar = () => {
    const g = `linear-gradient(90deg, rgba(0,0,0,${(1 - masc.izq).toFixed(3)}) 0%, #000 9%, #000 86%, rgba(0,0,0,${(1 - masc.der).toFixed(3)}) 100%)`;
    pista.style.webkitMaskImage = g;
    pista.style.maskImage = g;
  };
  const mascara = (moviendo, inmediato = false) => {
    if (movil()) {
      cancelAnimationFrame(masc.cuadro); masc.cuadro = 0; masc.metaIzq = masc.metaDer = -1;
      pista.style.webkitMaskImage = pista.style.maskImage = "none";
      return;
    }
    const max = maximo(), alInicio = pista.scrollLeft <= 1, alFinal = max <= 1 || pista.scrollLeft >= max - 1;
    const izq = alInicio ? 0 : (moviendo || alFinal) ? 1 : 0, der = alFinal ? 0 : 1;
    const cambia = izq !== masc.metaIzq || der !== masc.metaDer;
    if (!cambia && masc.cuadro) return;
    masc.metaIzq = izq; masc.metaDer = der;
    if (inmediato || quieto.matches) { cancelAnimationFrame(masc.cuadro); masc.cuadro = 0; masc.izq = izq; masc.der = der; pintar(); return; }
    if (!cambia) { pintar(); return; }
    cancelAnimationFrame(masc.cuadro);
    masc.desdeIzq = masc.izq; masc.desdeDer = masc.der; masc.t0 = performance.now();
    const cuadro = (t) => {
      const p = Math.min(1, Math.max(0, (t - masc.t0) / FUNDIDO)), e = 1 - (1 - p) ** 3;
      masc.izq = masc.desdeIzq + (izq - masc.desdeIzq) * e;
      masc.der = masc.desdeDer + (der - masc.desdeDer) * e;
      pintar();
      masc.cuadro = p < 1 ? requestAnimationFrame(cuadro) : 0;
    };
    masc.cuadro = requestAnimationFrame(cuadro);
  };

  // avance solo: cada 6 s, si se ve al menos un cuarto del carrusel y nadie lo está tocando
  let reloj = 0, encima = false, visible = false, enFoco = false;
  let presionado = false, dudando = false, arrastrando = false, seMovio = false;
  const parar = () => { clearInterval(reloj); reloj = 0; };
  const andar = () => {
    parar();
    if (encima || enFoco || !visible || presionado || quieto.matches) return;
    reloj = setInterval(() => {
      const n = tarjetas().length;
      if (n < 2) return;
      const i = cercana();
      ir(i >= n - 1 ? 0 : i + 1);
    }, INTERVALO);
  };

  // al quedarse quieto, termina de encajar en la tarjeta más cercana
  let espera = 0;
  const asentar = () => {
    if (presionado || dudando || arrastrando || animacion) return;
    const i = cercana();
    if (Math.abs(destino(i) - pista.scrollLeft) > 1) { ir(i); return; }
    mascara(false);
    if (!encima) andar();
  };
  const programar = () => { clearTimeout(espera); espera = setTimeout(asentar, ESPERA); };

  // arrastre con mouse o lápiz
  let inicio = 0, dx = 0, x0 = 0, y0 = 0, s0 = 0, punteroEnlace = null;
  pista.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" || e.button !== 0) return;
    if (e.target.closest(INTERACTIVO)) { punteroEnlace = e.pointerId; parar(); cortar(true); return; }
    punteroEnlace = null; parar(); cortar();
    presionado = true; seMovio = false; inicio = cercana(); dx = 0;
    x0 = e.clientX; y0 = e.clientY; s0 = pista.scrollLeft;
    soltar(); dudando = true; arrastrando = false;
  }, true);
  pista.addEventListener("pointermove", (e) => {
    if (!presionado || e.pointerType === "touch") return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    dx = mx;
    if (dudando) {
      if (Math.max(Math.abs(mx), Math.abs(my)) < ARRASTRE_MIN) return;
      dudando = false;
      if (Math.abs(my) >= Math.abs(mx)) return; // gesto vertical: no arrastra
      arrastrando = true; soltar(); pista.style.cursor = "grabbing";
      if (!pista.hasPointerCapture(e.pointerId)) pista.setPointerCapture(e.pointerId);
    }
    if (!arrastrando) return;
    if (Math.abs(mx) > 1) seMovio = true;
    if (seMovio) { e.preventDefault(); pista.scrollLeft = limitar(s0 - mx); mascara(true); }
  }, true);
  const terminar = (e) => {
    if (e.pointerType === "touch") return;
    if (punteroEnlace === e.pointerId) { punteroEnlace = null; if (!encima) andar(); return; }
    if (!presionado) return;
    const eraArrastre = arrastrando;
    presionado = dudando = arrastrando = false;
    if (!eraArrastre) imantar(); // tras un arrastre, el imán vuelve cuando termina la animación
    pista.style.cursor = "";
    if (pista.hasPointerCapture(e.pointerId)) pista.releasePointerCapture(e.pointerId);
    if (!eraArrastre) { mascara(false); if (!encima) andar(); return; }
    ir(paso(inicio, dx));
    programar();
  };
  pista.addEventListener("pointerup", terminar, true);
  addEventListener("pointerup", terminar); // si se suelta fuera sin haber arrastrado
  pista.addEventListener("pointercancel", (e) => {
    if (e.pointerType === "touch") return;
    if (punteroEnlace === e.pointerId) { punteroEnlace = null; if (!encima) andar(); return; }
    presionado = dudando = arrastrando = false;
    pista.style.cursor = "";
    if (pista.hasPointerCapture(e.pointerId)) pista.releasePointerCapture(e.pointerId);
    imantar(); mascara(false);
    if (!encima) andar();
  }, true);
  // tras arrastrar, el clic que suelta no abre enlaces
  pista.addEventListener("click", (e) => { if (seMovio) { e.preventDefault(); e.stopPropagation(); seMovio = false; } }, true);
  pista.addEventListener("pointerenter", (e) => { if (e.pointerType !== "touch") { encima = true; parar(); } });
  pista.addEventListener("pointerleave", (e) => { if (e.pointerType !== "touch") { encima = false; if (!presionado) andar(); } });

  // arrastre con el dedo: lo vertical mueve la página, lo horizontal pasa de tarjeta
  let tocando = false, decidido = false, horizontal = false;
  pista.addEventListener("touchstart", (e) => {
    if (e.target.closest(INTERACTIVO)) return;
    const t = e.touches[0];
    if (!t) return;
    tocando = true; presionado = true; dudando = true; arrastrando = false; seMovio = false;
    decidido = false; horizontal = false; inicio = cercana(); dx = 0;
    x0 = t.clientX; y0 = t.clientY; s0 = pista.scrollLeft;
    parar(); cortar(); soltar();
  }, { passive: true });
  pista.addEventListener("touchmove", (e) => {
    if (!tocando || e.touches.length !== 1) return;
    const t = e.touches[0], mx = t.clientX - x0, my = t.clientY - y0;
    dx = mx;
    if (!decidido) {
      if (Math.max(Math.abs(mx), Math.abs(my)) < ARRASTRE_MIN) return;
      decidido = true; dudando = false; horizontal = Math.abs(mx) > Math.abs(my); arrastrando = horizontal;
    }
    if (!horizontal) return;
    if (Math.abs(mx) > 1) seMovio = true;
    if (seMovio) { e.preventDefault(); pista.scrollLeft = limitar(s0 - mx); mascara(true); }
  }, { passive: false });
  const finToque = (e) => {
    if (e.touches.length > 0) return;
    tocando = decidido = horizontal = false;
    if (!presionado) return;
    const movio = seMovio;
    presionado = dudando = arrastrando = false;
    if (!movio) imantar();
    if (movio) { ir(paso(inicio, dx)); programar(); }
    else { mascara(false); if (!encima) andar(); }
  };
  pista.addEventListener("touchend", finToque, { passive: true });
  pista.addEventListener("touchcancel", finToque, { passive: true });

  // trackpad o rueda horizontal: scroll nativo con imán
  pista.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) return;
    parar(); cortar(true); mascara(true); programar();
  }, { passive: true });
  pista.addEventListener("scroll", () => { mascara(true); if (!presionado) programar(); }, { passive: true });

  // teclado: flechas, Inicio y Fin, una tarjeta por pulsación
  pista.addEventListener("keydown", (e) => {
    const n = tarjetas().length, i = cercana();
    const meta = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: n - 1 }[e.key];
    if (meta === undefined) return;
    e.preventDefault(); parar(); ir(meta);
  });
  seccion.addEventListener("focusin", (e) => { if (e.target.matches(":focus-visible")) { enFoco = true; parar(); } });
  seccion.addEventListener("focusout", (e) => { if (!seccion.contains(e.relatedTarget)) { enFoco = false; andar(); } });

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting && e.intersectionRatio >= .25;
    visible ? andar() : parar();
  }, { threshold: [0, .25] }).observe(pista);
  new ResizeObserver(() => { mascara(false, true); programar(); }).observe(pista);
  quieto.addEventListener("change", andar);
  mascara(false, true);

  // entrada: título y caja suben, nota y estrellas crecen; cada reseña aparece al entrar en la vista
  seccion.classList.add("tm-anima");
  const entrar = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    seccion.classList.add("tm-entra");
    entrar.disconnect();
  });
  entrar.observe(seccion.querySelector(".tm-caja"));
  const verTarjeta = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("tm-vista");
    verTarjeta.unobserve(e.target);
  }));
  tarjetas().forEach((t) => verTarjeta.observe(t));

  // punto que sigue al mouse dentro de la sección, con el resorte del original (rigidez 656, amortiguación 56, masa 0,1)
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    const punto = document.createElement("div");
    punto.className = "tm-cursor";
    punto.setAttribute("aria-hidden", "true");
    document.body.append(punto);
    const K = 656, C = 56, M = .1;
    let x = 0, y = 0, vx = 0, vy = 0, mx = 0, my = 0, activo = false, cuadro = 0, antes = 0;
    const mover = (t) => {
      const dt = Math.min(.05, Math.max(0, (t - antes) / 1000)), pasos = Math.max(1, Math.ceil(dt / .001)), h = dt / pasos;
      antes = t;
      for (let k = 0; k < pasos; k++) {
        vx += (-K * (x - mx) - C * vx) / M * h; vy += (-K * (y - my) - C * vy) / M * h;
        x += vx * h; y += vy * h;
      }
      if (quieto.matches) { x = mx; y = my; vx = vy = 0; }
      punto.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      const llego = Math.abs(x - mx) < .05 && Math.abs(y - my) < .05 && Math.abs(vx) < .5 && Math.abs(vy) < .5;
      cuadro = llego ? 0 : requestAnimationFrame(mover);
    };
    const ocultar = () => { activo = false; punto.classList.remove("visible"); };
    seccion.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      mx = e.clientX; my = e.clientY - 1.5;
      if (!activo) { activo = true; x = mx; y = my; vx = vy = 0; punto.classList.add("visible"); }
      if (!cuadro) { antes = performance.now(); cuadro = requestAnimationFrame(mover); }
    }, { passive: true });
    seccion.addEventListener("pointerleave", ocultar);
    // si la página se desplaza y la sección deja de estar bajo el mouse, el punto se esconde
    addEventListener("scroll", () => {
      if (!activo) return;
      const r = seccion.getBoundingClientRect();
      if (mx < r.left || mx > r.right || my < r.top || my > r.bottom) ocultar();
    }, { passive: true });
  }
}
