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

  // Use physical pixel dimensions for crisp post-processing on retina displays
  const pW = canvas.width;
  const pH = canvas.height;
  const dpr = window.devicePixelRatio || 1;

  // 1. Copy current canvas to offscreen (at full physical resolution)
  const artCanvas = document.createElement('canvas');
  artCanvas.width = pW;
  artCanvas.height = pH;
  const artCtx = artCanvas.getContext('2d');
  artCtx.drawImage(canvas, 0, 0);

  // 2. Apply tint to offscreen copy
  if (state.tint !== 'none') {
    const tc = getTintColor(state);
    if (tc) {
      const img = artCtx.getImageData(0, 0, pW, pH);
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

  // 3. Clear main canvas and draw back using identity transform
  //    (the offscreen canvas is at physical pixel resolution, so we must
  //     bypass the DPR scale on the main ctx while compositing)

  // Reset to identity for physical-pixel compositing
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  if (state.transparent) {
    ctx.clearRect(0, 0, pW, pH);
  } else {
    ctx.fillStyle = bgColor(state);
    ctx.fillRect(0, 0, pW, pH);
  }

  // 4. Glow: neon bloom effect — multiple additive passes at increasing blur radii
  if (state.glow > 0) {
    ctx.globalCompositeOperation = 'lighter';

    // Wide outer bloom (largest radius, lower alpha)
    const outerBlur = Math.round(state.glow * 3 * dpr);
    ctx.filter = `blur(${outerBlur}px)`;
    ctx.globalAlpha = 0.55;
    ctx.drawImage(artCanvas, 0, 0);

    // Mid bloom
    const midBlur = Math.round(state.glow * 1.8 * dpr);
    ctx.filter = `blur(${midBlur}px)`;
    ctx.globalAlpha = 0.65;
    ctx.drawImage(artCanvas, 0, 0);

    // Tight inner glow (tightest halo)
    const innerBlur = Math.round(state.glow * 0.8 * dpr);
    ctx.filter = `blur(${innerBlur}px)`;
    ctx.globalAlpha = 0.8;
    ctx.drawImage(artCanvas, 0, 0);

    // Extra hot-core pass for intense neon look
    ctx.filter = `blur(${Math.max(1, Math.round(state.glow * 0.3 * dpr))}px)`;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(artCanvas, 0, 0);

    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // 5. Draw sharp (or blurred) art on top
  if (state.blur > 0) {
    // Blur uses physical pixel radius for visible effect
    const blurRadius = Math.round(state.blur * dpr);
    ctx.filter = `blur(${blurRadius}px)`;
    ctx.drawImage(artCanvas, 0, 0);
    ctx.filter = 'none';
  } else {
    ctx.drawImage(artCanvas, 0, 0);
  }

  // Restore original DPR-scaled transform
  ctx.restore();
}
