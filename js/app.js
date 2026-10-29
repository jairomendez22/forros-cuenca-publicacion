import {
  COLORS, EMBROIDERIES, MATERIALS, PARTS, PATTERNS, PIPING_COLORS,
  STITCH_COLORS, WHATSAPP_NUMBER, findById,
} from "./data.js?v=9";
import { cleanFreeText, getShareUrl, loadConfig, persistConfig } from "./state.js?v=2";
import {
  announce, bindView, exportDesignPng, render, showToast,
} from "./view.js?v=10";

const loaded = loadConfig();
const config = loaded.config;
const ui = { activePart: "back", activeTab: "color" };

const actions = {
  selectPart(partId) {
    if (!findById(PARTS, partId)) return;
    ui.activePart = partId;
    ui.activeTab = "color";
    renderAll();
    announce(`Zona seleccionada: ${findById(PARTS, partId).label}`);
  },
  selectTab(tabId) {
    ui.activeTab = tabId;
    renderAll();
  },
  selectOption(field, value) {
    if (field === "material") {
      if (!findById(MATERIALS, value)) return;
      config.material = value;
      commit(`Material seleccionado: ${findById(MATERIALS, value).label}`);
      return;
    }
    if (field === "piping") {
      if (!findById(PIPING_COLORS, value)) return;
      config.piping = value;
      commit(`Ribete seleccionado: ${findById(PIPING_COLORS, value).label}`);
      return;
    }
    if (field === "embroidery") {
      if (!findById(EMBROIDERIES, value)) return;
      config.embroidery.type = value;
      if (value !== "nombre" && value !== "logo") config.embroidery.text = "";
      commit(`Bordado seleccionado: ${findById(EMBROIDERIES, value).label}`);
      return;
    }

    const catalogs = { color: COLORS, pattern: PATTERNS, stitch: STITCH_COLORS };
    if (!catalogs[field] || !findById(catalogs[field], value)) return;
    config.zones[ui.activePart][field] = value;
    commit(`${findById(catalogs[field], value).label} aplicado a ${findById(PARTS, ui.activePart).label}`);
  },
  updateEmbroideryText(value) {
    config.embroidery.text = cleanFreeText(value, 80);
    persistConfig(config);
    renderAll({ controls: false });
  },
  updateVehicle(field, value) {
    if (field === "model") config.vehicle.model = cleanFreeText(value, 60);
    if (field === "year") config.vehicle.year = value.replace(/\D/gu, "").slice(0, 4);
    persistConfig(config);
    renderAll({ controls: false, seat: false });
  },
  share: shareDesign,
  saveImage: saveDesignImage,
  openWhatsApp,
};

bindView(actions);

// Asiento 3D: se carga cuando el configurador se acerca a la pantalla. Si el
// navegador no puede mostrarlo, queda el dibujo plano del asiento.
let asiento3d = null;
const escenario = document.querySelector("#seat-stage");
if (escenario && "IntersectionObserver" in window) {
  const vigia = new IntersectionObserver((entradas) => {
    if (!entradas.some((entrada) => entrada.isIntersecting)) return;
    vigia.disconnect();
    import("./asiento-real/configurador.js?v=22")
      .then(({ iniciarAsiento3D }) => {
        asiento3d = iniciarAsiento3D(escenario, { alElegirZona: (zona) => actions.selectPart(zona) });
        asiento3d?.actualizar(config, ui.activePart);
      })
      .catch(() => {
        // Sin 3D se mantiene el dibujo plano.
      });
  }, { rootMargin: "800px 0px" });
  vigia.observe(escenario);
}

renderAll();
if (loaded.warning) showToast(loaded.warning);
else if (loaded.source === "local") showToast("Recuperamos tu último diseño guardado en este dispositivo.");

function commit(message) {
  persistConfig(config);
  renderAll();
  announce(message);
}

function renderAll(options) {
  render(config, ui, options);
  asiento3d?.actualizar(config, ui.activePart);
}

async function saveDesignImage() {
  showToast("Preparando la imagen…");
  try {
    const result = await exportDesignPng();
    if (result === "shared") showToast("Imagen lista para guardar o compartir.");
    if (result === "downloaded") showToast("Imagen del diseño descargada.");
  } catch {
    showToast("No se pudo guardar la imagen en este navegador.");
  }
}

async function shareDesign() {
  persistConfig(config);
  const url = getShareUrl(config);
  const shareData = { title: "Mi diseño de Forros Cuenca", text: "Mira el diseño que armé en Forros Cuenca.", url };
  if (navigator.share) {
    try {
      await navigator.share(shareData);
      showToast("Diseño compartido.");
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  const copied = await copyText(url);
  showToast(copied ? "Enlace del diseño copiado." : "No se pudo copiar. Usa la dirección del navegador.");
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    let copied = false;
    try { copied = document.execCommand("copy"); } catch { copied = false; }
    input.remove();
    return copied;
  }
}

function openWhatsApp() {
  persistConfig(config);
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildWhatsAppMessage())}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function buildWhatsAppMessage() {
  const combinations = PARTS.map((part) => {
    const zone = config.zones[part.id];
    return `• ${part.number}. ${part.label}: ${findById(COLORS, zone.color).label} · ${findById(PATTERNS, zone.pattern).label}`;
  });
  const stitches = PARTS.map((part) => `• ${part.label}: ${findById(STITCH_COLORS, config.zones[part.id].stitch).label}`);
  const embroidery = findById(EMBROIDERIES, config.embroidery.type).label;
  const cleanEmbroidery = cleanFreeText(config.embroidery.text, 80).trim();
  const requiresEmbroideryText = ["nombre", "logo"].includes(config.embroidery.type);
  const embroideryText = cleanEmbroidery ? `: ${cleanEmbroidery}` : requiresEmbroideryText ? ": (por indicar)" : "";
  const vehicleModel = cleanFreeText(config.vehicle.model, 60).trim();

  // lo que el cliente estaba viendo al tocar el botón (js/secciones.js lo deja en <html data-interes>)
  const interes = document.documentElement.dataset.interes;
  return [
    "Hola, Forros Cuenca. Quiero cotizar esta orden de tapizado:", "",
    ...(interes ? [`Me interesa: ${interes}`, ""] : []),
    "*VEHÍCULO*", `Marca y modelo: ${vehicleModel || "No indicado"}`, `Año: ${config.vehicle.year.trim() || "No indicado"}`, "",
    "*MATERIAL*", findById(MATERIALS, config.material).label, "",
    "*RIBETE DE CONTRASTE*", findById(PIPING_COLORS, config.piping).label, "",
    "*COMBINACIÓN POR ZONA*", ...combinations, "",
    "*HILO*", ...stitches, "",
    "*BORDADO*", `${embroidery}${embroideryText}`, "",
    "*ENLACE PARA ABRIR EL DISEÑO EXACTO*", getShareUrl(config),
  ].join("\n");
}
