import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ATTACHMENT_LIMITS,
  getExtension,
  sanitizeFileName,
  sanitizeFolderPath,
  validateAttachmentFile,
  validateBatchLimits,
  type IncomingFile,
} from "../attachment.validation";

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);
const PDF = Uint8Array.from(Array.from("%PDF-1.7\n....", (c) => c.charCodeAt(0)));
const EXE = Uint8Array.from([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0, 0xff, 0xff, 0, 0]); // "MZ"
const ZIPISH = Uint8Array.from([0x50, 0x4b, 3, 4, 0x14, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0]);
const DWG = Uint8Array.from(Array.from("AC1032\0\0\0\0\0\0\0\0\0\0", (c) => c.charCodeAt(0)));

function file(over: Partial<IncomingFile>): IncomingFile {
  return {
    originalName: "hien-trang.jpg",
    folderPath: "",
    mimeType: "image/jpeg",
    size: 1024,
    header: JPEG,
    ...over,
  };
}

test("tệp ảnh hợp lệ", () => {
  const r = validateAttachmentFile(file({}));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.kind, "IMAGE");
    assert.equal(r.value.extension, "jpg");
    assert.equal(r.value.folderPath, "");
  }
});

test("PDF, PNG, DWG, docx hợp lệ", () => {
  assert.equal(validateAttachmentFile(file({ originalName: "a.pdf", mimeType: "application/pdf", header: PDF })).ok, true);
  assert.equal(validateAttachmentFile(file({ originalName: "a.png", mimeType: "image/png", header: PNG })).ok, true);
  const dwg = validateAttachmentFile(file({ originalName: "ban-ve.dwg", mimeType: "application/octet-stream", header: DWG }));
  assert.equal(dwg.ok, true);
  if (dwg.ok) assert.equal(dwg.value.kind, "DRAWING");
  const docx = validateAttachmentFile(
    file({
      originalName: "ho-so.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      header: ZIPISH,
    })
  );
  assert.equal(docx.ok, true);
});

test("từ chối phần mở rộng nguy hiểm: exe, js, html, svg, php, zip, sh", () => {
  for (const name of ["virus.exe", "a.js", "a.html", "a.svg", "a.php", "a.zip", "a.sh", "a.bat", "noext"]) {
    const r = validateAttachmentFile(file({ originalName: name, mimeType: "application/octet-stream" }));
    assert.equal(r.ok, false, name);
    if (!r.ok) assert.equal(r.code, "EXTENSION_NOT_ALLOWED", name);
  }
});

test("từ chối tệp đổi đuôi: exe đặt tên .jpg bị bắt bằng chữ ký đầu tệp", () => {
  const r = validateAttachmentFile(file({ originalName: "anh.jpg", mimeType: "image/jpeg", header: EXE }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "CONTENT_MISMATCH");
});

test("từ chối phần mở rộng kép: shell.php.jpg có nội dung không phải ảnh", () => {
  const r = validateAttachmentFile(file({ originalName: "shell.php.jpg", header: Uint8Array.from(Array.from("<?php echo 1; ?>....", (c) => c.charCodeAt(0))) }));
  assert.equal(r.ok, false);
});

test("MIME không khớp phần mở rộng", () => {
  const r = validateAttachmentFile(file({ originalName: "a.jpg", mimeType: "application/pdf" }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "MIME_MISMATCH");
});

test("tệp rỗng và quá lớn", () => {
  const empty = validateAttachmentFile(file({ size: 0 }));
  assert.equal(!empty.ok && empty.code, "EMPTY_FILE");
  const big = validateAttachmentFile(file({ size: DEFAULT_ATTACHMENT_LIMITS.maxFileBytes + 1 }));
  assert.equal(!big.ok && big.code, "FILE_TOO_LARGE");
  const nan = validateAttachmentFile(file({ size: Number.NaN }));
  assert.equal(!nan.ok && nan.code, "EMPTY_FILE");
});

test("làm sạch tên tệp: bỏ đường dẫn, từ chối ký tự điều khiển và tên quá dài", () => {
  const a = sanitizeFileName("C:\\Users\\x\\anh.jpg");
  assert.equal(a.ok && a.value, "anh.jpg");
  const b = sanitizeFileName("../../etc/passwd");
  assert.equal(b.ok && b.value, "passwd");
  assert.equal(sanitizeFileName("a" + String.fromCharCode(0) + "b.jpg").ok, false);
  assert.equal(sanitizeFileName("..").ok, false);
  assert.equal(sanitizeFileName("").ok, false);
  assert.equal(sanitizeFileName("a".repeat(200) + ".jpg").ok, false);
});

test("đường dẫn thư mục: giữ cấu trúc, chặn .., tuyệt đối, ổ đĩa, quá sâu", () => {
  const ok = sanitizeFolderPath("Anh hien trang\\Tang 1/Phong A");
  assert.equal(ok.ok && ok.value, "Anh hien trang/Tang 1/Phong A");
  assert.equal(sanitizeFolderPath("").ok, true);
  assert.equal(sanitizeFolderPath(undefined).ok, true);
  for (const bad of ["../x", "a/../../x", "/etc", "\\\\server\\share", "C:\\Windows", "a/./b"]) {
    assert.equal(sanitizeFolderPath(bad).ok, false, bad);
  }
  assert.equal(sanitizeFolderPath("1/2/3/4/5/6/7/8/9").ok, false);
  assert.equal(sanitizeFolderPath("a" + String.fromCharCode(0) + "b").ok, false);
});

test("đường dẫn thư mục được chuẩn hóa dấu gạch và khoảng trắng thừa", () => {
  const r = sanitizeFolderPath("a//b/ c ");
  assert.equal(r.ok && r.value, "a/b/c");
});

test("giới hạn cả lần tải", () => {
  const many = Array.from({ length: DEFAULT_ATTACHMENT_LIMITS.maxFilesPerBatch + 1 }, () => ({ size: 1 }));
  const r1 = validateBatchLimits(many);
  assert.equal(!r1.ok && r1.code, "TOO_MANY_FILES");
  const r2 = validateBatchLimits([{ size: DEFAULT_ATTACHMENT_LIMITS.maxBatchBytes }, { size: 1 }]);
  assert.equal(!r2.ok && r2.code, "BATCH_TOO_LARGE");
  assert.equal(validateBatchLimits([{ size: 10 }]).ok, true);
});

test("lấy phần mở rộng", () => {
  assert.equal(getExtension("A.JPG"), "jpg");
  assert.equal(getExtension("a.tar.gz"), "gz");
  assert.equal(getExtension(".hidden"), "");
  assert.equal(getExtension("a."), "");
});
