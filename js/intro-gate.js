// Decide antes del primer pintado si se muestra la intro de la portada, para que el sitio no destelle detrás.
// Sin JS, con «reducir movimiento», con un diseño compartido (?diseno=) o con un ancla (#…) se entra directo.
(function () {
  if (window.top !== window.self) {
    try { window.top.location = window.location.href; } catch (error) { /* El navegador puede bloquear la navegación entre orígenes. */ }
  }
  var doc = document.documentElement;
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // El bucle es una vista previa disponible únicamente en el servidor local.
    var local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    var loop = local && (new URLSearchParams(location.search).get("intro") === "loop" || window.FC_INTRO_LOOP === true);
    if (!loop) {
      if (sessionStorage.getItem("fc-intro")) return;
      if (location.hash || /[?&]diseno=/.test(location.search)) return;
    }
    if (!("animate" in doc)) return;
    doc.classList.add("intro-on");
    // Si intro.js no llega a montarse (red caída, error), se libera la página.
    setTimeout(function () {
      if (!window.__fcIntro) doc.classList.remove("intro-on");
    }, 4000);
  } catch (error) {
    doc.classList.remove("intro-on");
  }
})();
