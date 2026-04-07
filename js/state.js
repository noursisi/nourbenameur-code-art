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
  julia_power: 2, julia_palette: 0, julia_trap: 0,
  // L-System
  lsystem_angle: 25, lsystem_depth: 7, lsystem_rule: 0,
  lsystem_taper: 0.7, lsystem_wind: 0, lsystem_leaves: 0, lsystem_leafSize: 3,
  // Koch
  koch_depth: 4, koch_sides: 3, koch_angle: 60, koch_fill: 0, koch_invert: 0, koch_rotSpeed: 0.3,
  // Dragon
  dragon_depth: 12, dragon_colorGrad: 0, dragon_folds: 1, dragon_rotSpeed: 0.35,
  // Phyllotaxis
  phyllo_n: 1200, phyllo_divergence: 137.508, phyllo_dotsize: 3,
  // Flow Field
  flow_scale: 0.006, flow_particles: 4000, flow_length: 40, flow_angle_offset: 0,
  // Attractor
  att_a: -1.7, att_b: 1.3, att_c: -0.1, att_d: -1.21, att_points: 80000,
  att_colorMode: 0, att_pointShape: 0, att_trail: 0,
  // Chladni
  chladni_m: 5, chladni_n: 3, chladni_palette: 0, chladni_lineWidth: 0.06, chladni_invert: 0,
  // Harmonograph
  harm_f1: 2.01, harm_f2: 3, harm_phase: 0.7, harm_damping: 0.003, harm_points: 100000,
  // Lissajous
  liss_a: 3, liss_b: 4, liss_delta: 1.5, liss_points: 8000,
  // Spiral
  spiral_turns: 20, spiral_growth: 0.1, spiral_dots: 2000,
  // Contour
  contour_levels: 15, contour_scale: 0.008, contour_octaves: 3, contour_animation_speed: 0.5,
  // Spirograph
  spiro_R: 60, spiro_r: 30, spiro_d: 45, spiro_points: 20000,
  // Pixel Organic
  pixel_res: 8, pixel_threshold: 0.5, pixel_scale: 0.01,
  // Image layer
  img_layer: 'behind', img_opacity: 0.5, img_scale: 1, img_blend: 'source-over',
  // Record
  rec_duration: 10,
  // Magnetic Field
  mag_poles: 4, mag_strength: 200, mag_lines: 500, mag_lineLen: 60,
  mag_colorMode: 0, mag_lineStyle: 0, mag_energy: 1, mag_poleSize: 8,
  // Interference
  intf_sources: 5, intf_wavelength: 0.03, intf_speed: 3,
  intf_layout: 0, intf_amplitude: 1.0, intf_decay: 0, intf_palette: 0,
  // Image Processor
  ip_enabled: false, ip_effect: 'none', ip_mixWithAlgo: false, ip_scale: 1, ip_offsetX: 0, ip_offsetY: 0,
  ip_displace_amount: 0.05, ip_displace_scale: 4, ip_displace_speed: 0.3,
  ip_sort_threshold: 0.3, ip_sort_direction: 0, ip_sort_intensity: 30,
  ip_thresh_level: 0.5, ip_thresh_smooth: 0.02,
  ip_edge_strength: 1.5, ip_edge_invert: 0,
  ip_kal_segments: 6, ip_kal_rotation: 0, ip_kal_zoom: 1,
  ip_wave_amp: 0.02, ip_wave_freq: 10, ip_wave_speed: 1,
  ip_polar_twist: 0, ip_polar_zoom: 1,
  ip_feedback_decay: 0.85, ip_feedback_offset: 0.005,
  ip_vmosaic_cells: 30, ip_vmosaic_edge: 0.01,
  ip_fwarp_cr: -0.7, ip_fwarp_ci: 0.27, ip_fwarp_amount: 0.1, ip_fwarp_iter: 5,
  // Dot Matrix
  dm_cols: 30, dm_rows: 25, dm_maxSize: 12, dm_pattern: 0, dm_spacing: 1,
  dm_colorMode: 0, dm_shape: 0, dm_invert: 0, dm_animSpeed: 1,
  // ASCII Art
  ascii_cols: 60, ascii_charset: 0, ascii_pattern: 0, ascii_fontSize: 10,
  // Halftone distortion
  ip_ht_dotsize: 8, ip_ht_angle: 45,
  // ASCII distortion
  ip_ascii_size: 8, ip_ascii_levels: 5,
  // Data Mosaic distortion
  ip_dm_minBlock: 4, ip_dm_maxBlock: 20, ip_dm_scatter: 0.3,
  // Attractor Zoo
  az_type: 0, az_points: 100000, az_a: 0, az_b: 0, az_c: 0, az_d: 0,
  az_rotX: 0, az_colorMode: 0, az_resolution: 1,
  // Moire
  moire_layers: 3, moire_lineWidth: 1, moire_spacing: 12, moire_pattern: 0, moire_angleOffset: 5,
  moire_rotSpeed: 0.7, moire_scale: 1.0, moire_contrast: 0.5, moire_centerX: 0.5, moire_centerY: 0.5,
  // Penrose
  pen_depth: 5, pen_scale: 1.5, pen_type: 0,
  pen_colorMode: 0, pen_rotSpeed: 0.05, pen_lineWidth: 0.5, pen_gapWidth: 1,
  // Text Silhouette
  ts_cols: 40, ts_rows: 30, ts_threshold: 0.3, ts_fontSize: 12, ts_scatter: 0.2, ts_dotMode: 0,
  // Pixel Mosaic
  pm_cols: 20, pm_rows: 15, pm_gap: 2, pm_textDensity: 0.15, pm_sizeVariation: 0.3, pm_roundness: 0,
  // Body Particles
  bp_emitRate: 10, bp_particleLife: 120, bp_particleSize: 4, bp_spread: 5, bp_gravity: 0, bp_trailMode: 0,
  // Camera
  cameraActive: false,
  // Layers
  layers: null, activeLayer: 0,
};

let needsRender = true;
export function markDirty() { needsRender = true; }
export function isDirty() { return needsRender; }
export function markClean() { needsRender = false; }

const listeners = new Set();
export function onChange(fn) { listeners.add(fn); }
export function notify() { listeners.forEach(fn => fn()); markDirty(); }
export function set(key, val) { state[key] = val; notify(); }
