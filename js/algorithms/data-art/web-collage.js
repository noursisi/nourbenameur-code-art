/**
 * Fragment — Slices the canvas into tiles and rearranges them.
 * Like cutting a photo with scissors and reassembling it wrong.
 * Operates on whatever is already on the canvas (uploaded image, algorithm output).
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

// ── Fisher-Yates shuffle with seeded RNG ──────────────────────────────────────

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Main class ────────────────────────────────────────────────────────────────

export class WebCollage extends Algorithm {

  get metadata() {
    return {
      name: 'Fragment',
      eq:   'slice × scatter',
      cat:  'Data Art',
      desc: 'Slices the canvas into tiles and rearranges them — like cutting a photo with scissors and reassembling it wrong.',
    };
  }

  get params() {
    return [
      { id: 'frag_cols',    label: 'Columns',  min: 2,   max: 20,  step: 1,    default: 6    },
      { id: 'frag_rows',    label: 'Rows',     min: 2,   max: 15,  step: 1,    default: 4    },
      { id: 'frag_shuffle', label: 'Shuffle',  min: 0,   max: 1,   step: 0.01, default: 0.5  },
      { id: 'frag_gap',     label: 'Gap',      min: 0,   max: 20,  step: 1,    default: 2    },
      { id: 'frag_zoom',    label: 'Zoom',     min: 0,   max: 1,   step: 0.01, default: 0.3  },
      { id: 'frag_rotate',  label: 'Rotate',   min: 0,   max: 1,   step: 0.01, default: 0.2  },
      { id: 'frag_seed',    label: 'Seed',     min: 0,   max: 100, step: 1,    default: 42   },
    ];
  }

  get detailParam() {
    return { id: 'frag_shuffle', min: 0, max: 1, step: 0.01 };
  }

  render(ctx, world) {
    const { W, H, state } = world;

    const cols    = Math.max(2, Math.round(state.frag_cols ?? 6));
    const rows    = Math.max(2, Math.round(state.frag_rows ?? 4));
    const shuffle_amt = state.frag_shuffle ?? 0.5;
    const gap     = state.frag_gap ?? 2;
    const zoom    = state.frag_zoom ?? 0.3;
    const rotate  = state.frag_rotate ?? 0.2;
    const seed    = state.frag_seed ?? 42;
    const t       = state.time ?? 0;

    // ── Capture the current canvas ────────────────────────────────────────────
    const dpr = window.devicePixelRatio || 1;
    const cap = document.createElement('canvas');
    cap.width  = Math.round(W * dpr);
    cap.height = Math.round(H * dpr);
    const capCtx = cap.getContext('2d');
    capCtx.drawImage(ctx.canvas, 0, 0);

    // Check if canvas is mostly empty — if so, draw a generated gradient
    try {
      const sample = capCtx.getImageData(Math.floor(cap.width / 2), Math.floor(cap.height / 2), 1, 1).data;
      if (sample[0] + sample[1] + sample[2] < 15) {
        // Canvas is black — generate a fallback pattern
        const g = capCtx.createLinearGradient(0, 0, cap.width, cap.height);
        g.addColorStop(0, '#1a1a2e'); g.addColorStop(0.5, '#0a0a14'); g.addColorStop(1, '#1e1a1a');
        capCtx.fillStyle = g;
        capCtx.fillRect(0, 0, cap.width, cap.height);
        // Add noise
        for (let i = 0; i < 3000; i++) {
          capCtx.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`;
          capCtx.fillRect(Math.random() * cap.width, Math.random() * cap.height, 1, 1);
        }
      }
    } catch(e) {}

    // ── Clear to black ────────────────────────────────────────────────────────
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    const tileW = W / cols;
    const tileH = H / rows;
    const total = cols * rows;

    // Build index array then decide which tiles get shuffled
    const rng = makeLCG(seed * 9999 + 1);
    const rngAnim = makeLCG(seed * 7373 + 3);

    // Pre-generate per-tile animation offsets (stable, seeded)
    const animOffsets = [];
    for (let i = 0; i < total; i++) {
      animOffsets.push({
        driftX:  (rngAnim() - 0.5) * 2,
        driftY:  (rngAnim() - 0.5) * 2,
        driftT:  rngAnim() * Math.PI * 2,
        rotDir:  rngAnim() < 0.5 ? 1 : -1,
        pulse:   rngAnim(),
      });
    }

    // Build source indices — some tiles get remapped, rest stay
    const indices = Array.from({ length: total }, (_, i) => i);
    const shuffledPool = [...indices];
    shuffleArr(shuffledPool, rng);

    // Blend between identity and fully shuffled based on shuffle_amt
    const srcFor = indices.map((orig, i) => {
      if (rng() < shuffle_amt) return shuffledPool[i];
      return orig;
    });

    // Per-tile flags (seeded)
    const rng2 = makeLCG(seed * 3141 + 2);
    const tileFlags = Array.from({ length: total }, () => ({
      zoomed:   rng2() < zoom,
      flipped:  rng2() < 0.15,
      bright:   (rng2() - 0.5) * 0.4,
      rotAmt:   (rng2() - 0.5) * rotate * Math.PI * 0.5,
      skipGap:  rng2() < 0.08,
    }));

    const dpr = window.devicePixelRatio || 1;

    for (let ti = 0; ti < total; ti++) {
      const col = ti % cols;
      const row = Math.floor(ti / cols);

      // Destination tile top-left
      const destX = col * tileW + gap * 0.5;
      const destY = row * tileH + gap * 0.5;
      const drawW = tileW - gap;
      const drawH = tileH - gap;

      if (drawW <= 0 || drawH <= 0) continue;

      // Source tile (potentially shuffled)
      const srcIdx  = srcFor[ti];
      const srcCol  = srcIdx % cols;
      const srcRow  = Math.floor(srcIdx / cols);

      let srcX = srcCol * tileW;
      let srcY = srcRow * tileH;
      let srcW = tileW;
      let srcH = tileH;

      const flags = tileFlags[ti];
      const anim  = animOffsets[ti];

      // Zoom: sample a smaller region from source tile (zoomed in)
      if (flags.zoomed) {
        const zf = 0.6 + rng2() * 0.3; // 60–90% of tile
        srcW = tileW * zf;
        srcH = tileH * zf;
        srcX += (tileW - srcW) * 0.5;
        srcY += (tileH - srcH) * 0.5;
      }

      // Animation: slight drift per tile
      const driftAmt = tileW * 0.04;
      const ox = anim.driftX * driftAmt * Math.sin(t * 0.4 + anim.driftT);
      const oy = anim.driftY * driftAmt * Math.cos(t * 0.3 + anim.driftT);

      // Rotation
      const rotAmt = flags.rotAmt + Math.sin(t * 0.2 + anim.driftT) * rotate * 0.05 * anim.rotDir;

      ctx.save();

      // Clip to destination tile area to avoid spillover
      ctx.beginPath();
      ctx.rect(destX, destY, drawW, drawH);
      ctx.clip();

      ctx.translate(destX + drawW * 0.5 + ox, destY + drawH * 0.5 + oy);
      ctx.rotate(rotAmt);

      if (flags.flipped) {
        ctx.scale(-1, 1);
      }

      // Brightness via globalAlpha trick (slight variation)
      const pulse = 1 + flags.bright * Math.sin(t * 0.5 + anim.pulse * Math.PI * 2) * 0.5;
      ctx.globalAlpha = Math.max(0.3, Math.min(1, pulse));

      // drawImage uses CSS coords because ctx has DPR transform applied
      ctx.drawImage(
        cap,
        srcX * dpr, srcY * dpr, srcW * dpr, srcH * dpr,  // src in physical px
        -drawW * 0.5, -drawH * 0.5, drawW, drawH          // dest in CSS px
      );

      ctx.restore();
    }
  }

  randomize(state, set) {
    set('frag_cols',    Math.round(2 + Math.random() * 18));
    set('frag_rows',    Math.round(2 + Math.random() * 13));
    set('frag_shuffle', parseFloat((Math.random()).toFixed(2)));
    set('frag_gap',     Math.round(Math.random() * 12));
    set('frag_zoom',    parseFloat((Math.random() * 0.7).toFixed(2)));
    set('frag_rotate',  parseFloat((Math.random() * 0.6).toFixed(2)));
    set('frag_seed',    Math.round(Math.random() * 100));
  }
}

// ── Internal shuffle (mutates array) ─────────────────────────────────────────

function shuffleArr(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
