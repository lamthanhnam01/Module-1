'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { NotificationDto, ReportsDashboardDto } from '@toantrung/contracts';
import {
  Bell,
  Building2,
  Check,
  CheckCheck,
  Clock,
  Eye,
  FileText,
  MailOpen,
  PenSquare,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useSession } from '@/core/session/SessionContext';
import { apiRequest } from '@/core/http/client';

type DepartmentScopeCode =
  | 'ALL'
  | 'KINH_DOANH'
  | 'MARKETING_SEO'
  | 'ADS'
  | 'KY_THUAT_THIET_KE';

interface ScopedNotificationItem extends NotificationDto {
  departmentScope?: DepartmentScopeCode;
  departmentLabel?: string;
}

interface DispatchedReportItem {
  id: number;
  reportCode: string;
  status: 'DRAFT' | 'ISSUED';
  title: string;
  summary: string;
  contentHtml: string;
  targetDepartments: string[];
  reportingPeriod: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
}

const DEPARTMENT_OPTIONS: Array<{ code: DepartmentScopeCode; label: string }> = [
  { code: 'ALL', label: 'Toàn công ty (Tất cả phòng ban)' },
  { code: 'KINH_DOANH', label: 'Phòng Kinh doanh' },
  { code: 'MARKETING_SEO', label: 'Phòng Marketing & SEO' },
  { code: 'ADS', label: 'Bộ phận Quảng cáo Ads' },
  { code: 'KY_THUAT_THIET_KE', label: 'Bộ phận Thiết kế Kỹ thuật' },
];

function getRelativeTimeVi(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays <= 7) return `${diffDays} ngày trước`;
  return new Date(isoDate).toLocaleDateString('vi-VN');
}

