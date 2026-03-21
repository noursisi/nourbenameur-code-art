/**
 * Film grain overlay — applied as the final step in the render pipeline.
 * Skips fully transparent pixels.
 */

export function applyGrain(ctx, W, H, amount) {
  if (amount <= 0) return;
  // Use the actual canvas backing store dimensions for pixel-level operations
  const dpr = window.devicePixelRatio || 1;
  const pW = Math.round(W * dpr);
  const pH = Math.round(H * dpr);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const img = ctx.getImageData(0, 0, pW, pH);
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] === 0) continue; // skip transparent
    const n = (Math.random() - 0.5) * amount * 80;
    img.data[i]     = Math.max(0, Math.min(255, img.data[i]     + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
  ctx.restore();
}
