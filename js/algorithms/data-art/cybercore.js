/**
 * Cybercore — Y2K / Cybercore COLLAGE aesthetics.
 * Early web chaos: text collage, Windows XP glitch, error dialog stacks,
 * floating analysis panels, coordinate overlays, cursor arrows.
 * The uploaded image is DOMINANT — this is a collage layered on top, not a HUD.
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

// ── Utility ───────────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function pickFrom(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }

// ── Early web / Y2K text pool (100+ strings) ──────────────────────────────────

const WEB_TEXT = [
  'CLICK HERE', 'FREE DOWNLOAD', 'You have 1 new message', 'CONGRATULATIONS!',
  'Adult (NSFW)', '404 NOT FOUND', 'angels-heaven.org', 'Click OK to continue',
  'Error at line 0x0042', 'WARNING', 'best viewed with ANY browser',
  'CLICK to apologize!', 'CLICK to be saved!', 'Privacy Policy',
  'Are You Ready?', 'Submit your picture', 'MAIN PAGE', 'Online Now!',
  'Add to favorites', 'the rules', 'Disclaimer', 'Make Money Fast',
  'Cool Links', 'Click here!', 'DOWNLOADS', 'Sign Up', 'Contact us',
  'SEARCH...', 'Web Resources', 'How do I sell?', 'History', 'News', 'Help',
  'VIEW SOURCE', 'REFRESH', 'BACK', 'FORWARD',
  'File  Edit  View  Favorites  Tools  Help',
  'C:\\WINDOWS\\System32\\', 'rundll32.exe', 'explorer.exe',
  'kernel32.dll', 'FATAL ERROR', 'BSOD', 'MEMORY DUMP',
  'Connection timed out', 'Server not found', 'Access denied',
  'The page cannot be displayed',
  'This program has performed an illegal operation',
  'General Protection Fault', 'Abort, Retry, Fail?',
  'Press F1 for help', 'Insert disk 2', 'Formatting C:\\',
  'Your computer may be at risk', 'Windows is shutting down',
  'Runtime Error!', 'Stack overflow', 'Segmentation fault',
  'www.angelfire.com/~darkrose', 'geocities.com/Area51',
  'webrings.org/join', 'counter: 000847',
  'This site is under construction', 'Coming Soon!',
  'Last updated: 02/14/2001', 'Get Netscape Now!',
  'Best viewed in 800x600', 'This page uses frames',
  'You are visitor #00042', 'Sign my guestbook!',
  'Win a FREE iPod!', 'Your IP has been logged',
  'Download Limewire', 'Napster is back!',
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
  'C:\\> _', 'ipconfig /all', 'ping 192.168.1.1',
  'netstat -an', 'dir /s /b', 'del *.* /q',
  'format C: /y', 'regedit.exe', 'msconfig',
  '0x8007000E', '0xC000021A', '0x0000007E',
  'IRQL_NOT_LESS_OR_EQUAL', 'PAGE_FAULT_IN_NONPAGED_AREA',
  'A problem has been detected', 'Technical information:',
  'STOP: 0x0000000A', '*** STOP: 0x00000050',
  'Beginning dump of physical memory', 'Physical memory dump complete',
  'Contact your system administrator',
  'The system cannot find the file specified',
  'Access is denied', 'Not enough storage',
  'The operation completed successfully',
  'There is not enough space on the disk',
  'The device is not ready', 'The network path was not found',
  'An error occurred while', 'Please wait...',
  'Loading...', 'Connecting...', 'Synchronizing...',
  'Verifying...', 'Scanning for viruses...',
  'Checking for updates...', 'Installing component 3 of 47',
  'Do not turn off your computer', 'Setup is copying files...',
  'Estimated time remaining: 47 minutes',
  'register.com', 'tripod.com', 'brinkster.com',
  'freewebs.com', 'homestead.com', 'lycos.com',
  'altavista.com', 'ask jeeves', 'hotbot.com',
  'astalavista.box.sk', 'l33t.hax0r.net',
  'skull.net', 'darkness.org', 'eviloverlord.com',
];

const WINDOW_TITLES = [
  'Error', 'Warning', 'Microsoft Windows', 'Internet Explorer',
  'Windows Explorer', 'My Computer', 'Notepad', 'Paint',
  'System Properties', 'Device Manager', 'Task Manager',
  'Registry Editor', 'Command Prompt', 'Run', 'Properties',
  'Open With...', 'Save As', 'File Download', 'Security Warning',
  'Windows Update', 'System Restore', 'Add or Remove Programs',
  'Display Properties', 'Desktop Cleanup Wizard', 'Low Disk Space',
  'New Message', 'Inbox - Outlook Express', 'Windows Media Player',
  'WinAmp 2.91', 'ICQ2003', 'mIRC', 'AOL Instant Messenger',
  'Kazaa Lite', 'BitTorrent', 'WinRAR', 'DAEMON Tools',
  'Norton AntiVirus Alert', 'McAfee SecurityCenter',
  'Spybot - Search & Destroy', 'Ad-Aware SE',
  'SciTE - [untitled]', 'Notepad++ v4.8.2',
  'Adobe Photoshop CS', 'Macromedia Flash MX',
  'Counter-Strike', 'Half-Life', 'Quake III Arena',
  'Defrag', 'ScanDisk', 'Disk Cleanup',
];

const ERROR_MESSAGES = [
  'An error has occurred. To continue:\nPress ENTER to return to Windows, or\nPress CTRL+ALT+DEL to restart your computer.',
  'This program has performed an illegal operation and will be shut down.\n\nIf the problem persists, contact the program vendor.',
  'Windows has detected that your computer is running slowly. Would you like Windows to close some programs?',
  'A fatal exception 0E has occurred at 0028:C0034B53 in VxD---.',
  'Not enough memory to complete this operation. Quit one or more programs, and then try again.',
  'Windows cannot access the specified device, path, or file. You may not have the appropriate permissions.',
  'The file or folder that this shortcut refers to cannot be found.',
  'Windows has recovered from a serious error. A log of this error has been created.',
  'Your computer may be infected with spyware or adware.',
  'Disk quota exceeded. You must free up space to continue.',
  'The connection was refused when attempting to contact the server.',
  'Internet Explorer has encountered an error and must close.',
  'Stack overflow at line: 0',
  'Object expected\nLine: 1\nChar: 1\nError: Object expected\nCode: 0\nURL: http://www.geocities.com/darkrose/',
  'Runtime error (at 42:0):\nCould not call proc.',
];

// ── Text colors ───────────────────────────────────────────────────────────────

const TEXT_COLORS = [
  '#ffffff', '#00ffff', '#ffff00', '#00ff00',
  '#ff0066', '#0099ff', '#ff99ff', '#99ff00',
  '#ff6600', '#ff0000', '#00ccff', '#ccff00',
  '#000000', '#0000ff',
];

const HIGHLIGHT_BG_COLORS = [
  '#ffff00', '#00ff00', '#ff69b4', '#00bfff',
  '#ff4500', '#adff2f', '#ff1493', '#1e90ff',
  '#ffd700', '#7fff00', '#ff6347', '#40e0d0',
  '#0000ff', '#000080',
];

// ── Main class ────────────────────────────────────────────────────────────────

export class Cybercore extends Algorithm {

  get metadata() {
    return {
      name: 'Cybercore',
      eq:   'y2k × collage',
      cat:  'Data Art',
      desc: 'Y2K / cybercore collage — early web chaos, Windows error dialogs, text bombing, cursor arrows, glitch, and image crop windows.',
    };
  }

  get params() {
    return [
      { id: 'cyber_density',  label: 'Density',   min: 0.1, max: 1,   step: 0.05, default: 0.6  },
      { id: 'cyber_text',     label: 'Text',       min: 0,   max: 1,   step: 0.05, default: 0.7  },
      { id: 'cyber_windows',  label: 'Windows',    min: 0,   max: 30,  step: 1,    default: 8    },
      { id: 'cyber_glitch',   label: 'Glitch',     min: 0,   max: 1,   step: 0.05, default: 0.3  },
      { id: 'cyber_scanlines',label: 'Scanlines',  min: 0,   max: 1,   step: 0.05, default: 0.25 },
      { id: 'cyber_cursors',  label: 'Cursors',    min: 0,   max: 20,  step: 1,    default: 6    },
      { id: 'cyber_coords',   label: 'Coords',     min: 0,   max: 1,   step: 0.05, default: 0.5  },
      { id: 'cyber_tint',     label: 'Tint',       min: 0,   max: 1,   step: 0.05, default: 0.2  },
      { id: 'cyber_seed',     label: 'Seed',       min: 0,   max: 100, step: 1,    default: 42   },
    ];
  }

  get detailParam() {
    return { id: 'cyber_density', min: 0.1, max: 1, step: 0.05 };
  }

  animate(world) {}

  // ── Render ─────────────────────────────────────────────────────────────────

  render(ctx, world) {
    const { W, H, state: s } = world;

    const density   = clamp(s.cyber_density  ?? 0.6,  0.1, 1);
    const textAmt   = clamp(s.cyber_text     ?? 0.7,  0,   1);
    const nWindows  = Math.round(clamp(s.cyber_windows  ?? 8,    0,  30));
    const glitch    = clamp(s.cyber_glitch   ?? 0.3,  0,   1);
    const scanlines = clamp(s.cyber_scanlines ?? 0.25, 0,   1);
    const nCursors  = Math.round(clamp(s.cyber_cursors  ?? 6,    0,  20));
    const coords    = clamp(s.cyber_coords   ?? 0.5,  0,   1);
    const tint      = clamp(s.cyber_tint     ?? 0.2,  0,   1);
    const seed      = Math.round(clamp(s.cyber_seed    ?? 42,   0,  100));

    const rng = makeLCG(seed * 7919 + 31337);

    ctx.save();

    // ── 1. Very light dark wash — image should show through ───────────────────
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#000008';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    // ── 2. Glitch effects ─────────────────────────────────────────────────────
    if (glitch > 0) {
      this._drawGlitch(ctx, W, H, glitch, rng, density);
    }

    // ── 3. Coordinate overlays with dashed lines ──────────────────────────────
    if (coords > 0) {
      this._drawCoords(ctx, W, H, coords, rng, density);
    }

    // ── 4. Windows / dialog boxes ─────────────────────────────────────────────
    if (nWindows > 0) {
      this._drawWindows(ctx, W, H, nWindows, rng, density);
    }

    // ── 5. Text collage ───────────────────────────────────────────────────────
    if (textAmt > 0) {
      this._drawTextCollage(ctx, W, H, textAmt, rng, density);
    }

    // ── 6. Cursor arrows ──────────────────────────────────────────────────────
    if (nCursors > 0) {
      this._drawCursors(ctx, W, H, nCursors, rng);
    }

    // ── 7. Scanlines ──────────────────────────────────────────────────────────
    if (scanlines > 0) {
      this._drawScanlines(ctx, W, H, scanlines);
    }

    // ── 8. Color tint ─────────────────────────────────────────────────────────
    if (tint > 0) {
      this._drawTint(ctx, W, H, tint);
    }

    ctx.restore();
  }

  // ── Glitch ────────────────────────────────────────────────────────────────

  _drawGlitch(ctx, W, H, glitch, rng, density) {
    const numStrips = Math.floor(glitch * density * 30) + 2;

    ctx.save();
    for (let i = 0; i < numStrips; i++) {
      const srcY   = rng() * H;
      const stripH = rng() * 30 + 2;
      const offsetX = (rng() - 0.5) * glitch * 80;

      try {
        ctx.drawImage(ctx.canvas, 0, srcY, W, stripH, offsetX, srcY, W, stripH);
      } catch (e) {}
    }

    // RGB channel shift — draw canvas with red/blue offset and multiply blend
    if (glitch > 0.3) {
      const shift = glitch * 12;
      ctx.globalAlpha = glitch * 0.25;
      ctx.globalCompositeOperation = 'screen';
      try {
        ctx.drawImage(ctx.canvas, shift, 0, W - shift, H, 0, 0, W - shift, H);
      } catch (e) {}
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    // Random color bars
    const nBars = Math.floor(glitch * density * 8);
    for (let i = 0; i < nBars; i++) {
      const y = rng() * H;
      const h = rng() * 4 + 1;
      ctx.globalAlpha = rng() * 0.6 + 0.1;
      const colors = ['#ff0000', '#00ff00', '#0000ff', '#ff00ff', '#00ffff', '#ffff00'];
      ctx.fillStyle = pickFrom(colors, rng);
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillRect(0, y, W, h);
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── Coordinate overlays ───────────────────────────────────────────────────

  _drawCoords(ctx, W, H, coords, rng, density) {
    const nLines = Math.floor(coords * density * 18) + 2;
    const lineColors = ['#ffffff', '#00ff00', '#ff0000', '#00ffff', '#ffff00'];

    ctx.save();
    ctx.font = '9px "Courier New", monospace';

    for (let i = 0; i < nLines; i++) {
      const x1 = rng() * W;
      const y1 = rng() * H;
      const x2 = rng() * W;
      const y2 = rng() * H;
      const col = pickFrom(lineColors, rng);

      // Dashed line
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.7;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Endpoint handles (small squares)
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.strokeRect(x1 - 3, y1 - 3, 6, 6);
      ctx.strokeRect(x2 - 3, y2 - 3, 6, 6);

      // Coordinate labels
      ctx.globalAlpha = 0.9;
      const label1 = `x:${Math.round(x1)} y:${Math.round(y1)}`;
      const label2 = `x:${Math.round(x2)} y:${Math.round(y2)}`;

      // Background for label
      const lw1 = ctx.measureText(label1).width;
      const lw2 = ctx.measureText(label2).width;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(x1 + 5, y1 - 11, lw1 + 4, 12);
      ctx.fillRect(x2 + 5, y2 - 11, lw2 + 4, 12);

      ctx.fillStyle = col;
      ctx.fillText(label1, x1 + 7, y1 - 1);
      ctx.fillText(label2, x2 + 7, y2 - 1);
    }

    // Selection rectangles (dotted)
    const nRects = Math.floor(coords * density * 6) + 1;
    for (let i = 0; i < nRects; i++) {
      const rx = rng() * W * 0.8;
      const ry = rng() * H * 0.8;
      const rw = rng() * W * 0.4 + 40;
      const rh = rng() * H * 0.4 + 30;
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = pickFrom(['#fff', '#00ffff', '#ffff00'], rng);
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);

      // Corner handles
      for (const [hx, hy] of [[rx,ry],[rx+rw,ry],[rx,ry+rh],[rx+rw,ry+rh]]) {
        ctx.strokeStyle = '#fff';
        ctx.globalAlpha = 0.8;
        ctx.strokeRect(hx - 3, hy - 3, 6, 6);
      }

      // Measurement annotation
      const dimLabel = `${Math.round(rw)}px × ${Math.round(rh)}px`;
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      const dlw = ctx.measureText(dimLabel).width;
      ctx.fillRect(rx, ry - 13, dlw + 6, 12);
      ctx.fillStyle = '#00ffff';
      ctx.font = '9px "Courier New", monospace';
      ctx.fillText(dimLabel, rx + 3, ry - 3);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── Windows / Dialogs ─────────────────────────────────────────────────────

  _drawWindows(ctx, W, H, nWindows, rng, density) {
    ctx.save();

    for (let i = 0; i < nWindows; i++) {
      // Size — mix of tiny and huge
      const sizeRoll = rng();
      let ww, wh;
      if (sizeRoll < 0.15) {
        ww = rng() * 60 + 40;  // tiny
        wh = rng() * 40 + 25;
      } else if (sizeRoll < 0.5) {
        ww = rng() * 160 + 100; // medium
        wh = rng() * 120 + 60;
      } else {
        ww = rng() * 250 + 150; // large
        wh = rng() * 200 + 100;
      }

      // Position — allow going off edges
      const wx = (rng() - 0.1) * (W + 80) - 40;
      const wy = (rng() - 0.1) * (H + 80) - 40;

      // Rotation — slight, occasionally more
      const rot = (rng() - 0.5) * (rng() < 0.2 ? 0.3 : 0.07);

      ctx.save();
      ctx.translate(wx + ww / 2, wy + wh / 2);
      ctx.rotate(rot);
      ctx.translate(-(ww / 2), -(wh / 2));

      const titleH = 18;
      const isError = rng() < 0.35;
      const isImageWindow = rng() < 0.45 && ww > 80 && wh > 60;

      // Shadow
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(4, 4, ww, wh);

      // Window body background
      ctx.globalAlpha = 0.93;
      ctx.fillStyle = '#d4d0c8';
      ctx.fillRect(0, 0, ww, wh);

      // Title bar
      const tbGrad = ctx.createLinearGradient(0, 0, ww, 0);
      if (isError) {
        tbGrad.addColorStop(0, '#800000');
        tbGrad.addColorStop(1, '#c04040');
      } else {
        tbGrad.addColorStop(0, '#0a246a');
        tbGrad.addColorStop(1, '#3a6ea5');
      }
      ctx.fillStyle = tbGrad;
      ctx.fillRect(0, 0, ww, titleH);

      // Title text
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 10px "Tahoma", "MS Sans Serif", sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 1;
      const title = pickFrom(WINDOW_TITLES, rng);
      ctx.fillText(title.substring(0, Math.floor(ww / 7)), 4, titleH / 2);

      // [_][□][X] buttons
      if (ww > 60) {
        const btnW = 14, btnH = 12;
        const bx = ww - (btnW + 2) * 3 - 3;
        const by = (titleH - btnH) / 2;
        const btns = ['_', '□', 'X'];
        const btnColors = ['#d4d0c8', '#d4d0c8', '#d4d0c8'];
        for (let b = 0; b < 3; b++) {
          const bxPos = bx + b * (btnW + 2);
          ctx.fillStyle = btnColors[b];
          ctx.fillRect(bxPos, by, btnW, btnH);
          // raised border
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(bxPos, by + btnH);
          ctx.lineTo(bxPos, by);
          ctx.lineTo(bxPos + btnW, by);
          ctx.stroke();
          ctx.strokeStyle = '#808080';
          ctx.beginPath();
          ctx.moveTo(bxPos + btnW, by);
          ctx.lineTo(bxPos + btnW, by + btnH);
          ctx.lineTo(bxPos, by + btnH);
          ctx.stroke();
          ctx.fillStyle = '#000000';
          ctx.font = `bold 8px "Tahoma", sans-serif`;
          ctx.textBaseline = 'middle';
          ctx.fillText(btns[b], bxPos + 3, by + btnH / 2);
        }
      }

      // Window border (classic raised)
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, wh); ctx.lineTo(0, 0); ctx.lineTo(ww, 0);
      ctx.stroke();
      ctx.strokeStyle = '#808080';
      ctx.beginPath();
      ctx.moveTo(ww, 0); ctx.lineTo(ww, wh); ctx.lineTo(0, wh);
      ctx.stroke();

      // Window content area
      const bodyX = 2, bodyY = titleH + 1, bodyW = ww - 4, bodyH = wh - titleH - 3;

      if (bodyH > 4 && bodyW > 4) {
        if (isImageWindow) {
          // Crop a piece of the actual canvas into this window
          try {
            const srcX = rng() * W * 0.7;
            const srcY2 = rng() * H * 0.7;
            const srcW = Math.min(bodyW * (1.5 + rng()), W - srcX);
            const srcH = Math.min(bodyH * (1.5 + rng()), H - srcY2);
            ctx.drawImage(ctx.canvas, srcX, srcY2, srcW, srcH, bodyX, bodyY, bodyW, bodyH);
          } catch (e) {
            // fallback: gray body
            ctx.fillStyle = '#c0c0c0';
            ctx.fillRect(bodyX, bodyY, bodyW, bodyH);
          }
          // scrollbar strip on right
          this._drawScrollbar(ctx, bodyX + bodyW - 12, bodyY, 12, bodyH, rng);
        } else if (isError) {
          // Error dialog content
          ctx.fillStyle = '#d4d0c8';
          ctx.fillRect(bodyX, bodyY, bodyW, bodyH);

          // Error icon area
          if (bodyW > 50) {
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(bodyX + 18, bodyY + 16, 12, 0, Math.PI * 2);
            ctx.fillStyle = '#ff0000';
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 14px "Tahoma", sans-serif';
            ctx.textBaseline = 'middle';
            ctx.fillText('!', bodyX + 14, bodyY + 16);
          }

          // Error message text
          ctx.fillStyle = '#000000';
          ctx.font = '9px "Tahoma", "MS Sans Serif", sans-serif';
          ctx.textBaseline = 'top';
          const msg = pickFrom(ERROR_MESSAGES, rng);
          const lines = msg.split('\n');
          const startX = bodyW > 50 ? bodyX + 36 : bodyX + 4;
          const maxW = bodyW - (bodyW > 50 ? 40 : 8);
          let lineY = bodyY + 4;
          for (const line of lines) {
            if (lineY > bodyY + bodyH - 10) break;
            // word wrap roughly
            if (ctx.measureText(line).width > maxW && maxW > 20) {
              const words = line.split(' ');
              let cur = '';
              for (const w of words) {
                const test = cur ? cur + ' ' + w : w;
                if (ctx.measureText(test).width > maxW && cur) {
                  ctx.fillText(cur, startX, lineY);
                  lineY += 11;
                  cur = w;
                } else {
                  cur = test;
                }
              }
              if (cur) { ctx.fillText(cur, startX, lineY); lineY += 11; }
            } else {
              ctx.fillText(line, startX, lineY);
              lineY += 11;
            }
          }

          // OK button
          if (bodyH > 40) {
            const bW = 50, bH = 16;
            const bx2 = bodyX + bodyW / 2 - bW / 2;
            const by2 = bodyY + bodyH - bH - 6;
            ctx.fillStyle = '#d4d0c8';
            ctx.fillRect(bx2, by2, bW, bH);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(bx2, by2 + bH); ctx.lineTo(bx2, by2); ctx.lineTo(bx2 + bW, by2);
            ctx.stroke();
            ctx.strokeStyle = '#808080';
            ctx.beginPath();
            ctx.moveTo(bx2 + bW, by2); ctx.lineTo(bx2 + bW, by2 + bH); ctx.lineTo(bx2, by2 + bH);
            ctx.stroke();
            ctx.fillStyle = '#000';
            ctx.font = '10px "Tahoma", sans-serif';
            ctx.textBaseline = 'middle';
            ctx.fillText('OK', bx2 + bW / 2 - 6, by2 + bH / 2);
          }
        } else {
          // Generic window — menu bar + text content
          ctx.fillStyle = '#d4d0c8';
          ctx.fillRect(bodyX, bodyY, bodyW, bodyH);

          // Menu bar
          if (bodyH > 25) {
            ctx.fillStyle = '#d4d0c8';
            ctx.fillRect(bodyX, bodyY, bodyW, 14);
            ctx.fillStyle = '#000';
            ctx.font = '9px "Tahoma", "MS Sans Serif", sans-serif';
            ctx.textBaseline = 'middle';
            const menus = ['File', 'Edit', 'View', 'Tools', 'Help'];
            let mx = bodyX + 4;
            for (const m of menus) {
              if (mx > bodyX + bodyW - 20) break;
              ctx.fillText(m, mx, bodyY + 7);
              mx += ctx.measureText(m).width + 10;
            }
            // menu bar bottom line
            ctx.strokeStyle = '#808080';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(bodyX, bodyY + 14); ctx.lineTo(bodyX + bodyW, bodyY + 14);
            ctx.stroke();
          }

          // Blue selection highlight bar(s)
          const numHighlights = Math.floor(rng() * 3) + 1;
          if (bodyH > 40) {
            for (let h = 0; h < numHighlights; h++) {
              const hY = bodyY + 16 + rng() * (bodyH - 20);
              if (hY + 13 < bodyY + bodyH) {
                ctx.fillStyle = rng() < 0.5 ? '#0a246a' : '#316ac5';
                ctx.globalAlpha = 0.85;
                ctx.fillRect(bodyX + 1, hY, bodyW - 2, 13);
                ctx.globalAlpha = 1;
              }
            }
          }

          // Scrollbar
          if (bodyW > 60) {
            this._drawScrollbar(ctx, bodyX + bodyW - 12, bodyY + 15, 12, bodyH - 15, rng);
          }

          // Content text lines
          ctx.fillStyle = '#000000';
          ctx.font = '9px "Courier New", monospace';
          ctx.textBaseline = 'top';
          const numLines2 = Math.floor(bodyH / 11);
          for (let l = 0; l < numLines2; l++) {
            if (rng() < 0.7) {
              const txt = pickFrom(WEB_TEXT, rng);
              const textY = bodyY + 17 + l * 11;
              if (textY > bodyY + bodyH - 5) break;
              ctx.globalAlpha = 0.85;
              ctx.fillText(txt.substring(0, Math.floor((bodyW - 20) / 5.5)), bodyX + 4, textY);
              ctx.globalAlpha = 1;
            }
          }
        }
      }

      ctx.restore();
    }

    ctx.restore();
  }

  _drawScrollbar(ctx, x, y, w, h, rng) {
    ctx.save();
    ctx.globalAlpha = 1;
    // track
    ctx.fillStyle = '#d4d0c8';
    ctx.fillRect(x, y, w, h);
    // arrows top/bottom
    ctx.fillStyle = '#d4d0c8';
    ctx.fillRect(x, y, w, 12);
    ctx.fillRect(x, y + h - 12, w, 12);
    // borders
    ctx.strokeStyle = '#808080';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    // thumb
    const thumbH = Math.max(h * 0.2, 20);
    const thumbY = y + 13 + rng() * (h - thumbH - 26);
    ctx.fillStyle = '#d4d0c8';
    ctx.fillRect(x + 1, thumbY, w - 2, thumbH);
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(x + 1, thumbY + thumbH); ctx.lineTo(x + 1, thumbY); ctx.lineTo(x + w - 1, thumbY); ctx.stroke();
    ctx.strokeStyle = '#808080';
    ctx.beginPath(); ctx.moveTo(x + w - 1, thumbY); ctx.lineTo(x + w - 1, thumbY + thumbH); ctx.lineTo(x + 1, thumbY + thumbH); ctx.stroke();
    // up/down arrow glyphs
    ctx.fillStyle = '#000';
    ctx.font = '8px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('▲', x + 2, y + 6);
    ctx.fillText('▼', x + 2, y + h - 6);
    ctx.restore();
  }

  // ── Text Collage ──────────────────────────────────────────────────────────

  _drawTextCollage(ctx, W, H, textAmt, rng, density) {
    const count = Math.floor(textAmt * density * 180) + 30;

    ctx.save();
    ctx.textBaseline = 'top';

    for (let i = 0; i < count; i++) {
      const x = (rng() - 0.05) * (W + 60) - 30;
      const y = (rng() - 0.05) * (H + 60) - 30;

      const size = Math.floor(rng() * rng() * 28 + 6); // skewed small, occasional big
      const isBold   = rng() < 0.4;
      const isItalic = rng() < 0.2;

      // Font family: mix of fonts
      const fonts = [
        '"Courier New", monospace',
        '"Times New Roman", serif',
        'Arial, sans-serif',
        '"Comic Sans MS", cursive',
        '"Tahoma", sans-serif',
        'Impact, sans-serif',
        '"Verdana", sans-serif',
      ];
      const fontFamily = pickFrom(fonts, rng);
      const fontStr = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${size}px ${fontFamily}`;
      ctx.font = fontStr;

      const color = pickFrom(TEXT_COLORS, rng);
      const text  = pickFrom(WEB_TEXT, rng);

      // 30% chance of colored background rectangle (web highlight box)
      if (rng() < 0.3) {
        const bgColor = pickFrom(HIGHLIGHT_BG_COLORS, rng);
        const textW = ctx.measureText(text).width;
        const pad = 2;
        ctx.globalAlpha = rng() * 0.6 + 0.5;
        ctx.fillStyle = bgColor;
        ctx.fillRect(x - pad, y - pad, textW + pad * 2, size + pad * 2);
        // text on top of colored bg
        ctx.globalAlpha = 1;
        // pick contrasting text color
        const darkBgs = ['#0000ff', '#000080'];
        ctx.fillStyle = darkBgs.includes(bgColor) ? '#ffffff' : '#000000';
        ctx.fillText(text, x, y);
      } else {
        ctx.globalAlpha = rng() * 0.5 + 0.5;
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── Cursor Arrows ─────────────────────────────────────────────────────────

  _drawCursors(ctx, W, H, nCursors, rng) {
    ctx.save();

    for (let i = 0; i < nCursors; i++) {
      const x = rng() * W;
      const y = rng() * H;
      const scale = rng() * 1.5 + 0.6;
      const rot   = (rng() - 0.5) * Math.PI * 0.5; // slight random rotation

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(scale, scale);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 16);
      ctx.lineTo(5, 12);
      ctx.lineTo(8, 18);
      ctx.lineTo(10, 17);
      ctx.lineTo(7, 11);
      ctx.lineTo(12, 11);
      ctx.closePath();

      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.9;
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 1;
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  }

  // ── Scanlines ─────────────────────────────────────────────────────────────

  _drawScanlines(ctx, W, H, scanlines) {
    ctx.save();
    ctx.globalAlpha = scanlines * 0.35;
    for (let y = 0; y < H; y += 2) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, y, W, 1);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── Color tint ────────────────────────────────────────────────────────────

  _drawTint(ctx, W, H, tint) {
    ctx.save();
    ctx.globalCompositeOperation = 'color';
    ctx.globalAlpha = tint * 0.35;
    ctx.fillStyle = '#0044aa';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── Randomize ─────────────────────────────────────────────────────────────

  randomize(state, setFn) {
    // Wildly different presets each time
    const preset = Math.floor(Math.random() * 6);
    switch (preset) {
      case 0: // Pure text chaos
        setFn('cyber_density',  0.8 + Math.random() * 0.2);
        setFn('cyber_text',     0.85 + Math.random() * 0.15);
        setFn('cyber_windows',  Math.floor(Math.random() * 6));
        setFn('cyber_glitch',   Math.random() * 0.3);
        setFn('cyber_scanlines',Math.random() * 0.3);
        setFn('cyber_cursors',  Math.floor(Math.random() * 5));
        setFn('cyber_coords',   Math.random() * 0.4);
        setFn('cyber_tint',     Math.random() * 0.3);
        break;
      case 1: // Window stack city
        setFn('cyber_density',  0.5 + Math.random() * 0.4);
        setFn('cyber_text',     0.3 + Math.random() * 0.4);
        setFn('cyber_windows',  15 + Math.floor(Math.random() * 15));
        setFn('cyber_glitch',   Math.random() * 0.2);
        setFn('cyber_scanlines',Math.random() * 0.4);
        setFn('cyber_cursors',  Math.floor(Math.random() * 10));
        setFn('cyber_coords',   Math.random() * 0.6);
        setFn('cyber_tint',     Math.random() * 0.4);
        break;
      case 2: // Glitch nightmare
        setFn('cyber_density',  0.7 + Math.random() * 0.3);
        setFn('cyber_text',     0.4 + Math.random() * 0.4);
        setFn('cyber_windows',  Math.floor(Math.random() * 12));
        setFn('cyber_glitch',   0.6 + Math.random() * 0.4);
        setFn('cyber_scanlines',0.3 + Math.random() * 0.4);
        setFn('cyber_cursors',  Math.floor(Math.random() * 8));
        setFn('cyber_coords',   Math.random() * 0.5);
        setFn('cyber_tint',     0.3 + Math.random() * 0.5);
        break;
      case 3: // Coordinate/measurement hell
        setFn('cyber_density',  0.6 + Math.random() * 0.3);
        setFn('cyber_text',     0.3 + Math.random() * 0.4);
        setFn('cyber_windows',  Math.floor(Math.random() * 8));
        setFn('cyber_glitch',   Math.random() * 0.35);
        setFn('cyber_scanlines',Math.random() * 0.3);
        setFn('cyber_cursors',  Math.floor(Math.random() * 15));
        setFn('cyber_coords',   0.7 + Math.random() * 0.3);
        setFn('cyber_tint',     Math.random() * 0.25);
        break;
      case 4: // Cursor rain
        setFn('cyber_density',  0.5 + Math.random() * 0.3);
        setFn('cyber_text',     0.5 + Math.random() * 0.4);
        setFn('cyber_windows',  Math.floor(Math.random() * 10));
        setFn('cyber_glitch',   Math.random() * 0.5);
        setFn('cyber_scanlines',0.2 + Math.random() * 0.4);
        setFn('cyber_cursors',  12 + Math.floor(Math.random() * 8));
        setFn('cyber_coords',   Math.random() * 0.7);
        setFn('cyber_tint',     Math.random() * 0.4);
        break;
      default: // Everything maxed
        setFn('cyber_density',  0.7 + Math.random() * 0.3);
        setFn('cyber_text',     0.6 + Math.random() * 0.4);
        setFn('cyber_windows',  8 + Math.floor(Math.random() * 22));
        setFn('cyber_glitch',   0.3 + Math.random() * 0.5);
        setFn('cyber_scanlines',0.15 + Math.random() * 0.4);
        setFn('cyber_cursors',  5 + Math.floor(Math.random() * 15));
        setFn('cyber_coords',   0.4 + Math.random() * 0.6);
        setFn('cyber_tint',     0.1 + Math.random() * 0.4);
        break;
    }
    setFn('cyber_seed', Math.floor(Math.random() * 100));
  }
}
