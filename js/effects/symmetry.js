/**
 * Universal radial symmetry — composites a source canvas into targetCtx
 * with `folds`-fold rotational symmetry, with every odd fold mirrored.
 */

export function applySymmetry(sourceCanvas, targetCtx, W, H, folds) {
  targetCtx.save();
  targetCtx.translate(W / 2, H / 2);
  for (let i = 0; i < folds; i++) {
    targetCtx.save();
    targetCtx.rotate(i * 2 * Math.PI / folds);
    targetCtx.drawImage(sourceCanvas, -W / 2, -H / 2, W, H);
    if (i % 2 === 1) {
      targetCtx.scale(-1, 1);
      targetCtx.drawImage(sourceCanvas, -W / 2, -H / 2, W, H);
    }
    targetCtx.restore();
  }
  targetCtx.restore();
}
