// Cuero real: capa de detalle con escaneos de cuero (ambientCG, CC0) que se suma al
// relieve de los canales y costuras. Aporta el grano de la piel, las micro-arrugas
// y la variación de brillo del cuero verdadero. Se inyecta en el sombreador del
// material con onBeforeCompile (un solo programa para todas las zonas).
import * as THREE from "../vendor/three-0.186.1-extra.min.js";

// tamano: lado del mosaico en mm; k: fuerza del relieve; rug: cuánto varía el brillo con el mapa real.
const CUEROS = {
  americano: { normal: "cuero-americano-normal.webp", rug: "cuero-americano-rugosidad.webp", tamano: 300, k: 0.9, rug_k: 0.7 },
  colombiano: { normal: "cuero-colombiano-normal.webp", rug: "cuero-colombiano-rugosidad.webp", tamano: 150, k: 3.2, rug_k: 0.35 },
};

const neutroNormal = (() => {
  const t = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1, THREE.RGBAFormat);
  t.needsUpdate = true;
  return t;
})();
const neutroRug = (() => {
  const t = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1, THREE.RGBAFormat);
  t.needsUpdate = true;
  return t;
})();

const cache = new Map();       // nombre -> textura
const esperando = new Map();   // nombre -> Set de { uni, clave } a asignar cuando llegue
const cargador = new THREE.TextureLoader();

// Entrega la textura a un uniforme: de inmediato si ya está cargada o cuando termine de cargar.
function pedir(nombre, uni, clave) {
  let t = cache.get(nombre);
  if (!t) {
    esperando.set(nombre, new Set());
    t = cargador.load(new URL(`../../assets/texturas/${nombre}`, import.meta.url).href, (tex) => {
      for (const d of esperando.get(nombre)) d.uni[d.clave].value = tex;
      esperando.get(nombre).clear();
      window.dispatchEvent(new Event("asiento-textura"));
    });
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.colorSpace = THREE.NoColorSpace;
    cache.set(nombre, t);
  }
  if (t.image) uni[clave].value = t;
  else esperando.get(nombre).add({ uni, clave });
}

// Prepara el material para recibir la capa de cuero real (se llama una vez por material).
export function prepararCueroReal(m) {
  if (m.userData.cueroReal) return;
  const uni = {
    uCueroN: { value: neutroNormal },
    uCueroR: { value: neutroRug },
    uCueroRep: { value: new THREE.Vector2(1 / 3, 1 / 3) },
    uCueroK: { value: 0 },
    uCueroRK: { value: 0 },
  };
  m.userData.cueroReal = uni;
  m.customProgramCacheKey = () => "cuero-real-v5";
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uni);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform vec2 uCueroRep;\nvarying vec2 vCueroUv;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvCueroUv = uv * uCueroRep;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform sampler2D uCueroN;\nuniform sampler2D uCueroR;\nuniform float uCueroK;\nuniform float uCueroRK;\nvarying vec2 vCueroUv;",
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        float rugCuero = texture2D(uCueroR, vCueroUv).g;
        roughnessFactor = clamp(roughnessFactor * (1.0 + (rugCuero - 0.5) * uCueroRK), 0.08, 1.0);`,
      )
      .replace(
        "#include <aomap_fragment>",
        `#include <aomap_fragment>
        {
          // Oclusión especular: la oclusión horneada en los vértices (uniones,
          // surcos de costura, bajo la cabecera) y la sombra del patrón (canales y
          // orificios del perforado) también apagan los reflejos. Sin esto el
          // cuero negro refleja el estudio hasta dentro de los surcos y se ve
          // como arcilla gris pareja.
          float aoEsp = 1.0;
          #ifdef USE_COLOR
            aoEsp = clamp(vColor.r, 0.0, 1.0);
          #endif
          #ifdef USE_MAP
            aoEsp *= clamp(pow(texture2D(map, vMapUv).g, 0.4545) * 1.136, 0.0, 1.0);
          #endif
          float dNVEsp = saturate(dot(geometryNormal, geometryViewDir));
          float soEsp = computeSpecularOcclusion(dNVEsp, aoEsp, material.roughness);
          reflectedLight.indirectSpecular *= soEsp;
          reflectedLight.directSpecular *= mix(1.0, aoEsp, 0.65);
          #ifdef USE_CLEARCOAT
            clearcoatSpecularIndirect *= soEsp;
            clearcoatSpecularDirect *= mix(1.0, aoEsp, 0.65);
          #endif
          #ifdef USE_SHEEN
            sheenSpecularIndirect *= aoEsp;
          #endif
        }`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        {
          vec3 dCuero = texture2D(uCueroN, vCueroUv).xyz * 2.0 - 1.0;
          mat3 tbnCuero = getTangentFrame(-vViewPosition, normal, vCueroUv);
          normal = normalize(normal + tbnCuero * vec3(dCuero.xy * uCueroK, 0.0));
        }`,
      );
  };
  m.needsUpdate = true;
}

// Elige el cuero (americano o colombiano) y su escala. Las texturas se cargan al primer uso.
export function ponerCueroReal(m, cueroId) {
  prepararCueroReal(m);
  const c = CUEROS[cueroId] ?? CUEROS.americano;
  const u = m.userData.cueroReal;
  u.uCueroN.value = neutroNormal;
  u.uCueroR.value = neutroRug;
  pedir(c.normal, u, "uCueroN");
  pedir(c.rug, u, "uCueroR");
  u.uCueroRep.value.set(100 / c.tamano, 100 / c.tamano);
  u.uCueroK.value = c.k;
  u.uCueroRK.value = c.rug_k;
}
