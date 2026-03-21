/**
 * Strange Attractor Zoo — a gallery of the weirdest attractors in chaos theory.
 * Lorenz, Rossler, Aizawa, Thomas, Halvorsen, Dadras, Chen.
 * 3D→2D projection with rotation, density-based rendering.
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
      { id: 'az_type',   label: 'Attractor',  min: 0,     max: 6,      step: 1      },
      { id: 'az_points', label: 'Points',      min: 50000, max: 500000, step: 10000  },
      { id: 'az_a',      label: 'Param A',     min: -2,    max: 2,      step: 0.05   },
      { id: 'az_b',      label: 'Param B',     min: -2,    max: 2,      step: 0.05   },
      { id: 'az_c',      label: 'Param C',     min: -2,    max: 2,      step: 0.05   },
      { id: 'az_d',      label: 'Param D',     min: -2,    max: 2,      step: 0.05   },
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

  animate(s) {
    // Time advances externally; used for rotation angle
  }

  render(ctx, W, H, s) {
    const type = Math.max(0, Math.min(6, Math.round(s.az_type || 0)));
    const numPts = Math.max(50000, Math.min(500000, Math.round(s.az_points || 100000)));
    const a = s.az_a || 0;
    const b = s.az_b || 0;
    const c = s.az_c || 0;
    const d = s.az_d || 0;
    const fg = this.engine.fg();
    const t = (s.time || 0) * 0.3;

    const stepFn = stepFns[type];
    const dt = dtScale[type];
    const init = initScale[type]();
    const vs = viewScale[type];

    // Compute attractor points
    let px = init[0], py = init[1], pz = init[2];
    // Skip transient
    for (let i = 0; i < 500; i++) {
      [px, py, pz] = stepFn(px, py, pz, dt, a, b, c, d);
    }

    // Density accumulation buffer
    const gridW = Math.min(W, 800);
    const gridH = Math.min(H, 800);
    const density = new Float32Array(gridW * gridH);
    let maxDensity = 0;

    const cosT = Math.cos(t);
    const sinT = Math.sin(t);
    const cx = gridW / 2;
    const cy = gridH / 2;
    const scale = Math.min(gridW, gridH) * vs;

    for (let i = 0; i < numPts; i++) {
      [px, py, pz] = stepFn(px, py, pz, dt, a, b, c, d);
      if (!isFinite(px) || !isFinite(py) || !isFinite(pz)) {
        px = init[0]; py = init[1]; pz = init[2];
        continue;
      }
      // 3D rotation around Y axis
      const rx = px * cosT - pz * sinT;
      const ry = py;
      // Project
      const sx = Math.floor(cx + rx * scale);
      const sy = Math.floor(cy - ry * scale);
      if (sx >= 0 && sx < gridW && sy >= 0 && sy < gridH) {
        const idx = sy * gridW + sx;
        density[idx]++;
        if (density[idx] > maxDensity) maxDensity = density[idx];
      }
    }

    if (maxDensity === 0) return;

    // Parse fg color
    const r0 = parseInt(fg.slice(1, 3), 16) || 255;
    const g0 = parseInt(fg.slice(3, 5), 16) || 255;
    const b0 = parseInt(fg.slice(5, 7), 16) || 255;

    const imgData = ctx.createImageData(gridW, gridH);
    const data = imgData.data;
    const logMax = Math.log(maxDensity + 1);

    for (let i = 0; i < gridW * gridH; i++) {
      if (density[i] > 0) {
        const brightness = Math.log(density[i] + 1) / logMax;
        const alpha = Math.min(255, Math.floor(brightness * 255 * 1.5));
        data[i * 4] = r0;
        data[i * 4 + 1] = g0;
        data[i * 4 + 2] = b0;
        data[i * 4 + 3] = alpha;
      }
    }

    // Scale to full canvas
    const offscreen = new OffscreenCanvas(gridW, gridH);
    const octx = offscreen.getContext('2d');
    octx.putImageData(imgData, 0, 0);
    ctx.drawImage(offscreen, (W - gridW) / 2, (H - gridH) / 2);
  }
}
