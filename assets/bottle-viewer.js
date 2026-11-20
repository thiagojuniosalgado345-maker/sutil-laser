import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const SEGMENTS = 160;
const TEXTURE_WIDTH = 2048;
const TEXTURE_HEIGHT = 1024;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

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
  const hasLogo = Boolean(logo && logo.complete && logo.naturalWidth > 0);
  if (!text && !hasLogo) return;

  const xPercent = clamp(Number(customization.positionX ?? 50), 0, 100);
  const yPercent = clamp(Number(customization.positionY ?? 52), 0, 100);
  // A escala horizontal percorre apenas a face frontal útil, sem deixar o texto
  // desaparecer para trás da parede cilíndrica quando o usuário desloca o slider.
  const x = TEXTURE_WIDTH * (0.5 + ((xPercent - 50) / 100) * 0.42);
  // O slider começa em "mais acima"; por isso o y da tela segue a mesma direção.
  const desiredCenterY = TEXTURE_HEIGHT * yPercent / 100;
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
  const maxWidth = TEXTURE_WIDTH * 0.30;

  let lines = [];
  let lineHeight = fontSize * 1.15;
  let textHeight = 0;
  if (text) {
    context.save();
    context.font = '600 ' + fontSize + 'px ' + family;
    lines = wrapText(context, text, maxWidth, 3);
    textHeight = lines.length * lineHeight;
    context.restore();
  }

  let logoWidth = 0;
  let logoHeight = 0;
  if (hasLogo) {
    const scale = (size - 12) / 26;
    const maxLogoWidth = 140 + scale * 350;
    const maxLogoHeight = 80 + scale * 170;
    const ratio = Math.min(maxLogoWidth / logo.naturalWidth, maxLogoHeight / logo.naturalHeight);
    logoWidth = logo.naturalWidth * ratio;
    logoHeight = logo.naturalHeight * ratio;
  }

  const gap = hasLogo && text ? Math.max(22, fontSize * 0.48) : 0;
  const totalHeight = textHeight + (hasLogo ? logoHeight : 0) + gap;
  const centerY = clamp(desiredCenterY, totalHeight / 2 + 8, TEXTURE_HEIGHT - totalHeight / 2 - 8);
  const blockTop = centerY - totalHeight / 2;
  let firstTextY = null;

  if (hasLogo) {
    const logoY = text
      ? blockTop + logoHeight / 2
      : centerY;
    context.save();
    context.globalAlpha = 0.96;
    context.shadowColor = 'rgba(5, 12, 38, 0.22)';
    context.shadowBlur = 3;
    context.drawImage(logo, x - logoWidth / 2, logoY - logoHeight / 2, logoWidth, logoHeight);
    context.restore();
    if (text) firstTextY = blockTop + logoHeight + gap + lineHeight / 2;
  } else if (text) {
    firstTextY = blockTop + lineHeight / 2;
  }

  if (text && firstTextY !== null) {
    context.save();
    context.font = '600 ' + fontSize + 'px ' + family;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineJoin = 'round';

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const lineY = firstTextY + index * lineHeight;
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

  const material = new THREE.MeshPhysicalMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.003,
    depthWrite: false,
    side: THREE.DoubleSide,
    metalness: 0.46,
    roughness: 0.36,
    clearcoat: 0.18,
    clearcoatRoughness: 0.32,
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

export async function createBottleViewer(stage, options = {}) {
  if (!stage) throw new Error('Área do visualizador não encontrada.');
  const canvas = stage.querySelector('#bottle3dCanvas');
  if (!canvas) throw new Error('Canvas 3D não encontrado.');

  let renderer, controls, observer, environmentTarget, pmremGenerator, shadowTexture;
  let gltfScene, personalization, disposed = false, visibilityHandler, scene;
  let animationActive = false;

  try {
    renderer = new THREE.WebGLRenderer({
      canvas, alpha: false, antialias: true, powerPreference: 'high-performance',
      depth: true, stencil: false
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
    scene.environmentIntensity = 1.18;

    pmremGenerator = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    environmentTarget = pmremGenerator.fromScene(room, 0.035);
    scene.environment = environmentTarget.texture;
    room.dispose?.();
    pmremGenerator.dispose();
    pmremGenerator = null;

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
    camera.position.set(2.15, 2.62, 7.7);

    scene.add(new THREE.HemisphereLight(0xfff8ec, 0x343b55, 1.4));
    const key = new THREE.DirectionalLight(0xfff2df, 3.35);
    key.position.set(-4.2, 7.2, 5.5);
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

    const fill = new THREE.DirectionalLight(0xffffff, 1.55);
    fill.position.set(5, 4, 3);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xa8bbff, 1.5);
    rim.position.set(-4, 3.7, -5);
    scene.add(rim);

    shadowTexture = makeContactShadow();
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 2.25),
      new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, 0.012, 0);
    shadow.renderOrder = 1;
    scene.add(shadow);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0xe9e4d9, roughness: 0.96, metalness: 0 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.005;
    floor.receiveShadow = true;
    scene.add(floor);

    const loader = new GLTFLoader();
    const modelUrl = options.assetUrl || new URL('assets/models/garrafa-termica-azul.glb', document.baseURI).href;
    const gltf = await loader.loadAsync(modelUrl);
    if (disposed) throw new Error('Visualização encerrada durante o carregamento.');
    gltfScene = gltf.scene;
    gltfScene.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.filter(Boolean).forEach((material) => {
        material.envMapIntensity = 1.12;
        ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'].forEach((key) => {
          const texture = material[key];
          if (texture?.isTexture) texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        });
        material.needsUpdate = true;
      });
    });
    scene.add(gltfScene);

    const bodyMesh = gltfScene.getObjectByName('01 - Corpo azul cônico');
    if (!bodyMesh?.isMesh) throw new Error('A malha principal do corpo azul não foi encontrada no GLB.');
    if (!bodyMesh.geometry?.attributes?.uv) throw new Error('O corpo azul não tem coordenadas UV para aplicar a gravação.');

    const bounds = new THREE.Box3().setFromObject(gltfScene);
    const center = bounds.getCenter(new THREE.Vector3());
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(center);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.enablePan = false;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.zoomToCursor = true;
    controls.rotateSpeed = 0.72;
    controls.zoomSpeed = 0.75;
    controls.minDistance = 4.3;
    controls.maxDistance = 10.5;
    controls.minPolarAngle = 0.18;
    controls.maxPolarAngle = Math.PI - 0.18;
    controls.update();

    personalization = makePersonalizationOverlay(bodyMesh, renderer);
    personalization.update(options.customization || {});

    const render = () => { if (!disposed) renderer.render(scene, camera); };
    const animate = () => {
      if (disposed || document.hidden) return;
      controls.update();
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
        personalization.update(customization || {});
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
        gltfScene?.traverse((object) => {
          if (!object.isMesh) return;
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.filter(Boolean).forEach((material) => {
            Object.values(material).forEach((value) => { if (value?.isTexture) value.dispose(); });
            material.dispose?.();
          });
        });
        scene?.clear();
        shadowTexture?.dispose();
        environmentTarget?.texture?.dispose();
        renderer?.dispose();
      }
    };
  } catch (error) {
    observer?.disconnect();
    controls?.dispose();
    personalization?.dispose();
    renderer?.setAnimationLoop(null);
    if (gltfScene) {
      gltfScene.traverse((object) => {
        if (!object.isMesh) return;
        object.geometry?.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.filter(Boolean).forEach((material) => {
          Object.values(material).forEach((value) => { if (value?.isTexture) value.dispose(); });
          material.dispose?.();
        });
      });
    }
    scene?.clear();
    shadowTexture?.dispose();
    environmentTarget?.texture?.dispose();
    pmremGenerator?.dispose();
    renderer?.dispose();
    throw error;
  }
}
