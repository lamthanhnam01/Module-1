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

export const TASK3_ACTIVITY_ACTION_TYPES = [
  'status_change',
  'reopen_lead',
  'confirm_receive',
  'reassign_sales',
  'update_info',
] as const;

const positiveIdSchema = z.number().int().safe().positive();
const expectedVersionSchema = z.number().int().safe().positive();
const nonNegativeValueSchema = z.number().int().safe().nonnegative();

export const Task3LeadIdParamsSchema = z
  .object({
    id: z
      .string()
      .regex(/^[1-9]\d*$/)
      .transform(Number)
      .pipe(positiveIdSchema),
  })
  .strict();

export const Task3PipelineRequestSchema = z
  .object({
    expectedVersion: expectedVersionSchema,
    nextStatus: z.enum(TASK3_PIPELINE_STATUSES),
    lostReason: z.string().trim().min(1).optional(),
    quoteValueVnd: nonNegativeValueSchema.nullable().optional(),
    dealValueVnd: nonNegativeValueSchema.nullable().optional(),
  })
  .strict()
  .superRefine((request, context) => {
    if (request.nextStatus === 'lost' && !request.lostReason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lostReason'],
        message: 'Bắt buộc chọn lý do thất bại.',
      });
    }
  });

export const Task3ReopenRequestSchema = z
  .object({
    expectedVersion: expectedVersionSchema,
    nextStatus: z.enum(TASK3_OPEN_PIPELINE_STATUSES),
    reason: z.string().trim().min(1),
  })
  .strict();

export const Task3TransferRequestSchema = z
  .object({
    expectedVersion: expectedVersionSchema,
    receiverId: positiveIdSchema,
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
    expectedVersion: expectedVersionSchema,
    quoteValueVnd: nonNegativeValueSchema.nullable().optional(),
    dealValueVnd: nonNegativeValueSchema.nullable().optional(),
  })
  .strict()
  .refine(
    (request) =>
      request.quoteValueVnd !== undefined || request.dealValueVnd !== undefined,
    'Cần nhập giá trị báo giá hoặc giá trị chốt.',
  );

export const Task3ReceptionRequestSchema = z
  .object({
    expectedVersion: expectedVersionSchema,
  })
  .strict();

export const Task3LeadResponseSchema = z
  .object({
    id: positiveIdSchema,
    version: expectedVersionSchema,
    pipelineStatus: z.enum(TASK3_PIPELINE_STATUSES),
    assignedSalesId: positiveIdSchema.nullable(),
    receivedByUserId: positiveIdSchema.nullable(),
    receivedAt: z.string().datetime().nullable(),
    firstQuoteSentAt: z.string().datetime().nullable(),
    quoteRespondedAt: z.string().datetime().nullable(),
    quoteValueVnd: nonNegativeValueSchema.nullable(),
    dealValueVnd: nonNegativeValueSchema.nullable(),
    closedAt: z.string().datetime().nullable(),
    statusChangedAt: z.string().datetime(),
    lostReason: z.string().nullable(),
    reopenCount: z.number().int().nonnegative(),
  })
  .strict();

export const Task3ActivityResponseSchema = z
  .object({
    id: positiveIdSchema,
    leadId: positiveIdSchema,
    actionType: z.enum(TASK3_ACTIVITY_ACTION_TYPES),
    createdAt: z.string().datetime(),
    fromSalesId: positiveIdSchema.nullable(),
    toSalesId: positiveIdSchema.nullable(),
    transferReason: z.string().nullable(),
    oldStatus: z.string().nullable(),
    newStatus: z.string().nullable(),
    oldValueJson: z.string().nullable(),
    newValueJson: z.string().nullable(),
    note: z.string().nullable(),
    actionById: positiveIdSchema.nullable(),
    actorType: z.enum(['user', 'webhook', 'system']),
    actorRef: z.string().nullable(),
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
export type Task3ReceptionRequestDto = z.infer<
  typeof Task3ReceptionRequestSchema
>;
export type Task3LeadResponseDto = z.infer<typeof Task3LeadResponseSchema>;
export type Task3ActivityResponseDto = z.infer<
  typeof Task3ActivityResponseSchema
>;
