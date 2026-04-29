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
  // Julia — monochrome smooth + orbit trap for structure
  julia_cr: -0.7269, julia_ci: 0.1889, julia_iter: 200, julia_scale: 2.5,
  julia_power: 2, julia_palette: 4, julia_trap: 1,
  // L-System — show tapering + leaves + slight wind for organic look
  lsystem_angle: 25, lsystem_depth: 8, lsystem_rule: 3,
  lsystem_taper: 0.6, lsystem_wind: 4, lsystem_leaves: 1, lsystem_leafSize: 2,
  // Koch — deeper recursion, fill on
  koch_depth: 5, koch_sides: 3, koch_angle: 60, koch_fill: 1, koch_invert: 0, koch_rotSpeed: 0.15,
  // Dragon — higher depth, more folds for density
  dragon_depth: 15, dragon_colorGrad: 0, dragon_folds: 2, dragon_rotSpeed: 0.2,
  // Phyllotaxis
  phyllo_n: 2000, phyllo_divergence: 137.508, phyllo_dotsize: 3, phyllo_sizeVar: 0.5, phyllo_breathe: 0.6,
  // Flow Field — more particles, longer trails
  flow_scale: 0.005, flow_particles: 6000, flow_length: 60, flow_angle_offset: 0,
  flow_colorMode: 0, flow_particleSize: 1,
  // Attractor — more points for density
  att_a: -1.7, att_b: 1.3, att_c: -0.1, att_d: -1.21, att_points: 120000,
  att_colorMode: 0, att_pointShape: 0, att_trail: 1,
  // Chladni — higher modes for fine detail
  chladni_m: 7, chladni_n: 4, chladni_palette: 0, chladni_lineWidth: 0.04, chladni_invert: 0,
  // Harmonograph — compound mode for complexity
  harm_f1: 2.01, harm_f2: 3, harm_phase: 0.7, harm_damping: 0.002, harm_points: 150000,
  harm_colorGrad: 0, harm_compound: 1,
  // Lissajous
  liss_a: 3, liss_b: 4, liss_delta: 1.5, liss_points: 10000,
  liss_ampX: 1.0, liss_ampY: 1.0, liss_echoes: 8,
  // Spiral
  spiral_turns: 30, spiral_growth: 0.08, spiral_dots: 3000,
  spiral_arms: 1, spiral_inward: 0,
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
  // Magnetic Field — more poles, tapered lines for elegance
  mag_poles: 6, mag_strength: 250, mag_lines: 800, mag_lineLen: 80,
  mag_colorMode: 0, mag_lineStyle: 3, mag_energy: 1, mag_poleSize: 6,
  // Interference — circle layout, subtle decay
  intf_sources: 7, intf_wavelength: 0.025, intf_speed: 2,
  intf_layout: 1, intf_amplitude: 1.0, intf_decay: 0.2, intf_palette: 0,
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
  // Dot Matrix — noise pattern, larger dots
  dm_cols: 40, dm_rows: 30, dm_maxSize: 10, dm_pattern: 0, dm_spacing: 1,
  dm_colorMode: 0, dm_shape: 0, dm_invert: 0, dm_animSpeed: 0.8,
  // ASCII Art — mono, dense
  ascii_cols: 80, ascii_charset: 0, ascii_pattern: 0, ascii_fontSize: 8,
  ascii_colorMode: 0,
  // Halftone distortion
  ip_ht_dotsize: 8, ip_ht_angle: 45,
  // Pixel Melt distortion
  ip_melt_amount: 0.3, ip_melt_speed: 1, ip_melt_direction: 0,
  // Channel Drift distortion
  ip_cd_amount: 0.02, ip_cd_angle: 0, ip_cd_animate: 1,
  // Data Corrupt distortion
  ip_dc_intensity: 0.3, ip_dc_blockSize: 12, ip_dc_animate: 1,
  // Recursive Zoom distortion
  ip_rz_depth: 3, ip_rz_scale: 0.5, ip_rz_offsetX: 0, ip_rz_offsetY: 0, ip_rz_rotate: 0,
  // CRT Monitor distortion
  ip_crt_curve: 0.15, ip_crt_scanlines: 0.5, ip_crt_phosphor: 0.4, ip_crt_bleed: 0.003, ip_crt_vignette: 0.5,
  // Needlework distortion
  ip_nw_dotsize: 6, ip_nw_spacing: 1, ip_nw_threshold: 0.4, ip_nw_contrast: 1, ip_nw_mirror: 0, ip_nw_invert: 0,
  // ASCII distortion
  ip_ascii_size: 8, ip_ascii_levels: 5,
  // Data Mosaic distortion
  ip_dm_minBlock: 4, ip_dm_maxBlock: 20, ip_dm_scatter: 0.3,
  // Attractor Zoo — Lorenz, high point count
  az_type: 0, az_points: 200000, az_a: 0, az_b: 0, az_c: 0, az_d: 0,
  az_rotX: 0, az_colorMode: 0, az_resolution: 1,
  // Moire — concentric circles, slow elegant rotation
  moire_layers: 4, moire_lineWidth: 1, moire_spacing: 10, moire_pattern: 1, moire_angleOffset: 3,
  moire_rotSpeed: 0.4, moire_scale: 1.0, moire_contrast: 0.6, moire_centerX: 0.5, moire_centerY: 0.5,
  // Penrose — deeper recursion, fine lines
  pen_depth: 6, pen_scale: 1.5, pen_type: 0,
  pen_colorMode: 0, pen_rotSpeed: 0.02, pen_lineWidth: 0.3, pen_gapWidth: 1,
  // Text Silhouette
  ts_cols: 40, ts_rows: 30, ts_threshold: 0.3, ts_fontSize: 12, ts_scatter: 0.2, ts_dotMode: 0,
  // Pixel Mosaic
  pm_cols: 20, pm_rows: 15, pm_gap: 2, pm_textDensity: 0.15, pm_sizeVariation: 0.3, pm_roundness: 0,
  // Body Particles
  bp_emitRate: 10, bp_particleLife: 120, bp_particleSize: 4, bp_spread: 5, bp_gravity: 0, bp_trailMode: 0,
  // Blob Track
  bt_threshold: 0.35, bt_maxBlobs: 15, bt_boxSize: 30, bt_lines: 0.5, bt_text: 11, bt_jitter: 0.2, bt_seed: 42,
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
