import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const SEGMENTS = 160;
const TEXTURE_WIDTH = 2048;
const TEXTURE_HEIGHT = 1024;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function makePowderCoatTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 1024, 0);
  gradient.addColorStop(0, '#101a5b');
  gradient.addColorStop(0.14, '#202d83');
  gradient.addColorStop(0.35, '#26368e');
  gradient.addColorStop(0.56, '#1e2d7c');
  gradient.addColorStop(0.78, '#14205f');
  gradient.addColorStop(1, '#0e174e');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1024, 1024);

  // Microtextura sutil de pintura eletrostática fosca.
  let seed = 41327;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let index = 0; index < 21000; index += 1) {
    const x = random() * 1024;
    const y = random() * 1024;
    const alpha = 0.018 + random() * 0.055;
    const radius = 0.25 + random() * 1.05;
    context.fillStyle = random() > 0.5
      ? 'rgba(255,255,255,' + alpha + ')'
      : 'rgba(0,0,15,' + alpha + ')';
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function makeBrushedSteelTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 1024, 0);
  gradient.addColorStop(0, '#626966');
  gradient.addColorStop(0.12, '#c5cac5');
  gradient.addColorStop(0.25, '#858d89');
  gradient.addColorStop(0.42, '#f1f2ed');
  gradient.addColorStop(0.57, '#aeb5b0');
  gradient.addColorStop(0.73, '#eef0eb');
  gradient.addColorStop(0.88, '#8c9490');
  gradient.addColorStop(1, '#555e5a');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  let seed = 91273;
  const random = () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return seed / 4294967296;
  };
  for (let index = 0; index < 8000; index += 1) {
    const y = random() * canvas.height;
    const alpha = 0.018 + random() * 0.10;
    context.fillStyle = random() > 0.52
      ? 'rgba(255,255,255,' + alpha + ')'
      : 'rgba(24,31,29,' + alpha + ')';
    context.fillRect(0, y, canvas.width, 0.35 + random() * 0.7);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function makeRoughnessTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = '#777777';
  context.fillRect(0, 0, 512, 256);
  let seed = 60217;
  for (let index = 0; index < 3600; index += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const x = seed / 4294967296 * 512;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const y = seed / 4294967296 * 256;
    const tone = 100 + (seed % 75);
    context.fillStyle = 'rgb(' + tone + ',' + tone + ',' + tone + ')';
    context.fillRect(x, y, 0.4, 256);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function createLatheMesh(profile, material, name) {
  const points = profile.map(([radius, height]) => new THREE.Vector2(radius, height));
  const geometry = new THREE.LatheGeometry(points, SEGMENTS, 0, Math.PI * 2);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createHorizontalRing(radius, tube, y, material, name) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 20, 160), material);
  mesh.name = name;
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = y;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createLid(handleMaterial) {
  const group = new THREE.Group();
  group.name = 'Tampa preta com pega';

  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(1.105, 1.105, 0.19, SEGMENTS, 1, false),
    handleMaterial
  );
  skirt.position.y = 3.48;
  skirt.castShadow = true;
  group.add(skirt);

  const upperDisk = new THREE.Mesh(
    new THREE.CylinderGeometry(1.025, 1.075, 0.10, SEGMENTS, 1, false),
    handleMaterial
  );
  upperDisk.position.y = 3.615;
  upperDisk.castShadow = true;
  group.add(upperDisk);

  group.add(createHorizontalRing(1.09, 0.052, 3.475, handleMaterial, 'Aro externo da tampa'));
  group.add(createHorizontalRing(0.96, 0.022, 3.67, handleMaterial, 'Friso superior da tampa'));

  // Alça curta moldada no topo, com cantos suaves, como a peça da referência.
  const loopPoints = [
    new THREE.Vector3(-0.34, 3.64, -0.035),
    new THREE.Vector3(-0.34, 3.81, -0.035),
    new THREE.Vector3(-0.27, 3.89, -0.035),
    new THREE.Vector3(0.27, 3.89, -0.035),
    new THREE.Vector3(0.34, 3.81, -0.035),
    new THREE.Vector3(0.34, 3.64, -0.035)
  ];
  const loopCurve = new THREE.CatmullRomCurve3(loopPoints, false, 'centripetal');
  const loop = new THREE.Mesh(new THREE.TubeGeometry(loopCurve, 64, 0.052, 16, false), handleMaterial);
  loop.name = 'Alça elevada da tampa';
  loop.castShadow = true;
  group.add(loop);

  for (const x of [-0.34, 0.34]) {
    const mount = new THREE.Mesh(new THREE.SphereGeometry(0.057, 24, 16), handleMaterial);
    mount.position.set(x, 3.66, -0.035);
    mount.castShadow = true;
    group.add(mount);
  }
  return group;
}

