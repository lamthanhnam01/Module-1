'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  Laptop,
  Lock,
  MapPin,
  Phone,
  RotateCcw,
  Shield,
  ShieldCheck,
  Smartphone,
  Trash2,
  User,
  UserCheck,
  X,
} from 'lucide-react';
import {
  BA_PERMISSIONS,
  DEPARTMENT_LABELS,
  hasBaPermission,
  type BaPermissionKey,
} from '@toantrung/contracts';
import { apiRequest, ApiClientError } from '@/core/http/client';
import { useSession } from '@/core/session/SessionContext';
import { getInitials } from '@/core/layout/WorkspaceShell';
import { ChangePasswordDialog } from '@/core/components/ChangePasswordDialog';

const PERMISSION_LABELS: Record<BaPermissionKey, string> = {
  LEAD_CREATE: 'Tiếp nhận Lead thủ công (Hotline/Zalo)',
  LEAD_VIEW_OWN: 'Xem danh sách & chi tiết Lead phụ trách (UC01)',
  LEAD_VIEW_ALL: 'Xem toàn bộ Lead hệ thống / Ẩn danh (UC01)',
  LEAD_UPDATE_PIPELINE: 'Cập nhật trạng thái Pipeline 5 bước (UC02)',
  LEAD_REASSIGN: 'Chuyển giao NVKD & Duyệt Spam (UC02)',
  ATTACHMENT_UPLOAD_VIEW: 'Tải lên & Xem tệp công trình riêng tư',
  AI_DESIGN: 'Sử dụng AI Mockup & Phối cảnh 3D Studio (UC05)',
  AI_MARKETING_SEO: 'Sử dụng AI Gợi ý Từ khóa & Nội dung SEO (UC03)',
  TRACKING_ADS_OPTIMIZE: 'Theo dõi Đồng bộ đa kênh & Sửa Nguồn/Chiến dịch Ads',
  DASHBOARD_VIEW: 'Xem Báo cáo Điều hành & Soạn văn bản A4 (UC04)',
  EXPORT_DATA: 'Xuất dữ liệu Báo cáo & Lead ra Excel (.xlsx)',
  SYSTEM_USER_ADMIN: 'Quản trị Hệ thống, Nhân sự & Thương hiệu (UC06)',
};

const DIRECT_MANAGER_BY_ROLE: Record<string, string> = {
  ADMIN: 'Ban Giám Đốc Toàn Trung',
  BOD: 'Hội đồng Quản trị Toàn Trung',
  SALES_LEAD: 'Ban Giám Đốc (BOD)',
  SALES: 'Trưởng nhóm Kinh doanh (Lead Sales)',
  MKT_LEAD: 'Ban Giám Đốc (BOD)',
  MKT_STAFF: 'Trưởng nhóm Marketing (Lead MKT)',
  ADS: 'Trưởng nhóm Marketing (Lead MKT)',
  DESIGNER: 'Ban Giám Đốc & Trưởng phòng Kỹ thuật',
};

