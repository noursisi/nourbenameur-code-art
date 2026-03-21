/**
 * Data Topology — visualize mathematical constants as visual structure.
 * Maps digits of pi, e, sqrt(2), primes, fibonacci to geometric forms.
 */

import { Algorithm } from '../base.js';

// First 1000 digits of pi (after 3.)
const PI_DIGITS = '3141592653589793238462643383279502884197169399375105820974944592307816406286208998628034825342117067982148086513282306647093844609550582231725359408128481117450284102701938521105559644622948954930381964428810975665933446128475648233786783165271201909145648566923460348610454326648213393607260249141273724587006606315588174881520920962829254091715364367892590360011330530548820466521384146951941511609433057270365759591953092186117381932611793105118548074462379962749567351885752724891227938183011949129833673362440656643086021394946395224737190702179860943702770539217176293176752384674818467669405132000568127145263560827785771342757789609173637178721468440901224953430146549585371050792279689258923542019956112129021960864034418159813629774771309960518707211349999998372978049951059731732816096318595024459455346908302642522308253344685035261931188171010003137838752886587533208381420617177669147303598253490428755468731159562863882353787593751957781857780532171226806613001927876611195909216420199';

const E_DIGITS = '2718281828459045235360287471352662497757247093699959574966967627724076630353547594571382178525166427427466391932003059921817413596629043572900334295260595630738132328627943490763233829880753195251019011573834187930702154089149934884167509244761460668082264800168477411853742345442437107539077744992069551702761838606261331384583000752044933826560297606737113200709328709127443747047230696977209310141692836819025515108657463772111252389784425056953696770785449969967946864454905987931636889230098793127736178215424999229576351482208269895193668033182528869398496465105820939239829488793320362509443117301238197068416140397019837679320683282376464804295311802328782509819455815301756717361332069811250996181881593041690351598888519345807273866738589422879228499892086805825749279610484198444363463244968487560233624827041978623209002160990235304369941849146314093431738143640546253152096183690888707016768396424378140933398166223471828538433826890693637106184413515451713284390116789764677222397237640263535637913785607032326047091884623398858352008346544028023748498811765458125544';

function genPrimes(count) {
  const primes = [];
  let n = 2;
  while (primes.length < count) {
    let isPrime = true;
    for (let i = 2; i * i <= n; i++) {
      if (n % i === 0) { isPrime = false; break; }
    }
    if (isPrime) primes.push(n);
    n++;
  }
  return primes;
}

function genFibonacci(count) {
  const fib = [1, 1];
  while (fib.length < count) {
    fib.push(fib[fib.length - 1] + fib[fib.length - 2]);
  }
  return fib;
}

function genSqrt2Digits(count) {
  // Approximate via long computation — use string of precomputed first ~200 digits,
  // then pad with pseudo-random continuation for simplicity
  const sqrt2Start = '14142135623730950488016887242096980785696718753769480731766797379907324784621070388503875343276415727';
  const digits = [];
  for (let i = 0; i < Math.min(count, sqrt2Start.length); i++) {
    digits.push(parseInt(sqrt2Start[i]));
  }
  // Extend with hash-based pseudo digits for remaining
  let h = 12345;
  while (digits.length < count) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    digits.push(h % 10);
  }
  return digits;
}

function getDigits(source, count) {
  if (source === 0) { // pi
    const digits = [];
    for (let i = 0; i < Math.min(count, PI_DIGITS.length); i++) {
      digits.push(parseInt(PI_DIGITS[i]));
    }
    return digits;
  }
  if (source === 1) { // e
    const digits = [];
    for (let i = 0; i < Math.min(count, E_DIGITS.length); i++) {
      digits.push(parseInt(E_DIGITS[i]));
    }
    return digits;
  }
  if (source === 2) { // sqrt(2)
    return genSqrt2Digits(count);
  }
  if (source === 3) { // primes
    return genPrimes(count).map(p => p % 10);
  }
  // fibonacci
  return genFibonacci(count).map(f => f % 10);
}

const SOURCE_NAMES = ['pi', 'e', 'sqrt(2)', 'primes', 'fibonacci'];
const MAP_NAMES = ['spiral walk', 'grid', 'radial', 'tree'];

export class DataTopology extends Algorithm {
  get metadata() {
    return {
      name: 'Data Topology',
      eq: 'digits → geometry',
      cat: 'Data Art',
      desc: 'Maps the digits of mathematical constants (pi, e, sqrt(2), primes, fibonacci) to visual structure. The hidden patterns in numbers made visible.',
    };
  }

