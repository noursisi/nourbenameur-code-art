/**
 * Image layer — load, store, and draw a user-supplied image onto the canvas.
 */

let loadedImage = null;

export function loadImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { loadedImage = img; resolve(img); };
    img.src = URL.createObjectURL(file);
  });
}

export function getImage() { return loadedImage; }

export function removeImage() { loadedImage = null; }

export function drawImageLayer(ctx, W, H, state) {
  if (!loadedImage) return;
  ctx.save();
  ctx.globalAlpha = state.img_opacity;
  ctx.globalCompositeOperation = state.img_blend;
  const iw = loadedImage.width * state.img_scale;
  const ih = loadedImage.height * state.img_scale;
  const ix = (W - iw) / 2;
  const iy = (H - ih) / 2;
  ctx.drawImage(loadedImage, ix, iy, iw, ih);
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
}
