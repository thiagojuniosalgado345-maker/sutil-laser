import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

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
  const x = TEXTURE_WIDTH * xPercent / 100;
  // O slider começa em "mais acima"; por isso o y da tela segue a mesma direção.
  const desiredCenterY = TEXTURE_HEIGHT * yPercent / 100;
  const size = clamp(Number(customization.size ?? 23), 12, 38);
  const fontSize = clamp(Math.round(size * 5.2), 62, 198);
  const fontChoice = customization.font || 'serif';
  const family = fontChoice === 'sans'
    ? 'Manrope, Arial, sans-serif'
    : fontChoice === 'script'
      ? 'cursive'
      : 'Playfair Display, Georgia, serif';
  const requestedColor = /^#[0-9a-f]{6}$/i.test(customization.color || '')
    ? customization.color
    : '#d7d9d5';
  const maxWidth = TEXTURE_WIDTH * 0.62;

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
    const maxLogoWidth = 260 + scale * 520;
    const maxLogoHeight = 140 + scale * 260;
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

const BOTTLE_BODY_PROFILE = [
  [0.505, 0.755], [0.525, 0.758], [0.565, 0.768], [0.635, 0.780],
  [0.765, 0.795], [1.02, 0.823], [1.43, 0.862], [1.88, 0.910],
  [2.33, 0.954], [2.66, 0.981], [2.88, 0.997], [2.955, 0.996]
];

function bottleRadiusAt(height) {
  for (let index = 0; index < BOTTLE_BODY_PROFILE.length - 1; index += 1) {
    const [y0, r0] = BOTTLE_BODY_PROFILE[index];
    const [y1, r1] = BOTTLE_BODY_PROFILE[index + 1];
    if (height >= y0 && height <= y1) {
      const amount = (height - y0) / (y1 - y0);
      return r0 + (r1 - r0) * amount;
    }
  }
  return height < BOTTLE_BODY_PROFILE[0][0]
    ? BOTTLE_BODY_PROFILE[0][1]
    : BOTTLE_BODY_PROFILE[BOTTLE_BODY_PROFILE.length - 1][1];
}

