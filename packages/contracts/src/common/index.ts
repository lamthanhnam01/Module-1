import { z } from 'zod';

/**
 * 8 BA Roles defined in docs/PERMISSIONS.md
 */
export const ROLE_CODES = [
  'SALES',
  'MKT_STAFF',
  'DESIGNER',
  'ADS',
  'MKT_LEAD',
  'SALES_LEAD',
  'BOD',
  'ADMIN',
] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export const ROLE_LABELS: Record<RoleCode, string> = {
  SALES: 'Nhân viên Kinh doanh',
  MKT_STAFF: 'Nhân viên Marketing',
  DESIGNER: 'Designer',
  ADS: 'Nhân viên Ads',
  MKT_LEAD: 'Trưởng phòng Marketing',
  SALES_LEAD: 'Trưởng phòng Sales',
  BOD: 'Giám đốc',
  ADMIN: 'Quản trị viên',
};

export const DEPARTMENTS = ['marketing', 'sales', 'management', 'admin'] as const;
export type DepartmentCode = (typeof DEPARTMENTS)[number];

export const DEPARTMENT_LABELS: Record<DepartmentCode, string> = {
  marketing: 'Phòng Marketing',
  sales: 'Phòng Kinh doanh',
  management: 'Ban Giám đốc',
  admin: 'Quản trị Hệ thống',
};

/**
 * 12 BA Permission Matrix Actions (docs/PERMISSIONS.md)
 */
export const BA_PERMISSIONS = {
  LEAD_CREATE: 'LEAD_CREATE',
  LEAD_VIEW_OWN: 'LEAD_VIEW_OWN',
  LEAD_VIEW_ALL: 'LEAD_VIEW_ALL',
  LEAD_UPDATE_PIPELINE: 'LEAD_UPDATE_PIPELINE',
  LEAD_REASSIGN: 'LEAD_REASSIGN',
  ATTACHMENT_UPLOAD_VIEW: 'ATTACHMENT_UPLOAD_VIEW',
  AI_DESIGN: 'AI_DESIGN',
  AI_MARKETING_SEO: 'AI_MARKETING_SEO',
  TRACKING_ADS_OPTIMIZE: 'TRACKING_ADS_OPTIMIZE',
  DASHBOARD_VIEW: 'DASHBOARD_VIEW',
  EXPORT_DATA: 'EXPORT_DATA',
  SYSTEM_USER_ADMIN: 'SYSTEM_USER_ADMIN',
} as const;

export type BaPermissionKey = keyof typeof BA_PERMISSIONS;

export const ROLE_PERMISSION_MATRIX: Record<RoleCode, readonly BaPermissionKey[]> = {
  SALES: [
    'LEAD_CREATE',
    'LEAD_VIEW_OWN',
    'LEAD_UPDATE_PIPELINE',
    'LEAD_REASSIGN',
    'ATTACHMENT_UPLOAD_VIEW',
    'DASHBOARD_VIEW',
    'EXPORT_DATA',
  ],
  MKT_STAFF: [
    'LEAD_VIEW_OWN',
    'LEAD_VIEW_ALL',
    'AI_MARKETING_SEO',
    'TRACKING_ADS_OPTIMIZE',
    'DASHBOARD_VIEW',
    'EXPORT_DATA',
  ],
  DESIGNER: [
    'LEAD_VIEW_OWN', // 3D, 2D LED scope per BA note
    'ATTACHMENT_UPLOAD_VIEW',
    'AI_DESIGN',
    'DASHBOARD_VIEW',
    'EXPORT_DATA',
  ],
  ADS: [
    'LEAD_VIEW_OWN',
    'LEAD_VIEW_ALL',
    'AI_MARKETING_SEO',
    'TRACKING_ADS_OPTIMIZE',
    'DASHBOARD_VIEW',
    'EXPORT_DATA',
  ],
  MKT_LEAD: [
    'LEAD_VIEW_OWN',
    'LEAD_VIEW_ALL',
    'AI_MARKETING_SEO',
    'TRACKING_ADS_OPTIMIZE',
    'DASHBOARD_VIEW',
    'EXPORT_DATA',
  ],
  SALES_LEAD: [
    'LEAD_CREATE',
    'LEAD_VIEW_OWN',
    'LEAD_VIEW_ALL',
    'LEAD_UPDATE_PIPELINE',
    'LEAD_REASSIGN',
    'ATTACHMENT_UPLOAD_VIEW',
    'DASHBOARD_VIEW',
    'EXPORT_DATA',
  ],
  BOD: [
    'LEAD_CREATE',
    'LEAD_VIEW_OWN',
    'LEAD_VIEW_ALL',
    'LEAD_UPDATE_PIPELINE',
    'LEAD_REASSIGN',
    'ATTACHMENT_UPLOAD_VIEW',
    'TRACKING_ADS_OPTIMIZE',
    'DASHBOARD_VIEW',
    'EXPORT_DATA',
  ],
  ADMIN: [
    'LEAD_CREATE',
    'LEAD_VIEW_OWN',
    'LEAD_VIEW_ALL',
    'LEAD_UPDATE_PIPELINE',
    'LEAD_REASSIGN',
    'ATTACHMENT_UPLOAD_VIEW',
    'AI_DESIGN',
    'AI_MARKETING_SEO',
    'TRACKING_ADS_OPTIMIZE',
    'DASHBOARD_VIEW',
    'EXPORT_DATA',
    'SYSTEM_USER_ADMIN',
  ],
};

