import math
import os
import numpy as np
import trimesh
from PIL import Image

ROOT = os.getcwd()
OUT = os.path.join(ROOT, 'assets', 'models', 'garrafa-termica-azul.glb')
TEXTURE_DIR = os.path.join(ROOT, 'assets', 'models', 'textures')
os.makedirs(TEXTURE_DIR, exist_ok=True)
rng = np.random.default_rng(20261120)
W, H = 2048, 1024
SECTIONS = 256


def save_texture(name, array, quality=94):
    path = os.path.join(TEXTURE_DIR, name)
    pixels = np.clip(array, 0, 255).astype(np.uint8)
    Image.fromarray(pixels, mode='RGB').save(
        path, format='JPEG', quality=quality, subsampling=0, optimize=True
    )
    return Image.open(path).convert('RGB')


# Remove PNGs from the previous high-resolution prototype. JPEG quality 94–97
# retains enough detail for a 3D viewport while cutting mobile download size.
for legacy_name in [
    'blue-powdercoat.png', 'blue-powdercoat-normal.png', 'blue-powdercoat-mr.png',
    'brushed-stainless.png', 'brushed-stainless-normal.png', 'brushed-stainless-mr.png'
]:
    legacy_path = os.path.join(TEXTURE_DIR, legacy_name)
    if os.path.exists(legacy_path):
        os.remove(legacy_path)


def tangent_normal(height, strength=2.0):
    dx, dy = np.gradient(height.astype(np.float32))
    nx = -dx * strength
    ny = -dy * strength
    nz = np.ones_like(nx)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    rgb = np.stack([(nx / length + 1) * 127.5, (ny / length + 1) * 127.5,
                    (nz / length + 1) * 127.5], axis=-1)
    return rgb


# Pintura azul eletrostática: tom profundo, granulação fina e variação de luz quase imperceptível.
u = np.linspace(0, 1, W, dtype=np.float32)[None, :]
v = np.linspace(0, 1, H, dtype=np.float32)[:, None]
grain = rng.normal(0, 1.8, (H, W)).astype(np.float32)
powder_height = (0.30 * np.sin(u * 2 * np.pi * 840) +
                 0.13 * np.sin(u * 2 * np.pi * 1470 + v * 8) +
                 rng.normal(0, 0.18, (H, W))).astype(np.float32)
blue = np.zeros((H, W, 3), dtype=np.float32)
blue[:, :, 0] = 35 + 1.2 * np.cos(u * 2 * np.pi) + grain * 0.58
blue[:, :, 1] = 51 + 1.4 * np.cos(u * 2 * np.pi) + grain * 0.70
blue[:, :, 2] = 137 + 2.0 * np.cos(u * 2 * np.pi) + grain
blue_img = save_texture('blue-powdercoat.jpg', blue, quality=95)
blue_normal = save_texture('blue-powdercoat-normal.jpg', tangent_normal(powder_height, 0.55), quality=96)
blue_rough = np.zeros((H, W, 3), dtype=np.uint8)
blue_rough[:, :, 0] = 255
blue_rough[:, :, 1] = np.clip(158 + rng.normal(0, 4, (H, W)), 145, 170).astype(np.uint8)
blue_rough[:, :, 2] = 38
blue_mr = save_texture('blue-powdercoat-mr.jpg', blue_rough, quality=97)

# Aço escovado: reflexo longitudinal (riscos muito finos e longos), sem parecer cromado.
line_field = (1.4 * np.sin(u * 2 * np.pi * 880) +
              0.65 * np.sin(u * 2 * np.pi * 1490 + 0.2) +
              0.35 * np.sin(u * 2 * np.pi * 2310 + v * 2.2))
