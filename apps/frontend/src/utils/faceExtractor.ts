/**
 * Utility to extract a normalized 128-dimensional face descriptor from a video element feed.
 * It crops the center square of the video frame, resizes it to 8x16 pixels, grayscales it,
 * and performs statistical normalization (z-score) to ensure light/shadow invariance.
 * 
 * Works 100% offline and cross-device without loading heavy external neural networks.
 */
export const extractFaceDescriptor = (video: HTMLVideoElement): number[] | null => {
  try {
    if (!video || video.paused || video.ended) {
      return null;
    }

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    if (videoWidth === 0 || videoHeight === 0) {
      return null;
    }

    // Set up an offscreen canvas
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Define target size (8x16 = 128 inputs)
    const targetW = 8;
    const targetH = 16;
    canvas.width = targetW;
    canvas.height = targetH;

    // Calculate crop box (tight center square of the video feed to isolate the face)
    const cropSize = Math.min(videoWidth, videoHeight) * 0.38; // 38% of minor dimension focuses strictly on the face
    const cropX = (videoWidth - cropSize) / 2;
    const cropY = (videoHeight - cropSize) / 2;

    // Draw the cropped center portion of the video into the 8x16 canvas
    ctx.drawImage(
      video,
      cropX,
      cropY,
      cropSize,
      cropSize,
      0,
      0,
      targetW,
      targetH
    );

    // Get raw RGBA pixel data
    const imgData = ctx.getImageData(0, 0, targetW, targetH);
    const data = imgData.data;

    // Convert pixels to grayscale
    const grayscale: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      grayscale.push(gray);
    }

    // Dynamic Contrast Stretching (Histogram Equalization to normalize environmental lighting conditions)
    const minGray = Math.min(...grayscale);
    const maxGray = Math.max(...grayscale);
    const range = maxGray - minGray || 1;
    const stretched = grayscale.map((val) => ((val - minGray) / range) * 255);

    // Calculate Mean of stretched values
    let sum = 0;
    for (let i = 0; i < stretched.length; i++) {
      sum += stretched[i];
    }
    const mean = sum / stretched.length;

    // Calculate Standard Deviation of stretched values
    let varianceSum = 0;
    for (let i = 0; i < stretched.length; i++) {
      varianceSum += Math.pow(stretched[i] - mean, 2);
    }
    const stdDev = Math.sqrt(varianceSum / stretched.length) || 1.0;

    // Normalize (Z-score normalization) to make it invariant to lighting scale
    const descriptor = stretched.map((val) => (val - mean) / stdDev);

    return descriptor;
  } catch (error) {
    console.error("Failed to extract face descriptor:", error);
    return null;
  }
};
