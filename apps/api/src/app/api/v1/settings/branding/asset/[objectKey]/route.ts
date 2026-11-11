import { NextResponse } from 'next/server';
import { readBrandingAssetBinary } from '../../../../../../../core/storage/branding.service';
import { jsonError } from '../../../../../../../core/http';

export async function GET(
  _req: Request,
  context: { params: { objectKey: string } },
) {
  const objectKey = context.params.objectKey;
  const asset = await readBrandingAssetBinary(objectKey);
  if (!asset) {
    return jsonError('ASSET_NOT_FOUND', 'Không tìm thấy tài sản hình ảnh thương hiệu.', 404);
  }

  return new NextResponse(new Uint8Array(asset.buffer), {
    status: 200,
    headers: {
      'Content-Type': asset.mimeType,
      'Content-Length': String(asset.buffer.length),
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}

