/**
 * Strange Attractor Zoo — a gallery of the weirdest attractors in chaos theory.
 * Lorenz, Rossler, Aizawa, Thomas, Halvorsen, Dadras, Chen.
 * 3D→2D projection with dual-axis rotation, density-based rendering,
 * velocity-based coloring, and adaptive resolution.
 */

import { Algorithm } from '../base.js';

const ATTRACTOR_NAMES = ['Lorenz', 'Rossler', 'Aizawa', 'Thomas', 'Halvorsen', 'Dadras', 'Chen'];

function stepLorenz(x, y, z, dt, a, b, c) {
  const sigma = 10 + a * 5;
  const rho = 28 + b * 10;
  const beta = 8 / 3 + c * 0.5;
  return [
    x + (sigma * (y - x)) * dt,
    y + (x * (rho - z) - y) * dt,
    z + (x * y - beta * z) * dt,
  ];
}

function stepRossler(x, y, z, dt, a, b, c) {
  const ra = 0.2 + a * 0.15;
  const rb = 0.2 + b * 0.15;
  const rc = 5.7 + c * 2;
  return [
    x + (-y - z) * dt,
    y + (x + ra * y) * dt,
    z + (rb + z * (x - rc)) * dt,
  ];
}

function stepAizawa(x, y, z, dt, a, b, c) {
  const alpha = 0.95 + a * 0.05;
  const beta = 0.7 + b * 0.1;
  const gamma = 0.6 + c * 0.1;
  const delta = 3.5;
  const eps = 0.25;
  const zeta = 0.1;
  return [
    x + ((z - beta) * x - delta * y) * dt,
    y + (delta * x + (z - beta) * y) * dt,
    z + (gamma + alpha * z - (z * z * z) / 3 - (x * x + y * y) * (1 + eps * z) + zeta * z * x * x * x) * dt,
  ];
}

function stepThomas(x, y, z, dt, a) {
  const b = 0.208186 + a * 0.05;
  return [
    x + (-b * x + Math.sin(y)) * dt,
    y + (-b * y + Math.sin(z)) * dt,
    z + (-b * z + Math.sin(x)) * dt,
  ];
}

function stepHalvorsen(x, y, z, dt, a) {
  const alpha = 1.89 + a * 0.3;
  return [
    x + (-alpha * x - 4 * y - 4 * z - y * y) * dt,
    y + (-alpha * y - 4 * z - 4 * x - z * z) * dt,
    z + (-alpha * z - 4 * x - 4 * y - x * x) * dt,
  ];
}

function stepDadras(x, y, z, dt, a, b, c, d) {
  const p = 3 + a;
  const q = 2.7 + b;
  const r = 1.7 + c;
  const s = 2 + d;
  const e = 9;
  return [
    x + (y - p * x + q * y * z) * dt,
    y + (r * y - x * z + z) * dt,
    z + (s * x * y - e * z) * dt,
  ];
}

function stepChen(x, y, z, dt, a, b, c) {
  const alpha = 35 + a * 5;
  const beta = 3 + b;
  const gamma = 28 + c * 5;
  return [
    x + (alpha * (y - x)) * dt,
    y + ((gamma - alpha) * x - x * z + gamma * y) * dt,
    z + (x * y - beta * z) * dt,
  ];
}

const stepFns = [stepLorenz, stepRossler, stepAizawa, stepThomas, stepHalvorsen, stepDadras, stepChen];
const dtScale = [0.003, 0.01, 0.008, 0.05, 0.003, 0.003, 0.001];
const initScale = [
  () => [0.1, 0.1, 0.1],
  () => [1, 1, 0],
  () => [0.1, 0, 0],
  () => [1, 0, 0],
  () => [-5, 0, 0],
  () => [1, 1, 0],
  () => [-0.1, 0.5, -0.6],
];
const viewScale = [0.02, 0.03, 0.25, 0.2, 0.03, 0.03, 0.015];

// Convert HSL (h in [0,360], s and l in [0,1]) to RGB [0,255]
function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60)      { r = c; g = x; b = 0; }
  else if (h < 120){ r = x; g = c; b = 0; }
  else if (h < 180){ r = 0; g = c; b = x; }
  else if (h < 240){ r = 0; g = x; b = c; }
  else if (h < 300){ r = x; g = 0; b = c; }
  else             { r = c; g = 0; b = x; }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

export class AttractorZoo extends Algorithm {
  get metadata() {
    return {
      name: 'Attractor Zoo',
      eq: 'dx/dt = f(x,y,z)',
      cat: 'Nature',
      desc: 'A gallery of strange attractors from chaos theory — Lorenz, Rossler, Aizawa, Thomas, Halvorsen, Dadras, Chen. Density-based rendering of chaotic orbits projected from 3D.',
    };
  }

  get params() {
    return [
      { id: 'az_type',       label: 'Attractor',   min: 0,     max: 6,      step: 1      },
      { id: 'az_points',     label: 'Points',       min: 50000, max: 500000, step: 10000  },
      { id: 'az_a',          label: 'Param A',      min: -2,    max: 2,      step: 0.05   },
      { id: 'az_b',          label: 'Param B',      min: -2,    max: 2,      step: 0.05   },
      { id: 'az_c',          label: 'Param C',      min: -2,    max: 2,      step: 0.05   },
      { id: 'az_d',          label: 'Param D',      min: -2,    max: 2,      step: 0.05   },
      { id: 'az_rotX',       label: 'X Rotation',   min: -3.14, max: 3.14,   step: 0.05   },
      { id: 'az_colorMode',  label: 'Color',        min: 0,     max: 1,      step: 1      },
      { id: 'az_resolution', label: 'Resolution',   min: 0.5,   max: 2,      step: 0.25   },
    ];
  }