export function hasBaPermission(role: RoleCode, permission: BaPermissionKey): boolean {
  return ROLE_PERMISSION_MATRIX[role]?.includes(permission) ?? false;
}

/**
 * Standard API Envelopes (docs/API_CONTRACTS.md)
 */
export interface ApiSuccess<T, M = Record<string, unknown>> {
  data: T;
  meta?: M;
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

/**
 * Auth & Session DTOs
 */
export const LoginRequestSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập email công việc hoặc tên đăng nhập.')
    .max(100, 'Tài khoản không quá 100 ký tự.'),
  password: z
    .string()
    .min(1, 'Vui lòng nhập mật khẩu.')
    .max(200, 'Mật khẩu không hợp lệ.'),
  rememberUsername: z.boolean().optional(),
});

export type LoginRequestDto = z.infer<typeof LoginRequestSchema>;

export interface SessionUserDto {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  roleCode: RoleCode;
  roleName: string;
  department: DepartmentCode;
  isActive: boolean;
  csrfToken: string;
}

/**
 * Profile DTOs
 */
export const UpdateProfileSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Họ và tên phải có ít nhất 2 ký tự.')
      .max(100, 'Họ và tên không vượt quá 100 ký tự.'),
    phone: z
      .string()
      .trim()
      .regex(/^(0|\+84)[0-9]{8,10}$/, 'Số điện thoại không đúng định dạng Việt Nam.')
      .or(z.literal(''))
      .nullable()
      .optional(),
    removeAvatar: z.boolean().optional(),
  })
  .strict();

export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại.'),
    newPassword: z
      .string()
      .min(8, 'Mật khẩu mới phải có tối thiểu 8 ký tự.')
      .max(128, 'Mật khẩu mới không quá 128 ký tự.')
      .regex(/[A-Z]/, 'Mật khẩu mới cần có ít nhất 1 chữ hoa.')
      .regex(/[a-z]/, 'Mật khẩu mới cần có ít nhất 1 chữ thường.')
      .regex(/[0-9]/, 'Mật khẩu mới cần có ít nhất 1 chữ số.'),
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu mới.'),
  })
  .refine((val) => val.newPassword === val.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp.',
    path: ['confirmPassword'],
  });

export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;

/**
 * Notifications DTOs
 */
export interface NotificationDto {
  id: number;
  title: string;
  summary: string;
  category: string;
  isRead: boolean;
  actionLabel: string | null;
  actionUrl: string | null;
  createdAt: string;
  readAt: string | null;
}

export const MarkNotificationReadSchema = z.object({
  notificationId: z.number().int().positive().optional(),
  markAll: z.boolean().optional(),
});

