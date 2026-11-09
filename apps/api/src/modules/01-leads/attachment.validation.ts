/**
 * Kiểm tra tệp đính kèm của Lead (UC01 mục 4.3, E3): ảnh hiện trạng, bản vẽ,
 * hồ sơ khách hàng; hỗ trợ tải cả thư mục và giữ nguyên cấu trúc.
 *
 * Bảo mật (hệ thống dùng dữ liệu thật của khách):
 *  - Chỉ cho phép phần mở rộng trong danh sách trắng, không chấp nhận tệp thực thi,
 *    script, SVG, HTML hay tệp nén.
 *  - Kiểm tra chữ ký đầu tệp (magic bytes), không tin vào MIME do trình duyệt gửi.
 *  - Đường dẫn thư mục được làm sạch, chặn ".." và đường dẫn tuyệt đối.
 *  - Tên lưu trên ổ đĩa do máy chủ tự sinh, không dùng tên người dùng đặt.
 */

export type AttachmentErrorCode =
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "EXTENSION_NOT_ALLOWED"
  | "MIME_MISMATCH"
  | "CONTENT_MISMATCH"
  | "INVALID_NAME"
  | "INVALID_PATH"
  | "TOO_MANY_FILES"
  | "BATCH_TOO_LARGE";

export interface AttachmentLimits {
  maxFileBytes: number;
  maxFilesPerBatch: number;
  maxBatchBytes: number;
  maxPathDepth: number;
  maxNameLength: number;
  maxPathLength: number;
}

export const DEFAULT_ATTACHMENT_LIMITS: AttachmentLimits = {
  maxFileBytes: 25 * 1024 * 1024, // 25 MB mỗi tệp
  maxFilesPerBatch: 200,
  maxBatchBytes: 200 * 1024 * 1024, // 200 MB mỗi lần tải
  maxPathDepth: 8,
  maxNameLength: 150,
  maxPathLength: 255,
};

export type AttachmentKind = "IMAGE" | "DRAWING" | "DOCUMENT";

interface TypeRule {
  kind: AttachmentKind;
  mimes: readonly string[];
  /** Hàm kiểm tra chữ ký đầu tệp; undefined nếu loại này không có chữ ký cố định. */
  signature?: (head: Uint8Array) => boolean;
}

function startsWith(head: Uint8Array, bytes: readonly number[], offset = 0): boolean {
  if (head.length < offset + bytes.length) return false;
  return bytes.every((b, i) => head[offset + i] === b);
}

function ascii(head: Uint8Array, text: string, offset = 0): boolean {
  return startsWith(
    head,
    Array.from(text, (c) => c.charCodeAt(0)),
    offset
  );
}