  get params() {
    return [
      { id: 'dt_source',      label: 'Source',       min: 0, max: 4,    step: 1 },
      { id: 'dt_mapping',     label: 'Mapping',      min: 0, max: 3,    step: 1 },
      { id: 'dt_count',       label: 'Count',        min: 100, max: 5000, step: 100 },
      { id: 'dt_elementSize', label: 'Element Size', min: 2, max: 10,   step: 1 },
    ];
  }

  get detailParam() {
    return { id: 'dt_count', min: 100, max: 5000, step: 200 };
  }

  get cursorMap() {
    return (mx, my, s) => {
      s.dt_source = Math.floor(mx * 4.99);
      s.dt_mapping = Math.floor(my * 3.99);
    };
  }

  animate(s) {
    // Static visualization — time can add subtle rotation
  }

  render(ctx, W, H, s) {
    const source = Math.max(0, Math.min(4, Math.round(s.dt_source || 0)));
    const mapping = Math.max(0, Math.min(3, Math.round(s.dt_mapping || 0)));
    const count = Math.max(100, Math.min(5000, Math.round(s.dt_count || 1000)));
    const elemSize = Math.max(2, Math.min(10, Math.round(s.dt_elementSize || 4)));
    const fg = this.engine.fg(s);
    const t = (s.time || 0) * 0.1;

    const digits = getDigits(source, count);
    const cx = W / 2;
    const cy = H / 2;

    ctx.fillStyle = fg;
    ctx.strokeStyle = fg;

    if (mapping === 0) {
      // Spiral walk — each digit determines turn angle
      let x = cx, y = cy;
      let angle = 0;
      const stepLen = elemSize * 1.5;
      ctx.lineWidth = elemSize * 0.3;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);

      for (let i = 0; i < digits.length; i++) {
        angle += (digits[i] - 4.5) * 0.7 + t * 0.01;
        x += Math.cos(angle) * stepLen;
        y += Math.sin(angle) * stepLen;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else if (mapping === 1) {
      // Grid
      const cols = Math.ceil(Math.sqrt(digits.length));
      const cellW = W / cols;
      const cellH = H / Math.ceil(digits.length / cols);
      ctx.globalAlpha = 0.7;

      for (let i = 0; i < digits.length; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const d = digits[i];
        const size = (d / 9) * elemSize + 1;
        const alpha = 0.1 + (d / 9) * 0.8;
        ctx.globalAlpha = alpha;
        ctx.fillRect(
          col * cellW + (cellW - size) / 2,
          row * cellH + (cellH - size) / 2,
          size, size
        );
      }
    } else if (mapping === 2) {
      // Radial — digits plotted in expanding spiral
      ctx.globalAlpha = 0.6;
      for (let i = 0; i < digits.length; i++) {
        const angle = i * 0.1 + t;
        const radius = Math.sqrt(i) * elemSize * 2;
        const d = digits[i];
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        const size = (d / 9) * elemSize + 1;
        ctx.globalAlpha = 0.2 + (d / 9) * 0.6;
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Tree — binary-ish tree where each digit decides branch direction
      ctx.lineWidth = elemSize * 0.3;
      ctx.globalAlpha = 0.4;

      const branches = [{ x: cx, y: H * 0.85, angle: -Math.PI / 2, depth: 0 }];
      const branchLen = Math.min(W, H) * 0.12;
      let di = 0;

      ctx.beginPath();
      while (branches.length > 0 && di < digits.length) {
        const b = branches.shift();
        if (b.depth > 8) continue;
        const d = digits[di++];
        const len = branchLen * Math.pow(0.72, b.depth);
        const spread = (d - 4.5) * 0.15;
        const nx = b.x + Math.cos(b.angle + spread) * len;
        const ny = b.y + Math.sin(b.angle + spread) * len;

        ctx.moveTo(b.x, b.y);
        ctx.lineTo(nx, ny);

        // Branch if digit is even
        if (d % 2 === 0 && b.depth < 8) {
          branches.push({ x: nx, y: ny, angle: b.angle - 0.4, depth: b.depth + 1 });
          branches.push({ x: nx, y: ny, angle: b.angle + 0.4, depth: b.depth + 1 });
        } else {
          branches.push({ x: nx, y: ny, angle: b.angle + spread, depth: b.depth + 1 });
        }
      }
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }
}
