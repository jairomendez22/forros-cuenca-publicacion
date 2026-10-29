import {
  COLORS,
  EMBROIDERIES,
  MATERIALS,
  PARTS,
  PATTERNS,
  PIPING_COLORS,
  PRECIO_DESDE,
  STITCH_COLORS,
  TABS,
  findById,
} from "./data.js?v=9";
import { VEHICLE_BRANDS, findBrand, modelYears } from "./vehicles.js";

const elements = {
  panel: document.querySelector("#config-panel"),
  tabs: [...document.querySelectorAll("[data-tab]")],
  nextButton: document.querySelector("#config-next-button"),
  nextLabel: document.querySelector(".config-next-label"),
  materialBadge: document.querySelector("#material-badge"),
  grain: document.querySelector("#grain-overlay"),
  piping: document.querySelector("#piping-lines"),
  embroideryPreview: document.querySelector("#embroidery-preview"),
  shareButtons: [document.querySelector("#summary-share-button")],
  saveImageButton: document.querySelector("#save-image-button"),
  mobileQuoteButton: document.querySelector("#mobile-quote-button"),
  whatsappButtons: [...document.querySelectorAll('[data-action="whatsapp"]')],
  vehicleFields: [...document.querySelectorAll("[data-vehicle-field]")],
  vehicleBrand: document.querySelector('[data-vehicle-select="brand"]'),
  vehicleModel: document.querySelector('[data-vehicle-select="model"]'),
  vehicleYear: document.querySelector('[data-vehicle-select="year"]'),
  vehicleSelectWraps: [...document.querySelectorAll("[data-vehicle-select-wrap]")],
  vehicleCustom: [...document.querySelectorAll("[data-vehicle-custom]")],
  zones: [...document.querySelectorAll(".zone[data-part]")],
  zoneChipHost: document.querySelector("#zone-chips"),
  zoneChips: [],
  seat: document.querySelector("#seat"),
  seatStage: document.querySelector("#seat-stage"),
  navToggle: document.querySelector("#nav-toggle"),
  siteNav: document.querySelector("#site-nav"),
  toast: document.querySelector("#toast"),
  announcer: document.querySelector("#announcer"),
};

let toastTimer;

