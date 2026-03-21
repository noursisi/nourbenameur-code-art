/**
 * Film grain overlay — applied as the final step in the render pipeline.
 * Skips fully transparent pixels.
 */

export function applyGrain(ctx, W, H, amount) {
  if (amount <= 0) return;
  const img = ctx.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] === 0) continue; // skip transparent
    const n = (Math.random() - 0.5) * amount * 80;
    img.data[i]     = Math.max(0, Math.min(255, img.data[i]     + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}
