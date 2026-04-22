/**
 * Algorithm Registry — maps string IDs to Algorithm classes.
 * Instances are lazily created and cached per engine.
 */

import { LSystem }             from './fractals/lsystem.js';
import { JuliaSet }            from './fractals/julia.js';
import { Koch }                from './fractals/koch.js';
import { Dragon }              from './fractals/dragon.js';
import { Phyllotaxis }         from './nature/phyllotaxis.js';
import { FlowField }           from './nature/flow-field.js';
import { Attractor }           from './nature/attractor.js';
import { Harmonograph }        from './physics/harmonograph.js';
import { Lissajous }           from './physics/lissajous.js';
import { Spiral }              from './physics/spiral.js';
import { Chladni }             from './physics/chladni.js';
import { Contour }             from './data-art/contour.js';
import { Spirograph }          from './data-art/spirograph.js';
import { PixelOrganic }        from './data-art/pixel-organic.js';
import { MagneticField }       from './nature/magnetic-field.js';
import { Interference }        from './physics/interference.js';
import { DotMatrix }           from './data-art/dot-matrix.js';
import { AsciiRender }         from './data-art/ascii-render.js';
import { AttractorZoo }        from './nature/attractor-zoo.js';
import { Moire }               from './physics/moire.js';
import { Penrose }             from './data-art/penrose.js';
import { Cybercore }           from './data-art/cybercore.js';
import { TextSilhouette }      from './camera-art/text-silhouette.js';
import { PixelMosaic }         from './camera-art/pixel-mosaic.js';
import { BodyParticles }       from './camera-art/body-particles.js';

class Registry {
  constructor() {
    /** @type {Map<string, { Class: typeof import('./base.js').Algorithm, instance: object|null }>} */
    this._map = new Map();
  }

  /**
   * Register an algorithm.
   * @param {string} id
   * @param {typeof import('./base.js').Algorithm} AlgoClass
   */
  register(id, AlgoClass) {
    this._map.set(id, { Class: AlgoClass, instance: null });
  }

  /**
   * Get (or lazily create) an instance for the given id and engine.
   * @param {string} id
   * @param {object} engine
   * @returns {object|null}
   */
  get(id, engine) {
    const entry = this._map.get(id);
    if (!entry) return null;
    if (!entry.instance) {
      entry.instance = new entry.Class(engine);
    }
    return entry.instance;
  }

  /**
   * Returns array of { id, ...metadata } for all registered algorithms.
   * @returns {Array<object>}
   */
  getAllMetadata() {
    const result = [];
    this._map.forEach((entry, id) => {
      // Read metadata from prototype to avoid constructing with null engine
      try {
        const proto = entry.Class.prototype;
        const metaDesc = Object.getOwnPropertyDescriptor(proto, 'metadata');
        if (metaDesc && metaDesc.get) {
          // Call the getter with a minimal fake context
          const meta = metaDesc.get.call({ engine: null });
          result.push({ id, ...meta });
        } else {
          // Fallback: try instantiation
          const inst = new entry.Class(null);
          result.push({ id, ...inst.metadata });
        }
      } catch (e) {
        console.error(`Registry: failed to read metadata for "${id}":`, e);
        // Still add it with fallback metadata so it shows in the grid
        result.push({ id, name: id, eq: '', cat: 'Other', desc: '' });
      }
    });
    return result;
  }

  /** Check if an id is registered */
  has(id) {
    return this._map.has(id);
  }
}

export const registry = new Registry();

// ── Register algorithms ──────────────────────────────────────────────────────

// Fractals
registry.register('lsystem',    LSystem);
registry.register('julia',      JuliaSet);
registry.register('koch',       Koch);
registry.register('dragon',     Dragon);

// Nature
registry.register('phyllotaxis',         Phyllotaxis);
registry.register('flow-field',          FlowField);
registry.register('attractor',           Attractor);

// Physics
registry.register('harmonograph', Harmonograph);
registry.register('lissajous',    Lissajous);
registry.register('spiral',       Spiral);
registry.register('chladni',      Chladni);

// Data Art
registry.register('contour',        Contour);
registry.register('spirograph',     Spirograph);
registry.register('pixel-organic',  PixelOrganic);

// Nature (additions)
registry.register('magnetic-field', MagneticField);

// Physics (additions)
registry.register('interference',   Interference);

// Data Art (additions)
registry.register('dot-matrix',     DotMatrix);
registry.register('ascii-render',   AsciiRender);

// Deep Math — chaos, emergence, topology
registry.register('attractor-zoo',  AttractorZoo);
registry.register('moire',          Moire);
registry.register('penrose',        Penrose);
registry.register('cybercore',      Cybercore);

// Camera Art
registry.register('text-silhouette', TextSilhouette);
registry.register('pixel-mosaic',    PixelMosaic);
registry.register('body-particles',  BodyParticles);
