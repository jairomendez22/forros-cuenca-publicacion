// Elige tu carro (idea del configurador de Katzkin, para carros de Ecuador): el cliente escoge marca, modelo y año
// (los de vehicles.js) y ve el asiento de ESE carro con el forro puesto; al cambiar de diseño solo cambia el forro
// (las 6 fotos de cada carro tienen el mismo encuadre). Fotos hechas con IA a partir de la investigación de cada
// generación: investigacion-asientos/elige-carros → herramientas/fotos-elige.mjs → assets/elige/<id>/ y elige-datos.js.
import { WHATSAPP_NUMBER } from "./data.js?v=9";
import { VEHICLE_BRANDS, findBrand, modelYears } from "./vehicles.js";
import { FOTOS } from "./elige-datos.js?v=9";

// Asientos de muestra sin carro ni marca (assets/elige/muestra/): nunca se muestra el interior de otra marca.
const MUESTRA = { id: "muestra", marca: "", modelo: "asientos de muestra" };

// La foto de la generación de ese año; si no hay, otra generación del mismo modelo; si tampoco, los asientos de muestra.
function fotoPara(marca, modelo, anio) {
  const delModelo = FOTOS.filter((f) => f.marca === marca && f.modelo === modelo);
  const dentro = (f) => anio >= f.desde && anio <= (f.hasta ?? 9999);
  const lejania = (f) => (dentro(f) ? 0 : Math.min(Math.abs(anio - f.desde), Math.abs(anio - (f.hasta ?? 9999))));
  const cercana = delModelo.sort((a, b) => lejania(a) - lejania(b))[0];
  if (cercana && dentro(cercana)) return { foto: cercana, nota: "" };
  if (cercana) return { foto: cercana, nota: `Foto de referencia: ${modelo} ${cercana.desde}–${cercana.hasta ?? "hoy"}. Por WhatsApp confirmamos la forma de tu asiento.` };
  return { foto: MUESTRA, nota: `Pronto tendremos la foto del interior de tu ${marca} ${modelo}. Mientras, mira el diseño en asientos de muestra: tu forro se hace a la medida de tus asientos.` };
}
// Los 6 diseños del catálogo de Forros Cuenca (investigacion-asientos/elige-carros/_catalogo/), sin logo bordado.
const DISENOS = [
  { id: "fc-16", nombre: "FC-16", detalle: "Centro en V con vivo blanco", colores: ["#151518", "#ececec"] },
  { id: "fc-18", nombre: "FC-18", detalle: "Paneles en relieve, todo negro", colores: ["#151518", "#3a3b41"] },
  { id: "fc-01", nombre: "FC-01", detalle: "Centro en V con vivo rojo", colores: ["#151518", "#d0151d"] },
  { id: "fc-49", nombre: "FC-49", detalle: "Gris topo con vivo blanco", colores: ["#8b7b6e", "#ececec"] },
  { id: "fc-21", nombre: "FC-21", detalle: "Franja central perforada en V", colores: ["#151518", "#55575e"] },
  { id: "fc-02", nombre: "FC-02", detalle: "Camel con centro en rombos negro", colores: ["#c07a38", "#151518"] },
];