function createBottleMesh() {
  const blueTexture = makePowderCoatTexture();
  const steelTexture = makeBrushedSteelTexture();
  const steelRoughness = makeRoughnessTexture();

  const blueMaterial = new THREE.MeshPhysicalMaterial({
    map: blueTexture,
    color: 0xffffff,
    metalness: 0.16,
    roughness: 0.39,
    clearcoat: 0.20,
    clearcoatRoughness: 0.42
  });
  const steelMaterial = new THREE.MeshPhysicalMaterial({
    map: steelTexture,
    roughnessMap: steelRoughness,
    color: 0xffffff,
    metalness: 0.91,
    roughness: 0.30,
    clearcoat: 0.12,
    clearcoatRoughness: 0.25,
    anisotropy: 0.72
  });
  const blackMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x101114,
    metalness: 0.12,
    roughness: 0.27,
    clearcoat: 0.34,
    clearcoatRoughness: 0.22
  });
  const darkTrimMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x050609,
    metalness: 0.08,
    roughness: 0.23,
    clearcoat: 0.42
  });

  const bottle = new THREE.Group();
  bottle.name = 'Garrafa térmica azul';

  const baseBand = createLatheMesh([
    [0.716, 0.075], [0.725, 0.095], [0.735, 0.13], [0.744, 0.20],
    [0.765, 0.39], [0.793, 0.49], [0.802, 0.535], [0.785, 0.56]
  ], steelMaterial, 'Faixa inferior em aço inox');
  bottle.add(baseBand);

  const blueBody = createLatheMesh([
    [0.775, 0.445], [0.785, 0.485], [0.802, 0.56], [0.825, 0.72],
    [0.845, 0.92], [0.885, 1.38], [0.935, 1.92], [0.985, 2.43],
    [1.015, 2.76], [1.024, 2.88], [1.019, 2.96], [1.004, 3.005]
  ], blueMaterial, '01 - Corpo azul cônico');
  bottle.add(blueBody);

  const topSteelBand = createLatheMesh([
    [0.999, 2.91], [1.012, 2.96], [1.023, 3.04], [1.045, 3.17],
    [1.077, 3.34], [1.101, 3.48], [1.101, 3.515], [1.078, 3.535],
    [1.03, 3.525], [1.013, 3.48]
  ], steelMaterial, 'Faixa superior larga em aço inox');
  bottle.add(topSteelBand);

  bottle.add(createHorizontalRing(0.79, 0.020, 0.115, steelMaterial, 'Vinco inferior'));
  bottle.add(createHorizontalRing(1.096, 0.025, 3.49, steelMaterial, 'Borda superior polida'));

  // Pequeno acabamento escuro entre o corpo colorido e o aro da tampa.
  const seal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.105, 1.095, 0.055, SEGMENTS, 1, false),
    darkTrimMaterial
  );
  seal.name = 'Vedação escura sob a tampa';
  seal.position.y = 3.535;
  bottle.add(seal);

  bottle.add(createLid(blackMaterial));

  return {
    group: bottle,
    bodyMesh: blueBody,
    materials: [blueMaterial, steelMaterial, blackMaterial, darkTrimMaterial],
    textures: [blueTexture, steelTexture, steelRoughness]
  };
}

function makeContactShadow() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(256, 128, 12, 256, 128, 124);
  gradient.addColorStop(0, 'rgba(24, 23, 21, 0.30)');
  gradient.addColorStop(0.48, 'rgba(24, 23, 21, 0.12)');
  gradient.addColorStop(1, 'rgba(24, 23, 21, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function wrapText(context, text, maxWidth, maxLines = 3) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (line && context.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const visible = lines.slice(0, maxLines);
  visible[maxLines - 1] = visible[maxLines - 1].replace(/[.\s]+$/, '') + '…';
  return visible;
}