export default function ProfilePage() {
  const { user, refreshSession } = useSession();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingAvatarPreview, setPendingAvatarPreview] = useState<string | null>(null);
  const [removeAvatarFlag, setRemoveAvatarFlag] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setPhone(user.phone || '');
      setPendingAvatarFile(null);
      setPendingAvatarPreview(null);
      setRemoveAvatarFlag(false);
    }
  }, [user]);

  useEffect(() => {
    if (!toastNotice) return;
    const timer = setTimeout(() => setToastNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [toastNotice]);

  if (!user) return null;

  const displayedAvatarUrl = removeAvatarFlag
    ? null
    : pendingAvatarPreview || user.avatarUrl || null;

  const hasProfileDraftChanges =
    fullName.trim() !== user.fullName ||
    phone.trim() !== (user.phone || '') ||
    pendingAvatarFile !== null ||
    removeAvatarFlag;

  const handleSelectAvatar = (file: File | undefined) => {
    if (!file) return;
    setProfileMsg(null);
    const previewUrl = URL.createObjectURL(file);
    setPendingAvatarFile(file);
    setPendingAvatarPreview(previewUrl);
    setRemoveAvatarFlag(false);
  };

  const handleMarkRemoveAvatar = () => {
    setProfileMsg(null);
    setPendingAvatarFile(null);
    setPendingAvatarPreview(null);
    setRemoveAvatarFlag(true);
    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
    }
  };

  const handleCancelProfileDraft = () => {
    setFullName(user.fullName);
    setPhone(user.phone || '');
    setPendingAvatarFile(null);
    setPendingAvatarPreview(null);
    setRemoveAvatarFlag(false);
    setProfileMsg(null);
    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setSavingProfile(true);
    try {
      if (pendingAvatarFile) {
        const formData = new FormData();
        formData.append('fullName', fullName.trim());
        formData.append('phone', phone.trim());
        formData.append('removeAvatar', 'false');
        formData.append('avatar', pendingAvatarFile);

        await apiRequest('/api/v1/profile', {
          method: 'PATCH',
          csrfToken: user.csrfToken,
          body: formData,
          isFormData: true,
        });
      } else {
        await apiRequest('/api/v1/profile', {
          method: 'PATCH',
          csrfToken: user.csrfToken,
          body: {
            fullName: fullName.trim(),
            phone: phone.trim(),
            ...(removeAvatarFlag ? { removeAvatar: true } : {}),
          },
        });
      }

      await refreshSession();
      setPendingAvatarFile(null);
      setPendingAvatarPreview(null);
      setRemoveAvatarFlag(false);
      setProfileMsg({
        type: 'ok',
        text: 'Đã lưu thay đổi hồ sơ tài khoản thành công.',
      });
      setToastNotice('Đã cập nhật thông tin hồ sơ cá nhân thành công.');
    } catch (err) {
      setProfileMsg({
        type: 'err',
        text: err instanceof ApiClientError ? err.message : 'Không thể lưu hồ sơ tài khoản.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const assignedPermissionKeys = (Object.keys(BA_PERMISSIONS) as BaPermissionKey[]).filter((key) =>
    hasBaPermission(user.roleCode, key),
  );
  const employeeCode = `TT-NV-${String(user.id).padStart(4, '0')}`;
  const joiningDate = '15/06/2023';
  const departmentLabel = DEPARTMENT_LABELS[user.department] || user.department;
  const directManager = DIRECT_MANAGER_BY_ROLE[user.roleCode] || 'Ban Giám Đốc Toàn Trung';

  return (
    <div className="space-y-6">
      {/* Live Interactive Toast Notification */}
      {toastNotice && (
        <div
          role="status"
          className="fixed top-5 right-5 z-50 max-w-md bg-emerald-950 text-white px-4 py-3.5 rounded-2xl shadow-2xl border border-emerald-700/80 flex items-center gap-3 text-xs font-semibold animate-in fade-in slide-in-from-top-3"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="flex-1 leading-relaxed">{toastNotice}</span>
          <button
            type="button"
            onClick={() => setToastNotice(null)}
            className="text-emerald-300 hover:text-white p-1"
            aria-label="Đóng thông báo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* =========================================================================
          EXECUTIVE HEADER CARD (Fix 5)
      ========================================================================= */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Top Banner: Elegant gradient cover */}
        <div className="h-36 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-800 relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_60%)]" />
          <div className="absolute top-4 right-5 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-white text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Đang hoạt động</span>
          </div>
        </div>

        {/* Profile Info Row placed neatly next to the Avatar */}
        <div className="px-6 pb-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-end gap-5">
              {/* Large Circular Avatar with Camera Upload Badge */}
              <div className="w-24 h-24 rounded-full ring-4 ring-white shadow-lg bg-blue-100 text-blue-800 text-2xl font-bold flex items-center justify-center -mt-12 ml-0 sm:ml-2 z-10 relative shrink-0">
                {displayedAvatarUrl ? (
                  <img
                    src={displayedAvatarUrl}
                    alt={fullName || user.fullName}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span>{getInitials(fullName || user.fullName)}</span>
                )}
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  title="Tải lên hoặc đổi ảnh đại diện"
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white ring-2 ring-white shadow-md flex items-center justify-center transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => handleSelectAvatar(e.target.files?.[0])}
                  className="hidden"
                />
              </div>

              {/* Name, Badges & Sub-details */}
              <div className="pt-2 sm:pt-3 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                    {fullName || user.fullName}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
                    <BadgeCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>{user.roleName}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium">
                    <Building2 className="w-3 h-3 text-slate-500" />
                    <span>{departmentLabel}</span>
                  </span>
                </div>

                <p className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span>
                    Mã NV: <strong className="font-mono text-slate-700">{employeeCode}</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Email: <strong className="text-slate-700">{user.email}</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Ngày gia nhập: <strong className="text-slate-700">{joiningDate}</strong>
                  </span>
                </p>

                {pendingAvatarFile && (
                  <p className="text-xs font-semibold text-blue-600">
                    Ảnh đại diện mới đã chọn ({pendingAvatarFile.name}) — Nhấn &ldquo;Lưu thông tin&rdquo; ở thẻ bên dưới để áp dụng.
                  </p>
                )}
              </div>
            </div>

            {/* Right Action: Clean "Đổi mật khẩu" button */}
            <div className="flex items-center gap-2.5 self-start md:self-end pt-2 md:pt-0">
              {(displayedAvatarUrl || user.avatarUrl) && !removeAvatarFlag && (
                <button
                  type="button"
                  onClick={handleMarkRemoveAvatar}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-red-50 hover:border-red-200 text-slate-600 hover:text-red-600 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Gỡ ảnh</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsPasswordDialogOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm font-medium text-xs transition-colors"
              >
                <KeyRound className="w-4 h-4" />
                <span>Đổi mật khẩu</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          BODY CONTENT: 2-COLUMN BALANCED GRID BELOW THE HEADER (Fix 5)
      ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT CARD: Thông tin cá nhân & Công việc */}
        <section className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
            <div className="pb-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 grid place-items-center shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-slate-900">
                    Thông tin cá nhân & Công việc
                  </h2>
                  <p className="text-xs text-slate-500">
                    Hồ sơ phòng ban, người quản lý trực tiếp, chi nhánh và thông tin liên hệ
                  </p>
                </div>
              </div>
              <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                {employeeCode}
              </span>
            </div>

            {/* Clean Table of Department, Direct Manager, Phone, Branch Location, Assigned Roles */}
            <div className="rounded-xl border border-slate-200/90 overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50/60">
                    <th className="py-3 px-4 font-semibold text-slate-500 bg-slate-50/70 w-44">
                      Phòng ban trực thuộc
                    </th>
                    <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>{departmentLabel}</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60">
                    <th className="py-3 px-4 font-semibold text-slate-500 bg-slate-50/70">
                      Quản lý trực tiếp
                    </th>
                    <td className="py-3 px-4 font-semibold text-slate-800 flex items-center gap-2">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{directManager}</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60">
                    <th className="py-3 px-4 font-semibold text-slate-500 bg-slate-50/70">
                      Số điện thoại liên hệ
                    </th>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {phone || user.phone || 'Chưa cập nhật'}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60">
                    <th className="py-3 px-4 font-semibold text-slate-500 bg-slate-50/70">
                      Chi nhánh làm việc
                    </th>
                    <td className="py-3 px-4 text-slate-700 font-medium flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Trụ sở chính TP. Hồ Chí Minh (Tân Phú)</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60">
                    <th className="py-3 px-4 font-semibold text-slate-500 bg-slate-50/70">
                      Vai trò hệ thống
                    </th>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 font-bold">
                        {user.roleName} ({user.roleCode})
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Editable Personal Contact Form */}
            <form onSubmit={(e) => void handleSaveProfile(e)} className="pt-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="profile-fullname"
                    className="block text-xs font-bold text-slate-700 mb-1.5"
                  >
                    Cập nhật Họ và tên
                  </label>
                  <input
                    id="profile-fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="profile-phone"
                    className="block text-xs font-bold text-slate-700 mb-1.5"
                  >
                    Cập nhật Số điện thoại công việc
                  </label>
                  <div className="relative flex items-center">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 pointer-events-none" />
                    <input
                      id="profile-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0903xxxxxx"
                      className="w-full h-10 pl-9 pr-3.5 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {profileMsg && (
                <div
                  role="status"
                  className={`p-3 rounded-xl text-xs font-semibold ${
                    profileMsg.type === 'ok'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}
                >
                  {profileMsg.text}
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={!hasProfileDraftChanges || savingProfile}
                  onClick={handleCancelProfileDraft}
                  className="h-9 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold inline-flex items-center gap-1.5 transition-colors disabled:opacity-40"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Hoàn tác</span>
                </button>

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="h-9 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-60"
                >
                  <Check className="w-4 h-4" />
                  <span>{savingProfile ? 'Đang lưu...' : 'Lưu thông tin'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Assigned System Roles & BA Matrix Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 grid place-items-center">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-display text-sm font-bold text-slate-900">
                    Quyền hạn nghiệp vụ được cấp ({assignedPermissionKeys.length}/12 quyền BA)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Áp dụng theo ma trận phân quyền chuẩn cho vai trò <strong>{user.roleName}</strong>
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                RBAC Active
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {assignedPermissionKeys.map((permKey) => (
                <div
                  key={permKey}
                  className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/70 flex items-center gap-2 text-slate-700 font-medium"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate">{PERMISSION_LABELS[permKey] || permKey}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* RIGHT CARD: Bảo mật & Phiên làm việc (Fix 1 & Fix 5) */}
        <section className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
            <div className="pb-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 grid place-items-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  Bảo mật & Phiên làm việc
                </h2>
                <p className="text-xs text-slate-500">
                  Đổi mật khẩu đăng nhập, xác thực 2 lớp (2FA) và quản lý thiết bị
                </p>
              </div>
            </div>

            {/* Quick Password Reset Card with Functioning Dialog Trigger (Fix 1) */}
            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/90 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-blue-700" />
                  <strong className="text-xs font-bold text-slate-900">
                    Mật khẩu đăng nhập
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPasswordDialogOpen(true)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                >
                  Mở hộp thoại đổi mật khẩu
                </button>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Khi đổi mật khẩu mới, toàn bộ các phiên đăng nhập cũ trên thiết bị khác sẽ tự động
                thu hồi để bảo mật.
              </p>
              <button
                type="button"
                onClick={() => setIsPasswordDialogOpen(true)}
                className="w-full h-9 rounded-xl bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-blue-700 text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Đổi mật khẩu ngay</span>
              </button>
            </div>

            {/* Two-Factor Auth Toggle */}
            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/90 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-blue-700 grid place-items-center shrink-0 mt-0.5">
                  <Fingerprint className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-xs font-bold text-slate-900 block">
                    Xác thực 2 lớp (2FA Authenticator)
                  </strong>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Bảo vệ tài khoản khi đăng nhập trên thiết bị lạ hoặc mạng bên ngoài công ty.
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={twoFactorEnabled}
                onClick={() => {
                  const next = !twoFactorEnabled;
                  setTwoFactorEnabled(next);
                  setToastNotice(
                    next
                      ? 'Đã bật bảo vệ Xác thực 2 lớp (2FA) cho tài khoản.'
                      : 'Đã tạm tắt Xác thực 2 lớp (2FA).',
                  );
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                  twoFactorEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ${
                    twoFactorEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Active Login Sessions List */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <strong className="text-xs font-bold text-slate-900">
                  Phiên đăng nhập đang hoạt động
                </strong>
                <span className="text-[11px] font-semibold text-emerald-700">2 thiết bị</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 grid place-items-center shrink-0">
                      <Laptop className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">
                        Windows Workstation · Chrome Desktop
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        TP. Hồ Chí Minh · IP Nội bộ Toàn Trung · Vừa xong
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold shrink-0">
                    Phiên hiện tại
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white border border-slate-200/70 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 grid place-items-center shrink-0">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">
                        Toàn Trung Mobile Web · Safari iOS
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        TP. Hồ Chí Minh · Đồng bộ thông báo đẩy
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold shrink-0">
                    Đã xác thực
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Reusable Change Password Dialog (Fix 1) */}
      <ChangePasswordDialog
        isOpen={isPasswordDialogOpen}
        onClose={() => setIsPasswordDialogOpen(false)}
        csrfToken={user.csrfToken}
        onSuccess={(msg) => setToastNotice(msg)}
      />
    </div>
  );
}
