/**
 * Compresses the Sasha GLB for the web.
 *
 * The source is ~4.2 MB of pure geometry (no textures, no skins, no clips), so
 * simplification plus Draco is the entire win — texture compression is moot.
 *
 * Run: npm run models:build
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, dedup, prune, draco } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';

const SRC = 'public/models/Sasha-Character.glb';
const OUT = 'public/models/Sasha-Character.draco.glb';
/** Keep ~31% of triangles: 193k -> ~60k. Invisible at mascot display size. */
const SIMPLIFY_RATIO = 0.31;
/** Maximum allowed geometric error, as a fraction of mesh extent. */
const SIMPLIFY_ERROR = 0.001;

function countTriangles(document) {
  let total = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      const position = prim.getAttribute('POSITION');
      const count = indices ? indices.getCount() : position ? position.getCount() : 0;
      total += count / 3;
    }
  }
  return Math.round(total);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});

await MeshoptSimplifier.ready;

const document = await io.read(SRC);
const before = countTriangles(document);

await document.transform(
  dedup(),
  prune(),
  weld(),
  simplify({
    simplifier: MeshoptSimplifier,
    ratio: SIMPLIFY_RATIO,
    error: SIMPLIFY_ERROR,
  }),
  draco(),
);

const after = countTriangles(document);
await io.write(OUT, document);

const { statSync } = await import('node:fs');
const srcKb = Math.round(statSync(SRC).size / 1024);
const outKb = Math.round(statSync(OUT).size / 1024);

process.stdout.write(
  `${SRC}\n  triangles ${before} -> ${after}\n  size ${srcKb} KB -> ${outKb} KB\n  wrote ${OUT}\n`,
);

if (outKb > 500) {
  process.stderr.write(`\nWARNING: ${outKb} KB exceeds the 500 KB budget.\n`);
  process.exit(1);
}