function drawEngraving(context, customization) {
  context.clearRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
  const text = String(customization.text || '').trim();
  const logo = customization.logoImage || null;
  if (!text && !(logo && logo.complete && logo.naturalWidth > 0)) return;

  const xPercent = clamp(Number(customization.positionX ?? 50), 0, 100);
  const yPercent = clamp(Number(customization.positionY ?? 52), 0, 100);
  const x = TEXTURE_WIDTH * xPercent / 100;
  const y = TEXTURE_HEIGHT * (1 - yPercent / 100);
  const size = clamp(Number(customization.size ?? 23), 12, 38);
  const fontSize = clamp(Math.round(size * 3.85), 46, 150);
  const fontChoice = customization.font || 'serif';
  const family = fontChoice === 'sans'
    ? 'Manrope, Arial, sans-serif'
    : fontChoice === 'script'
      ? 'cursive'
      : 'Playfair Display, Georgia, serif';
  const requestedColor = /^#[0-9a-f]{6}$/i.test(customization.color || '')
    ? customization.color
    : '#d7d9d5';

  const maxWidth = TEXTURE_WIDTH * 0.42;
  let cursorY = y;

  if (logo && logo.complete && logo.naturalWidth > 0) {
    const scale = (size - 12) / 26;
    const maxLogoWidth = 140 + scale * 350;
    const maxLogoHeight = 80 + scale * 170;
    const ratio = Math.min(maxLogoWidth / logo.naturalWidth, maxLogoHeight / logo.naturalHeight);
    const logoWidth = logo.naturalWidth * ratio;
    const logoHeight = logo.naturalHeight * ratio;
    const logoY = text ? y - logoHeight * 0.72 : y;
    context.save();
    context.globalAlpha = 0.96;
    context.shadowColor = 'rgba(5, 12, 38, 0.22)';
    context.shadowBlur = 3;
    context.drawImage(logo, x - logoWidth / 2, logoY - logoHeight / 2, logoWidth, logoHeight);
    context.restore();
    if (text) cursorY = y + fontSize * 1.18;
  }

  if (text) {
    context.save();
    context.font = '600 ' + fontSize + 'px ' + family;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineJoin = 'round';
    const lines = wrapText(context, text, maxWidth, 3);
    const lineHeight = fontSize * 1.15;
    const firstY = cursorY - ((lines.length - 1) * lineHeight) / 2;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const lineY = firstY + index * lineHeight;
      const metalGradient = context.createLinearGradient(0, lineY - fontSize / 2, 0, lineY + fontSize / 2);
      metalGradient.addColorStop(0, requestedColor);
      metalGradient.addColorStop(0.48, requestedColor);
      metalGradient.addColorStop(1, '#89918f');

      context.globalAlpha = 0.36;
      context.fillStyle = '#071137';
      context.fillText(line, x + 2, lineY + 2, maxWidth);
      context.globalAlpha = 0.96;
      context.fillStyle = metalGradient;
      context.fillText(line, x, lineY, maxWidth);
      context.globalAlpha = 0.22;
      context.strokeStyle = '#ffffff';
      context.lineWidth = 1.2;
      context.strokeText(line, x - 0.5, lineY - 0.7, maxWidth);
    }
    context.restore();
  }
}

function makePersonalizationOverlay(bodyMesh, renderer) {
  const geometry = bodyMesh.geometry.clone();
  const uv = geometry.attributes.uv;
  if (!uv) throw new Error('A malha não contém coordenadas UV para a gravação.');

  // A costura do LatheGeometry fica na parte de trás. O deslocamento de meio giro
  // posiciona o centro da textura exatamente na face frontal da garrafa.
  for (let index = 0; index < uv.count; index += 1) {
    uv.setX(index, (uv.getX(index) + 0.5) % 1);
  }
  uv.needsUpdate = true;

  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;
  if (!normals) geometry.computeVertexNormals();
  const finalNormals = geometry.attributes.normal;
  for (let index = 0; index < positions.count; index += 1) {
    positions.setXYZ(
      index,
      positions.getX(index) + finalNormals.getX(index) * 0.0032,
      positions.getY(index) + finalNormals.getY(index) * 0.0032,
      positions.getZ(index) + finalNormals.getZ(index) * 0.0032
    );
  }
  positions.needsUpdate = true;
  geometry.computeBoundingSphere();

  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) throw new Error('Não foi possível criar a textura de gravação.');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.003,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    toneMapped: false
  });
  const overlay = new THREE.Mesh(geometry, material);
  overlay.name = 'Textura de personalização aderente à superfície';
  overlay.renderOrder = 8;
  bodyMesh.add(overlay);

  return {
    update(customization) {
      drawEngraving(context, customization || {});
      texture.needsUpdate = true;
    },
    dispose() {
      bodyMesh.remove(overlay);
      geometry.dispose();
      material.dispose();
      texture.dispose();
    }
  };
}

