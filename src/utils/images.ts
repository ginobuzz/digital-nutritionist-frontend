export type ImageDataUrlOptions = {
  maxDimension?: number;
  mimeType?: string;
  quality?: number;
};

const DEFAULT_OPTIONS: Required<ImageDataUrlOptions> = {
  maxDimension: 1024,
  mimeType: 'image/jpeg',
  quality: 0.85,
};

export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read file.'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string' && result) resolve(result);
      else reject(new Error('Unable to read file.'));
    };
    reader.readAsDataURL(blob);
  });

const loadImageElement = (file: File): Promise<{ img: HTMLImageElement; objectUrl: string }> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, objectUrl });
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Unable to decode image.'));
    };
    img.src = objectUrl;
  });

export const imageFileToDataUrl = async (file: File, options?: ImageDataUrlOptions): Promise<string> => {
  const { maxDimension, mimeType, quality } = { ...DEFAULT_OPTIONS, ...(options ?? {}) };

  if (!file.type.startsWith('image/')) {
    throw new Error('Selected file is not an image.');
  }

  try {
    const { img, objectUrl } = await loadImageElement(file);
    try {
      // Some browsers support `decode()` which avoids layout thrash.
      await (img.decode?.() ?? Promise.resolve());
    } catch {
      // Ignore decode errors; onload already fired.
    }

    const srcWidth = img.naturalWidth || img.width;
    const srcHeight = img.naturalHeight || img.height;
    const scale = Math.min(1, maxDimension / Math.max(srcWidth, srcHeight));
    const targetWidth = Math.max(1, Math.round(srcWidth * scale));
    const targetHeight = Math.max(1, Math.round(srcHeight * scale));

    // If we don't need to resize and we can keep the original data url, do so.
    if (scale === 1 && (!mimeType || mimeType === file.type)) {
      URL.revokeObjectURL(objectUrl);
      return await blobToDataUrl(file);
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      URL.revokeObjectURL(objectUrl);
      return await blobToDataUrl(file);
    }

    // Ensure a solid background when exporting to JPEG.
    if (mimeType === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    const dataUrl = canvas.toDataURL(mimeType, quality);
    URL.revokeObjectURL(objectUrl);
    return dataUrl;
  } catch {
    // If resizing fails (unsupported format, etc.), fall back to the original.
    return await blobToDataUrl(file);
  }
};
