
export interface CreateLeadInput {
  phone: string;
  contactChannel: string;
  contactName?: string | null;
  email?: string | null;
  companyName?: string | null;
  projectName?: string | null;
  installationAddress?: string | null;
  productId?: number | null;
  contactedAt?: string | null;
}

export interface UpdateLeadInput {
  phone?: string;
  contactName?: string | null;
  email?: string | null;
  companyName?: string | null;
  projectName?: string | null;
  installationAddress?: string | null;
  productId?: number | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export const CONTACT_CHANNELS = [
  "hotline",
  "form_web",
  "email",
  "fanpage",
  "zalo",
  "google_lead_form",
] as const;

function isOptionalText(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    typeof value === "string"
  );
}

function isPositiveInteger(value: unknown): boolean {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0
  );
}

function validateTextFields(
  data: Record<string, unknown>,
  fields: string[],
  errors: string[]
): void {
  for (const field of fields) {
    if (!isOptionalText(data[field])) {
      errors.push(`${field} must be a string or null`);
    }
  }
}

function validateAllowedFields(
  data: Record<string, unknown>,
  allowedFields: string[],
  errors: string[]
): void {
  for (const field of Object.keys(data)) {
    if (!allowedFields.includes(field)) {
      errors.push(`Unknown field: ${field}`);
    }
  }
}

export function validateCreateLead(
  input: CreateLeadInput
): ValidationResult {
  const errors: string[] = [];
  const data = input as unknown as Record<string, unknown>;

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      valid: false,
      errors: ["Input must be an object"],
    };
  }

  validateAllowedFields(
    data,
    [
      "phone",
      "contactChannel",
      "contactName",
      "email",
      "companyName",
      "projectName",
      "installationAddress",
      "productId",
      "contactedAt",
    ],
    errors
  );

  if (
    typeof input.phone !== "string" ||
    !input.phone.trim()
  ) {
    errors.push("phone is required");
  }

  if (
    typeof input.contactChannel !== "string" ||
    !CONTACT_CHANNELS.some(
      (channel) => channel === input.contactChannel
    )
  ) {
    errors.push("contactChannel is invalid");
  }

  validateTextFields(
    data,
    [
      "contactName",
      "email",
      "companyName",
      "projectName",
      "installationAddress",
    ],
    errors
  );

  if (
    input.productId !== undefined &&
    input.productId !== null &&
    !isPositiveInteger(input.productId)
  ) {
    errors.push("productId must be a positive integer");
  }

  if (
    input.contactedAt !== undefined &&
    input.contactedAt !== null &&
    (
      typeof input.contactedAt !== "string" ||
      !input.contactedAt.trim() ||
      Number.isNaN(Date.parse(input.contactedAt))
    )
  ) {
    errors.push("contactedAt must be a valid date");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateUpdateLead(
  input: UpdateLeadInput
): ValidationResult {
  const errors: string[] = [];

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      valid: false,
      errors: ["Input must be an object"],
    };
  }

  const data = input as Record<string, unknown>;

  validateAllowedFields(
    data,
    [
      "phone",
      "contactName",
      "email",
      "companyName",
      "projectName",
      "installationAddress",
      "productId",
    ],
    errors
  );

  if (
    input.phone !== undefined &&
    (
      typeof input.phone !== "string" ||
      !input.phone.trim()
    )
  ) {
    errors.push("phone must be a non-empty string");
  }

  validateTextFields(
    data,
    [
      "contactName",
      "email",
      "companyName",
      "projectName",
      "installationAddress",
    ],
    errors
  );

  if (
    input.productId !== undefined &&
    input.productId !== null &&
    !isPositiveInteger(input.productId)
  ) {
    errors.push("productId must be a positive integer");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
