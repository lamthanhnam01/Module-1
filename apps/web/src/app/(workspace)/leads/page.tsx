'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { CalendarDays, Download, FileUp, LayoutGrid, List, Plus, Search } from 'lucide-react';
import { useSession } from '@/core/session/SessionContext';
import CreateLeadDialog from '@/modules/01-leads/CreateLeadDialog';
import LeadDetailDialog from '@/modules/01-leads/LeadDetailDialog';

type Lead = {
  id: number;
  leadCode?: string | null;
  companyName?: string | null;
  projectName?: string | null;
  customerName?: string | null;
  contactName?: string | null;
  phone?: string | null;
  contactPhone?: string | null;
  pipelineStatus?: string | null;
  contactChannel?: string | null;
  sourceWebsite?: string | null;
  createdAt?: string | null;
  contactedAt?: string | null;
  assignedSalesId?: number | null;
};

type Pagination = { page: number; pageSize: number; total: number; totalPages: number };
const PAGE_SIZE = 10;
const statuses = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'new_lead', label: 'Vừa nhận thông tin' },
  { value: 'quoting', label: 'Đang soạn báo giá' },
  { value: 'quote_sent', label: 'Đã gửi báo giá' },
  { value: 'won', label: 'Chốt thành công' },
  { value: 'lost', label: 'Thất bại' },
] as const;
const statusStyles: Record<string, string> = {
  new_lead: 'border-violet-200 bg-violet-50 text-violet-700',
  quoting: 'border-blue-200 bg-blue-50 text-blue-700',
  quote_sent: 'border-amber-200 bg-amber-50 text-amber-700',
  won: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  lost: 'border-slate-200 bg-slate-100 text-slate-600',
};
const sourceLabels: Record<string, string> = {
  hotline: 'SĐT / Hotline', form_web: 'Form Website', email: 'Email',
  fanpage: 'Fanpage', zalo: 'Zalo', google_lead_form: 'Google Lead Form',
};
function statusLabel(status?: string | null) {
  return statuses.find((s) => s.value === status)?.label ?? status ?? 'Chưa xác định';
}
function dateLabel(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN');
}
function timeLabel(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export default function LeadsModulePage() {
  const { user } = useSession();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusCounts, setStatusCounts] = useState<Record<string, number | null>>({
    new_lead: null, quoting: null, quote_sent: null, won: null, lost: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
        if (search) params.set('search', search);
        if (status) params.set('status', status);
        const response = await fetch(`/api/v1/leads?${params}`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error?.message ?? 'Không thể tải danh sách Lead.');
        if (controller.signal.aborted) return;
        setLeads(result.data?.leads ?? []);
        setPagination(result.data?.pagination ?? { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi khi tải dữ liệu.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [page, search, status, reloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadCounts() {
      const values = ['new_lead', 'quoting', 'quote_sent', 'won', 'lost'];
      const entries = await Promise.all(values.map(async (value) => {
        try {
          const params = new URLSearchParams({ page: '1', pageSize: '1', status: value });
          if (search) params.set('search', search);
          const response = await fetch(`/api/v1/leads?${params}`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
          if (!response.ok) return [value, null] as const;
          const result = await response.json();
          return [value, result.ok ? (result.data?.pagination?.total ?? null) : null] as const;
        } catch { return [value, null] as const; }
      }));
      if (!controller.signal.aborted) setStatusCounts(Object.fromEntries(entries));
    }
    void loadCounts();
    return () => controller.abort();
  }, [search, reloadKey]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  const summary = [
    { label: 'Tổng Lead trong bộ lọc', value: pagination.total, detail: 'Theo tìm kiếm và trạng thái', color: 'text-slate-900' },
    { label: 'Vừa nhận thông tin', value: statusCounts.new_lead, detail: 'Chờ tiếp nhận', color: 'text-violet-700' },
    { label: 'Đang soạn báo giá', value: statusCounts.quoting, detail: 'Đang khảo sát & lên cấu hình', color: 'text-blue-700' },
    { label: 'Đã gửi báo giá', value: statusCounts.quote_sent, detail: 'Theo dõi phản hồi', color: 'text-amber-700' },
    { label: 'Chốt thành công', value: statusCounts.won, detail: 'Hợp đồng thành công', color: 'text-emerald-700' },
    { label: 'Thất bại', value: statusCounts.lost, detail: 'Đã đóng hồ sơ', color: 'text-slate-600' },
  ];

  return (
    <main className="space-y-4 p-3 md:p-4 xl:p-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-slate-900">Lead</h1>
        <span className="text-xs text-slate-500">Quản lý khách hàng tiềm năng</span>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {summary.map((item, index) => (
          <div key={item.label} className={`min-h-[132px] rounded-xl border bg-white p-4 ${index === 0 ? 'border-blue-700 bg-blue-50/30' : 'border-slate-200'}`}>
            <p className="text-sm font-medium text-slate-700">{item.label}</p>
            <p className={`mt-2 text-2xl font-bold ${item.color}`}>{item.value ?? '—'}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">{item.detail}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={submitSearch} className="flex min-w-[230px] flex-1 items-center gap-2">
            <div className="relative min-w-[170px] flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Tìm SĐT, tên khách, công ty, dự án..." className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500" />
            </div>
            <button type="submit" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Tìm</button>
          </form>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Lọc trạng thái" className="max-w-[210px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <span title="Chưa tích hợp lọc theo thời gian" className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400"><CalendarDays size={16} /> Mốc thời gian</span>
          <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs"><span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1.5 font-semibold text-blue-900 shadow-sm"><List size={14} /> Danh sách</span><span title="Kanban chưa tích hợp" className="inline-flex cursor-not-allowed items-center gap-1 px-2 py-1.5 text-slate-400"><LayoutGrid size={14} /> Kanban</span></span>
          <span title="Xuất Excel chưa tích hợp" className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-400"><Download size={15} /> Xuất Excel</span>
          <span title="Nhập Excel chưa tích hợp" className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-400"><FileUp size={15} /> Nhập Excel</span>
          <button type="button" onClick={() => setShowCreateDialog(true)} className="inline-flex items-center gap-1 rounded-lg bg-blue-950 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-900"><Plus size={16} /> Tạo Lead</button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {error && <p role="alert" className="border-b border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600"><tr>
              <th className="px-3 py-3">Khách hàng / dự án</th>
              <th className="px-3 py-3">Liên hệ & nguồn</th>
              <th className="px-3 py-3">Sản phẩm</th>
              <th className="px-3 py-3">Trạng thái / lịch theo dõi</th>
              <th className="px-3 py-3">Sales phụ trách</th>
              <th className="px-3 py-3">Ngày nhận</th>
              <th className="px-3 py-3">Thao tác</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="p-10 text-center text-slate-500">Đang tải danh sách Lead...</td></tr>
                : leads.length === 0 ? <tr><td colSpan={7} className="p-10 text-center text-slate-500">Không có Lead phù hợp.</td></tr>
                : leads.map((lead) => (
                  <tr key={lead.id} className="border-t border-slate-100 align-top hover:bg-slate-50/70">
                    <td className="max-w-[280px] border-l-2 border-l-blue-400 px-3 py-4">
                      <p className="truncate font-semibold text-slate-900" title={lead.companyName ?? lead.projectName ?? undefined}>{lead.companyName || lead.projectName || 'Chưa có tên'}</p>
                      {lead.companyName && lead.projectName && <p className="mt-1 truncate text-xs text-slate-500" title={lead.projectName}>{lead.projectName}</p>}
                      <p className="mt-1 text-xs text-slate-400">{lead.leadCode || `ID: ${lead.id}`}</p>
                    </td>
                    <td className="px-3 py-4"><p className="font-semibold text-slate-900">{lead.phone || lead.contactPhone || '—'}</p><p className="mt-1 text-xs text-slate-500">{lead.contactName || lead.customerName || '—'}</p><span className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{sourceLabels[lead.contactChannel ?? ''] || lead.contactChannel || '—'}{lead.sourceWebsite ? ` · ${lead.sourceWebsite}` : ''}</span></td>
                    <td className="px-3 py-4 text-xs text-slate-400" title="Danh sách Lead hiện chưa trả về sản phẩm liên kết">—</td>
                    <td className="px-3 py-4"><span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[lead.pipelineStatus ?? ''] ?? 'border-slate-200 bg-slate-50 text-slate-600'}`}>{statusLabel(lead.pipelineStatus)}</span></td>
                    <td className="px-3 py-4 text-xs text-slate-500">{lead.assignedSalesId != null ? `NVKD #${lead.assignedSalesId}` : 'Chưa phân công'}</td>
                    <td className="whitespace-nowrap px-3 py-4"><p className="font-medium text-slate-800">{dateLabel(lead.createdAt)}</p><p className="mt-1 text-xs text-slate-500">{timeLabel(lead.createdAt)}</p></td>
                    <td className="px-3 py-4"><div className="flex items-center gap-1"><button type="button" onClick={() => setSelectedLeadId(lead.id)} className="whitespace-nowrap rounded-md bg-blue-950 px-2.5 py-2 text-xs font-semibold text-white hover:bg-blue-900">Xem chi tiết</button>{lead.phone && <a href={`tel:${lead.phone.replace(/[^+\d]/g, '')}`} className="rounded-md border border-slate-200 px-2 py-2 text-xs text-slate-700 hover:bg-slate-50">Gọi</a>}</div></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
          <span>Hiển thị {pagination.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, pagination.total)} trong tổng số {pagination.total} Lead · Mỗi trang: {PAGE_SIZE}</span>
          <div className="flex items-center gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} className="rounded-md border border-slate-200 px-3 py-2 disabled:opacity-40">Trang trước</button><span>Trang {page} / {Math.max(1, pagination.totalPages)}</span><button type="button" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-slate-200 px-3 py-2 disabled:opacity-40">Trang sau</button></div>
        </div>
      </section>
      {selectedLeadId !== null && <LeadDetailDialog leadId={selectedLeadId} csrfToken={user?.csrfToken} onClose={() => setSelectedLeadId(null)} onUpdated={() => setReloadKey((key) => key + 1)} />}
      {showCreateDialog && user && <CreateLeadDialog csrfToken={user.csrfToken} onClose={() => setShowCreateDialog(false)} onCreated={() => { setShowCreateDialog(false); setPage(1); setReloadKey((key) => key + 1); }} />}
    </main>
  );
}
