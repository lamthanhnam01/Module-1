'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const independentDbFile = path.resolve(__dirname, '../prisma/independent_v2.db').replace(/\\/g, '/');
const devDbFile = path.resolve(__dirname, '../prisma/dev.db').replace(/\\/g, '/');
const chosenDbFile =
  fs.existsSync(independentDbFile) && fs.statSync(independentDbFile).size > 0
    ? independentDbFile
    : fs.existsSync(devDbFile) && fs.statSync(devDbFile).size > 0
      ? devDbFile
      : independentDbFile;
const defaultDbUrl = chosenDbFile.startsWith('/') ? `file://${chosenDbFile}` : `file:${chosenDbFile}`;
const targetDbUrl =
  process.env.DATABASE_URL &&
  process.env.DATABASE_URL !== 'file:./dev.db' &&
  process.env.DATABASE_URL !== 'file:./independent_v2.db'
    ? process.env.DATABASE_URL
    : defaultDbUrl;
process.env.DATABASE_URL = targetDbUrl;
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: targetDbUrl,
    },
  },
});

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

const BA_ROLES = [
  { roleCode: 'SALES', roleName: 'Nhân viên Kinh doanh', description: 'Tiếp nhận, chăm sóc Lead và cập nhật Pipeline báo giá cá nhân' },
  { roleCode: 'MKT_STAFF', roleName: 'Nhân viên Marketing', description: 'Xem Lead ẩn danh, AI Marketing SEO, Tracking đa kênh' },
  { roleCode: 'DESIGNER', roleName: 'Designer', description: 'Xem Lead 3D/2D, tài liệu hiện trạng và sử dụng AI thiết kế' },
  { roleCode: 'ADS', roleName: 'Nhân viên Ads', description: 'Xem Lead ẩn danh, chỉnh sửa Nguồn/Chiến dịch, tối ưu Google Ads' },
  { roleCode: 'MKT_LEAD', roleName: 'Trưởng phòng Marketing', description: 'Quản lý hoạt động Marketing, xem Lead toàn công ty và báo cáo phòng' },
  { roleCode: 'SALES_LEAD', roleName: 'Trưởng phòng Sales', description: 'Quản lý đội ngũ Kinh doanh, điều phối Lead và theo dõi Pipeline' },
  { roleCode: 'BOD', roleName: 'Giám đốc', description: 'Xem toàn bộ hoạt động kinh doanh, tracking và báo cáo hiệu suất tổng thể' },
  { roleCode: 'ADMIN', roleName: 'Quản trị viên', description: 'Quản trị hệ thống, tài khoản nhân sự, phân quyền và cấu hình thương hiệu' },
];

const BA_PRODUCTS_AUTHORITATIVE = [
  // I. Màn hình LED (8 mục: id 1..8)
  { id: 1, categoryGroup: 'led_screen', productCode: 'LED_INDOOR', legacyCode: 'LED_INDOOR', productName: 'Màn hình LED Indoor', unit: 'm2' },
  { id: 2, categoryGroup: 'led_screen', productCode: 'LED_OUTDOOR', legacyCode: 'LED_OUTDOOR', productName: 'Màn hình LED Outdoor', unit: 'm2' },
  { id: 3, categoryGroup: 'led_screen', productCode: 'LED_CURVED', legacyCode: 'LED_HALL', productName: 'Màn hình LED Cong', unit: 'm2' },
  { id: 4, categoryGroup: 'led_screen', productCode: 'LED_MESH', legacyCode: 'LED_MEETING', productName: 'Màn hình LED lưới', unit: 'm2' },
  { id: 5, categoryGroup: 'led_screen', productCode: 'LED_GOB', legacyCode: 'LED_STAGE_EVENT', productName: 'Màn hình GOB', unit: 'm2' },
  { id: 6, categoryGroup: 'led_screen', productCode: 'LED_COB', legacyCode: 'LED_ADS_3D', productName: 'Màn hình COB', unit: 'm2' },
  { id: 7, categoryGroup: 'led_screen', productCode: 'LED_LCD', legacyCode: 'LED_TRANSPARENT_FLEX', productName: 'Màn hình LCD', unit: 'bộ' },
  { id: 8, categoryGroup: 'led_screen', productCode: 'LED_OTHER', legacyCode: 'LED_STANDEE_POSTER', productName: 'Khác (Màn hình LED)', unit: 'yêu cầu' },

  // II. Bảng Điện Tử (12 mục: id 9..20)
  { id: 9, categoryGroup: 'electronic_board', productCode: 'BOARD_PRODUCTIVITY', legacyCode: 'BOARD_MATRIX', productName: 'Bảng Năng suất', unit: 'bộ' },
  { id: 10, categoryGroup: 'electronic_board', productCode: 'BOARD_SPORTS', legacyCode: 'BOARD_PRODUCTION', productName: 'Bảng thi đấu thể thao', unit: 'bộ' },
  { id: 11, categoryGroup: 'electronic_board', productCode: 'BOARD_MARATHON', legacyCode: 'BOARD_SAFETY', productName: 'Bảng Marathon', unit: 'bộ' },
  { id: 12, categoryGroup: 'electronic_board', productCode: 'BOARD_SHOTLOCK', legacyCode: 'BOARD_FINANCE_GOLD', productName: 'Bảng Shotlock', unit: 'bộ' },
  { id: 13, categoryGroup: 'electronic_board', productCode: 'BOARD_SAFETY', legacyCode: 'BOARD_WELCOME_GATE', productName: 'Bảng An toàn lao động', unit: 'bộ' },
  { id: 14, categoryGroup: 'electronic_board', productCode: 'BOARD_AIRPORT_BUS', legacyCode: 'BOARD_TRAFFIC_VMS', productName: 'Bảng LED xe buýt sân bay', unit: 'bộ' },
  { id: 15, categoryGroup: 'electronic_board', productCode: 'BOARD_MODBUS', legacyCode: 'BOARD_SCOREBOARD', productName: 'Bảng LED Modbus', unit: 'bộ' },
  { id: 16, categoryGroup: 'electronic_board', productCode: 'BOARD_BUS', legacyCode: 'BOARD_PARKING', productName: 'Bảng LED xe buýt', unit: 'bộ' },
  { id: 17, categoryGroup: 'electronic_board', productCode: 'BOARD_CLOCK', legacyCode: 'BOARD_QMS', productName: 'Đồng hồ LED', unit: 'bộ' },
  { id: 18, categoryGroup: 'electronic_board', productCode: 'BOARD_TEMP_HUMIDITY', legacyCode: 'BOARD_ANDON', productName: 'Bảng hiển thị nhiệt độ độ ẩm', unit: 'bộ' },
  { id: 19, categoryGroup: 'electronic_board', productCode: 'BOARD_GOLD_PRICE', legacyCode: 'BOARD_CLOCK', productName: 'Bảng LED giá vàng', unit: 'bộ' },
  { id: 20, categoryGroup: 'electronic_board', productCode: 'BOARD_PARKING_FEE', legacyCode: 'BOARD_ENV_SENSOR', productName: 'Bảng LED thu phí giữ xe', unit: 'bộ' },

  // III. Nhu cầu Khác (5 mục: id 21..25)
  { id: 21, categoryGroup: 'other', productCode: 'OTHER_REPAIR', legacyCode: 'OTHER_REPAIR_MAINT', productName: 'Hỏi sửa chữa', unit: 'yêu cầu' },
  { id: 22, categoryGroup: 'other', productCode: 'OTHER_NO_INFO', legacyCode: 'OTHER_RENTAL', productName: 'Không cung cấp thông tin', unit: 'yêu cầu' },
  { id: 23, categoryGroup: 'other', productCode: 'OTHER_SPECIAL', legacyCode: 'OTHER_PARTS', productName: 'Hỏi sản phẩm đặc biệt', unit: 'yêu cầu' },
  { id: 24, categoryGroup: 'other', productCode: 'OTHER_RENTAL', legacyCode: 'OTHER_UNDECIDED', productName: 'Hỏi thuê', unit: 'yêu cầu' },
  { id: 25, categoryGroup: 'other', productCode: 'OTHER_MISMATCH', legacyCode: 'OTHER_CUSTOM', productName: 'Không đúng nhu cầu', unit: 'yêu cầu' },
];

