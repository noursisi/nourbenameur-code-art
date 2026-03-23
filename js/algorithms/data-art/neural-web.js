/**
 * Neural Web — simulates neural network-like connections.
 * Random nodes connected by curved, pulsing lines.
 */

import { Algorithm } from '../base.js';

export class NeuralWeb extends Algorithm {
  constructor(engine) {
    super(engine);
    this._nodes = [];
    this._connections = [];
    this._lastNodeCount = 0;
    this._lastDensity = 0;
  }

  get metadata() {
    return {
      name: 'Neural Web',
      eq: 'Network topology',
      cat: 'Data Art',
      desc: 'Simulates neural network connections. Nodes drift and pulse, connected by curved lines whose opacity waxes and wanes.',
    };
  }

  get params() {
    return [
      { id: 'nweb_nodes',    label: 'Nodes',      min: 5,   max: 80,  step: 1   },
      { id: 'nweb_density',  label: 'Density',     min: 0.1, max: 1,   step: 0.05 },
      { id: 'nweb_pulse',    label: 'Pulse Speed', min: 0.1, max: 5,   step: 0.1  },
      { id: 'nweb_nodeSize', label: 'Node Size',   min: 1,   max: 10,  step: 0.5  },
    ];
  }

  get detailParam() {
    return { id: 'nweb_nodes', min: 5, max: 80, step: 1 };
  }

  get cursorMap() {
    return (mx, my, s) => {
      s.nweb_pulse = 0.1 + mx * 4.9;
      s.nweb_density = 0.1 + my * 0.9;
    };
  }

  _buildNetwork(nodeCount, density, W, H) {
    this._nodes = [];
    this._connections = [];

    for (let i = 0; i < nodeCount; i++) {
      this._nodes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        phase: Math.random() * Math.PI * 2,
        size: 0.5 + Math.random() * 0.5,
      });
    }

    // Connect nodes based on density (closer nodes more likely)
    const maxDist = Math.min(W, H) * 0.4;
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const dx = this._nodes[i].x - this._nodes[j].x;
        const dy = this._nodes[i].y - this._nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDist && Math.random() < density * (1 - dist / maxDist)) {
          this._connections.push({
            a: i, b: j,
            phase: Math.random() * Math.PI * 2,
            curve: (Math.random() - 0.5) * 50,
          });
        }
      }
    }
  }

  animate(world) { const { state: s } = world;
    const t = s.time;
    const pulse = s.nweb_pulse ?? 1;
    // Drift nodes slightly
    for (const node of this._nodes) {
      node.x += node.vx * 0.3;
      node.y += node.vy * 0.3;
      // Gentle oscillation
      node.x += Math.sin(t * pulse * 0.3 + node.phase) * 0.2;
      node.y += Math.cos(t * pulse * 0.2 + node.phase * 1.3) * 0.2;
    }
  }

  render(ctx, world) { const { W, H, state: s } = world;
    const nodeCount = Math.round(s.nweb_nodes ?? 30);
    const density = s.nweb_density ?? 0.5;
    const pulse = s.nweb_pulse ?? 1;
    const nodeSize = s.nweb_nodeSize ?? 3;
    const time = s.time ?? 0;

    // Rebuild network if params changed
    if (nodeCount !== this._lastNodeCount || density !== this._lastDensity || this._nodes.length === 0) {
      this._buildNetwork(nodeCount, density, W, H);
      this._lastNodeCount = nodeCount;
      this._lastDensity = density;
    }

    const bg = this.engine.bg(s);
    const fg = this.engine.fg(s);
    const lw = s.lineWeight ?? 1;
    const camZoom = s.camZoom ?? 1;

    if (!s.transparent) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-W / 2 + (s.camPanX || 0), -H / 2 + (s.camPanY || 0));

    // Draw connections
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const conn of this._connections) {
      const a = this._nodes[conn.a];
      const b = this._nodes[conn.b];
      if (!a || !b) continue;

      const pulseVal = Math.sin(time * pulse + conn.phase) * 0.5 + 0.5;
      ctx.strokeStyle = fg;
      ctx.globalAlpha = Math.max(0.3, 0.1 + pulseVal * 0.4);
      ctx.lineWidth = Math.max(0.5, lw * (0.5 + pulseVal * 0.5));

      // Quadratic curve
      const mx = (a.x + b.x) / 2 + conn.curve * Math.sin(time * pulse * 0.5 + conn.phase);
      const my = (a.y + b.y) / 2 + conn.curve * Math.cos(time * pulse * 0.5 + conn.phase);

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(mx, my, b.x, b.y);
      ctx.stroke();
    }

    // Draw nodes
    ctx.globalAlpha = 1;
    for (const node of this._nodes) {
      const glow = Math.sin(time * pulse * 0.8 + node.phase) * 0.5 + 0.5;
      const r = nodeSize * node.size * (0.6 + glow * 0.4);

      ctx.fillStyle = fg;
      ctx.globalAlpha = 0.4 + glow * 0.6;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
