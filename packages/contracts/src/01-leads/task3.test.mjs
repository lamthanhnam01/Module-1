import assert from 'node:assert/strict';
import test from 'node:test';

import {
  Task3ActivityResponseSchema,
  Task3LeadIdParamsSchema,
  Task3LeadResponseSchema,
  Task3LeadValuesRequestSchema,
  Task3PipelineRequestSchema,
  Task3ReopenRequestSchema,
  Task3TransferRequestSchema,
} from './task3.ts';

test('Task 3 public IDs and Lead fields follow the shared schema', () => {
  assert.equal(
    Task3LeadIdParamsSchema.safeParse({ id: '12' }).data.id,
    12,
  );
  assert.equal(
    Task3LeadIdParamsSchema.safeParse({ id: '1e2' }).success,
    false,
  );
  assert.equal(
    Task3LeadResponseSchema.safeParse({
      id: 12,
      version: 3,
      pipelineStatus: 'quote_sent',
      assignedSalesId: 7,
      receivedByUserId: 7,
      receivedAt: '2026-11-07T10:00:00.000Z',
      firstQuoteSentAt: '2026-11-07T10:00:00.000Z',
      quoteRespondedAt: null,
      quoteValueVnd: 100000,
      dealValueVnd: null,
      closedAt: null,
      statusChangedAt: '2026-11-07T10:00:00.000Z',
      lostReason: null,
      reopenCount: 1,
    }).success,
    true,
  );
  assert.equal(
    Task3ActivityResponseSchema.safeParse({
      id: 1,
      leadId: 12,
      actionType: 'confirm_receive',
      createdAt: '2026-11-07T10:00:00.000Z',
      fromSalesId: null,
      toSalesId: null,
      transferReason: null,
      oldStatus: null,
      newStatus: null,
      oldValueJson: null,
      newValueJson: null,
      note: null,
      actionById: 7,
      actorType: 'user',
      actorRef: 'user:7',
    }).success,
    true,
  );
});

test('Task 3 mutation contracts reject fields supplied by clients', () => {
  assert.equal(
    Task3PipelineRequestSchema.safeParse({
      expectedVersion: 1,
      nextStatus: 'quote_sent',
      actorId: 'client-selected-actor',
    }).success,
    false,
  );
  assert.equal(
    Task3ReopenRequestSchema.safeParse({
      expectedVersion: 1,
      nextStatus: 'quoting',
      reason: 'Khách yêu cầu mở lại',
      reopenWindowMs: 86400000,
    }).success,
    false,
  );
});

test('Task 3 pipeline contract requires a failure reason for lost', () => {
  assert.equal(
    Task3PipelineRequestSchema.safeParse({
      expectedVersion: 1,
      nextStatus: 'lost',
    }).success,
    false,
  );
  assert.equal(
    Task3PipelineRequestSchema.safeParse({
      expectedVersion: 1,
      nextStatus: 'lost',
      lostReason: 'Khách từ chối báo giá',
    }).success,
    true,
  );
});

test('Task 3 value and transfer contracts validate business input', () => {
  assert.equal(
    Task3LeadValuesRequestSchema.safeParse({ expectedVersion: 1 }).success,
    false,
  );
  assert.equal(
    Task3LeadValuesRequestSchema.safeParse({
      expectedVersion: 1,
      quoteValueVnd: -1,
    }).success,
    false,
  );
  assert.equal(
    Task3TransferRequestSchema.safeParse({
      expectedVersion: 1,
      receiverId: '102',
      reason: 'OTHER',
    }).success,
    false,
  );
  assert.equal(
    Task3TransferRequestSchema.safeParse({
      expectedVersion: 1,
      receiverId: 102,
      reason: 'OTHER',
      note: 'Bàn giao theo yêu cầu',
    }).success,
    true,
  );
});