export default function NotificationsPage() {
  const { user, unreadCount, refreshUnreadCount, setUnreadCountState } = useSession();

  const [activeTab, setActiveTab] = useState<'inbox' | 'reports' | 'compose'>('inbox');
  const [readFilter, setReadFilter] = useState<'all' | 'unread'>('all');
  const [deptFilter, setDeptFilter] = useState<DepartmentScopeCode>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [scopedItems, setScopedItems] = useState<ScopedNotificationItem[]>([]);
  const [userDepartmentCode, setUserDepartmentCode] =
    useState<DepartmentScopeCode>('ALL');
  const [userDepartmentLabel, setUserDepartmentLabel] = useState<string>(
    'Toàn công ty',
  );
  const [canSendFullReport, setCanSendFullReport] = useState<boolean>(false);
  const [reports, setReports] = useState<DispatchedReportItem[]>([]);
  const [selectedReport, setSelectedReport] =
    useState<DispatchedReportItem | null>(null);

  // Report Composer states
  const [reportTitle, setReportTitle] = useState('');
  const [reportSummary, setReportSummary] = useState('');
  const [reportBodyText, setReportBodyText] = useState('');
  const [selectedTargetDepts, setSelectedTargetDepts] = useState<DepartmentScopeCode[]>([
    'ALL',
  ]);
  const [loadingLiveMetrics, setLoadingLiveMetrics] = useState(false);

  const loadNotificationCenter = useCallback(async () => {
    setBusy(true);
    try {
      const data = await apiRequest<{
        items: ScopedNotificationItem[];
        unreadCount: number;
        userDepartmentCode: DepartmentScopeCode;
        userDepartmentLabel: string;
        canSendFullReport: boolean;
        reports: DispatchedReportItem[];
      }>('/api/v1/notifications');

      setScopedItems(data.items || []);
      setUnreadCountState(data.unreadCount ?? 0);
      setUserDepartmentCode(data.userDepartmentCode || 'ALL');
      setUserDepartmentLabel(data.userDepartmentLabel || 'Phòng ban');
      setCanSendFullReport(Boolean(data.canSendFullReport));
      setReports(data.reports || []);

      if (!data.canSendFullReport && data.userDepartmentCode) {
        setSelectedTargetDepts([data.userDepartmentCode]);
      }

      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const rptId = Number(params.get('reportId'));
        if (rptId && data.reports) {
          const found = data.reports.find((r) => r.id === rptId);
          if (found) {
            setSelectedReport(found);
          }
        }
      }
    } catch {
      // ignore error
    } finally {
      setBusy(false);
    }
  }, [setUnreadCountState]);

  useEffect(() => {
    void loadNotificationCenter();
  }, [loadNotificationCenter]);

  useEffect(() => {
    if (!feedbackMsg) return;
    const t = window.setTimeout(() => setFeedbackMsg(null), 3800);
    return () => window.clearTimeout(t);
  }, [feedbackMsg]);

  const handleMarkOne = async (notificationId: number) => {
    if (!user) return;
    setBusy(true);
    try {
      await apiRequest('/api/v1/notifications', {
        method: 'PATCH',
        csrfToken: user.csrfToken,
        body: { notificationId },
      });
      await refreshUnreadCount();
      await loadNotificationCenter();
    } finally {
      setBusy(false);
    }
  };

  const handleMarkAll = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await apiRequest('/api/v1/notifications', {
        method: 'PATCH',
        csrfToken: user.csrfToken,
        body: { markAll: true },
      });
      await refreshUnreadCount();
      await loadNotificationCenter();
      setFeedbackMsg('Đã đánh dấu toàn bộ thông báo là đã đọc.');
    } finally {
      setBusy(false);
    }
  };

  const handleFillExecutiveMetrics = async () => {
    setLoadingLiveMetrics(true);
    setErrorMsg(null);
    try {
      const reportData = await apiRequest<ReportsDashboardDto>(
        '/api/v1/reports?preset=30d',
      );
      const ov = reportData.overview;
      const mkt = reportData.marketingSummary;
      const dsn = reportData.designSummary;
      const todayStr = new Date().toLocaleDateString('vi-VN');

      if (canSendFullReport) {
        setReportTitle(
          `Báo cáo Điều hành Tổng hợp Toàn Công ty — Ngày ${todayStr}`,
        );
        setReportSummary(
          `Tổng hợp thực tế: ${ov.totalLeadsL1} Lead tiếp nhận (Hợp lệ L2: ${ov.validLeadsL2}, Hiệu quả L3: ${ov.effectiveLeadsL3}), chốt ${ov.wonCount} hợp đồng (${ov.winRateText}), ${ov.unansweredQuoteCount} hồ sơ đã gửi báo giá đang theo dõi.`,
        );
        setReportBodyText(
          [
            `I. TỔNG QUAN KINH DOANH & PIPELINE DỰ ÁN LED`,
            `- Tổng hồ sơ Lead tiếp nhận (L1): ${ov.totalLeadsL1} hồ sơ`,
            `- Lead hợp lệ đưa vào Pipeline (L2): ${ov.validLeadsL2} hồ sơ | Lead hiệu quả tính CPL (L3): ${ov.effectiveLeadsL3} hồ sơ`,
            `- Trạng thái xử lý: Mới nhận (${ov.newLeadCount}) · Đang soạn báo giá (${ov.quotingCount}) · Đã gửi báo giá (${ov.quoteSentCount}) · Đã chốt hợp đồng (${ov.wonCount} - Tỷ lệ chốt ${ov.winRateText})`,
            `- Hồ sơ báo giá cần liên hệ lại (>= 7 ngày): ${ov.overdue7DaysQuoteCount} hồ sơ`,
            ``,
            `II. HIỆU QUẢ QUẢNG CÁO ADS & NỘI DUNG SEO`,
            `- Số bài viết SEO đã xuất bản: ${mkt.publishedSeoArticles} bài (${mkt.draftSeoArticles} bản nháp)`,
            `- Tổng Lead hiệu quả từ Quảng cáo (L3): ${mkt.effectiveLeadsFromAds} Lead`,
            ``,
            `III. TIẾN ĐỘ BỘ PHẬN THIẾT KẾ KỸ THUẬT 3D & BANNER`,
            `- Tổng yêu cầu thiết kế AI: ${dsn.totalRequests} yêu cầu (Hoàn tất ${dsn.completed3dCount} Phối cảnh 3D & ${dsn.completedBannerCount} Banner)`,
            ``,
            `IV. CHỈ ĐẠO & PHỐI HỢP CÁC PHÒNG BAN`,
            `1. Phòng Kinh doanh: Rà soát lịch hẹn liên hệ lại các hồ sơ báo giá chu kỳ 1-2 tháng và cập nhật trạng thái trực tiếp trên bảng Lead.`,
            `2. Phòng Marketing & Bộ phận Ads: Tối ưu nhóm từ khóa màn hình LED hội trường & bảng điện tử công nghiệp có tỷ lệ chuyển đổi L3 cao.`,
            `3. Bộ phận Thiết kế: Đảm bảo bàn giao bản vẽ phối cảnh 3D đúng tiến độ cho các hồ sơ dự án trọng điểm.`,
          ].join('\n'),
        );
      } else {
        setReportTitle(
          `Báo cáo Tiến độ ${userDepartmentLabel} — Ngày ${todayStr}`,
        );
        setReportSummary(
          `Báo cáo kết quả công việc của ${userDepartmentLabel} trình Ban Giám đốc và nội bộ phòng.`,
        );
        setReportBodyText(
          [
            `I. KẾT QUẢ THỰC HIỆN TRONG KỲ (${userDepartmentLabel.toUpperCase()})`,
            `- Hồ sơ công việc đã tiếp nhận và xử lý: ${ov.validLeadsL2} hồ sơ`,
            `- Hồ sơ đang theo dõi lịch hẹn tiếp theo: ${ov.unansweredQuoteCount} hồ sơ`,
            `- Kết quả hoàn thành / chốt hợp đồng: ${ov.wonCount} hồ sơ`,
            ``,
            `II. ĐỀ XUẤT & KIẾN NGHỊ TRÌNH BAN GIÁM ĐỐC`,
            `- Phối hợp hỗ trợ kỹ thuật và phương án mặt bằng cho các dự án chu kỳ dài hạn.`,
          ].join('\n'),
        );
      }
    } catch {
      setErrorMsg('Không thể tự động lấy số liệu tổng hợp. Bạn vẫn có thể nhập nội dung trực tiếp.');
    } finally {
      setLoadingLiveMetrics(false);
    }
  };

  const handleToggleTargetDept = (code: DepartmentScopeCode) => {
    if (!canSendFullReport) return;
    if (code === 'ALL') {
      setSelectedTargetDepts(['ALL']);
      return;
    }
    setSelectedTargetDepts((prev) => {
      const withoutAll = prev.filter((item) => item !== 'ALL');
      if (withoutAll.includes(code)) {
        const next = withoutAll.filter((item) => item !== code);
        return next.length === 0 ? ['ALL'] : next;
      }
      return [...withoutAll, code];
    });
  };

  const handleDispatchReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!reportTitle.trim() || !reportBodyText.trim()) {
      setErrorMsg('Vui lòng nhập tiêu đề và nội dung chi tiết của báo cáo.');
      return;
    }

    setBusy(true);
    setErrorMsg(null);
    setFeedbackMsg(null);

    try {
      const formattedHtml = reportBodyText
        .split('\n')
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return '<br/>';
          if (/^(I|II|III|IV|V)\./.test(trimmed)) {
            return `<h3 style="font-weight:700;color:#1E3A8A;margin-top:12px;margin-bottom:4px;">${trimmed}</h3>`;
          }
          return `<p style="margin:4px 0;line-height:1.6;">${trimmed}</p>`;
        })
        .join('');

      await apiRequest('/api/v1/notifications', {
        method: 'POST',
        csrfToken: user.csrfToken,
        body: {
          title: reportTitle.trim(),
          summary:
            reportSummary.trim() ||
            reportBodyText.trim().replace(/\s+/g, ' ').slice(0, 220),
          contentHtml: formattedHtml,
          targetDepartments: canSendFullReport
            ? selectedTargetDepts
            : [userDepartmentCode],
          actionLabel: 'Xem báo cáo chi tiết',
        },
      });

      setReportTitle('');
      setReportSummary('');
      setReportBodyText('');
      await refreshUnreadCount();
      await loadNotificationCenter();
      setActiveTab('inbox');
      setFeedbackMsg(
        canSendFullReport
          ? 'Đã phát hành Báo cáo Điều hành thành công tới các phòng ban đã chọn.'
          : `Đã gửi báo cáo của ${userDepartmentLabel} tới Ban Giám đốc và nội bộ phòng.`,
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Không thể gửi báo cáo lúc này.',
      );
    } finally {
      setBusy(false);
    }
  };

  const filteredNotifications = useMemo(() => {
    return scopedItems.filter((item) => {
      if (readFilter === 'unread' && item.isRead) return false;
      if (
        canSendFullReport &&
        deptFilter !== 'ALL' &&
        item.departmentScope !== deptFilter &&
        item.departmentScope !== 'ALL'
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          item.title.toLowerCase().includes(q) ||
          item.summary.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [scopedItems, readFilter, canSendFullReport, deptFilter, searchQuery]);

  return (
    <div className="space-y-3.5 text-sm">
      {/* 1. CLEAN MODERN WHITE HEADER */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:px-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-50 border border-blue-200/80 text-[#1E3A8A] text-xs font-bold">
              <Bell className="w-3.5 h-3.5" />
              <span>Trung tâm Thông báo &amp; Báo cáo Nội bộ</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {canSendFullReport
                  ? 'Phạm vi: Giám đốc / Quản trị xem toàn bộ các phòng ban'
                  : `Phạm vi bảo mật: Chỉ xem thông báo của ${userDepartmentLabel}`}
              </span>
            </span>
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Thông báo Phòng ban &amp; Điều hành Báo cáo
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            {canSendFullReport
              ? 'Theo dõi thông báo của tất cả phòng ban và phát hành Báo cáo Điều hành toàn diện (Full) xuống từng bộ phận hoặc toàn công ty.'
              : `Nhận thông báo công việc riêng của ${userDepartmentLabel} và soạn báo cáo gửi trực tiếp lên Ban Giám đốc.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={busy}
            onClick={() => void loadNotificationCenter()}
            className="h-9 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleMarkAll()}
              className="h-9 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition"
            >
              <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Đánh dấu đã đọc ({unreadCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('compose')}
            className="h-9 px-3.5 rounded-xl bg-[#1E3A8A] hover:bg-blue-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition"
          >
            <PenSquare className="w-3.5 h-3.5" />
            <span>
              {canSendFullReport ? 'Soạn & Gửi Báo cáo Full' : 'Soạn Báo cáo Phòng'}
            </span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-medium">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-xs font-bold text-emerald-700"
          >
            Đóng
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center justify-between gap-2">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-xs font-bold text-rose-700"
          >
            Đóng
          </button>
        </div>
      )}

      {/* 2. UNIFIED NAVIGATION BAR (No Module Split!) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200/80 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('inbox')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition ${
                activeTab === 'inbox'
                  ? 'bg-[#1E3A8A] text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>Hộp thư Thông báo ({scopedItems.length})</span>
              {unreadCount > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                    activeTab === 'inbox'
                      ? 'bg-white text-[#1E3A8A]'
                      : 'bg-blue-50 text-[#1E3A8A]'
                  }`}
                >
                  {unreadCount} mới
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('reports')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition ${
                activeTab === 'reports'
                  ? 'bg-[#1E3A8A] text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Báo cáo Nội bộ ({reports.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('compose')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition ${
                activeTab === 'compose'
                  ? 'bg-[#1E3A8A] text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-[#1E3A8A] hover:bg-blue-50/50'
              }`}
            >
              <PenSquare className="w-4 h-4" />
              <span>
                {canSendFullReport ? '+ Soạn Báo cáo Full (Giám đốc)' : '+ Soạn Báo cáo Phòng'}
              </span>
            </button>
          </div>

          {activeTab === 'inbox' && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex p-0.5 rounded-xl bg-slate-200/70">
                <button
                  type="button"
                  onClick={() => setReadFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    readFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  onClick={() => setReadFilter('unread')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    readFilter === 'unread'
                      ? 'bg-white text-[#1E3A8A] shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Chưa đọc ({unreadCount})
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm thông báo..."
                  className="h-8 pl-8 pr-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-[#1E3A8A] w-52"
                />
              </div>
            </div>
          )}
        </div>

        {/* Department Filter Strip for BOD / ADMIN */}
        {activeTab === 'inbox' && canSendFullReport && (
          <div className="px-4 py-2.5 border-b border-slate-100 bg-white flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-semibold text-slate-500 mr-1">
              Lọc theo phòng ban:
            </span>
            {DEPARTMENT_OPTIONS.map((dept) => (
              <button
                key={dept.code}
                type="button"
                onClick={() => setDeptFilter(dept.code)}
                className={`px-2.5 py-1 rounded-lg border font-medium transition ${
                  deptFilter === dept.code
                    ? 'bg-blue-50 border-blue-200 text-[#1E3A8A] font-semibold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {dept.label}
              </button>
            ))}
          </div>
        )}

        {/* TAB 1: CLEAN WEB NOTIFICATION FEED */}
        {activeTab === 'inbox' && (
          <div className="divide-y divide-slate-100">
            {filteredNotifications.length === 0 ? (
              <div className="py-14 px-4 text-center space-y-2">
                <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-400 grid place-items-center mx-auto">
                  <MailOpen className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  Không có thông báo nào trong danh sách
                </p>
                <p className="text-xs text-slate-500">
                  Mọi thông báo công việc thuộc phạm vi {userDepartmentLabel} đã được xử lý.
                </p>
              </div>
            ) : (
              filteredNotifications.map((n) => {
                const reportIdMatch = n.actionUrl?.match(/reportId=(\d+)/);
                const linkedReportId = reportIdMatch ? Number(reportIdMatch[1]) : null;
                const matchedReport = linkedReportId
                  ? reports.find((r) => r.id === linkedReportId)
                  : null;

                return (
                  <div
                    key={n.id}
                    className={`p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                      !n.isRead
                        ? 'bg-blue-50/25 hover:bg-blue-50/45 border-l-2 border-l-[#1E3A8A]'
                        : 'bg-white hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl border grid place-items-center shrink-0 mt-0.5 ${
                          !n.isRead
                            ? 'bg-blue-50 border-blue-200 text-[#1E3A8A]'
                            : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        <Bell className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200/80 text-slate-700 text-[11px] font-semibold">
                            {n.category}
                          </span>
                          {!n.isRead && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-[#1E3A8A] border border-blue-200 text-[11px] font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#1E3A8A]" />
                              Mới
                            </span>
                          )}
                          <span className="text-xs text-slate-400 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {getRelativeTimeVi(n.createdAt)}
                          </span>
                        </div>
                        <h3
                          className={`text-sm ${
                            !n.isRead
                              ? 'font-bold text-slate-900'
                              : 'font-semibold text-slate-700'
                          }`}
                        >
                          {n.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                          {n.summary}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 sm:self-center">
                      {matchedReport ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReport(matchedReport);
                            if (!n.isRead) void handleMarkOne(n.id);
                          }}
                          className="h-8 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#1E3A8A] text-xs font-semibold inline-flex items-center gap-1.5 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Đọc báo cáo</span>
                        </button>
                      ) : n.actionUrl ? (
                        <Link
                          href={n.actionUrl}
                          onClick={() => {
                            if (!n.isRead) void handleMarkOne(n.id);
                          }}
                          className="h-8 px-3 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-[#1E3A8A] text-xs font-semibold inline-flex items-center transition shadow-2xs"
                        >
                          {n.actionLabel || 'Chi tiết'}
                        </Link>
                      ) : null}

                      {!n.isRead && (
                        <button
                          type="button"
                          onClick={() => void handleMarkOne(n.id)}
                          className="h-8 px-2.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-medium inline-flex items-center gap-1 transition"
                          title="Đánh dấu đã đọc"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Đã đọc</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: DISPATCHED REPORTS LIST */}
        {activeTab === 'reports' && (
          <div className="p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Danh sách Báo cáo Điều hành &amp; Báo cáo Phòng ban
                </h2>
                <p className="text-xs text-slate-500">
                  {canSendFullReport
                    ? 'Giám đốc xem toàn bộ báo cáo từ các phòng ban và báo cáo điều hành đã phát hành.'
                    : `Hiển thị các báo cáo thuộc phạm vi ${userDepartmentLabel} và báo cáo chung từ Ban Giám đốc.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('compose')}
                className="h-8 px-3 rounded-lg bg-[#1E3A8A] hover:bg-blue-800 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <PenSquare className="w-3.5 h-3.5" />
                <span>Soạn báo cáo mới</span>
              </button>
            </div>

            {reports.length === 0 ? (
              <div className="py-10 text-center text-slate-500 space-y-2">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">
                  Chưa có báo cáo nào được gửi trong phạm vi phòng ban của bạn
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('compose')}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-[#1E3A8A] text-xs font-semibold"
                >
                  Soạn báo cáo đầu tiên →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {reports.map((rpt) => (
                  <div
                    key={rpt.id}
                    className="p-4 rounded-xl bg-white border border-slate-200/90 hover:border-blue-300 transition flex flex-col justify-between gap-3 shadow-2xs"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-[#1E3A8A] bg-blue-50 px-2 py-0.5 rounded border border-blue-200/70">
                          {rpt.reportCode}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(rpt.createdAt).toLocaleString('vi-VN')}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {rpt.title}
                      </h3>
                      <p className="text-xs text-slate-600 line-clamp-2">
                        {rpt.summary}
                      </p>
                    </div>

                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-500">
                        Người gửi: <strong className="text-slate-800">{rpt.authorName}</strong>{' '}
                        ({rpt.authorRole})
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedReport(rpt)}
                        className="h-8 px-3 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-[#1E3A8A] font-semibold inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Xem toàn văn</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: BUILT-IN REPORT COMPOSER RIGHT INSIDE NOTIFICATIONS */}
        {activeTab === 'compose' && (
          <form onSubmit={(e) => void handleDispatchReport(e)} className="p-4 sm:p-5 space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#1E3A8A]" />
                  <strong className="text-sm font-bold text-slate-900">
                    {canSendFullReport
                      ? 'Chế độ Giám đốc / Quản trị: Soạn & Gửi Báo cáo Full đa phòng ban'
                      : `Chế độ Báo cáo Phòng ban: ${userDepartmentLabel}`}
                  </strong>
                </div>
                <p className="text-xs text-slate-500">
                  {canSendFullReport
                    ? 'Báo cáo được gửi trực tiếp vào Hộp thư Thông báo của toàn công ty hoặc từng phòng ban được chọn.'
                    : `Báo cáo sẽ được gửi trực tiếp tới Ban Giám đốc và các thành viên thuộc ${userDepartmentLabel}.`}
                </p>
              </div>

              <button
                type="button"
                disabled={loadingLiveMetrics}
                onClick={() => void handleFillExecutiveMetrics()}
                className="h-9 px-3.5 rounded-xl bg-white hover:bg-blue-50 border border-blue-200 text-[#1E3A8A] text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 shadow-2xs transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {loadingLiveMetrics
                    ? 'Đang lấy số liệu...'
                    : 'Chèn số liệu thực tế từ Hệ thống'}
                </span>
              </button>
            </div>

            {/* Target Department Selector (Full Control for BOD/ADMIN; Scoped for Department Users) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Phòng ban nhận báo cáo &amp; thông báo *
              </label>
              {canSendFullReport ? (
                <div className="flex flex-wrap gap-2">
                  {DEPARTMENT_OPTIONS.map((dept) => {
                    const active = selectedTargetDepts.includes(dept.code);
                    return (
                      <button
                        key={dept.code}
                        type="button"
                        onClick={() => handleToggleTargetDept(dept.code)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition ${
                          active
                            ? 'bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span>{active ? '✓' : '+'}</span>
                        <span>{dept.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
                  <Building2 className="w-3.5 h-3.5 text-[#1E3A8A]" />
                  <span>Ban Giám đốc &amp; {userDepartmentLabel} (Theo phân quyền phòng ban)</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tiêu đề Báo cáo / Thông báo điều hành *
                </label>
                <input
                  type="text"
                  required
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder="VD: Báo cáo Điều hành Tổng hợp Tuần 1 Tháng 11/2026..."
                  className="w-full h-9 px-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#1E3A8A]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tóm tắt ngắn hiển thị ngoài thông báo
                </label>
                <input
                  type="text"
                  value={reportSummary}
                  onChange={(e) => setReportSummary(e.target.value)}
                  placeholder="Tóm tắt trọng tâm báo cáo hoặc chỉ đạo..."
                  className="w-full h-9 px-3 rounded-xl border border-slate-300 text-sm text-slate-800 focus:outline-none focus:border-[#1E3A8A]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nội dung chi tiết Báo cáo *
              </label>
              <textarea
                rows={10}
                required
                value={reportBodyText}
                onChange={(e) => setReportBodyText(e.target.value)}
                placeholder="Nhập nội dung báo cáo chi tiết hoặc nhấn nút 'Chèn số liệu thực tế từ Hệ thống' ở góc phải phía trên..."
                className="w-full p-3.5 rounded-xl border border-slate-300 text-sm text-slate-800 leading-relaxed focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveTab('inbox')}
                className="h-9 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={busy}
                className="h-9 px-5 rounded-xl bg-[#1E3A8A] hover:bg-blue-800 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 shadow-2xs transition disabled:opacity-60"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {busy
                    ? 'Đang gửi báo cáo...'
                    : canSendFullReport
                      ? 'Phát hành Báo cáo & Gửi Thông báo'
                      : 'Gửi Báo cáo Phòng ban'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* MODAL XEM TOÀN VĂN BÁO CÁO NGAY TRONG TRANG THÔNG BÁO */}
      {selectedReport && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedReport(null)}
        >
          <div
            className="bg-white w-full max-w-3xl max-h-[88vh] rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#1E3A8A] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {selectedReport.reportCode}
                  </span>
                  <span className="text-xs text-slate-500">
                    Người gửi: <strong>{selectedReport.authorName}</strong> ({selectedReport.authorRole})
                  </span>
                  <span className="text-xs text-slate-400">
                    · {new Date(selectedReport.createdAt).toLocaleString('vi-VN')}
                  </span>
                </div>
                <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 mt-1">
                  {selectedReport.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 text-sm text-slate-800 leading-relaxed">
              {selectedReport.summary && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs sm:text-sm text-slate-700 font-medium">
                  {selectedReport.summary}
                </div>
              )}
              <div
                className="prose prose-sm max-w-none text-slate-800"
                dangerouslySetInnerHTML={{ __html: selectedReport.contentHtml }}
              />
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="h-9 px-4 rounded-xl bg-[#1E3A8A] text-white text-xs font-semibold"
              >
                Đóng báo cáo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