  get detailParam() {
    return { id: 'az_points', min: 50000, max: 500000, step: 50000 };
  }

  get cursorMap() {
    return (mx, my, s) => {
      s.az_a = -2 + mx * 4;
      s.az_type = Math.floor(my * 6.99);
    };
  }

  animate(world) { const { state: s } = world;
    // Time advances externally; used for rotation angle
  }

  render(ctx, world) { const { W, H, state: s } = world;
    const type = Math.max(0, Math.min(6, Math.round(s.az_type || 0)));
    const numPts = Math.max(50000, Math.min(500000, Math.round(s.az_points || 100000)));
    const a = s.az_a || 0;
    const b = s.az_b || 0;
    const c = s.az_c || 0;
    const d = s.az_d || 0;
    const rotX = s.az_rotX || 0;
    const colorMode = Math.round(s.az_colorMode || 0);
    const resScale = s.az_resolution != null ? s.az_resolution : 1;
    const fg = this.engine.fg(s);
    const t = (s.time || 0) * 0.3;

    const stepFn = stepFns[type];
    const dt = dtScale[type];
    const init = initScale[type]();
    const vs = viewScale[type];

    // Adaptive density buffer resolution (no more 800 cap)
    const bufW = Math.min(Math.round(W * resScale), 1600);
    const bufH = Math.min(Math.round(H * resScale), 1200);

    // Compute attractor points
    let px = init[0], py = init[1], pz = init[2];
    // Skip transient
    for (let i = 0; i < 500; i++) {
      [px, py, pz] = stepFn(px, py, pz, dt, a, b, c, d);
    }

    // Density accumulation buffer + velocity buffer (parallel Float32Arrays)
    const density = new Float32Array(bufW * bufH);
    const velBuf  = new Float32Array(bufW * bufH);
    let maxDensity = 0;

    // Precompute rotation trig
    const rotY = t;
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    const cosX = Math.cos(rotX), sinX = Math.sin(rotX);

    const cx = bufW / 2;
    const cy = bufH / 2;
    const projScale = Math.min(bufW, bufH) * vs;

    for (let i = 0; i < numPts; i++) {
      const ox = px, oy = py, oz = pz;
      [px, py, pz] = stepFn(px, py, pz, dt, a, b, c, d);
      if (!isFinite(px) || !isFinite(py) || !isFinite(pz)) {
        px = init[0]; py = init[1]; pz = init[2];
        continue;
      }

      // Velocity magnitude
      const dx = px - ox, dy = py - oy, dz = pz - oz;
      const vel = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Y rotation (time-driven)
      const rx  = px * cosY - pz * sinY;
      const rz1 = px * sinY + pz * cosY;
      // X rotation (parameter-driven)
      const ry  = py * cosX - rz1 * sinX;
      // rz = py * sinX + rz1 * cosX; // depth, unused for orthographic

      // Project orthographically
      const sx = Math.floor(cx + rx * projScale);
      const sy = Math.floor(cy - ry * projScale);
      if (sx >= 0 && sx < bufW && sy >= 0 && sy < bufH) {
        const idx = sy * bufW + sx;
        density[idx]++;
        velBuf[idx] += vel;
        if (density[idx] > maxDensity) maxDensity = density[idx];
      }
    }

    if (maxDensity === 0) return;

    // Compute max average velocity across occupied pixels (for normalization)
    let maxAvgVel = 0;
    for (let i = 0; i < bufW * bufH; i++) {
      if (density[i] > 0) {
        const avg = velBuf[i] / density[i];
        if (avg > maxAvgVel) maxAvgVel = avg;
      }
    }

    // Parse fg color for mono mode
    const r0 = parseInt(fg.slice(1, 3), 16) || 255;
    const g0 = parseInt(fg.slice(3, 5), 16) || 255;
    const b0 = parseInt(fg.slice(5, 7), 16) || 255;

    const imgData = ctx.createImageData(bufW, bufH);
    const data = imgData.data;
    const logMax = Math.log(maxDensity + 1);

    for (let i = 0; i < bufW * bufH; i++) {
      if (density[i] > 0) {
        const brightness = Math.log(density[i] + 1) / logMax;
        const alpha = Math.min(255, Math.floor(brightness * 255 * 1.5));

        if (colorMode === 1) {
          // Velocity-based coloring: slow = blue (240), fast = red (0)
          const avgVel = velBuf[i] / density[i];
          const velNorm = maxAvgVel > 0 ? Math.min(avgVel / maxAvgVel, 1) : 0;
          // Map 0..1 → hue 240..0 (blue to red), lightness tied to brightness
          const hue = 240 - velNorm * 240;
          const lightness = 0.2 + brightness * 0.5;
          const [r, g, b] = hslToRgb(hue, 1.0, lightness);
          data[i * 4]     = r;
          data[i * 4 + 1] = g;
          data[i * 4 + 2] = b;
          data[i * 4 + 3] = alpha;
        } else {
          // Mono brightness mode
          data[i * 4]     = r0;
          data[i * 4 + 1] = g0;
          data[i * 4 + 2] = b0;
          data[i * 4 + 3] = alpha;
        }
      }
    }

    // Scale to full canvas
    const offscreen = new OffscreenCanvas(bufW, bufH);
    const octx = offscreen.getContext('2d');
    octx.putImageData(imgData, 0, 0);
    ctx.drawImage(offscreen, 0, 0, W, H);
  }
}
