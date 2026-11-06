
import { normalizePhone } from "./phone";
import {
  validateCreateLead,
  type CreateLeadInput,
} from "./lead.validation";

export interface PreparedLead {
  phone: string;
  phoneUnverified: boolean;
  companyName?: string;
  projectName?: string;
  installationAddress?: string;
  productId?: number;
  leadSourceId?: number;
  customerContactAt: Date;
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
    phoneUnverified: phoneResult.phoneUnverified,
    companyName: input.companyName?.trim(),
    projectName: input.projectName?.trim(),
    installationAddress: input.installationAddress?.trim(),
    productId: input.productId,
    leadSourceId: input.leadSourceId,
    customerContactAt: input.customerContactAt
      ? new Date(input.customerContactAt)
      : new Date(),
  };
}