const UNAPPROVED_SLA_KEYS = [
  'slaRemindReceiveMinutes',
  'slaAutoReassignMinutes',
  'slaMaxAutoReassignCount',
  'slaQuoteWarningHours',
  'leadReopenWindowDays',
  'leadRepeatDedupeDays',
  'workingHoursConfig',
];

async function syncAuthoritativeProducts(client = prisma) {
  await client.$transaction(async (tx) => {
    const existing = await tx.product.findMany({ orderBy: { id: 'asc' } });
    const byId = new Map(existing.map((r) => [r.id, r]));

    for (const item of BA_PRODUCTS_AUTHORITATIVE) {
      const row = byId.get(item.id);
      if (row && row.productCode !== item.productCode) {
        await tx.product.update({
          where: { id: item.id },
          data: { productCode: `__REMAP_${item.id}_${row.productCode}` },
        });
      }
    }

    for (const item of BA_PRODUCTS_AUTHORITATIVE) {
      const row = byId.get(item.id);
      if (row) {
        await tx.product.update({
          where: { id: item.id },
          data: {
            categoryGroup: item.categoryGroup,
            productCode: item.productCode,
            productName: item.productName,
            unit: item.unit,
            isActive: true,
          },
        });
      } else {
        await tx.product.upsert({
          where: { productCode: item.productCode },
          update: {
            categoryGroup: item.categoryGroup,
            productName: item.productName,
            unit: item.unit,
            isActive: true,
          },
          create: {
            id: item.id,
            categoryGroup: item.categoryGroup,
            productCode: item.productCode,
            productName: item.productName,
            unit: item.unit,
            isActive: true,
          },
        });
      }
    }
  });
}

function createSamplePngBuffer() {
  // Valid 1x1 blue PNG for synthetic attachment/design storage files
  return Buffer.from(
    '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d7636060f80f00010401005f9527b00000000049454e44ae426082',
    'hex',
  );
}

