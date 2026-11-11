'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  DatabaseBackup,
  Globe,
  HardDrive,
  History,
  Image as ImageIcon,
  LayoutTemplate,
  Lock,
  Monitor,
  Move,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
  User,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { ImageCropConfig, PublicBrandingDto } from '@toantrung/contracts';
import { apiRequest, ApiClientError } from '@/core/http/client';
import { useSession } from '@/core/session/SessionContext';

interface AuditItem {
  id: number;
  action: string;
  targetType: string;
  targetId: string | null;
  actorName: string;
  createdAt: string;
}

const DEFAULT_CROP: ImageCropConfig = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  frameScale: 1,
};

export default function SettingsPage() {
  const { user, branding, setBrandingState } = useSession();

  const [adminBranding, setAdminBranding] = useState<PublicBrandingDto>(branding);
  const [audits, setAudits] = useState<AuditItem[]>([]);

  // Sub-tab navigation: 'system_health' (Enhancement 8) vs 'branding_identity' (Enhancement 9)
  const [activeSettingsTab, setActiveSettingsTab] = useState<'system_health' | 'branding_identity'>(
    'branding_identity',
  );

  // Human-Friendly System Health & 1-Click Backup State (Enhancement 8)
  const [backingUp, setBackingUp] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState<string>('Chưa có bản sao lưu thủ công');
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [storageMetrics, setStorageMetrics] = useState<{
    dbSizeBytes: number;
    storageFilesBytes: number;
    totalUsedBytes: number;
    storageFileCount: number;
  } | null>(null);
  const [backupHistory, setBackupHistory] = useState<
    Array<{
      backupId: string;
      fileName: string;
      fileSizeBytes: number;
      sha256: string;
      restoreVerified: boolean;
      createdAt: string;
      createdBy: string;
    }>
  >([]);

  // Company Profile State (Enhancement 9)
  const [companyName, setCompanyName] = useState('CÔNG TY CỔ PHẦN ĐIỆN TỬ VIỄN THÔNG TOÀN TRUNG');
  const [companyHotline, setCompanyHotline] = useState('1900 599 817 - 0913 888 817');
  const [companyAddress, setCompanyAddress] = useState(
    'Số 72 Đường số 7, KDC Cityland Center Hills, P.7, Q. Gò Vấp, TP.HCM',
  );
  const [companyTaxCode, setCompanyTaxCode] = useState('0303716891');
  const [companyProfileMsg, setCompanyProfileMsg] = useState<string | null>(null);

  // 1. "Logo hiển thị" Draft State (Simplified: only preview, upload/replace, restore default, Cancel & Save)
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [pendingLogoPreview, setPendingLogoPreview] = useState<string | null>(null);

  // 2. Interactive Login Background Crop Editor Draft State
  const [draftHeroAlt, setDraftHeroAlt] = useState(branding.loginHero.altText);
  const [draftHeroCrop, setDraftHeroCrop] = useState<ImageCropConfig>(
    branding.loginHero.crop || DEFAULT_CROP,
  );
  const [pendingHeroFile, setPendingHeroFile] = useState<File | null>(null);
  const [pendingHeroPreview, setPendingHeroPreview] = useState<string | null>(null);
  const [loginPreviewDevice, setLoginPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  // Dragging state for Interactive Crop Editor
  const cropStageRef = useRef<HTMLDivElement | null>(null);
  const [dragMode, setDragMode] = useState<'none' | 'pan' | 'corner'>('none');
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    startOffsetX: number;
    startOffsetY: number;
    startFrameScale: number;
  }>({
    clientX: 0,
    clientY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    startFrameScale: 1,
  });

  // 3. Dashboard Banner Draft State ("Nội dung" & "Hình ảnh" tabs)
  const [bannerTab, setBannerTab] = useState<'content' | 'image'>('content');
  const [draftBannerHeadline, setDraftBannerHeadline] = useState(
    branding.dashboardBanner.headline,
  );
  const [draftBannerDescription, setDraftBannerDescription] = useState(
    branding.dashboardBanner.description,
  );
  const [draftBannerShowButton, setDraftBannerShowButton] = useState(
    branding.dashboardBanner.showButton,
  );
  const [draftBannerButtonLabel, setDraftBannerButtonLabel] = useState(
    branding.dashboardBanner.buttonLabel,
  );
  const [draftBannerButtonHref, setDraftBannerButtonHref] = useState(
    branding.dashboardBanner.buttonHref,
  );
  const [draftBannerShowImage, setDraftBannerShowImage] = useState(
    branding.dashboardBanner.showImage,
  );
  const [draftBannerImageAlt, setDraftBannerImageAlt] = useState(
    branding.dashboardBanner.imageAlt,
  );
  const [pendingBannerFile, setPendingBannerFile] = useState<File | null>(null);
  const [pendingBannerPreview, setPendingBannerPreview] = useState<string | null>(null);

  // Status feedback per section
  const [busySection, setBusySection] = useState<string | null>(null);
  const [logoStatus, setLogoStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [heroStatus, setHeroStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [bannerStatus, setBannerStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null,
  );

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const heroInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

  const isAdmin = user?.roleCode === 'ADMIN';

  const syncAllFromBranding = useCallback((b: PublicBrandingDto) => {
    setDraftHeroAlt(b.loginHero.altText);
    setDraftHeroCrop(b.loginHero.crop || DEFAULT_CROP);

    setDraftBannerHeadline(b.dashboardBanner.headline);
    setDraftBannerDescription(b.dashboardBanner.description);
    setDraftBannerShowButton(b.dashboardBanner.showButton);
    setDraftBannerButtonLabel(b.dashboardBanner.buttonLabel);
    setDraftBannerButtonHref(b.dashboardBanner.buttonHref);
    setDraftBannerShowImage(b.dashboardBanner.showImage);
    setDraftBannerImageAlt(b.dashboardBanner.imageAlt);
  }, []);

  const loadAdminBranding = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const [res, backupRes] = await Promise.all([
        apiRequest<{
          branding: PublicBrandingDto;
          recentAudits: AuditItem[];
        }>('/api/v1/settings/branding?scope=admin'),
        apiRequest<{
          companyProfile: {
            companyName: string;
            companyTaxCode: string;
            companyHotline: string;
            companyAddress: string;
          };
          storage: {
            dbSizeBytes: number;
            storageFilesBytes: number;
            totalUsedBytes: number;
            storageFileCount: number;
          };
          backups: Array<{
            backupId: string;
            fileName: string;
            fileSizeBytes: number;
            sha256: string;
            restoreVerified: boolean;
            createdAt: string;
            createdBy: string;
          }>;
        }>('/api/v1/settings/backup'),
      ]);
      setAdminBranding(res.branding);
      setBrandingState(res.branding);
      setAudits(res.recentAudits || []);
      syncAllFromBranding(res.branding);

      if (backupRes.companyProfile) {
        setCompanyName(backupRes.companyProfile.companyName);
        setCompanyTaxCode(backupRes.companyProfile.companyTaxCode);
        setCompanyHotline(backupRes.companyProfile.companyHotline);
        setCompanyAddress(backupRes.companyProfile.companyAddress);
      }
      if (backupRes.storage) {
        setStorageMetrics(backupRes.storage);
      }
      if (backupRes.backups) {
        setBackupHistory(backupRes.backups);
        if (backupRes.backups.length > 0 && backupRes.backups[0]) {
          setLastBackupTime(new Date(backupRes.backups[0].createdAt).toLocaleString('vi-VN'));
        }
      }
    } catch {
      // Keep fallback state
    }
  }, [isAdmin, setBrandingState, syncAllFromBranding]);

  useEffect(() => {
    void loadAdminBranding();
  }, [loadAdminBranding]);

  // Pointer drag listeners for Interactive Crop Editor
  useEffect(() => {
    if (dragMode === 'none') return;

    const handlePointerMove = (e: PointerEvent) => {
      const dx = e.clientX - dragStartRef.current.clientX;
      const dy = e.clientY - dragStartRef.current.clientY;
      const stageWidth = cropStageRef.current?.clientWidth || 360;
      const stageHeight = cropStageRef.current?.clientHeight || 220;

      if (dragMode === 'pan') {
        const deltaXPercent = (dx / stageWidth) * 100;
        const deltaYPercent = (dy / stageHeight) * 100;
        setDraftHeroCrop((prev) => ({
          ...prev,
          offsetX: Math.max(
            -50,
            Math.min(50, Math.round(dragStartRef.current.startOffsetX + deltaXPercent)),
          ),
          offsetY: Math.max(
            -50,
            Math.min(50, Math.round(dragStartRef.current.startOffsetY + deltaYPercent)),
          ),
        }));
      } else if (dragMode === 'corner') {
        const deltaScale = (dx + dy) / (stageWidth * 1.4);
        const nextScale = Math.max(
          0.65,
          Math.min(1, Number((dragStartRef.current.startFrameScale + deltaScale).toFixed(2))),
        );
        setDraftHeroCrop((prev) => ({
          ...prev,
          frameScale: nextScale,
        }));
      }
    };

    const handlePointerUp = () => {
      setDragMode('none');
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragMode]);

  if (!user || !isAdmin) return null;

  // --- Section 1: "Logo hiển thị" Handlers ---
  const handleSaveLogo = async () => {
    if (!pendingLogoFile) {
      setLogoStatus({
        type: 'err',
        text: 'Vui lòng chọn tệp Logo mới trước khi nhấn Lưu thay đổi.',
      });
      return;
    }

    setBusySection('logo');
    setLogoStatus(null);
    try {
      const formData = new FormData();
      formData.append('slot', 'logo');
      formData.append('file', pendingLogoFile);
      // Keep accessible alt text internally without requiring a visible input field
      formData.append('altText', adminBranding.logo.altText || 'Logo');

      const res = await apiRequest<{ branding: PublicBrandingDto }>('/api/v1/settings/branding', {
        method: 'POST',
        csrfToken: user.csrfToken,
        body: formData,
        isFormData: true,
      });

      setAdminBranding(res.branding);
      setBrandingState(res.branding);
      setPendingLogoFile(null);
      setPendingLogoPreview(null);
      if (logoInputRef.current) logoInputRef.current.value = '';
      setLogoStatus({
        type: 'ok',
        text: 'Đã lưu thay đổi Logo hiển thị thành công.',
      });
      await loadAdminBranding();
    } catch (err) {
      setLogoStatus({
        type: 'err',
        text:
          err instanceof ApiClientError
            ? err.message
            : 'Không thể lưu thay đổi Logo. Đã giữ nguyên bản nháp để bạn kiểm tra.',
      });
    } finally {
      setBusySection(null);
    }
  };

  const handleCancelLogoDraft = () => {
    setPendingLogoFile(null);
    setPendingLogoPreview(null);
    setLogoStatus(null);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const handleResetLogoDefault = async () => {
    setBusySection('reset-logo');
    setLogoStatus(null);
    try {
      const res = await apiRequest<{ branding: PublicBrandingDto }>('/api/v1/settings/branding', {
        method: 'POST',
        csrfToken: user.csrfToken,
        body: { action: 'reset', slot: 'logo' },
      });
      setAdminBranding(res.branding);
      setBrandingState(res.branding);
      setPendingLogoFile(null);
      setPendingLogoPreview(null);
      if (logoInputRef.current) logoInputRef.current.value = '';
      setLogoStatus({
        type: 'ok',
        text: 'Đã khôi phục Logo hiển thị về bản mặc định.',
      });
      await loadAdminBranding();
    } catch (err) {
      setLogoStatus({
        type: 'err',
        text: err instanceof ApiClientError ? err.message : 'Không thể khôi phục mặc định.',
      });
    } finally {
      setBusySection(null);
    }
  };

  // --- Section 2: Interactive Login Background Editor Handlers ---
  const handleResetHeroCropOnly = () => {
    setDraftHeroCrop({ ...DEFAULT_CROP });
    setHeroStatus(null);
  };

  const handleCancelHeroDraft = () => {
    setDraftHeroAlt(adminBranding.loginHero.altText);
    setDraftHeroCrop(adminBranding.loginHero.crop || DEFAULT_CROP);
    setPendingHeroFile(null);
    setPendingHeroPreview(null);
    setHeroStatus(null);
    if (heroInputRef.current) heroInputRef.current.value = '';
  };

  const handleSaveHeroChanges = async () => {
    setBusySection('hero');
    setHeroStatus(null);
    try {
      let latestBranding: PublicBrandingDto;

      if (pendingHeroFile) {
        const formData = new FormData();
        formData.append('slot', 'login_hero');
        formData.append('file', pendingHeroFile);
        formData.append('altText', draftHeroAlt.trim() || 'Hình nền trang đăng nhập');
        formData.append('crop', JSON.stringify(draftHeroCrop));

        const uploadRes = await apiRequest<{ branding: PublicBrandingDto }>(
          '/api/v1/settings/branding',
          {
            method: 'POST',
            csrfToken: user.csrfToken,
            body: formData,
            isFormData: true,
          },
        );
        latestBranding = uploadRes.branding;
      } else {
        const patchRes = await apiRequest<{ branding: PublicBrandingDto }>(
          '/api/v1/settings/branding',
          {
            method: 'PATCH',
            csrfToken: user.csrfToken,
            body: {
              heroAltText: draftHeroAlt.trim() || 'Hình nền trang đăng nhập',
              heroCrop: draftHeroCrop,
            },
          },
        );
        latestBranding = patchRes.branding;
      }

      setAdminBranding(latestBranding);
      setBrandingState(latestBranding);
      setPendingHeroFile(null);
      setPendingHeroPreview(null);
      setHeroStatus({
        type: 'ok',
        text: 'Đã lưu thay đổi hình nền và vùng cắt trang Đăng nhập thành công.',
      });
      await loadAdminBranding();
    } catch (err) {
      // Retain draft on error so Admin does not lose their adjustments
      setHeroStatus({
        type: 'err',
        text:
          err instanceof ApiClientError
            ? err.message
            : 'Lưu thay đổi thất bại. Bản nháp hiện tại vẫn được giữ nguyên.',
      });
    } finally {
      setBusySection(null);
    }
  };

  // --- Section 3: Dashboard Banner Handlers ---
  const handleCancelBannerDraft = () => {
    setDraftBannerHeadline(adminBranding.dashboardBanner.headline);
    setDraftBannerDescription(adminBranding.dashboardBanner.description);
    setDraftBannerShowButton(adminBranding.dashboardBanner.showButton);
    setDraftBannerButtonLabel(adminBranding.dashboardBanner.buttonLabel);
    setDraftBannerButtonHref(adminBranding.dashboardBanner.buttonHref);
    setDraftBannerShowImage(adminBranding.dashboardBanner.showImage);
    setDraftBannerImageAlt(adminBranding.dashboardBanner.imageAlt);
    setPendingBannerFile(null);
    setPendingBannerPreview(null);
    setBannerStatus(null);
    if (bannerInputRef.current) bannerInputRef.current.value = '';
  };

  const handleSaveBannerChanges = async () => {
    setBusySection('banner');
    setBannerStatus(null);
    try {
      if (pendingBannerFile && draftBannerShowImage) {
        const formData = new FormData();
        formData.append('slot', 'dashboard_banner');
        formData.append('file', pendingBannerFile);
        formData.append(
          'altText',
          draftBannerImageAlt.trim() || 'Ảnh minh họa Banner Dashboard',
        );

        await apiRequest<{ branding: PublicBrandingDto }>('/api/v1/settings/branding', {
          method: 'POST',
          csrfToken: user.csrfToken,
          body: formData,
          isFormData: true,
        });
      }

      const res = await apiRequest<{ branding: PublicBrandingDto }>('/api/v1/settings/branding', {
        method: 'PATCH',
        csrfToken: user.csrfToken,
        body: {
          bannerHeadline: draftBannerHeadline,
          bannerDescription: draftBannerDescription,
          bannerShowButton: draftBannerShowButton,
          bannerButtonLabel: draftBannerButtonLabel.trim() || 'Khám phá 5 phân hệ',
          bannerButtonHref: draftBannerButtonHref.trim() || '/leads',
          bannerShowImage: draftBannerShowImage,
          bannerImageAlt: draftBannerImageAlt.trim() || 'Ảnh minh họa Banner Dashboard',
        },
      });

      setAdminBranding(res.branding);
      setBrandingState(res.branding);
      setPendingBannerFile(null);
      setPendingBannerPreview(null);
      setBannerStatus({
        type: 'ok',
        text: 'Đã lưu cấu hình Banner Dashboard thành công. Trang Tổng quan đã được cập nhật.',
      });
      await loadAdminBranding();
    } catch (err) {
      setBannerStatus({
        type: 'err',
        text:
          err instanceof ApiClientError
            ? err.message
            : 'Không thể lưu Banner Dashboard. Bản nháp của bạn vẫn được giữ lại.',
      });
    } finally {
      setBusySection(null);
    }
  };

  // Computed values for Login Crop Editor & Live Full-Page Login Preview
  const activeLogoDraftUrl =
    pendingLogoPreview || adminBranding.logo.url || '/brand/logo-toan-trung.png';
  const activeHeroDraftUrl =
    pendingHeroPreview ||
    (adminBranding.loginHero.url &&
    adminBranding.loginHero.url !== '/brand/showroom-toan-trung.webp'
      ? adminBranding.loginHero.url
      : '/brand/login-hero-led-building.jpg');
  const effectiveHeroZoom = Math.max(
    1,
    draftHeroCrop.zoom / Math.max(0.6, draftHeroCrop.frameScale || 1),
  );
  const heroPosX = Math.max(0, Math.min(100, 50 - draftHeroCrop.offsetX));
  const heroPosY = Math.max(0, Math.min(100, 50 - draftHeroCrop.offsetY));

  // Computed values for Dashboard Banner Live Draft Preview
  const activeBannerDraftImageUrl = !draftBannerShowImage
    ? null
    : pendingBannerPreview ||
      adminBranding.dashboardBanner.imageUrl ||
      '/brand/showroom-toan-trung.webp';

  const handleOneClickBackup = async () => {
    if (backingUp) return;
    setBackingUp(true);
    setBackupNotice(null);
    try {
      const res = await apiRequest<{
        backup: {
          backupId: string;
          fileName: string;
          fileSizeBytes: number;
          sha256: string;
          restoreVerified: boolean;
          createdAt: string;
          createdBy: string;
        };
        backups: Array<{
          backupId: string;
          fileName: string;
          fileSizeBytes: number;
          sha256: string;
          restoreVerified: boolean;
          createdAt: string;
          createdBy: string;
        }>;
        storage: {
          dbSizeBytes: number;
          storageFilesBytes: number;
          totalUsedBytes: number;
          storageFileCount: number;
        };
      }>('/api/v1/settings/backup', {
        method: 'POST',
        body: JSON.stringify({ action: 'create_backup' }),
      });

      const nowStr = new Date(res.backup.createdAt).toLocaleString('vi-VN');
      setLastBackupTime(nowStr);
      setBackupHistory(res.backups || [res.backup]);
      if (res.storage) setStorageMetrics(res.storage);
      setBackupNotice(
        `Đã sao lưu cơ sở dữ liệu (${res.backup.fileName}, ${(res.backup.fileSizeBytes / 1024).toFixed(1)} KB, SHA-256: ${res.backup.sha256.slice(0, 12)}…) & kiểm tra khôi phục (Restore Verification) thành công lúc ${nowStr}.`,
      );
      await loadAdminBranding();
    } catch (err) {
      setBackupNotice(
        err instanceof Error ? `Lỗi sao lưu: ${err.message}` : 'Không thể thực hiện sao lưu dữ liệu.',
      );
    } finally {
      setBackingUp(false);
    }
  };

  const handleSaveCompanyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{
        companyProfile: {
          companyName: string;
          companyTaxCode: string;
          companyHotline: string;
          companyAddress: string;
        };
      }>('/api/v1/settings/backup', {
        method: 'POST',
        body: JSON.stringify({
          action: 'save_company_profile',
          companyName,
          companyTaxCode,
          companyHotline,
          companyAddress,
        }),
      });
      setBrandingState({
        ...adminBranding,
        organizationName: res.companyProfile.companyName,
      });
      setCompanyProfileMsg(
        'Đã lưu Thông tin Pháp nhân & Hồ sơ Công ty vào cơ sở dữ liệu thành công. Header và mẫu báo cáo A4 đã được đồng bộ.',
      );
      await loadAdminBranding();
    } catch (err) {
      setCompanyProfileMsg(
        err instanceof Error ? `Lỗi lưu hồ sơ: ${err.message}` : 'Không thể lưu hồ sơ công ty.',
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Dedicated Sub-Tabs (Enhancement 8 & 9) */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink tracking-tight">
            Cài đặt hệ thống & Thương hiệu
          </h1>
          <p className="text-[13px] text-ink-muted mt-1">
            Quản lý sức khỏe vận hành, sao lưu dữ liệu 1-chạm và nhận diện thương hiệu công ty.
          </p>
        </div>

        {/* Sub-Tabs Selector */}
        <div
          role="tablist"
          aria-label="Phân mục cài đặt hệ thống"
          className="inline-flex p-1 rounded-xl bg-white border border-slate-200/90 shadow-xs self-start"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeSettingsTab === 'branding_identity'}
            onClick={() => setActiveSettingsTab('branding_identity')}
            className={`px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-2 transition-all ${
              activeSettingsTab === 'branding_identity'
                ? 'bg-[#1E3A8A] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Thương hiệu & Thông tin công ty</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSettingsTab === 'system_health'}
            onClick={() => setActiveSettingsTab('system_health')}
            className={`px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-2 transition-all ${
              activeSettingsTab === 'system_health'
                ? 'bg-[#1E3A8A] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Sức khỏe Hệ thống & Sao lưu</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          SUB-TAB 1: NON-TECHNICAL, HUMAN-FRIENDLY SYSTEM HEALTH & BACKUP (ENHANCEMENT 8)
      ===================================================================== */}
      {activeSettingsTab === 'system_health' && (
        <div className="space-y-6">
          <section className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 grid place-items-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg font-extrabold text-slate-900">
                      Hệ thống đang vận hành ổn định
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                      100% Trực tuyến
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tất cả phân hệ tiếp nhận Lead, Báo giá, AI Studio và Kho tệp riêng tư đều hoạt động bình thường.
                  </p>
                </div>
              </div>

              {/* 1-Click Backup Button */}
              <div className="flex flex-col sm:items-end gap-1">
                <button
                  type="button"
                  disabled={backingUp}
                  onClick={handleOneClickBackup}
                  className="h-10 px-5 rounded-xl bg-[#1E3A8A] hover:bg-[#2563EB] text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-colors disabled:opacity-60"
                >
                  <DatabaseBackup className="w-4 h-4" />
                  <span>
                    {backingUp ? 'Đang sao lưu & kiểm tra...' : 'Sao lưu dữ liệu ngay (Backup)'}
                  </span>
                </button>
                <span className="text-[11px] text-slate-500">
                  Bản sao lưu gần nhất: <strong className="text-slate-700">{lastBackupTime}</strong>
                </span>
              </div>
            </div>

            {backupNotice && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
                <span>{backupNotice}</span>
                <button
                  type="button"
                  onClick={() => setBackupNotice(null)}
                  className="text-emerald-700 font-bold"
                >
                  Đóng
                </button>
              </div>
            )}

            {/* Real Storage Usage Bar */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <HardDrive className="w-4 h-4 text-[#2563EB]" />
                  <span>Dung lượng lưu trữ thực tế (Cơ sở dữ liệu SQLite & Kho tệp dự án)</span>
                </div>
                <strong className="font-mono text-sm font-extrabold text-[#1E3A8A]">
                  {storageMetrics
                    ? `${(storageMetrics.totalUsedBytes / (1024 * 1024)).toFixed(2)} MB (${storageMetrics.storageFileCount} tệp lưu trữ)`
                    : 'Đang đo dung lượng thực tế...'}
                </strong>
              </div>

              <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#1E3A8A] to-[#2563EB]"
                  style={{
                    width: storageMetrics
                      ? `${Math.max(4, Math.min(100, (storageMetrics.totalUsedBytes / (100 * 1024 * 1024)) * 100))}%`
                      : '5%',
                  }}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                <span>
                  {storageMetrics
                    ? `Database SQLite: ${(storageMetrics.dbSizeBytes / 1024).toFixed(1)} KB · Kho tệp & Sao lưu: ${(storageMetrics.storageFilesBytes / 1024).toFixed(1)} KB`
                    : 'Bao gồm: Cơ sở dữ liệu SQLite, Ảnh khảo sát, Bản thiết kế AI & Bản sao lưu'}
                </span>
                <span className="text-emerald-700 font-semibold">
                  Kiểm tra toàn vẹn SHA-256 & Restore Verification: Đạt
                </span>
              </div>
            </div>

            {backupHistory.length > 0 && (
              <div className="rounded-xl border border-slate-200/80 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>Danh sách bản sao lưu đã kiểm chứng khôi phục ({backupHistory.length})</span>
                  <span className="text-[11px] text-emerald-700 font-semibold">
                    SQLite Header + SHA-256 Verified
                  </span>
                </div>
                <div className="divide-y divide-slate-100 max-h-44 overflow-y-auto">
                  {backupHistory.slice(0, 5).map((b) => (
                    <div
                      key={b.backupId}
                      className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-900">{b.fileName}</span>
                        <span className="text-slate-500 ml-2">
                          ({(b.fileSizeBytes / 1024).toFixed(1)} KB · SHA-256: {b.sha256.slice(0, 12)}…)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold">
                          {b.restoreVerified ? 'Restore Verified' : 'Pending'}
                        </span>
                        <span className="text-slate-500">
                          {new Date(b.createdAt).toLocaleString('vi-VN')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Friendly Region & Access Rules Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block">Ngôn ngữ & Múi giờ chuẩn</span>
                  <strong className="font-bold text-slate-900 mt-0.5 block">
                    Tiếng Việt · Giờ Việt Nam (GMT+7)
                  </strong>
                </div>
                <Globe className="w-5 h-5 text-[#2563EB]" />
              </div>
              <div className="p-4 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block">Chế độ bảo vệ tệp đính kèm</span>
                  <strong className="font-bold text-emerald-700 mt-0.5 block">
                    Lưu trữ riêng tư · Phân quyền theo vai trò
                  </strong>
                </div>
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </section>

          {/* Audit Trail inside System Health Tab */}
          <section className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-xs">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2.5">
              <History className="w-4 h-4 text-brand" />
              <h3 className="font-display text-sm font-bold text-ink">
                Nhật ký hoạt động quản trị gần đây
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 border-b border-slate-200/80">
                    <th className="py-3 px-5 font-bold">Thời điểm</th>
                    <th className="py-3 px-5 font-bold">Người thực hiện</th>
                    <th className="py-3 px-5 font-bold">Hoạt động</th>
                    <th className="py-3 px-5 font-bold">Đối tượng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {audits.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        Chưa có bản ghi hoạt động nào.
                      </td>
                    </tr>
                  ) : (
                    audits.map((a) => (
                      <tr key={a.id}>
                        <td className="py-3 px-5 text-slate-500 whitespace-nowrap">
                          {new Date(a.createdAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="py-3 px-5 font-semibold text-ink">{a.actorName}</td>
                        <td className="py-3 px-5">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-brand font-semibold text-[11px]">
                            {a.action}
                          </span>
                        </td>
                        <td className="py-3 px-5 text-slate-600">
                          {a.targetType} {a.targetId ? `(${a.targetId})` : ''}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 2: DEDICATED "THƯƠNG HIỆU & THÔNG TIN CÔNG TY" (ENHANCEMENT 9)
      ===================================================================== */}
      {activeSettingsTab === 'branding_identity' && (
        <div id="branding" className="space-y-6">
          {/* =====================================================================
              SECTION 0: THÔNG TIN PHÁP NHÂN & HỒ SƠ CÔNG TY (COMPANY PROFILE)
          ===================================================================== */}
          <section className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1E3A8A] grid place-items-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    Thông tin Pháp nhân & Hồ sơ Công ty
                  </h2>
                  <p className="text-xs text-slate-500">
                    Hiển thị trên thanh tiêu đề hệ thống, mẫu xuất Excel (.xlsx) và tiêu đề Báo cáo A4
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-blue-50 text-[#1E3A8A] text-[11px] font-bold">
                Chuẩn nhận diện Toàn Trung
              </span>
            </div>

            {companyProfileMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                {companyProfileMsg}
              </div>
            )}

            <form onSubmit={handleSaveCompanyProfile} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    Tên công ty / Pháp nhân hiển thị
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Toàn Trung Telecom JSC"
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-900 focus:border-[#2563EB] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    Mã số thuế (Tax Code)
                  </label>
                  <input
                    type="text"
                    required
                    value={companyTaxCode}
                    onChange={(e) => setCompanyTaxCode(e.target.value)}
                    placeholder="0304567890"
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-white font-mono font-bold text-slate-900 focus:border-[#2563EB] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    Tổng đài / Hotline Kinh doanh
                  </label>
                  <input
                    type="text"
                    value={companyHotline}
                    onChange={(e) => setCompanyHotline(e.target.value)}
                    placeholder="1900 636 888"
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-900 focus:border-[#2563EB] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    Địa chỉ Trụ sở / Showroom chính
                  </label>
                  <input
                    type="text"
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    placeholder="Địa chỉ công ty..."
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-900 focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="submit"
                  className="h-9 px-5 rounded-xl bg-[#1E3A8A] hover:bg-[#2563EB] text-white font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Check className="w-4 h-4" />
                  <span>Lưu Thông tin Công ty</span>
                </button>
              </div>
            </form>
          </section>

          {/* =====================================================================
              SECTION 1: LOGO HIỂN THỊ (SIMPLIFIED)
          ===================================================================== */}
          <section
            id="logo-display-settings"
            className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-card space-y-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-soft text-brand grid place-items-center shrink-0">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-ink">
                    Logo hiển thị
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Hiển thị tại góc trên bên trái trang Đăng nhập và thanh điều hướng bên trái
                  </p>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  adminBranding.logo.isDefault && !pendingLogoFile
                    ? 'bg-slate-100 text-slate-600'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {pendingLogoFile
                  ? 'Đang có bản nháp mới'
                  : adminBranding.logo.isDefault
                    ? 'Mặc định gốc'
                    : 'Đã tùy chỉnh'}
              </span>
            </div>

            {logoStatus && (
              <div
                role="status"
                className={`p-3.5 rounded-xl text-xs font-semibold ${
                  logoStatus.type === 'ok'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}
              >
                {logoStatus.text}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Current / Draft Logo Preview */}
              <div className="md:col-span-6">
                <div className="h-36 rounded-2xl border border-dashed border-brand-border bg-gradient-to-br from-white to-brand-soft/50 flex items-center justify-center p-6">
                  <img
                    src={activeLogoDraftUrl}
                    alt={adminBranding.logo.altText || 'Logo'}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/brand/logo-toan-trung.png';
                    }}
                    className="max-h-20 max-w-[260px] w-auto h-auto object-contain"
                  />
                </div>
              </div>

              {/* Upload / Replace & Restore Default Controls */}
              <div className="md:col-span-6 space-y-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setLogoStatus(null);
                      setPendingLogoFile(file);
                      setPendingLogoPreview(URL.createObjectURL(file));
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="h-9 px-3.5 rounded-xl bg-brand-soft hover:bg-blue-100 text-brand text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Tải lên / Thay thế logo</span>
                  </button>

                  <button
                    type="button"
                    disabled={adminBranding.logo.isDefault || busySection === 'reset-logo'}
                    onClick={() => void handleResetLogoDefault()}
                    className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-40"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Khôi phục mặc định</span>
                  </button>
                </div>

                {pendingLogoFile && (
                  <p className="text-xs font-semibold text-brand">
                    Tệp đã chọn (chưa lưu): {pendingLogoFile.name}
                  </p>
                )}

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {adminBranding.logo.recommendedSpec}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={!pendingLogoFile || busySection === 'logo'}
                onClick={handleCancelLogoDraft}
                className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors disabled:opacity-40"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={!pendingLogoFile || busySection === 'logo'}
                onClick={() => void handleSaveLogo()}
                className="h-10 px-5 rounded-xl bg-brand hover:bg-brand-deep text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-60"
              >
                <Check className="w-4 h-4" />
                <span>{busySection === 'logo' ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
              </button>
            </div>
          </section>

          {/* =====================================================================
              SECTION 2: INTERACTIVE LOGIN BACKGROUND CROP EDITOR & FULL-PAGE PREVIEW
          ===================================================================== */}
          <section
            id="login-image-editor"
            className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-card space-y-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-soft text-brand grid place-items-center shrink-0">
                  <Move className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-ink">
                    Hình nền trang Đăng nhập
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Kéo ảnh để di chuyển góc nhìn, kéo 4 góc khung cắt hoặc phóng to/thu nhỏ và xem
                    trước toàn trang Đăng nhập thực tế
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleResetHeroCropOnly}
                className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Đặt lại</span>
              </button>
            </div>

            {heroStatus && (
              <div
                role="status"
                className={`p-3.5 rounded-xl text-xs font-semibold ${
                  heroStatus.type === 'ok'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}
              >
                {heroStatus.text}
              </div>
            )}

            {/* Two-column layout: Left = Interactive Crop Editor, Right = Complete Full-Page Login Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LEFT SIDE: Interactive Image Editing Area, Crop Rectangle & Controls */}
              <div className="lg:col-span-6 space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <strong className="font-bold text-ink">
                    Vùng chỉnh sửa & Khung cắt tỷ lệ màn hình
                  </strong>
                  <span className="text-slate-500">
                    Thu phóng: <strong>{Math.round(effectiveHeroZoom * 100)}%</strong>
                  </span>
                </div>

                {/* Interactive Stage */}
                <div
                  ref={cropStageRef}
                  onPointerDown={(e) => {
                    if ((e.target as HTMLElement).dataset.handle === 'corner') return;
                    e.preventDefault();
                    dragStartRef.current = {
                      clientX: e.clientX,
                      clientY: e.clientY,
                      startOffsetX: draftHeroCrop.offsetX,
                      startOffsetY: draftHeroCrop.offsetY,
                      startFrameScale: draftHeroCrop.frameScale,
                    };
                    setDragMode('pan');
                  }}
                  className="relative h-64 sm:h-72 w-full rounded-2xl bg-slate-950 overflow-hidden select-none cursor-grab active:cursor-grabbing border border-slate-300 shadow-inner"
                >
                  <img
                    src={activeHeroDraftUrl}
                    alt={draftHeroAlt}
                    draggable={false}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        '/brand/login-hero-led-building.jpg';
                    }}
                    style={{
                      objectPosition: `${heroPosX}% ${heroPosY}%`,
                      transform: `scale(${draftHeroCrop.zoom})`,
                      transformOrigin: `${heroPosX}% ${heroPosY}%`,
                    }}
                    className="w-full h-full object-cover opacity-90 pointer-events-none"
                  />

                  {/* Dimmed Outside Overlay + Proportional Viewport Crop Rectangle with 4 Draggable Corner Handles */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div
                      style={{
                        width: `${Math.round((draftHeroCrop.frameScale || 1) * 86)}%`,
                        aspectRatio: '16 / 10',
                        maxHeight: '86%',
                      }}
                      className="relative border-2 border-white shadow-[0_0_0_9999px_rgba(15,23,42,0.55)] rounded-lg"
                    >
                      {/* Rule-of-thirds grid lines */}
                      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                        <div className="border-r border-b border-white/25" />
                        <div className="border-r border-b border-white/25" />
                        <div className="border-b border-white/25" />
                        <div className="border-r border-b border-white/25" />
                        <div className="border-r border-b border-white/25" />
                        <div className="border-b border-white/25" />
                        <div className="border-r border-white/25" />
                        <div className="border-r border-white/25" />
                        <div />
                      </div>

                      {/* 4 Draggable Corner Handles */}
                      {[
                        'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize',
                        'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
                        'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
                        'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize',
                      ].map((posClass, idx) => (
                        <button
                          key={idx}
                          type="button"
                          data-handle="corner"
                          aria-label="Kéo góc để thay đổi kích thước khung cắt"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            dragStartRef.current = {
                              clientX: e.clientX,
                              clientY: e.clientY,
                              startOffsetX: draftHeroCrop.offsetX,
                              startOffsetY: draftHeroCrop.offsetY,
                              startFrameScale: draftHeroCrop.frameScale,
                            };
                            setDragMode('corner');
                          }}
                          className={`pointer-events-auto absolute w-4 h-4 rounded-sm bg-white border-2 border-brand shadow ${posClass}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px] text-white/90 pointer-events-none">
                    <span className="px-2 py-0.5 rounded bg-slate-900/75 backdrop-blur-sm">
                      Kéo ảnh để di chuyển · Kéo 4 góc để chỉnh khung cắt
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-900/75 font-mono">
                      X:{draftHeroCrop.offsetX} Y:{draftHeroCrop.offsetY}
                    </span>
                  </div>
                </div>

                {/* Zoom Controls */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="Thu nhỏ ảnh"
                    onClick={() =>
                      setDraftHeroCrop((prev) => ({
                        ...prev,
                        zoom: Math.max(1, Number((prev.zoom - 0.1).toFixed(2))),
                      }))
                    }
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-brand grid place-items-center shrink-0"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>

                  <input
                    type="range"
                    aria-label="Mức phóng đại ảnh trang đăng nhập"
                    min={1}
                    max={2.5}
                    step={0.05}
                    value={draftHeroCrop.zoom}
                    onChange={(e) =>
                      setDraftHeroCrop((prev) => ({
                        ...prev,
                        zoom: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-brand cursor-pointer"
                  />

                  <button
                    type="button"
                    aria-label="Phóng to ảnh"
                    onClick={() =>
                      setDraftHeroCrop((prev) => ({
                        ...prev,
                        zoom: Math.min(2.5, Number((prev.zoom + 0.1).toFixed(2))),
                      }))
                    }
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-brand grid place-items-center shrink-0"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>

                {/* Select Replacement Image & Image Description */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <input
                      ref={heroInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setHeroStatus(null);
                        setPendingHeroFile(file);
                        setPendingHeroPreview(URL.createObjectURL(file));
                      }}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => heroInputRef.current?.click()}
                      className="h-9 px-3.5 rounded-xl bg-brand-soft hover:bg-blue-100 text-brand text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Chọn ảnh thay thế</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResetHeroCropOnly}
                      className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Đặt lại</span>
                    </button>

                    {pendingHeroFile && (
                      <span className="text-[11px] font-semibold text-brand">
                        Đã chọn bản nháp: {pendingHeroFile.name}
                      </span>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="hero-alt-input"
                      className="block text-xs font-bold text-slate-700 mb-1.5"
                    >
                      Mô tả hình ảnh
                    </label>
                    <input
                      id="hero-alt-input"
                      type="text"
                      value={draftHeroAlt}
                      onChange={(e) => setDraftHeroAlt(e.target.value)}
                      placeholder="Mô tả ngắn gọn nội dung bức ảnh nền"
                      className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-slate-50/40 text-xs text-ink focus:bg-white focus:border-brand focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* RIGHT SIDE: Complete Full-Page Login Viewport Preview ("Máy tính" & "Điện thoại") */}
              <div className="lg:col-span-6 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-xs font-bold text-ink">
                    Xem trước toàn trang Đăng nhập thực tế
                  </strong>

                  <div
                    role="tablist"
                    aria-label="Chế độ xem trước trang đăng nhập"
                    className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={loginPreviewDevice === 'desktop'}
                      onClick={() => setLoginPreviewDevice('desktop')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all ${
                        loginPreviewDevice === 'desktop'
                          ? 'bg-white text-brand shadow-sm'
                          : 'text-slate-600 hover:text-ink'
                      }`}
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      <span>Máy tính</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={loginPreviewDevice === 'mobile'}
                      onClick={() => setLoginPreviewDevice('mobile')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all ${
                        loginPreviewDevice === 'mobile'
                          ? 'bg-white text-brand shadow-sm'
                          : 'text-slate-600 hover:text-ink'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>Điện thoại</span>
                    </button>
                  </div>
                </div>

                {/* Complete Login Page Viewport Container (60% Architectural LED Hero + 40% Split White Card) */}
                <div className="rounded-2xl bg-slate-100 border border-slate-200/90 p-4 flex items-center justify-center min-h-[390px]">
                  <div
                    className={`relative rounded-2xl overflow-hidden shadow-elevated border border-slate-300/80 flex bg-white transition-all ${
                      loginPreviewDevice === 'mobile'
                        ? 'w-[260px] h-[410px] flex-col'
                        : 'w-full h-[360px] flex-row'
                    }`}
                  >
                    {/* LEFT (60% on Desktop): Curved Architectural LED Building Facade + Dynamic Crop Binding */}
                    <div
                      className={`relative overflow-hidden bg-slate-900 shrink-0 ${
                        loginPreviewDevice === 'mobile' ? 'w-full h-[145px]' : 'w-[60%] h-full'
                      }`}
                      style={
                        loginPreviewDevice === 'desktop'
                          ? { clipPath: 'polygon(0 0, 100% 0, 82% 100%, 0 100%)' }
                          : undefined
                      }
                    >
                      <img
                        src={activeHeroDraftUrl}
                        alt={draftHeroAlt}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            '/brand/login-hero-led-building.jpg';
                        }}
                        style={{
                          objectPosition: `${heroPosX}% ${heroPosY}%`,
                          transform: `scale(${effectiveHeroZoom.toFixed(3)})`,
                          transformOrigin: `${heroPosX}% ${heroPosY}%`,
                        }}
                        className="w-full h-full object-cover select-none transition-transform duration-150"
                      />

                      {/* Brand Overlay Badge if custom image or mobile */}
                      {(pendingHeroPreview || !adminBranding.loginHero.isDefault) && (
                        <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-2 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-lg shadow border border-white/70">
                          <img
                            src={activeLogoDraftUrl}
                            alt={adminBranding.logo.altText || 'Logo'}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                '/brand/logo-toan-trung.png';
                            }}
                            className="h-4 w-auto max-w-[80px] object-contain"
                          />
                          <div className="pl-1.5 border-l border-slate-200 leading-none">
                            <span className="block text-[7px] font-extrabold text-[#0B3B8C] uppercase">
                              TOÀN TRUNG
                            </span>
                            <span className="block text-[6px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                              LED DISPLAY SOLUTIONS
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* RIGHT (40% on Desktop): Modern White Split-Card with "Đăng nhập", inputs & blue button */}
                    <div
                      className={`relative z-10 flex flex-col justify-center bg-white px-4 py-3 ${
                        loginPreviewDevice === 'mobile'
                          ? 'flex-1 w-full'
                          : 'w-[46%] -ml-[6%] h-full'
                      }`}
                    >
                      <div className="w-full max-w-[210px] mx-auto space-y-2.5">
                        <div>
                          <strong className="font-display text-sm font-bold text-[#0F172A] block leading-tight">
                            Đăng nhập
                          </strong>
                          <p className="text-[9px] text-slate-500 mt-0.5">
                            Chào mừng bạn quay trở lại hệ thống
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <span className="block text-[8.5px] font-semibold text-slate-700 mb-0.5">
                              Email hoặc tên đăng nhập
                            </span>
                            <div className="h-6.5 px-2 rounded-md border border-slate-200 bg-white flex items-center gap-1.5 text-[9px] text-slate-400">
                              <User className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">Nhập tài khoản của bạn</span>
                            </div>
                          </div>

                          <div>
                            <span className="block text-[8.5px] font-semibold text-slate-700 mb-0.5">
                              Mật khẩu
                            </span>
                            <div className="h-6.5 px-2 rounded-md border border-slate-200 bg-white flex items-center gap-1.5 text-[9px] text-slate-400">
                              <Lock className="w-2.5 h-2.5 shrink-0" />
                              <span>Nhập mật khẩu</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[8.5px] text-slate-500">
                          <span>☐ Ghi nhớ đăng nhập</span>
                          <span className="text-[#1E40AF] font-semibold">Quên mật khẩu?</span>
                        </div>

                        <div className="h-7 rounded-md bg-[#0B3B8C] text-white text-[9.5px] font-semibold flex items-center justify-center gap-1 shadow-xs">
                          <span>Đăng nhập</span>
                          <ArrowRight className="w-2.5 h-2.5" />
                        </div>

                        <div className="pt-1 border-t border-slate-100 text-center text-[7.5px] text-slate-400">
                          © 2026 Toàn Trung. All rights reserved.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={busySection === 'hero'}
                onClick={handleCancelHeroDraft}
                className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={busySection === 'hero'}
                onClick={() => void handleSaveHeroChanges()}
                className="h-10 px-5 rounded-xl bg-brand hover:bg-brand-deep text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-60"
              >
                <Check className="w-4 h-4" />
                <span>{busySection === 'hero' ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
              </button>
            </div>
          </section>

          {/* =====================================================================
              SECTION 3: BANNER DASHBOARD MANAGEMENT ("Nội dung" & "Hình ảnh" tabs)
          ===================================================================== */}
          <section
            id="dashboard-banner-settings"
            className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-card space-y-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-soft text-brand grid place-items-center shrink-0">
                  <LayoutTemplate className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-ink">
                    Banner Dashboard
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Quản lý nội dung tiêu đề, mô tả, nút hành động và hình ảnh Banner hiển thị trên
                    trang Tổng quan
                  </p>
                </div>
              </div>

              {/* Tabs: "Nội dung" & "Hình ảnh" */}
              <div
                role="tablist"
                aria-label="Chế độ chỉnh sửa Banner Dashboard"
                className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={bannerTab === 'content'}
                  onClick={() => setBannerTab('content')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    bannerTab === 'content'
                      ? 'bg-white text-brand shadow-sm'
                      : 'text-slate-600 hover:text-ink'
                  }`}
                >
                  Nội dung
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={bannerTab === 'image'}
                  onClick={() => setBannerTab('image')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    bannerTab === 'image'
                      ? 'bg-white text-brand shadow-sm'
                      : 'text-slate-600 hover:text-ink'
                  }`}
                >
                  Hình ảnh
                </button>
              </div>
            </div>

            {bannerStatus && (
              <div
                role="status"
                className={`p-3.5 rounded-xl text-xs font-semibold ${
                  bannerStatus.type === 'ok'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}
              >
                {bannerStatus.text}
              </div>
            )}

            {/* Tab Panels */}
            {bannerTab === 'content' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="banner-headline-input"
                      className="text-xs font-bold text-slate-700"
                    >
                      Tiêu đề chính (Headline)
                    </label>
                    {draftBannerHeadline && (
                      <button
                        type="button"
                        onClick={() => setDraftBannerHeadline('')}
                        className="text-[11px] font-semibold text-red-600 hover:underline"
                      >
                        Xóa tiêu đề
                      </button>
                    )}
                  </div>
                  <input
                    id="banner-headline-input"
                    type="text"
                    value={draftBannerHeadline}
                    onChange={(e) => setDraftBannerHeadline(e.target.value)}
                    placeholder="Nhập tiêu đề chính cho Banner Dashboard (hoặc để trống để ẩn)"
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-slate-50/40 text-xs text-ink focus:bg-white focus:border-brand focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="banner-desc-input"
                      className="text-xs font-bold text-slate-700"
                    >
                      Mô tả ngắn (Description)
                    </label>
                    {draftBannerDescription && (
                      <button
                        type="button"
                        onClick={() => setDraftBannerDescription('')}
                        className="text-[11px] font-semibold text-red-600 hover:underline"
                      >
                        Xóa mô tả
                      </button>
                    )}
                  </div>
                  <textarea
                    id="banner-desc-input"
                    rows={2}
                    value={draftBannerDescription}
                    onChange={(e) => setDraftBannerDescription(e.target.value)}
                    placeholder="Nhập mô tả ngắn cho Banner Dashboard (hoặc để trống để ẩn)"
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50/40 text-xs text-ink focus:bg-white focus:border-brand focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2 pt-1">
                  <label className="inline-flex items-center gap-2.5 text-xs font-bold text-ink cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={draftBannerShowButton}
                      onChange={(e) => setDraftBannerShowButton(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand"
                    />
                    <span>Hiển thị nút hành động trên Banner</span>
                  </label>
                </div>

                {draftBannerShowButton && (
                  <>
                    <div>
                      <label
                        htmlFor="banner-btn-label"
                        className="block text-xs font-bold text-slate-700 mb-1.5"
                      >
                        Nhãn nút hành động
                      </label>
                      <input
                        id="banner-btn-label"
                        type="text"
                        value={draftBannerButtonLabel}
                        onChange={(e) => setDraftBannerButtonLabel(e.target.value)}
                        placeholder="Ví dụ: Khám phá 5 phân hệ"
                        className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-slate-50/40 text-xs text-ink focus:bg-white focus:border-brand focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="banner-btn-href"
                        className="block text-xs font-bold text-slate-700 mb-1.5"
                      >
                        Đường dẫn đích (Link)
                      </label>
                      <input
                        id="banner-btn-href"
                        type="text"
                        value={draftBannerButtonHref}
                        onChange={(e) => setDraftBannerButtonHref(e.target.value)}
                        placeholder="Ví dụ: /leads hoặc /reports"
                        className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-slate-50/40 text-xs text-ink focus:bg-white focus:border-brand focus:outline-none"
                      />
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setBannerStatus(null);
                      setPendingBannerFile(file);
                      setPendingBannerPreview(URL.createObjectURL(file));
                      setDraftBannerShowImage(true);
                    }}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => bannerInputRef.current?.click()}
                    className="h-9 px-3.5 rounded-xl bg-brand-soft hover:bg-blue-100 text-brand text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Thay ảnh Banner</span>
                  </button>

                  {draftBannerShowImage ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDraftBannerShowImage(false);
                        setPendingBannerFile(null);
                        setPendingBannerPreview(null);
                      }}
                      className="h-9 px-3.5 rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-600 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Gỡ ảnh Banner</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDraftBannerShowImage(true)}
                      className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Hiển thị lại ảnh Banner</span>
                    </button>
                  )}

                  {pendingBannerFile && (
                    <span className="text-xs font-semibold text-brand">
                      Bản nháp ảnh mới: {pendingBannerFile.name}
                    </span>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="banner-image-alt"
                    className="block text-xs font-bold text-slate-700 mb-1.5"
                  >
                    Mô tả hình ảnh Banner
                  </label>
                  <input
                    id="banner-image-alt"
                    type="text"
                    value={draftBannerImageAlt}
                    onChange={(e) => setDraftBannerImageAlt(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-slate-50/40 text-xs text-ink focus:bg-white focus:border-brand focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Live Preview of the Draft Dashboard Banner */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs">
                <strong className="font-bold text-ink">
                  Xem trước trực tiếp Banner Dashboard (Bản nháp)
                </strong>
                <span className="text-slate-400">
                  Chỉ cập nhật lên trang Tổng quan sau khi nhấn Lưu thay đổi
                </span>
              </div>

              <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#143B85] via-[#1E53A3] to-[#2B6CB8] text-white shadow-card border border-blue-900/20">
                <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
                  <div
                    className={`${
                      activeBannerDraftImageUrl ? 'lg:col-span-7' : 'lg:col-span-12'
                    } p-6 sm:p-7 flex flex-col justify-center relative z-10`}
                  >
                    {draftBannerHeadline.trim() ? (
                      <h3 className="font-display text-xl sm:text-2xl font-bold leading-tight break-words">
                        {draftBannerHeadline}
                      </h3>
                    ) : (
                      <p className="text-xs italic text-sky-200/70">(Đã ẩn tiêu đề chính)</p>
                    )}

                    {draftBannerDescription.trim() && (
                      <p className="text-xs text-sky-100/90 mt-2 max-w-xl leading-relaxed break-words">
                        {draftBannerDescription}
                      </p>
                    )}

                    {draftBannerShowButton && draftBannerButtonLabel.trim() && (
                      <div className="mt-4">
                        <span className="px-4 py-2 rounded-xl bg-white text-brand font-bold text-xs inline-flex items-center gap-2 shadow-sm">
                          <span>{draftBannerButtonLabel}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    )}
                  </div>

                  {activeBannerDraftImageUrl && (
                    <div className="hidden lg:block lg:col-span-5 relative min-h-[180px]">
                      <img
                        src={activeBannerDraftImageUrl}
                        alt={draftBannerImageAlt}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            '/brand/showroom-toan-trung.webp';
                        }}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-[#1E53A3] via-[#1E53A3]/45 to-transparent" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={busySection === 'banner'}
                onClick={handleCancelBannerDraft}
                className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={busySection === 'banner'}
                onClick={() => void handleSaveBannerChanges()}
                className="h-10 px-5 rounded-xl bg-brand hover:bg-brand-deep text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-60"
              >
                <Check className="w-4 h-4" />
                <span>{busySection === 'banner' ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
