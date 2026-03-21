/**
 * Algorithm Registry — maps string IDs to Algorithm classes.
 * Instances are lazily created and cached per engine.
 */

import { LSystem }      from './fractals/lsystem.js';
import { JuliaSet }     from './fractals/julia.js';
import { Fern }         from './fractals/fern.js';
import { Koch }         from './fractals/koch.js';
import { Sierpinski }   from './fractals/sierpinski.js';
import { Dragon }       from './fractals/dragon.js';
import { Phyllotaxis }  from './nature/phyllotaxis.js';
import { FlowField }    from './nature/flow-field.js';
import { Attractor }    from './nature/attractor.js';
import { Harmonograph } from './physics/harmonograph.js';
import { Lissajous }    from './physics/lissajous.js';
import { Spiral }       from './physics/spiral.js';
import { Contour }      from './data-art/contour.js';
import { Filigree }     from './data-art/filigree.js';
import { Spirograph }   from './data-art/spirograph.js';

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
      // Instantiate temporarily with null engine just to read metadata
      let inst = entry.instance;
      if (!inst) {
        // Use a dummy to read static metadata without side effects
        try {
          inst = new entry.Class(null);
        } catch {
          return;
        }
      }
      result.push({ id, ...inst.metadata });
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
registry.register('fern',       Fern);
registry.register('koch',       Koch);
registry.register('sierpinski', Sierpinski);
registry.register('dragon',     Dragon);

// Nature
registry.register('phyllotaxis', Phyllotaxis);
registry.register('flow-field',  FlowField);
registry.register('attractor',   Attractor);

// Physics
registry.register('harmonograph', Harmonograph);
registry.register('lissajous',    Lissajous);
registry.register('spiral',       Spiral);

// Data Art
registry.register('contour',    Contour);
registry.register('filigree',   Filigree);
registry.register('spirograph', Spirograph);