export function bindView(actions) {

  for (const zone of elements.zones) {
    zone.addEventListener("click", () => actions.selectPart(zone.dataset.part));
    zone.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      actions.selectPart(zone.dataset.part);
    });
  }

  elements.zoneChips = PARTS.map((part) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "zone-chip";
    chip.dataset.zoneChip = part.id;
    chip.setAttribute("aria-pressed", "false");
    // Nombre accesible «Respaldo, zona 1» sin aria-label: empieza por el texto visible.
    chip.innerHTML = `<span aria-hidden="true">${part.number}</span>${part.short}<small class="sr-only">, zona ${part.number}</small>`;
    if (part.parent) chip.classList.add("is-detail");
    chip.addEventListener("click", () => actions.selectPart(part.id));
    elements.zoneChipHost.append(chip);
    return chip;
  });

  // Las sub-zonas quedan tras "+ Detalles" para no abrumar en el primer vistazo.
  const detailCount = PARTS.filter((part) => part.parent).length;
  const detailToggle = document.createElement("button");
  detailToggle.type = "button";
  detailToggle.className = "zone-chip zone-detail-toggle";
  detailToggle.setAttribute("aria-expanded", "false");
  detailToggle.addEventListener("click", () => {
    setDetailsOpen(!elements.zoneChipHost.classList.contains("show-details"));
  });
  elements.detailToggle = detailToggle;
  elements.detailLabel = (open) => open ? "− Menos zonas" : `+ Detalles (${detailCount})`;
  detailToggle.textContent = elements.detailLabel(false);
  elements.zoneChipHost.append(detailToggle);

  for (const tab of elements.tabs) {
    tab.addEventListener("click", () => actions.selectTab(tab.dataset.tab));
    tab.addEventListener("keydown", (event) => handleTabKeyboard(event, actions));
  }

  elements.nextButton.addEventListener("click", (event) => {
    const nextTabId = elements.nextButton.dataset.nextTab;
    if (!nextTabId) return;
    actions.selectTab(nextTabId);
    // En Bordado el botón desaparece: conserva el foco en el paso alcanzado.
    if (elements.nextButton.hidden) {
      elements.tabs.find((tab) => tab.dataset.tab === nextTabId)?.focus({ preventScroll: true });
    }
    // Toque o clic (no teclado): vuelve a mostrar las pestañas y el inicio del paso.
    if (event.detail > 0) revealTabs();
  });

  elements.panel.addEventListener("click", (event) => {
    const option = event.target.closest("button[data-field][data-value]");
    if (!option) return;

    const { field, value } = option.dataset;
    actions.selectOption(field, value);

    elements.panel.querySelector(`button[data-field="${field}"][data-value="${value}"]`)
      ?.focus({ preventScroll: true });
  });

  elements.panel.addEventListener("input", (event) => {
    if (!event.target.matches("[data-embroidery-text]")) return;
    actions.updateEmbroideryText(event.target.value);
  });

  for (const input of elements.vehicleFields) {
    input.addEventListener("input", () => {
      if (input.dataset.vehicleField === "year") input.value = input.value.replace(/\D/gu, "");
      actions.updateVehicle(input.dataset.vehicleField, input.value);
    });
  }

  // Selector marca → modelo → año. Se guarda como texto («Toyota Hilux», «2020») para
  // que los enlaces y el mensaje de WhatsApp sigan igual que con el campo libre.
  replaceOptions(elements.vehicleBrand, [
    '<option value="">Elige la marca</option>',
    ...VEHICLE_BRANDS.map((item) => `<option value="${item.brand}">${item.brand}</option>`),
    `<option value="${OTHER}">Otra marca</option>`,
  ].join(""));
  elements.vehicleBrand.addEventListener("change", () => {
    const brand = elements.vehicleBrand.value;
    vehicleUi.custom = brand === OTHER;
    actions.updateVehicle("model", vehicleUi.custom ? "" : brand);
    actions.updateVehicle("year", "");
    if (vehicleUi.custom) focusCustomField();
  });
  elements.vehicleModel.addEventListener("change", () => {
    const brand = elements.vehicleBrand.value;
    const model = elements.vehicleModel.value;
    vehicleUi.custom = model === OTHER;
    actions.updateVehicle("model", vehicleUi.custom ? `${brand} ` : [brand, model].filter(Boolean).join(" "));
    actions.updateVehicle("year", "");
    if (vehicleUi.custom) focusCustomField();
  });
  elements.vehicleYear.addEventListener("change", () => actions.updateVehicle("year", elements.vehicleYear.value));

  for (const button of elements.shareButtons) {
    button?.addEventListener("click", actions.share);
  }

  elements.saveImageButton?.addEventListener("click", actions.saveImage);

  for (const button of elements.whatsappButtons) {
    button.addEventListener("click", actions.openWhatsApp);
  }

  elements.navToggle?.addEventListener("click", () => {
    const willOpen = elements.navToggle.getAttribute("aria-expanded") !== "true";
    setNavigationOpen(willOpen);
  });
  for (const link of elements.siteNav?.querySelectorAll("a") ?? []) {
    link.addEventListener("click", () => setNavigationOpen(false));
  }
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setNavigationOpen(false);
  });

  initScrollReveals();
}

function setNavigationOpen(isOpen) {
  if (!elements.navToggle || !elements.siteNav) return;
  elements.navToggle.setAttribute("aria-expanded", String(isOpen));
  elements.navToggle.setAttribute("aria-label", isOpen ? "Cerrar menú" : "Abrir menú");
  elements.siteNav.classList.toggle("is-open", isOpen);
}

function initScrollReveals() {
  const sections = [...document.querySelectorAll(".reveal")];
  if (!("IntersectionObserver" in window)) return;
  document.documentElement.classList.add("reveal-ready");
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.1, rootMargin: "0px 0px -7% 0px" });
  for (const section of sections) observer.observe(section);
}

