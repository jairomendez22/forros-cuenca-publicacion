// Piezas rígidas y complementos tapizados del asiento: carcasa plástica inferior
// tipo FC-20, varillas bajas, escudos y franjas curvas sin dientes de sierra.
import * as THREE from "../vendor/three-0.186.1-extra.min.js";
const { RoundedBoxGeometry } = THREE;
import { crearPespuntes, crearRibete, smooth } from "./superficie.js";
import { texturaPlastico } from "./texturas.js?v=13";

export function materialesBase() {
  // Plástico negro texturizado de la carcasa (como el FC-20): un poco más satinado
  // que antes para que sus bordes redondeados tomen un brillo suave del estudio.
  const plastico = new THREE.MeshPhysicalMaterial({
    color: 0x0c0c0d,
    roughness: 0.56,
    metalness: 0.0,
    specularIntensity: 0.9,
    normalMap: texturaPlastico(),
    normalScale: new THREE.Vector2(0.4, 0.4),
    clearcoat: 0.0,
    sheen: 0.25,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(0x2a2a2c),
  });
  const metal = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.48, metalness: 0.65 });
  const cromo = new THREE.MeshPhysicalMaterial({ color: 0xdadadf, roughness: 0.18, metalness: 0.9, clearcoat: 0.2 });
  return { plastico, metal, cromo };
}

export function formaRedondeada(puntos, radios) {
  const s = new THREE.Shape();
  const n = puntos.length;
  for (let k = 0; k < n; k++) {
    const p = puntos[k];
    const a = puntos[(k - 1 + n) % n];
    const b = puntos[(k + 1) % n];
    const r = Array.isArray(radios) ? radios[k] : radios;
    const da = Math.hypot(a[0] - p[0], a[1] - p[1]);
    const db = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const ra = Math.min(r, da / 2);
    const rb = Math.min(r, db / 2);
    const p1 = [p[0] + ((a[0] - p[0]) / da) * ra, p[1] + ((a[1] - p[1]) / da) * ra];
    const p2 = [p[0] + ((b[0] - p[0]) / db) * rb, p[1] + ((b[1] - p[1]) / db) * rb];
    if (k === 0) s.moveTo(p1[0], p1[1]);
    else s.lineTo(p1[0], p1[1]);
    s.quadraticCurveTo(p[0], p[1], p2[0], p2[1]);
  }
  s.closePath();
  return s;
}

export function placaLateral(forma, grosor, bisel, material, x) {
  const g = new THREE.ExtrudeGeometry(forma, {
    depth: grosor - 2 * bisel,
    bevelEnabled: true,
    bevelThickness: bisel,
    bevelSize: bisel,
    bevelSegments: 5,
    curveSegments: 24,
  });
  g.rotateY(-Math.PI / 2);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material);
  m.position.x = x;
  return m;
}

export function perillaEstrella(radio, grosor, lobulos, material) {
  const s = new THREE.Shape();
  const pasos = 240;
  for (let k = 0; k <= pasos; k++) {
    const t = (k / pasos) * Math.PI * 2;
    const ola = Math.pow(0.5 + 0.5 * Math.cos(lobulos * t), 0.7);
    const r = radio * (0.7 + 0.3 * ola);
    const x = Math.cos(t) * r;
    const y = Math.sin(t) * r;
    if (k === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  const g = new THREE.ExtrudeGeometry(s, {
    depth: grosor - 8,
    bevelEnabled: true,
    bevelThickness: 4,
    bevelSize: 3.5,
    bevelSegments: 6,
    curveSegments: 4,
  });
  g.rotateY(Math.PI / 2);
  g.computeVertexNormals();
  const grupo = new THREE.Group();
  grupo.add(new THREE.Mesh(g, material));
  const tapa = new THREE.Mesh(new THREE.CylinderGeometry(radio * 0.32, radio * 0.36, 3, 40), material);
  tapa.rotation.z = Math.PI / 2;
  tapa.position.x = grosor - 2;
  grupo.add(tapa);
  const tornillo = new THREE.Mesh(
    new THREE.CylinderGeometry(radio * 0.09, radio * 0.09, 2, 20),
    new THREE.MeshStandardMaterial({ color: 0x8a8d92, metalness: 1, roughness: 0.3 }),
  );
  tornillo.rotation.z = Math.PI / 2;
  tornillo.position.x = grosor - 0.2;
  grupo.add(tornillo);
  return grupo;
}

export function cajaRedondeada(ancho, alto, largo, radio, material) {
  const forma = formaRedondeada(
    [
      [-ancho / 2, -alto / 2],
      [ancho / 2, -alto / 2],
      [ancho / 2, alto / 2],
      [-ancho / 2, alto / 2],
    ],
    radio,
  );
  const b = Math.min(radio, largo / 4);
  const g = new THREE.ExtrudeGeometry(forma, {
    depth: largo - 2 * b,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b * 0.6,
    bevelSegments: 3,
    curveSegments: 6,
  });
  g.translate(0, 0, -(largo - 2 * b) / 2);
  g.computeVertexNormals();
  return new THREE.Mesh(g, material);
}

export function varilla(desde, hasta, radio, material) {
  const largo = desde.distanceTo(hasta);
  const g = new THREE.CylinderGeometry(radio, radio, largo, 28, 1);
  const m = new THREE.Mesh(g, material);
  m.position.copy(desde).add(hasta).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), hasta.clone().sub(desde).normalize());
  return m;
}

