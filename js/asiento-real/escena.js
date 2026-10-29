// Visor 3D V5: estudio fotográfico de producto como el del FC-20. Sala casi
// negra con difusores (softbox) amplios arriba y a los lados: el cuero negro
// solo se ilumina donde su curva refleja un difusor, así cada almohadón queda
// dibujado por un brillo suave y amplio. Sombras de contacto con mapa de sombras
// y, en pantallas grandes, oclusión ambiental en pantalla (GTAO).
import * as THREE from "../vendor/three-0.186.1-extra.min.js";
import { texturaCueroReal, texturaSombraPiso } from "./texturas.js?v=13";

const { OrbitControls, EffectComposer, RenderPass, GTAOPass, OutputPass } = THREE;

// Textura del difusor: centro parejo y borde que cae suave (como la tela de un
// softbox), para que el reflejo en el cuero curvo sea amplio y sin cortes duros.
function texturaDifusor() {
  const w = 128;
  const datos = new Uint8Array(w * w * 4);
  for (let y = 0; y < w; y++) {
    const dy = Math.abs((y / (w - 1)) * 2 - 1);
    for (let x = 0; x < w; x++) {
      const dx = Math.abs((x / (w - 1)) * 2 - 1);
      // Rectángulo redondeado (superelipse) con caída suave en el último 30 %
      const r = Math.pow(Math.pow(dx, 4) + Math.pow(dy, 4), 0.25);
      const borde = Math.min(1, Math.max(0, (1 - r) / 0.3));
      const v = Math.round(255 * borde * borde * (3 - 2 * borde));
      const o = (y * w + x) * 4;
      datos[o] = v;
      datos[o + 1] = v;
      datos[o + 2] = v;
      datos[o + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(datos, w, w, THREE.RGBAFormat);
  t.needsUpdate = true;
  return t;
}

// Degradado vertical de la sala: piso negro, paredes casi negras que aclaran
// apenas hacia arriba (el cuero negro necesita oscuridad alrededor para que los
// brillos de los difusores dibujen las curvas en lugar de verse gris parejo).
function texturaSala() {
  const h = 64;
  const datos = new Uint8Array(4 * h);
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1); // 0 abajo, 1 arriba
    const v = Math.round(255 * (0.012 + 0.05 * Math.pow(t, 1.6)));
    datos.set([v, v, v, 255], y * 4);
  }
  const tex = new THREE.DataTexture(datos, 1, h, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

function entornoEstudio(renderer) {
  const sala = new THREE.Scene();
  const difusor = texturaDifusor();
  const degradado = texturaSala();
  const caja = new THREE.Mesh(
    new THREE.BoxGeometry(18, 12, 18),
    new THREE.MeshBasicMaterial({ map: degradado, side: THREE.BackSide }),
  );
  caja.position.y = 4.4;
  sala.add(caja);

  const piso = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), new THREE.MeshBasicMaterial({ color: 0x050505 }));
  piso.rotation.x = -Math.PI / 2;
  piso.position.y = -0.3;
  sala.add(piso);

  const softbox = (ancho, alto, intensidad, posicion, mirarA, colorHex = 0xfbfaf8) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(ancho, alto),
      new THREE.MeshBasicMaterial({ map: difusor, side: THREE.DoubleSide }),
    );
    m.material.color.set(colorHex).multiplyScalar(intensidad);
    m.position.set(...posicion);
    m.lookAt(...mirarA);
    sala.add(m);
  };

  // Posiciones pensadas para la cámara del catálogo (de frente, 18° arriba):
  // una cara que mira al frente refleja la zona baja delante del asiento (oscura,
  // como el panel central y los canales del FC-20); las caras de los almohadones
  // giradas 20..40° hacia afuera reflejan los difusores laterales (brillo amplio);
  // las coronas que miran hacia arriba reflejan el domo.
  // 1. Domo cenital grande, un poco adelantado: coronas del cojín, cabecera,
  //    hombros del respaldo y el filo de arriba de cada canal.
  softbox(7.0, 4.6, 4.4, [0, 6.2, 1.8], [0, 0.4, 0.2]);
  // 2. Difusor frontal alto (a unos 45°): solo lo toman las caras inclinadas
  //    hacia arriba (filo superior de canales y almohadones).
  softbox(5.0, 2.0, 1.3, [0, 5.4, 5.0], [0, 0.6, 0]);
  // 3. Laterales delanteros a unos 45° del frente: el brillo amplio en la cara
  //    de los almohadones del respaldo y del cojín.
  softbox(2.8, 4.8, 3.6, [-3.3, 2.0, 3.5], [0, 0.6, 0]);
  softbox(2.8, 4.8, 3.6, [3.3, 2.0, 3.5], [0, 0.6, 0]);
  // 4. Laterales a 75°: el costado exterior de los almohadones.
  softbox(2.4, 4.6, 2.6, [-4.7, 2.2, 1.2], [0, 0.6, 0]);
  softbox(2.4, 4.6, 2.6, [4.7, 2.2, 1.2], [0, 0.6, 0]);
  // 5. Contraluces laterales traseros: el filo claro del contorno.
  softbox(2.2, 4.6, 2.0, [-4.4, 2.6, -3.4], [0, 0.6, 0]);
  softbox(2.2, 4.6, 2.0, [4.4, 2.6, -3.4], [0, 0.6, 0]);
  // 6. Relleno frontal bajo y tenue: el panel central no se hunde en negro puro.
  softbox(6.0, 1.6, 0.22, [0, 1.0, 6.0], [0, 0.5, 0]);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(sala, 0.04);
  pmrem.dispose();
  difusor.dispose();
  degradado.dispose();
  sala.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      o.material.dispose();
    }
  });
  return rt;
}

