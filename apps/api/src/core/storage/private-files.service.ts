import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { APP_CONFIG } from '../config';

export interface SavePrivateFileInput {
  bucket: string;
  prefix: string;
  fileBuffer: Buffer;
  declaredMimeType: string;
  originalFileName?: string;
  allowPdfOrDoc?: boolean;
}

export interface SavedPrivateFile {
  storageObjectKey: string;
  fileSizeBytes: number;
  sha256: string;
  mimeType: string;
  storagePath: string;
  sanitizedFileName: string;
}

export interface ReadPrivateFileResult {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^\w.-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .toLowerCase();
}

function detectMimeType(buffer: Buffer, declared: string, ext: string): string {
  if (buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'application/pdf';
  }
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }

  const normalizedExt = ext.toLowerCase();
  if (normalizedExt === '.pdf') return 'application/pdf';
  if (normalizedExt === '.png') return 'image/png';
  if (normalizedExt === '.jpg' || normalizedExt === '.jpeg') return 'image/jpeg';
  if (normalizedExt === '.webp') return 'image/webp';
  if (normalizedExt === '.doc') return 'application/msword';
  if (normalizedExt === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (normalizedExt === '.xls') return 'application/vnd.ms-excel';
  if (normalizedExt === '.xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  return declared || 'application/octet-stream';
}

export function savePrivateBusinessFile(input: SavePrivateFileInput): SavedPrivateFile {
  if (!input.fileBuffer || input.fileBuffer.length === 0) {
    throw new Error('Tệp tải lên không được rỗng.');
  }

  if (input.fileBuffer.length > APP_CONFIG.maxAttachmentSizeBytes) {
    throw new Error(`Kích thước tệp vượt quá giới hạn tối đa (${APP_CONFIG.maxAttachmentSizeBytes / (1024 * 1024)} MB).`);
  }

  const rawExt = input.originalFileName ? path.extname(input.originalFileName) : '.png';
  const baseName = input.originalFileName ? path.basename(input.originalFileName, rawExt) : 'file';
  const cleanExt = rawExt.toLowerCase() || '.bin';
  const cleanBase = sanitizeFileName(baseName);
  const sanitizedFileName = `${cleanBase}${cleanExt}`;

  const mimeType = detectMimeType(input.fileBuffer, input.declaredMimeType, cleanExt);
  const sha256 = crypto.createHash('sha256').update(input.fileBuffer).digest('hex');

  const safeBucket = sanitizeFileName(input.bucket || 'general');
  const safePrefix = sanitizeFileName(input.prefix || 'upload');
  const randomSuffix = crypto.randomUUID().slice(0, 8);
  const objectFileName = `${safePrefix}-${randomSuffix}-${sha256.slice(0, 8)}${cleanExt}`;
  const storageObjectKey = `${safeBucket}/${objectFileName}`;

  const bucketDir = path.join(APP_CONFIG.getStorageRoot(), safeBucket);
  fs.mkdirSync(bucketDir, { recursive: true });

  const storagePath = path.join(bucketDir, objectFileName);
  fs.writeFileSync(storagePath, input.fileBuffer);

  return {
    storageObjectKey,
    fileSizeBytes: input.fileBuffer.length,
    sha256,
    mimeType,
    storagePath,
    sanitizedFileName,
  };
}

export function readPrivateBusinessFile(storageObjectKeyOrPath: string): ReadPrivateFileResult | null {
  if (!storageObjectKeyOrPath) return null;

  // Prevent path traversal
  const normalizedKey = storageObjectKeyOrPath.replace(/\\/g, '/');
  if (normalizedKey.includes('../') || normalizedKey.includes('/..')) {
    return null;
  }

  let fullPath = path.resolve(APP_CONFIG.getStorageRoot(), normalizedKey);
  if (!fs.existsSync(fullPath)) {
    // Check if filename only
    const base = path.basename(normalizedKey);
    const candidateBuckets = ['leads', 'design', 'avatars', 'branding'];
    let found = false;
    for (const b of candidateBuckets) {
      const p = path.join(APP_CONFIG.getStorageRoot(), b, base);
      if (fs.existsSync(p)) {
        fullPath = p;
        found = true;
        break;
      }
    }
    if (!found) return null;
  }

  try {
    const buffer = fs.readFileSync(fullPath);
    const ext = path.extname(fullPath);
    const mimeType = detectMimeType(buffer, '', ext);
    const fileName = path.basename(fullPath);
    return {
      buffer,
      mimeType,
      fileName,
    };
  } catch {
    return null;
  }
}