steel_noise = rng.normal(0, 0.8, (H, W))
steel = np.zeros((H, W, 3), dtype=np.float32)
steel[:, :, 0] = 173 + line_field + steel_noise
steel[:, :, 1] = 180 + line_field + steel_noise
steel[:, :, 2] = 178 + line_field + steel_noise
steel_img = save_texture('brushed-stainless.jpg', steel, quality=95)
steel_height = (line_field * 0.008 + rng.normal(0, 0.001, (H, W))).astype(np.float32)
steel_normal = save_texture('brushed-stainless-normal.jpg', tangent_normal(steel_height, 7.0), quality=96)
steel_mr = np.zeros((H, W, 3), dtype=np.uint8)
steel_mr[:, :, 0] = 255
steel_mr[:, :, 1] = np.clip(66 + rng.normal(0, 5, (H, W)), 52, 82).astype(np.uint8)
steel_mr[:, :, 2] = 245
steel_metal_rough = save_texture('brushed-stainless-mr.jpg', steel_mr, quality=97)

blue_mat = trimesh.visual.material.PBRMaterial(
    name='Pintura eletrostática azul royal fosca',
    baseColorFactor=[255, 255, 255, 255],
    baseColorTexture=blue_img,
    metallicFactor=0.16,
    roughnessFactor=0.42,
    normalTexture=blue_normal,
    metallicRoughnessTexture=blue_mr
)
steel_mat = trimesh.visual.material.PBRMaterial(
    name='Aço inox escovado acetinado',
    baseColorFactor=[255, 255, 255, 255],
    baseColorTexture=steel_img,
    metallicFactor=0.94,
    roughnessFactor=0.27,
    normalTexture=steel_normal,
    metallicRoughnessTexture=steel_metal_rough
)
black_mat = trimesh.visual.material.PBRMaterial(
    name='Polímero preto acetinado',
    baseColorFactor=[18, 19, 21, 255],
    metallicFactor=0.10,
    roughnessFactor=0.30
)
black_trim = trimesh.visual.material.PBRMaterial(
    name='Borracha preta e borda de vedação',
    baseColorFactor=[7, 8, 10, 255],
    metallicFactor=0.04,
    roughnessFactor=0.48
)
scene = trimesh.Scene()


def catmull_rom(points, samples_per_segment=8):
    pts = np.asarray(points, dtype=float)
    out = []
    for i in range(len(pts) - 1):
        p0 = pts[max(0, i - 1)]
        p1 = pts[i]
        p2 = pts[i + 1]
        p3 = pts[min(len(pts) - 1, i + 2)]
        for t in np.linspace(0, 1, samples_per_segment, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t +
                              (2*p0 - 5*p1 + 4*p2 - p3) * t2 +
                              (-p0 + 3*p1 - 3*p2 + p3) * t3))
    out.append(pts[-1])
    return np.asarray(out)


def lathe(name, profile, material, sections=SECTIONS, textured=True):
    prof = np.asarray(profile, dtype=float)
    angles = np.linspace(-math.pi, math.pi, sections + 1)
    verts, uvs, faces = [], [], []
    ymin, ymax = float(prof[:, 1].min()), float(prof[:, 1].max())
    for radius, yy in prof:
        for j, theta in enumerate(angles):
            verts.append([radius * math.sin(theta), yy, radius * math.cos(theta)])
            uvs.append([j / sections, (yy - ymin) / max(1e-8, ymax - ymin)])
    cols = sections + 1
    for row in range(len(prof) - 1):
        for col in range(sections):
            a = row * cols + col
            b = a + 1
            c = (row + 1) * cols + col
            d = c + 1
            faces.extend([[a, b, d], [a, d, c]])
    mesh = trimesh.Trimesh(vertices=np.asarray(verts), faces=np.asarray(faces), process=False)
    mesh.fix_normals()
    uv = np.asarray(uvs) if textured else None
    mesh.visual = trimesh.visual.texture.TextureVisuals(uv=uv, material=material)
    scene.add_geometry(mesh, geom_name=name, node_name=name)
    return mesh