async function seedSyntheticModuleData(usersByEmail) {
  await prisma.$executeRawUnsafe(`
    UPDATE "leads"
    SET "company_name" = REPLACE("company_name", ' (Dữ liệu tổng hợp)', ''),
        "contact_name" = TRIM("contact_name")
    WHERE "company_name" LIKE '%(Dữ liệu tổng hợp)%' OR "contact_name" LIKE ' %'
  `);
  const existingLeadCount = await prisma.lead.count();
  if (existingLeadCount > 0) return;

  const repoRoot = path.resolve(__dirname, '../../..');
  const storageRoot = path.resolve(repoRoot, process.env.STORAGE_ROOT || './storage_independent_v2');
  const leadsStorageDir = path.join(storageRoot, 'leads');
  const designStorageDir = path.join(storageRoot, 'design');
  fs.mkdirSync(leadsStorageDir, { recursive: true });
  fs.mkdirSync(designStorageDir, { recursive: true });

  const samplePng = createSamplePngBuffer();
  fs.writeFileSync(path.join(leadsStorageDir, 'site-photo-lead-1.png'), samplePng);
  fs.writeFileSync(path.join(leadsStorageDir, 'chat-pricecheck-lead-5.png'), samplePng);
  fs.writeFileSync(path.join(designStorageDir, 'design-3d-v1-draft.png'), samplePng);
  fs.writeFileSync(path.join(designStorageDir, 'design-3d-v2-final.png'), samplePng);
  fs.writeFileSync(path.join(designStorageDir, 'design-banner-v1-draft.png'), samplePng);

  const sales1 = usersByEmail['sales@toantrung.vn'];
  const sales2 = usersByEmail['sales2@toantrung.vn'];
  const salesLead = usersByEmail['sales.lead@toantrung.vn'];
  const mktStaff = usersByEmail['marketing@toantrung.vn'];
  const mktLead = usersByEmail['mkt.lead@toantrung.vn'];
  const designer = usersByEmail['designer@toantrung.vn'];

  // 1. Campaigns (M02)
  const campIndoor = await prisma.campaign.create({
    data: {
      platform: 'google_ads',
      accountExternalId: 'GADS-TT-01',
      campaignCode: 'CAMP_LED_INDOOR_P25_Q4',
      campaignName: 'Chiến dịch Màn hình LED Hội trường P2.5 Q4',
      utmCampaignSlug: 'led_indoor_p25_q4',
      currencyCode: 'VND',
      dailyBudgetMicros: 3_500_000_000_000n, // 3,500,000 VND
      isActive: true,
    },
  });

  const campOutdoor = await prisma.campaign.create({
    data: {
      platform: 'google_ads',
      accountExternalId: 'GADS-TT-01',
      campaignCode: 'CAMP_LED_OUTDOOR_P4_Q4',
      campaignName: 'Chiến dịch Màn hình LED Ngoài trời P4/P5 Q4',
      utmCampaignSlug: 'led_outdoor_p4_q4',
      currencyCode: 'VND',
      dailyBudgetMicros: 5_000_000_000_000n, // 5,000,000 VND
      isActive: true,
    },
  });

  const campBoard = await prisma.campaign.create({
    data: {
      platform: 'facebook',
      accountExternalId: 'FB-TT-FANPAGE',
      campaignCode: 'CAMP_BOARD_FACTORY_2026',
      campaignName: 'Bảng điện tử Năng suất & An toàn Nhà máy',
      utmCampaignSlug: 'board_factory_2026',
      currencyCode: 'VND',
      dailyBudgetMicros: 1_500_000_000_000n, // 1,500,000 VND
      isActive: true,
    },
  });

  const now = new Date();
  const daysAgo = (d) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

  // 2. Leads + Products + Tracking + Activities (M01 + M02)
  // Lead 1: Won deal from Google Ads (has 3D design request)
  const lead1 = await prisma.lead.create({
    data: {
      leadCode: 'TT-20261101-0001',
      companyName: 'Công ty CP Trung tâm Hội nghị Ánh Dương',
      projectName: 'Hội trường Ballroom Tầng 3',
      normalizedLookupKey: 'trung tam hoi nghi anh duong|hoi truong ballroom tang 3',
      contactName: 'Anh Minh Hoàng',
      phone: '0908100201',
      email: 'hoang.minh@anhduong-synthetic.vn',
      contactChannel: 'form_web',
      sourceWebsite: 'toantrung.com.vn',
      selfReportedSource: 'Tìm trên Google',
      areaType: 'tphcm',
      province: 'TP. Hồ Chí Minh',
      district: 'TP. Thủ Đức',
      installationAddress: 'Số 12 Đại lộ Võ Nguyên Giáp, TP. Thủ Đức (Dữ liệu mẫu)',
      pipelineStatus: 'won',
      assignedSalesId: sales1.id,
      createdByActorType: 'webhook',
      createdByActorRef: 'website_webhook:toantrung.com.vn',
      receivedByUserId: sales1.id,
      receivedAt: daysAgo(12),
      firstQuoteSentAt: daysAgo(10),
      quoteRespondedAt: daysAgo(8),
      closedAt: daysAgo(5),
      contactedAt: daysAgo(12),
    },
  });
  await prisma.leadProduct.createMany({
    data: [
      { leadId: lead1.id, productId: 1, requestedDimension: 'Ngang 8m x Cao 4m (P2.5 Indoor)' },
      { leadId: lead1.id, productId: 5, requestedDimension: 'Module GOB chống va đập' },
    ],
  });
  await prisma.marketingTracking.create({
    data: {
      leadId: lead1.id,
      campaignId: campIndoor.id,
      intakeChannel: 'form_web',
      intakeSourceProvider: 'website_webhook',
      intakeSourceAccountKey: 'toantrung.com.vn',
      externalSubmissionId: 'SYNTH-WEB-0001',
      marketingSource: 'Google Ads',
      sourceResolutionMethod: 'gclid',
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: 'led_indoor_p25_q4',
      campaignName: campIndoor.campaignName,
      gclid: 'EAIaIQobChMI_synth_gclid_0001',
      landingPageUrl: 'https://toantrung.com.vn/man-hinh-led-hoi-truong',
      deviceType: 'desktop',
      syncGa4Status: 'synced',
      trackedAt: daysAgo(12),
    },
  });
  await prisma.leadAttachment.create({
    data: {
      leadId: lead1.id,
      attachmentType: 'site_photo',
      folderPath: '/hoi-truong-ballroom',
      fileName: 'hien-trang-ballroom-tang-3.png',
      fileUrl: 'leads/site-photo-lead-1.png',
      fileSizeKb: 124,
      uploadedById: sales1.id,
    },
  });
  await prisma.leadActivity.createMany({
    data: [
      {
        leadId: lead1.id,
        actionType: 'create_lead',
        newStatus: 'new_lead',
        actorType: 'webhook',
        actorRef: 'website_webhook:toantrung.com.vn',
        note: 'Tiếp nhận tự động từ form website toantrung.com.vn',
        createdAt: daysAgo(12),
      },
      {
        leadId: lead1.id,
        actionType: 'confirm_receive',
        oldStatus: 'new_lead',
        newStatus: 'new_lead',
        actionById: sales1.id,
        actorType: 'user',
        note: 'Đã xác nhận tiếp nhận và gọi điện khảo sát kích thước hội trường.',
        createdAt: daysAgo(12),
      },
      {
        leadId: lead1.id,
        actionType: 'status_change',
        oldStatus: 'quote_sent',
        newStatus: 'won',
        actionById: sales1.id,
        actorType: 'user',
        note: 'Khách đồng ý phương án LED Indoor P2.5 + GOB, đã ký hợp đồng.',
        createdAt: daysAgo(5),
      },
    ],
  });

  // Lead 2: Quote Sent > 7 days ago without response (triggers UC02/UC04 7-day follow-up alert!)
  const lead2 = await prisma.lead.create({
    data: {
      leadCode: 'TT-20261102-0002',
      companyName: 'Nhà máy Sản xuất Linh kiện Đông Á',
      projectName: 'Hệ thống 12 Bảng điện tử Năng suất & An toàn',
      normalizedLookupKey: 'nha may san xuat linh kien dong a|he thong 12 bang dien tu nang suat an toan',
      contactName: 'Chị Thanh Thảo',
      phone: '0908100202',
      email: 'thao.nguyen@donga-factory-synthetic.vn',
      contactChannel: 'hotline',
      selfReportedSource: 'Được đối tác giới thiệu',
      areaType: 'other_province',
      province: 'Bình Dương',
      installationAddress: 'KCN VSIP 2, Bình Dương',
      pipelineStatus: 'quote_sent',
      assignedSalesId: sales1.id,
      createdByUserId: sales1.id,
      createdByActorType: 'user',
      createdByActorRef: `user:${sales1.id}`,
      receivedByUserId: sales1.id,
      receivedAt: daysAgo(11),
      firstQuoteSentAt: daysAgo(9), // 9 days ago (> 7 days threshold!)
      quoteRespondedAt: null,
      contactedAt: daysAgo(11),
    },
  });
  await prisma.leadProduct.createMany({
    data: [
      { leadId: lead2.id, productId: 9, requestedDimension: '8 Bảng năng suất chuyền lắp ráp' },
      { leadId: lead2.id, productId: 13, requestedDimension: '4 Bảng an toàn lao động cổng nhà máy' },
    ],
  });
  await prisma.marketingTracking.create({
    data: {
      leadId: lead2.id,
      intakeChannel: 'hotline',
      intakeSourceProvider: 'manual',
      intakeSourceAccountKey: 'internal',
      marketingSource: 'Nhập tay',
      sourceResolutionMethod: 'manual',
      trackedAt: daysAgo(11),
    },
  });

  // Lead 3: Quoting stage (Google Lead Form, assigned to sales2)
  const lead3 = await prisma.lead.create({
    data: {
      leadCode: 'TT-20261104-0003',
      companyName: 'Tập đoàn Bất động sản Nam Sài Gòn',
      projectName: 'Màn hình LED Outdoor Mặt tiền Tòa nhà Quận 7',
      normalizedLookupKey: 'tap doan bat dong san nam sai gon|man hinh led outdoor mat tien toa nha quan 7',
      contactName: 'Anh Quốc Tuấn',
      phone: '0908100203',
      email: 'tuan.quoc@namsg-synthetic.vn',
      contactChannel: 'google_lead_form',
      areaType: 'tphcm',
      province: 'TP. Hồ Chí Minh',
      district: 'Quận 7',
      installationAddress: 'Đường Nguyễn Lương Bằng, Quận 7',
      pipelineStatus: 'quoting',
      assignedSalesId: sales2.id,
      createdByActorType: 'webhook',
      createdByActorRef: 'google_lead_form:gads-tt-01',
      receivedByUserId: sales2.id,
      receivedAt: daysAgo(3),
      contactedAt: daysAgo(3),
    },
  });
  await prisma.leadProduct.create({
    data: {
      leadId: lead3.id,
      productId: 2,
      requestedDimension: 'Ngang 12m x Cao 6m (LED Outdoor P4 chống nước IP65)',
    },
  });
  await prisma.marketingTracking.create({
    data: {
      leadId: lead3.id,
      campaignId: campOutdoor.id,
      intakeChannel: 'google_lead_form',
      intakeSourceProvider: 'google_lead_form',
      intakeSourceAccountKey: 'gads-tt-01',
      externalSubmissionId: 'GFORM-SYNTH-0003',
      marketingSource: 'Google Ads',
      sourceResolutionMethod: 'google_lead_form',
      campaignName: campOutdoor.campaignName,
      gclid: 'EAIaIQobChMI_synth_gclid_0003',
      deviceType: 'mobile',
      syncGa4Status: 'synced',
      trackedAt: daysAgo(3),
    },
  });

  // Lead 4: New Lead (Vừa nhận thông tin) with UTM/gclid mismatch flag
  const lead4 = await prisma.lead.create({
    data: {
      leadCode: 'TT-20261105-0004',
      companyName: 'Bệnh viện Đa khoa Quốc tế Minh Tâm',
      projectName: 'Màn hình LED Sảnh khám & Đồng hồ LED',
      normalizedLookupKey: 'benh vien da khoa quoc te minh tam|man hinh led sanh kham dong ho led',
      contactName: 'Bác sĩ Khanh',
      phone: '0908100204',
      email: 'khanh.bv@minhtam-synthetic.vn',
      contactChannel: 'form_web',
      sourceWebsite: 'bangled.vn',
      areaType: 'tphcm',
      province: 'TP. Hồ Chí Minh',
      district: 'Quận 10',
      installationAddress: 'Đường 3 Tháng 2, Quận 10',
      pipelineStatus: 'new_lead',
      assignedSalesId: sales1.id,
      createdByActorType: 'webhook',
      createdByActorRef: 'website_webhook:bangled.vn',
      contactedAt: daysAgo(1),
    },
  });
  await prisma.leadProduct.createMany({
    data: [
      { leadId: lead4.id, productId: 1, requestedDimension: 'Sảnh chính 5m x 3m' },
      { leadId: lead4.id, productId: 17, requestedDimension: '15 Đồng hồ LED đồng bộ NTP' },
    ],
  });
  await prisma.marketingTracking.create({
    data: {
      leadId: lead4.id,
      campaignId: campIndoor.id,
      intakeChannel: 'form_web',
      intakeSourceProvider: 'website_webhook',
      intakeSourceAccountKey: 'bangled.vn',
      externalSubmissionId: 'SYNTH-WEB-0004',
      marketingSource: 'Google Ads',
      sourceResolutionMethod: 'gclid_retried',
      utmSource: 'facebook',
      utmMedium: 'social',
      utmCampaign: 'board_factory_2026',
      campaignName: campIndoor.campaignName,
      gclid: 'EAIaIQobChMI_synth_gclid_0004',
      isUtmGclidMismatch: true,
      landingPageUrl: 'https://bangled.vn/dong-ho-led-benh-vien',
      deviceType: 'mobile',
      trackedAt: daysAgo(1),
    },
  });

  // Lead 5: Duplicate Alert (Red highlight because Lead 4 is in 'new_lead' with same phone/company) + Price Check Alert
  const lead5 = await prisma.lead.create({
    data: {
      leadCode: 'TT-20261105-0005',
      companyName: 'Cửa hàng LED Thương mại Sao Việt (Nghi khảo giá)',
      projectName: 'Hỏi giá lẻ nhiều kích thước P2/P3/P4',
      normalizedLookupKey: 'cua hang led thuong mai sao viet|hoi gia le nhieu kich thuoc p2 p3 p4',
      contactName: 'Tuấn Khảo Giá',
      phone: '0908999888',
      email: 'tuankhaogia@saoviet-synthetic.vn',
      contactChannel: 'zalo',
      areaType: 'tphcm',
      province: 'TP. Hồ Chí Minh',
      district: 'Quận Tân Bình',
      pipelineStatus: 'new_lead',
      assignedSalesId: sales2.id,
      createdByUserId: sales2.id,
      createdByActorType: 'user',
      createdByActorRef: `user:${sales2.id}`,
      isSuspectedPriceCheck: true,
      isSpam: true,
      spamReason: 'Đối thủ khảo giá',
      spamAdsExclusionStatus: 'pending_confirm',
      contactedAt: daysAgo(1),
    },
  });
  await prisma.leadProduct.create({
    data: {
      leadId: lead5.id,
      productId: 8,
      customProductName: 'Hỏi báo giá rời từng tấm cabinet P2.5 không thi công',
    },
  });
  await prisma.marketingTracking.create({
    data: {
      leadId: lead5.id,
      intakeChannel: 'zalo',
      intakeSourceProvider: 'manual',
      intakeSourceAccountKey: 'internal',
      marketingSource: 'Nhập tay',
      sourceResolutionMethod: 'manual',
      trackedAt: daysAgo(1),
    },
  });
  await prisma.priceCheckAlert.create({
    data: {
      leadId: lead5.id,
      phone: lead5.phone,
      companyName: lead5.companyName,
      normalizedLookupKey: 'cua hang led thuong mai sao viet',
      reason: 'Chỉ hỏi giá vật tư module rời hàng loạt nhưng từ chối cung cấp địa chỉ công trình lắp đặt thực tế.',
      chatScreenshotUrl: 'leads/chat-pricecheck-lead-5.png',
      status: 'active',
      createdByUserId: sales2.id,
    },
  });

  // 3. Platform Daily Metrics, Sync Logs & Reconciliation (M02)
  const todayStr = now.toISOString().slice(0, 10);
  const yesterdayStr = daysAgo(1).toISOString().slice(0, 10);
  const twoDaysAgoStr = daysAgo(2).toISOString().slice(0, 10);

  await prisma.platformDailyMetric.createMany({
    data: [
      {
        platform: 'google_ads',
        accountPropertyId: 'GADS-TT-01',
        metricDate: yesterdayStr,
        grain: 'campaign',
        campaignExternalId: campIndoor.campaignCode,
        keywordMatchType: '',
        keywordTextNorm: '',
        pagePathNorm: '',
        dimensionFingerprint: `google_ads|GADS-TT-01|${yesterdayStr}|campaign|${campIndoor.campaignCode}|||`,
        campaignId: campIndoor.id,
        campaignName: campIndoor.campaignName,
        currencyCode: 'VND',
        spendMicros: 14_500_000_000_000n, // 14,500,000 VND
        dailyBudgetMicros: 3_500_000_000_000n,
        cpcMicros: 29_000_000_000n, // 29,000 VND
        impressions: 8420,
        clicks: 500,
        conversionsMicros: 12_000_000n,
        googleLeadFormCount: 4,
        isFinalized: true,
      },
      {
        platform: 'google_ads',
        accountPropertyId: 'GADS-TT-01',
        metricDate: yesterdayStr,
        grain: 'campaign',
        campaignExternalId: campOutdoor.campaignCode,
        keywordMatchType: '',
        keywordTextNorm: '',
        pagePathNorm: '',
        dimensionFingerprint: `google_ads|GADS-TT-01|${yesterdayStr}|campaign|${campOutdoor.campaignCode}|||`,
        campaignId: campOutdoor.id,
        campaignName: campOutdoor.campaignName,
        currencyCode: 'VND',
        spendMicros: 19_200_000_000_000n, // 19,200,000 VND
        dailyBudgetMicros: 5_000_000_000_000n,
        cpcMicros: 32_000_000_000n, // 32,000 VND
        impressions: 11200,
        clicks: 600,
        conversionsMicros: 9_000_000n,
        googleLeadFormCount: 3,
        isFinalized: true,
      },
      {
        platform: 'google_ads',
        accountPropertyId: 'GADS-TT-01',
        metricDate: yesterdayStr,
        grain: 'keyword',
        campaignExternalId: campIndoor.campaignCode,
        keywordMatchType: 'PHRASE',
        keywordTextNorm: 'báo giá màn hình led hội trường p2.5',
        pagePathNorm: '',
        dimensionFingerprint: `google_ads|GADS-TT-01|${yesterdayStr}|keyword|${campIndoor.campaignCode}|PHRASE|báo giá màn hình led hội trường p2.5|`,
        campaignId: campIndoor.id,
        campaignName: campIndoor.campaignName,
        keywordRaw: 'báo giá màn hình led hội trường P2.5',
        currencyCode: 'VND',
        spendMicros: 6_800_000_000_000n,
        cpcMicros: 27_200_000_000n,
        impressions: 3200,
        clicks: 250,
        conversionsMicros: 7_000_000n,
        isFinalized: true,
      },
      {
        platform: 'search_console',
        accountPropertyId: 'https://toantrung.com.vn',
        metricDate: yesterdayStr,
        grain: 'keyword',
        campaignExternalId: '',
        keywordMatchType: '',
        keywordTextNorm: 'báo giá màn hình led hội trường p2.5',
        pagePathNorm: '/man-hinh-led-hoi-truong',
        dimensionFingerprint: `search_console|https://toantrung.com.vn|${yesterdayStr}|keyword|||báo giá màn hình led hội trường p2.5|/man-hinh-led-hoi-truong`,
        keywordRaw: 'báo giá màn hình led hội trường P2.5',
        pageUrlRaw: 'https://toantrung.com.vn/man-hinh-led-hoi-truong',
        impressions: 4100,
        clicks: 318,
        avgPosition: 3.2,
        isFinalized: true,
      },
      {
        platform: 'ga4',
        accountPropertyId: 'GA4-TOANTRUNG-MAIN',
        metricDate: yesterdayStr,
        grain: 'page',
        campaignExternalId: '',
        keywordMatchType: '',
        keywordTextNorm: '',
        pagePathNorm: '/man-hinh-led-hoi-truong',
        dimensionFingerprint: `ga4|GA4-TOANTRUNG-MAIN|${yesterdayStr}|page||||/man-hinh-led-hoi-truong`,
        pageUrlRaw: 'https://toantrung.com.vn/man-hinh-led-hoi-truong',
        pageViews: 1280,
        avgTimeOnPageSec: 164.5,
        isFinalized: true,
      },
    ],
  });

  await prisma.platformSyncLog.createMany({
    data: [
      {
        platform: 'google_ads',
        accountPropertyId: 'GADS-TT-01',
        runType: 'full',
        windowStartDate: daysAgo(30).toISOString().slice(0, 10),
        windowEndDate: todayStr,
        recordsSynced: 42,
        status: 'success',
        consecutiveFailures: 0,
        startedAt: daysAgo(0),
        completedAt: daysAgo(0),
      },
      {
        platform: 'ga4',
        accountPropertyId: 'GA4-TOANTRUNG-MAIN',
        runType: 'full',
        windowStartDate: daysAgo(7).toISOString().slice(0, 10),
        windowEndDate: todayStr,
        recordsSynced: 18,
        status: 'success',
        consecutiveFailures: 0,
        startedAt: daysAgo(0),
        completedAt: daysAgo(0),
      },
      {
        platform: 'search_console',
        accountPropertyId: 'https://toantrung.com.vn',
        runType: 'full',
        windowStartDate: daysAgo(7).toISOString().slice(0, 10),
        windowEndDate: todayStr,
        recordsSynced: 25,
        status: 'success',
        consecutiveFailures: 0,
        startedAt: daysAgo(0),
        completedAt: daysAgo(0),
      },
    ],
  });

  await prisma.leadReconciliation.createMany({
    data: [
      {
        reconcileDate: yesterdayStr,
        platform: 'google_ads',
        accountPropertyId: 'GADS-TT-01',
        crmLeadCount: 2,
        crmErrorLogCount: 0,
        platformReportedCount: 4,
        discrepancy: 2, // >= 2 triggers UC03 Luồng D alert!
        status: 'alert_open',
      },
      {
        reconcileDate: twoDaysAgoStr,
        platform: 'google_ads',
        accountPropertyId: 'GADS-TT-01',
        crmLeadCount: 3,
        crmErrorLogCount: 0,
        platformReportedCount: 3,
        discrepancy: 0,
        status: 'ok',
      },
    ],
  });

  // 4. SEO Keywords, Articles & Revisions (M03)
  const kw1 = await prisma.seoKeyword.create({
    data: {
      keyword: 'báo giá màn hình led hội trường P2.5',
      keywordNorm: 'báo giá màn hình led hội trường p2.5',
      cachedSearchVolume: 2400,
      cachedAdsClicks: 250,
      cachedOrganicClicks: 318,
      cachedAvgPosition: 3.2,
      cacheSourceAccountKey: 'GADS-TT-01 + https://toantrung.com.vn',
      cacheWindowStartDate: daysAgo(30).toISOString().slice(0, 10),
      cacheWindowEndDate: yesterdayStr,
      cacheRefreshedAt: now,
      trendDirection: 'rising',
      recommendedPublishWindow: 'Thứ Ba / Thứ Năm 09:00 - 10:30 (Cao điểm tìm kiếm dự án B2B)',
    },
  });

  const kw2 = await prisma.seoKeyword.create({
    data: {
      keyword: 'bảng điện tử năng suất nhà máy may',
      keywordNorm: 'bảng điện tử năng suất nhà máy may',
      cachedSearchVolume: 1300,
      cachedAdsClicks: 95,
      cachedOrganicClicks: 140,
      cachedAvgPosition: 5.8,
      cacheSourceAccountKey: 'GADS-TT-01 + https://bangled.vn',
      cacheWindowStartDate: daysAgo(30).toISOString().slice(0, 10),
      cacheWindowEndDate: yesterdayStr,
      cacheRefreshedAt: now,
      trendDirection: 'stable',
      recommendedPublishWindow: 'Thứ Tư 08:30 - 10:00',
    },
  });

  const art1 = await prisma.seoArticle.create({
    data: {
      keywordId: kw1.id,
      topic: 'Kinh nghiệm chọn màn hình LED Hội trường P2.5 và công nghệ GOB chống va đập',
      title: 'Hướng dẫn chọn Màn hình LED Hội trường P2.5 chuẩn kỹ thuật năm 2026',
      slug: 'huong-dan-chon-man-hinh-led-hoi-truong-p2-5-2026',
      metaDescription: 'Tư vấn thông số kỹ thuật, khoảng cách nhìn và giải pháp module LED P2.5 Indoor / GOB cho hội trường doanh nghiệp.',
      aiSuggestedOutline: JSON.stringify([
        'H2: Tiêu chuẩn khoảng cách nhìn cho màn hình LED hội trường P2.5',
        'H2: So sánh công nghệ SMD truyền thống và phủ keo GOB chống ẩm',
        'H2: Quy trình khảo sát kết cấu khung và nguồn điện 3 pha tại Toàn Trung',
      ]),
      contentHtml:
        '<h2>1. Tiêu chuẩn khoảng cách nhìn cho màn hình LED hội trường P2.5</h2><p>Với mật độ điểm ảnh 160.000 điểm/m2, màn hình LED P2.5 Indoor mang lại độ sắc nét tối ưu ở khoảng cách từ 2.5m trở lên...</p><h2>2. Công nghệ phủ keo GOB bảo vệ bóng LED</h2><p>Giải pháp GOB giúp chống va đập và chống ẩm hiệu quả cho hội trường đa năng.</p>',
      targetWebsite: 'toantrung.com.vn',
      status: 'published',
      publishedAt: daysAgo(15),
      publishedUrl: 'https://toantrung.com.vn/tin-tuc/huong-dan-chon-man-hinh-led-hoi-truong-p2-5-2026',
      cachedOrganicClicks: 318,
      cachedAvgPosition: 3.2,
      cachedAvgTimeOnPageSec: 164.5,
      metricsRefreshedAt: now,
      needsOptimization: false,
      createdByUserId: mktStaff.id,
      approvedByUserId: mktLead.id,
      approvedAt: daysAgo(16),
    },
  });

  const rev1 = await prisma.seoArticleRevision.create({
    data: {
      articleId: art1.id,
      revisionNumber: 1,
      originType: 'ai_initial_draft',
      title: art1.title,
      metaDescription: art1.metaDescription,
      contentHtml: art1.contentHtml,
      changeNote: 'Bản nháp đầu tiên do AI đề xuất theo từ khóa mục tiêu.',
      editedByUserId: mktStaff.id,
    },
  });

  const rev2 = await prisma.seoArticleRevision.create({
    data: {
      articleId: art1.id,
      revisionNumber: 2,
      originType: 'human_edit',
      title: art1.title,
      metaDescription: art1.metaDescription,
      contentHtml: `${art1.contentHtml}<p><em>Biên tập bổ sung hình ảnh thực tế công trình Ballroom do đội ngũ kỹ thuật Toàn Trung lắp đặt.</em></p>`,
      changeNote: 'Chèn ảnh công trình thực tế và chuẩn hóa thông số kỹ thuật trước khi duyệt đăng.',
      editedByUserId: mktStaff.id,
    },
  });

  await prisma.seoArticle.update({
    where: { id: art1.id },
    data: {
      currentRevisionId: rev2.id,
      approvedRevisionId: rev2.id,
      contentHtml: rev2.contentHtml,
    },
  });

  // Article 2: Older article (>30 days, low position -> needsOptimization = true per UC05 9a)
  const art2 = await prisma.seoArticle.create({
    data: {
      keywordId: kw2.id,
      topic: 'Ứng dụng bảng điện tử năng suất kết nối PLC Modbus trong nhà máy may',
      title: 'Giải pháp Bảng điện tử theo dõi năng suất chuyền may thời gian thực',
      slug: 'giai-phap-bang-dien-tu-nang-suat-chuyen-may',
      metaDescription: 'Tự động hóa hiển thị sản lượng mục tiêu, thực tế và tỷ lệ hoàn thành trên bảng LED điện tử nhà máy.',
      aiSuggestedOutline: JSON.stringify([
        'H2: Cấu trúc bảng LED năng suất chuyền may',
        'H2: Kết nối chuẩn công nghiệp RS485 Modbus',
      ]),
      contentHtml:
        '<h2>1. Cấu trúc bảng LED năng suất chuyền may</h2><p>Hiển thị trực quan Kế hoạch - Thực đạt - Chênh lệch theo từng giờ làm việc...</p>',
      targetWebsite: 'bangled.vn',
      status: 'published',
      publishedAt: daysAgo(45),
      publishedUrl: 'https://bangled.vn/tin-tuc/giai-phap-bang-dien-tu-nang-suat-chuyen-may',
      cachedOrganicClicks: 18,
      cachedAvgPosition: 14.6,
      cachedAvgTimeOnPageSec: 52.0,
      metricsRefreshedAt: now,
      needsOptimization: true,
      createdByUserId: mktStaff.id,
      approvedByUserId: mktLead.id,
      approvedAt: daysAgo(46),
    },
  });

  const revArt2 = await prisma.seoArticleRevision.create({
    data: {
      articleId: art2.id,
      revisionNumber: 1,
      originType: 'ai_initial_draft',
      title: art2.title,
      metaDescription: art2.metaDescription,
      contentHtml: art2.contentHtml,
      changeNote: 'Bản xuất bản ban đầu (cần tối ưu lại sau 30 ngày do vị trí trung bình 14.6).',
      editedByUserId: mktStaff.id,
    },
  });

  await prisma.seoArticle.update({
    where: { id: art2.id },
    data: {
      currentRevisionId: revArt2.id,
      approvedRevisionId: revArt2.id,
    },
  });

  await prisma.aiUsageLog.create({
    data: {
      idempotencyKey: 'seed-seo-art1-ai-draft',
      attemptNumber: 1,
      providerRequestId: 'gemini-seo-req-001',
      moduleCode: '03-keywords-ads',
      taskType: 'seo_draft',
      userId: mktStaff.id,
      seoArticleId: art1.id,
      modelName: 'gemini-2.5-flash',
      promptTokens: 420,
      completionTokens: 1180,
      totalTokens: 1600,
      costMicros: 12_500n, // $0.0125 USD
      costCurrency: 'USD',
      durationMs: 2840,
      status: 'success',
    },
  });

  // 5. Design Requests & Asset Versions (M05)
  // 5a. 3D Perspective linked to Lead 1
  const design3d = await prisma.designRequest.create({
    data: {
      leadId: lead1.id,
      requestedBySalesId: sales1.id,
      assignedDesignerId: designer.id,
      requestType: '3d_perspective',
      ledCategory: 'Màn hình LED Indoor P2.5 + Phủ GOB',
      screenDimensions: 'Ngang 8.0m x Cao 4.0m (Tỷ lệ 2:1)',
      aspectRatio: '16:9',
      installPositionJson: JSON.stringify({ x: 15, y: 20, w: 70, h: 42 }),
      sitePhotoUrl: 'leads/site-photo-lead-1.png',
      prompt: 'Phối cảnh màn hình LED P2.5 phẳng 8m x 4m lắp âm tường chính giữa sân khấu Ballroom, ánh sáng vàng ấm sang trọng.',
      designStatus: 'completed',
      aiDraftImageUrl: 'design/design-3d-v1-draft.png',
      finalRenderUrl: 'design/design-3d-v2-final.png',
      processingTimeMs: 4120,
      tokenCost: 2450,
      totalCostMicros: 38_000n, // $0.038 USD
      costCurrency: 'USD',
      notes: 'Đã tinh chỉnh ánh sáng phản chiếu sàn thảm bằng Photoshop và bàn giao cho Sales.',
      completedAt: daysAgo(9),
    },
  });

  const aiLog3d = await prisma.aiUsageLog.create({
    data: {
      idempotencyKey: 'seed-design-3d-req-1-v1',
      attemptNumber: 1,
      providerRequestId: 'imagen-3d-req-001',
      moduleCode: '05-ai-design',
      taskType: '3d_perspective',
      userId: designer.id,
      designRequestId: design3d.id,
      modelName: 'imagen-3.0-generate',
      promptTokens: 350,
      completionTokens: 2100,
      totalTokens: 2450,
      costMicros: 38_000n,
      costCurrency: 'USD',
      durationMs: 4120,
      status: 'success',
    },
  });

  await prisma.designAssetVersion.create({
    data: {
      designRequestId: design3d.id,
      versionNumber: 1,
      versionType: 'ai_draft',
      storageObjectKey: 'design/design-3d-v1-draft.png',
      mimeType: 'image/png',
      fileSizeBytes: samplePng.length,
      promptUsed: design3d.prompt,
      parametersJson: JSON.stringify({ widthM: 8, heightM: 4, module: 'P2.5 GOB' }),
      aiUsageLogId: aiLog3d.id,
      uploadedByUserId: designer.id,
      isApprovedFinal: false,
    },
  });

  const v2Final = await prisma.designAssetVersion.create({
    data: {
      designRequestId: design3d.id,
      versionNumber: 2,
      versionType: 'final_render',
      storageObjectKey: 'design/design-3d-v2-final.png',
      mimeType: 'image/png',
      fileSizeBytes: samplePng.length,
      promptUsed: 'Bản hoàn thiện Photoshop/3DsMax từ nháp AI v1',
      parametersJson: JSON.stringify({ widthM: 8, heightM: 4, postProcessed: true }),
      uploadedByUserId: designer.id,
      isApprovedFinal: true,
    },
  });

  await prisma.designRequest.update({
    where: { id: design3d.id },
    data: { approvedVersionId: v2Final.id },
  });

  // 5b. Independent Banner without Lead (UC06 2a: leadId = null)
  const designBanner = await prisma.designRequest.create({
    data: {
      leadId: null,
      requestedBySalesId: null,
      assignedDesignerId: designer.id,
      requestType: 'banner',
      ledCategory: 'Banner Chiến dịch Màn hình LED Khuyến mãi Q4',
      screenDimensions: '1920x1080px',
      aspectRatio: '16:9',
      prompt: 'Banner tông xanh dương và trắng hiện đại giới thiệu giải pháp Màn hình LED Hội trường & Bảng điện tử công nghiệp.',
      designStatus: 'ai_drafting',
      aiDraftImageUrl: 'design/design-banner-v1-draft.png',
      processingTimeMs: 3250,
      tokenCost: 1850,
      totalCostMicros: 24_000n, // $0.024 USD
      costCurrency: 'USD',
      notes: 'Ấn phẩm truyền thông độc lập không gắn Lead (UC06 Luồng phụ 2a).',
    },
  });

  const aiLogBanner = await prisma.aiUsageLog.create({
    data: {
      idempotencyKey: 'seed-design-banner-req-2-v1',
      attemptNumber: 1,
      providerRequestId: 'imagen-banner-req-002',
      moduleCode: '05-ai-design',
      taskType: 'banner',
      userId: designer.id,
      designRequestId: designBanner.id,
      modelName: 'imagen-3.0-generate',
      promptTokens: 250,
      completionTokens: 1600,
      totalTokens: 1850,
      costMicros: 24_000n,
      costCurrency: 'USD',
      durationMs: 3250,
      status: 'success',
    },
  });

  await prisma.designAssetVersion.create({
    data: {
      designRequestId: designBanner.id,
      versionNumber: 1,
      versionType: 'ai_draft',
      storageObjectKey: 'design/design-banner-v1-draft.png',
      mimeType: 'image/png',
      fileSizeBytes: samplePng.length,
      promptUsed: designBanner.prompt,
      parametersJson: JSON.stringify({ widthPx: 1920, heightPx: 1080, aspectRatio: '16:9' }),
      aiUsageLogId: aiLogBanner.id,
      uploadedByUserId: designer.id,
      isApprovedFinal: false,
    },
  });
}

