/**
 * Body Particles — hand positions emit particles, body movement creates forces.
 * Without camera/MediaPipe: particles follow mouse/demo attractors.
 */

import { Algorithm } from '../base.js';

class Particle {
  constructor(x, y, vx, vy, color, size, life) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.size = size;
    this.life = life;
    this.maxLife = life;
    this.friction = 0.98;
  }

  update() {
    this.vx *= this.friction;
    this.vy *= this.friction;
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
  }

  get alive() { return this.life > 0; }
  get alpha() { return Math.max(0, this.life / this.maxLife); }
}

export class BodyParticles extends Algorithm {
  constructor(engine) {
    super(engine);
    this.particles = [];
  }

  get metadata() {
    return {
      name: 'Body Particles',
      eq: 'hands → particles',
      cat: 'Camera Art',
      desc: 'Your hands emit particles, your movement creates forces',
    };
  }

  get params() {
    return [
      { id: 'bp_emitRate', label: 'Emit Rate', min: 1, max: 30, step: 1 },
      { id: 'bp_particleLife', label: 'Life', min: 20, max: 300, step: 10 },
      { id: 'bp_particleSize', label: 'Size', min: 1, max: 15, step: 0.5 },
      { id: 'bp_spread', label: 'Spread', min: 0, max: 20, step: 0.5 },
      { id: 'bp_gravity', label: 'Gravity', min: -0.5, max: 0.5, step: 0.01 },
      { id: 'bp_trailMode', label: 'Trail Mode', min: 0, max: 1, step: 1 },
    ];
  }

  animate(world) {
    const { state } = world;
    const cam = world.camera;
    const W = world.W;
    const H = world.H;
    const emitRate = state.bp_emitRate || 10;
    const life = state.bp_particleLife || 120;
    const size = state.bp_particleSize || 4;
    const spread = state.bp_spread || 5;
    const gravity = state.bp_gravity || 0;
    const hasHands = cam && cam.hands && cam.hands.length > 0;
    const hasPose = cam && cam.pose;
    const fg = state.fgColor || '#ffffff';

    // ── Emit from hands ──
    if (hasHands) {
      for (const hand of cam.hands) {
        // Emit from fingertips (landmarks 4, 8, 12, 16, 20) and wrist (0)
        const tips = [0, 4, 8, 12, 16, 20];
        for (const idx of tips) {
          const lm = hand.landmarks[idx];
          if (!lm || lm.visibility < 0.5) continue;

          for (let i = 0; i < Math.ceil(emitRate / tips.length); i++) {
            const px = lm.x * W;
            const py = lm.y * H;
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * spread;
            this.particles.push(new Particle(
              px, py,
              Math.cos(angle) * speed,
              Math.sin(angle) * speed,
              fg, size + Math.random() * size,
              life + Math.random() * life * 0.5,
            ));
          }
        }
      }

      // Apply hand velocity as force to nearby particles
      for (let hi = 0; hi < cam.hands.length; hi++) {
        const vel = cam.handVelocity[hi];
        if (!vel || vel.speed < 0.1) continue;
        const wrist = cam.hands[hi].landmarks[0];
        const wx = wrist.x * W;
        const wy = wrist.y * H;
        const radius = W * 0.15; // influence radius

        for (const p of this.particles) {
          const dx = p.x - wx;
          const dy = p.y - wy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < radius && dist > 0) {
            const force = (1 - dist / radius) * 2;
            p.vx += vel.x * W * 0.01 * force;
            p.vy += vel.y * H * 0.01 * force;
          }
        }
      }
    }

    // ── Emit from pose joints if no hands detected ──
    if (!hasHands && hasPose) {
      // Wrists (15, 16), shoulders (11, 12)
      const joints = [11, 12, 15, 16];
      for (const idx of joints) {
        const lm = cam.pose.landmarks[idx];
        if (!lm || lm.visibility < 0.5) continue;
        for (let i = 0; i < Math.ceil(emitRate / joints.length); i++) {
          const px = lm.x * W;
          const py = lm.y * H;
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * spread;
          this.particles.push(new Particle(
            px, py,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            fg, size + Math.random() * size,
            life + Math.random() * life * 0.5,
          ));
        }
      }
    }

    // ── Demo mode: emit from center with orbiting attractors ──
    if (!hasHands && !hasPose) {
      const t = state.time || 0;
      const sources = [
        { x: W * (0.35 + 0.15 * Math.sin(t * 1.2)), y: H * (0.4 + 0.1 * Math.cos(t * 0.8)) },
        { x: W * (0.65 + 0.15 * Math.cos(t * 0.9)), y: H * (0.4 + 0.1 * Math.sin(t * 1.1)) },
      ];
      for (const src of sources) {
        for (let i = 0; i < emitRate; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * spread;
          this.particles.push(new Particle(
            src.x, src.y,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            fg, size + Math.random() * size,
            life + Math.random() * life * 0.5,
          ));
        }
      }
    }

    // ── Update all particles ──
    for (const p of this.particles) {
      p.vy += gravity;
      p.update();
    }

    // Remove dead, cap at 10000
    this.particles = this.particles.filter(p => p.alive);
    if (this.particles.length > 10000) {
      this.particles = this.particles.slice(-10000);
    }
  }

  render(ctx, world) {
    const { state } = world;
    const trailMode = state.bp_trailMode || 0;

    if (trailMode) {
      // Trail mode: semi-transparent background for afterimage
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(0, 0, world.W, world.H);
    }

    // Draw particles
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw hand landmarks as small dots if available (visual feedback)
    const cam = world.camera;
    if (cam && cam.hands && cam.hands.length > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      for (const hand of cam.hands) {
        for (const lm of hand.landmarks) {
          if (lm.visibility < 0.5) continue;
          ctx.beginPath();
          ctx.arc(lm.x * world.W, lm.y * world.H, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }
}
