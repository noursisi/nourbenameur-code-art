/**
 * L-System Tree algorithm.
 * Uses string rewriting rules to model recursive plant-like branching.
 */

import { Algorithm } from '../base.js';

// ── Rule sets ──────────────────────────────────────────────────────────────────

const RULES = [
  // 0 — Classic binary tree
  {
    axiom: 'X',
    rules: { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' },
    defaultAngle: 25,
    name: 'Binary Tree',
  },
  // 1 — Fractal plant (Prusinkiewicz)
  {
    axiom: 'F',
    rules: { F: 'F[+F]F[-F][F]' },
    defaultAngle: 20,
    name: 'Fractal Plant',
  },
  // 2 — Symmetric branching
  {
    axiom: 'X',
    rules: { X: 'F[+X][-X]FX', F: 'FF' },
    defaultAngle: 30,
    name: 'Symmetric',
  },
  // 3 — Bushy
  {
    axiom: 'F',
    rules: { F: 'FF+[+F-F-F]-[-F+F+F]' },
    defaultAngle: 22.5,
    name: 'Bushy',
  },
  // 4 — Monopodial
  {
    axiom: 'X',
    rules: { X: 'F-[[X]+X]+F[+FX]-X', F: 'FF' },
    defaultAngle: 28,
    name: 'Monopodial',
  },
];

// ── L-System string generation ─────────────────────────────────────────────────

function generate(axiom, rules, depth) {
  let s = axiom;
  for (let i = 0; i < depth; i++) {
    let next = '';
    for (let j = 0; j < s.length; j++) {
      const c = s[j];
      next += rules[c] !== undefined ? rules[c] : c;
    }
    s = next;
    // Hard limit to prevent browser freeze
    if (s.length > 200000) break;
  }
  return s;
}

// ── Bounding box calculator ────────────────────────────────────────────────────

function calcBounds(str, angleDeg) {
  const angleRad = (angleDeg * Math.PI) / 180;
  const stack = [];
  let x = 0, y = 0, a = -Math.PI / 2; // start pointing up
  let minX = 0, maxX = 0, minY = 0, maxY = 0;

  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === 'F' || c === 'G') {
      x += Math.cos(a);
      y += Math.sin(a);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    } else if (c === '+') {
      a += angleRad;
    } else if (c === '-') {
      a -= angleRad;
    } else if (c === '[') {
      stack.push({ x, y, a });
    } else if (c === ']') {
      if (stack.length) ({ x, y, a } = stack.pop());
    }
  }

  return { minX, maxX, minY, maxY };
}

// ── Main class ─────────────────────────────────────────────────────────────────

export class LSystem extends Algorithm {
  constructor(engine) {
    super(engine);
    // Cache last drawn tree as SVG lines
    this._svgLines = [];
  }

  get metadata() {
    return {
      name: 'L-System Tree',
      eq: 'Recursive branching rules',
      cat: 'Fractals',
      desc: 'Simple text rewriting rules model plant growth. Each iteration expands characters into sequences, producing self-similar branching structures.',
    };
  }

  get params() {
    return [
      { id: 'lsystem_angle', label: 'Branch Angle', min: 5,  max: 90, step: 0.5 },
      { id: 'lsystem_depth', label: 'Depth',        min: 1,  max: 12, step: 1   },
      { id: 'lsystem_rule',  label: 'Rule (0–4)',   min: 0,  max: 4,  step: 1   },
    ];
  }

  get detailParam() {
    return { id: 'lsystem_depth', min: 1, max: 12, step: 1 };
  }

  get cursorMap() {
    return (mx, my, s) => {
      s.lsystem_angle = 5 + mx * 85;
    };
  }

  animate(world) { const { state: s } = world;
    // Gently oscillate angle while playing
    s.lsystem_angle = 25 + Math.sin(s.time * 0.5) * 15;
  }

  render(ctx, world) { const { W, H, state: s } = world;
    const ruleIdx = Math.max(0, Math.min(4, Math.round(s.lsystem_rule)));
    const rule = RULES[ruleIdx];
    const depth = Math.max(1, Math.min(12, Math.round(s.lsystem_depth)));
    const angleDeg = s.lsystem_angle;

    const str = generate(rule.axiom, rule.rules, depth);

    // ── Colour from mode ───────────────────────────────────────────────────────
    const bg = this.engine.bg(s);
    const fg = this.engine.fg(s);

    // ── Background ────────────────────────────────────────────────────────────
    if (!s.transparent) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
    }

    // ── Compute bounding box in unit space ────────────────────────────────────
    const bounds = calcBounds(str, angleDeg);
    const bW = bounds.maxX - bounds.minX || 1;
    const bH = bounds.maxY - bounds.minY || 1;

    // Fit to 85% of canvas, with camera pan
    const fitW = W * 0.85;
    const fitH = H * 0.85;
    const scale = Math.min(fitW / bW, fitH / bH);

    // Apply camera zoom around centre
    const camZoom = s.camZoom || 1;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-W / 2, -H / 2);

    // ── Draw ──────────────────────────────────────────────────────────────────
    const angleRad = (angleDeg * Math.PI) / 180;
    const stack = [];

    // Start at bottom-centre of canvas, tree grows upward
    let px = W / 2 + (s.camPanX || 0);
    let py = H * 0.92 + (s.camPanY || 0);

    let angle = -Math.PI / 2; // pointing up

    // Line weight from state
    const lw = (s.lineWeight || 1) * Math.max(0.3, scale * 0.018);

    ctx.strokeStyle = fg;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';

    this._svgLines = [];
    let drawing = false;

    ctx.beginPath();

    for (let i = 0; i < str.length; i++) {
      const c = str[i];

      if (c === 'F' || c === 'G') {
        const nx = px + Math.cos(angle) * scale;
        const ny = py + Math.sin(angle) * scale;
        if (!drawing) {
          ctx.moveTo(px, py);
          drawing = true;
        }
        ctx.lineTo(nx, ny);
        this._svgLines.push([px, py, nx, ny]);
        px = nx;
        py = ny;
      } else if (c === 'f') {
        // Move without drawing
        px += Math.cos(angle) * scale;
        py += Math.sin(angle) * scale;
        drawing = false;
      } else if (c === '+') {
        angle += angleRad;
        drawing = false;
      } else if (c === '-') {
        angle -= angleRad;
        drawing = false;
      } else if (c === '[') {
        stack.push({ px, py, angle, drawing });
        drawing = false;
      } else if (c === ']') {
        if (stack.length) {
          ({ px, py, angle, drawing } = stack.pop());
          drawing = false; // lift pen on pop
        }
      }
    }

    ctx.stroke();
    ctx.restore();

  }

  collectSVG(world) { const { W, H, state: s } = world;
    if (!this._svgLines.length) return null;

    const fg = this.engine.fg(s);
    const bg = this.engine.bg(s);
    const lw = s.lineWeight || 1;

    const lines = this._svgLines
      .map(([x1, y1, x2, y2]) =>
        `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"/>`
      )
      .join('\n');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <g stroke="${fg}" stroke-width="${lw}" stroke-linecap="round">
${lines}
  </g>
</svg>`;
  }

}
