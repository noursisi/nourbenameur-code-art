/**
 * Post-processing effects: glow, blur.
 * Glow uses an offscreen copy with additive blending.
 * Blur uses CSS canvas filter.
 */

/** Parse hex color to [r,g,b] */
function hexToRGB(hex) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return [255, 255, 255];
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function bgColor(state) {
  if (state.bgColor) return state.bgColor;
  return '#000000';
}

export function postProcess(canvas, ctx, W, H, state) {
  const hasGlow = state.glow > 0;
  const hasBlur = state.blur > 0;
  if (!hasGlow && !hasBlur) return;

  // Copy current canvas content to offscreen
  const art = document.createElement('canvas');
  art.width = canvas.width;
  art.height = canvas.height;
  const artCtx = art.getContext('2d');
  artCtx.drawImage(canvas, 0, 0);

  // If glow has a custom color, tint the glow source
  let glowSrc = art;
  if (hasGlow && state.glowColor && state.glowColor !== 'same') {
    const gc = hexToRGB(state.glowColor);
    const tinted = document.createElement('canvas');
    tinted.width = canvas.width;
    tinted.height = canvas.height;
    const tCtx = tinted.getContext('2d');
    tCtx.drawImage(art, 0, 0);
    const img = tCtx.getImageData(0, 0, tinted.width, tinted.height);
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i + 3] === 0) continue;
      const lum = (img.data[i] * 0.3 + img.data[i+1] * 0.59 + img.data[i+2] * 0.11) / 255;
      img.data[i]   = Math.min(255, Math.floor(lum * gc[0]));
      img.data[i+1] = Math.min(255, Math.floor(lum * gc[1]));
      img.data[i+2] = Math.min(255, Math.floor(lum * gc[2]));
    }
    tCtx.putImageData(img, 0, 0);
    glowSrc = tinted;
  }

  // Work in physical pixel space
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Clear and redraw background
  if (state.transparent) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = bgColor(state);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Glow: multiple additive blur passes
  if (hasGlow) {
    const g = state.glow;
    ctx.globalCompositeOperation = 'lighter';

    ctx.filter = `blur(${g * 3}px)`;
    ctx.globalAlpha = 0.5;
    ctx.drawImage(glowSrc, 0, 0);

    ctx.filter = `blur(${g * 1.5}px)`;
    ctx.globalAlpha = 0.6;
    ctx.drawImage(glowSrc, 0, 0);

    ctx.filter = `blur(${g * 0.5}px)`;
    ctx.globalAlpha = 0.8;
    ctx.drawImage(glowSrc, 0, 0);

    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // Draw sharp art on top (or blurred)
  if (hasBlur) {
    ctx.filter = `blur(${state.blur}px)`;
    ctx.drawImage(art, 0, 0);
    ctx.filter = 'none';
  } else {
    ctx.drawImage(art, 0, 0);
  }

  ctx.restore();
}
