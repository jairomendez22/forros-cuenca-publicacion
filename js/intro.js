// Intro corta de la portada (~2,6 s): chispa roja, «TU AUTO. TU ESTILO.» y el logo, luego se ve el sitio.
// Solo se monta si js/intro-gate.js puso html.intro-on. Todas las animaciones son WAAPI creadas a la vez con
// retrasos y cuelgan de una animación «maestra»: pausar (pestaña oculta) afecta a todo por igual.
// No se puede saltar (decisión del dueño); dura 2,6 s, sale una vez por sesión y nunca con «reducir movimiento».
const doc = document.documentElement;

const T = { phrase: 300, logo: 1100, end: 2600 };
const EASE = "cubic-bezier(.2,.75,.2,1)";
const EASE_IN = "cubic-bezier(.6,0,.85,.25)";
// Vista previa disponible solo en local, respetando siempre «reducir movimiento».
const LOCAL = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");
const LOOP = LOCAL && !REDUCED_MOTION.matches
  && (new URLSearchParams(location.search).get("intro") === "loop" || window.FC_INTRO_LOOP === true);

if (doc.classList.contains("intro-on")) mount();

function mount() {
  if (REDUCED_MOTION.matches) {
    doc.classList.remove("intro-on");
    return;
  }
  const tpl = document.getElementById("intro-tpl");
  if (!tpl) {
    doc.classList.remove("intro-on");
    return;
  }
  window.__fcIntro = true;
  try {
    sessionStorage.setItem("fc-intro", "1");
  } catch {
    // Sin almacenamiento (modo privado estricto): la intro se verá de nuevo al recargar, nada más.
  }

  document.body.append(tpl.content.cloneNode(true));
  const intro = document.getElementById("intro");
  const $ = (selector) => intro.querySelector(selector);
  const $$ = (selector) => [...intro.querySelectorAll(selector)];
  const lite = (navigator.deviceMemory || 8) <= 2 || (navigator.hardwareConcurrency || 8) <= 4;
  if (lite) intro.classList.add("intro-lite");
  const blur = (px) => (lite ? "blur(0px)" : `blur(${px}px)`);

  // El resto de la página queda inerte mientras dura la intro.
  const background = [...document.querySelectorAll("body > :not(#intro):not(script):not(template)")];
  background.forEach((el) => (el.inert = true));

  const anims = [];
  const A = (el, keyframes, start, duration, easing = EASE, fill = "both") => {
    const anim = el.animate(keyframes, { delay: start, duration, easing, fill });
    anims.push(anim);
    return anim;
  };
  const master = intro.animate([{ opacity: 1 }, { opacity: 1 }], { duration: T.end, fill: "forwards" });
  anims.push(master);

  // Pseudoaleatorio con semilla: el glitch es igual en cada visita.
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const glitch = (el, start, duration, amp, steps = 8) => {
    const kf = [];
    for (let i = 0; i <= steps; i++) {
      const last = i === steps;
      const top = Math.round(rnd() * 80);
      const frame = {
        offset: i / steps,
        easing: "steps(1, end)",
        opacity: last || i === 0 ? 0 : rnd() > 0.25 ? 0.9 : 0,
        transform: last ? "none" : `translate(${((rnd() - 0.5) * 2 * amp).toFixed(1)}px, ${((rnd() - 0.5) * amp * 0.3).toFixed(1)}px)`,
      };
      if (!lite) frame.clipPath = last ? "inset(0 0 0 0)" : `inset(${top}% 0 ${Math.max(0, 100 - top - 10 - Math.round(rnd() * 30))}% 0)`;
      kf.push(frame);
    }
    return A(el, kf, start, duration, "linear");
  };

  // Grano: ruido generado una sola vez y desplazado por CSS.
  const noise = document.createElement("canvas");
  noise.width = noise.height = 96;
  const nctx = noise.getContext("2d");
  const img = nctx.createImageData(96, 96);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (rnd() * 255) | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  nctx.putImageData(img, 0, 0);
  $(".intro-grain").style.backgroundImage = `url(${noise.toDataURL()})`;

  $$(".intro-corner, .intro-hud").forEach((el) => A(el, [{ opacity: 0 }, { opacity: 1 }], 80, 300));

  /* ---------- Chispa (0–0,45 s) ---------- */
  A($(".i-spark"), [
    { transform: "scale(0)", opacity: 0, offset: 0 },
    { transform: "scale(1.3)", opacity: 1, offset: 0.45 },
    { transform: "scale(2.6)", opacity: 1, offset: 0.7 },
    { transform: "scale(0)", opacity: 0, offset: 1 },
  ], 0, 520, "ease-in-out");
  A($(".i-ring"), [{ transform: "scale(.1)", opacity: 0 }, { transform: "scale(.7)", opacity: 1, offset: 0.4 }, { transform: "scale(1.35)", opacity: 0 }], 60, 520);
  A($(".i-flare"), [{ transform: "scaleX(0)", opacity: 0 }, { transform: "scaleX(1)", opacity: 1, offset: 0.4 }, { transform: "scaleX(1.15) scaleY(.4)", opacity: 0 }], 260, 360);

  /* ---------- Frase (0,3–1,1 s) ---------- */
  const phrase = $(".i-lines");
  [...phrase.querySelectorAll("[data-split]")].forEach((line, li) => {
    const text = line.dataset.split;
    line.textContent = "";
    [...text].forEach((char, i) => {
      const span = document.createElement("span");
      span.textContent = char;
      if (char === ".") span.className = "dot";
      line.append(span);
      A(span, [
        { opacity: 0, transform: "translateY(.3em) scale(1.08)", filter: blur(10) },
        { opacity: 1, transform: "none", filter: blur(0) },
      ], T.phrase + li * 170 + i * 18, 280);
    });
  });
  A(phrase, [
    { offset: 0, opacity: 1, transform: "none", textShadow: "0 0 0 transparent", easing: "steps(1, end)" },
    { offset: 0.25, opacity: 1, transform: "translateX(-8px) skewX(-8deg)", textShadow: "-7px 0 #ff1f2d, 7px 0 #19e3ff", easing: "steps(1, end)" },
    { offset: 0.5, opacity: 1, transform: "translateX(6px)", textShadow: "5px 0 #ff1f2d, -5px 0 #19e3ff", easing: "steps(1, end)" },
    { offset: 0.75, opacity: 0.6, transform: "translateX(-4px) scaleY(.6)", textShadow: "-10px 0 #ff1f2d, 3px 0 #19e3ff", easing: "steps(1, end)" },
    { offset: 1, opacity: 0, transform: "scaleY(.02) scaleX(1.2)", textShadow: "0 0 0 transparent" },
  ], T.logo - 180, 180, "linear", "forwards");

  /* ---------- Logo (1,1–2,6 s) ---------- */
  A($(".intro-flash"), [{ opacity: 0 }, { opacity: 0.9, offset: 0.2 }, { opacity: 0 }], T.logo - 40, 360, "ease-out");
  const logo = $(".i-logo");
  A(logo, [
    { opacity: 0, transform: "scale(1.12)", filter: "brightness(2.2)" },
    { opacity: 1, transform: "scale(1)", filter: "brightness(1)" },
  ], T.logo, 520);
  A(logo, [{ transform: "scale(1)" }, { transform: "scale(1.035)" }], T.logo + 520, T.end - T.logo - 520, "linear", "forwards");
  $$(".i-logo-ghost").forEach((ghost, i) => glitch(ghost, T.logo + i * 40, 380, 18));
  const pix = $(".i-pix");
  for (let i = 0; i < 96; i++) {
    const block = document.createElement("i");
    pix.append(block);
    A(block, [{ opacity: 1 }, { opacity: 0 }], T.logo + rnd() * 320, 30, "steps(1, end)");
  }
  A($(".i-shine i"), [{ transform: "translateX(-120%)" }, { transform: "translateX(120%)" }], T.logo + 560, 650, "cubic-bezier(.5,0,.3,1)");
  A($(".i-glow"), [{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "scale(1)", offset: 0.4 }, { opacity: 0.55, transform: "scale(1.1)" }], T.logo, 1100);
  A($(".i-est"), [{ opacity: 0, letterSpacing: ".5em" }, { opacity: 1, letterSpacing: ".2em" }], T.logo + 420, 420);

  /* ---------- Salida ---------- */
  let done = false;

  function finish() {
    if (done) return;
    done = true;
    document.removeEventListener("visibilitychange", onVisibility);
    REDUCED_MOTION.removeEventListener("change", onMotionChange);
    const hadFocus = intro.contains(document.activeElement);
    background.forEach((el) => (el.inert = false));
    doc.classList.remove("intro-on");
    intro.style.pointerEvents = "none";
    const out = intro.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: REDUCED_MOTION.matches ? "none" : "scale(1.06)" }], { duration: REDUCED_MOTION.matches ? 0 : 350, easing: EASE_IN, fill: "forwards" });
    out.onfinish = () => {
      anims.forEach((anim) => anim.cancel());
      intro.remove();
      if (LOOP && !REDUCED_MOTION.matches) {
        setTimeout(() => {
          doc.classList.add("intro-on");
          mount();
        }, 900);
      }
    };
    if (hadFocus) {
      const main = document.getElementById("contenido");
      if (main) {
        main.setAttribute("tabindex", "-1");
        main.focus({ preventScroll: true });
        main.addEventListener("blur", () => main.removeAttribute("tabindex"), { once: true });
      }
    }
  }

  function onMotionChange() {
    if (REDUCED_MOTION.matches) finish();
  }

  // Solo se reanudan las que se pausaron aquí: play() sobre una animación terminada la reiniciaría.
  let pausedByUs = [];
  function onVisibility() {
    if (document.hidden) {
      pausedByUs = anims.filter((anim) => anim.playState === "running");
      pausedByUs.forEach((anim) => anim.pause());
    } else {
      pausedByUs.forEach((anim) => anim.play());
      pausedByUs = [];
    }
  }

  // La salida cuelga de la promesa de la animación maestra, no de rAF (que se detiene en segundo plano).
  master.finished.then(finish, () => {});
  document.addEventListener("visibilitychange", onVisibility);
  REDUCED_MOTION.addEventListener("change", onMotionChange);
  intro.focus({ preventScroll: true });
}