export function createBottleViewer(stage, options = {}) {
  if (!stage) throw new Error('Área do visualizador não encontrada.');
  const canvas = stage.querySelector('#bottle3dCanvas');
  if (!canvas) throw new Error('Canvas 3D não encontrado.');

  let renderer;
  let controls;
  let observer;
  let environmentTarget;
  let pmremGenerator;
  let shadowTexture;
  let personalization;
  let bottleParts;
  let disposed = false;
  let visibilityHandler;
  let scene;
  let animationActive = false;

  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance',
      depth: true,
      stencil: false
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = Math.max(1, stage.clientWidth);
    const height = Math.max(1, stage.clientHeight);
    renderer.setSize(width, height, false);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe9e4d9);
    scene.environmentIntensity = 1.15;

    pmremGenerator = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    environmentTarget = pmremGenerator.fromScene(room, 0.035);
    scene.environment = environmentTarget.texture;
    room.dispose?.();
    pmremGenerator.dispose();
    pmremGenerator = null;

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
    camera.position.set(2.15, 2.65, 7.65);
    const target = new THREE.Vector3(0, 2.02, 0);

    const hemi = new THREE.HemisphereLight(0xfff8ec, 0x343b55, 1.45);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff2df, 3.4);
    key.position.set(-4.2, 7, 5.4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 18;
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -2;
    key.shadow.bias = -0.0002;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xffffff, 1.65);
    fill.position.set(5, 4, 3);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0x9fb7ff, 1.6);
    rim.position.set(-4, 3.7, -5);
    scene.add(rim);

    bottleParts = createBottleMesh();
    scene.add(bottleParts.group);

    shadowTexture = makeContactShadow();
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 2.2),
      new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, 0.012, 0);
    shadow.renderOrder = 1;
    scene.add(shadow);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0xe9e4d9, roughness: 0.96 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.005;
    floor.receiveShadow = true;
    scene.add(floor);

    personalization = makePersonalizationOverlay(bottleParts.bodyMesh, renderer);
    personalization.update(options.customization || {});

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.enablePan = false;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.zoomToCursor = true;
    controls.rotateSpeed = 0.72;
    controls.zoomSpeed = 0.75;
    controls.minDistance = 4.4;
    controls.maxDistance = 10.5;
    controls.minPolarAngle = 0.18;
    controls.maxPolarAngle = Math.PI - 0.18;
    controls.update();

    const render = () => {
      if (disposed) return;
      renderer.render(scene, camera);
    };
    const animate = () => {
      if (disposed || document.hidden) return;
      if (controls.enableDamping) controls.update();
      renderer.render(scene, camera);
    };
    renderer.setAnimationLoop(animate);
    animationActive = true;

    observer = new ResizeObserver(() => {
      if (disposed) return;
      const nextWidth = Math.max(1, stage.clientWidth);
      const nextHeight = Math.max(1, stage.clientHeight);
      renderer.setSize(nextWidth, nextHeight, false);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      render();
    });
    observer.observe(stage);

    visibilityHandler = () => {
      if (disposed) return;
      renderer.setAnimationLoop(document.hidden ? null : animate);
      if (!document.hidden) render();
    };
    document.addEventListener('visibilitychange', visibilityHandler);
    render();

    return {
      update(customization) {
        if (disposed || !personalization) return;
        personalization.update(customization);
        render();
      },
      rotateBy(degrees) {
        if (disposed || !controls) return;
        const offset = camera.position.clone().sub(controls.target);
        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(Number(degrees) || 0));
        camera.position.copy(controls.target).add(offset);
        controls.update();
        render();
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        observer?.disconnect();
        if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
        if (animationActive) renderer?.setAnimationLoop(null);
        controls?.dispose();
        personalization?.dispose();
        scene?.traverse((object) => {
          if (!object.isMesh) return;
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.filter(Boolean).forEach((material) => material.dispose?.());
        });
        bottleParts?.textures.forEach(texture => texture.dispose());
        bottleParts?.materials.forEach(material => material.dispose());
        shadowTexture?.dispose();
        environmentTarget?.texture?.dispose();
        scene?.clear();
        renderer?.dispose();
      }
    };
  } catch (error) {
    observer?.disconnect();
    controls?.dispose();
    personalization?.dispose();
    renderer?.setAnimationLoop(null);
    if (scene) {
      scene.traverse((object) => {
        if (object.isMesh) object.geometry?.dispose();
      });
      scene.clear();
    }
    bottleParts?.textures.forEach(texture => texture.dispose());
    bottleParts?.materials.forEach(material => material.dispose());
    shadowTexture?.dispose();
    environmentTarget?.texture?.dispose();
    pmremGenerator?.dispose();
    renderer?.dispose();
    throw error;
  }
}
