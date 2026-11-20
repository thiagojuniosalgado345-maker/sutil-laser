import math
import os
import numpy as np
import trimesh
from PIL import Image

OUT = os.path.join(os.getcwd(), 'assets', 'models', 'garrafa-termica-azul.glb')
TEXTURE_DIR = os.path.join(os.getcwd(), 'assets', 'models', 'textures')
os.makedirs(os.path.dirname(OUT), exist_ok=True)
os.makedirs(TEXTURE_DIR, exist_ok=True)
rng = np.random.default_rng(42)
W, H = 1024, 512

# Textura PBR de pintura eletrostática azul royal com microgranulação discreta.
y, x = np.mgrid[0:H, 0:W]
blue_base = np.zeros((H, W, 3), dtype=np.float32)
for c, base in enumerate([37, 52, 144]):
    blue_base[:, :, c] = base + 1.7 * np.sin(x * 0.13) + 0.9 * np.sin(y * 0.21)
noise = rng.normal(0, 1.35, (H, W, 1))
blue_img = Image.fromarray(np.clip(blue_base + noise, 0, 255).astype(np.uint8), 'RGB')

# Textura de aço com reflexos direcionais e linhas de escovação sutis.
metal_wave = 2.0 * np.sin(x * 0.83) + 0.9 * np.sin(x * 2.6) + 0.45 * np.sin(x * 6.2)
metal_band = 8 * np.exp(-((x - W * .37) / (W * .13)) ** 2) - 5 * np.exp(-((x - W * .78) / (W * .11)) ** 2)
metal = np.zeros((H, W, 3), dtype=np.uint8)
for c, base in enumerate([183, 189, 186]):
    metal[:, :, c] = np.clip(base + metal_wave + metal_band, 0, 255).astype(np.uint8)
metal_img = Image.fromarray(metal, 'RGB')

blue_img.save(os.path.join(TEXTURE_DIR, 'blue-powdercoat.jpg'), quality=92, optimize=True)
metal_img.save(os.path.join(TEXTURE_DIR, 'brushed-stainless.jpg'), quality=92, optimize=True, subsampling=0)

blue_mat = trimesh.visual.material.PBRMaterial(
    name='Azul royal | pintura eletrostática fosca',
    baseColorFactor=[255, 255, 255, 255], baseColorTexture=blue_img,
    metallicFactor=0.16, roughnessFactor=0.39
)
steel_mat = trimesh.visual.material.PBRMaterial(
    name='Aço inox escovado',
    baseColorFactor=[255, 255, 255, 255], baseColorTexture=metal_img,
    metallicFactor=0.90, roughnessFactor=0.28
)
black_mat = trimesh.visual.material.PBRMaterial(
    name='Polímero preto acetinado', baseColorFactor=[17, 18, 19, 255],
    metallicFactor=0.12, roughnessFactor=0.30
)
black_gloss = trimesh.visual.material.PBRMaterial(
    name='Borda preta brilhante', baseColorFactor=[10, 11, 13, 255],
    metallicFactor=0.22, roughnessFactor=0.20
)
scene = trimesh.Scene()


def catmull_rom(points, samples_per_segment=5):
    pts = np.asarray(points, dtype=float)
    out = []
    for i in range(len(pts) - 1):
        p0 = pts[max(0, i - 1)]; p1 = pts[i]
        p2 = pts[i + 1]; p3 = pts[min(len(pts) - 1, i + 2)]
        for t in np.linspace(0, 1, samples_per_segment, endpoint=False):
            t2 = t * t; t3 = t2 * t
            q = .5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
            out.append(q)
    out.append(pts[-1])
    return np.asarray(out)


def lathe(name, profile, material, sections=128, texture_uv=True):
    prof = np.asarray(profile, dtype=float)
    angles = np.linspace(-math.pi, math.pi, sections + 1)
    verts = []; uvs = []
    y_min = float(prof[:, 1].min()); y_max = float(prof[:, 1].max())
    for radius, yy in prof:
        for j, theta in enumerate(angles):
            verts.append([radius * math.sin(theta), yy, radius * math.cos(theta)])
            uvs.append([j / sections, (yy - y_min) / (y_max - y_min if y_max != y_min else 1)])
    faces = []; cols = sections + 1
    for i in range(len(prof) - 1):
        for j in range(sections):
            a = i * cols + j; b = a + 1; c = (i + 1) * cols + j; d = c + 1
            faces.append([a, b, d]); faces.append([a, d, c])
    mesh = trimesh.Trimesh(vertices=np.asarray(verts), faces=np.asarray(faces), process=False)
    mesh.fix_normals()
    uv = np.asarray(uvs) if texture_uv else None
    mesh.visual = trimesh.visual.texture.TextureVisuals(uv=uv, material=material)
    scene.add_geometry(mesh, geom_name=name, node_name=name)
    return mesh