const isJpeg = (h: Uint8Array) => startsWith(h, [0xff, 0xd8, 0xff]);
const isPng = (h: Uint8Array) => startsWith(h, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const isGif = (h: Uint8Array) => ascii(h, "GIF87a") || ascii(h, "GIF89a");
const isWebp = (h: Uint8Array) => ascii(h, "RIFF") && ascii(h, "WEBP", 8);
const isHeic = (h: Uint8Array) => ascii(h, "ftyp", 4);
const isPdf = (h: Uint8Array) => ascii(h, "%PDF-");
const isZipBased = (h: Uint8Array) => ascii(h, "PK"); // docx, xlsx
const isOle = (h: Uint8Array) => startsWith(h, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // doc, xls
const isDwg = (h: Uint8Array) => ascii(h, "AC10");

export const ALLOWED_TYPES: Readonly<Record<string, TypeRule>> = {
  jpg: { kind: "IMAGE", mimes: ["image/jpeg"], signature: isJpeg },
  jpeg: { kind: "IMAGE", mimes: ["image/jpeg"], signature: isJpeg },
  png: { kind: "IMAGE", mimes: ["image/png"], signature: isPng },
  gif: { kind: "IMAGE", mimes: ["image/gif"], signature: isGif },
  webp: { kind: "IMAGE", mimes: ["image/webp"], signature: isWebp },
  heic: { kind: "IMAGE", mimes: ["image/heic", "image/heif"], signature: isHeic },
  heif: { kind: "IMAGE", mimes: ["image/heic", "image/heif"], signature: isHeic },
  pdf: { kind: "DOCUMENT", mimes: ["application/pdf"], signature: isPdf },
  doc: { kind: "DOCUMENT", mimes: ["application/msword"], signature: isOle },
  docx: {
    kind: "DOCUMENT",
    mimes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    signature: isZipBased,
  },
  xls: { kind: "DOCUMENT", mimes: ["application/vnd.ms-excel"], signature: isOle },
  xlsx: {
    kind: "DOCUMENT",
    mimes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    signature: isZipBased,
  },
  dwg: {
    kind: "DRAWING",
    mimes: ["application/acad", "application/x-acad", "image/vnd.dwg", "image/x-dwg"],
    signature: isDwg,
  },
  // DXF là tệp văn bản, không có chữ ký cố định.
  dxf: { kind: "DRAWING", mimes: ["application/dxf", "image/vnd.dxf", "image/x-dxf"] },
};

/** MIME chung chung mà trình duyệt hay gửi khi không nhận ra loại tệp. */
const GENERIC_MIMES = new Set(["", "application/octet-stream"]);

/** Số byte đầu tệp cần đọc để kiểm tra chữ ký. */
export const SIGNATURE_BYTES = 16;

export function getExtension(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1).toLowerCase();
}

/** Ký tự điều khiển (mã 0-31 và 127), kể cả NUL, dùng để từ chối tên/đường dẫn nguy hiểm. */
function hasControlChars(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 32 || c === 127) return true;
  }
  return false;
}

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; code: AttachmentErrorCode; message: string };

function fail<T>(code: AttachmentErrorCode, message: string): Result<T> {
  return { ok: false, code, message };
}

/** Làm sạch tên tệp (không gồm thư mục). */
export function sanitizeFileName(
  rawName: string,
  maxLength = DEFAULT_ATTACHMENT_LIMITS.maxNameLength
): Result<string> {
  if (typeof rawName !== "string") return fail("INVALID_NAME", "Tên tệp không hợp lệ");
  const base = rawName.split(/[\\/]/).pop() ?? "";
  if (hasControlChars(base)) return fail("INVALID_NAME", "Tên tệp chứa ký tự không hợp lệ");
  const name = base.normalize("NFC").trim();
  if (name === "" || name === "." || name === "..") {
    return fail("INVALID_NAME", "Tên tệp không hợp lệ");
  }
  if (name.length > maxLength) {
    return fail("INVALID_NAME", "Tên tệp quá dài (tối đa " + maxLength + " ký tự)");
  }
  return { ok: true, value: name };
}

/**
 * Làm sạch đường dẫn thư mục tương đối (phần thư mục, không gồm tên tệp).
 * Chuỗi rỗng nghĩa là tệp nằm ở gốc.
 */
export function sanitizeFolderPath(
  rawPath: string | null | undefined,
  limits: Pick<AttachmentLimits, "maxPathDepth" | "maxPathLength"> = DEFAULT_ATTACHMENT_LIMITS
): Result<string> {
  if (rawPath === null || rawPath === undefined || rawPath === "") {
    return { ok: true, value: "" };
  }
  if (typeof rawPath !== "string" || hasControlChars(rawPath)) {
    return fail("INVALID_PATH", "Đường dẫn thư mục không hợp lệ");
  }
  const unified = rawPath.replace(/\\/g, "/");
  // Đường dẫn tuyệt đối, ổ đĩa Windows hoặc UNC.
  if (unified.startsWith("/") || /^[a-zA-Z]:/.test(unified)) {
    return fail("INVALID_PATH", "Không chấp nhận đường dẫn tuyệt đối");
  }
  const segments = unified.split("/").filter((s) => s !== "");
  if (segments.length === 0) return { ok: true, value: "" };
  if (segments.length > limits.maxPathDepth) {
    return fail("INVALID_PATH", "Thư mục lồng quá sâu (tối đa " + limits.maxPathDepth + " cấp)");
  }
  const clean: string[] = [];
  for (const seg of segments) {
    const s = seg.normalize("NFC").trim();
    if (s === "" || s === "." || s === "..") {
      return fail("INVALID_PATH", "Đường dẫn chứa phần không hợp lệ");
    }
    clean.push(s);
  }
  const joined = clean.join("/");
  if (joined.length > limits.maxPathLength) {
    return fail("INVALID_PATH", "Đường dẫn quá dài");
  }
  return { ok: true, value: joined };
}