/**
 * Admin Users Management DTOs
 */
export interface AdminUserDto {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  roleId: number;
  roleCode: RoleCode;
  roleName: string;
  department: DepartmentCode;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const CreateUserSchema = z.object({
  fullName: z.string().trim().min(2, 'Họ tên tối thiểu 2 ký tự.').max(100),
  email: z.string().trim().toLowerCase().email('Email công việc không hợp lệ.').max(100),
  phone: z
    .string()
    .trim()
    .regex(/^(0|\+84)[0-9]{8,10}$/, 'SĐT không hợp lệ.')
    .optional()
    .or(z.literal('')),
  roleCode: z.enum(ROLE_CODES),
  department: z.enum(DEPARTMENTS),
  initialPassword: z
    .string()
    .min(8, 'Mật khẩu khởi tạo tối thiểu 8 ký tự.')
    .max(128),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z.object({
  userId: z.number().int().positive(),
  fullName: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  roleCode: z.enum(ROLE_CODES).optional(),
  department: z.enum(DEPARTMENTS).optional(),
  isActive: z.boolean().optional(),
  resetPassword: z.string().min(8).max(128).optional(),
});

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;

export const DeleteUserSchema = z.object({
  userId: z.number().int().positive('Mã tài khoản không hợp lệ.'),
});

export type DeleteUserDto = z.infer<typeof DeleteUserSchema>;

/**
 * Branding, Login Interactive Crop & Dashboard Banner DTOs
 */
export const COVER_POSITIONS = ['center', 'top', 'bottom', 'left', 'right'] as const;
export type CoverPosition = (typeof COVER_POSITIONS)[number];

export const ASSET_SLOTS = ['logo', 'login_hero', 'dashboard_banner'] as const;
export type AssetSlot = (typeof ASSET_SLOTS)[number];

export const ImageCropConfigSchema = z.object({
  zoom: z.number().min(1).max(3).default(1),
  offsetX: z.number().min(-100).max(100).default(0),
  offsetY: z.number().min(-100).max(100).default(0),
  frameScale: z.number().min(0.6).max(1).default(1),
});

export type ImageCropConfig = z.infer<typeof ImageCropConfigSchema>;

export interface BrandingAssetSlotDto {
  slot: AssetSlot;
  url: string | null;
  isDefault: boolean;
  altText: string;
  coverPosition: CoverPosition;
  crop: ImageCropConfig;
  mimeType: string | null;
  fileSizeBytes: number | null;
  width: number | null;
  height: number | null;
  updatedAt: string | null;
  updatedByName: string | null;
  recommendedSpec: string;
}

export interface DashboardBannerDto {
  headline: string;
  description: string;
  showButton: boolean;
  buttonLabel: string;
  buttonHref: string;
  showImage: boolean;
  imageUrl: string | null;
  imageAlt: string;
  isDefaultImage: boolean;
  updatedAt: string | null;
  updatedByName: string | null;
}

export interface PublicBrandingDto {
  organizationName: string;
  workspaceName: string;
  loginHeadline: string;
  loginSubheadline: string;
  footerText: string;
  logo: BrandingAssetSlotDto;
  loginHero: BrandingAssetSlotDto;
  dashboardBanner: DashboardBannerDto;
}

export const UpdateBrandingMetaSchema = z.object({
  organizationName: z.string().trim().min(2).max(100).optional(),
  workspaceName: z.string().trim().min(2).max(100).optional(),
  loginHeadline: z.string().trim().min(2).max(160).optional(),
  loginSubheadline: z.string().trim().min(2).max(300).optional(),
  footerText: z.string().trim().min(2).max(160).optional(),
  logoAltText: z.string().trim().min(2).max(150).optional(),
  heroAltText: z.string().trim().min(1).max(150).optional(),
  heroCoverPosition: z.enum(COVER_POSITIONS).optional(),
  heroCrop: ImageCropConfigSchema.optional(),
  bannerHeadline: z.string().trim().max(180).optional(),
  bannerDescription: z.string().trim().max(400).optional(),
  bannerShowButton: z.boolean().optional(),
  bannerButtonLabel: z.string().trim().max(80).optional(),
  bannerButtonHref: z.string().trim().max(200).optional(),
  bannerShowImage: z.boolean().optional(),
  bannerImageAlt: z.string().trim().max(150).optional(),
});

export type UpdateBrandingMetaDto = z.infer<typeof UpdateBrandingMetaSchema>;

/**
 * Monetary & BigInt Safe Serialization Helpers (Shared FE/BE)
 * 1 currency unit = 1,000,000 micros.
 */
export const CONTRACT_MICRO_SCALE = 1_000_000n;

export const BigIntStringSchema = z
  .string()
  .trim()
  .regex(/^-?\d+$/, 'Giá trị số nguyên lớn (BigInt) phải là chuỗi chữ số hợp lệ.');

export interface MonetaryAmountDto {
  /** Chuỗi số nguyên biểu diễn đơn vị nhỏ nhất (VNĐ nguyên hoặc micros) để JSON không mất độ chính xác */
  rawAmountString: string;
  /** Đơn vị tiền tệ gốc (VD: 'VND' | 'USD') — không tự quy đổi tỷ giá khi chưa có nguồn */
  currency: 'VND' | 'USD';
  /** Đơn vị thang đo: 'unit' (1 = 1 VNĐ) hoặc 'micros' (1,000,000 = 1 đơn vị tiền tệ) */
  scale: 'unit' | 'micros';
  /** Chuỗi thập phân hiển thị chuẩn xác (VD: "1250000" hoặc "0.0425") */
  formattedDecimal: string;
}

export function formatMicrosToDecimal(micros: bigint): string {
  const isNeg = micros < 0n;
  const abs = isNeg ? -micros : micros;
  const whole = abs / CONTRACT_MICRO_SCALE;
  const frac = abs % CONTRACT_MICRO_SCALE;
  if (frac === 0n) return `${isNeg ? '-' : ''}${whole.toString(10)}`;
  const fracStr = frac.toString(10).padStart(6, '0').replace(/0+$/, '');
  return `${isNeg ? '-' : ''}${whole.toString(10)}.${fracStr}`;
}

export function toMonetaryAmountDto(
  amount: bigint | null | undefined,
  currency: 'VND' | 'USD',
  scale: 'unit' | 'micros',
): MonetaryAmountDto | null {
  if (amount === null || amount === undefined) return null;
  return {
    rawAmountString: amount.toString(10),
    currency,
    scale,
    formattedDecimal: scale === 'micros' ? formatMicrosToDecimal(amount) : amount.toString(10),
  };
}

/**
 * Shared BA Lead Tier Predicates (L1 / L2 / L3) — Single Source of Truth for M02 & M04
 */
export function isL2Valid(lead: { isSpam: boolean }): boolean {
  return !lead.isSpam;
}

export function isL3Effective(lead: {
  isSpam: boolean;
  spamAdsExclusionStatus?: string | null;
}): boolean {
  return (
    !lead.isSpam ||
    (lead.spamAdsExclusionStatus !== 'auto_excluded' &&
      lead.spamAdsExclusionStatus !== 'confirmed_excluded')
  );
}

export function getL2PrismaWhere() {
  return { isSpam: false } as const;
}

export function getL3PrismaWhere() {
  return {
    OR: [
      { isSpam: false },
      {
        spamAdsExclusionStatus: {
          notIn: ['auto_excluded', 'confirmed_excluded'],
        },
      },
    ],
  };
}

export const REPORT_PRESETS = ['7d', '30d', 'all', 'custom'] as const;
export type ReportPreset = (typeof REPORT_PRESETS)[number];

export interface SalesPerformanceRowDto {
  salesUserId: number;
  salesFullName: string;
  isOnline: boolean;
  isReceivingLeads: boolean;
  totalLeads: number;
  newLeads: number;
  quotingLeads: number;
  quoteSentLeads: number;
  wonLeads: number;
  lostLeads: number;
  unansweredOverdue7d: number;
  winRateText: string;
}

export interface ProductInsightRowDto {
  productId: number;
  productCode: string;
  productName: string;
  category: 'MAN_HINH_LED' | 'BANG_DIEN_TU' | 'KHAC';
  inquiryCount: number;
  wonCount: number;
}

export interface UnansweredQuoteItemDto {
  leadId: number;
  leadCode: string;
  companyOrContact: string;
  phone: string;
  assignedSalesName: string;
  quoteSentAt: string;
  daysWaiting: number;
  isOverdue7Days: boolean;
  productSummary: string;
}

export interface DetailedReportLeadRowDto {
  stt: number;
  leadCode: string;
  receivedAt: string;
  assignedSalesName: string;
  companyOrCustomer: string;
  phone: string;
  contactChannel: string;
  marketingSource: string;
  productsText: string;
  pipelineStatusLabel: string;
  noteOrReason: string;
  isAnonymized: boolean;
}

export interface ActionableTaskItemDto {
  id:
    | 'unaccepted_leads'
    | 'overdue_quotes'
    | 'pending_designs'
    | 'seo_approvals'
    | 'publication_failures'
    | 'sync_failures';
  title: string;
  description: string;
  count: number;
  severity: 'critical' | 'warning' | 'info';
  moduleLabel: string;
  href: string;
}

export interface MarketingSourcePerformanceRowDto {
  key: string;
  sourceName: string;
  campaignName: string;
  spend: MonetaryAmountDto | null;
  platformConversions: number;
  crmLeadsL1: number;
  crmValidL2: number;
  crmEffectiveL3: number;
  wonCount: number;
}

export interface LeadTrendPointDto {
  date: string;
  label: string;
  totalL1: number;
  validL2: number;
  wonCount: number;
}

export interface ReportsDashboardDto {
  scopeRole: string;
  scopeDescription: string;
  preset: ReportPreset;
  fromDate: string;
  toDate: string;
  generatedAt: string;
  isSmallSample: boolean;
  smallSampleNotice: string | null;
  todayPreliminaryNotice: string;
  lastSyncedAt: string | null;
  overview: {
    totalLeadsL1: number;
    validLeadsL2: number;
    effectiveLeadsL3: number;
    activeLeadsCount: number;
    unreceivedLeadsCount: number;
    newLeadCount: number;
    quotingCount: number;
    quoteSentCount: number;
    wonCount: number;
    lostCount: number;
    unansweredQuoteCount: number;
    overdue7DaysQuoteCount: number;
    winRateText: string;
  };
  leadTrend: LeadTrendPointDto[];
  actionableTasks: ActionableTaskItemDto[];
  byChannel: Array<{
    channel: string;
    label: string;
    count: number;
  }>;
  salesPerformance: SalesPerformanceRowDto[];
  productInsights: ProductInsightRowDto[];
  unansweredQuotes: UnansweredQuoteItemDto[];
  marketingSummary: {
    totalAdsSpend: MonetaryAmountDto | null;
    platformReportedConversions: number;
    effectiveLeadsFromAds: number;
    cplEffective: MonetaryAmountDto | null;
    publishedSeoArticles: number;
    draftSeoArticles: number;
    scheduledSeoArticles: number;
    failedPublishArticles: number;
    optimizationNeededArticles: number;
    bySourceCampaign: MarketingSourcePerformanceRowDto[];
  };
  trackingOperationalSummary: {
    liveIntegrationMode: boolean;
    configuredConnectionsCount: number;
    totalConnectionsCount: number;
    openAlertsCount: number;
    failingConnectionsCount: number;
    gclidPendingRetryCount: number;
    wordpressConfigured: boolean;
    geminiConfigured: boolean;
  };
  designSummary: {
    totalRequests: number;
    pendingCount: number;
    inReviewCount: number;
    completed3dCount: number;
    completedBannerCount: number;
    avgProcessingSecText: string;
    totalAiTokens: number;
    totalAiCost: MonetaryAmountDto | null;
  };
  detailedLeads: DetailedReportLeadRowDto[];
}