// En el móvil la tarjeta de controles se desplaza por dentro y las pestañas 3 × 2 no
// quedan fijas: si quedaron arriba, fuera de la vista, se desliza hasta ellas.
function revealTabs() {
  const bar = elements.tabs[0]?.parentElement;
  const card = bar?.closest(".controls-card");
  if (!card || card.scrollHeight <= card.clientHeight) return;
  const offset = bar.getBoundingClientRect().top - card.getBoundingClientRect().top - card.clientTop;
  if (offset >= 0) return;
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  card.scrollBy({ top: offset, behavior: smooth ? "smooth" : "auto" });
}

function handleTabKeyboard(event, actions) {
  const currentIndex = elements.tabs.indexOf(event.currentTarget);
  let nextIndex = currentIndex;

  if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex += 1;
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex -= 1;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = elements.tabs.length - 1;
  else return;

  event.preventDefault();
  nextIndex = (nextIndex + elements.tabs.length) % elements.tabs.length;
  const nextTab = elements.tabs[nextIndex];
  actions.selectTab(nextTab.dataset.tab);
  nextTab.focus();
}

export function render(config, ui, { controls = true, seat = true } = {}) {
  if (seat) paintSeat(config, ui.activePart);
  renderTabs(ui);
  renderNext(ui);
  renderVehicleFields(config.vehicle);
  renderQuoteLabel();
  if (controls) renderControls(config, ui);
}

function paintSeat(config, activePart) {
  for (const part of PARTS) {
    const zoneConfig = config.zones[part.id];
    const color = findById(COLORS, zoneConfig.color);
    const pattern = findById(PATTERNS, zoneConfig.pattern);
    const stitch = findById(STITCH_COLORS, zoneConfig.stitch);
    const isActive = part.id === activePart;
    const patternPaintId = pattern.svgId ? preparePattern(pattern, stitch, `${pattern.svgId}-${part.id}`) : null;

    for (const zoneId of part.svgZoneIds) {
      const zone = document.getElementById(zoneId);
      zone.style.fill = color.hex;
      zone.style.removeProperty("stroke");
      zone.classList.toggle("is-active", isActive);
      zone.setAttribute("aria-pressed", String(isActive));
    }

    for (const patternId of part.svgPatternIds) {
      const layer = document.getElementById(patternId);
      // Estilo en línea: la regla CSS `.pattern-layer{fill:none}` anula el atributo `fill`.
      layer.style.fill = patternPaintId ? `url(#${patternPaintId})` : "none";
    }

    const seam = document.querySelector(`#seams-${part.id}`);
    if (seam) {
      seam.style.stroke = stitch.hex;
    }
  }

  if (findById(PARTS, activePart)?.parent) setDetailsOpen(true);
  for (const chip of elements.zoneChips) {
    const isActive = chip.dataset.zoneChip === activePart;
    chip.setAttribute("aria-pressed", String(isActive));
    if (isActive) revealChip(chip);
  }

  const material = findById(MATERIALS, config.material);
  elements.materialBadge.textContent = material.label;
  elements.grain.setAttribute("opacity", config.material === "colombiano" ? ".2" : ".09");
  elements.piping.style.stroke = findById(PIPING_COLORS, config.piping).hex;

  paintEmbroidery(config.embroidery);
}

function setDetailsOpen(open) {
  elements.zoneChipHost.classList.toggle("show-details", open);
  elements.detailToggle.setAttribute("aria-expanded", String(open));
  elements.detailToggle.textContent = elements.detailLabel(open);
}

// Desliza la fila de zonas sin mover la página, para que el chip activo se vea
// también cuando la zona se eligió tocando el dibujo. Se mide en el siguiente
// fotograma, cuando los chips de detalle recién mostrados ya tienen tamaño.
let revealFrame = 0;
function revealChip(chip) {
  window.cancelAnimationFrame(revealFrame);
  revealFrame = window.requestAnimationFrame(() => {
    const host = elements.zoneChipHost;
    if (host.scrollWidth <= host.clientWidth) return;
    const hostBox = host.getBoundingClientRect();
    const chipBox = chip.getBoundingClientRect();
    const margin = 8;
    let delta = 0;
    if (chipBox.left < hostBox.left + margin) delta = chipBox.left - hostBox.left - margin;
    else if (chipBox.right > hostBox.right - margin) delta = chipBox.right - hostBox.right + margin;
    if (!delta) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    host.scrollBy({ left: delta, behavior: smooth ? "smooth" : "auto" });
  });
}

