import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCompanyKey,
  buildProjectKey,
  normalizeEmail,
  removeDiacritics,
  toOptionalText,
} from "../company-name";

test("bỏ dấu tiếng Việt kể cả chữ đ", () => {
  assert.equal(removeDiacritics("Đường Nguyễn Huệ"), "Duong Nguyen Hue");
});

test("cùng một công ty viết khác nhau cho cùng khóa", () => {
  const variants = [
    "Công ty TNHH Điện Tử Viễn Thông Toàn Trung",
    "CÔNG TY TNHH ĐIỆN TỬ VIỄN THÔNG TOÀN TRUNG",
    "Cty TNHH Dien Tu Vien Thong Toan Trung",
    "  công ty   tnhh   điện tử viễn thông toàn trung  ",
    "Điện.Tử, Viễn-Thông Toàn Trung",
  ];
  const keys = new Set(variants.map(buildCompanyKey));
  assert.equal(keys.size, 1);
  assert.equal([...keys][0], "dientuvienthongtoantrung");
});

test("bỏ tiền tố loại hình: cổ phần, TNHH MTV, CTCP", () => {
  assert.equal(buildCompanyKey("Công ty Cổ phần ABC"), "abc");
  assert.equal(buildCompanyKey("CTCP ABC"), "abc");
  assert.equal(buildCompanyKey("Công ty TNHH MTV ABC"), "abc");
  assert.equal(buildCompanyKey("Công ty TNHH Một thành viên ABC"), "abc");
  assert.equal(buildCompanyKey("ABC"), "abc");
});

test("chỉ bỏ tiền tố ở đầu, không bỏ chữ nằm giữa tên", () => {
  assert.equal(buildCompanyKey("Thương mại Cty Hoàng Gia"), "thuongmaictyhoanggia");
});

test("tên chỉ gồm loại hình hoặc rỗng thì không có khóa", () => {
  assert.equal(buildCompanyKey("Công ty TNHH"), null);
  assert.equal(buildCompanyKey("   "), null);
  assert.equal(buildCompanyKey(""), null);
  assert.equal(buildCompanyKey(undefined), null);
  assert.equal(buildCompanyKey(null), null);
});

test("hai công ty khác nhau cho khóa khác nhau", () => {
  assert.notEqual(buildCompanyKey("Công ty ABC"), buildCompanyKey("Công ty ABD"));
});

test("khóa dự án: bỏ dấu, khoảng trắng, dấu câu, không bỏ tiền tố", () => {
  assert.equal(buildProjectKey("Dự án LED P2.5 - Sân khấu"), "duanledp25sankhau");
  assert.equal(buildProjectKey("  "), null);
  assert.equal(buildProjectKey(undefined), null);
});

test("chuẩn hóa email và văn bản tùy chọn", () => {
  assert.equal(normalizeEmail("  Abc@Example.COM "), "abc@example.com");
  assert.equal(normalizeEmail(""), null);
  assert.equal(toOptionalText("  x  "), "x");
  assert.equal(toOptionalText("   "), undefined);
  assert.equal(toOptionalText(undefined), undefined);
});
