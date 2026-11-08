import { z } from 'zod';

export const TASK3_PIPELINE_STATUSES = [
  'new_lead',
  'quoting',
  'quote_sent',
  'won',
  'lost',
] as const;

export const TASK3_OPEN_PIPELINE_STATUSES = [
  'new_lead',
  'quoting',
  'quote_sent',
] as const;

export const TASK3_TRANSFER_REASONS = [
  'BUSY',
  'NOT_SPECIALTY',
  'OTHER',
] as const;

const nonNegativeValueSchema = z.number().finite().min(0);

export const Task3LeadIdParamsSchema = z
  .object({
    leadId: z.string().trim().min(1),
  })
  .strict();

export const Task3PipelineRequestSchema = z
  .object({
    nextStatus: z.enum(TASK3_PIPELINE_STATUSES),
    failureReasonId: z.string().trim().min(1).optional(),
    quoteValue: nonNegativeValueSchema.nullable().optional(),
    closedValue: nonNegativeValueSchema.nullable().optional(),
  })
  .strict()
  .superRefine((request, context) => {
    if (request.nextStatus === 'lost' && !request.failureReasonId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['failureReasonId'],
        message: 'Bắt buộc chọn lý do thất bại.',
      });
    }
  });

export const Task3ReopenRequestSchema = z
  .object({
    nextStatus: z.enum(TASK3_OPEN_PIPELINE_STATUSES),
    reason: z.string().trim().min(1),
  })
  .strict();

export const Task3TransferRequestSchema = z
  .object({
    receiverId: z.string().trim().min(1),
    reason: z.enum(TASK3_TRANSFER_REASONS),
    note: z.string().trim().optional(),
  })
  .strict()
  .superRefine((request, context) => {
    if (request.reason === 'OTHER' && !request.note) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['note'],
        message: 'Lý do khác phải có mô tả.',
      });
    }
  });

export const Task3LeadValuesRequestSchema = z
  .object({
    quoteValue: nonNegativeValueSchema.nullable().optional(),
    closedValue: nonNegativeValueSchema.nullable().optional(),
  })
  .strict()
  .refine(
    (request) =>
      request.quoteValue !== undefined || request.closedValue !== undefined,
    'Cần nhập giá trị báo giá hoặc giá trị chốt.',
  );

export const Task3LeadResponseSchema = z
  .object({
    id: z.string().min(1),
    status: z.enum(TASK3_PIPELINE_STATUSES),
    assignedTo: z.string().nullable(),
    receivedBy: z.string().nullable(),
    receivedAt: z.string().datetime().nullable(),
    quoteSentAt: z.string().datetime().nullable(),
    respondedAt: z.string().datetime().nullable(),
    quoteValue: nonNegativeValueSchema.nullable(),
    closedValue: nonNegativeValueSchema.nullable(),
    closedAt: z.string().datetime().nullable(),
  })
  .strict();

export const Task3ActivityResponseSchema = z
  .object({
    leadId: z.string().min(1),
    action: z.enum([
      'STATUS_CHANGED',
      'LEAD_RECEIVED',
      'LEAD_TRANSFERRED',
      'LEAD_UPDATED',
    ]),
    actorId: z.string().min(1),
    createdAt: z.string().datetime(),
    field: z.string().nullable(),
    oldValue: z.string().nullable(),
    newValue: z.string().nullable(),
    reason: z.string().nullable(),
    note: z.string().nullable(),
    fromUserId: z.string().nullable(),
    toUserId: z.string().nullable(),
  })
  .strict();

export type Task3PipelineRequestDto = z.infer<
  typeof Task3PipelineRequestSchema
>;
export type Task3ReopenRequestDto = z.infer<typeof Task3ReopenRequestSchema>;
export type Task3TransferRequestDto = z.infer<
  typeof Task3TransferRequestSchema
>;
export type Task3LeadValuesRequestDto = z.infer<
  typeof Task3LeadValuesRequestSchema
>;
export type Task3LeadResponseDto = z.infer<typeof Task3LeadResponseSchema>;
export type Task3ActivityResponseDto = z.infer<
  typeof Task3ActivityResponseSchema
>;