const raiz = document.querySelector("[data-elige]");
if (raiz) {
  const [selMarca, selModelo, selAnio] = ["marca", "modelo", "anio"].map((n) => raiz.querySelector(`[data-elige-select="${n}"]`));
  const referencia = raiz.querySelector(".elige-referencia");
  const listaDisenos = raiz.querySelector(".elige-disenos");
  const escena = raiz.querySelector(".elige-escena");
  const capas = [...escena.querySelectorAll(".elige-capa")];
  const rotulo = escena.querySelector(".elige-rotulo");
  const cotizar = raiz.querySelector(".elige-cotizar");
  // al empezar se muestra el carro más común de la lista, en el año más reciente de esa generación
  const inicial = FOTOS[0];
  let carro = { marca: inicial.marca, modelo: inicial.modelo, anio: Math.min(inicial.hasta ?? new Date().getFullYear(), new Date().getFullYear()) };
  let foto = inicial;
  let diseno = DISENOS[0];
  let visible = 0;

  const ruta = (c, d, w) => `./assets/elige/${c.id}/${d.id}-${w}`;
  const fuentes = (c, d) => ({
    avif: `${ruta(c, d, 768)}.avif 768w, ${ruta(c, d, 1440)}.avif 1440w`,
    webp: `${ruta(c, d, 768)}.webp 768w, ${ruta(c, d, 1440)}.webp 1440w`,
    src: `${ruta(c, d, 1440)}.webp`,
  });
  const nombreCarro = (c) => `${c.marca} ${c.modelo}`;

  // Cambia solo las <option>: el <button><selectedcontent> del HTML da a la lista los colores de la página.
  const opciones = (select, lista, valor) => {
    select.querySelectorAll("option").forEach((o) => o.remove());
    lista.forEach(([v, texto]) => select.append(new Option(texto, v, false, String(v) === String(valor))));
  };
  const llenar = () => {
    const marca = findBrand(carro.marca);
    const modelo = marca.models.find((m) => m.name === carro.modelo);
    opciones(selMarca, VEHICLE_BRANDS.map((b) => [b.brand, b.brand]), carro.marca);
    opciones(selModelo, marca.models.map((m) => [m.name, `${m.name} · ${m.type}`]), carro.modelo);
    opciones(selAnio, modelYears(modelo).map((a) => [a, a]), carro.anio);
    const elegido = fotoPara(carro.marca, carro.modelo, Number(carro.anio));
    foto = elegido.foto;
    referencia.textContent = elegido.nota;
    referencia.hidden = !elegido.nota;
  };
  // Al cambiar la marca o el modelo se conserva el año si existe; si no, el más reciente.
  const elegir = (cambio) => {
    const siguiente = { ...carro, ...cambio };
    const marca = findBrand(siguiente.marca);
    const modelo = marca.models.find((m) => m.name === siguiente.modelo) ?? marca.models[0];
    const anios = modelYears(modelo);
    carro = { marca: marca.brand, modelo: modelo.name, anio: anios.includes(String(siguiente.anio)) ? siguiente.anio : anios[0] };
    llenar();
    mostrar();
  };
  selMarca.addEventListener("change", () => elegir({ marca: selMarca.value, modelo: null }));
  selModelo.addEventListener("change", () => elegir({ modelo: selModelo.value }));
  selAnio.addEventListener("change", () => elegir({ anio: selAnio.value }));

  // la foto nueva se carga en la capa oculta y recién entonces se funde sobre la anterior
  const mostrar = () => {
    const f = fuentes(foto, diseno);
    const siguiente = capas[1 - visible];
    const [avif, webp] = siguiente.querySelectorAll("source");
    const img = siguiente.querySelector("img");
    avif.srcset = f.avif;
    webp.srcset = f.webp;
    img.src = f.src;
    img.alt = `${foto === MUESTRA ? "Asientos de muestra" : `Asientos delanteros de ${nombreCarro(foto)}`} con forro ${diseno.nombre}: ${diseno.detalle.toLowerCase()}`;
    const fundir = () => {
      capas[visible].classList.remove("is-visible");
      siguiente.classList.add("is-visible");
      visible = 1 - visible;
    };
    if (img.complete && img.naturalWidth) fundir();
    else img.addEventListener("load", fundir, { once: true });
    rotulo.textContent = `${nombreCarro(carro)} ${carro.anio} · ${diseno.nombre}`;
    cotizar.textContent = `Cotizar para mi ${carro.modelo}`;
    document.dispatchEvent(new CustomEvent("elige:cambio"));
    listaDisenos.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === diseno.id)));
    // las otras fotos de este carro se piden de antemano para que el cambio de diseño sea inmediato
    DISENOS.forEach((d) => { if (d !== diseno) new Image().src = `${ruta(foto, d, window.innerWidth > 900 ? 1440 : 768)}.webp`; });
  };
  llenar();
  DISENOS.forEach((d) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "elige-diseno";
    b.dataset.id = d.id;
    b.style.setProperty("--c1", d.colores[0]);
    b.style.setProperty("--c2", d.colores[1]);
    b.innerHTML = `<span class="elige-muestra" aria-hidden="true"></span><span><strong>${d.nombre}</strong><small>${d.detalle}</small></span>`;
    b.addEventListener("click", () => { diseno = d; mostrar(); });
    listaDisenos.append(b);
  });

  const whatsapp = (texto) => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
  cotizar.addEventListener("click", () => whatsapp(`Hola, Forros Cuenca. Quiero cotizar forros para mi ${nombreCarro(carro)} ${carro.anio} con el diseño ${diseno.nombre} (${diseno.detalle.toLowerCase()}). ¿Me pasan el precio?`));
  raiz.querySelector(".elige-otro").addEventListener("click", () => whatsapp("Hola, Forros Cuenca. No encontré mi carro en la web. ¿Me ayudan a cotizar forros? Mi carro es: "));

  capas[0].classList.add("is-visible");
  // la primera foto se pide recién cuando la sección se acerca a la pantalla
  const vigia = new IntersectionObserver((entradas) => {
    if (!entradas.some((e) => e.isIntersecting)) return;
    vigia.disconnect();
    mostrar();
  }, { rootMargin: "600px 0px" });
  vigia.observe(raiz);
}
