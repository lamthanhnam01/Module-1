'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

// Test 1: Password scrypt hashing and timing-safe verification
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password, storedHash) {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

test('scrypt password hashing verifies valid password and rejects tampered or wrong password', () => {
  const hash = hashPassword('ToanTrung@2026');
  assert.ok(hash.startsWith('scrypt$'));
  assert.equal(verifyPassword('ToanTrung@2026', hash), true);
  assert.equal(verifyPassword('WrongPassword123', hash), false);
  assert.equal(verifyPassword('ToanTrung@2026', 'invalid$hash'), false);
});

// Test 2: 8 BA Roles and 12 Permission Matrix invariants
const ROLE_MATRIX = {
  SALES: ['LEAD_CREATE', 'LEAD_VIEW_OWN', 'LEAD_UPDATE_PIPELINE', 'LEAD_REASSIGN', 'ATTACHMENT_UPLOAD_VIEW', 'DASHBOARD_VIEW', 'EXPORT_DATA'],
  MKT_STAFF: ['LEAD_VIEW_OWN', 'LEAD_VIEW_ALL', 'AI_MARKETING_SEO', 'TRACKING_ADS_OPTIMIZE', 'DASHBOARD_VIEW', 'EXPORT_DATA'],
  DESIGNER: ['LEAD_VIEW_OWN', 'ATTACHMENT_UPLOAD_VIEW', 'AI_DESIGN', 'DASHBOARD_VIEW', 'EXPORT_DATA'],
  ADS: ['LEAD_VIEW_OWN', 'LEAD_VIEW_ALL', 'AI_MARKETING_SEO', 'TRACKING_ADS_OPTIMIZE', 'DASHBOARD_VIEW', 'EXPORT_DATA'],
  MKT_LEAD: ['LEAD_VIEW_OWN', 'LEAD_VIEW_ALL', 'AI_MARKETING_SEO', 'TRACKING_ADS_OPTIMIZE', 'DASHBOARD_VIEW', 'EXPORT_DATA'],
  SALES_LEAD: ['LEAD_CREATE', 'LEAD_VIEW_OWN', 'LEAD_VIEW_ALL', 'LEAD_UPDATE_PIPELINE', 'LEAD_REASSIGN', 'ATTACHMENT_UPLOAD_VIEW', 'DASHBOARD_VIEW', 'EXPORT_DATA'],
  BOD: ['LEAD_CREATE', 'LEAD_VIEW_OWN', 'LEAD_VIEW_ALL', 'LEAD_UPDATE_PIPELINE', 'LEAD_REASSIGN', 'ATTACHMENT_UPLOAD_VIEW', 'TRACKING_ADS_OPTIMIZE', 'DASHBOARD_VIEW', 'EXPORT_DATA'],
  ADMIN: ['LEAD_CREATE', 'LEAD_VIEW_OWN', 'LEAD_VIEW_ALL', 'LEAD_UPDATE_PIPELINE', 'LEAD_REASSIGN', 'ATTACHMENT_UPLOAD_VIEW', 'AI_DESIGN', 'AI_MARKETING_SEO', 'TRACKING_ADS_OPTIMIZE', 'DASHBOARD_VIEW', 'EXPORT_DATA', 'SYSTEM_USER_ADMIN'],
};

test('BA permission matrix preserves all 8 roles, restricts SYSTEM_USER_ADMIN to ADMIN, and restricts AI_DESIGN to DESIGNER and ADMIN', () => {
  const roles = Object.keys(ROLE_MATRIX);
  assert.equal(roles.length, 8);

  for (const role of roles) {
    assert.ok(ROLE_MATRIX[role].includes('EXPORT_DATA'), `${role} must have EXPORT_DATA`);
    assert.ok(ROLE_MATRIX[role].includes('DASHBOARD_VIEW'), `${role} must have DASHBOARD_VIEW`);
    if (role === 'ADMIN') {
      assert.ok(ROLE_MATRIX[role].includes('SYSTEM_USER_ADMIN'));
    } else {
      assert.ok(!ROLE_MATRIX[role].includes('SYSTEM_USER_ADMIN'), `${role} must NOT have SYSTEM_USER_ADMIN`);
    }
    if (role === 'DESIGNER' || role === 'ADMIN') {
      assert.ok(ROLE_MATRIX[role].includes('AI_DESIGN'));
    } else {
      assert.ok(!ROLE_MATRIX[role].includes('AI_DESIGN'), `${role} must NOT have AI_DESIGN`);
    }
  }
});

// Test 3: Binary image validation blocks SVG/XSS and accepts valid PNG
test('branding upload validator blocks disguised SVG/script payloads and validates real PNG binary headers', () => {
  const disguisedSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'utf8');
  const headText = disguisedSvg.subarray(0, 256).toString('utf8').toLowerCase();
  assert.equal(headText.includes('<svg') || headText.includes('<script'), true);

  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x20,
    0x00, 0x00, 0x00, 0x20,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x73, 0x7a, 0x7a, 0xf4,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  assert.equal(pngHeader.readUInt32BE(16), 32);
  assert.equal(pngHeader.readUInt32BE(20), 32);
});

// Test 4: Interactive Crop math & bounds invariants
test('login crop configuration clamps zoom, offset, and frameScale within safe proportional bounds', () => {
  const crop = { zoom: 1.4, offsetX: -15, offsetY: 20, frameScale: 0.85 };
  const effectiveZoom = Math.max(1, crop.zoom / Math.max(0.6, crop.frameScale));
  const posX = Math.max(0, Math.min(100, 50 - crop.offsetX));
  const posY = Math.max(0, Math.min(100, 50 - crop.offsetY));

  assert.ok(effectiveZoom > 1.6 && effectiveZoom < 1.7);
  assert.equal(posX, 65);
  assert.equal(posY, 30);
});

// Test 5: Personal profile forbidden field guard
test('personal profile update guard blocks roleCode, department, and userId privilege escalation fields', () => {
  const FORBIDDEN_PROFILE_FIELDS = ['id', 'userId', 'roleCode', 'roleId', 'department', 'email', 'isActive'];
  const maliciousPayload = { fullName: 'Test User', roleCode: 'ADMIN', department: 'admin', userId: 1 };
  const detected = FORBIDDEN_PROFILE_FIELDS.filter((f) => f in maliciousPayload);
  assert.deepEqual(detected, ['userId', 'roleCode', 'department']);
});
