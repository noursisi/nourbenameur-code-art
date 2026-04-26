/**
 * Shred — Tears the image into horizontal or vertical strips and offsets them.
 * Like a paper shredder or a broken TV signal.
 * Raw, aggressive, destructive pixel manipulation.
 * Operates on whatever is already on the canvas.
 */

import { Algorithm } from '../base.js';

// ── Seeded LCG RNG ────────────────────────────────────────────────────────────

function makeLCG(seed) {
  let s = (seed | 0) >>> 0;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223 | 0;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

// ── Main class ────────────────────────────────────────────────────────────────

export class DesktopGlitch extends Algorithm {

  get metadata() {
    return {
      name: 'Shred',
      eq:   'tear × offset',
      cat:  'Data Art',
      desc: 'Tears the image into strips and offsets them — like a paper shredder or broken TV signal.',
    };
  }

  get params() {
    return [
      { id: 'shred_count',   label: 'Strips',        min: 5,  max: 60,  step: 1,    default: 20  },
      { id: 'shred_offset',  label: 'Offset',        min: 0,  max: 1,   step: 0.01, default: 0.5 },
      { id: 'shred_vertical',label: 'Vertical',      min: 0,  max: 1,   step: 1,    default: 0   },
      { id: 'shred_vary',    label: 'Vary',          min: 0,  max: 1,   step: 0.01, default: 0.5 },
      { id: 'shred_channel', label: 'Channel Split', min: 0,  max: 1,   step: 0.01, default: 0.3 },
      { id: 'shred_seed',    label: 'Seed',          min: 0,  max: 100, step: 1,    default: 42  },
    ];
  }

  get detailParam() {
    return { id: 'shred_offset', min: 0, max: 1, step: 0.01 };
  }

  render(ctx, world) {
    const { W, H, state } = world;

    const count    = Math.max(2, Math.round(state.shred_count   ?? 20));
    const offsetAmt = state.shred_offset  ?? 0.5;
    const vertical = (state.shred_vertical ?? 0) >= 0.5;
    const vary     = state.shred_vary     ?? 0.5;
    const channel  = state.shred_channel  ?? 0.3;
    const seed     = state.shred_seed     ?? 42;
    const t        = state.time ?? 0;

    const dpr = window.devicePixelRatio || 1;
    const dim  = vertical ? W : H;
    const cross = vertical ? H : W;

    // ── Capture the current canvas ────────────────────────────────────────────
    const cap = document.createElement('canvas');
    cap.width  = Math.round(W * dpr);
    cap.height = Math.round(H * dpr);
    const capCtx = cap.getContext('2d');
    capCtx.drawImage(ctx.canvas, 0, 0);

    // Fallback if canvas is empty
    try {
      const sample = capCtx.getImageData(Math.floor(cap.width/2), Math.floor(cap.height/2), 1, 1).data;
      if (sample[0]+sample[1]+sample[2] < 15) {
        const g = capCtx.createLinearGradient(0, 0, cap.width, cap.height);
        g.addColorStop(0, '#1a1a2e'); g.addColorStop(0.5, '#0f0a1a'); g.addColorStop(1, '#1a1e1a');
        capCtx.fillStyle = g; capCtx.fillRect(0, 0, cap.width, cap.height);
        for (let i = 0; i < 2000; i++) {
          capCtx.fillStyle = `rgba(255,255,255,${Math.random()*0.1})`;
          capCtx.fillRect(Math.random()*cap.width, Math.random()*cap.height, 1+Math.random()*3, 1);
        }
      }
    } catch(e) {}

    // ── Clear to black ────────────────────────────────────────────────────────
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    // ── Build strip boundaries (variable widths) ──────────────────────────────
    const rng = makeLCG(seed * 7777 + 1);
    const rngAnim = makeLCG(seed * 3131 + 7);

    // Raw weights for strip sizes
    const weights = Array.from({ length: count }, () => {
      const uniform = 1;
      const wild    = 0.2 + rng() * 2.8;
      return uniform + (wild - uniform) * vary;
    });
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    // Strip boundaries in CSS units
    const boundaries = [0];
    let cursor = 0;
    for (const w of weights) {
      cursor += (w / totalWeight) * dim;
      boundaries.push(cursor);
    }

    // Per-strip offsets and animation seeds
    const stripData = Array.from({ length: count }, (_, i) => {
      const raw        = (rng() - 0.5) * 2;        // -1..1
      const maxOffset  = cross * offsetAmt * 0.5;
      const baseOffset = raw * maxOffset;
      const animSpeed  = 0.3 + rng() * 0.7;
      const animPhase  = rng() * Math.PI * 2;
      const animAmt    = rng() * offsetAmt * cross * 0.1;
      const doChannel  = rng() < channel;
      const chanOffset = (rng() - 0.5) * cross * channel * 0.15;
      const flip       = rng() < 0.05;
      const stretch    = rng() < 0.08 ? 0.6 + rng() * 0.8 : 1;
      return { baseOffset, animSpeed, animPhase, animAmt, doChannel, chanOffset, flip, stretch };
    });

    // ── Draw each strip ───────────────────────────────────────────────────────
    for (let i = 0; i < count; i++) {
      const sd    = stripData[i];
      const start = boundaries[i];
      const end   = boundaries[i + 1];
      const size  = end - start;
      if (size <= 0) continue;

      // Animated offset
      const animOff = Math.sin(t * sd.animSpeed + sd.animPhase) * sd.animAmt;
      const off     = sd.baseOffset + animOff;

      if (vertical) {
        // Vertical strips — offset in Y direction
        const srcX  = start;
        const srcW  = size;
        const destX = start;

        if (sd.doChannel && channel > 0.01) {
          // Channel split: draw strip 3 times with offsets, composite as RGB
          _drawChannelStrip(ctx, cap, dpr,
            srcX, 0, srcW, H,
            destX, off, srcW, H,
            sd.chanOffset, 0,
            vertical
          );
        } else {
          ctx.save();
          if (sd.flip) {
            ctx.translate(destX + srcW, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(cap,
              srcX * dpr, 0, srcW * dpr, H * dpr,
              0, off, srcW, H
            );
          } else {
            ctx.drawImage(cap,
              srcX * dpr, 0, srcW * dpr, H * dpr,
              destX, off, srcW, H
            );
          }
          ctx.restore();
        }
      } else {
        // Horizontal strips — offset in X direction
        const srcY  = start;
        const srcH  = size;
        const destY = start;

        if (sd.doChannel && channel > 0.01) {
          _drawChannelStrip(ctx, cap, dpr,
            0, srcY, W, srcH,
            off, destY, W, srcH,
            sd.chanOffset, 0,
            vertical
          );
        } else {
          ctx.save();
          if (sd.flip) {
            ctx.translate(0, destY + srcH);
            ctx.scale(1, -1);
            ctx.drawImage(cap,
              0, srcY * dpr, W * dpr, srcH * dpr,
              off, 0, W * sd.stretch, srcH
            );
          } else {
            ctx.drawImage(cap,
              0, srcY * dpr, W * dpr, srcH * dpr,
              off, destY, W * sd.stretch, srcH
            );
          }
          ctx.restore();
        }
      }
    }
  }

  randomize(state, set) {
    set('shred_count',    Math.round(5 + Math.random() * 55));
    set('shred_offset',   parseFloat((Math.random()).toFixed(2)));
    set('shred_vertical', Math.random() < 0.5 ? 0 : 1);
    set('shred_vary',     parseFloat((Math.random()).toFixed(2)));
    set('shred_channel',  parseFloat((Math.random() * 0.8).toFixed(2)));
    set('shred_seed',     Math.round(Math.random() * 100));
  }
}

// ── Channel split helper ──────────────────────────────────────────────────────
// Draws a strip 3 times — once each for R, G, B — offset differently
// to simulate RGB separation. Uses lighter blending.

function _drawChannelStrip(ctx, cap, dpr,
  srcX, srcY, srcW, srcH,
  destX, destY, destW, destH,
  chanOffset, chanOffsetY,
  vertical
) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';

  // We draw 3 passes with different offsets and multiplicative colors.
  // Each uses a temp canvas to isolate one channel.

  const passes = [
    { r: 1, g: 0, b: 0, ox: chanOffset,  oy: chanOffsetY  },
    { r: 0, g: 1, b: 0, ox: 0,           oy: 0            },
    { r: 0, g: 0, b: 1, ox: -chanOffset, oy: -chanOffsetY },
  ];

  for (const pass of passes) {
    // Extract single channel into temp canvas
    const tmp = document.createElement('canvas');
    tmp.width  = Math.ceil(srcW * dpr);
    tmp.height = Math.ceil(srcH * dpr);
    const tCtx = tmp.getContext('2d');
    tCtx.drawImage(cap,
      srcX * dpr, srcY * dpr, srcW * dpr, srcH * dpr,
      0, 0, tmp.width, tmp.height
    );

    // Color matrix to isolate channel
    const imgData = tCtx.getImageData(0, 0, tmp.width, tmp.height);
    const d = imgData.data;
    for (let p = 0; p < d.length; p += 4) {
      d[p]     = pass.r ? d[p]     : 0;
      d[p + 1] = pass.g ? d[p + 1] : 0;
      d[p + 2] = pass.b ? d[p + 2] : 0;
    }
    tCtx.putImageData(imgData, 0, 0);

    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1;
    ctx.drawImage(tmp,
      0, 0, tmp.width, tmp.height,
      destX + pass.ox, destY + pass.oy, destW, destH
    );
  }

  ctx.restore();
}
