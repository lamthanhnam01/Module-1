import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { prisma } from '@toantrung/database';
import type {
  AssetSlot,
  CoverPosition,
  ImageCropConfig,
  PublicBrandingDto,
  UpdateBrandingMetaDto,
} from '@toantrung/contracts';
import { APP_CONFIG } from '../config';
import { recordAuditLog } from '../audit';
import { validateAndSanitizeImageBuffer } from './image-validator';

function getBrandingStorageDir(): string {
  const dir = path.join(APP_CONFIG.getStorageRoot(), 'branding');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const DEFAULT_BRANDING: PublicBrandingDto = {
  organizationName: 'Toàn Trung',
  workspaceName: 'Không gian làm việc',
  loginHeadline: 'Đăng nhập',
  loginSubheadline: 'Chào mừng bạn quay trở lại hệ thống nội bộ Toàn Trung',
  footerText: '© 2026 Toàn Trung · Hệ thống quản lý nội bộ dành cho nhân sự công ty',
  logo: {
    slot: 'logo',
    url: APP_CONFIG.defaultLogoUrl,
    isDefault: true,
    altText: 'Logo Công ty Toàn Trung',
    coverPosition: 'center',
    crop: { zoom: 1, offsetX: 0, offsetY: 0, frameScale: 1 },
    mimeType: 'image/png',
    fileSizeBytes: null,
    width: 280,
    height: 80,
    updatedAt: null,
    updatedByName: null,
    recommendedSpec: 'Kích thước khuyến nghị: 280x80px (PNG trong suốt, tối đa 2MB)',
  },
  loginHero: {
    slot: 'login_hero',
    url: APP_CONFIG.defaultHeroUrl,
    isDefault: true,
    altText: 'Không gian trưng bày giải pháp màn hình LED Toàn Trung',
    coverPosition: 'center',
    crop: { zoom: 1, offsetX: 0, offsetY: 0, frameScale: 1 },
    mimeType: 'image/webp',
    fileSizeBytes: null,
    width: 1920,
    height: 1080,
    updatedAt: null,
    updatedByName: null,
    recommendedSpec: 'Kích thước khuyến nghị: 1920x1080px (JPG/WebP chất lượng cao, tối đa 5MB)',
  },
  dashboardBanner: {
    headline: 'Toàn Trung LED Portal',
    description: 'Nền tảng quản lý quan hệ khách hàng và điều hành chiến dịch màn hình LED Toàn Trung',
    showButton: false,
    buttonLabel: 'Xem chi tiết',
    buttonHref: '/dashboard',
    showImage: true,
    imageUrl: null,
    imageAlt: 'Banner Dashboard',
    isDefaultImage: true,
    updatedAt: null,
    updatedByName: null,
  },
};

export async function getPublicBrandingConfig(): Promise<PublicBrandingDto> {
  // 1. Fetch system settings
  const settingsRows = await prisma.systemSetting.findMany();
  const settings: Record<string, string> = {};
  for (const s of settingsRows) {
    settings[s.key] = s.value;
  }

  // 2. Fetch active branding assets
  const activeAssets = await prisma.brandingAsset.findMany({
    where: { isActive: true },
    include: { uploadedBy: true },
  });

  const branding: PublicBrandingDto = JSON.parse(JSON.stringify(DEFAULT_BRANDING));

  if (settings.organizationName) branding.organizationName = settings.organizationName;
  if (settings.workspaceName) branding.workspaceName = settings.workspaceName;
  if (settings.loginHeadline) branding.loginHeadline = settings.loginHeadline;
  if (settings.loginSubheadline) branding.loginSubheadline = settings.loginSubheadline;
  if (settings.footerText) branding.footerText = settings.footerText;

  if (settings.logoAltText) branding.logo.altText = settings.logoAltText;
  if (settings.heroAltText) branding.loginHero.altText = settings.heroAltText;
  if (settings.heroCoverPosition) branding.loginHero.coverPosition = settings.heroCoverPosition as CoverPosition;
  if (settings.heroCrop) {
    try {
      branding.loginHero.crop = JSON.parse(settings.heroCrop);
    } catch {
      // ignore
    }
  }

  if (settings.bannerHeadline) branding.dashboardBanner.headline = settings.bannerHeadline;
  if (settings.bannerDescription) branding.dashboardBanner.description = settings.bannerDescription;
  if (settings.bannerShowButton !== undefined) branding.dashboardBanner.showButton = settings.bannerShowButton === 'true';
  if (settings.bannerButtonLabel) branding.dashboardBanner.buttonLabel = settings.bannerButtonLabel;
  if (settings.bannerButtonHref) branding.dashboardBanner.buttonHref = settings.bannerButtonHref;
  if (settings.bannerShowImage !== undefined) branding.dashboardBanner.showImage = settings.bannerShowImage === 'true';
  if (settings.bannerImageAlt) branding.dashboardBanner.imageAlt = settings.bannerImageAlt;

  for (const asset of activeAssets) {
    const assetUrl = `/api/v1/settings/branding/asset/${encodeURIComponent(asset.objectKey)}`;
    if (asset.slot === 'logo') {
      branding.logo.url = assetUrl;
      branding.logo.isDefault = false;
      branding.logo.altText = asset.altText || branding.logo.altText;
      branding.logo.coverPosition = (asset.coverPosition as CoverPosition) || 'center';
      if (asset.cropJson) {
        try {
          branding.logo.crop = JSON.parse(asset.cropJson);
        } catch {}
      }
      branding.logo.mimeType = asset.mimeType;
      branding.logo.fileSizeBytes = asset.fileSizeBytes;
      branding.logo.width = asset.width;
      branding.logo.height = asset.height;
      branding.logo.updatedAt = asset.createdAt.toISOString();
      branding.logo.updatedByName = asset.uploadedBy?.fullName || null;
    } else if (asset.slot === 'login_hero') {
      branding.loginHero.url = assetUrl;
      branding.loginHero.isDefault = false;
      branding.loginHero.altText = asset.altText || branding.loginHero.altText;
      branding.loginHero.coverPosition = (asset.coverPosition as CoverPosition) || 'center';
      if (asset.cropJson) {
        try {
          branding.loginHero.crop = JSON.parse(asset.cropJson);
        } catch {}
      }
      branding.loginHero.mimeType = asset.mimeType;
      branding.loginHero.fileSizeBytes = asset.fileSizeBytes;
      branding.loginHero.width = asset.width;
      branding.loginHero.height = asset.height;
      branding.loginHero.updatedAt = asset.createdAt.toISOString();
      branding.loginHero.updatedByName = asset.uploadedBy?.fullName || null;
    } else if (asset.slot === 'dashboard_banner') {
      branding.dashboardBanner.imageUrl = assetUrl;
      branding.dashboardBanner.isDefaultImage = false;
      branding.dashboardBanner.imageAlt = asset.altText || branding.dashboardBanner.imageAlt;
      branding.dashboardBanner.updatedAt = asset.createdAt.toISOString();
      branding.dashboardBanner.updatedByName = asset.uploadedBy?.fullName || null;
    }
  }

  return branding;
}

export async function updateBrandingMetadata(
  actorUserId: number,
  input: UpdateBrandingMetaDto,
  ipAddress?: string,
): Promise<PublicBrandingDto> {
  const updates: Array<{ key: string; value: string }> = [];

  if (input.organizationName !== undefined) updates.push({ key: 'organizationName', value: input.organizationName });
  if (input.workspaceName !== undefined) updates.push({ key: 'workspaceName', value: input.workspaceName });
  if (input.loginHeadline !== undefined) updates.push({ key: 'loginHeadline', value: input.loginHeadline });
  if (input.loginSubheadline !== undefined) updates.push({ key: 'loginSubheadline', value: input.loginSubheadline });
  if (input.footerText !== undefined) updates.push({ key: 'footerText', value: input.footerText });
  if (input.logoAltText !== undefined) updates.push({ key: 'logoAltText', value: input.logoAltText });
  if (input.heroAltText !== undefined) updates.push({ key: 'heroAltText', value: input.heroAltText });
  if (input.heroCoverPosition !== undefined) updates.push({ key: 'heroCoverPosition', value: input.heroCoverPosition });
  if (input.heroCrop !== undefined) updates.push({ key: 'heroCrop', value: JSON.stringify(input.heroCrop) });
  if (input.bannerHeadline !== undefined) updates.push({ key: 'bannerHeadline', value: input.bannerHeadline });
  if (input.bannerDescription !== undefined) updates.push({ key: 'bannerDescription', value: input.bannerDescription });
  if (input.bannerShowButton !== undefined) updates.push({ key: 'bannerShowButton', value: String(input.bannerShowButton) });
  if (input.bannerButtonLabel !== undefined) updates.push({ key: 'bannerButtonLabel', value: input.bannerButtonLabel });
  if (input.bannerButtonHref !== undefined) updates.push({ key: 'bannerButtonHref', value: input.bannerButtonHref });
  if (input.bannerShowImage !== undefined) updates.push({ key: 'bannerShowImage', value: String(input.bannerShowImage) });
  if (input.bannerImageAlt !== undefined) updates.push({ key: 'bannerImageAlt', value: input.bannerImageAlt });

  for (const item of updates) {
    await prisma.systemSetting.upsert({
      where: { key: item.key },
      update: { value: item.value, updatedById: actorUserId },
      create: { key: item.key, value: item.value, updatedById: actorUserId },
    });
  }

  await recordAuditLog({
    actorUserId,
    action: 'BRANDING_METADATA_UPDATED',
    targetType: 'branding',
    details: input,
    ipAddress,
  });

  return getPublicBrandingConfig();
}

export async function uploadBrandingAsset(params: {
  actorUserId: number;
  slot: AssetSlot;
  fileBuffer: Buffer;
  declaredMimeType: string;
  altText?: string;
  coverPosition?: CoverPosition;
  crop?: ImageCropConfig;
  ipAddress?: string;
}): Promise<PublicBrandingDto> {
  const maxBytes =
    params.slot === 'logo'
      ? APP_CONFIG.maxLogoSizeBytes
      : APP_CONFIG.maxHeroSizeBytes;

  const validated = validateAndSanitizeImageBuffer(
    params.fileBuffer,
    params.declaredMimeType,
    maxBytes,
  );

  const randomId = crypto.randomUUID().slice(0, 8);
  const objectKey = `brand-${params.slot}-${randomId}-${validated.sha256.slice(0, 10)}.${validated.extension}`;
  const fullPath = path.join(getBrandingStorageDir(), objectKey);

  fs.writeFileSync(fullPath, validated.sanitizedBuffer);

  // Deactivate existing active assets in this slot
  await prisma.brandingAsset.updateMany({
    where: { slot: params.slot, isActive: true },
    data: { isActive: false },
  });

  await prisma.brandingAsset.create({
    data: {
      slot: params.slot,
      objectKey,
      mimeType: validated.mimeType,
      fileSizeBytes: validated.fileSize,
      width: validated.width,
      height: validated.height,
      sha256: validated.sha256,
      altText: params.altText || (params.slot === 'logo' ? 'Logo' : 'Ảnh nền'),
      coverPosition: params.coverPosition || 'center',
      cropJson: params.crop ? JSON.stringify(params.crop) : null,
      isActive: true,
      uploadedById: params.actorUserId,
    },
  });

  await recordAuditLog({
    actorUserId: params.actorUserId,
    action: 'BRANDING_ASSET_UPLOADED',
    targetType: 'branding_asset',
    targetId: objectKey,
    details: {
      slot: params.slot,
      fileSizeBytes: validated.fileSize,
      mimeType: validated.mimeType,
    },
    ipAddress: params.ipAddress,
  });

  return getPublicBrandingConfig();
}

export async function resetBrandingAssetToDefault(
  actorUserId: number,
  slot: AssetSlot,
  ipAddress?: string,
): Promise<PublicBrandingDto> {
  await prisma.brandingAsset.updateMany({
    where: { slot, isActive: true },
    data: { isActive: false },
  });

  await recordAuditLog({
    actorUserId,
    action: 'BRANDING_ASSET_RESET',
    targetType: 'branding_asset',
    targetId: slot,
    details: { slot },
    ipAddress,
  });

  return getPublicBrandingConfig();
}

export async function readBrandingAssetBinary(
  objectKey: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const sanitized = path.basename(objectKey);

  // Check branding directory
  const brandingPath = path.join(APP_CONFIG.getStorageRoot(), 'branding', sanitized);
  if (fs.existsSync(brandingPath)) {
    const buffer = fs.readFileSync(brandingPath);
    const asset = await prisma.brandingAsset.findFirst({
      where: { objectKey: sanitized },
    });
    const mimeType = asset?.mimeType || (sanitized.endsWith('.png') ? 'image/png' : 'image/jpeg');
    return { buffer, mimeType };
  }

  // Check avatars directory
  const avatarPath = path.join(APP_CONFIG.getStorageRoot(), 'avatars', sanitized);
  if (fs.existsSync(avatarPath)) {
    const buffer = fs.readFileSync(avatarPath);
    const mimeType = sanitized.endsWith('.png') ? 'image/png' : sanitized.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    return { buffer, mimeType };
  }

  return null;
}

