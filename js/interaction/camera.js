/**
 * Camera Input — captures webcam video and provides frames
 * as a source for the image processor.
 */

import { state, set, markDirty } from '../state.js';
import { imageProcessor } from './image-processor.js';
import { engine } from '../engine.js';

let video = null;
let stream = null;
let active = false;

/** Start the camera */
export async function startCamera() {
  if (active) return true;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });

    video = document.createElement('video');
    video.srcObject = stream;
    video.playsInline = true;
    video.muted = true;
    await video.play();

    // Feed video to the image processor
    imageProcessor.setVideoSource(video);
    // Feed video to the world camera for pixel analysis
    engine.world.camera.setVideo(video);
    active = true;
    set('cameraActive', true);
    markDirty();
    return true;
  } catch (e) {
    console.error('[Camera] Failed to start:', e);
    return false;
  }
}

/** Stop the camera */
export function stopCamera() {
  if (!active) return;

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  if (video) {
    video.pause();
    video.srcObject = null;
    video = null;
  }

  active = false;
  set('cameraActive', false);

  // Clear world camera
  engine.world.camera.clearVideo();

  // Clear image processor source only if it was using camera
  if (imageProcessor._sourceType === 'video') {
    imageProcessor.clear();
  }
  markDirty();
}

/** Toggle camera on/off */
export async function toggleCamera() {
  if (active) {
    stopCamera();
    return false;
  } else {
    return await startCamera();
  }
}

/** Check if camera is active */
export function isCameraActive() {
  return active;
}

/** Get the video element (for direct texture use) */
export function getVideo() {
  return video;
}
