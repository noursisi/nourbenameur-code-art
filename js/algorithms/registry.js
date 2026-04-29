/**
 * Algorithm Registry — maps string IDs to Algorithm classes.
 * Instances are lazily created and cached per engine.
 */

// Active algorithm imports — culled set for the Kiln-facing build.
// Removed (don't interact with image/video, or low-utility):
//   lsystem, julia, koch, phyllotaxis, flow-field, spiral, chladni,
//   contour, spirograph, pixel-organic, magnetic-field, interference,
//   dot-matrix, attractor-zoo, penrose
// Kept: line-based generative (dragon, harmonograph, lissajous, attractor),
// image/video-aware (ascii-render, blob-track, pixel-mosaic, body-particles,
// text-silhouette), and the universal moire pattern.
import { Dragon }              from './fractals/dragon.js';
import { Attractor }           from './nature/attractor.js';
import { Harmonograph }        from './physics/harmonograph.js';
import { Lissajous }           from './physics/lissajous.js';
import { AsciiRender }         from './data-art/ascii-render.js';
import { Moire }               from './physics/moire.js';
import { BlobTrack }           from './data-art/blob-track.js';
import { EdgeGlow }            from './image-art/edge-glow.js';
import { ImageFlow }           from './image-art/image-flow.js';
import { ToneContour }         from './image-art/tone-contour.js';
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

// Generative line-art (work as overlay layers on top of image/video)
registry.register('dragon',         Dragon);
registry.register('attractor',      Attractor);
registry.register('harmonograph',   Harmonograph);
registry.register('lissajous',      Lissajous);
registry.register('moire',          Moire);

// Image/video-aware — all read the canvas every frame and draw based on it
registry.register('edge-glow',      EdgeGlow);
registry.register('image-flow',     ImageFlow);
registry.register('tone-contour',   ToneContour);
registry.register('ascii-render',   AsciiRender);
registry.register('pixel-mosaic',   PixelMosaic);
registry.register('blob-track',     BlobTrack);

// Camera-aware
registry.register('text-silhouette', TextSilhouette);
registry.register('body-particles',  BodyParticles);