/**
 * Crea el paño en U del escudo superior con borde matemático 100 % suave y bisel metido en la costura.
 */
export function parcheEscudoSuperior(cuerpo, { uMin = 0.75, uMax = 0.985, sMax = 0.36, exponente = 2.2, zona = "top" } = {}) {
  if (!cuerpo.evalPuntoFront) return null;
  const NX = 36;
  const NY = 18;
  const P = [];
  const N = [];
  const U = [];
  const C = [];
  const idx = [];
  for (let j = 0; j <= NY; j++) {
    const ty = j / NY;
    for (let i = 0; i <= NX; i++) {
      const tx = (i / NX) * 2 - 1;
      const s = tx * sMax;
      const uPiso = uMin + (uMax - uMin) * Math.pow(Math.abs(tx), exponente);
      const u = uPiso + (uMax - uPiso) * ty;
      const distCostura = ty * (1 - 0.55 * Math.pow(Math.abs(tx), exponente));
      const elev = 0.38 + 1.48 * smooth(0, 0.16, distCostura);
      const ao = 0.76 + 0.24 * smooth(0, 0.2, distCostura);
      const { p, n } = cuerpo.evalPuntoFront(u, s);
      p.addScaledVector(n, elev);
      P.push(p.x, p.y, p.z);
      N.push(n.x, n.y, n.z);
      U.push(s * 1.6, u * 4.5);
      C.push(ao, ao, ao);
    }
  }
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i;
      const b = a + 1;
      const c = a + (NX + 1);
      const d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();

  const malla = new THREE.Mesh(g, new THREE.MeshStandardMaterial());
  malla.userData.zona = zona;
  malla.userData.subZona = "escudo";
  return malla;
}

/**
 * Crea un listón diagonal tapizado perfectamente liso sobre el bolster superior.
 */
