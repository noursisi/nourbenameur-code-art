/**
 * Camera Intelligence — Tier 1 + 2 + 3.
 * Tier 1: pixel analysis (brightness, color, edge, motion)
 * Tier 2: body understanding via MediaPipe (pose, hands)
 * Tier 3: derived intelligence (velocity, gesture detection)
 */

// MediaPipe CDN config
const MP_VERSION = '0.10.18';
const MP_CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const MP_WASM = `${MP_CDN}/wasm`;
const MP_HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';
const MP_POSE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

export class Camera {
  constructor(engine) {
    this.engine = engine;
    this._video = null;
    this._canvas = document.createElement('canvas');
    this._ctx = this._canvas.getContext('2d', { willReadFrequently: true });
    this._pixels = null;
    this._prevPixels = null;
    this._width = 0;
    this._height = 0;
    this._active = false;

    // Edge detection (downscaled for performance)
    this._edgeData = null;
    this._edgeW = 0;
    this._edgeH = 0;
    this._edgeCanvas = null;
    this._edgeCtx = null;
    this._analysisScale = 0.25;

    // ── Tier 2: MediaPipe ──
    this._handLandmarker = null;
    this._poseLandmarker = null;
    this._mpLoading = false;
    this._mpReady = false;
    this._lastDetectTime = 0;
    this._detectInterval = 66; // ~15fps
    this._detectHands = true;  // alternate hand/pose each detect frame

    // Tier 2 results (normalized 0-1 coords, mirrored to match video)
    this.hands = [];       // array of hands, each { landmarks: [{x,y,z,visibility}...21], handedness: 'Left'|'Right' }
    this.pose = null;      // { landmarks: [{x,y,z,visibility}...33] } or null

    // ── Tier 3: Derived ──
    this._prevHands = [];
    this._prevPose = null;
    this.handVelocity = []; // per hand: { x, y, speed } (normalized units per second)
    this.poseVelocity = []; // per landmark: { x, y, speed }
    this.presence = 0;      // 0-1, how much of frame has a person
  }

  get active() { return this._active && this._video && !this._video.paused; }

  setVideo(video) {
    this._video = video;
    this._active = !!video;
    // Start loading MediaPipe when camera activates
    if (video && !this._mpReady && !this._mpLoading) {
      this._loadMediaPipe();
    }
  }

  clearVideo() {
    this._video = null;
    this._active = false;
    this._pixels = null;
    this._prevPixels = null;
    this.hands = [];
    this.pose = null;
    this.handVelocity = [];
    this.poseVelocity = [];
    this.presence = 0;
  }

  /** Load MediaPipe hand + pose landmarkers from CDN */
  async _loadMediaPipe() {
    if (this._mpLoading || this._mpReady) return;
    this._mpLoading = true;
    console.log('[Camera] Loading MediaPipe...');
    try {
      const { FilesetResolver, HandLandmarker, PoseLandmarker } =
        await import(/* webpackIgnore: true */ `${MP_CDN}/vision_bundle.mjs`);

      const vision = await FilesetResolver.forVisionTasks(MP_WASM);

      this._handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MP_HAND_MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: 2,
      });

