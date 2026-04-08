/**
 * Needlework Presets — built-in silhouette illustrations for the needlework effect.
 * Each preset is an SVG path rendered to a canvas, then loaded as image processor source.
 *
 * The silhouettes are designed to look good as dot patterns — bold shapes,
 * clear outlines, high contrast.
 */

// Each preset: { name, width, height, paths (white fill on transparent) }
const PRESETS = [
  {
    name: 'Rose',
    width: 400, height: 400,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      <g fill="#fff" fill-rule="evenodd">
        <ellipse cx="200" cy="160" rx="65" ry="55"/>
        <ellipse cx="200" cy="160" rx="45" ry="70" transform="rotate(30 200 160)"/>
        <ellipse cx="200" cy="160" rx="45" ry="70" transform="rotate(-30 200 160)"/>
        <ellipse cx="200" cy="160" rx="45" ry="70" transform="rotate(60 200 160)"/>
        <ellipse cx="200" cy="160" rx="45" ry="70" transform="rotate(-60 200 160)"/>
        <ellipse cx="200" cy="145" rx="25" ry="35"/>
        <path d="M195 220 Q190 280 170 340 Q165 355 175 360 Q185 355 195 340 Q200 320 200 300 Q200 320 205 340 Q215 355 225 360 Q235 355 230 340 Q210 280 205 220Z"/>
        <ellipse cx="155" cy="290" rx="35" ry="18" transform="rotate(-40 155 290)"/>
        <ellipse cx="245" cy="290" rx="35" ry="18" transform="rotate(40 245 290)"/>
        <ellipse cx="140" cy="250" rx="25" ry="14" transform="rotate(-55 140 250)"/>
        <ellipse cx="260" cy="250" rx="25" ry="14" transform="rotate(55 260 250)"/>
      </g>
    </svg>`,
  },
  {
    name: 'Cross',
    width: 400, height: 400,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      <g fill="#fff">
        <rect x="170" y="40" width="60" height="320" rx="6"/>
        <rect x="80" y="120" width="240" height="60" rx="6"/>
        <circle cx="200" cy="150" r="22"/>
        <path d="M170 40 Q200 20 230 40Z"/>
        <rect x="175" y="360" width="50" height="20" rx="4"/>
      </g>
    </svg>`,
  },
  {
    name: 'Butterfly',
    width: 400, height: 400,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      <g fill="#fff">
        <path d="M200 100 Q120 60 70 100 Q30 150 60 200 Q90 240 140 230 Q170 220 190 200 Q200 190 200 200Z"/>
        <path d="M200 100 Q280 60 330 100 Q370 150 340 200 Q310 240 260 230 Q230 220 210 200 Q200 190 200 200Z"/>
        <path d="M200 200 Q140 250 100 300 Q80 340 120 350 Q160 340 190 300 Q200 270 200 260Z"/>
        <path d="M200 200 Q260 250 300 300 Q320 340 280 350 Q240 340 210 300 Q200 270 200 260Z"/>
        <rect x="197" y="90" width="6" height="200" rx="3"/>
        <path d="M200 90 Q180 60 170 40" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>
        <path d="M200 90 Q220 60 230 40" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>
        <circle cx="170" cy="38" r="5"/>
        <circle cx="230" cy="38" r="5"/>
      </g>
    </svg>`,
  },
  {
    name: 'Church',
    width: 400, height: 500,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
      <g fill="#fff">
        <rect x="100" y="200" width="200" height="250" rx="4"/>
        <path d="M80 200 L200 100 L320 200Z"/>
        <rect x="185" y="60" width="30" height="100"/>
        <rect x="170" y="75" width="60" height="15" rx="3"/>
        <path d="M150 280 A50 70 0 0 1 250 280 L250 450 L150 450Z"/>
        <rect x="170" y="350" width="20" height="100"/>
        <rect x="210" y="350" width="20" height="100"/>
        <circle cx="200" cy="240" r="25"/>
        <circle cx="200" cy="240" r="18" fill="#000"/>
        <rect x="197" y="218" width="6" height="44"/>
        <rect x="178" y="237" width="44" height="6"/>
        <circle cx="140" cy="320" r="12"/>
        <circle cx="260" cy="320" r="12"/>
        <rect x="80" y="430" width="240" height="20" rx="3"/>
      </g>
    </svg>`,
  },
  {
    name: 'Rabbit',
    width: 400, height: 450,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 450">
      <g fill="#fff">
        <ellipse cx="200" cy="280" rx="80" ry="100"/>
        <circle cx="200" cy="170" r="55"/>
        <ellipse cx="160" cy="60" rx="20" ry="80"/>
        <ellipse cx="240" cy="60" rx="20" ry="80"/>
        <ellipse cx="160" cy="60" rx="12" ry="60" fill="#000"/>
        <ellipse cx="240" cy="60" rx="12" ry="60" fill="#000"/>
        <circle cx="180" cy="160" r="6" fill="#000"/>
        <circle cx="220" cy="160" r="6" fill="#000"/>
        <ellipse cx="200" cy="185" rx="8" ry="5" fill="#000"/>
        <path d="M192 190 Q200 200 208 190" stroke="#000" stroke-width="2" fill="none"/>
        <ellipse cx="140" cy="370" rx="30" ry="18"/>
        <ellipse cx="260" cy="370" rx="30" ry="18"/>
        <circle cx="200" cy="385" r="20"/>
      </g>
    </svg>`,
  },
  {
    name: 'Star',
    width: 400, height: 400,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      <g fill="#fff">
        <polygon points="200,30 240,150 370,150 265,225 305,350 200,275 95,350 135,225 30,150 160,150"/>
      </g>
    </svg>`,
  },
  {
    name: 'Skull',
    width: 400, height: 450,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 450">
      <g fill="#fff">
        <ellipse cx="200" cy="180" rx="110" ry="130"/>
        <rect x="140" y="280" width="120" height="60" rx="10"/>
        <ellipse cx="160" cy="160" rx="30" ry="35" fill="#000"/>
        <ellipse cx="240" cy="160" rx="30" ry="35" fill="#000"/>
        <ellipse cx="200" cy="220" rx="12" ry="18" fill="#000"/>
        <rect x="170" y="310" width="8" height="30" fill="#000"/>
        <rect x="196" y="310" width="8" height="30" fill="#000"/>
        <rect x="222" y="310" width="8" height="30" fill="#000"/>
        <path d="M130 290 Q200 340 270 290" stroke="#000" stroke-width="5" fill="none"/>
      </g>
    </svg>`,
  },
  {
    name: 'Heart',
    width: 400, height: 400,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      <path fill="#fff" d="M200 350 Q80 250 60 170 Q40 80 120 60 Q180 40 200 120 Q220 40 280 60 Q360 80 340 170 Q320 250 200 350Z"/>
    </svg>`,
  },
];

/**
 * Render a preset SVG to a canvas Image for use with the image processor.
 * @param {number} presetIndex — index into PRESETS array
 * @param {number} targetW — desired output width
 * @param {number} targetH — desired output height
 * @returns {Promise<HTMLImageElement>}
 */
export function loadPreset(presetIndex) {
  const preset = PRESETS[presetIndex];
  if (!preset) return Promise.reject(new Error('Invalid preset index'));

  return new Promise((resolve, reject) => {
    const blob = new Blob([preset.svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load preset SVG'));
    };
    img.src = url;
  });
}

/** Get list of preset names */
export function getPresetNames() {
  return PRESETS.map(p => p.name);
}

/** Get preset count */
export function getPresetCount() {
  return PRESETS.length;
}
