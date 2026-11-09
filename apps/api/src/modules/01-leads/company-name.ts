/**
 * Chuẩn hóa tên công ty và tên dự án để kiểm tra trùng (UC01 - E0).
 *
 * Quy tắc theo đặc tả: bỏ dấu, bỏ khoảng trắng, không phân biệt hoa thường,
 * bỏ dấu câu và bỏ tiền tố loại hình công ty.
 */

/** Bỏ dấu tiếng Việt (kể cả chữ đ/Đ). */
export function removeDiacritics(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D");
}

/** Chữ thường, bỏ dấu, mọi ký tự không phải chữ/số thành một dấu cách. */
function toTokens(input: string): string {
  return removeDiacritics(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Tiền tố loại hình công ty (đã ở dạng không dấu, viết thường).
 * Sắp xếp từ dài đến ngắn để tiền tố dài được thử trước.
 */
const COMPANY_TYPE_PREFIXES: readonly string[] = [
  "cong ty trach nhiem huu han mot thanh vien",
  "cong ty tnhh mot thanh vien",
  "cong ty trach nhiem huu han",
  "cong ty tnhh mtv",
  "cong ty tnhh",
  "cong ty co phan",
  "cong ty cp",
  "cong ty",
  "cty trach nhiem huu han",
  "cty tnhh mtv",
  "cty tnhh",
  "cty co phan",
  "cty cp",
  "cty",
  "tnhh mot thanh vien",
  "tnhh mtv",
  "tnhh",
  "ctcp",
  "co phan",
  "doanh nghiep tu nhan",
  "dntn",
  "hop tac xa",
  "htx",
].sort((a, b) => b.length - a.length);

function stripCompanyTypePrefix(tokens: string): string {
  let current = tokens;
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of COMPANY_TYPE_PREFIXES) {
      if (current.startsWith(prefix + " ")) {
        current = current.slice(prefix.length + 1).trim();
        changed = true;
        break;
      }
    }
  }
  // Chỉ còn lại loại hình công ty, không có tên riêng để so khớp.
  if (COMPANY_TYPE_PREFIXES.includes(current)) return "";
  return current;
}

/**
 * Khóa so khớp của tên công ty. Trả về null nếu rỗng sau khi chuẩn hóa
 * (để các Lead không có tên công ty không bị coi là trùng nhau).
 */
export function buildCompanyKey(name: string | null | undefined): string | null {
  if (typeof name !== "string") return null;
  const tokens = stripCompanyTypePrefix(toTokens(name));
  const key = tokens.replace(/\s+/g, "");
  return key.length > 0 ? key : null;
}

/** Khóa so khớp của tên dự án (không bỏ tiền tố, chỉ chuẩn hóa chuỗi). */
export function buildProjectKey(name: string | null | undefined): string | null {
  if (typeof name !== "string") return null;
  const key = toTokens(name).replace(/\s+/g, "");
  return key.length > 0 ? key : null;
}

export interface LeadKeys {
  companyKey: string | null;
  projectKey: string | null;
}

/** Tính cả hai khóa; dùng khi tạo hoặc sửa Lead để lưu vào cơ sở dữ liệu. */
export function buildLeadKeys(input: {
  companyName?: string | null;
  projectName?: string | null;
}): LeadKeys {
  return {
    companyKey: buildCompanyKey(input.companyName),
    projectKey: buildProjectKey(input.projectName),
  };
}

/**
 * Cắt khoảng trắng; chuỗi rỗng trả về undefined thay vì "".
 * Task 1 nên dùng hàm này cho companyName, projectName, installationAddress.
 */
export function toOptionalText(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Chuẩn hóa email để so khớp (cắt khoảng trắng, chữ thường). */
export function normalizeEmail(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length > 0 ? email : null;
}