      this._poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MP_POSE_MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
      });

      this._mpReady = true;
      this._mpLoading = false;
      console.log('[Camera] MediaPipe ready');
    } catch (e) {
      console.error('[Camera] MediaPipe failed to load:', e);
      this._mpLoading = false;
    }
  }

  update() {
    if (!this.active) return;
    const v = this._video;
    const w = v.videoWidth;
    const h = v.videoHeight;
    if (w === 0 || h === 0) return;

    if (this._width !== w || this._height !== h) {
      this._width = w;
      this._height = h;
      this._canvas.width = w;
      this._canvas.height = h;
    }

    this._prevPixels = this._pixels;
    // Mirror horizontally so webcam feels like a mirror (left=left)
    this._ctx.save();
    this._ctx.translate(w, 0);
    this._ctx.scale(-1, 1);
    this._ctx.drawImage(v, 0, 0, w, h);
    this._ctx.restore();
    this._pixels = this._ctx.getImageData(0, 0, w, h);
    this._computeEdges();

    // ── Tier 2: MediaPipe detection (throttled to ~15fps, alternating) ──
    if (this._mpReady) {
      const now = performance.now();
      if (now - this._lastDetectTime >= this._detectInterval) {
        this._runDetection(now);
        this._lastDetectTime = now;
      }
    }
  }

  /** Run MediaPipe detection — alternates hand/pose each call */
  _runDetection(timestamp) {
    if (!this._video || this._video.videoWidth === 0) return;
    try {
      if (this._detectHands && this._handLandmarker) {
        const result = this._handLandmarker.detectForVideo(this._video, timestamp);
        this._prevHands = this.hands;
        this.hands = (result.landmarks || []).map((lm, i) => ({
          landmarks: lm.map(p => ({
            // Mirror X to match our mirrored video capture
            x: 1 - p.x, y: p.y, z: p.z, visibility: p.visibility ?? 1,
          })),
          handedness: result.handedness?.[i]?.[0]?.categoryName || 'Unknown',
        }));
      } else if (this._poseLandmarker) {
        const result = this._poseLandmarker.detectForVideo(this._video, timestamp);
        this._prevPose = this.pose;
        if (result.landmarks && result.landmarks.length > 0) {
          this.pose = {
            landmarks: result.landmarks[0].map(p => ({
              x: 1 - p.x, y: p.y, z: p.z, visibility: p.visibility ?? 1,
            })),
          };
          // Compute presence from pose bounding box
          const xs = this.pose.landmarks.map(l => l.x);
          const ys = this.pose.landmarks.map(l => l.y);
          const bboxArea = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
          this.presence = Math.min(1, bboxArea * 4); // scale up, clamp
        } else {
          this.pose = null;
          this.presence = 0;
        }
      }
      this._detectHands = !this._detectHands;

      // ── Tier 3: Compute velocities ──
      this._computeVelocities();
    } catch (e) {
      // Detection can fail if video frame isn't ready
    }
  }

  /** Compute hand and pose velocities from frame-to-frame changes */
  _computeVelocities() {
    const dt = this._detectInterval / 1000; // seconds between detections

    // Hand velocity (wrist position change)
    this.handVelocity = this.hands.map((hand, i) => {
      const prev = this._prevHands[i];
      if (!prev) return { x: 0, y: 0, speed: 0 };
      // Use wrist (landmark 0) for overall hand velocity
      const dx = hand.landmarks[0].x - prev.landmarks[0].x;
      const dy = hand.landmarks[0].y - prev.landmarks[0].y;
      return {
        x: dx / dt,
        y: dy / dt,
        speed: Math.sqrt(dx * dx + dy * dy) / dt,
      };
    });

    // Pose velocity (per-landmark)
    if (this.pose && this._prevPose) {
      this.poseVelocity = this.pose.landmarks.map((lm, i) => {
        const prev = this._prevPose.landmarks[i];
        if (!prev) return { x: 0, y: 0, speed: 0 };
        const dx = lm.x - prev.x;
        const dy = lm.y - prev.y;
        return {
          x: dx / dt,
          y: dy / dt,
          speed: Math.sqrt(dx * dx + dy * dy) / dt,
        };
      });
    } else {
      this.poseVelocity = [];
    }
  }

  get pixels() { return this._pixels; }

  brightness(nx, ny) {
    if (!this._pixels) return 0;
    const idx = this._sampleIndex(nx, ny);
    if (idx < 0) return 0;
    const d = this._pixels.data;
    return (d[idx] * 0.299 + d[idx + 1] * 0.587 + d[idx + 2] * 0.114) / 255;
  }

  color(nx, ny) {
    if (!this._pixels) return { r: 0, g: 0, b: 0 };
    const idx = this._sampleIndex(nx, ny);
    if (idx < 0) return { r: 0, g: 0, b: 0 };
    const d = this._pixels.data;
    return { r: d[idx], g: d[idx + 1], b: d[idx + 2] };
  }

  edge(nx, ny) {
    if (!this._edgeData) return 0;
    const x = Math.floor(nx * (this._edgeW - 1));
    const y = Math.floor(ny * (this._edgeH - 1));
    if (x < 0 || x >= this._edgeW || y < 0 || y >= this._edgeH) return 0;
    return this._edgeData[y * this._edgeW + x];
  }

  motion(nx, ny) {
    if (!this._pixels || !this._prevPixels) return 0;
    const idx = this._sampleIndex(nx, ny);
    if (idx < 0) return 0;
    const d = this._pixels.data;
    const p = this._prevPixels.data;
    const dr = Math.abs(d[idx] - p[idx]);
    const dg = Math.abs(d[idx + 1] - p[idx + 1]);
    const db = Math.abs(d[idx + 2] - p[idx + 2]);
    return (dr + dg + db) / (255 * 3);
  }

  toVideo(worldX, worldY, space) {
    if (!space) return { x: 0.5, y: 0.5 };
    const screen = space.toScreen(worldX, worldY);
    return { x: screen.x / space.W, y: screen.y / space.H };
  }

  toWorld(videoX, videoY, space) {
    if (!space) return { x: 0, y: 0 };
    return space.toWorld(videoX * space.W, videoY * space.H);
  }

  _sampleIndex(nx, ny) {
    if (!this._pixels) return -1;
    const x = Math.floor(Math.max(0, Math.min(1, nx)) * (this._width - 1));
    const y = Math.floor(Math.max(0, Math.min(1, ny)) * (this._height - 1));
    return (y * this._width + x) * 4;
  }

  _computeEdges() {
    if (!this._pixels) return;
    const w = Math.floor(this._width * this._analysisScale);
    const h = Math.floor(this._height * this._analysisScale);
    if (w < 3 || h < 3) return;

    this._edgeW = w;
    this._edgeH = h;

    if (!this._edgeCanvas) {
      this._edgeCanvas = document.createElement('canvas');
      this._edgeCtx = this._edgeCanvas.getContext('2d', { willReadFrequently: true });
    }
    this._edgeCanvas.width = w;
    this._edgeCanvas.height = h;
    // Mirror to match main capture
    this._edgeCtx.save();
    this._edgeCtx.translate(w, 0);
    this._edgeCtx.scale(-1, 1);
    this._edgeCtx.drawImage(this._video, 0, 0, w, h);
    this._edgeCtx.restore();
    const small = this._edgeCtx.getImageData(0, 0, w, h).data;

    if (!this._edgeData || this._edgeData.length !== w * h) {
      this._edgeData = new Float32Array(w * h);
    }

    const gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      gray[i] = (small[idx] * 0.299 + small[idx + 1] * 0.587 + small[idx + 2] * 0.114) / 255;
    }

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const tl = gray[(y-1)*w+(x-1)], t = gray[(y-1)*w+x], tr = gray[(y-1)*w+(x+1)];
        const l = gray[y*w+(x-1)], r = gray[y*w+(x+1)];
        const bl = gray[(y+1)*w+(x-1)], b = gray[(y+1)*w+x], br = gray[(y+1)*w+(x+1)];
        const gx = -tl - 2*l - bl + tr + 2*r + br;
        const gy = -tl - 2*t - tr + bl + 2*b + br;
        this._edgeData[y * w + x] = Math.min(1, Math.sqrt(gx*gx + gy*gy));
      }
    }
  }
}
