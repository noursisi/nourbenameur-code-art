/**
 * Filigree Mandala — Bezier curves repeated radially.
 */

import { Algorithm } from '../base.js';

export class Filigree extends Algorithm {
  constructor(engine) {
    super(engine);
    this._svgPaths = [];
  }

  get metadata() {
    return {
      name: 'Filigree Mandala',
      eq: 'Radial Bezier curves',
      cat: 'Data Art',
      desc: 'Bezier curves drawn at equal angular intervals form mandala-like filigree patterns. Curvature and complexity control the ornate density.',
    };
  }

  get params() {
    return [
      { id: 'fil_petals',     label: 'Petals',     min: 3,   max: 24,  step: 1    },
      { id: 'fil_complexity', label: 'Complexity', min: 2,   max: 12,  step: 1    },
      { id: 'fil_curve',      label: 'Curvature',  min: 0.1, max: 2.0, step: 0.05 },
    ];
  }

  get detailParam() {
    return { id: 'fil_complexity', min: 2, max: 12, step: 1 };
  }

  get cursorMap() {
    return (mx, my, s) => {
      s.fil_petals = Math.round(3 + mx * 21);
      s.fil_curve  = 0.1 + my * 1.9;
    };
  }

  animate(s) {
    s.fil_curve = 0.1 + (Math.sin(s.time * 0.25) * 0.5 + 0.5) * 1.9;
  }

  render(ctx, W, H, s) {
    const petals     = Math.max(3, Math.min(24, Math.round(s.fil_petals)));
    const complexity = Math.max(2, Math.min(12, Math.round(s.fil_complexity)));
    const curve      = Math.max(0.1, s.fil_curve);
    const fg         = this.engine.fg();
    const camZoom    = s.camZoom || 1;
    const panX       = s.camPanX || 0;
    const panY       = s.camPanY || 0;

    const cx = W / 2 + panX;
    const cy = H / 2 + panY;
    const maxR = Math.min(W, H) * 0.44;
    const angleStep = (Math.PI * 2) / petals;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-W / 2, -H / 2);

    ctx.strokeStyle = fg;
    ctx.lineWidth = 0.8;

    this._svgPaths = [];

    // Draw petals at increasing radii
    for (let layer = 1; layer <= complexity; layer++) {
      const r0 = (layer / complexity) * maxR * 0.85;
      const r1 = r0 * 0.55;

      for (let p = 0; p < petals; p++) {
        const baseAngle = p * angleStep;

        // Main petal curve: from center out to r0 and back
        const tipX = cx + r0 * Math.cos(baseAngle);
        const tipY = cy + r0 * Math.sin(baseAngle);

        const cp1x = cx + r1 * Math.cos(baseAngle - curve * angleStep * 0.5);
        const cp1y = cy + r1 * Math.sin(baseAngle - curve * angleStep * 0.5);
        const cp2x = cx + r1 * Math.cos(baseAngle + curve * angleStep * 0.5);
        const cp2y = cy + r1 * Math.sin(baseAngle + curve * angleStep * 0.5);

        // Draw to tip
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.bezierCurveTo(cp1x, cp1y, tipX + (cp1x - tipX) * 0.4, tipY + (cp1y - tipY) * 0.4, tipX, tipY);
        ctx.stroke();

        // Draw back from tip
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.bezierCurveTo(tipX + (cp2x - tipX) * 0.4, tipY + (cp2y - tipY) * 0.4, cp2x, cp2y, cx, cy);
        ctx.stroke();

        // Cross connector arc between adjacent petals
        const nextAngle = baseAngle + angleStep;
        const px1 = cx + r0 * 0.45 * Math.cos(baseAngle + angleStep * 0.4);
        const py1 = cy + r0 * 0.45 * Math.sin(baseAngle + angleStep * 0.4);
        const px2 = cx + r0 * 0.45 * Math.cos(nextAngle - angleStep * 0.4);
        const py2 = cy + r0 * 0.45 * Math.sin(nextAngle - angleStep * 0.4);
        const midX = cx + r0 * 0.3 * Math.cos(baseAngle + angleStep * 0.5);
        const midY = cy + r0 * 0.3 * Math.sin(baseAngle + angleStep * 0.5);

        ctx.beginPath();
        ctx.moveTo(px1, py1);
        ctx.quadraticCurveTo(midX, midY, px2, py2);
        ctx.stroke();

        // Detail circle at each tip
        if (layer === complexity) {
          ctx.beginPath();
          ctx.arc(tipX, tipY, 3, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // Center detail circle
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * 0.05, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * 0.1, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  collectSVG(W, H, s) {
    // Re-render to collect SVG paths — simplified version returning a group element description
    const fg = this.engine.fg();
    const bg = this.engine.bg();
    // Minimal SVG: just pass back what was drawn in render via description
    // For a full SVG collectSVG would mirror the render logic but output path strings.
    // Here we output the key structural paths as <path> elements.
    const petals     = Math.max(3, Math.min(24, Math.round(s.fil_petals)));
    const complexity = Math.max(2, Math.min(12, Math.round(s.fil_complexity)));
    const curve      = Math.max(0.1, s.fil_curve);
    const cx = W / 2;
    const cy = H / 2;
    const maxR = Math.min(W, H) * 0.44;
    const angleStep = (Math.PI * 2) / petals;

    const paths = [];
    for (let layer = 1; layer <= complexity; layer++) {
      const r0 = (layer / complexity) * maxR * 0.85;
      const r1 = r0 * 0.55;
      for (let p = 0; p < petals; p++) {
        const baseAngle = p * angleStep;
        const tipX = cx + r0 * Math.cos(baseAngle);
        const tipY = cy + r0 * Math.sin(baseAngle);
        const cp1x = cx + r1 * Math.cos(baseAngle - curve * angleStep * 0.5);
        const cp1y = cy + r1 * Math.sin(baseAngle - curve * angleStep * 0.5);
        const cp2x = cx + r1 * Math.cos(baseAngle + curve * angleStep * 0.5);
        const cp2y = cy + r1 * Math.sin(baseAngle + curve * angleStep * 0.5);
        paths.push(`M ${cx.toFixed(1)},${cy.toFixed(1)} C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${(tipX + (cp1x - tipX) * 0.4).toFixed(1)},${(tipY + (cp1y - tipY) * 0.4).toFixed(1)} ${tipX.toFixed(1)},${tipY.toFixed(1)}`);
        paths.push(`M ${tipX.toFixed(1)},${tipY.toFixed(1)} C ${(tipX + (cp2x - tipX) * 0.4).toFixed(1)},${(tipY + (cp2y - tipY) * 0.4).toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${cx.toFixed(1)},${cy.toFixed(1)}`);
      }
    }

    const pathData = paths.map(d => `<path d="${d}"/>`).join('\n');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <g stroke="${fg}" stroke-width="0.8" fill="none">
${pathData}
    <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(maxR * 0.05).toFixed(1)}"/>
    <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(maxR * 0.1).toFixed(1)}"/>
  </g>
</svg>`;
  }
}
