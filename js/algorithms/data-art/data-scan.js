/**
 * Echo — Creates multiple copies of the canvas at different scales,
 * positions, opacities, and rotations — layered on top of each other.
 * Like seeing afterimages, echoes, ghosts. The image haunts itself.
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

export class DataScan extends Algorithm {

  get metadata() {
    return {
      name: 'Echo',
      eq:   'repeat × fade',
      cat:  'Data Art',
      desc: 'Layers multiple copies of the canvas at different scales, offsets, and opacities — the image haunts itself.',
    };
  }

  get params() {
    return [
      { id: 'echo_count',   label: 'Echoes',  min: 1,    max: 12,  step: 1,    default: 5    },
      { id: 'echo_scale',   label: 'Scale',   min: 0.5,  max: 1.5, step: 0.01, default: 0.85 },
      { id: 'echo_spread',  label: 'Spread',  min: 0,    max: 200, step: 1,    default: 30   },
      { id: 'echo_rotate',  label: 'Rotate',  min: 0,    max: 0.5, step: 0.01, default: 0.1  },
      { id: 'echo_fade',    label: 'Fade',    min: 0,    max: 1,   step: 0.01, default: 0.3  },
      { id: 'echo_tint',    label: 'Tint',    min: 0,    max: 1,   step: 0.01, default: 0    },
      { id: 'echo_seed',    label: 'Seed',    min: 0,    max: 100, step: 1,    default: 42   },
    ];
  }

  get detailParam() {
    return { id: 'echo_count', min: 1, max: 12, step: 1 };
  }

  render(ctx, world) {
    const { W, H, state } = world;

    const echoCount = Math.max(1, Math.round(state.echo_count  ?? 5));
    const scale     = state.echo_scale  ?? 0.85;
    const spread    = state.echo_spread ?? 30;
    const rotate    = state.echo_rotate ?? 0.1;
    const fade      = state.echo_fade   ?? 0.3;
    const tint      = state.echo_tint   ?? 0;
    const seed      = state.echo_seed   ?? 42;
    const t         = state.time ?? 0;

    // ── Capture the current canvas ────────────────────────────────────────────
    const cap = document.createElement('canvas');
    cap.width  = ctx.canvas.width;
    cap.height = ctx.canvas.height;
    cap.getContext('2d').drawImage(ctx.canvas, 0, 0);

    // ── Build per-echo parameters (seeded, stable) ────────────────────────────
    const rng = makeLCG(seed * 5555 + 1);

    const echoes = Array.from({ length: echoCount }, (_, i) => {
      const sign  = rng() < 0.5 ? 1 : -1;
      const signY = rng() < 0.5 ? 1 : -1;
      const ox    = rng() * spread * sign;
      const oy    = rng() * spread * signY;
      const rot   = (i + 1) * rotate * (rng() < 0.5 ? 1 : -1);
      const animPhaseX = rng() * Math.PI * 2;
      const animPhaseY = rng() * Math.PI * 2;
      const animPhaseR = rng() * Math.PI * 2;
      const animSpd    = 0.2 + rng() * 0.4;

      // Tint hue per echo
      const hue = Math.round(rng() * 360);

      return { ox, oy, rot, animPhaseX, animPhaseY, animPhaseR, animSpd, hue };
    });

    // ── Clear to black ────────────────────────────────────────────────────────
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    // ── Draw base image ───────────────────────────────────────────────────────
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.drawImage(cap, 0, 0, W, H);
    ctx.restore();

    // ── Draw echoes from back to front ────────────────────────────────────────
    for (let i = echoCount - 1; i >= 0; i--) {
      const e = echoes[i];

      // Scale compounds per echo
      const s = Math.pow(scale, i + 1);

      // Opacity decreases per echo
      const alpha = Math.pow(1 - fade, i + 1);
      if (alpha < 0.01) continue;

      // Animated drift
      const animAmt = spread * 0.15;
      const driftX  = Math.sin(t * e.animSpd + e.animPhaseX) * animAmt;
      const driftY  = Math.cos(t * e.animSpd * 0.7 + e.animPhaseY) * animAmt;
      const driftR  = Math.sin(t * e.animSpd * 0.5 + e.animPhaseR) * rotate * 0.1;

      ctx.save();
      ctx.globalAlpha = alpha;

      if (tint > 0.01) {
        // Tint by drawing a color overlay on the echo
        ctx.globalCompositeOperation = 'source-over';
      }

      ctx.translate(W * 0.5 + e.ox + driftX, H * 0.5 + e.oy + driftY);
      ctx.rotate(e.rot + driftR);
      ctx.scale(s, s);
      ctx.drawImage(cap, -W * 0.5, -H * 0.5, W, H);
      ctx.restore();

      // Optional tint overlay per echo
      if (tint > 0.01) {
        ctx.save();
        ctx.globalAlpha = alpha * tint * 0.5;
        ctx.globalCompositeOperation = 'color';
        ctx.fillStyle = `hsl(${e.hue}, 80%, 50%)`;
        ctx.translate(W * 0.5 + e.ox + driftX, H * 0.5 + e.oy + driftY);
        ctx.rotate(e.rot + driftR);
        ctx.scale(s, s);
        ctx.fillRect(-W * 0.5, -H * 0.5, W, H);
        ctx.restore();
      }
    }
  }

  randomize(state, set) {
    set('echo_count',  Math.round(1 + Math.random() * 11));
    set('echo_scale',  parseFloat((0.5 + Math.random()).toFixed(2)));
    set('echo_spread', Math.round(Math.random() * 180));
    set('echo_rotate', parseFloat((Math.random() * 0.5).toFixed(2)));
    set('echo_fade',   parseFloat((Math.random()).toFixed(2)));
    set('echo_tint',   parseFloat((Math.random()).toFixed(2)));
    set('echo_seed',   Math.round(Math.random() * 100));
  }
}