// Copia el <pattern> de origen con el hilo de una zona. El asiento usa
// «pattern-…-<zona>» y las muestras del panel «pv-<patrón>»: una sola definición.
function preparePattern(pattern, stitch, cloneId) {
  const source = document.getElementById(pattern.svgId);
  let clone = document.getElementById(cloneId);

  if (!clone) {
    clone = source.cloneNode(true);
    clone.id = cloneId;
    source.parentNode.append(clone);
  }

  // En los patrones cosidos, la trama usa el hilo elegido para esa zona.
  // Perforado conserva puntos oscuros porque representa orificios, no hilo.
  if (pattern.id !== "perforado") {
    // `data-groove` (en el trazo o en su grupo) es la hendidura oscura o el volumen del
    // acolchado: no toma el color del hilo.
    for (const line of clone.querySelectorAll("[stroke]:not([data-groove], [data-groove] *)")) line.setAttribute("stroke", stitch.hex);
  }

  return cloneId;
}

function paintEmbroidery(embroidery) {
  let text = "";
  if (embroidery.type === "forros-cuenca") text = "FORROS CUENCA";
  if (embroidery.type === "nombre") text = embroidery.text.trim() || "TU NOMBRE";
  if (embroidery.type === "logo") text = "LOGO";

  const preview = Array.from(text).slice(0, 20).join("");
  elements.embroideryPreview.textContent = preview;
  elements.embroideryPreview.style.display = preview ? "block" : "none";
  elements.embroideryPreview.setAttribute("font-size", preview.length > 14 ? "8" : "10");
}

function renderTabs(ui) {
  for (const tab of elements.tabs) {
    const isActive = tab.dataset.tab === ui.activeTab;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
  }

  elements.panel.setAttribute("aria-labelledby", `tab-${ui.activeTab}`);
}

function renderNext(ui) {
  const index = TABS.findIndex((tab) => tab.id === ui.activeTab);
  const nextTab = index >= 0 ? TABS[index + 1] : null;
  elements.nextButton.hidden = !nextTab;
  elements.nextButton.dataset.nextTab = nextTab?.id ?? "";
  // Sin aria-label: el nombre accesible es el texto visible («Siguiente: Patrón»).
  elements.nextLabel.textContent = nextTab ? `: ${nextTab.label}` : "";
}

const OTHER = "__otro";
const vehicleUi = { custom: false };

// Reconoce «Marca Modelo» del catálogo; cualquier otro texto se edita en modo libre.
function parseVehicle(text) {
  const value = text.trim();
  if (!value) return { brand: null, model: null };
  const brand = [...VEHICLE_BRANDS].sort((a, b) => b.brand.length - a.brand.length)
    .find((item) => value === item.brand || value.startsWith(`${item.brand} `));
  if (!brand) return { brand: null, model: null, unknown: true };
  const rest = value.slice(brand.brand.length).trim();
  const model = brand.models.find((item) => item.name === rest) ?? null;
  return { brand, model, unknown: Boolean(rest) && !model };
}

function setOptions(select, options, value) {
  const html = options.map(([optionValue, label]) => `<option value="${optionValue}">${label}</option>`).join("");
  if (select.dataset.options !== html) {
    replaceOptions(select, html);
    select.dataset.options = html;
  }
  select.value = value;
}

// La lista con appearance: base-select devuelve el foco al <select> al cerrarse;
// se espera un fotograma para que el cursor quede en el campo libre.
function focusCustomField() {
  window.requestAnimationFrame(() => {
    const input = elements.vehicleCustom[0].querySelector("input");
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  });
}

