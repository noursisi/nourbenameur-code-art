/**
 * Algorithm Registry — maps string IDs to Algorithm classes.
 * Instances are lazily created and cached per engine.
 */

// Active algorithm imports — minimal set for the Kiln-facing build.
// Blob Track is the headline feature and goes first.
import { BlobTrack }           from './data-art/blob-track.js';
import { AsciiRender }         from './data-art/ascii-render.js';
import { PixelMosaic }         from './camera-art/pixel-mosaic.js';
import { Dragon }              from './fractals/dragon.js';
import { Attractor }           from './nature/attractor.js';
import { Harmonograph }        from './physics/harmonograph.js';
import { Lissajous }           from './physics/lissajous.js';
import { Moire }               from './physics/moire.js';

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

// Blob Track — headline feature, listed first.
registry.register('blob-track',     BlobTrack);

// Image/video-aware — read the canvas every frame and draw based on it
registry.register('ascii-render',   AsciiRender);
registry.register('pixel-mosaic',   PixelMosaic);

// Generative line-art overlays (sit on top of the source image/video)
registry.register('dragon',         Dragon);
registry.register('attractor',      Attractor);
registry.register('harmonograph',   Harmonograph);
registry.register('lissajous',      Lissajous);
registry.register('moire',          Moire);
