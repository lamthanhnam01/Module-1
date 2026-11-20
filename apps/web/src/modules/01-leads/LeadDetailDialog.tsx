'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Clock3, FileText, History, Paperclip, Pencil, Save, X, Layers3 } from 'lucide-react';
import { apiRequest } from '@/core/http/client';

type ProductLink = {
  id?: number;
  productId?: number;
  customProductName?: string | null;
  requestedDimension?: string | null;
  noteSpecification?: string | null;
  product?: { productName?: string | null; productCode?: string | null; categoryGroup?: string | null } | null;
};
type Activity = {
  id?: number;
  actionType?: string | null;
  activityType?: string | null;
  description?: string | null;
  note?: string | null;
  createdAt?: string | null;
};
type Attachment = { id?: number; fileName?: string | null; attachmentType?: string | null; uploadedAt?: string | null };
type Lead = {
  id: number;
  leadCode?: string | null;
  phone?: string | null;
  contactName?: string | null;
  email?: string | null;
  companyName?: string | null;
  projectName?: string | null;
  installationAddress?: string | null;
  contactChannel?: string | null;
  sourceWebsite?: string | null;
  pipelineStatus?: string | null;
  assignedSalesId?: number | null;
  contactedAt?: string | null;
  receivedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  version?: number | null;
  leadProducts?: ProductLink[];
  activities?: Activity[];
  attachments?: Attachment[];
};
type EditableKey = 'phone' | 'contactName' | 'email' | 'companyName' | 'projectName' | 'installationAddress';
type FormValues = Record<EditableKey, string>;
type Tab = 'info' | 'progress' | 'files' | 'history';
type Props = { leadId: number; csrfToken?: string; onClose: () => void; onUpdated: () => void };

const statusLabels: Record<string, string> = {
  new_lead: 'Vừa nhận thông tin', quoting: 'Đang soạn báo giá',
  quote_sent: 'Đã gửi báo giá', won: 'Chốt thành công', lost: 'Thất bại',
};
const sourceLabels: Record<string, string> = {
  hotline: 'SĐT / Hotline', form_web: 'Form Website', email: 'Email',
  fanpage: 'Fanpage', zalo: 'Zalo', google_lead_form: 'Google Lead Form',
};
const categoryLabels: Record<string, string> = {
  led_screen: 'Màn hình LED', electronic_board: 'Bảng điện tử & Hiển thị số',
  other: 'Dịch vụ / Nhu cầu khác',
};
const inputClass = 'mt-1.5 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50';
const display = (value?: string | null) => value?.trim() || '—';
function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('vi-VN');
}
function toForm(lead: Lead): FormValues {
  return {
    phone: lead.phone ?? '', contactName: lead.contactName ?? '', email: lead.email ?? '',
    companyName: lead.companyName ?? '', projectName: lead.projectName ?? '',
    installationAddress: lead.installationAddress ?? '',
  };
}

// Danh mục tham khảo từ packages/database/scripts/seed.js, không thay thế API sản phẩm.
const catalog = [
  ...[
    [1,'LED_INDOOR','Màn hình LED Indoor'],[2,'LED_OUTDOOR','Màn hình LED Outdoor'],[3,'LED_CURVED','Màn hình LED Cong'],[4,'LED_MESH','Màn hình LED lưới'],[5,'LED_GOB','Màn hình GOB'],[6,'LED_COB','Màn hình COB'],[7,'LED_LCD','Màn hình LCD'],[8,'LED_OTHER','Khác (Màn hình LED)'],
  ].map(([id,code,name]) => ({ id: Number(id), code: String(code), name: String(name), category: 'led_screen' })),
  ...[
    [9,'BOARD_PRODUCTIVITY','Bảng Năng suất'],[10,'BOARD_SPORTS','Bảng thi đấu thể thao'],[11,'BOARD_MARATHON','Bảng Marathon'],[12,'BOARD_SHOTLOCK','Bảng Shotlock'],[13,'BOARD_SAFETY','Bảng An toàn lao động'],[14,'BOARD_AIRPORT_BUS','Bảng LED xe buýt sân bay'],[15,'BOARD_MODBUS','Bảng LED Modbus'],[16,'BOARD_BUS','Bảng LED xe buýt'],[17,'BOARD_CLOCK','Đồng hồ LED'],[18,'BOARD_TEMP_HUMIDITY','Bảng hiển thị nhiệt độ độ ẩm'],[19,'BOARD_GOLD_PRICE','Bảng LED giá vàng'],[20,'BOARD_PARKING_FEE','Bảng LED thu phí giữ xe'],
  ].map(([id,code,name]) => ({ id: Number(id), code: String(code), name: String(name), category: 'electronic_board' })),
  ...[
    [21,'OTHER_REPAIR','Hỏi sửa chữa'],[22,'OTHER_NO_INFO','Không cung cấp thông tin'],[23,'OTHER_SPECIAL','Hỏi sản phẩm đặc biệt'],[24,'OTHER_RENTAL','Hỏi thuê'],[25,'OTHER_MISMATCH','Không đúng nhu cầu'],
  ].map(([id,code,name]) => ({ id: Number(id), code: String(code), name: String(name), category: 'other' })),
];

