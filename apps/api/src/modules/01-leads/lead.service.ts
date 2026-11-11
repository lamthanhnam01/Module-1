
import { normalizePhone } from "./phone";
import {
  validateCreateLead,
  validateUpdateLead,
  type CreateLeadInput,
  type UpdateLeadInput,
} from "./lead.validation";

export interface PreparedLead {
  phone: string;
  isPhoneUnstandardized: boolean;
  contactChannel: string;

  contactName: string | null;
  email: string | null;
  companyName: string | null;
  projectName: string | null;
  installationAddress: string | null;

  productId: number | null;
  contactedAt: Date;
}

function cleanOptionalText(
  value: string | null | undefined
): string | null {
  if (value == null) {
    return null;
  }

  const cleaned = value.trim();
  return cleaned || null;
}

export function prepareCreateLead(
  input: CreateLeadInput
): PreparedLead {
  const validation = validateCreateLead(input);

  if (!validation.valid) {
    throw new Error(validation.errors.join(", "));
  }

  const phoneResult = normalizePhone(input.phone);

  return {
    phone: phoneResult.phone,
    isPhoneUnstandardized: phoneResult.phoneUnverified,

    contactChannel: input.contactChannel,

    contactName: cleanOptionalText(input.contactName),
    email: cleanOptionalText(input.email),
    companyName: cleanOptionalText(input.companyName),
    projectName: cleanOptionalText(input.projectName),
    installationAddress: cleanOptionalText(
      input.installationAddress
    ),

    productId: input.productId ?? null,

    contactedAt: input.contactedAt
      ? new Date(input.contactedAt)
      : new Date(),
  };
}


export interface PreparedLeadUpdate {
  phone?: string;
  isPhoneUnstandardized?: boolean;
  contactName?: string | null;
  email?: string | null;
  companyName?: string | null;
  projectName?: string | null;
  installationAddress?: string | null;
  productId?: number | null;
}

export function prepareUpdateLead(
  input: UpdateLeadInput
): PreparedLeadUpdate {
  const validation = validateUpdateLead(input);

  if (!validation.valid) {
    throw new Error(validation.errors.join(", "));
  }

  if (Object.keys(input).length === 0) {
    throw new Error("Cần cung cấp ít nhất một trường để cập nhật.");
  }

  const result: PreparedLeadUpdate = {};

  if (input.phone !== undefined) {
    const normalized = normalizePhone(input.phone);
    result.phone = normalized.phone;
    result.isPhoneUnstandardized = normalized.phoneUnverified;
  }

  if (input.contactName !== undefined) {
    result.contactName = cleanOptionalText(input.contactName);
  }

  if (input.email !== undefined) {
    result.email = cleanOptionalText(input.email);
  }

  if (input.companyName !== undefined) {
    result.companyName = cleanOptionalText(input.companyName);
  }

  if (input.projectName !== undefined) {
    result.projectName = cleanOptionalText(input.projectName);
  }

  if (input.installationAddress !== undefined) {
    result.installationAddress = cleanOptionalText(
      input.installationAddress
    );
  }

  if (input.productId !== undefined) {
    result.productId = input.productId;
  }

  return result;
}