# Corpo em leve tronco de cone, com transições arredondadas como na foto de referência.
body_controls = [(.755, .535), (.765, .555), (.778, .61), (.792, .73), (.815, .98), (.855, 1.38), (.902, 1.85), (.949, 2.29), (.976, 2.52), (.982, 2.61), (.981, 2.66)]
lathe('01 - Corpo azul cônico', catmull_rom(body_controls, 5), blue_mat, sections=160, texture_uv=True)

# Faixa inferior em inox.
base_profile = catmull_rom([(.675, .095), (.705, .105), (.733, .145), (.742, .20), (.744, .42), (.755, .49), (.765, .535), (.755, .55), (.70, .545)], 4)
lathe('02 - Base em aço inox', base_profile, steel_mat, sections=128, texture_uv=True)

# Colar superior largo em aço escovado.
top_profile = catmull_rom([(.972, 2.57), (.989, 2.59), (1.006, 2.64), (1.018, 2.75), (1.034, 2.92), (1.044, 3.09), (1.041, 3.15), (1.022, 3.18), (.996, 3.16), (.984, 3.10)], 5)
lathe('03 - Colar superior em inox escovado', top_profile, steel_mat, sections=144, texture_uv=True)

# Tampa preta moldada e anel externo.
lid_profile = catmull_rom([(.91, 3.105), (.99, 3.11), (1.045, 3.135), (1.085, 3.18), (1.095, 3.235), (1.079, 3.29), (1.035, 3.325), (.98, 3.34), (.91, 3.34)], 5)
lathe('04 - Tampa preta com borda arredondada', lid_profile, black_gloss, sections=144, texture_uv=False)


def add_cylinder(name, radius, height, ypos, material, sections=160, translation=(0, 0, 0)):
    mesh = trimesh.creation.cylinder(radius=radius, height=height, sections=sections)
    mesh.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [1, 0, 0]))
    mesh.apply_translation([translation[0], ypos, translation[2]])
    mesh.visual = trimesh.visual.texture.TextureVisuals(material=material)
    scene.add_geometry(mesh, geom_name=name, node_name=name)
    return mesh


add_cylinder('05 - Superfície superior da tampa', .985, .055, 3.345, black_mat, 160)
tab = trimesh.creation.torus(major_radius=.365, minor_radius=.058, major_sections=64, minor_sections=16)
tab.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [1, 0, 0]))
tab.apply_scale([1.28, .72, .62]); tab.apply_translation([0, 3.49, -.095])
tab.visual = trimesh.visual.texture.TextureVisuals(material=black_gloss)
scene.add_geometry(tab, geom_name='06 - Alça elevada da tampa', node_name='06 - Alça elevada da tampa')

for ix, xx in enumerate([-.31, .31]):
    hinge = trimesh.creation.cylinder(radius=.064, height=.105, sections=32)
    hinge.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [1, 0, 0]))
    hinge.apply_translation([xx, 3.435, -.10])
    hinge.visual = trimesh.visual.texture.TextureVisuals(material=black_mat)
    scene.add_geometry(hinge, geom_name=f'07 - Dobradiça {ix + 1}', node_name=f'07 - Dobradiça {ix + 1}')

inner_profile = catmull_rom([(.985, 3.08), (.997, 3.10), (1.005, 3.12), (1.00, 3.14), (.985, 3.13)], 5)
lathe('08 - Filete de união aço e tampa', inner_profile, steel_mat, sections=128, texture_uv=True)

scene.metadata = {'asset': 'Sútil Laser | garrafa térmica azul', 'reference': 'photo-inspired parametric mesh', 'units': 'meters (proportional model)'}
scene.export(OUT, file_type='glb')
loaded = trimesh.load(OUT, force='scene')
body = loaded.geometry.get('01 - Corpo azul cônico')
if body is None or getattr(body.visual, 'uv', None) is None:
    raise RuntimeError('GLB sem coordenadas UV na malha azul; a personalização não poderá ser aplicada.')
if len(loaded.geometry) < 8:
    raise RuntimeError('GLB incompleto: faltam partes do modelo.')
print('GLB validado:', OUT, 'bytes:', os.path.getsize(OUT), 'geometrias:', len(loaded.geometry), 'UVs:', len(body.visual.uv))
