import crypto from 'node:crypto';

export class ImageValidationError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ImageValidationError';
  }
}

export interface ValidatedImage {
  sanitizedBuffer: Buffer;
  mimeType: string;
  extension: string;
  sha256: string;
  fileSize: number;
  width: number;
  height: number;
}

/**
 * Validates binary image buffer to block SVG/XSS and enforce PNG, JPEG, WebP format.
 */
export function validateAndSanitizeImageBuffer(
  buffer: Buffer,
  declaredMimeType: string,
  maxSizeBytes: number,
): ValidatedImage {
  if (!buffer || buffer.length === 0) {
    throw new ImageValidationError('EMPTY_FILE', 'Tệp tải lên không có dữ liệu.');
  }

  if (buffer.length > maxSizeBytes) {
    const maxMb = Math.round(maxSizeBytes / (1024 * 1024));
    throw new ImageValidationError(
      'FILE_TOO_LARGE',
      `Kích thước tệp vượt quá giới hạn tối đa cho phép (${maxMb} MB).`,
    );
  }

  // Security check: Block disguised SVG, HTML, or script payloads
  const scanLimit = Math.min(buffer.length, 1024);
  const headText = buffer.subarray(0, scanLimit).toString('utf8').toLowerCase();
  if (
    headText.includes('<svg') ||
    headText.includes('<script') ||
    headText.includes('javascript:') ||
    headText.includes('<!doctype html') ||
    headText.includes('<html')
  ) {
    throw new ImageValidationError(
      'SECURITY_VIOLATION',
      'Tệp chứa nội dung mã lệnh hoặc định dạng SVG không an toàn bị từ chối.',
    );
  }

  // PNG magic number: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

  // JPEG magic number: FF D8 FF
  const isJpeg =
    buffer.length >= 4 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;

  // WebP magic number: 'RIFF' .... 'WEBP'
  const isWebp =
    buffer.length >= 16 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP';

  let mimeType = '';
  let extension = '';
  let width = 800;
  let height = 600;

  if (isPng) {
    mimeType = 'image/png';
    extension = 'png';
    try {
      width = buffer.readUInt32BE(16);
      height = buffer.readUInt32BE(20);
    } catch {
      width = 800;
      height = 600;
    }
  } else if (isJpeg) {
    mimeType = 'image/jpeg';
    extension = 'jpg';
    // Parse JPEG dimensions from SOF markers if possible
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      if (marker === 0xc0 || marker === 0xc2) {
        height = buffer.readUInt16BE(offset + 5);
        width = buffer.readUInt16BE(offset + 7);
        break;
      }
      const len = buffer.readUInt16BE(offset + 2);
      offset += 2 + len;
    }
  } else if (isWebp) {
    mimeType = 'image/webp';
    extension = 'webp';
    width = 1200;
    height = 800;
  } else {
    throw new ImageValidationError(
      'INVALID_IMAGE_FORMAT',
      'Định dạng hình ảnh không hợp lệ. Chỉ chấp nhận các định dạng ảnh an toàn: PNG, JPEG, WebP.',
    );
  }

  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  return {
    sanitizedBuffer: buffer,
    mimeType,
    extension,
    sha256,
    fileSize: buffer.length,
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