// Cambia solo las <option>: se conserva el <button><selectedcontent> del inicio, que
// permite dar a la lista desplegable los colores de la página (appearance: base-select).
function replaceOptions(select, html) {
  for (const option of select.querySelectorAll("option")) option.remove();
  select.insertAdjacentHTML("beforeend", html);
}

function renderVehicleFields(vehicle) {
  const parsed = parseVehicle(vehicle.model);
  if (parsed.unknown) vehicleUi.custom = true;
  const custom = vehicleUi.custom;

  for (const wrap of elements.vehicleSelectWraps) wrap.hidden = custom;
  for (const wrap of elements.vehicleCustom) wrap.hidden = !custom;
  elements.vehicleBrand.value = custom && !parsed.brand ? OTHER : parsed.brand?.brand ?? "";

  const brand = parsed.brand ?? findBrand(elements.vehicleBrand.value);
  setOptions(elements.vehicleModel, brand
    ? [["", "Elige el modelo"], ...brand.models.map((item) => [item.name, `${item.name} · ${item.type}`]), [OTHER, "Otro modelo"]]
    : [["", "Primero la marca"]], custom ? OTHER : parsed.model?.name ?? "");
  elements.vehicleModel.disabled = !brand;

  const years = parsed.model ? modelYears(parsed.model) : [];
  setOptions(elements.vehicleYear, parsed.model
    ? [["", "Elige el año"], ...years.map((year) => [year, year])]
    : [["", "Primero el modelo"]], years.includes(vehicle.year) ? vehicle.year : "");
  elements.vehicleYear.disabled = !parsed.model;

  for (const input of elements.vehicleFields) {
    const value = vehicle[input.dataset.vehicleField] ?? "";
    if (input.value !== value && document.activeElement !== input) input.value = value;
  }
}

function renderQuoteLabel() {
  const price = String(PRECIO_DESDE ?? "").trim();
  // la etiqueta cambia según la sección que se ve (js/secciones.js la deja en data-etiqueta)
  const etiqueta = elements.mobileQuoteButton.dataset.etiqueta || "Cotizar en WhatsApp";
  elements.mobileQuoteButton.textContent = price ? `${etiqueta} · Desde $${price}` : etiqueta;
}

// Encuadre de cada muestra de acolchado, en unidades del asiento: un acercamiento
// del mismo <pattern> que se pinta en el forro (x, y, ancho, alto).
const SAMPLE_VIEWS = {
  chevron: [256, 4, 108, 108],
  diamante: [0, 0, 60, 60],
  ondas: [0, 0, 66, 66],
  hexagonal: [0, 0, 60, 60],
  deportivo: [0, 0, 52, 52],
  perforado: [0, 0, 40, 40],
};
const DECORATIVE = 'aria-hidden="true" focusable="false"';
// Grano del cuero colombiano en la muestra: relieve propio (poros oscuros y crestas
// claras con mezcla normal) para que se note también sobre Negro y Blanco.
const GRAIN_SAMPLE = `<svg viewBox="0 0 92 40" preserveAspectRatio="xMidYMid slice" ${DECORATIVE}>`
  + '<filter id="grain-sample" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">'
  + '<feTurbulence type="fractalNoise" baseFrequency=".6" numOctaves="3" seed="7"/>'
  + '<feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0"/>'
  + '<feDiffuseLighting surfaceScale="1.3" lighting-color="#fff" result="relief"><feDistantLight azimuth="235" elevation="50"/></feDiffuseLighting>'
  + '<feColorMatrix in="relief" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.4 0 0 0 .952" result="pits"/>'
  + '<feColorMatrix in="relief" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1.4 0 0 0 -1.008" result="ridges"/>'
  + '<feMerge><feMergeNode in="pits"/><feMergeNode in="ridges"/></feMerge></filter>'
  + '<rect class="leather-grain" width="92" height="40" filter="url(#grain-sample)" opacity=".55"/></svg>';

