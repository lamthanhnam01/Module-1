
export interface CreateLeadInput {
  phone: string;
  companyName?: string;
  projectName?: string;
  installationAddress?: string;
  productId?: number;
  leadSourceId?: number;
  customerContactAt?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateCreateLead(
  input: CreateLeadInput
): ValidationResult {
  const errors: string[] = [];

  if (!input || typeof input.phone !== "string" || !input.phone.trim()) {
    errors.push("Số điện thoại là bắt buộc");
  }

  if (
    input.companyName !== undefined &&
    typeof input.companyName !== "string"
  ) {
    errors.push("Tên công ty phải là chuỗi");
  }

  if (
    input.projectName !== undefined &&
    typeof input.projectName !== "string"
  ) {
    errors.push("Tên dự án phải là chuỗi");
  }

  if (
    input.productId !== undefined &&
    (!Number.isInteger(input.productId) || input.productId <= 0)
  ) {
    errors.push("Mã sản phẩm không hợp lệ");
  }

  if (
    input.leadSourceId !== undefined &&
    (!Number.isInteger(input.leadSourceId) || input.leadSourceId <= 0)
  ) {
    errors.push("Mã nguồn Lead không hợp lệ");
  }

  if (
    input.customerContactAt !== undefined &&
    (typeof input.customerContactAt !== "string" ||
      !input.customerContactAt.trim() ||
      Number.isNaN(Date.parse(input.customerContactAt)))
  ) {
    errors.push("Thời gian liên hệ không hợp lệ");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