def add_cylinder(name, radius, height, y, material, sections=160, x=0, z=0):
    mesh = trimesh.creation.cylinder(radius=radius, height=height, sections=sections)
    mesh.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [1, 0, 0]))
    mesh.apply_translation([x, y, z])
    mesh.visual = trimesh.visual.texture.TextureVisuals(material=material)
    scene.add_geometry(mesh, geom_name=name, node_name=name)
    return mesh


def add_sphere(name, radius, position, material):
    mesh = trimesh.creation.icosphere(subdivisions=3, radius=radius)
    mesh.apply_translation(position)
    mesh.visual = trimesh.visual.texture.TextureVisuals(material=material)
    scene.add_geometry(mesh, geom_name=name, node_name=name)


def add_tube(name, path_points, radius, material, sections=20):
    path = catmull_rom(path_points, 8)
    verts, faces = [], []
    for i, point in enumerate(path):
        tangent = path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]
        tangent /= max(1e-9, np.linalg.norm(tangent))
        reference = np.array([0.0, 0.0, 1.0])
        normal = np.cross(tangent, reference)
        if np.linalg.norm(normal) < 1e-7:
            reference = np.array([1.0, 0.0, 0.0])
            normal = np.cross(tangent, reference)
        normal /= np.linalg.norm(normal)
        binormal = np.cross(tangent, normal)
        binormal /= max(1e-9, np.linalg.norm(binormal))
        for j in range(sections):
            angle = 2 * math.pi * j / sections
            p = point + radius * (math.cos(angle) * normal + math.sin(angle) * binormal)
            verts.append(p)
    for i in range(len(path) - 1):
        for j in range(sections):
            a = i * sections + j
            b = i * sections + (j + 1) % sections
            c = (i + 1) * sections + j
            d = (i + 1) * sections + (j + 1) % sections
            faces.extend([[a, b, d], [a, d, c]])
    mesh = trimesh.Trimesh(vertices=np.asarray(verts), faces=np.asarray(faces), process=False)
    mesh.fix_normals()
    mesh.visual = trimesh.visual.texture.TextureVisuals(material=material)
    scene.add_geometry(mesh, geom_name=name, node_name=name)
    return mesh


# Corpo azul: leve tronco de cone, ombros suaves e base arredondada como na fotografia.
body_profile = catmull_rom([
    (0.755, 0.505), (0.758, 0.525), (0.768, 0.565), (0.780, 0.635),
    (0.795, 0.765), (0.823, 1.02), (0.862, 1.43), (0.910, 1.88),
    (0.954, 2.33), (0.981, 2.66), (0.997, 2.88), (0.996, 2.955)
], 10)
lathe('01 - Corpo azul cônico', body_profile, blue_mat, sections=256, textured=True)

# Base metálica com frisos de união e bordas arredondadas.
base_profile = catmull_rom([
    (0.670, 0.075), (0.697, 0.080), (0.724, 0.105), (0.742, 0.155),
    (0.746, 0.235), (0.750, 0.405), (0.761, 0.485), (0.768, 0.525),
    (0.753, 0.548), (0.705, 0.548)
], 8)
lathe('02 - Base inferior em aço inox escovado', base_profile, steel_mat, sections=192, textured=True)
lathe('02a - Linha fina de união da base', catmull_rom([
    (0.758, 0.525), (0.769, 0.540), (0.769, 0.553), (0.756, 0.560)
], 5), black_trim, sections=192, textured=False)

# A faixa de inox superior é alta e aberta, cobrindo a transição entre o corpo e a tampa.
upper_profile = catmull_rom([
    (0.985, 2.835), (0.996, 2.875), (1.010, 2.925), (1.023, 3.035),
    (1.046, 3.205), (1.075, 3.410), (1.080, 3.475), (1.064, 3.505),
    (1.015, 3.505), (0.995, 3.465)
], 10)
lathe('03 - Faixa superior larga em aço inox escovado', upper_profile, steel_mat, sections=224, textured=True)