function renderControls(config, ui) {
  const zone = config.zones[ui.activePart];
  const part = findById(PARTS, ui.activePart);
  const zoneColor = findById(COLORS, zone.color).hex;
  const zoneStitch = findById(STITCH_COLORS, zone.stitch);
  const backColor = findById(COLORS, config.zones.back.color).hex;
  const sideColor = findById(COLORS, config.zones.side.color).hex;

  const shownTab = elements.panel.dataset.view;
  elements.panel.dataset.view = ui.activeTab;

  if (ui.activeTab === "color") {
    // Si Color ya está a la vista, se actualizan la selección y el nombre de la zona.
    if (shownTab === "color") {
      elements.panel.querySelector(".choice-title span").textContent = ` · ${part.label}`;
      for (const option of elements.panel.querySelectorAll('button[data-field="color"]')) {
        option.setAttribute("aria-pressed", String(zone.color === option.dataset.value));
      }
      return;
    }
    elements.panel.innerHTML = optionGroup(`Color<span> · ${part.label}</span>`, "", COLORS.map((color) => optionTile({
      field: "color", value: color.id, label: color.label, ariaLabel: `Color ${color.label}`,
      pressed: zone.color === color.id, swatch: color.hex,
    })));
    return;
  }

  if (ui.activeTab === "pattern") {
    elements.panel.innerHTML = optionGroup(`Patrón<span> · ${part.label}</span>`, "is-square is-large", PATTERNS.map((pattern) => optionTile({
      field: "pattern", value: pattern.id, label: pattern.label, ariaLabel: `Patrón ${pattern.label}`,
      pressed: zone.pattern === pattern.id, swatch: zoneColor, art: patternSample(pattern, zoneStitch),
    })));
    return;
  }

  if (ui.activeTab === "stitch") {
    elements.panel.innerHTML = optionGroup(`Costura<span> · ${part.label}</span>`, "is-large", STITCH_COLORS.map((stitch) => optionTile({
      field: "stitch", value: stitch.id, label: stitch.label, ariaLabel: `Costura ${stitch.label}`,
      pressed: zone.stitch === stitch.id, swatch: zoneColor, art: stitchSample(stitch.hex),
    })));
    return;
  }

  if (ui.activeTab === "piping") {
    elements.panel.innerHTML = optionGroup("Ribete<span> · Todo el asiento</span>", "is-large", PIPING_COLORS.map((piping) => optionTile({
      field: "piping", value: piping.id, label: piping.label, ariaLabel: `Ribete ${piping.label}`,
      pressed: config.piping === piping.id, swatch: backColor, art: pipingSample(piping.hex, backColor, sideColor),
    })));
    return;
  }

  if (ui.activeTab === "material") {
    elements.panel.innerHTML = optionGroup("Material<span> · Todo el asiento</span>", "is-wide", MATERIALS.map((material) => optionTile({
      field: "material", value: material.id, label: material.label, ariaLabel: `Material ${material.label}${material.short ? `, ${material.short.toLowerCase()}` : ""}`,
      pressed: config.material === material.id, swatch: backColor, sampleClass: `is-${material.id}`,
      art: material.id === "colombiano" ? GRAIN_SAMPLE : "", note: material.short,
    })));
    return;
  }

  elements.panel.innerHTML = optionGroup("Bordado", "is-wide is-text", EMBROIDERIES.map((embroidery) => optionTile({
    field: "embroidery", value: embroidery.id, label: embroidery.label, ariaLabel: `Bordado ${embroidery.label}`,
    pressed: config.embroidery.type === embroidery.id,
  })), renderEmbroideryField(config.embroidery));

  const input = elements.panel.querySelector("[data-embroidery-text]");
  if (input) input.value = config.embroidery.text;
}

function optionGroup(title, gridClass, tiles, after = "") {
  return `
    <fieldset class="choice-group">
      <legend class="choice-title">${title}</legend>
      <div class="opt-grid ${gridClass}">${tiles.join("")}</div>
      ${after}
    </fieldset>`;
}

