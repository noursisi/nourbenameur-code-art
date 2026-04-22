/**
 * Web Collage — Early 2000s web text spam aesthetic.
 * Hundreds of text snippets at wildly different sizes, fonts, colors,
 * many with colored background rects (like highlighted web links).
 * Think Geocities, early forums, popup ads.
 * The uploaded image shows through — this is a collage layered on top.
 */

import { Algorithm } from '../base.js';

// ── Seeded LCG RNG ────────────────────────────────────────────────────────────

function makeLCG(seed) {
  let s = (seed | 0) >>> 0;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223 | 0;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function pickFrom(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }

// ── Early web text pool ───────────────────────────────────────────────────────

const WEB_TEXT = [
  'CLICK HERE', 'FREE DOWNLOAD', 'Adult (NSFW)', 'angels-heaven.org',
  'CONGRATULATIONS!', 'You have 1 new message', 'best viewed with ANY browser',
  'Add to favorites', 'MAIN PAGE', 'Cool Links', 'Click here!', 'WARNING',
  'Privacy Policy', 'Make Money', 'Submit your picture', 'Are You Ready?',
  'Online Now!', 'DOWNLOADS', 'How do I sell?', 'Clubbed to death',
  'the rules', 'Disclaimer', 'Sign Up', 'Contact us', 'SEARCH...',
  'i butchering you', 'Mood Swings', 'Cannibal', 'Anxiety at social events?',
  'Click OK button', 'What do you have to be thankful for?', 'Thinking of You',
  'Photography', 'View More', 'HELLP', 'Species', 'Collectibles', 'VIDEOS',
  'Credit Problems?', 'People Finder', 'the online diary for the world',
  'Undergraduate Studies', 'WHO we ARE', 'Reset password', 'Satanic Mass',
  'Anthrax Hoaxer on Most-Wanted', 'PoliticsNow', 'Watch Controversial Video',
  'U.S. Govt Pages', 'Doll Houses', 'Cash-earning links', 'parentsguide.org',
  'ExciteSeeingTour', 'Movie Links', 'Society and Cult', 'INTEGRATED BROWSING',
  'Newsgroups and', 'The truth is out there', 'Streaming audio', 'INFORM!',
  'Message Al', 'Please select a rating', 'Stars', 'Hardcore', 'PHOTOS',
  'Feedback - We would like to hear from you', 'History',
  'Win a FREE iPod!', 'Your IP has been logged', 'Download Limewire',
  'AIM: xXdarkl0rdXx', 'MSN: cutegirl01@hotmail.com',
  'Do not steal my graphics!', 'Layout by moonbeam_designz',
  'UNDER CONSTRUCTION', 'NEW!', 'UPDATED!', 'HOT!',
  'Click to enlarge', 'Save image as...', 'Open in new window',
  'pop-up blocked', 'Allow pop-ups from this site?',
  'Your download will begin shortly', 'Mirror 1 | Mirror 2 | Mirror 3',
  'Rate this site: * * * * *', 'Total votes: 1,337',
  'Join the webring', 'Previous | Next | Random | List',
  'Post reply', 'New thread', 'Quote', 'Edit',
  '>>> READ THE RULES <<<', 'Moderator: Admin',
  'Posts: 2,847', 'Joined: Sep 2000', 'Location: USA',
  'Banned', 'Sticky', 'Locked', 'Moved',
  'Last updated: 02/14/2001', 'Get Netscape Now!',
  'Best viewed in 800x600', 'This page uses frames',
  'You are visitor #00042', 'Sign my guestbook!',
  'www.angelfire.com/~darkrose', 'geocities.com/Area51',
  'webrings.org/join', 'counter: 000847',
  'This site is under construction', 'Coming Soon!',
  'Access denied', 'The page cannot be displayed',
  'Connection timed out', 'Server not found',
  'Please wait...', 'Loading...', 'Connecting...', 'Synchronizing...',
  'Checking for updates...', 'Installing component 3 of 47',
  'Do not turn off your computer', 'Estimated time remaining: 47 minutes',
  'register.com', 'tripod.com', 'freewebs.com', 'homestead.com',
  'altavista.com', 'ask jeeves', 'hotbot.com',
  'C:\\WINDOWS\\System32\\', 'explorer.exe', 'FATAL ERROR',
];

const FONTS = [
  'monospace', 'serif', 'sans-serif',
  '"Times New Roman"', '"Arial Black"', '"Comic Sans MS"', 'Impact',
];

const TEXT_COLORS = [
  '#000000', '#ffffff', '#ff0000', '#0000ff', '#008000',
  '#ffff00', '#00ffff', '#ff00ff', '#00ff00', '#ff8800',
];

// Highlight background colors and contrast text for each
const HIGHLIGHT_COLORS = [
  { bg: '#FFFF00', fg: '#000000' },
  { bg: '#FF69B4', fg: '#000000' },
  { bg: '#00FF00', fg: '#000000' },
  { bg: '#00FFFF', fg: '#000000' },
  { bg: '#FF0000', fg: '#ffffff' },
  { bg: '#0000FF', fg: '#ffffff' },
  { bg: '#C0C0C0', fg: '#000000' },
];

// ── Main class ────────────────────────────────────────────────────────────────

export class WebCollage extends Algorithm {

  get metadata() {
    return {
      name: 'Web Collage',
      eq:   'y2k × text',
      cat:  'Data Art',
      desc: 'Early 2000s web text spam — Geocities, forums, popup ads, highlighted links, chaotic fonts and colors.',
    };
  }

  get params() {
    return [
      { id: 'wc_count',     label: 'Count',     min: 50,  max: 300, step: 10,   default: 150  },
      { id: 'wc_size',      label: 'Size',       min: 0.3, max: 1,   step: 0.05, default: 0.6  },
      { id: 'wc_highlight', label: 'Highlight',  min: 0,   max: 1,   step: 0.05, default: 0.35 },
      { id: 'wc_chaos',     label: 'Chaos',      min: 0,   max: 1,   step: 0.05, default: 0.5  },
      { id: 'wc_seed',      label: 'Seed',       min: 0,   max: 100, step: 1,    default: 42   },
    ];
  }

  get detailParam() {
    return { id: 'wc_count', min: 50, max: 300, step: 10 };
  }

  animate(world) {}

  render(ctx, world) {
    const { W, H, state: s } = world;

    const count     = Math.round(clamp(s.wc_count     ?? 150, 50,  300));
    const sizeMult  = clamp(s.wc_size      ?? 0.6,  0.3, 1);
    const highlight = clamp(s.wc_highlight ?? 0.35, 0,   1);
    const chaos     = clamp(s.wc_chaos     ?? 0.5,  0,   1);
    const seed      = Math.round(clamp(s.wc_seed ?? 42, 0, 100));

    const rng = makeLCG(seed * 6271 + 19937);

    ctx.save();

    // Very light dark wash — 10% so the image shows through
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    // Render each text item
    for (let i = 0; i < count; i++) {
      const text = pickFrom(WEB_TEXT, rng);

      // Random position across the whole canvas
      const x = rng() * W;
      const y = rng() * H;

      // Font size: 7–35px, scaled by sizeMult
      const baseSize = 7 + rng() * 28;
      const fontSize = Math.round(baseSize * sizeMult);
      if (fontSize < 5) continue;

      // Random font family
      const fontFam = pickFrom(FONTS, rng);

      // Style: bold, italic, or normal
      const styleRoll = rng();
      let fontStyle = '';
      const isBold   = styleRoll < 0.35;
      const isItalic = styleRoll >= 0.35 && styleRoll < 0.55;
      if (isBold)   fontStyle = 'bold ';
      if (isItalic) fontStyle = 'italic ';

      ctx.font = `${fontStyle}${fontSize}px ${fontFam}`;

      // Chaos: rotation
      const maxRotation = chaos * 0.7; // up to ~40 degrees at full chaos
      const rotation = (rng() - 0.5) * 2 * maxRotation;

      // Should this item get a colored highlight background?
      const doHighlight = rng() < highlight;

      ctx.save();
      ctx.translate(x, y);
      if (rotation !== 0) ctx.rotate(rotation);

      if (doHighlight) {
        const hlColor = pickFrom(HIGHLIGHT_COLORS, rng);
        const metrics = ctx.measureText(text);
        const tw = metrics.width;
        const th = fontSize;
        const pad = 2;

        // Background rectangle
        ctx.fillStyle = hlColor.bg;
        ctx.fillRect(-pad, -th + 2, tw + pad * 2, th + 2);

        // Text on top with contrasting color
        ctx.fillStyle = hlColor.fg;
        ctx.fillText(text, 0, 0);

        // Underline (common on web links)
        if (rng() < 0.5) {
          ctx.strokeStyle = hlColor.fg;
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(0, 2);
          ctx.lineTo(tw, 2);
          ctx.stroke();
        }
      } else {
        // Plain text with random color
        const color = pickFrom(TEXT_COLORS, rng);
        ctx.fillStyle = color;
        ctx.fillText(text, 0, 0);

        // Underline on some non-highlighted items too
        if (rng() < 0.15) {
          const metrics = ctx.measureText(text);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(0, 2);
          ctx.lineTo(metrics.width, 2);
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    ctx.restore();
  }

  randomize(state, set) {
    set('wc_count',     Math.round(50 + Math.random() * 250));
    set('wc_size',      parseFloat((0.3 + Math.random() * 0.7).toFixed(2)));
    set('wc_highlight', parseFloat((Math.random()).toFixed(2)));
    set('wc_chaos',     parseFloat((Math.random()).toFixed(2)));
    set('wc_seed',      Math.round(Math.random() * 100));
  }
}