# Tampa preta moldada com saia, lábio de vedação, plano superior e acabamento arredondado.
lid_profile = catmull_rom([
    (0.945, 3.455), (1.010, 3.465), (1.065, 3.490), (1.105, 3.535),
    (1.120, 3.595), (1.115, 3.655), (1.092, 3.700), (1.055, 3.724),
    (0.995, 3.730), (0.945, 3.710), (0.925, 3.680), (0.930, 3.625)
], 8)
lathe('04 - Tampa preta com borda arredondada', lid_profile, black_mat, sections=224, textured=False)
add_cylinder('04a - Plano superior da tampa', 1.015, 0.055, 3.708, black_mat, 192)
add_cylinder('04b - Vedação inferior da tampa', 1.094, 0.052, 3.485, black_trim, 192)

# Frisos circulares finos, discretos e moldados.
lathe('04c - Filete externo da tampa', catmull_rom([
    (1.105, 3.555), (1.128, 3.575), (1.132, 3.600), (1.118, 3.622)
], 6), black_trim, sections=192, textured=False)

# Pequena alça/ponte elevada na tampa, construída como tubo curvo com terminais.
handle_path = [
    (-0.325, 3.705, 0.105), (-0.330, 3.820, 0.115),
    (-0.292, 3.910, 0.115), (-0.210, 3.950, 0.115),
    (0.210, 3.950, 0.115), (0.292, 3.910, 0.115),
    (0.330, 3.820, 0.115), (0.325, 3.705, 0.105)
]
add_tube('05 - Alça elevada da tampa', handle_path, 0.050, black_gloss if 'black_gloss' in globals() else black_mat, sections=24)
for side, x in enumerate([-0.325, 0.325], start=1):
    add_sphere(f'05a - Base de fixação da alça {side}', 0.071, [x, 3.716, 0.105], black_mat)
    add_cylinder(f'05b - Pino da alça {side}', 0.038, 0.075, 3.72, black_trim, 32, x=x, z=0.105)

# Pequeno ressalto traseiro da tampa, sem exagerar os detalhes não confirmados pela foto.
add_cylinder('06 - Base do ressalto traseiro', 0.23, 0.075, 3.755, black_mat, 96, z=-0.43)
add_cylinder('06a - Tampa do ressalto traseiro', 0.205, 0.045, 3.805, black_trim, 96, z=-0.43)

scene.metadata = {
    'asset': 'Sútil Laser | garrafa térmica azul',
    'model_type': 'photo-referenced parametric mesh',
    'reference': 'single front three-quarter product photograph; dimensions are estimated',
    'units': 'proportional model'
}
scene.export(OUT, file_type='glb')

# Reabre e confirma a malha principal, UVs e todas as partes necessárias para o visualizador.
loaded = trimesh.load(OUT, force='scene')
body = loaded.geometry.get('01 - Corpo azul cônico')
expected = [
    '01 - Corpo azul cônico',
    '02 - Base inferior em aço inox escovado',
    '03 - Faixa superior larga em aço inox escovado',
    '04 - Tampa preta com borda arredondada',
    '05 - Alça elevada da tampa'
]
missing = [name for name in expected if name not in loaded.geometry]
if body is None or getattr(body.visual, 'uv', None) is None:
    raise RuntimeError('GLB sem coordenadas UV na malha azul; a personalização não poderá ser aplicada.')
if missing:
    raise RuntimeError('Partes ausentes no GLB: ' + ', '.join(missing))
bounds = loaded.bounds
if bounds is None or not (3.7 <= bounds[1][1] <= 4.2):
    raise RuntimeError('Altura total inesperada no modelo: ' + str(bounds))
print('GLB validado:', OUT, 'bytes:', os.path.getsize(OUT),
      'geometrias:', len(loaded.geometry), 'UVs corpo:', len(body.visual.uv),
      'dimensões:', (bounds[1] - bounds[0]).round(4).tolist())
