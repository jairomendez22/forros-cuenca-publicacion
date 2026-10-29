// Aplica el diseño del configurador (color PBR calibrado, patrón con relieve 3D
// real, hilo por zona, ribete, tipo de cuero y bordados) a las mallas del asiento 3D.
import * as THREE from "../vendor/three-0.186.1-extra.min.js";
import { COLORS, PIPING_COLORS, STITCH_COLORS, findById } from "../data.js?v=9";
import { aplicarRelieveGeometria } from "./superficie.js";
import { texturaCueroReal, texturasPatron } from "./texturas.js?v=13";
import { ponerCueroReal } from "./cuero-real.js?v=6";

// Valores PBR del cuero sintético (deep-research sección 4): dieléctrico con F0 0,04,
// rugosidad media 0,42 (napa americano) y 0,50 (granulado colombiano), una capa
// satinada fina (clearcoat bajo y rugoso) que concentra el centro del brillo y
// sheen para el filo claro de las curvas vistas de canto.
const CUERO = {
  americano: {
    roughness: 0.47,
    clearcoat: 0.14,
    clearcoatRoughness: 0.36,
    sheen: 0.4,
    sheenRoughness: 0.42,
    specularIntensity: 1.0,
    normal: 1.35,
    microNormal: 0.0,
  },
  colombiano: {
    roughness: 0.55,
    clearcoat: 0.08,
    clearcoatRoughness: 0.44,
    sheen: 0.3,
    sheenRoughness: 0.55,
    specularIntensity: 0.92,
    normal: 1.5,
    microNormal: 0.0,
  },
};

// Calibración PBR de tonos de cuero: negro neutro (deep-research: #1E1F22 a #26282C, sin tinte azul)
const COLOR_CUERO_PBR = {
  negro: "#232427",
  "gris-oscuro": "#464749",
  gris: "#7f8082",
  beige: "#ddd0be",
  morado: "#8756d0",
  azul: "#1b5ec4",
  rojo: "#c8222d",
};

const ACENTOS_VIVOS = new Set(["morado", "azul", "rojo", "turquesa", "naranja", "verde", "borgona"]);
const BASES_OSCURAS = new Set(["negro", "gris-oscuro", "gris", "marino"]);

const BLANCO = new THREE.Color(0xffffff);
const hex = (coleccion, id, respaldo) => (findById(coleccion, id) ?? findById(coleccion, respaldo)).hex;
const hexCuero = (id) => COLOR_CUERO_PBR[id] ?? hex(COLORS, id, "negro");

function materialesDe(asiento) {
  if (!asiento.userData.materiales) {
    asiento.userData.materiales = {
      zona: new Map(),
      subZona: new Map(),
      hiloPatron: new Map(),
      hilo: new Map(),
      ribete: null,
    };
  }
  return asiento.userData.materiales;
}

function configurarMaterialCuero(m, colorId, patronId, cueroId) {
  const c = CUERO[cueroId] ?? CUERO.americano;
  const t = texturasPatron(patronId, cueroId);
  void texturaCueroReal;
  m.color.set(hexCuero(colorId));
  m.roughness = c.roughness;
  m.metalness = 0.0;
  m.specularIntensity = c.specularIntensity;
  m.clearcoat = c.clearcoat;
  m.clearcoatRoughness = c.clearcoatRoughness;
  m.sheen = c.sheen;
  m.sheenRoughness = c.sheenRoughness;
  // Sheen casi neutro: el filo claro del cuero visto de canto no toma todo el color.
  m.sheenColor.copy(m.color).lerp(BLANCO, 0.4).multiplyScalar(0.34);
  if (m.normalMap !== t.normal || m.map !== t.sombra || m.roughnessMap !== t.rugosidad) {
    m.normalMap = t.normal;
    m.map = t.sombra;
    m.roughnessMap = t.rugosidad;
    m.clearcoatNormalMap = null;
    m.needsUpdate = true;
  }
  m.normalScale.setScalar(c.normal);
  ponerCueroReal(m, cueroId); // grano y micro-arrugas del cuero real (escaneo CC0)
  return t;
}

