// Carrusel de la portada: un solo asiento que va cambiando de forro con un fundido.
// Los diseños están en el HTML (.hero-slide); este módulo solo alterna cuál se ve.
const carousel = document.querySelector("[data-hero-carousel]");
const INTERVAL = 4500;

if (carousel) {
  const slides = [...carousel.querySelectorAll(".hero-slide")];
  const dotHost = document.querySelector("[data-hero-dots]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let current = 0;
  let timer = null;
  let paused = false;

  // Pausa manual: detiene el carrusel y la franja de marcas (WCAG 2.2.2).
  const pauseButton = document.createElement("button");
  pauseButton.type = "button";
  pauseButton.className = "hero-pause";
  pauseButton.addEventListener("click", () => setPaused(!paused));
  document.querySelector("[data-hero-status]")?.append(pauseButton);

  function setPaused(value) {
    paused = value;
    pauseButton.setAttribute("aria-pressed", String(paused));
    pauseButton.setAttribute("aria-label", paused ? "Reanudar animaciones" : "Pausar animaciones");
    document.documentElement.classList.toggle("motion-paused", paused);
    restart();
  }

  const dots = slides.map((_, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "hero-dot";
    dot.setAttribute("aria-label", `Ver diseño ${index + 1} de ${slides.length}`);
    dot.addEventListener("click", () => {
      show(index);
      restart();
    });
    dotHost?.append(dot);
    return dot;
  });

  function show(index) {
    const previous = current;
    current = (index + slides.length) % slides.length;
    const following = (current + 1) % slides.length;
    slides.forEach((slide, i) => {
      const active = i === current;
      slide.classList.toggle("is-active", active);
      // Solo existen para el navegador la actual, la anterior (se desvanece) y la
      // siguiente (se precarga); el resto queda en display:none y no se descarga.
      slide.classList.toggle("is-prev", i === previous && !active);
      slide.classList.toggle("is-next", i === following && !active);
      if (active) slide.removeAttribute("aria-hidden");
      else slide.setAttribute("aria-hidden", "true");
      if (active && slide.loading === "lazy") slide.loading = "eager";
    });
    dots.forEach((dot, i) => dot.setAttribute("aria-pressed", String(i === current)));
    // Precarga el siguiente para que el fundido no muestre un hueco.
    const next = slides[(current + 1) % slides.length];
    if (next.loading === "lazy") next.loading = "eager";
  }

  function restart() {
    window.clearInterval(timer);
    if (paused || keyboardFocus || reduceMotion.matches || document.hidden || slides.length < 2) return;
    timer = window.setInterval(() => show(current + 1), INTERVAL);
  }

  // Pausa mientras se navega por los puntos con el teclado (no afecta al mouse).
  let keyboardFocus = false;
  dotHost?.addEventListener("focusin", (event) => {
    keyboardFocus = event.target.matches(":focus-visible");
    if (keyboardFocus) window.clearInterval(timer);
  });
  dotHost?.addEventListener("focusout", () => {
    if (keyboardFocus) {
      keyboardFocus = false;
      restart();
    }
  });

  document.addEventListener("visibilitychange", restart);
  reduceMotion.addEventListener?.("change", restart);
  show(0);
  setPaused(false);
}