// Recuadro de opción: muestra arriba (cuero, acolchado, costura o ribete) y el nombre
// debajo. Al elegirla se marca todo el recuadro.
function optionTile({ field, value, label, ariaLabel, pressed, swatch, art = "", sampleClass = "", note = "" }) {
  const sample = swatch
    ? `<span class="opt-sample ${sampleClass}" style="--swatch:${swatch}" aria-hidden="true">${art}</span>`
    : "";
  return `
    <button class="opt opt-${field}" type="button" data-field="${field}" data-value="${value}"
      aria-label="${ariaLabel}" aria-pressed="${pressed}">
      ${sample}<span class="opt-name">${label}</span>${note ? ` <span class="opt-note">${note}</span>` : ""}
    </button>`;
}

function patternSample(pattern, stitch) {
  if (!pattern.svgId) return "";
  const paintId = preparePattern(pattern, stitch, `pv-${pattern.id}`);
  const [x, y, width, height] = SAMPLE_VIEWS[pattern.id];
  return `<svg viewBox="${x} ${y} ${width} ${height}" preserveAspectRatio="xMidYMid slice" ${DECORATIVE}>`
    + `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="url(#${paintId})"/></svg>`;
}

// Dos paneles de cuero unidos por una costura: surco oscuro y, junto a él, una sola fila
// de pespunte del hilo, como en el asiento.
function stitchSample(hex) {
  return `<svg viewBox="0 0 80 60" preserveAspectRatio="xMidYMid slice" ${DECORATIVE}>`
    + `<rect y="34" width="80" height="26" fill="#000" fill-opacity=".1"/>`
    + `<g fill="none"><path d="M0 30.6H80" stroke="#000" stroke-opacity=".18" stroke-width="5"/>`
    + `<path d="M0 37.2H80" stroke="#fff" stroke-opacity=".1" stroke-width="3"/>`
    + `<path d="M0 34H80" stroke="#000" stroke-opacity=".62" stroke-width="2.2"/>`
    + `<g stroke-linecap="round" stroke-dasharray="4.2 5.4">`
    + `<path d="M-1 27.3H81" stroke="#000" stroke-opacity=".6" stroke-width="2.6"/>`
    + `<path d="M-1 26.5H81" stroke="${hex}" stroke-width="2.2"/>`
    + `<path d="M-1 25.9H81" stroke="#fff" stroke-opacity=".32" stroke-width=".6"/></g></g></svg>`;
}

// Dos paneles (centro y laterales del respaldo) separados por el cordón del ribete.
function pipingSample(hex, left, right) {
  const cord = "M44 -4C39 16 38 40 42 64";
  return `<svg viewBox="0 0 80 60" preserveAspectRatio="xMidYMid slice" ${DECORATIVE}>`
    + `<rect width="80" height="60" fill="${left}"/><path d="${cord}H84V-4Z" fill="${right}"/>`
    + `<g fill="none" stroke-linecap="round">`
    + `<path d="${cord}" transform="translate(1 0)" stroke="#000" stroke-opacity=".55" stroke-width="9.5"/>`
    + `<path d="${cord}" stroke="${hex}" stroke-width="6.4"/>`
    + `<path d="${cord}" transform="translate(2 0)" stroke="#000" stroke-opacity=".32" stroke-width="2.2"/>`
    + `<path d="${cord}" transform="translate(-1.4 0)" stroke="#fff" stroke-opacity=".55" stroke-width="1.3"/>`
    + `</g></svg>`;
}

function renderEmbroideryField(embroidery) {
  if (embroidery.type !== "nombre" && embroidery.type !== "logo") return "";

  const isName = embroidery.type === "nombre";
  return `
    <div class="field-wrap">
      <label for="embroidery-text">${isName ? "Nombre que deseas bordar" : "Descripción del logo"}</label>
      <input id="embroidery-text" data-embroidery-text type="text" maxlength="80"
        autocomplete="off" placeholder="${isName ? "Ej.: María" : "Ej.: Iniciales JM con una corona"}">
    </div>`;
}

// Debe coincidir con la regla `.seam` del bloque «configurador v2» de styles.css.
const SEAM_STYLE = { width: "1.25", dash: "1.9 3.3" };