export interface IncomingFile {
  /** Tên tệp do trình duyệt gửi (có thể kèm đường dẫn khi tải thư mục). */
  originalName: string;
  /** Đường dẫn thư mục tương đối (webkitRelativePath bỏ phần tên tệp). */
  folderPath?: string | null;
  mimeType: string;
  size: number;
  /** Ít nhất SIGNATURE_BYTES byte đầu tệp. */
  header: Uint8Array;
}

export interface ValidatedFile {
  fileName: string;
  folderPath: string;
  extension: string;
  kind: AttachmentKind;
  mimeType: string;
  size: number;
}

export function validateAttachmentFile(
  file: IncomingFile,
  limits: AttachmentLimits = DEFAULT_ATTACHMENT_LIMITS
): Result<ValidatedFile> {
  const name = sanitizeFileName(file.originalName, limits.maxNameLength);
  if (!name.ok) return name;

  const folder = sanitizeFolderPath(file.folderPath, limits);
  if (!folder.ok) return folder;

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return fail("EMPTY_FILE", "Tệp rỗng");
  }
  if (file.size > limits.maxFileBytes) {
    const mb = Math.floor(limits.maxFileBytes / (1024 * 1024));
    return fail("FILE_TOO_LARGE", "Tệp vượt quá " + mb + " MB");
  }

  const ext = getExtension(name.value);
  const rule = ALLOWED_TYPES[ext];
  if (!rule) {
    return fail("EXTENSION_NOT_ALLOWED", "Loại tệp không được phép tải lên");
  }

  const mime = (file.mimeType ?? "").trim().toLowerCase();
  if (!GENERIC_MIMES.has(mime) && !rule.mimes.includes(mime)) {
    return fail("MIME_MISMATCH", "Loại nội dung không khớp với phần mở rộng tệp");
  }

  if (rule.signature && !rule.signature(file.header)) {
    return fail("CONTENT_MISMATCH", "Nội dung tệp không đúng định dạng ." + ext);
  }

  return {
    ok: true,
    value: {
      fileName: name.value,
      folderPath: folder.value,
      extension: ext,
      kind: rule.kind,
      mimeType: GENERIC_MIMES.has(mime) ? (rule.mimes[0] ?? "application/octet-stream") : mime,
      size: file.size,
    },
  };
}

/** Kiểm tra giới hạn của cả lần tải (số tệp, tổng dung lượng). */
export function validateBatchLimits(
  files: ReadonlyArray<{ size: number }>,
  limits: AttachmentLimits = DEFAULT_ATTACHMENT_LIMITS
): Result<true> {
  if (files.length > limits.maxFilesPerBatch) {
    return fail("TOO_MANY_FILES", "Mỗi lần tải tối đa " + limits.maxFilesPerBatch + " tệp");
  }
  const total = files.reduce((sum, f) => sum + (Number.isFinite(f.size) ? f.size : 0), 0);
  if (total > limits.maxBatchBytes) {
    const mb = Math.floor(limits.maxBatchBytes / (1024 * 1024));
    return fail("BATCH_TOO_LARGE", "Tổng dung lượng mỗi lần tải tối đa " + mb + " MB");
  }
  return { ok: true, value: true };
}
