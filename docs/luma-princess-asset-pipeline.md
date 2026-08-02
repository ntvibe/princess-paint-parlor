# Luma Princess: production asset pipeline

## Decision

Do **not** ship a raw image-to-3D result.  It is useful as a high-detail
reference, but it is not reliable enough for the paint surface: it usually has
uneven topology, tangled hair, overlapping UVs, baked lighting, and a single
material that makes clean makeup compositing impossible.

The browser needs one deliberately prepared `FaceSkin` mesh with a non-
overlapping 0–1 UV island.  Hair, eyes, lashes, tiara, teeth, and clothing must
be separate meshes/materials.  The app will put the editable `CanvasTexture`
on `FaceSkin` only.

The four original orthographic-style references live in
`public/reference/views/`.  They are the source of truth for silhouette,
features, hair, and back-of-head coverage.

## Staged workflow

| Stage | Tool / service | Deliverable | Gate before continuing |
| --- | --- | --- | --- |
| 1. Source reconstruction | [TRELLIS](https://huggingface.co/spaces/trellis-community/TRELLIS) multi-image GLB, or a CUDA run of [Hunyuan3D 2.1](https://huggingface.co/tencent/Hunyuan3D-2.1) | `source.glb` | Four views agree; the face, ears, hairline, and back of head exist. |
| 2. Inspect and repair | Blender | `source-repaired.blend` | No open facial holes, duplicate shells, or broken normals. |
| 3. Retopology | [AutoRemesher](https://github.com/huxingyi/autoremesher) followed by Blender face-loop cleanup | `luma-retopo.blend` | Clean, animation-friendly loops around eyes, brows, nose, mouth, and jaw. |
| 4. UV layout | Blender for `FaceSkin`; [xatlas](https://github.com/jpcy/xatlas) for hair/tiara/gown if needed | `luma-uv.blend` | One non-overlapping facial 0–1 island; seams sit behind ears/hairline/jaw, never across lips, eyes, or cheeks. |
| 5. PBR transfer | Blender Bake | albedo, normal, AO, roughness, metallic maps | Facial maps contain no baked lighting, highlights, or makeup. |
| 6. Material separation | Blender | named mesh and material slots | `FaceSkin`, `Eyes`, `Lashes`, `Hair`, `Tiara`, and `Gown` are independently addressable. |
| 7. Export and compression | Blender glTF export + [glTF Transform](https://gltf-transform.dev/) | `public/models/luma-princess.glb` | Valid GLB, normal/tangent data intact, model remains within the mobile budget. |
| 8. In-browser acceptance | Luma Face Studio | paintable production model | Lip/eyelid/cheek strokes survive rotate, zoom, lock, undo, and export. |

## How the generation stage is used

1. Submit the four crops in this order: `front`, `three-quarter`, `profile`,
   `back`.
2. Generate two or three candidates.  Choose the one with the cleanest facial
   silhouette and most coherent hairline—not simply the most detailed texture.
3. Keep the winner as **reference/high poly only**.  Do not attempt to paint
   directly on its generated material or UVs.
4. If the initial mesh has good geometry but poor colour, keep its geometry and
   bake a neutral, makeup-free base albedo from the original front/three-quarter
   views.  Makeup must remain a runtime overlay, not baked into the base skin.

`TRELLIS` is the no-cost first attempt because its Space exposes experimental
multi-image input and GLB extraction.  It is not a dependable build dependency:
on 2026-08-02 the hosted GPU job accepted our four uploads but returned a
server-side error before generation.  Use a working CUDA provider for this
stage when the public demo is unavailable.  The surrounding stages are local
and unchanged.

## Exact Blender preparation

### 1. Repair and split

- Import `source.glb`; apply scale and rotation.
- Delete floating fragments, hidden internal faces, and geometry below the
  collar that will never be shown.
- Separate eyes, lashes, hair, tiara, teeth, and gown from skin.  Rebuild eyes
  as separate spheres if the generated ones are fused into the face.
- Retain the source as `SourceHigh`; never overwrite it.

### 2. Build the paint surface

- Retopologize an all-quad head at a density suitable for expression, then
  shrinkwrap/project it to `SourceHigh`.
- Give the paintable head object the exact name `FaceSkin` and one material
  named `FaceSkin_Base`.
- Keep ears and the visible neck in the same facial UV set, but exclude scalp
  underneath the hair, eyeballs, teeth, lashes, tiara, and gown.
- Mark seams down the back of head, behind both ears, and under the jawline.
  Unwrap manually and pack the entire face at high, consistent texel density.
- Run a UV overlap check.  Any overlap on the face is a release blocker because
  one brush stroke would appear in two places.

### 3. Bake neutral PBR maps

- Create a 2048 × 2048 `FaceSkin_BaseColor` image and bake base colour from
  `SourceHigh` to `FaceSkin`; remove lighting and any accidental cosmetics.
- Bake tangent-space normal, AO, and roughness.  Use the low poly UV map on
  all targets and verify cage distance around nose, lips, and ears.
- Use 1024 maps for hair and 512–1024 for tiara/gown unless visual QA proves
  they need more.
- Preserve a `FaceSkin_Paint` blank RGBA image.  The app replaces this layer
  with the dynamic canvas and blends it over `FaceSkin_BaseColor`.

### 4. Export contract

Export one GLB with these nodes:

```
LumaPrincess
├── FaceSkin       # one 0–1 paint UV set; runtime CanvasTexture goes here
├── Eyes           # static PBR, never receives makeup
├── Lashes         # static alpha material
├── Hair           # static PBR
├── Tiara          # static PBR
└── Gown           # static PBR
```

Use a right-handed glTF export, applied transforms, and named materials.
Export normals and tangents.  Do not merge `FaceSkin` with hair or accessories.

## Mobile delivery budget and validation

Start with a 2K uncompressed editable face canvas in memory, then cap renderer
pixel ratio in the app.  For the static GLB, optimize geometry with meshopt and
use WebP for colour textures first; introduce KTX2 only after the loader path
is configured and verified on an iPhone-class device.

Run after each export:

```sh
npx @gltf-transform/cli inspect public/models/luma-princess.glb
npx @gltf-transform/cli optimize public/models/luma-princess.glb public/models/luma-princess.optimized.glb --compress meshopt --texture-compress webp
```

Then load the optimized file in the app and confirm all of the following:

1. A paint stroke on the left cheek does not appear on the right cheek, ear, or
   back of head.
2. Strokes remain aligned after close zoom and after rotating to profile.
3. Camera lock switches touch input from orbit to painting without accidental
   camera movement.
4. Undo/redo changes only the paint layer; the source skin, eyes, and hair do
   not change.
5. The model is responsive at phone viewport size and does not show visible
   texture seams at lips, eyelids, nose, or jaw.

Only after these gates pass should `luma-princess.glb` replace the current
procedural demo head.
