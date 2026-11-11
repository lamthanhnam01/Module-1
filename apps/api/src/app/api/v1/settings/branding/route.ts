import {
  ASSET_SLOTS,
  COVER_POSITIONS,
  ImageCropConfigSchema,
  UpdateBrandingMetaSchema,
  type AssetSlot,
  type CoverPosition,
  type ImageCropConfig,
} from '@toantrung/contracts';
import { getClientIp, jsonError, jsonSuccess } from '../../../../../core/http';
import { requireAdminSession } from '../../../../../core/permissions';
import { listRecentAuditLogs } from '../../../../../core/audit';
import { ImageValidationError } from '../../../../../core/storage/image-validator';
import {
  getPublicBrandingConfig,
  resetBrandingAssetToDefault,
  updateBrandingMetadata,
  uploadBrandingAsset,
} from '../../../../../core/storage/branding.service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const scope = url.searchParams.get('scope');

  // If requesting management details/audit history, enforce ADMIN authorization
  if (scope === 'admin') {
    const auth = await requireAdminSession(req, { requireCsrf: false });
    if (!auth.ok) return auth.response;

    const branding = await getPublicBrandingConfig();
    const recentAudits = await listRecentAuditLogs(15);
    return jsonSuccess({
      branding,
      recentAudits: recentAudits.map((a) => ({
        id: a.id,
        action: a.action,
        targetType: a.targetType,
        targetId: a.targetId,
        actorName: a.actor?.fullName || 'Hệ thống',
        createdAt: a.createdAt.toISOString(),
      })),
    });
  }

  // Public display read for /login, sidebar shell, and /dashboard banner (strips internal management metadata)
  try {
    const branding = await getPublicBrandingConfig();
    return jsonSuccess({
      branding: {
        ...branding,
        logo: {
          ...branding.logo,
          updatedByName: null,
        },
        loginHero: {
          ...branding.loginHero,
          updatedByName: null,
        },
        dashboardBanner: {
          ...branding.dashboardBanner,
          updatedByName: null,
        },
      },
    });
  } catch {
    return jsonError('BRANDING_LOAD_ERROR', 'Không tải được cấu hình thương hiệu.', 500);
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('INVALID_JSON', 'Dữ liệu gửi lên không hợp lệ.', 400);
  }

  const parsed = UpdateBrandingMetaSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message || 'Thông tin thương hiệu không hợp lệ.',
      400,
    );
  }

  const updated = await updateBrandingMetadata(auth.user.id, parsed.data, getClientIp(req));
  return jsonSuccess({ branding: updated });
}

export async function POST(req: Request) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return auth.response;

  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    let body: { action?: string; slot?: string };
    try {
      body = await req.json();
    } catch {
      return jsonError('INVALID_JSON', 'Dữ liệu yêu cầu không hợp lệ.', 400);
    }

    if (
      body.action === 'reset' &&
      body.slot &&
      (ASSET_SLOTS as readonly string[]).includes(body.slot)
    ) {
      const branding = await resetBrandingAssetToDefault(
        auth.user.id,
        body.slot as AssetSlot,
        getClientIp(req),
      );
      return jsonSuccess({ branding });
    }

    return jsonError('INVALID_ACTION', 'Thao tác thương hiệu không hợp lệ.', 400);
  }

  if (!contentType.includes('multipart/form-data')) {
    return jsonError(
      'UNSUPPORTED_CONTENT_TYPE',
      'Yêu cầu tải tệp phải là multipart/form-data.',
      400,
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return jsonError('INVALID_FORM_DATA', 'Không đọc được dữ liệu biểu mẫu tải lên.', 400);
  }

  const slotRaw = String(formData.get('slot') || '');
  if (!(ASSET_SLOTS as readonly string[]).includes(slotRaw)) {
    return jsonError(
      'INVALID_SLOT',
      'Vị trí tài sản thương hiệu không hợp lệ.',
      400,
    );
  }

  const file = formData.get('file');
  if (!file || typeof (file as Blob).arrayBuffer !== 'function') {
    return jsonError('MISSING_FILE', 'Vui lòng chọn tệp hình ảnh để tải lên.', 400);
  }

  const altText = String(formData.get('altText') || '').trim();
  const coverPosRaw = String(formData.get('coverPosition') || 'center');
  const coverPosition: CoverPosition = (COVER_POSITIONS as readonly string[]).includes(coverPosRaw)
    ? (coverPosRaw as CoverPosition)
    : 'center';

  let crop: ImageCropConfig | undefined;
  const cropRaw = formData.get('crop');
  if (typeof cropRaw === 'string' && cropRaw.trim()) {
    try {
      const parsedCrop = ImageCropConfigSchema.safeParse(JSON.parse(cropRaw));
      if (parsedCrop.success) {
        crop = parsedCrop.data;
      }
    } catch {
      // Ignore invalid crop JSON
    }
  }

  try {
    const arrayBuffer = await (file as Blob).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const declaredMime = (file as File).type || 'application/octet-stream';

    const branding = await uploadBrandingAsset({
      actorUserId: auth.user.id,
      slot: slotRaw as AssetSlot,
      fileBuffer: buffer,
      declaredMimeType: declaredMime,
      altText: altText || undefined,
      coverPosition,
      crop,
      ipAddress: getClientIp(req),
    });

    return jsonSuccess({ branding }, 201);
  } catch (err) {
    if (err instanceof ImageValidationError) {
      return jsonError(err.code, err.message, 400);
    }
    return jsonError('UPLOAD_FAILED', 'Không thể lưu tệp thương hiệu. Vui lòng thử lại.', 500);
  }
}