export function aplicarDiseno(asiento, diseno) {
  const mats = materialesDe(asiento);
  const cueroId = diseno.material ?? "americano";
  const texturasZona = new Map();

  for (const [zonaId, zona] of Object.entries(diseno.zones)) {
    let m = mats.zona.get(zonaId);
    if (!m) {
      m = new THREE.MeshPhysicalMaterial({ vertexColors: true, color: 0x2b2c2f });
      mats.zona.set(zonaId, m);
    }
    texturasZona.set(zonaId, configurarMaterialCuero(m, zona.color, zona.pattern, cueroId));

    let h = mats.hilo.get(zonaId);
    if (!h) {
      // Hilo de nylon bondeado con relieve satinado visible tono sobre tono
      h = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0 });
      mats.hilo.set(zonaId, h);
    }
    const colorHilo = zona.stitch === "negra" && zona.color === "negro" ? "#2a2b2e" : hex(STITCH_COLORS, zona.stitch, "roja");
    h.color.set(colorHilo);

    let hp = mats.hiloPatron.get(zonaId);
    if (!hp) {
      hp = new THREE.MeshStandardMaterial({
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -6,
        roughness: 0.55,
      });
      mats.hiloPatron.set(zonaId, hp);
    }
    hp.color.set(colorHilo);
    const tz = texturasZona.get(zonaId);
    if (hp.alphaMap !== tz.hilo) {
      hp.alphaMap = tz.hilo;
      hp.needsUpdate = true;
    }
  }

  const obtenerSubMaterial = (clave, colorId, patronId) => {
    let m = mats.subZona.get(clave);
    if (!m) {
      m = new THREE.MeshPhysicalMaterial({ vertexColors: true, color: 0x2b2c2f });
      mats.subZona.set(clave, m);
    }
    configurarMaterialCuero(m, colorId, patronId, cueroId);
    return m;
  };

  if (!mats.ribete) {
    mats.ribete = new THREE.MeshPhysicalMaterial({
      roughness: 0.56,
      clearcoat: 0.0,
      sheen: 0.16,
      sheenRoughness: 0.72,
    });
  }
  const colorRibete = diseno.piping === "negra" ? "#2e2f32" : hex(PIPING_COLORS, diseno.piping, "negra");
  mats.ribete.color.set(colorRibete);

  const zBack = diseno.zones.back ?? { color: "negro", pattern: "liso", stitch: "negra" };
  const zTop = diseno.zones.top ?? zBack;
  const zSide = diseno.zones.side ?? zBack;
  const zBase = diseno.zones.base ?? zBack;
  const zHead = diseno.zones.head ?? zSide;
  const zHeadCenter = diseno.zones.headCenter ?? zHead;

  asiento.traverse((o) => {
    const zonaId = o.userData.zona;
    const subZona = o.userData.subZona;
    if (zonaId && mats.zona.has(zonaId)) {
      const zCfg = diseno.zones[zonaId];
      if (!subZona) {
        aplicarRelieveGeometria(o.geometry, zCfg.pattern);
        if (zCfg.pattern === "liso" && o.geometry?.userData?.perforadoDeFabrica) {
          o.material = obtenerSubMaterial(`perf-${zonaId}`, zCfg.color, "perforado");
        } else {
          o.material = mats.zona.get(zonaId);
        }
        let capa = o.userData.capaHilo;
        if (!capa) {
          capa = new THREE.Mesh(o.geometry, mats.hiloPatron.get(zonaId));
          capa.renderOrder = 1;
          capa.userData.esCapa = true;
          capa.raycast = () => {};
          o.add(capa);
          o.userData.capaHilo = capa;
        }
        capa.material = mats.hiloPatron.get(zonaId);
        capa.visible = !!texturasZona.get(zonaId)?.hilo;
      } else if (subZona === "escudo") {
        const mismoPano = zTop.color === zBack.color && (zTop.pattern === "diamante" || zTop.pattern === "perforado");
        o.visible = true;
        if (mismoPano) {
          o.material = mats.zona.get("top");
        } else {
          const colorEscudo = zHeadCenter.color;
          o.material = obtenerSubMaterial("escudo", colorEscudo, "liso");
        }
      } else if (subZona === "acento") {
        o.material = obtenerSubMaterial(`acento-${zonaId}`, zCfg.color, "liso");
      } else if (subZona === "interior") {
        const refCentro = zonaId === "edge" ? zBase : zonaId === "head" ? zHeadCenter : zBack;
        const esBitonoDeportivo = ACENTOS_VIVOS.has(zCfg.color) && BASES_OSCURAS.has(refCentro.color);
        const colorInt = esBitonoDeportivo ? refCentro.color : zCfg.color;
        o.material = obtenerSubMaterial(`int-${zonaId}`, colorInt, "liso");
      } else {
        o.material = mats.zona.get(zonaId);
      }
    } else if (o.userData.hiloDe && mats.hilo.has(o.userData.hiloDe)) {
      o.material = mats.hilo.get(o.userData.hiloDe);
      o.visible = !o.userData.soloLiso || diseno.zones[o.userData.hiloDe]?.pattern === "liso";
    } else if (o.userData.ribete) {
      o.material = mats.ribete;
      o.visible = diseno.piping !== "ninguno";
    }
  });
}

export function liberarAsiento(asiento) {
  asiento.traverse((o) => {
    if (o.isMesh && !o.userData.esCapa) o.geometry?.dispose();
  });
  const mats = asiento.userData.materiales;
  if (mats) {
    for (const coleccion of [mats.zona, mats.subZona, mats.hilo, mats.hiloPatron]) {
      for (const m of coleccion.values()) m.dispose();
    }
    mats.ribete?.dispose();
  }
}
