
'use client';

import { useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  FolderPlus,
  Layers3,
  MapPin,
  UserRound,
  X,
} from 'lucide-react';
import { apiRequest } from '@/core/http/client';

type Props = {
  csrfToken: string;
  onClose: () => void;
  onCreated: () => void;
};

const channels = [
  { value: 'hotline', label: 'SĐT / Hotline' },
  { value: 'form_web', label: 'Form Website' },
  { value: 'email', label: 'Email' },
  { value: 'fanpage', label: 'Fanpage' },
  { value: 'zalo', label: 'Zalo' },
  { value: 'google_lead_form', label: 'Google Lead Form' },
];

// Danh mục từ packages/database/scripts/seed.js (không phải dữ liệu API trực tiếp).
const products = [
  { id: 1, categoryGroup: 'led_screen', productName: 'Màn hình LED Indoor' },
  { id: 2, categoryGroup: 'led_screen', productName: 'Màn hình LED Outdoor' },
  { id: 3, categoryGroup: 'led_screen', productName: 'Màn hình LED Cong' },
  { id: 4, categoryGroup: 'led_screen', productName: 'Màn hình LED lưới' },
  { id: 5, categoryGroup: 'led_screen', productName: 'Màn hình GOB' },
  { id: 6, categoryGroup: 'led_screen', productName: 'Màn hình COB' },
  { id: 7, categoryGroup: 'led_screen', productName: 'Màn hình LCD' },
  { id: 8, categoryGroup: 'led_screen', productName: 'Khác (Màn hình LED)' },
  { id: 9, categoryGroup: 'electronic_board', productName: 'Bảng Năng suất' },
  { id: 10, categoryGroup: 'electronic_board', productName: 'Bảng thi đấu thể thao' },
  { id: 11, categoryGroup: 'electronic_board', productName: 'Bảng Marathon' },
  { id: 12, categoryGroup: 'electronic_board', productName: 'Bảng Shotlock' },
  { id: 13, categoryGroup: 'electronic_board', productName: 'Bảng An toàn lao động' },
  { id: 14, categoryGroup: 'electronic_board', productName: 'Bảng LED xe buýt sân bay' },
  { id: 15, categoryGroup: 'electronic_board', productName: 'Bảng LED Modbus' },
  { id: 16, categoryGroup: 'electronic_board', productName: 'Bảng LED xe buýt' },
  { id: 17, categoryGroup: 'electronic_board', productName: 'Đồng hồ LED' },
  { id: 18, categoryGroup: 'electronic_board', productName: 'Bảng hiển thị nhiệt độ độ ẩm' },
  { id: 19, categoryGroup: 'electronic_board', productName: 'Bảng LED giá vàng' },
  { id: 20, categoryGroup: 'electronic_board', productName: 'Bảng LED thu phí giữ xe' },
  { id: 21, categoryGroup: 'other', productName: 'Hỏi sửa chữa' },
  { id: 22, categoryGroup: 'other', productName: 'Không cung cấp thông tin' },
  { id: 23, categoryGroup: 'other', productName: 'Hỏi sản phẩm đặc biệt' },
  { id: 24, categoryGroup: 'other', productName: 'Hỏi thuê' },
  { id: 25, categoryGroup: 'other', productName: 'Không đúng nhu cầu' },
];

const productCategories = [
  { id: 'led_screen', label: 'Màn hình LED' },
  { id: 'electronic_board', label: 'Bảng điện tử & Hiển thị số' },
  { id: 'other', label: 'Dịch vụ / Nhu cầu khác' },
];

const initialForm = {
  phone: '',
  contactChannel: 'hotline',
  contactName: '',
  email: '',
  companyName: '',
  projectName: '',
  contactedAt: '',
  province: '',
  district: '',
  ward: '',
  streetAddress: '',
};