export function parcheFranjaDiagonal(cuerpo, { u0, u1, pendiente = 0.26, sMin = 0.54, sMax = 0.81, signo = 1, zona = "side" }) {
  if (!cuerpo.evalPuntoFront) return null;
  const NX = 22;
  const NY = 8;
  const P = [];
  const N = [];
  const U = [];
  const C = [];
  const idx = [];
  for (let j = 0; j <= NY; j++) {
    const ty = j / NY;
    const distBorde = Math.sin(Math.PI * ty);
    const elev = 0.36 + 1.38 * Math.pow(distBorde, 0.45);
    const ao = 0.78 + 0.22 * Math.pow(distBorde, 0.5);
    for (let i = 0; i <= NX; i++) {
      const tx = i / NX;
      const as = sMin + (sMax - sMin) * tx;
      const s = signo * as;
      const uBase = u0 + (u1 - u0) * ty + pendiente * (as - sMin);
      const { p, n } = cuerpo.evalPuntoFront(uBase, s);
      p.addScaledVector(n, elev);
      P.push(p.x, p.y, p.z);
      N.push(n.x, n.y, n.z);
      U.push(s * 1.6, uBase * 4.5);
      C.push(ao, ao, ao);
    }
  }
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i;
      const b = a + 1;
      const c = a + (NX + 1);
      const d = c + 1;
      if (signo > 0) idx.push(a, b, d, a, d, c);
      else idx.push(a, d, b, a, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();

  const malla = new THREE.Mesh(g, new THREE.MeshStandardMaterial());
  malla.userData.zona = zona;
  malla.userData.subZona = "acento";
  return malla;
}

/**
 * Construye la carcasa plástica inferior ancha y redondeada del FC-20 / FC-24 / FC-16:
 * dos pómulos/patas laterales gruesos que abrazan el bajo del cojín y un faldón
 * frontal horizontal con rebaje trapecial inferior limpio.
 */
export function crearBaseFC20(plastico, { anchoSup = 249, anchoInf = 217, zFrente = 228, zAtras = -215, dy = 0, dz = 0, alto = 1 } = {}) {
  const grupo = new THREE.Group();
  grupo.name = "base-fc20";
  // dy / dz suben y adelantan toda la carcasa para que quede pegada bajo el cojín.
  // alto estira la carcasa hacia abajo (el borde superior, y = 252, se queda donde está).
  grupo.scale.y = alto;
  grupo.position.set(0, dy + 252 * (1 - alto), dz);

  const largo = zFrente - zAtras;
  const cz = (zFrente + zAtras) * 0.5;
  const caja = (ancho, altoCaja, prof, radio, x, y, z) => {
    const g = new RoundedBoxGeometry(ancho, altoCaja, prof, 8, radio);
    const m = new THREE.Mesh(g, plastico);
    m.position.set(x, y, z);
    return m;
  };

  // 1. Dos cubiertas laterales gruesas y redondeadas (sin puntas ni cuñas): abrazan el bajo del cojín
  for (const signo of [-1, 1]) {
    grupo.add(caja(84, 142, largo - 30, 40, signo * (anchoSup - 36), 166, cz));
  }
  // 2. Núcleo central redondeado: queda metido bajo el cojín y cierra el hueco entre las cubiertas
  grupo.add(caja((anchoSup - 54) * 2, 132, largo - 66, 46, 0, 214, cz - 6));
  // 3. Bandeja frontal ancha de bordes muy redondeados (sin muescas ni esquinas en ángulo)
  grupo.add(caja((anchoSup - 46) * 2, 72, 76, 32, 0, 120, zFrente - 30));
  // 4. Zócalo inferior un poco más angosto, también redondeado
  grupo.add(caja((anchoSup - 88) * 2, 58, largo - 120, 28, 0, 72, cz - 8));

  return grupo;
}

export function mallasDeCuerpo(cuerpo, nombre) {
  const grupo = new THREE.Group();
  grupo.name = nombre;
  const provisional = new THREE.MeshStandardMaterial({ color: 0x777777 });
  for (const [clave, geo] of cuerpo.geometrias) {
    const zona = geo.userData.zona ?? clave.split("|")[0];
    const subZona = geo.userData.subZona ?? "";
    const m = new THREE.Mesh(geo, provisional);
    m.name = subZona ? `${nombre}-${zona}-${subZona}` : `${nombre}-${zona}`;
    m.userData.zona = zona;
    if (subZona) m.userData.subZona = subZona;
    grupo.add(m);
  }
  const porZona = new Map();
  for (const p of cuerpo.pespuntes) {
    const clave = p.soloLiso ? `${p.zona}|liso` : p.zona;
    if (!porZona.has(clave)) porZona.set(clave, { zona: p.zona, soloLiso: !!p.soloLiso, lineas: [] });
    porZona.get(clave).lineas.push(p);
  }
  for (const { zona, soloLiso, lineas } of porZona.values()) {
    const m = crearPespuntes(lineas, provisional);
    m.name = `${nombre}-hilo-${zona}${soloLiso ? "-liso" : ""}`;
    m.userData.hiloDe = zona;
    // Las costuras de los canales de fábrica solo se ven con el panel liso (otro patrón las reemplaza).
    if (soloLiso) m.userData.soloLiso = true;
    grupo.add(m);
  }
  for (const linea of cuerpo.ribetes) {
    const m = crearRibete(linea, 1.55, provisional);
    m.userData.ribete = true;
    grupo.add(m);
  }
  return grupo;
}