export default function LeadDetailDialog({ leadId, csrfToken, onClose, onUpdated }: Props) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [form, setForm] = useState<FormValues | null>(null);
  const [tab, setTab] = useState<Tab>('info');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [address, setAddress] = useState({ province: '', district: '', ward: '', street: '' });
  const [addressChanged, setAddressChanged] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [category, setCategory] = useState('led_screen');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLead(null);
    setForm(null);
    setTab('info');
    setError('');
    setNotice('');
    async function load() {
      try {
        const response = await fetch(`/api/v1/leads/${leadId}`, {
          credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok || !result.ok || !result.data?.lead) {
          throw new Error(result.error?.message ?? 'Không thể tải hồ sơ Lead.');
        }
        if (!controller.signal.aborted) {
          const loaded = result.data.lead as Lead;
          setLead(loaded);
          setForm(toForm(loaded));
          setAddress({ province: '', district: '', ward: '', street: loaded.installationAddress ?? '' });
          setAddressChanged(false);
        }
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Không thể tải hồ sơ Lead.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [leadId]);

  function change(key: EditableKey, value: string) {
    setForm(current => current ? { ...current, [key]: value } : current);
    setNotice('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !lead || saving) return;
    if (!csrfToken) { setError('Phiên đăng nhập thiếu CSRF token. Vui lòng đăng nhập lại.'); return; }
    if (!form.phone.trim()) { setError('Vui lòng nhập số điện thoại.'); setTab('info'); return; }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/api/v1/leads/${leadId}`, {
        method: 'PATCH', csrfToken,
        body: {
          phone: form.phone.trim(),
          contactName: form.contactName.trim() || null,
          email: form.email.trim() || null,
          companyName: form.companyName.trim() || null,
          projectName: form.projectName.trim() || null,
          installationAddress: (addressChanged ? [address.street, address.ward, address.district, address.province].map(v => v.trim()).filter(Boolean).join(', ') : form.installationAddress.trim()) || null,
        },
      });
      const response = await fetch(`/api/v1/leads/${leadId}`, { credentials: 'same-origin', cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.data?.lead) {
        throw new Error('Đã gửi cập nhật nhưng chưa tải lại được hồ sơ. Vui lòng mở lại để kiểm tra.');
      }
      const updated = result.data.lead as Lead;
      setLead(updated);
      setForm(toForm(updated));
      setAddress({ province: '', district: '', ward: '', street: updated.installationAddress ?? '' });
      setAddressChanged(false);
      setNotice('Đã lưu cập nhật thành công.');
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể lưu cập nhật.');
    } finally {
      setSaving(false);
    }
  }

  const title = lead?.companyName || lead?.projectName || lead?.contactName || 'Hồ sơ Lead';
  const products = lead?.leadProducts ?? [];
  const tabs: { key: Tab; title: string; icon: typeof Pencil }[] = [
    { key: 'info', title: 'Thông tin chung', icon: Pencil },
    { key: 'progress', title: 'Tiến độ & Phối hợp', icon: Clock3 },
    { key: 'files', title: 'Tệp đính kèm', icon: Paperclip },
    { key: 'history', title: 'Lịch sử', icon: History },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Chi tiết hồ sơ Lead">
      <div className="flex max-h-[95vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-blue-100 bg-blue-50 px-2 py-1 font-mono text-xs font-semibold text-blue-900">{lead?.leadCode ?? `Lead #${leadId}`}</span>
                <h2 className="min-w-0 truncate text-base font-bold text-slate-900 sm:text-lg">{loading ? 'Đang tải hồ sơ...' : title}</h2>
              </div>
              {lead && <>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                  <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 font-semibold text-violet-700">{statusLabels[lead.pipelineStatus ?? ''] ?? display(lead.pipelineStatus)}</span>
                  <span className="max-w-[280px] truncate">Dự án: {display(lead.projectName)}</span>
                  <span>☎ {display(lead.phone)}</span>
                  <span>Nguồn: {sourceLabels[lead.contactChannel ?? ''] ?? display(lead.contactChannel)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">Phụ trách: {lead.assignedSalesId ? `NVKD #${lead.assignedSalesId}` : 'Chưa phân công'}</p>
              </>}
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Đóng"><X size={19} /></button>
          </div>
        </header>

        <nav className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 sm:px-6" aria-label="Các tab hồ sơ Lead">
          {tabs.map(({ key, title: label, icon: Icon }) => (
            <button key={key} type="button" onClick={() => setTab(key)} className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-xs font-semibold sm:text-sm ${tab === key ? 'border-blue-800 text-blue-900' : 'border-transparent text-slate-600 hover:text-blue-800'}`}>
              <Icon size={15} />{label}
            </button>
          ))}
          <span className="ml-auto hidden shrink-0 text-xs text-emerald-700 lg:inline">● Chỉnh sửa trực tiếp</span>
        </nav>

        <form id="lead-detail-form" onSubmit={save} className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 p-4 sm:p-5">
          {error && <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {notice && <p role="status" className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
          {loading ? <p className="py-12 text-center text-slate-500">Đang tải dữ liệu...</p> : !lead || !form ? <p className="py-12 text-center text-slate-500">Không thể hiển thị hồ sơ.</p> : <>
            {tab === 'info' && <div className="space-y-4">
              <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900">1. Thông tin Khách hàng & Địa điểm Công trình</h3>
                  <span className="shrink-0 text-xs text-slate-400">{lead.version ? `Phiên bản v${lead.version}` : ''}</span>
                </div>
                <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  {([
                    ['phone', 'Số điện thoại *', 'tel'],
                    ['contactName', 'Người liên hệ', 'text'],
                    ['email', 'Email', 'email'],
                    ['companyName', 'Đơn vị / Công ty', 'text'],
                    ['projectName', 'Tên dự án / Công trình', 'text'],
                  ] as const).map(([key, label, type]) => (
                    <label key={key} className="block min-w-0 text-xs font-medium text-slate-700">{label}
                      <input type={type} value={form[key]} disabled={saving} onChange={e => change(key, e.target.value)} className={inputClass} />
                    </label>
                  ))}
                  <div className="min-w-0 text-xs font-medium text-slate-700">Nguồn dự án (chỉ xem)
                    <div className={`${inputClass} flex min-h-[41px] items-center bg-slate-50 text-slate-700`}>{sourceLabels[lead.contactChannel ?? ''] ?? display(lead.contactChannel)}</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
                  {([['province', 'Tỉnh / Thành phố', 'VD: TP. Hồ Chí Minh'], ['district', 'Quận / Huyện / Thị xã', 'Nhập quận / huyện'], ['ward', 'Phường / Xã / Thị trấn', 'Nhập phường / xã'], ['street', 'Thôn / Ấp / Số nhà, Đường', 'Số nhà, tên đường']] as const).map(([key, label, placeholder]) => (
                    <label key={key} className="min-w-0 text-xs font-medium text-slate-700">{label}
                      <input className={inputClass} value={address[key]} placeholder={placeholder} disabled={saving}
                        onChange={e => { setAddress(prev => ({ ...prev, [key]: e.target.value })); setAddressChanged(true); setNotice(''); }} />
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">Địa chỉ cũ (nếu có) được giữ nguyên trong ô cuối để tránh mất dữ liệu. Khi sửa, 4 ô sẽ được ghép thành một địa chỉ theo API hiện tại.</p>
                <div className="mt-3 text-xs text-slate-500">Website nguồn: <span className="font-medium text-slate-700">{display(lead.sourceWebsite)}</span></div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="inline-flex items-center gap-2 text-sm font-bold text-slate-900"><Layers3 size={16} className="text-blue-800" />2. Sản phẩm quan tâm</h3>
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800">Đã chọn {products.length} sản phẩm</span>
                </div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <input className={`${inputClass} mt-0 max-w-sm`} value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Tìm sản phẩm (ví dụ: Màn hình LED...)" aria-label="Tìm sản phẩm" />
                  <div className="flex flex-wrap gap-1.5">{products.map((p, i) => <span key={p.id ?? i} className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">{p.product?.productName ?? p.customProductName ?? `Sản phẩm #${p.productId ?? '?'}`}</span>)}</div>
                </div>
                <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3 md:grid-cols-[230px_minmax(0,1fr)]">
                  <div className="space-y-1">{([['led_screen','Màn hình LED',8],['electronic_board','Bảng điện tử & Hiển thị số',12],['other','Dịch vụ / Nhu cầu khác',5]] as const).map(([key,label,count]) => <button type="button" key={key} onClick={() => setCategory(key)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-xs ${category === key ? 'border-l-4 border-blue-600 bg-blue-50 font-semibold text-blue-900' : 'text-slate-700 hover:bg-white'}`}><span>{label}</span><span className="text-slate-400">({count})</span></button>)}</div>
                  <div className="grid content-start gap-2 sm:grid-cols-2">{catalog.filter(p => p.category === category && p.name.toLocaleLowerCase('vi-VN').includes(productSearch.toLocaleLowerCase('vi-VN'))).map(p => {
                    const selected = products.some(link => link.productId === p.id || link.product?.productCode === p.code);
                    return <div key={p.id} className={`flex min-h-[42px] items-center gap-2 rounded-lg border px-3 py-2 text-xs ${selected ? 'border-blue-300 bg-blue-50 font-semibold text-blue-900' : 'border-slate-200 bg-white text-slate-700'}`}><input type="checkbox" checked={selected} disabled readOnly aria-label={p.name} className="accent-blue-700" /><span>{p.name}</span></div>;
                  })}</div>
                </div>
                <p className="mt-2 text-xs text-slate-500">Danh mục tham khảo từ seed của nhóm. Checkbox chỉ phản ánh sản phẩm đã lưu, không thay đổi dữ liệu. Chưa có API danh mục hoặc cập nhật nhiều sản phẩm.</p>
              </section>
              <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <h3 className="mb-3 text-sm font-bold text-slate-900">3. Ghi chú</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><p className="text-xs font-medium text-slate-700">Ghi chú kích thước / cấu hình kỹ thuật</p><div className="mt-1.5 min-h-[54px] rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">{products.map(p => p.noteSpecification || p.requestedDimension).filter(Boolean).join('; ') || 'Chưa có ghi chú kỹ thuật.'}</div></div>
                  <div><p className="text-xs font-medium text-slate-700">Ghi chú tư vấn</p><div className="mt-1.5 min-h-[54px] rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">Chưa có API cập nhật ghi chú tư vấn.</div></div>
                </div>
              </section>
            </div>}

            {tab === 'progress' && <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="mb-4 text-sm font-bold text-slate-900">Tiến độ & Phối hợp</h3>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{([
                ['Trạng thái', statusLabels[lead.pipelineStatus ?? ''] ?? display(lead.pipelineStatus)],
                ['Sales phụ trách', lead.assignedSalesId ? `NVKD #${lead.assignedSalesId}` : 'Chưa phân công'],
                ['Thời điểm liên hệ', formatDate(lead.contactedAt)],
                ['Thời điểm tiếp nhận', formatDate(lead.receivedAt)],
                ['Ngày tạo hồ sơ', formatDate(lead.createdAt)],
                ['Cập nhật gần nhất', formatDate(lead.updatedAt)],
              ] as const).map(([label, value]) => <div key={label}><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-slate-800">{value}</p></div>)}</div>
              <p className="mt-5 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Các thao tác xác nhận tiếp nhận, phân công Sales và đổi trạng thái cần API riêng; nút lưu thông tin chung không thực hiện các thao tác này.</p>
            </section>}

            {tab === 'files' && <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-slate-900"><Paperclip size={16} />Tệp đính kèm</h3>
              {lead.attachments?.length ? <div className="space-y-2">{lead.attachments.map((file, i) => <div key={file.id ?? i} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm"><FileText size={18} className="text-blue-800" /><div><p className="font-medium">{file.fileName ?? `Tệp #${file.id ?? i + 1}`}</p><p className="text-xs text-slate-500">{formatDate(file.uploadedAt)}</p></div></div>)}</div> : <p className="text-sm text-slate-500">Chưa có tệp đính kèm được trả về từ API.</p>}
              <p className="mt-3 text-xs text-slate-500">Chưa tích hợp tải lên, tải xuống hoặc xóa tệp trong cửa sổ này.</p>
            </section>}

            {tab === 'history' && <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="mb-4 text-sm font-bold text-slate-900">Lịch sử hoạt động</h3>
              {lead.activities?.length ? <div className="space-y-3">{lead.activities.map((activity, i) => <div key={activity.id ?? i} className="rounded-lg border border-slate-100 bg-slate-50 p-3"><p className="text-sm font-medium text-slate-800">{activity.description || activity.note || activity.actionType || activity.activityType || 'Hoạt động Lead'}</p><p className="mt-1 text-xs text-slate-500">{formatDate(activity.createdAt)}</p></div>)}</div> : <p className="text-sm text-slate-500">Chưa có hoạt động được ghi nhận.</p>}
            </section>}
          </>}
        </form>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Đóng</button>
          {tab === 'info' && <button type="submit" form="lead-detail-form" disabled={saving || loading || !form} className="inline-flex items-center gap-2 rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"><Save size={16} />{saving ? 'Đang lưu...' : 'Lưu cập nhật'}</button>}
        </footer>
      </div>
    </div>
  );
}
