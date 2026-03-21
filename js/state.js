export const state = {
  algo: 'lsystem',
  playing: false, time: 0, speed: 0.5,
  scrollMode: 'detail', cursorMode: false,
  mouseX: 0.5, mouseY: 0.5,
  camZoom: 1, camPanX: 0, camPanY: 0,
  sym: false, folds: 8,
  colorMode: 'wb', tint: 'none', customTintRGB: [0, 170, 255],
  bgColor: '#000000', fgColor: '#ffffff', glowColor: 'same',
  glow: 0, blur: 0, grain: 0, lineWeight: 1,
  transparent: false,
  // Julia
  julia_cr: -0.7, julia_ci: 0.27, julia_iter: 80, julia_scale: 2.5,
  // L-System
  lsystem_angle: 25, lsystem_depth: 7, lsystem_rule: 0,
  // Fern
  fern_points: 80000, fern_variant: 0,
  // Koch
  koch_depth: 4, koch_sides: 3,
  // Sierpinski
  sierpinski_depth: 6, sierpinski_scale: 1,
  // Dragon
  dragon_depth: 12,
  // Phyllotaxis
  phyllo_n: 1200, phyllo_divergence: 137.508, phyllo_dotsize: 3,
  // Reaction-Diffusion
  rd_feed: 0.055, rd_kill: 0.062,
  // Flow Field
  flow_scale: 0.006, flow_particles: 4000, flow_length: 40, flow_angle_offset: 0,
  // Attractor
  att_a: -1.7, att_b: 1.3, att_c: -0.1, att_d: -1.21, att_points: 80000,
  // Voronoi
  voronoi_cells: 50,
  // Chladni
  chladni_m: 5, chladni_n: 3,
  // Harmonograph
  harm_f1: 2.01, harm_f2: 3, harm_phase: 0.7, harm_damping: 0.003, harm_points: 100000,
  // Lissajous
  liss_a: 3, liss_b: 4, liss_delta: 1.5, liss_points: 8000,
  // Spiral
  spiral_turns: 20, spiral_growth: 0.1, spiral_dots: 2000,
  // Contour
  contour_levels: 15, contour_scale: 0.008, contour_octaves: 3, contour_animation_speed: 0.5,
  // Filigree
  fil_petals: 8, fil_complexity: 5, fil_curve: 0.6,
  // Spirograph
  spiro_R: 60, spiro_r: 30, spiro_d: 45, spiro_points: 20000,
  // Pixel Organic
  pixel_res: 8, pixel_threshold: 0.5, pixel_scale: 0.01,
  // Rorschach
  ror_scale: 0.015, ror_threshold: 0.48, ror_detail: 3,
  // Image layer
  img_layer: 'behind', img_opacity: 0.5, img_scale: 1, img_blend: 'source-over',
  // Record
  rec_duration: 10,
};

let needsRender = true;
export function markDirty() { needsRender = true; }
export function isDirty() { return needsRender; }
export function markClean() { needsRender = false; }

const listeners = new Set();
export function onChange(fn) { listeners.add(fn); }
export function notify() { listeners.forEach(fn => fn()); markDirty(); }
export function set(key, val) { state[key] = val; notify(); }
