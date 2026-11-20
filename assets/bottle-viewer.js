import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const BODY_NODE_NAME = '01 - Corpo azul cônico';
const TEXTURE_WIDTH = 2048;
const TEXTURE_HEIGHT = 1024;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function wrappedLines(context, text, maxWidth, maxLines = 3) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[.\\s]+$/, '')}…`;
  return kept;
}

function makeContactShadow() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(256, 128, 12, 256, 128, 124);
  gradient.addColorStop(0, 'rgba(24, 23, 21, 0.28)');
  gradient.addColorStop(0.48, 'rgba(24, 23, 21, 0.12)');
  gradient.addColorStop(1, 'rgba(24, 23, 21, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildPersonalizationCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) throw new Error('Não foi possível preparar a textura de personalização.');
  return { canvas, context };
}

function applyEtching(context, text, x, y, fontSize, color, family) {
  const maxWidth = TEXTURE_WIDTH * 0.44;
  context.save();
  context.font = `600 ${fontSize}px ${family}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineJoin = 'round';
  const lines = wrappedLines(context, text, maxWidth, 3);
  const lineHeight = fontSize * 1.16;
  const totalHeight = lineHeight * lines.length;
  let cursorY = y - (totalHeight - lineHeight) / 2;

  for (const line of lines) {
    context.globalAlpha = 0.26;
    context.fillStyle = '#0b143b';
    context.fillText(line, x + 1.3, cursorY + 1.8, maxWidth);
    context.globalAlpha = 0.94;
    context.fillStyle = color;
    context.fillText(line, x, cursorY, maxWidth);
    context.globalAlpha = 0.20;
    context.fillStyle = '#ffffff';
    context.fillText(line, x - 0.6, cursorY - 0.8, maxWidth);
    cursorY += lineHeight;
  }
  context.restore();
}

function drawCustomization(context, customization) {
  context.clearRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
  const text = String(customization.text || '').trim();
  const logo = customization.logoImage || null;
  if (!text && !(logo && logo.complete && logo.naturalWidth > 0)) return;

  const x = TEXTURE_WIDTH * clamp(Number(customization.positionX ?? 50), 0, 100) / 100;
  const y = TEXTURE_HEIGHT * clamp(Number(customization.positionY ?? 52), 0, 100) / 100;
  const size = clamp(Number(customization.size ?? 23), 12, 38);
  const fontSize = clamp(Math.round(size * 4.55), 52, 174);
  const selectedFont = customization.font || 'serif';
  const family = selectedFont === 'sans'
    ? 'Manrope, Arial, sans-serif'
    : selectedFont === 'script'
      ? 'cursive'
      : 'Playfair Display, Georgia, serif';
  const color = /^#[0-9a-f]{6}$/i.test(customization.color || '')
    ? customization.color
    : '#d7d9d5';

  if (logo && logo.complete && logo.naturalWidth > 0) {
    const scale = (size - 12) / 26;
    const maxWidth = 210 + scale * 300;
    const maxHeight = 125 + scale * 180;
    const ratio = Math.min(maxWidth / logo.naturalWidth, maxHeight / logo.naturalHeight);
    const width = logo.naturalWidth * ratio;
    const height = logo.naturalHeight * ratio;
    const logoY = text ? y - height * 0.72 : y;
    context.save();
    context.globalAlpha = 0.96;
    context.shadowColor = 'rgba(7, 13, 36, 0.16)';
    context.shadowBlur = 2;
    context.drawImage(logo, x - width / 2, logoY - height / 2, width, height);
    context.restore();
  }

  if (text) {
    const textY = logo && logo.complete && logo.naturalWidth > 0 ? y + fontSize * 1.12 : y;
    applyEtching(context, text, x, textY, fontSize, color, family);
  }
}