const inputClass =
  'mt-1.5 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export default function CreateLeadDialog({
  csrfToken,
  onClose,
  onCreated,
}: Props) {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [productCategory, setProductCategory] = useState('led_screen');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  const selectedProduct = products.find((product) => product.id === selectedProductId);
  const visibleProducts = products.filter((product) => {
    const matchesCategory = product.categoryGroup === productCategory;
    const matchesSearch = product.productName.toLocaleLowerCase('vi').includes(productSearch.trim().toLocaleLowerCase('vi'));
    return matchesCategory && matchesSearch;
  });

  function updateField(
    field: keyof typeof initialForm,
    value: string
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!form.phone.trim()) {
      setError('Vui lòng nhập số điện thoại.');
      return;
    }

    // Backend hiện chỉ có một trường installationAddress.
    // Ghép các phần địa chỉ ở Frontend, không thay đổi API.
    const installationAddress = [
      form.streetAddress,
      form.ward,
      form.district,
      form.province,
    ]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(', ');

    setSaving(true);

    try {
      await apiRequest('/api/v1/leads', {
        method: 'POST',
        csrfToken,
        body: {
          phone: form.phone.trim(),
          contactChannel: form.contactChannel,
          contactName: form.contactName.trim() || null,
          email: form.email.trim() || null,
          companyName: form.companyName.trim() || null,
          projectName: form.projectName.trim() || null,
          installationAddress: installationAddress || null,
          ...(selectedProductId !== null ? { productId: selectedProductId } : {}),
          ...(form.contactedAt
            ? {
                contactedAt: new Date(form.contactedAt).toISOString(),
              }
            : {}),
        },
      });

      onCreated();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể tạo Lead. Vui lòng thử lại.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-2 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-lead-title"
        className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        {/* HEADER */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-900 text-white">
              <FolderPlus size={22} />
            </div>

            <div>
              <h2
                id="create-lead-title"
                className="text-xl font-bold text-slate-900"
              >
                Tạo Hồ sơ Lead
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Hệ thống tiếp nhận và chuẩn hóa thông tin Lead
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Đóng"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
          >
            <X size={22} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          {/* NỘI DUNG CUỘN */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/40 p-4 sm:p-6">
            {/* THANH TÙY CHỌN */}
            <section className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <span
                    title="Chưa được API tạo Lead hỗ trợ"
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500"
                  >
                    <UserRound size={16} />
                    Chuyển Lead cho NVKD khác
                    <span className="font-normal">
                      (chưa tích hợp)
                    </span>
                  </span>

                  <span
                    title="Chưa được API tạo Lead hỗ trợ"
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500"
                  >
                    <AlertTriangle size={16} />
                    Tích nghi vấn
                    <span className="font-normal">
                      (chưa tích hợp)
                    </span>
                  </span>
                </div>

                <label className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-600">
                  Thời điểm liên hệ:
                  <input
                    type="datetime-local"
                    value={form.contactedAt}
                    onChange={(e) =>
                      updateField('contactedAt', e.target.value)
                    }
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                  />
                </label>
              </div>
            </section>

            {/* THÔNG TIN KHÁCH HÀNG */}
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">
                  1. Thông tin Khách hàng &amp; Địa điểm Công trình
                </h3>

                <span className="text-sm font-semibold text-blue-900">
                  Nguồn:{' '}
                  {
                    channels.find(
                      (item) => item.value === form.contactChannel
                    )?.label
                  }
                </span>
              </div>

              <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-3">
                <label className="min-w-0 text-sm font-medium text-slate-600">
                  Số điện thoại *
                  <input
                    required
                    type="tel"
                    value={form.phone}
                    onChange={(e) =>
                      updateField('phone', e.target.value)
                    }
                    placeholder="0909123456 (10 số)"
                    className={inputClass}
                  />
                </label>

                <label className="min-w-0 text-sm font-medium text-slate-600">
                  Người liên hệ
                  <input
                    value={form.contactName}
                    onChange={(e) =>
                      updateField('contactName', e.target.value)
                    }
                    placeholder="Họ tên khách hàng..."
                    className={inputClass}
                  />
                </label>

                <label className="min-w-0 text-sm font-medium text-slate-600">
                  Email
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      updateField('email', e.target.value)
                    }
                    placeholder="email@congty.vn"
                    className={inputClass}
                  />
                </label>

                <label className="min-w-0 text-sm font-medium text-slate-600">
                  Đơn vị / Công ty
                  <input
                    value={form.companyName}
                    onChange={(e) =>
                      updateField('companyName', e.target.value)
                    }
                    placeholder="Tên doanh nghiệp / đơn vị..."
                    className={inputClass}
                  />
                </label>

                <label className="min-w-0 text-sm font-medium text-slate-600">
                  Tên dự án / Công trình
                  <input
                    value={form.projectName}
                    onChange={(e) =>
                      updateField('projectName', e.target.value)
                    }
                    placeholder="VD: Màn hình LED Hội trường..."
                    className={inputClass}
                  />
                </label>

                <label className="min-w-0 text-sm font-medium text-slate-600">
                  Nguồn dự án *
                  <select
                    required
                    value={form.contactChannel}
                    onChange={(e) =>
                      updateField('contactChannel', e.target.value)
                    }
                    className={inputClass}
                  >
                    {channels.map((channel) => (
                      <option key={channel.value} value={channel.value}>
                        {channel.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* ĐỊA CHỈ 4 CỘT GIỐNG RENDER */}
              <div className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="min-w-0 text-sm font-medium text-slate-600">
                  Tỉnh / Thành phố
                  <input
                    value={form.province}
                    onChange={(e) =>
                      updateField('province', e.target.value)
                    }
                    placeholder="VD: TP. Hồ Chí Minh"
                    className={inputClass}
                  />
                </label>

                <label className="min-w-0 text-sm font-medium text-slate-600">
                  Quận / Huyện / Thị xã
                  <input
                    value={form.district}
                    onChange={(e) =>
                      updateField('district', e.target.value)
                    }
                    placeholder="Nhập quận / huyện"
                    className={inputClass}
                  />
                </label>

                <label className="min-w-0 text-sm font-medium text-slate-600">
                  Phường / Xã / Thị trấn
                  <input
                    value={form.ward}
                    onChange={(e) =>
                      updateField('ward', e.target.value)
                    }
                    placeholder="Nhập phường / xã"
                    className={inputClass}
                  />
                </label>

                <label className="min-w-0 text-sm font-medium text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={14} />
                    Thôn / Ấp / Số nhà, Đường
                  </span>
                  <input
                    value={form.streetAddress}
                    onChange={(e) =>
                      updateField('streetAddress', e.target.value)
                    }
                    placeholder="Số nhà, tên đường..."
                    className={inputClass}
                  />
                </label>
              </div>
            </section>

            {/* SẢN PHẨM QUAN TÂM - BỐ CỤC THEO RENDER */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Layers3 size={19} className="text-blue-900" />
                  <h3 className="text-base font-bold text-slate-900">
                    Sản phẩm quan tâm
                  </h3>
                </div>
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900">
                  {selectedProduct ? 'Đã chọn 1 sản phẩm' : 'Chưa chọn sản phẩm'}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <input
                  type="search"
                  aria-label="Tìm sản phẩm"
                  placeholder="Tìm sản phẩm (ví dụ: Màn hình LED, Bảng điện tử...)"
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  className="w-full max-w-sm rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                {selectedProduct && (
                  <button
                    type="button"
                    onClick={() => setSelectedProductId(null)}
                    className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-900 hover:bg-blue-100"
                    title="Bỏ chọn sản phẩm"
                  >
                    {selectedProduct.productName} ×
                  </button>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[280px_minmax(0,1fr)]">
                <div className="space-y-1">
                  {productCategories.map((category) => {
                    const count = products.filter((item) => item.categoryGroup === category.id).length;
                    const active = productCategory === category.id;
                    return (
                      <button
                        type="button"
                        key={category.id}
                        onClick={() => setProductCategory(category.id)}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg border-l-4 px-3 py-3 text-left text-sm transition ${
                          active
                            ? 'border-blue-600 bg-blue-50 font-semibold text-blue-900'
                            : 'border-transparent text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{category.label}</span>
                        <span className="shrink-0 text-slate-400">({count})</span>
                      </button>
                    );
                  })}
                </div>

                <div className="min-h-[185px] rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                  {visibleProducts.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500">
                      Không tìm thấy sản phẩm trong nhóm này.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {visibleProducts.map((product) => {
                        const checked = selectedProductId === product.id;
                        return (
                          <label
                            key={product.id}
                            className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                              checked
                                ? 'border-blue-300 bg-blue-50 font-semibold text-blue-900'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setSelectedProductId(checked ? null : product.id)}
                              className="h-4 w-4 shrink-0 accent-blue-700"
                            />
                            <span>{product.productName}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Danh mục lấy từ dữ liệu seed của nhóm. Mỗi Lead hiện chỉ chọn được một sản phẩm qua API tạo Lead.
              </p>
            </section>

            {/* GHI CHÚ */}
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="mb-3 text-base font-bold text-slate-900">
                Ghi chú
              </h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-600">
                  Ghi chú kích thước / cấu hình kỹ thuật
                  <textarea
                    disabled
                    rows={2}
                    placeholder="Chưa được API tạo Lead hỗ trợ"
                    className={`${inputClass} resize-none bg-slate-50`}
                  />
                </label>

                <label className="text-sm font-medium text-slate-600">
                  Ghi chú tư vấn
                  <textarea
                    disabled
                    rows={2}
                    placeholder="Chưa được API tạo Lead hỗ trợ"
                    className={`${inputClass} resize-none bg-slate-50`}
                  />
                </label>
              </div>
            </section>
          </div>

          {/* THÔNG BÁO LỖI */}
          {error && (
            <p
              role="alert"
              className="border-t border-red-100 bg-red-50 px-6 py-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          {/* FOOTER CỐ ĐỊNH */}
          <div className="flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-200 px-5 py-2.5 font-medium text-slate-600 hover:bg-slate-50"
            >
              Hủy bỏ
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-900 px-5 py-2.5 font-semibold text-white hover:bg-blue-950 disabled:opacity-50"
            >
              {saving ? 'Đang lưu...' : 'Lưu Hồ sơ Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
