import { blobToDataUrl, imageFileToDataUrl } from './images';

describe('images', () => {
  test('imageFileToDataUrl rejects non-image files', async () => {
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    await expect(imageFileToDataUrl(file)).rejects.toThrow(/look like an image|choose a photo/i);
  });

  test('blobToDataUrl resolves a data url', async () => {
    const originalFileReader = global.FileReader;

    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      readAsDataURL() {
        this.result = 'data:text/plain;base64,aGVsbG8=';
        this.onload?.();
      }
    }

    (global as any).FileReader = MockFileReader;
    await expect(blobToDataUrl(new Blob(['hello'], { type: 'text/plain' }))).resolves.toBe(
      'data:text/plain;base64,aGVsbG8='
    );
    global.FileReader = originalFileReader;
  });
});
