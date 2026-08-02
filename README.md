# Luma Face Studio

The end-to-end source-to-mobile-model workflow is in
[docs/luma-princess-asset-pipeline.md](docs/luma-princess-asset-pipeline.md).
It intentionally uses separate reconstruction, retopology, UV, PBR bake, and
delivery stages rather than relying on a raw AI mesh.

A mobile-first Three.js makeup painter. Users orbit and pinch-zoom a 3D original princess head, then lock the front camera to paint directly into the head mesh’s live UV texture.

## What is implemented

- Three.js / WebGL renderer with capped device pixel ratio for mobile performance
- A procedural, original stylized princess portrait: skin, eyes, hair, tiara, neck, and shoulders are real 3D geometry
- Raycast-to-UV brush painting on a 1024×1024 `CanvasTexture` (not a screen-space overlay)
- Soft blush, eye shadow, lip glaze, highlighter, and freckles
- Touch orbit / pinch zoom in explore mode; centered, camera-locked paint mode
- Brush size, clear, undo, front-view, and zoom controls, with a compact mobile dock
- A three-step blush / shadow / lip game loop with a completion reveal and a save-look action

## Production-quality character path

For a highly realistic launch model, retain this interaction system and replace the procedural `head` assembly in `src/main.ts` with a licensed, artist-authored GLB that has:

1. a separate, paintable facial skin mesh with clean, non-overlapping 0–1 UVs;
2. separate eye, eyelash, hair, teeth, and jewelry meshes, so cosmetics affect skin only;
3. 2K–4K PBR skin maps (albedo, normal, roughness, AO) and a physically based hair material;
4. baked low-poly mobile LODs plus Draco or Meshopt compression.

The existing raycast result (`intersection.uv`) and `CanvasTexture` are the intended seam: assign the dynamic canvas to the GLB facial material map and keep all existing painting tools.

Use an original "cinematic family-animation princess" art direction rather than requesting or copying a specific studio’s proprietary character/style.

## Prepared reconstruction references

The original, consistent turntable is saved at `public/reference/luma-princess-turntable-v1.png`, with the four upload-ready views in `public/reference/views/`:

- `luma-princess-front.png`
- `luma-princess-three-quarter.png`
- `luma-princess-profile.png`
- `luma-princess-right-profile.png`
- `luma-princess-back.png`

Submit those four individual images to a multi-image-to-3D service—not the unsplit 2×2 sheet. Request a textured, PBR `GLB`, then inspect and clean the facial UVs before replacing the procedural head.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
