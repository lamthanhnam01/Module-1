import type { MonetaryAmountDto } from '@toantrung/contracts';

/**
 * Định dạng số tiền vận hành (chi phí quảng cáo, CPL, chi phí AI) theo chuẩn Việt Nam.
 * Ví dụ: 36850000 → "36.850.000 ₫"; 12283333.3333 → "12.283.333 ₫".
 * Không dùng cho giá sản phẩm (hệ thống không lưu giá sản phẩm).
 */
export function formatMoney(
  amount: MonetaryAmountDto | null | undefined,
  options: { emptyText?: string } = {},
): string {
  if (!amount) return options.emptyText ?? '—';
  const value = Number(amount.formattedDecimal);
  if (!Number.isFinite(value)) return options.emptyText ?? '—';
  if (amount.currency === 'USD') {
    return `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} US$`;
  }
  return `${Math.round(value).toLocaleString('vi-VN')} ₫`;
}

/** Rút gọn số tiền lớn để hiển thị trên thẻ KPI: 36.850.000 → "36,85 triệu ₫". */
export function formatMoneyCompact(amount: MonetaryAmountDto | null | undefined, emptyText = '—'): string {
  if (!amount) return emptyText;
  const value = Number(amount.formattedDecimal);
  if (!Number.isFinite(value)) return emptyText;
  if (amount.currency === 'USD') return formatMoney(amount, { emptyText });
  if (Math.abs(value) >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ ₫`;
  }
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} triệu ₫`;
  }
  return formatMoney(amount, { emptyText });
}

