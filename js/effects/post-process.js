/**
 * Post-processing effects: tint, glow, blur.
 * All effects operate on an offscreen copy of the art, then composite
 * back onto a clean background — so glow/blur only affect the shape,
 * not the background.
 */

const TINTS = {
  none:    null,
  cyan:    [0,   170, 255],
  blue:    [68,   68, 255],
  magenta: [255,  68, 255],
  red:     [255,  68,  68],
  amber:   [255, 170,   0],
  green:   [68,  255,  68],
};

function getTintColor(state) {
  if (state.tint === 'custom') return state.customTintRGB;
  return TINTS[state.tint] || null;
}

function bgColor(state) {
  if (state.colorMode === 'wb') return '#000';
  if (state.colorMode === 'bw') return '#f0efe8';
  return '#0a0a0a';
}

export function postProcess(canvas, ctx, W, H, state) {
  if (state.tint === 'none' && state.glow === 0 && state.blur === 0) return;

  // 1. Copy current canvas to offscreen
  const artCanvas = document.createElement('canvas');
  artCanvas.width = W;
  artCanvas.height = H;
  const artCtx = artCanvas.getContext('2d');
  artCtx.drawImage(canvas, 0, 0);

  // 2. Apply tint to offscreen copy
  if (state.tint !== 'none') {
    const tc = getTintColor(state);
    if (tc) {
      const img = artCtx.getImageData(0, 0, W, H);
      for (let i = 0; i < img.data.length; i += 4) {
        if (img.data[i + 3] === 0) continue;
        const lum = (img.data[i] * 0.299 + img.data[i + 1] * 0.587 + img.data[i + 2] * 0.114) / 255;
        img.data[i]     = Math.min(255, Math.floor(lum * tc[0]));
        img.data[i + 1] = Math.min(255, Math.floor(lum * tc[1]));
        img.data[i + 2] = Math.min(255, Math.floor(lum * tc[2]));
      }
      artCtx.putImageData(img, 0, 0);
    }
  }

  // 3. Clear main canvas
  if (state.transparent) {
    ctx.clearRect(0, 0, W, H);
  } else {
    ctx.fillStyle = bgColor(state);
    ctx.fillRect(0, 0, W, H);
  }

  // 4. Glow: draw blurred copy with additive blending FIRST (bloom behind)
  if (state.glow > 0) {
    ctx.save();
    ctx.filter = `blur(${state.glow}px)`;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.7;
    ctx.drawImage(artCanvas, 0, 0);
    ctx.globalAlpha = 0.4;
    ctx.drawImage(artCanvas, 0, 0);
    ctx.restore();
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
  }

  // 5. Draw sharp (or blurred) art on top
  if (state.blur > 0) {
    ctx.save();
    ctx.filter = `blur(${state.blur}px)`;
    ctx.drawImage(artCanvas, 0, 0);
    ctx.restore();
    ctx.filter = 'none';
  } else {
    ctx.drawImage(artCanvas, 0, 0);
  }
}