// El posproceso (GTAO) solo en equipos de escritorio y con lienzo de 700 px o más.
function esMovil() {
  try {
    if (navigator.userAgentData?.mobile) return true;
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) return true;
    return window.matchMedia?.("(pointer: coarse)").matches && !window.matchMedia("(pointer: fine)").matches;
  } catch {
    return false;
  }
}

export function crearVisor(contenedor, opciones = {}) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: !!opciones.preservar,
  });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = opciones.exposicion ?? 0.75;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false; // luz y asiento fijos: el mapa de sombra se recalcula solo al cambiar el asiento
  renderer.setClearColor(0x000000, 0);

  const lienzo = renderer.domElement;
  lienzo.style.display = "block";
  lienzo.style.width = "100%";
  lienzo.style.height = "100%";
  lienzo.style.touchAction = "none";
  if (opciones.etiqueta) lienzo.setAttribute("aria-label", opciones.etiqueta);
  contenedor.appendChild(lienzo);

  const escena = new THREE.Scene();
  const entorno = entornoEstudio(renderer);
  escena.environment = entorno.texture;
  escena.environmentIntensity = opciones.intensidadEntorno ?? 1.5;

  const camara = new THREE.PerspectiveCamera(25, 1, 0.05, 20);
  // Vista inicial como las fotos del catálogo: de frente y desde unos 25° por encima (con un giro mínimo para sentir el volumen).
  camara.position.set(0.3, 1.5, 2.05);

  // Relleno hemisférico muy suave: solo se nota en los colores claros o vivos
  // (en el cuero negro casi no aporta, igual que en el estudio real).
  const hemi = new THREE.HemisphereLight(0xfaf9f7, 0x0c0c0c, 0.35);
  escena.add(hemi);

  // 1. Luz principal alta y algo a la izquierda (como el domo del estudio):
  //    sombras de contacto bajo la cabecera, en la unión respaldo-cojín y bajo el cojín.
  const principal = new THREE.DirectionalLight(0xfaf9f6, opciones.luz ?? 1.15);
  principal.position.set(-0.9, 3.3, 1.9);
  principal.castShadow = true;
  principal.shadow.mapSize.set(2048, 2048);
  principal.shadow.radius = 6.0;
  principal.shadow.bias = -0.0003;
  principal.shadow.normalBias = 0.008;
  {
    const sc = principal.shadow.camera;
    sc.left = -0.7;
    sc.right = 0.7;
    sc.top = 1.2;
    sc.bottom = -0.2;
    sc.near = 0.6;
    sc.far = 6.4;
  }
  escena.add(principal);

  // 2. Luz cenital rasante: sombras reales dentro de los canales y surcos.
  const rasante = new THREE.DirectionalLight(0xfaf8f5, 0.75);
  rasante.position.set(0.0, 3.25, 1.08);
  rasante.castShadow = true;
  rasante.shadow.mapSize.set(2048, 2048);
  rasante.shadow.radius = 4.0;
  rasante.shadow.bias = -0.0002;
  rasante.shadow.normalBias = 0.004;
  {
    const sc = rasante.shadow.camera;
    sc.left = -0.42;
    sc.right = 0.42;
    sc.top = 1.08;
    sc.bottom = 0.08;
    sc.near = 1.2;
    sc.far = 4.6;
  }
  escena.add(rasante);

  // 3. Rellenos laterales (sin sombra): dan cuerpo a los colores vivos.
  const relleno = new THREE.DirectionalLight(0xf8f7f5, 0.7);
  relleno.position.set(1.6, 2.4, 2.0);
  escena.add(relleno);

  const rellenoFrontal = new THREE.DirectionalLight(0xf9f8f6, 0.3);
  rellenoFrontal.position.set(0, 0.9, 2.85);
  escena.add(rellenoFrontal);

  const piso = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.ShadowMaterial({ opacity: 0.38 }));
  piso.rotation.x = -Math.PI / 2;
  piso.receiveShadow = true;
  if (!opciones.sinPiso) escena.add(piso);

  const contacto = new THREE.Mesh(
    new THREE.PlaneGeometry(0.92, 1.02),
    new THREE.MeshBasicMaterial({
      map: texturaSombraPiso(),
      transparent: true,
      depthWrite: false,
      opacity: 0.9,
      toneMapped: false,
    }),
  );
  contacto.rotation.x = -Math.PI / 2;
  contacto.position.set(0, 0.001, -0.02);
  if (!opciones.sinPiso) escena.add(contacto);

  const controles = new OrbitControls(camara, lienzo);
  controles.target.set(0, 0.52, -0.06);
  controles.enableDamping = true;
  controles.dampingFactor = 0.08;
  controles.enablePan = false;
  controles.minDistance = 1.25;
  controles.maxDistance = 4.2;
  controles.minPolarAngle = 0.25;
  controles.maxPolarAngle = 1.52;
  controles.rotateSpeed = 0.8;
  controles.update();

  if (opciones.fijarCamara) {
    // Cámara libre para mediciones (sin límites de distancia ni de ángulo)
    controles.minDistance = 0;
    controles.maxDistance = Infinity;
    controles.minPolarAngle = 0;
    controles.maxPolarAngle = Math.PI;
  }

  // Posproceso: render con MSAA en un buffer de media precisión, GTAO (sombra de
  // contacto en costuras, surcos y uniones) y OutputPass (tono ACES y sRGB).
  // Mantiene el fondo transparente. Se activa solo en escritorio con lienzo >= 700 px.
  const permitirPost = opciones.posproceso ?? !esMovil();
  let post = null;
  let postActivo = false;
  function crearPost(w, h) {
    const pr = renderer.getPixelRatio();
    const capa = new THREE.WebGLRenderTarget(w * pr, h * pr, {
      type: THREE.HalfFloatType,
      samples: renderer.capabilities.isWebGL2 ? 4 : 0,
    });
    const composer = new EffectComposer(renderer, capa);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    const pasoRender = new RenderPass(escena, camara);
    pasoRender.clearAlpha = 0;
    const gtao = new GTAOPass(escena, camara, w * pr, h * pr);
    gtao.blendIntensity = opciones.intensidadAO ?? 0.85;
    gtao.updateGtaoMaterial({
      radius: 0.07,
      distanceExponent: 1.6,
      thickness: 0.6,
      distanceFallOff: 1.0,
      scale: 1.15,
      samples: 16,
    });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    composer.addPass(pasoRender);
    composer.addPass(gtao);
    composer.addPass(new OutputPass());
    return { composer, gtao, capa };
  }
  function revisarPost(w) {
    postActivo = permitirPost && w >= 700;
    if (postActivo && !post) {
      try {
        post = crearPost(Math.max(1, contenedor.clientWidth), Math.max(1, contenedor.clientHeight));
      } catch {
        post = null;
        postActivo = false;
      }
    }
  }
  // rapido = true: mientras el usuario gira el asiento se dibuja directo (sin GTAO ni buffer de media
  // precisión); al soltar y reposar se redibuja con todos los efectos.
  const dibujar = (rapido = false) => {
    // el mapa de sombra se refresca en cada dibujo completo (por si el relieve del patrón cambió la
    // geometría) y se reutiliza mientras se gira
    if (!rapido) renderer.shadowMap.needsUpdate = true;
    if (postActivo && post && !rapido) {
      if (asiento) {
        // La oclusión se limita a la caja del asiento (el piso queda limpio)
        post.gtao.setSceneClipBox(cajaAo.setFromObject(asiento).expandByScalar(0.02));
      }
      post.composer.render();
    } else {
      renderer.render(escena, camara);
    }
  };
  const cajaAo = new THREE.Box3();

  let asiento = null;
  let pendiente = true;
  let activo = true;
  let cuadro = 0;
  const pedir = () => {
    pendiente = true;
    if (!cuadro && activo) cuadro = requestAnimationFrame(bucle);
  };

  // Cuando termina de cargar el mapa normal de cuero real (.webp), redibujar.
  texturaCueroReal(pedir);

  function encuadrar() {
    if (!asiento) return;
    const caja = new THREE.Box3().setFromObject(asiento);
    const centro = caja.getCenter(new THREE.Vector3());
    const tam = caja.getSize(new THREE.Vector3());
    const vfov = THREE.MathUtils.degToRad(camara.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camara.aspect);
    const margen = opciones.margen ?? 1.04;
    const distancia =
      Math.max((tam.y * 0.5 * margen) / Math.tan(vfov / 2), (Math.hypot(tam.x, tam.z) * 0.42 * margen) / Math.tan(hfov / 2)) +
      Math.max(tam.x, tam.z) * 0.17;
    const direccion = camara.position.clone().sub(controles.target).normalize();
    controles.target.copy(centro);
    camara.position.copy(centro).addScaledVector(direccion, distancia);
    controles.minDistance = distancia * 0.55;
    controles.maxDistance = distancia * 1.7;
    controles.update();
  }

  const ajustar = () => {
    const w = Math.max(1, contenedor.clientWidth);
    const h = Math.max(1, contenedor.clientHeight);
    renderer.setSize(w, h, false);
    revisarPost(w);
    if (post) post.composer.setSize(w, h);
    camara.aspect = w / h;
    if (!opciones.fijarCamara) camara.fov = w / h < 0.8 ? 31 : 25;
    camara.updateProjectionMatrix();
    if (!opciones.fijarCamara) encuadrar();
    pedir();
  };

  let tocando = false; // el usuario tiene el dedo o el mouse sobre el visor
  let ultimoRapido = false;
  let reposo = 0;
  function bucle() {
    cuadro = 0;
    const seMueve = controles.update();
    const rapido = seMueve || tocando;
    if (pendiente || seMueve || (ultimoRapido && !rapido)) {
      pendiente = false;
      ultimoRapido = rapido;
      dibujar(rapido);
    }
    if (seMueve && activo) cuadro = requestAnimationFrame(bucle);
  }

  controles.addEventListener("start", () => {
    tocando = true;
    clearTimeout(reposo);
  });
  controles.addEventListener("end", () => {
    clearTimeout(reposo);
    reposo = setTimeout(() => {
      tocando = false;
      pedir();
    }, 160);
  });
  controles.addEventListener("change", pedir);
  window.addEventListener("asiento-textura", pedir);
  const observador = new ResizeObserver(ajustar);
  observador.observe(contenedor);
  ajustar();

  const rayo = new THREE.Raycaster();
  const puntero = new THREE.Vector2();
  let inicio = null;
  lienzo.addEventListener("pointerdown", (e) => {
    inicio = { x: e.clientX, y: e.clientY };
  });
  lienzo.addEventListener("pointerup", (e) => {
    if (!inicio || !asiento || !opciones.alElegirZona) return;
    const movido = Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y);
    inicio = null;
    if (movido > 6) return;
    const r = lienzo.getBoundingClientRect();
    puntero.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    rayo.setFromCamera(puntero, camara);
    const golpe = rayo.intersectObject(asiento, true).find((g) => g.object.userData.zona);
    if (golpe) opciones.alElegirZona(golpe.object.userData.zona);
  });

  return {
    escena,
    camara,
    renderer,
    controles,
    pedir,
    get posproceso() {
      return postActivo && !!post;
    },
    ponerAsiento(grupo) {
      if (asiento) escena.remove(asiento);
      asiento = grupo;
      grupo.traverse((o) => {
        if (o.isMesh && !o.userData.bordado) {
          // las puntadas (miles de instancias diminutas) no proyectan sombra ni participan del clic
          o.castShadow = !o.isInstancedMesh;
          o.receiveShadow = true;
        }
        if (o.isInstancedMesh) o.raycast = () => {};
      });
      renderer.shadowMap.needsUpdate = true;
      escena.add(grupo);
      if (opciones.encuadre !== false) encuadrar();
      pedir();
    },
    quitarAsiento() {
      if (asiento) escena.remove(asiento);
      asiento = null;
      pedir();
    },
    pausar(valor) {
      activo = !valor;
      if (activo) pedir();
    },
    renderizar() {
      controles.update();
      dibujar();
    },
    destruir() {
      observador.disconnect();
      cancelAnimationFrame(cuadro);
      controles.dispose();
      entorno.dispose();
      if (post) {
        post.composer.dispose();
        post.gtao.dispose();
        post.capa.dispose();
      }
      renderer.dispose();
      lienzo.remove();
    },
  };
}
