'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  hasBaPermission,
  type ReportPreset,
  type ReportsDashboardDto,
} from '@toantrung/contracts';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Layers,
  Megaphone,
  PhoneCall,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useSession } from '@/core/session/SessionContext';
import { apiRequest, peekApiCache } from '@/core/http/client';
import { formatMoney, formatMoneyCompact } from '@/core/format/money';

const PERIODS: Array<{ label: string; value: ReportPreset }> = [
  { label: '7 ngày qua', value: '7d' },
  { label: '30 ngày qua', value: '30d' },
  { label: 'Toàn thời gian', value: 'all' },
];

type WorkspaceTab = 'leads' | 'sales' | 'campaigns' | 'products';

export default function DashboardPage() {
  const { user } = useSession();
  const [preset, setPreset] = useState<ReportPreset>('all');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('leads');
  const [report, setReport] = useState<ReportsDashboardDto | null>(() =>
    peekApiCache<ReportsDashboardDto>('/api/v1/reports?preset=all')
  );
  const [isLoading, setIsLoading] = useState<boolean>(
    () => !peekApiCache<ReportsDashboardDto>('/api/v1/reports?preset=all')
  );
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);

  const loadDashboard = useCallback(
    async (selectedPreset: ReportPreset, manual = false) => {
      const url = `/api/v1/reports?preset=${selectedPreset}`;
      const cached = !manual ? peekApiCache<ReportsDashboardDto>(url) : null;
      if (manual) {
        setIsRefreshing(true);
      } else if (cached) {
        setReport(cached);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }
      setFetchError(null);

      try {
        const data = await apiRequest<ReportsDashboardDto>(url, {
          skipCache: manual,
        });
        setReport(data);
        setLastFetchedAt(new Date().toISOString());
      } catch (err) {
        // When Module 04 (/api/v1/reports) is not yet implemented in V1, keep clean empty/fallback dashboard without a red 404 banner
        if (err instanceof Error && err.message.includes('404')) {
          setFetchError(null);
        } else {
          setFetchError(
            err instanceof Error
              ? err.message
              : 'Mất kết nối tới máy chủ. Vui lòng thử lại.'
          );
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadDashboard(preset, false);
  }, [preset, loadDashboard]);

  const overview = report?.overview ?? {
    totalLeadsL1: 0,
    validLeadsL2: 0,
    effectiveLeadsL3: 0,
    activeLeadsCount: 0,
    unreceivedLeadsCount: 0,
    newLeadCount: 0,
    quotingCount: 0,
    quoteSentCount: 0,
    wonCount: 0,
    lostCount: 0,
    unansweredQuoteCount: 0,
    overdue7DaysQuoteCount: 0,
    winRateText: '0.0%',
  };

  const marketing = report?.marketingSummary;
  const design = report?.designSummary;
  const trackingOps = report?.trackingOperationalSummary;
  const actionableTasks = report?.actionableTasks ?? [];
  const leadTrend = report?.leadTrend ?? [];
  const unansweredQuotes = report?.unansweredQuotes ?? [];
  const salesPerformance = report?.salesPerformance ?? [];
  const productInsights = report?.productInsights ?? [];
  const byChannel = report?.byChannel ?? [];
  const detailedLeads = report?.detailedLeads ?? [];

  const b2bFollowUpHorizonStats = useMemo(() => {
    const activeUnder7d = unansweredQuotes.filter((q) => q.daysWaiting < 7).length;
    const followUp7to30d = unansweredQuotes.filter(
      (q) => q.daysWaiting >= 7 && q.daysWaiting <= 30
    ).length;
    const periodic1to2m = unansweredQuotes.filter(
      (q) => q.daysWaiting > 30 && q.daysWaiting <= 60
    ).length;
    const longTermOver60d = unansweredQuotes.filter((q) => q.daysWaiting > 60).length;
    return {
      activeUnder7d,
      followUp7to30d,
      periodic1to2m,
      longTermOver60d,
    };
  }, [unansweredQuotes]);

  const canViewSalesTeam = Boolean(
    user && ['ADMIN', 'BOD', 'SALES_LEAD', 'SALES'].includes(user.roleCode)
  );
  const canViewMarketingSummary = Boolean(
    user && hasBaPermission(user.roleCode, 'TRACKING_ADS_OPTIMIZE')
  );
  const canViewSeoAds = Boolean(
    user && hasBaPermission(user.roleCode, 'AI_MARKETING_SEO')
  );
  const canViewDesignStudio = Boolean(
    user && hasBaPermission(user.roleCode, 'AI_DESIGN')
  );
  const card4Href = canViewSeoAds
    ? '/ads'
    : canViewMarketingSummary
      ? '/tracking'
      : canViewDesignStudio
        ? '/design'
        : '/reports';

  const cleanScopeDescription = (report?.scopeDescription || '')
    .replace(/\s*\(theo[^)]*\)/gi, '')
    .replace(/\s*theo UC\d+[^)]*/gi, '');

  const cleanRatePct =
    overview.totalLeadsL1 > 0
      ? Math.round((overview.effectiveLeadsL3 / overview.totalLeadsL1) * 100)
      : 100;

  return (
    <div className="space-y-4 text-sm">
      {/* 1. HEADER ĐIỀU HÀNH GỌN SẠCH */}
      <header className="rounded-2xl bg-white border border-slate-200/90 px-5 py-4 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-50 border border-blue-200/80 text-[#1E3A8A] text-xs font-semibold">
              <Activity className="w-3.5 h-3.5 text-blue-600" />
              <span>Bảng Điều Hành Toàn Trung</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
              <span>{user?.roleName || 'Nhân sự'}</span>
            </span>
            {lastFetchedAt && (
              <span className="text-xs text-slate-400">
                Cập nhật lúc{' '}
                {new Date(lastFetchedAt).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
          <h1 className="font-display text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            Tổng quan Kinh doanh, Tiếp thị &amp; Dự án Màn hình LED
          </h1>
          <p className="text-xs text-slate-500 truncate">
            {cleanScopeDescription ||
              `Số liệu tổng hợp theo phân quyền của ${user?.fullName || ''}.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            role="group"
            aria-label="Chọn kỳ báo cáo"
            className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200/80"
          >
            {PERIODS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setPreset(item.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  preset === item.value
                    ? 'bg-white text-[#1E3A8A] shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void loadDashboard(preset, true)}
            disabled={isLoading || isRefreshing}
            className="h-9 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition disabled:opacity-60"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing || isLoading ? 'animate-spin' : ''}`}
            />
            <span>Làm mới</span>
          </button>

          <a
            href={`/api/v1/reports/export?preset=${preset}&format=xlsx`}
            target="_blank"
            rel="noreferrer"
            className="h-9 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Xuất Excel</span>
          </a>

          <Link
            href="/leads"
            className="h-9 px-3.5 rounded-xl bg-[#1E3A8A] hover:bg-blue-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition"
          >
            <span>Quản lý Lead</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {fetchError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              <strong>Lỗi tải dữ liệu:</strong> {fetchError}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void loadDashboard(preset, true)}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* 2. TẦNG 1: 4 THẺ CHỈ SỐ CỐT LÕI (RÕ RÀNG, THOÁNG MẮT, KHÔNG LẶP SỐ LIỆU) */}
      <section aria-label="4 Chỉ số trọng tâm">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {/* Card 1: Tiếp nhận & Sàng lọc Lead */}
          <Link
            href="/leads"
            className="rounded-2xl bg-white border border-slate-200/90 p-4 shadow-2xs hover:border-blue-300 transition flex flex-col justify-between"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-slate-500">
                  1. Tổng Hồ Sơ Lead Tiếp Nhận
                </span>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <strong className="font-display text-3xl font-bold text-slate-900 tabular-nums">
                    {isLoading && !report ? '—' : overview.totalLeadsL1}
                  </strong>
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200/80 text-[#1E3A8A] text-xs font-semibold">
                    {cleanRatePct}% Lead sạch
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1E3A8A] border border-blue-100 grid place-items-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span>
                Hiệu quả (L3): <strong className="text-slate-900">{overview.effectiveLeadsL3}</strong>
              </span>
              <span>
                Đang tư vấn: <strong className="text-[#1E3A8A]">{overview.activeLeadsCount}</strong>
              </span>
            </div>
          </Link>

          {/* Card 2: Báo giá & Lộ trình theo dõi */}
          <Link
            href="/leads?status=quote_sent"
            className="rounded-2xl bg-white border border-slate-200/90 p-4 shadow-2xs hover:border-amber-300 transition flex flex-col justify-between"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-slate-500">
                  2. Báo Giá Đang Theo Dõi
                </span>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <strong className="font-display text-3xl font-bold text-slate-900 tabular-nums">
                    {isLoading && !report ? '—' : overview.quoteSentCount}
                  </strong>
                  <span
                    className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${
                      overview.overdue7DaysQuoteCount > 0
                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}
                  >
                    {overview.overdue7DaysQuoteCount > 0
                      ? `${overview.overdue7DaysQuoteCount} cần liên hệ lại`
                      : 'Đúng tiến độ'}
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/70 grid place-items-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span>
                Chờ phản hồi: <strong className="text-slate-900">{overview.unansweredQuoteCount}</strong>
              </span>
              <span>
                Đang soạn BG: <strong className="text-blue-700">{overview.quotingCount}</strong>
              </span>
            </div>
          </Link>

          {/* Card 3: Dự án Chốt thành công */}
          <Link
            href="/leads?status=won"
            className="rounded-2xl bg-white border border-slate-200/90 p-4 shadow-2xs hover:border-emerald-300 transition flex flex-col justify-between"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-slate-500">
                  3. Dự Án Chốt Thành Công
                </span>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <strong className="font-display text-3xl font-bold text-slate-900 tabular-nums">
                    {isLoading && !report ? '—' : overview.wonCount}
                  </strong>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold tabular-nums">
                    Tỷ lệ chốt {overview.winRateText}
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/70 grid place-items-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span>
                Thất bại / Dừng: <strong className="text-slate-900">{overview.lostCount}</strong>
              </span>
              <span>
                Chờ tiếp nhận: <strong className="text-amber-700">{overview.unreceivedLeadsCount}</strong>
              </span>
            </div>
          </Link>

          {/* Card 4: Quảng cáo, SEO & Kỹ thuật 3D */}
          <Link
            href={card4Href}
            className="rounded-2xl bg-white border border-slate-200/90 p-4 shadow-2xs hover:border-violet-300 transition flex flex-col justify-between"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs font-semibold text-slate-500">
                  4. Quảng Cáo, SEO &amp; Phối Cảnh 3D
                </span>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <strong className="font-display text-2xl font-bold text-slate-900 tabular-nums truncate">
                    {marketing?.totalAdsSpend
                      ? formatMoneyCompact(marketing.totalAdsSpend)
                      : `${design?.totalRequests ?? 0} bản vẽ`}
                  </strong>
                  {marketing?.cplEffective ? (
                    <span className="px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-xs font-semibold whitespace-nowrap">
                      CPL: {formatMoneyCompact(marketing.cplEffective)}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-700 border border-violet-200/70 grid place-items-center shrink-0">
                <Target className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span>
                Bài SEO: <strong className="text-slate-900">{marketing?.publishedSeoArticles ?? 0} bài</strong>
              </span>
              <span>
                Phối cảnh 3D: <strong className="text-teal-700">{design?.completed3dCount ?? 0} hoàn tất</strong>
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* 3. TẦNG 2: XU HƯỚNG TIẾP NHẬN & SẢN PHẨM NỔI BẬT (8 CỘT) + VIỆC CẦN ƯU TIÊN HÔM NAY (4 CỘT) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Cột Trái (8 cột): Xu hướng theo ngày + Top Sản phẩm quan tâm */}
        <div className="lg:col-span-8 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex flex-col justify-between space-y-5">
          {/* Phần A: Biểu đồ Nhịp độ Tiếp nhận & Chốt đơn theo ngày */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#1E3A8A]" />
                  <span>Xu Hướng Tiếp Nhận Lead &amp; Chốt Đơn Theo Ngày</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Biến động số lượng hồ sơ tiếp nhận mới và số dự án chốt thành công theo ngày
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-medium">
                <span className="inline-flex items-center gap-1.5 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#1E3A8A]" /> Lead tiếp nhận
                </span>
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" /> Chốt thành công
                </span>
              </div>
            </div>

            {leadTrend.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-500 text-center">
                Chưa có phát sinh Lead trong khoảng thời gian đã chọn.
              </div>
            ) : (
              <div className="grid grid-cols-7 sm:grid-cols-14 gap-1.5 items-end pt-2">
                {(() => {
                  const maxDay = Math.max(...leadTrend.map((d) => d.totalL1), 1);
                  return leadTrend.map((pt) => {
                    const heightPct = Math.max(16, Math.round((pt.totalL1 / maxDay) * 100));
                    return (
                      <div
                        key={pt.date}
                        className="flex flex-col items-center gap-1"
                        title={`Ngày ${pt.date}: Tổng ${pt.totalL1} Lead (Hợp lệ: ${pt.validL2}, Chốt: ${pt.wonCount})`}
                      >
                        <span className="text-[11px] font-semibold text-slate-700 tabular-nums">
                          {pt.totalL1}
                        </span>
                        <div className="w-full h-20 bg-slate-100 rounded-lg flex items-end p-1 gap-0.5">
                          <div
                            className="flex-1 rounded bg-[#1E3A8A]/85 transition-all"
                            style={{ height: `${heightPct}%` }}
                          />
                          {pt.wonCount > 0 && (
                            <div
                              className="w-1.5 rounded bg-emerald-500"
                              style={{
                                height: `${Math.max(25, Math.round((pt.wonCount / maxDay) * 100))}%`,
                              }}
                            />
                          )}
                        </div>
                        <span className="text-[10px] font-medium text-slate-500 tabular-nums">
                          {pt.label}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>

          {/* Phần B: Top Dòng Sản phẩm LED & Bảng điện tử được hỏi nhiều nhất */}
          <div className="pt-4 border-t border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-[#1E3A8A]" />
                <span>Dòng Sản Phẩm Màn Hình LED &amp; Bảng Điện Tử Nổi Bật</span>
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('products')}
                className="text-xs font-semibold text-[#1E3A8A] hover:underline"
              >
                Xem chi tiết sản phẩm →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {productInsights.slice(0, 4).map((pi) => {
                const maxInq = Math.max(...productInsights.map((p) => p.inquiryCount), 1);
                const pct = Math.max(12, Math.round((pi.inquiryCount / maxInq) * 100));
                const isLed = pi.category === 'MAN_HINH_LED';
                return (
                  <div
                    key={pi.productId}
                    className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <strong className="text-slate-900 font-semibold truncate">
                        {pi.productName}
                      </strong>
                      <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                        <span className="text-slate-600 font-medium">{pi.inquiryCount} hồ sơ</span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold text-[11px]">
                          {pi.wonCount} chốt
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-200/80 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isLed ? 'bg-[#1E3A8A]' : 'bg-violet-600'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Cột Phải (4 cột): Trung Tâm Việc Cần Ưu Tiên Hôm Nay */}
        <div className="lg:col-span-4 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Ưu Tiên Xử Lý Hôm Nay</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Các đầu việc cần phản hồi sớm theo phân quyền
                </p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold shrink-0">
                {actionableTasks.filter((t) => t.count > 0).length} đầu việc
              </span>
            </div>

            <div className="space-y-2">
              {actionableTasks.map((task) => {
                const hasWork = task.count > 0;
                return (
                  <Link
                    key={task.id}
                    href={task.href}
                    className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                      hasWork
                        ? 'bg-amber-50/40 border-amber-200/90 hover:bg-amber-50/80'
                        : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-slate-900 truncate">
                        {task.title}
                      </h3>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {task.description}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 ${
                        hasWork
                          ? 'bg-white border border-amber-300 text-amber-800 shadow-2xs'
                          : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                      }`}
                    >
                      {hasWork ? `${task.count} hồ sơ` : 'Hoàn tất'}
                    </span>
                  </Link>
                );
              })}
            </div>

            {/* Danh sách Báo giá cần gọi lại ngay */}
            {canViewSalesTeam && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Báo giá chờ phản hồi ({unansweredQuotes.length})</span>
                  </span>
                  <Link
                    href="/leads?status=quote_sent"
                    className="text-xs font-semibold text-[#1E3A8A] hover:underline"
                  >
                    Tất cả →
                  </Link>
                </div>

                {unansweredQuotes.length === 0 ? (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-500 text-center">
                    Không có báo giá nào đang tồn đọng.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {unansweredQuotes.slice(0, 3).map((q) => (
                      <div
                        key={q.leadId}
                        className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/90 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <strong className="text-xs font-bold text-slate-900 block truncate">
                            {q.companyOrContact}
                          </strong>
                          <span className="text-[11px] text-slate-500 block truncate">
                            {q.assignedSalesName} · Chờ {q.daysWaiting} ngày
                          </span>
                        </div>
                        <Link
                          href={`/leads?highlight=${q.leadId}`}
                          className="h-7 px-2.5 rounded-lg bg-white hover:bg-blue-50 border border-slate-200 text-[#1E3A8A] text-xs font-semibold inline-flex items-center shrink-0"
                        >
                          Chi tiết
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Thông báo &amp; Báo cáo phòng ban</span>
            <Link
              href="/notifications"
              className="font-semibold text-[#1E3A8A] hover:underline inline-flex items-center gap-1"
            >
              <span>Mở Hộp thư &amp; Soạn báo cáo</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* 4. TẦNG 3: BẢNG ĐIỀU PHỐI ĐA CHIỀU GỌN GÀNG THEO TAB (KHÔNG XẾP CHỒNG DÀI LÊ THÊ) */}
      <section className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
        {/* Thanh Tab Chuyển Đổi 4 Góc Nhìn */}
        <div className="px-5 pt-3.5 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 overflow-x-auto">
            {[
              {
                id: 'leads' as const,
                label: 'Hồ sơ Lead mới nhất',
                count: detailedLeads.length,
                icon: FileSpreadsheet,
              },
              ...(canViewSalesTeam
                ? [
                    {
                      id: 'sales' as const,
                      label: 'Hiệu suất Đội ngũ Sales',
                      count: salesPerformance.length,
                      icon: Users,
                    },
                  ]
                : []),
              ...(canViewMarketingSummary
                ? [
                    {
                      id: 'campaigns' as const,
                      label: 'Chiến dịch Quảng cáo & Nguồn',
                      count: marketing?.bySourceCampaign.length ?? 0,
                      icon: Megaphone,
                    },
                  ]
                : []),
              {
                id: 'products' as const,
                label: 'Nhu cầu Sản phẩm LED & Kênh',
                count: productInsights.length,
                icon: BarChart3,
              },
            ].map((tab) => {
              const active = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative inline-flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap transition ${
                    active ? 'text-[#1E3A8A]' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[11px] font-semibold ${
                      active
                        ? 'bg-blue-100 text-[#1E3A8A]'
                        : 'bg-slate-200/70 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                  {active && (
                    <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-[#1E3A8A]" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="pb-2">
            {activeTab === 'leads' && (
              <Link
                href="/leads"
                className="text-xs font-semibold text-[#1E3A8A] hover:underline inline-flex items-center gap-1"
              >
                <span>Xem tất cả hồ sơ Lead</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
            {activeTab === 'sales' && (
              <Link
                href="/reports"
                className="text-xs font-semibold text-[#1E3A8A] hover:underline inline-flex items-center gap-1"
              >
                <span>Mở Báo cáo chi tiết</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
            {activeTab === 'campaigns' && (
              <Link
                href={canViewSeoAds ? '/ads' : '/tracking'}
                className="text-xs font-semibold text-[#1E3A8A] hover:underline inline-flex items-center gap-1"
              >
                <span>{canViewSeoAds ? 'Mở Quản lý Quảng cáo & SEO' : 'Mở Chiến dịch Marketing'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>

        {/* TAB 1: DANH SÁCH HỒ SƠ LEAD MỚI NHẤT */}
        {activeTab === 'leads' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50/80 text-slate-600 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-4 whitespace-nowrap">Mã Lead</th>
                  <th className="py-2.5 px-4 min-w-[200px]">Khách hàng / Đơn vị</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Số điện thoại</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Kênh &amp; Nguồn</th>
                  <th className="py-2.5 px-3.5 min-w-[180px]">Sản phẩm quan tâm</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Sales phụ trách</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">Trạng thái</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detailedLeads.slice(0, 8).map((row) => {
                  const statusText = row.pipelineStatusLabel || '';
                  const isSpam = statusText.toLowerCase().includes('spam');
                  const isWon = statusText.includes('Chốt thành công');
                  const isLost = statusText.includes('Thất bại');
                  const isQuoteSent = statusText.includes('Đã gửi báo giá');
                  const isQuoting = statusText.includes('Đang soạn báo giá');

                  const statusPill = isSpam
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : isWon
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : isLost
                        ? 'bg-slate-100 text-slate-600 border border-slate-200'
                        : isQuoteSent
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : isQuoting
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-violet-50 text-violet-700 border border-violet-200';

                  return (
                    <tr
                      key={row.leadCode}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-2.5 px-4 tabular-nums font-bold text-[#1E3A8A] whitespace-nowrap">
                        {row.leadCode}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">
                        {row.companyOrCustomer.replace(/\s*\(Dữ liệu tổng hợp\)/gi, '')}
                      </td>
                      <td className="py-2.5 px-3 tabular-nums font-medium text-slate-700 whitespace-nowrap">
                        {row.phone}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium">
                          {row.contactChannel}
                        </span>
                        <span className="ml-1 px-2 py-0.5 rounded bg-blue-50/80 text-[#1E3A8A] text-xs font-medium">
                          {row.marketingSource}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5">
                        <div className="flex flex-wrap gap-1">
                          {row.productsText
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean)
                            .map((p, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200/80 text-slate-700 text-[11px] font-medium whitespace-nowrap"
                              >
                                {p}
                              </span>
                            ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">
                        {row.assignedSalesName}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${statusPill}`}
                        >
                          {row.pipelineStatusLabel}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <Link
                          href={`/leads?search=${encodeURIComponent(row.leadCode)}`}
                          className="h-7 px-3 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-[#1E3A8A] text-xs font-semibold inline-flex items-center shadow-2xs transition"
                        >
                          Chi tiết
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: HIỆU SUẤT ĐỘI NGŨ KINH DOANH */}
        {activeTab === 'sales' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50/80 text-slate-600 border-b border-slate-200/80 text-[11px] uppercase tracking-wider font-bold">
                  <th className="py-2.5 px-4 whitespace-nowrap">Nhân sự Kinh doanh</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">Trạng thái</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">Tổng hồ sơ</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">Vừa nhận</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">Đang soạn BG</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">Đã gửi BG</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">Cần liên hệ (&ge;7d)</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">Chốt Won</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Tỷ lệ chốt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salesPerformance.map((sp) => (
                  <tr key={sp.salesUserId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            sp.isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        />
                        <span>{sp.salesFullName}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          sp.isReceivingLeads
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {sp.isReceivingLeads ? 'Đang nhận Lead' : 'Tạm ngưng'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center tabular-nums font-bold text-slate-900">
                      {sp.totalLeads}
                    </td>
                    <td className="py-2.5 px-3 text-center tabular-nums text-slate-700">
                      {sp.newLeads}
                    </td>
                    <td className="py-2.5 px-3 text-center tabular-nums text-blue-700 font-medium">
                      {sp.quotingLeads}
                    </td>
                    <td className="py-2.5 px-3 text-center tabular-nums text-amber-700 font-medium">
                      {sp.quoteSentLeads}
                    </td>
                    <td className="py-2.5 px-3 text-center tabular-nums">
                      {sp.unansweredOverdue7d > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
                          {sp.unansweredOverdue7d}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center tabular-nums font-bold text-emerald-700">
                      {sp.wonLeads}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold text-xs">
                        {sp.winRateText}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: CHIẾN DỊCH QUẢNG CÁO & NGUỒN LEAD */}
        {activeTab === 'campaigns' && canViewMarketingSummary && marketing && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-2.5 px-4 whitespace-nowrap">Nguồn tiếp thị</th>
                  <th className="py-2.5 px-4">Chiến dịch Quảng cáo / Nguồn thu hút</th>
                  <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Chi phí Ads</th>
                  <th className="py-2.5 px-3.5 text-center whitespace-nowrap">Chuyển đổi Ads</th>
                  <th className="py-2.5 px-3.5 text-center whitespace-nowrap">Lead (L1)</th>
                  <th className="py-2.5 px-3.5 text-center whitespace-nowrap">Hợp lệ (L2)</th>
                  <th className="py-2.5 px-3.5 text-center whitespace-nowrap">Hiệu quả (L3)</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Đã chốt (Won)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {marketing.bySourceCampaign.map((row) => (
                  <tr key={row.key} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          row.sourceName === 'Google Ads'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : row.sourceName === 'Facebook Ads'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {row.sourceName}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">
                      {row.campaignName}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatMoney(row.spend)}
                    </td>
                    <td className="py-2.5 px-3.5 text-center tabular-nums text-slate-600">
                      {row.platformConversions > 0 ? row.platformConversions : '—'}
                    </td>
                    <td className="py-2.5 px-3.5 text-center font-bold text-slate-900 tabular-nums">
                      {row.crmLeadsL1}
                    </td>
                    <td className="py-2.5 px-3.5 text-center font-medium text-blue-700 tabular-nums">
                      {row.crmValidL2}
                    </td>
                    <td className="py-2.5 px-3.5 text-center font-bold text-[#1E3A8A] tabular-nums">
                      {row.crmEffectiveL3}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold text-xs">
                        {row.wonCount} Won
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: NHU CẦU SẢN PHẨM LED & KÊNH LIÊN HỆ */}
        {activeTab === 'products' && (
          <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 space-y-2.5">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Top Dòng Sản Phẩm Khách Hàng Quan Tâm Báo Giá
              </span>
              <div className="space-y-2">
                {productInsights.map((pi) => {
                  const maxInq = Math.max(...productInsights.map((p) => p.inquiryCount), 1);
                  const pct = Math.max(12, Math.round((pi.inquiryCount / maxInq) * 100));
                  const isLed = pi.category === 'MAN_HINH_LED';
                  return (
                    <div
                      key={pi.productId}
                      className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                              isLed
                                ? 'bg-blue-50 text-[#1E3A8A] border border-blue-200/70'
                                : 'bg-violet-50 text-violet-800 border border-violet-200/70'
                            }`}
                          >
                            {isLed ? 'Màn hình LED' : 'Bảng điện tử'}
                          </span>
                          <strong className="text-slate-900 font-semibold truncate">
                            {pi.productName}
                          </strong>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 tabular-nums">
                          <span className="text-slate-700 font-semibold">
                            {pi.inquiryCount} hồ sơ
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold text-[11px]">
                            {pi.wonCount} chốt
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-200/80 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isLed ? 'bg-[#1E3A8A]' : 'bg-violet-600'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-5 space-y-2.5">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Tỷ Trọng Theo Kênh Khách Hàng Liên Hệ
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {byChannel.map((ch) => (
                  <div
                    key={ch.channel}
                    className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/90 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <PhoneCall className="w-4 h-4 text-[#1E3A8A]" />
                      <span className="text-xs font-semibold text-slate-700">{ch.label}</span>
                    </div>
                    <strong className="font-display text-lg font-bold text-slate-900 tabular-nums">
                      {ch.count}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
