import assert from 'node:assert/strict';
import test from 'node:test';

import {
  Task3LeadValuesRequestSchema,
  Task3PipelineRequestSchema,
  Task3ReopenRequestSchema,
  Task3TransferRequestSchema,
} from './task3.ts';

test('Task 3 mutation contracts reject fields supplied by clients', () => {
  assert.equal(
    Task3PipelineRequestSchema.safeParse({
      nextStatus: 'quote_sent',
      actorId: 'client-selected-actor',
    }).success,
    false,
  );
  assert.equal(
    Task3ReopenRequestSchema.safeParse({
      nextStatus: 'quoting',
      reason: 'Khách yêu cầu mở lại',
      reopenWindowMs: 86400000,
    }).success,
    false,
  );
});

test('Task 3 pipeline contract requires a failure reason for lost', () => {
  assert.equal(
    Task3PipelineRequestSchema.safeParse({ nextStatus: 'lost' }).success,
    false,
  );
  assert.equal(
    Task3PipelineRequestSchema.safeParse({
      nextStatus: 'lost',
      failureReasonId: 'reason-01',
    }).success,
    true,
  );
});

test('Task 3 value and transfer contracts validate business input', () => {
  assert.equal(Task3LeadValuesRequestSchema.safeParse({}).success, false);
  assert.equal(
    Task3LeadValuesRequestSchema.safeParse({ quoteValue: -1 }).success,
    false,
  );
  assert.equal(
    Task3TransferRequestSchema.safeParse({
      receiverId: 'sales-02',
      reason: 'OTHER',
    }).success,
    false,
  );
  assert.equal(
    Task3TransferRequestSchema.safeParse({
      receiverId: 'sales-02',
      reason: 'OTHER',
      note: 'Bàn giao theo yêu cầu',
    }).success,
    true,
  );
});