export async function exportDesignPng() {
  const source = document.querySelector("#seat");
  const clone = source.cloneNode(true);
  const namespace = "http://www.w3.org/2000/svg";
  const [viewX, viewY, viewWidth, viewHeight] = source.getAttribute("viewBox").split(/\s+/u).map(Number);
  clone.setAttribute("xmlns", namespace);
  clone.setAttribute("width", String(viewWidth));
  clone.setAttribute("height", String(viewHeight));

  clone.querySelector(".zone-numbers")?.remove();
  for (const zone of clone.querySelectorAll(".zone")) {
    zone.classList.remove("is-active");
    zone.removeAttribute("role");
    zone.removeAttribute("tabindex");
    zone.removeAttribute("aria-label");
    zone.removeAttribute("aria-pressed");
    zone.setAttribute("stroke", "#ffffff");
    zone.setAttribute("stroke-opacity", ".08");
    zone.setAttribute("stroke-width", "1.2");
    zone.setAttribute("stroke-dasharray", "none");
    zone.setAttribute("stroke-linecap", "round");
  }

  // Las reglas CSS no viajan a la imagen: el pespunte se fija igual que en pantalla.
  for (const seam of clone.querySelectorAll(".seam")) {
    seam.setAttribute("fill", "none");
    seam.setAttribute("stroke-width", SEAM_STYLE.width);
    seam.setAttribute("stroke-dasharray", SEAM_STYLE.dash);
    seam.setAttribute("stroke-linecap", "round");
    seam.setAttribute("filter", "url(#stitch-shadow)");
  }
  // Las copias de las muestras del panel no forman parte del asiento.
  for (const preview of clone.querySelectorAll('[id^="pv-"]')) preview.remove();

  const grain = clone.querySelector("#grain-overlay");
  if (grain) grain.style.mixBlendMode = "overlay";

  const embroidery = clone.querySelector("#embroidery-preview");
  if (embroidery) {
    embroidery.setAttribute("fill", "#fff");
    embroidery.setAttribute("stroke", "#111");
    embroidery.setAttribute("stroke-width", "3");
    embroidery.setAttribute("paint-order", "stroke");
    embroidery.setAttribute("font-family", "Poppins, Arial, sans-serif");
    embroidery.setAttribute("font-weight", "700");
  }

  const background = document.createElementNS(namespace, "rect");
  background.setAttribute("x", String(viewX));
  background.setAttribute("y", String(viewY));
  background.setAttribute("width", String(viewWidth));
  background.setAttribute("height", String(viewHeight));
  background.setAttribute("fill", "#0b0c0f");
  const definitions = clone.querySelector("defs");
  definitions.parentNode.insertBefore(background, definitions.nextSibling);

  const serialized = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(svgUrl);
    const canvas = document.createElement("canvas");
    canvas.width = viewWidth * 2;
    canvas.height = viewHeight * 2;
    const context = canvas.getContext("2d");
    context.fillStyle = "#0b0c0f";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pngBlob = await canvasToBlob(canvas);
    return offerDesignPng(pngBlob);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo convertir el diseño"));
    image.src = url;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    if (canvas.toBlob) {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No se pudo crear el PNG")), "image/png");
      return;
    }

    try {
      const [metadata, data] = canvas.toDataURL("image/png").split(",");
      const mime = metadata.match(/:(.*?);/u)?.[1] ?? "image/png";
      const bytes = Uint8Array.from(atob(data), (character) => character.charCodeAt(0));
      resolve(new Blob([bytes], { type: mime }));
    } catch (error) {
      reject(error);
    }
  });
}

export async function offerDesignPng(blob) {
  const fileName = `forros-cuenca-diseno-${new Date().toISOString().slice(0, 10)}.png`;

  if (typeof File === "function" && navigator.share && navigator.canShare) {
    const file = new File([blob], fileName, { type: "image/png" });
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Mi diseño de Forros Cuenca" });
        return "shared";
      }
    } catch (error) {
      if (error.name === "AbortError") return "cancelled";
    }
  }

  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 30000);
  return "downloaded";
}

export function announce(message) {
  elements.announcer.textContent = "";
  window.setTimeout(() => {
    elements.announcer.textContent = message;
  }, 20);
}

export function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2800);
}
