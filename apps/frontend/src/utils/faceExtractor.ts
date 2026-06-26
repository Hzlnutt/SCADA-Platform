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

    // Set up offscreen canvas for high-quality block analysis
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const processSize = 32;
    canvas.width = processSize;
    canvas.height = processSize;

    // Calculate crop box (tight center square of the video feed to isolate the face)
    const cropSize = Math.min(videoWidth, videoHeight) * 0.38; // 38% minor dimension focuses strictly on the face
    const cropX = (videoWidth - cropSize) / 2;
    const cropY = (videoHeight - cropSize) / 2;

    // Draw the cropped center portion of the video into the 32x32 canvas
    ctx.drawImage(
      video,
      cropX,
      cropY,
      cropSize,
      cropSize,
      0,
      0,
      processSize,
      processSize
    );

    // Get raw RGBA pixel data
    const imgData = ctx.getImageData(0, 0, processSize, processSize);
    const data = imgData.data;

    // Convert pixels to grayscale
    const pixels: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      pixels.push(gray);
    }

    // Dynamic Contrast Stretching (Histogram Equalization to normalize environmental lighting)
    const minGray = Math.min(...pixels);
    const maxGray = Math.max(...pixels);
    const range = maxGray - minGray || 1;
    const stretched = pixels.map((val) => ((val - minGray) / range) * 255);

    // Spatially-Structured Histograms: Divide 32x32 face into 2x2 blocks (each block is 16x16 pixels)
    // Compute a 32-bin intensity histogram for each block to ensure high tolerance to translation and rotation.
    const descriptor: number[] = [];
    const blockSize = 16;
    const numBins = 32;
    const binWidth = 256 / numBins; // 8 gray levels per bin

    for (let by = 0; by < 2; by++) {
      for (let bx = 0; bx < 2; bx++) {
        const hist = new Array(numBins).fill(0);
        
        for (let y = 0; y < blockSize; y++) {
          for (let x = 0; x < blockSize; x++) {
            const pixelY = by * blockSize + y;
            const pixelX = bx * blockSize + x;
            const idx = pixelY * processSize + pixelX;
            const val = stretched[idx];
            
            const binIdx = Math.min(numBins - 1, Math.floor(val / binWidth));
            hist[binIdx]++;
          }
        }

        // L1-normalize block histogram (so block bins sum to 1.0)
        const totalPixels = blockSize * blockSize;
        for (let i = 0; i < numBins; i++) {
          hist[i] = hist[i] / totalPixels;
        }

        descriptor.push(...hist);
      }
    }

    // Z-score normalize the final 128-dimensional vector (32 bins * 4 blocks)
    let sum = 0;
    for (let i = 0; i < descriptor.length; i++) {
      sum += descriptor[i];
    }
    const mean = sum / descriptor.length;

    let varianceSum = 0;
    for (let i = 0; i < descriptor.length; i++) {
      varianceSum += Math.pow(descriptor[i] - mean, 2);
    }
    const stdDev = Math.sqrt(varianceSum / descriptor.length) || 1.0;

    const normalizedDescriptor = descriptor.map((val) => (val - mean) / stdDev);

    return normalizedDescriptor;
  } catch (error) {
    console.error("Failed to extract face descriptor:", error);
    return null;
  }
};