function createFrontEngravingGeometry() {
  const columns = 112;
  const rows = 64;
  const thetaStart = -0.98;
  const thetaEnd = 0.98;
  const yMin = 0.565;
  const yMax = 2.91;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    const y = yMin + (yMax - yMin) * v;
    const radius = bottleRadiusAt(y) + 0.0045;
    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns;
      const theta = thetaStart + (thetaEnd - thetaStart) * u;
      positions.push(
        Math.sin(theta) * radius,
        y,
        Math.cos(theta) * radius
      );
      // U progride da esquerda para a direita; V progride da base ao topo.
      uvs.push(u, v);
    }
  }

  const stride = columns + 1;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * stride + column;
      const b = a + 1;
      const c = (row + 1) * stride + column;
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function makePersonalizationOverlay(bodyMesh, renderer) {
  if (!bodyMesh?.isMesh) throw new Error('A malha do corpo azul não está disponível.');
  const geometry = createFrontEngravingGeometry();
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) throw new Error('Não foi possível criar a textura de gravação.');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = true;
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
    side: THREE.FrontSide,
    metalness: 0.48,
    roughness: 0.34,
    clearcoat: 0.24,
    clearcoatRoughness: 0.26,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    toneMapped: false
  });
  const overlay = new THREE.Mesh(geometry, material);
  overlay.name = 'Faixa curva frontal para personalização';
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
    const mobileCanvas = window.matchMedia?.('(max-width: 760px)').matches || false;
    renderer = new THREE.WebGLRenderer({
      canvas, alpha: false, antialias: !mobileCanvas, powerPreference: 'default',
      depth: true, stencil: false, precision: 'mediump'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobileCanvas ? 1.75 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.shadowMap.enabled = !mobileCanvas;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const width = Math.max(1, stage.clientWidth);
    const height = Math.max(1, stage.clientHeight);
    renderer.setSize(width, height, false);

    scene = new THREE.Scene();
    const studioColor = 0xe9e4d9;
    scene.background = new THREE.Color(studioColor);
    scene.environmentIntensity = 1.32;

    // O mapa de ambiente melhora muito o aço, mas é um recurso opcional:
    // se o dispositivo não conseguir gerar PMREM, a iluminação direta mantém
    // o modelo utilizável em vez de abortar toda a inicialização.
    try {
      pmremGenerator = new THREE.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      environmentTarget = pmremGenerator.fromScene(room, 0.035);
      scene.environment = environmentTarget.texture;
      room.dispose?.();
      pmremGenerator.dispose();
      pmremGenerator = null;
    } catch (environmentError) {
      console.warn('Ambiente PBR avançado indisponível; usando iluminação direta:', environmentError);
      pmremGenerator?.dispose();
      pmremGenerator = null;
      environmentTarget = null;
      scene.environment = null;
    }

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
    camera.position.set(2.15, 2.62, 7.7);

    scene.add(new THREE.HemisphereLight(0xfff8ed, 0x555365, 1.08));
    const key = new THREE.DirectionalLight(0xfff2df, 2.15);
    key.position.set(-4.5, 6.5, 5.0);
    key.castShadow = !mobileCanvas;
    key.shadow.mapSize.set(1536, 1536);
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 18;
    key.shadow.camera.left = -3.4;
    key.shadow.camera.right = 3.4;
    key.shadow.camera.top = 4.5;
    key.shadow.camera.bottom = -1.8;
    key.shadow.bias = -0.00018;
    key.shadow.normalBias = 0.025;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xffffff, 0.85);
    fill.position.set(4.5, 3.5, 4.0);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xc8d5ff, 1.05);
    rim.position.set(-3.5, 4.5, -4.5);
    scene.add(rim);

    // Softboxes retangulares criam faixas de reflexão longas no inox e no verniz.
    try {
      RectAreaLightUniformsLib.init();
      const softboxLeft = new THREE.RectAreaLight(0xfff4e8, mobileCanvas ? 2.0 : 2.8, 3.0, 5.2);
      softboxLeft.position.set(-3.0, 3.4, 3.8);
      softboxLeft.lookAt(0, 1.9, 0);
      scene.add(softboxLeft);
      const softboxRight = new THREE.RectAreaLight(0xffffff, mobileCanvas ? 1.1 : 1.6, 1.3, 4.4);
      softboxRight.position.set(3.2, 2.7, 2.7);
      softboxRight.lookAt(0, 1.8, 0);
      scene.add(softboxRight);
      const topSoftbox = new THREE.RectAreaLight(0xe6edff, 1.15, 3.8, 1.6);
      topSoftbox.position.set(0, 5.7, -0.5);
      topSoftbox.lookAt(0, 2.1, 0);
      scene.add(topSoftbox);
    } catch (areaLightError) {
      console.warn('Softboxes indisponíveis; mantendo iluminação de estúdio direcional.', areaLightError);
    }

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
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshBasicMaterial({ color: studioColor, toneMapped: false })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.004;
    floor.renderOrder = 0;
    scene.add(floor);

    const loader = new GLTFLoader();
    const modelUrl = options.assetUrl || new URL('assets/models/garrafa-termica-azul.glb', document.baseURI).href;
    const gltf = await loader.loadAsync(modelUrl);
    if (disposed) throw new Error('Visualização encerrada durante o carregamento.');
    gltfScene = gltf.scene;
    gltfScene.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = !mobileCanvas;
      object.receiveShadow = !mobileCanvas;
      const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
      const upgraded = sourceMaterials.filter(Boolean).map((source) => {
        const label = ((source.name || '') + ' ' + (object.name || '')).toLocaleLowerCase('pt-BR');
        const steel = /inox|aço|escovado/.test(label);
        const blue = /azul|corpo/.test(label);
        const material = new THREE.MeshPhysicalMaterial({
          name: source.name,
          color: source.color ? source.color.clone() : new THREE.Color(0xffffff),
          map: source.map || null,
          normalMap: source.normalMap || null,
          roughnessMap: source.roughnessMap || null,
          metalnessMap: source.metalnessMap || null,
          alphaMap: source.alphaMap || null,
          transparent: source.transparent,
          opacity: source.opacity,
          side: source.side,
          metalness: steel ? 0.94 : blue ? 0.16 : 0.10,
          roughness: steel ? 0.27 : blue ? 0.42 : 0.30,
          clearcoat: steel ? 0.18 : blue ? 0.28 : 0.36,
          clearcoatRoughness: steel ? 0.24 : blue ? 0.48 : 0.23,
          ior: 1.48,
          anisotropy: steel ? 0.78 : 0.06,
          anisotropyRotation: steel ? Math.PI / 2 : 0
        });
        material.envMapIntensity = steel ? 1.55 : blue ? 1.20 : 0.92;
        if (material.normalScale) material.normalScale.set(steel ? 0.46 : 0.22, steel ? 1.0 : 0.35);
        ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'alphaMap'].forEach((key) => {
          const texture = material[key];
          if (texture?.isTexture) {
            texture.anisotropy = Math.min(12, renderer.capabilities.getMaxAnisotropy());
            texture.needsUpdate = true;
          }
        });
        material.needsUpdate = true;
        source.dispose?.();
        return material;
      });
      object.material = Array.isArray(object.material) ? upgraded : upgraded[0];
    });
    scene.add(gltfScene);

    const bodyNode = gltfScene.getObjectByName('01 - Corpo azul cônico');
    // O exportador pode colocar o nome no nó-pai (Group) e a malha real no filho.
    let bodyMesh = bodyNode?.isMesh ? bodyNode : bodyNode?.getObjectByProperty('isMesh', true);

    const meshCandidates = [];
    gltfScene.traverse((object) => {
      if (!object.isMesh || !object.geometry?.attributes?.position) return;
      object.geometry.computeBoundingBox();
      const bounds = object.geometry.boundingBox;
      const height = bounds ? bounds.max.y - bounds.min.y : 0;
      const vertices = object.geometry.attributes.position.count;
      meshCandidates.push({ object, height, vertices });
    });

    // Fallback robusto: o corpo azul é a maior malha vertical da peça.
    if (!bodyMesh?.isMesh) {
      meshCandidates.sort((a, b) => (b.height * b.vertices) - (a.height * a.vertices));
      bodyMesh = meshCandidates[0]?.object || null;
    }

    if (!bodyMesh?.isMesh) {
      const names = meshCandidates.map(item => item.object.name || '(malha sem nome)').join(', ');
      throw new Error('Nenhuma malha utilizável foi encontrada no GLB. Malhas detectadas: ' + names);
    }
    if (!bodyMesh.geometry?.attributes?.uv) {
      const details = meshCandidates.map(item => (item.object.name || '(sem nome)') + ': ' + item.vertices + ' vértices').join('; ');
      throw new Error('A malha escolhida para o corpo não possui UV para gravação. Malhas: ' + details);
    }

    const bounds = new THREE.Box3().setFromObject(gltfScene);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const verticalSpan = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const horizontalSpan = size.x / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.max(0.5, camera.aspect));
    const fitDistance = Math.max(verticalSpan, horizontalSpan) * 1.16;
    const homePosition = center.clone().add(new THREE.Vector3(fitDistance * 0.16, size.y * 0.045, fitDistance));
    camera.position.copy(homePosition);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(center);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = false;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.zoomToCursor = true;
    controls.rotateSpeed = 0.82;
    controls.zoomSpeed = 0.78;
    controls.minDistance = fitDistance * 0.58;
    controls.maxDistance = fitDistance * 1.65;
    controls.minPolarAngle = 0.15;
    controls.maxPolarAngle = Math.PI - 0.15;
    controls.screenSpacePanning = false;
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
      resetView() {
        if (disposed || !controls) return;
        controls.target.copy(center);
        camera.position.copy(homePosition);
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