async function main() {
  for (const r of BA_ROLES) {
    await prisma.role.upsert({
      where: { roleCode: r.roleCode },
      update: { roleName: r.roleName, description: r.description },
      create: r,
    });
  }

  await syncAuthoritativeProducts(prisma);

  await prisma.systemSetting.deleteMany({
    where: {
      key: { in: UNAPPROVED_SLA_KEYS },
      updatedById: null,
    },
  });

  const defaultSettings = [
    { key: 'organizationName', value: 'Toàn Trung' },
    { key: 'workspaceName', value: 'Không gian làm việc' },
    { key: 'loginHeadline', value: 'Đăng nhập' },
    { key: 'loginSubheadline', value: 'Chào mừng bạn quay trở lại hệ thống nội bộ Toàn Trung' },
    { key: 'footerText', value: '© 2026 Toàn Trung · Hệ thống quản lý nội bộ dành cho nhân sự công ty' },
    { key: 'logoAltText', value: 'Logo Công ty Toàn Trung' },
    { key: 'heroAltText', value: 'Không gian trưng bày giải pháp màn hình LED Toàn Trung' },
    { key: 'heroCoverPosition', value: 'center' },
    { key: 'baQuoteUnrespondedWarningDays', value: '7' },
    { key: 'baGclidRetryWindowDays', value: '7' },
    { key: 'baReconciliationDiscrepancyThreshold', value: '2' },
    { key: 'baSyncConsecutiveFailureAlertThreshold', value: '3' },
    { key: 'baSeoOptimizationReviewDays', value: '30' },
  ];

  for (const s of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }

  const shouldSeedAccounts = process.env.SKIP_SEED_ACCOUNTS !== 'true';
  if (shouldSeedAccounts) {
    const seedPassword = process.env.SEED_DEV_PASSWORD || 'ToanTrung@2026';
    const passwordHash = hashPassword(seedPassword);

    const rolesByCode = {};
    const allRoles = await prisma.role.findMany();
    for (const r of allRoles) {
      rolesByCode[r.roleCode] = r;
    }

    const devAccounts = [
      {
        email: 'admin@toantrung.vn',
        fullName: 'Nguyễn Quản Trị',
        phone: '0903111222',
        department: 'admin',
        specialtyGroup: null,
        isReceivingLeads: false,
        isOnline: true,
        roleId: rolesByCode.ADMIN.id,
      },
      {
        email: 'sales@toantrung.vn',
        fullName: 'Trần Kinh Doanh',
        phone: '0903222333',
        department: 'sales',
        specialtyGroup: 'led_screen',
        isReceivingLeads: true,
        isOnline: true,
        roleId: rolesByCode.SALES.id,
      },
      {
        email: 'sales2@toantrung.vn',
        fullName: 'Lý Kinh Doanh 2',
        phone: '0903222334',
        department: 'sales',
        specialtyGroup: 'electronic_board',
        isReceivingLeads: true,
        isOnline: true,
        roleId: rolesByCode.SALES.id,
      },
      {
        email: 'marketing@toantrung.vn',
        fullName: 'Lê Truyền Thông',
        phone: '0903333444',
        department: 'marketing',
        specialtyGroup: null,
        isReceivingLeads: false,
        isOnline: true,
        roleId: rolesByCode.MKT_STAFF.id,
      },
      {
        email: 'designer@toantrung.vn',
        fullName: 'Phạm Thiết Kế',
        phone: '0903444555',
        department: 'marketing',
        specialtyGroup: null,
        isReceivingLeads: false,
        isOnline: true,
        roleId: rolesByCode.DESIGNER.id,
      },
      {
        email: 'ads@toantrung.vn',
        fullName: 'Hoàng Quảng Cáo Ads',
        phone: '0903555666',
        department: 'marketing',
        specialtyGroup: null,
        isReceivingLeads: false,
        isOnline: true,
        roleId: rolesByCode.ADS.id,
      },
      {
        email: 'mkt.lead@toantrung.vn',
        fullName: 'Võ Trưởng Phòng Marketing',
        phone: '0903666777',
        department: 'marketing',
        specialtyGroup: null,
        isReceivingLeads: false,
        isOnline: true,
        roleId: rolesByCode.MKT_LEAD.id,
      },
      {
        email: 'sales.lead@toantrung.vn',
        fullName: 'Đặng Trưởng Phòng Sales',
        phone: '0903777888',
        department: 'sales',
        specialtyGroup: 'electronic_board',
        isReceivingLeads: true,
        isOnline: true,
        roleId: rolesByCode.SALES_LEAD.id,
      },
      {
        email: 'bod@toantrung.vn',
        fullName: 'Bùi Giám Đốc',
        phone: '0903888999',
        department: 'management',
        specialtyGroup: null,
        isReceivingLeads: false,
        isOnline: true,
        roleId: rolesByCode.BOD.id,
      },
    ];

    const usersByEmail = {};
    for (const acc of devAccounts) {
      const user = await prisma.user.upsert({
        where: { email: acc.email },
        update: {
          fullName: acc.fullName,
          roleId: acc.roleId,
          department: acc.department,
          specialtyGroup: acc.specialtyGroup,
          isReceivingLeads: acc.isReceivingLeads,
          isOnline: acc.isOnline,
          passwordHash,
          isActive: true,
        },
        create: {
          ...acc,
          passwordHash,
          isActive: true,
        },
      });
      usersByEmail[acc.email] = user;

      const count = await prisma.notification.count({ where: { userId: user.id } });
      if (count === 0) {
        const isExec = acc.roleId === rolesByCode.BOD.id || acc.roleId === rolesByCode.ADMIN.id;
        const isSales =
          acc.roleId === rolesByCode.SALES.id || acc.roleId === rolesByCode.SALES_LEAD.id;
        const isMkt =
          acc.roleId === rolesByCode.MKT_STAFF.id || acc.roleId === rolesByCode.MKT_LEAD.id;
        const isAds = acc.roleId === rolesByCode.ADS.id;
        const isDesign = acc.roleId === rolesByCode.DESIGNER.id;

        const seedNotifications = [];
        if (isExec || isSales) {
          seedNotifications.push({
            userId: user.id,
            title: 'Nhắc lịch liên hệ lại báo giá dự án B2B',
            summary:
              'Hồ sơ TT-20261102-0002 (Nhà máy Đông Á) đã gửi báo giá 9 ngày, cần liên hệ khách hàng cập nhật tiến độ phê duyệt.',
            category: 'Phòng Kinh doanh',
            actionLabel: 'Mở hồ sơ Lead',
            actionUrl: '/leads',
            requiredPermission: 'LEAD_VIEW_OWN',
            isRead: false,
          });
        }
        if (isExec || isMkt) {
          seedNotifications.push({
            userId: user.id,
            title: 'Cập nhật nội dung SEO & Từ khóa tìm kiếm tuần mới',
            summary:
              'Từ khóa "báo giá màn hình led hội trường P2.5" tăng trưởng tốt ở vị trí #3.2 trên Google Search Console.',
            category: 'Phòng Marketing & SEO',
            actionLabel: 'Mở Quảng cáo & SEO',
            actionUrl: '/ads',
            requiredPermission: 'SEO_KEYWORD_MANAGE',
            isRead: false,
          });
        }
        if (isExec || isAds) {
          seedNotifications.push({
            userId: user.id,
            title: 'Đồng bộ số liệu Chiến dịch Google Ads & Đối soát Lead',
            summary:
              'Đã đồng bộ chi phí quảng cáo và đối chiếu Lead hợp lệ (L2/L3) từ các chiến dịch đang chạy.',
            category: 'Bộ phận Quảng cáo Ads',
            actionLabel: 'Xem Chiến dịch Ads',
            actionUrl: '/ads',
            requiredPermission: 'ADS_CAMPAIGN_VIEW',
            isRead: false,
          });
        }
        if (isExec || isDesign) {
          seedNotifications.push({
            userId: user.id,
            title: 'Bản vẽ Phối cảnh 3D Hội trường đã sẵn sàng bàn giao',
            summary:
              'Phương án phối cảnh màn hình LED P2.5 tại Trung tâm Hội nghị Ánh Dương đã hoàn tất dựng hình kỹ thuật.',
            category: 'Bộ phận Thiết kế',
            actionLabel: 'Mở Thiết kế AI',
            actionUrl: '/design',
            requiredPermission: 'DESIGN_REQUEST_CREATE_VIEW',
            isRead: false,
          });
        }

        await prisma.notification.createMany({
          data: seedNotifications,
        });
      }
    }

    await seedSyntheticModuleData(usersByEmail);

    console.log(
      `Đã khởi tạo 8 vai trò BA, ${BA_PRODUCTS_AUTHORITATIVE.length} sản phẩm chuẩn BA, ${devAccounts.length} tài khoản và dữ liệu tổng hợp cho cả 5 phân hệ.`,
    );
  }
}

module.exports = {
  BA_ROLES,
  BA_PRODUCTS_AUTHORITATIVE,
  UNAPPROVED_SLA_KEYS,
  syncAuthoritativeProducts,
  main,
};

if (require.main === module) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
