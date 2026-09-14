/**
 * Video and contact-sheet assembly only: pure Canvas/MediaRecorder Web APIs, no SDK, no lighting math.
 * Frames are rendered slowly (simulated time, hundreds of ms each); this module replays the already
 * captured PNGs quickly, in real wall-clock time, so the resulting webm plays at a genuine 60 fps.
 */

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Bottom-up GL readback to a top-down PNG data URL. Frames are encoded eagerly so the slow capture
 *  pass never holds more than one raw pixel buffer at a time; only small PNG strings accumulate. */
export function encodeCaptureToPng(pixels: Uint8Array, width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Contexte 2D indisponible pour l’encodage PNG');
  const image = context.createImageData(width, height);
  const stride = width * 4;
  for (let y = 0; y < height; y++) image.data.set(pixels.subarray((height - y - 1) * stride, (height - y) * stride), y * stride);
  context.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  return image;
}

/**
 * Plays back an already-rendered PNG sequence at a fixed real-time cadence and records it with
 * MediaRecorder. The slow, simulated-time computation happened before this call; this pass only
 * paces `drawImage`, so a 120-frame sequence at 60 fps produces a genuine two-second video.
 */
export async function assembleWebm(frames: readonly string[], width: number, height: number, fps: number, signal: AbortSignal): Promise<Blob> {
  if (!frames.length) throw new Error('Aucune image à assembler');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Contexte 2D indisponible pour l’assemblage vidéo');
  if (typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') throw new Error('captureStream/MediaRecorder indisponibles dans ce navigateur');
  const stream = canvas.captureStream(fps);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
  const chunks: Blob[] = [];
  const stopped = new Promise<void>(resolve => recorder.addEventListener('stop', () => resolve(), { once: true }));
  recorder.addEventListener('dataavailable', event => { if (event.data.size) chunks.push(event.data); });
  try {
    recorder.start();
    const frameDurationMs = 1000 / fps;
    let due = performance.now();
    for (const dataUrl of frames) {
      signal.throwIfAborted();
      const image = await loadImage(dataUrl);
      context.drawImage(image, 0, 0, width, height);
      due += frameDurationMs;
      const wait = due - performance.now();
      if (wait > 0) await sleep(wait);
    }
  } finally {
    recorder.stop();
    await stopped;
    stream.getTracks().forEach(track => track.stop());
  }
  return new Blob(chunks, { type: mimeType });
}

export interface ContactSheetColumn {
  label: string;
  pngDataUrl: string;
}
export interface ContactSheetRow {
  label: string;
  columns: ContactSheetColumn[];
}

/** One PNG per event: rows are delays, columns are the key instants (t0-, t0, ~t0+D, end). */
export async function assembleContactSheet(rows: readonly ContactSheetRow[], width: number, height: number): Promise<Blob> {
  if (!rows.length || !rows[0].columns.length) throw new Error('Planche contact vide');
  const columnCount = rows[0].columns.length;
  const thumbWidth = 320, thumbHeight = Math.round((thumbWidth * height) / width);
  const labelHeight = 24, rowLabelWidth = 140;
  const sheetWidth = rowLabelWidth + columnCount * thumbWidth;
  const sheetHeight = labelHeight + rows.length * (thumbHeight + labelHeight);
  const canvas = document.createElement('canvas');
  canvas.width = sheetWidth;
  canvas.height = sheetHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Contexte 2D indisponible pour la planche contact');
  context.fillStyle = '#0b0f14';
  context.fillRect(0, 0, sheetWidth, sheetHeight);
  context.fillStyle = '#e6edf3';
  context.font = '12px monospace';
  context.textBaseline = 'top';
  for (const [columnIndex, column] of rows[0].columns.entries()) {
    context.fillText(column.label, rowLabelWidth + columnIndex * thumbWidth + 6, 4);
  }
  for (const [rowIndex, row] of rows.entries()) {
    const y = labelHeight + rowIndex * (thumbHeight + labelHeight);
    context.fillText(row.label, 6, y + 4);
    for (const [columnIndex, column] of row.columns.entries()) {
      const image = await loadImage(column.pngDataUrl);
      context.drawImage(image, rowLabelWidth + columnIndex * thumbWidth, y + labelHeight, thumbWidth, thumbHeight);
    }
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Encodage PNG de la planche contact impossible'))), 'image/png');
  });
}
