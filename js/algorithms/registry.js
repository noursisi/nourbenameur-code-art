/**
 * Algorithm Registry — maps string IDs to Algorithm classes.
 * Instances are lazily created and cached per engine.
 */

import { LSystem }   from './fractals/lsystem.js';
import { JuliaSet }  from './fractals/julia.js';

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
registry.register('lsystem', LSystem);
registry.register('julia',   JuliaSet);
