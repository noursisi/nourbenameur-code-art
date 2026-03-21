/**
 * Video recording — captures the canvas stream and downloads as mp4/webm.
 */

let recorder = null;
let chunks   = [];
let timer    = null;

export function startRecording(canvas, duration, state, onStart, onStop) {
  const stream = canvas.captureStream(30);

  // Try formats in order of preference
  const mimeTypes = [
    'video/mp4',
    'video/webm;codecs=h264',
    'video/webm;codecs=vp9',
    'video/webm',
  ];
  let chosenMime = '';
  for (const mt of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mt)) { chosenMime = mt; break; }
  }
  if (!chosenMime) {
    alert('Video recording is not supported in this browser.');
    return;
  }

  const ext = chosenMime.startsWith('video/mp4') ? 'mp4' : 'webm';
  recorder = new MediaRecorder(stream, { mimeType: chosenMime, videoBitsPerSecond: 12000000 });
  chunks = [];

  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: chosenMime });
    const link = document.createElement('a');
    link.download = `code-art-${state.algo}-${Date.now()}.${ext}`;
    link.href = URL.createObjectURL(blob);
    link.click();
    if (onStop) onStop();
  };

  // Ensure animation is playing while recording
  if (!state.playing) { state.playing = true; }

  recorder.start();
  if (onStart) onStart();

  timer = setTimeout(() => stopRecording(), duration * 1000);
}

export function stopRecording() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (recorder && recorder.state === 'recording') recorder.stop();
  recorder = null;
}

export function isRecording() {
  return recorder && recorder.state === 'recording';
}
