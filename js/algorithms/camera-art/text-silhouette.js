/**
 * Text Silhouette — camera brightness drives scattered text placement.
 * Without camera: uses Perlin noise to generate a demo pattern.
 */

import { Algorithm } from '../base.js';

const DEFAULT_TEXTS = [
  'code', 'art', 'math', 'logic', 'form', 'void', 'data', 'pixel',
  'node', 'flow', 'wave', 'grid', 'mesh', 'loop', 'seed', 'root',
  'signal', 'noise', 'pattern', 'structure', 'chaos', 'order',
  'light', 'shadow', 'depth', 'surface', 'edge', 'field',
];

export class TextSilhouette extends Algorithm {
  get metadata() {
    return {
      name: 'Text Silhouette',
      eq: 'brightness → text',
      cat: 'Camera Art',
      desc: 'Camera brightness drives scattered text placement',
    };
  }

  get params() {
    return [
      { id: 'ts_cols', label: 'Columns', min: 10, max: 80, step: 1 },
      { id: 'ts_rows', label: 'Rows', min: 8, max: 60, step: 1 },
      { id: 'ts_threshold', label: 'Threshold', min: 0, max: 1, step: 0.05 },
      { id: 'ts_fontSize', label: 'Font Size', min: 4, max: 30, step: 1 },
      { id: 'ts_scatter', label: 'Scatter', min: 0, max: 1, step: 0.05 },
      { id: 'ts_dotMode', label: 'Dot Mode', min: 0, max: 1, step: 1 },
    ];
  }

  render(ctx, world) {
    const { W, H, state } = world;
    const cols = state.ts_cols || 40;
    const rows = state.ts_rows || 30;
    const threshold = state.ts_threshold ?? 0.3;
    const fontSize = state.ts_fontSize || 12;
    const scatter = state.ts_scatter || 0.2;
    const dotMode = state.ts_dotMode || 0;
    const cam = world.camera;
    const renderer = world.renderer;
    const hasCamera = cam && cam.active;

    const cellW = W / cols;
    const cellH = H / rows;

    const texts = [];
    const positions = [];
    const sizes = [];
    const colors = [];
    const opacities = [];
    const rotations = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const nx = (col + 0.5) / cols;
        const ny = (row + 0.5) / rows;

        let bright;
        if (hasCamera) {
          bright = cam.brightness(nx, ny);
        } else {
          const t = state.time || 0;
          bright = 0.5 + 0.5 * Math.sin(nx * 10 + t) * Math.cos(ny * 8 - t * 0.7);
        }

        if (bright < threshold) continue;

        const sx = nx * W + (Math.random() - 0.5) * cellW * scatter;
        const sy = ny * H + (Math.random() - 0.5) * cellH * scatter;
        const size = fontSize * (0.5 + bright * 0.8);

        let color;
        if (hasCamera) {
          const c = cam.color(nx, ny);
          color = `rgb(${c.r},${c.g},${c.b})`;
        } else {
          color = state.fgColor || '#ffffff';
        }

        if (dotMode) {
          renderer.dot(ctx, sx, sy, size * 0.4, {
            color,
            opacity: 0.3 + bright * 0.7,
            screenCoords: true,
          });
        } else {
          texts.push(DEFAULT_TEXTS[Math.floor(Math.random() * DEFAULT_TEXTS.length)]);
          positions.push({ x: sx, y: sy });
          sizes.push(size);
          colors.push(color);
          opacities.push(0.3 + bright * 0.7);
          rotations.push((Math.random() - 0.5) * scatter * 0.5);
        }
      }
    }

    if (!dotMode && texts.length > 0) {
      renderer.textScatter(ctx, texts, positions, {
        font: 'monospace',
        sizes,
        colors,
        opacities,
        rotations,
        screenCoords: true,
      });
    }
  }
}