function makePersonalizationOverlay(bodyMesh, renderer) {
  const sourceGeometry = bodyMesh.geometry;
  if (!sourceGeometry?.attributes?.uv || !sourceGeometry?.attributes?.position) {
    throw new Error('O modelo 3D não contém coordenadas para mapear a personalização.');
  }
  if (!sourceGeometry.attributes.normal) sourceGeometry.computeVertexNormals();

  const geometry = sourceGeometry.clone();
  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;
  for (let index = 0; index < positions.count; index += 1) {
    positions.setXYZ(
      index,
      positions.getX(index) + normals.getX(index) * 0.0025,
      positions.getY(index) + normals.getY(index) * 0.0025,
      positions.getZ(index) + normals.getZ(index) * 0.0025
    );
  }
  positions.needsUpdate = true;
  geometry.computeBoundingSphere();

  const { canvas, context } = buildPersonalizationCanvas();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.MeshPhysicalMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.004,
    depthWrite: false,
    side: THREE.DoubleSide,
    roughness: 0.66,
    metalness: 0.08,
    clearcoat: 0.04,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });
  const overlay = new THREE.Mesh(geometry, material);
  overlay.name = 'Prévia de gravação personalizada';
  overlay.renderOrder = 8;
  bodyMesh.add(overlay);

  return {
    update(customization) {
      drawCustomization(context, customization);
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
  if (!stage) throw new Error('Área de visualização não encontrada.');
  const canvas = stage.querySelector('#bottle3dCanvas');
  if (!canvas) throw new Error('Canvas 3D não encontrado.');

  let renderer;
  let controls;
  let observer;
  let environmentTarget;
  let pmremGenerator;
  let shadowTexture;
  let gltfScene;
  let personalization;
  let disposed = false;
  let visibilityHandler;
  let scene;

  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.14;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const width = Math.max(1, stage.clientWidth);
    const height = Math.max(1, stage.clientHeight);
    renderer.setSize(width, height, false);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe9e4d9);
    scene.environmentIntensity = 1.18;

    pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const room = new RoomEnvironment();
    environmentTarget = pmremGenerator.fromScene(room, 0.04);
    scene.environment = environmentTarget.texture;
    room.dispose?.();
    pmremGenerator.dispose();
    pmremGenerator = null;

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
    camera.position.set(2.15, 2.85, 7.75);

    scene.add(new THREE.HemisphereLight(0xfff8eb, 0x4d5364, 1.25));
    const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.7);
    keyLight.position.set(-4.5, 7.5, 5.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 20;
    keyLight.shadow.camera.left = -4;
    keyLight.shadow.camera.right = 4;
    keyLight.shadow.camera.top = 5;
    keyLight.shadow.camera.bottom = -2;
    keyLight.shadow.bias = -0.00025;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 1.2);
    fillLight.position.set(5, 4, 3);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0xa8bbff, 1.3);
    rimLight.position.set(-4, 3.5, -5);
    scene.add(rimLight);

    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 2.35),
      new THREE.MeshBasicMaterial({ map: (shadowTexture = makeContactShadow()), transparent: true, depthWrite: false })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(0, 0.018, 0);
    shadowPlane.renderOrder = 1;
    scene.add(shadowPlane);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0xe9e4d9, roughness: 0.96, metalness: 0 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.008;
    floor.receiveShadow = true;
    scene.add(floor);

    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(options.assetUrl || 'assets/models/garrafa-termica-azul.glb');
    if (disposed) throw new Error('Visualização encerrada durante o carregamento.');
    gltfScene = gltf.scene;
    gltfScene.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        object.frustumCulled = true;
      }
    });
    scene.add(gltfScene);

    const bodyMesh = gltfScene.getObjectByName(BODY_NODE_NAME);
    if (!bodyMesh?.isMesh) throw new Error('A malha principal da garrafa não foi encontrada no arquivo 3D.');
    personalization = makePersonalizationOverlay(bodyMesh, renderer);
    personalization.update(options.customization || {});

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.78, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = false;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.minDistance = 4.3;
    controls.maxDistance = 10.5;
    controls.minPolarAngle = 0.24;
    controls.maxPolarAngle = Math.PI - 0.24;
    controls.rotateSpeed = 0.78;
    controls.zoomSpeed = 0.72;
    controls.update();

    const render = () => {
      if (disposed) return;
      controls.update();
      renderer.render(scene, camera);
    };
    const renderLoop = () => {
      if (disposed || document.hidden) return;
      controls.update();
      renderer.render(scene, camera);
    };
    renderer.setAnimationLoop(renderLoop);
    controls.addEventListener('change', render);

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
      renderer.setAnimationLoop(document.hidden ? null : renderLoop);
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
        renderer?.setAnimationLoop(null);
        controls?.removeEventListener('change', render);
        controls?.dispose();
        personalization?.dispose();
        gltfScene?.traverse((object) => {
          if (!object.isMesh) return;
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.filter(Boolean).forEach((material) => {
            Object.values(material).forEach((value) => {
              if (value?.isTexture) value.dispose();
            });
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
    if (renderer) {
      renderer.setAnimationLoop(null);
      renderer.dispose();
    }
    environmentTarget?.texture?.dispose();
    pmremGenerator?.dispose();
    shadowTexture?.dispose();
    throw error;
  }
}
