'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Crown,
  Lock,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unlock,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  DEPARTMENTS,
  DEPARTMENT_LABELS,
  ROLE_CODES,
  ROLE_LABELS,
  type AdminUserDto,
  type DepartmentCode,
  type RoleCode,
} from '@toantrung/contracts';
import { apiRequest, ApiClientError, peekApiCache } from '@/core/http/client';
import { useSession } from '@/core/session/SessionContext';

const ROLE_BADGE_META: Record<
  RoleCode,
  {
    label: string;
    shortCode: string;
    badgeClass: string;
    avatarClass: string;
    isLeadOrExec?: boolean;
  }
> = {
  ADMIN: {
    label: 'Quản trị viên Hệ thống',
    shortCode: 'ADMIN',
    badgeClass: 'bg-slate-900 text-white border-slate-900 shadow-2xs',
    avatarClass: 'bg-gradient-to-br from-slate-800 to-slate-950 text-white',
    isLeadOrExec: true,
  },
  BOD: {
    label: 'Ban Giám đốc',
    shortCode: 'BOD',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    avatarClass: 'bg-gradient-to-br from-rose-500 to-red-600 text-white',
    isLeadOrExec: true,
  },
  SALES_LEAD: {
    label: 'Trưởng phòng Kinh doanh',
    shortCode: 'Lead Sales',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    avatarClass: 'bg-gradient-to-br from-indigo-600 to-blue-700 text-white',
    isLeadOrExec: true,
  },
  MKT_LEAD: {
    label: 'Trưởng phòng Marketing',
    shortCode: 'Lead MKT',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    avatarClass: 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white',
    isLeadOrExec: true,
  },
  SALES: {
    label: 'Chuyên viên Kinh doanh',
    shortCode: 'Sales',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    avatarClass: 'bg-blue-100 text-blue-800 border border-blue-200',
  },
  MKT_STAFF: {
    label: 'Chuyên viên Marketing & SEO',
    shortCode: 'MKT',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200',
    avatarClass: 'bg-violet-100 text-violet-800 border border-violet-200',
  },
  ADS: {
    label: 'Chuyên viên Quảng cáo Ads',
    shortCode: 'Ads',
    badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    avatarClass: 'bg-cyan-100 text-cyan-800 border border-cyan-200',
  },
  DESIGNER: {
    label: 'Chuyên viên Thiết kế 3D',
    shortCode: 'Design',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    avatarClass: 'bg-amber-100 text-amber-900 border border-amber-200',
  },
};

const DEPARTMENT_BADGE_META: Record<
  DepartmentCode,
  { label: string; dotClass: string; pillClass: string }
> = {
  management: {
    label: 'Ban Giám đốc',
    dotClass: 'bg-rose-500',
    pillClass: 'bg-rose-50/70 text-rose-800 border-rose-200/80',
  },
  sales: {
    label: 'Phòng Kinh doanh',
    dotClass: 'bg-blue-600',
    pillClass: 'bg-blue-50/70 text-blue-800 border-blue-200/80',
  },
  marketing: {
    label: 'Phòng Marketing',
    dotClass: 'bg-violet-600',
    pillClass: 'bg-violet-50/70 text-violet-800 border-violet-200/80',
  },
  admin: {
    label: 'Quản trị Hệ thống',
    dotClass: 'bg-slate-700',
    pillClass: 'bg-slate-100 text-slate-800 border-slate-300/80',
  },
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'NV';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function AdminUsersPage() {
  const { user } = useSession();
  const cachedInitial = peekApiCache<{ users: AdminUserDto[] }>('/api/v1/users');
  const [users, setUsers] = useState<AdminUserDto[]>(cachedInitial?.users ?? []);
  const [loading, setLoading] = useState(!cachedInitial);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Filter & Search state
  const [selectedDept, setSelectedDept] = useState<'ALL' | DepartmentCode>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Create user modal state (only 1 trigger button in header)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleCode, setRoleCode] = useState<RoleCode>('SALES');
  const [department, setDepartment] = useState<DepartmentCode>('sales');
  const [initialPassword, setInitialPassword] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit user modal state
  const [userToEdit, setUserToEdit] = useState<AdminUserDto | null>(null);
  const [editRoleCode, setEditRoleCode] = useState<RoleCode>('SALES');
  const [editDepartment, setEditDepartment] = useState<DepartmentCode>('sales');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete confirmation modal state
  const [userToDelete, setUserToDelete] = useState<AdminUserDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogError, setDeleteDialogError] = useState<string | null>(null);

  const loadUsers = useCallback(async (force = false) => {
    setErrorMsg(null);
    try {
      const res = await apiRequest<{ users: AdminUserDto[] }>('/api/v1/users', {
        skipCache: force,
      });
      setUsers(res.users);
    } catch (err) {
      setErrorMsg(
        err instanceof ApiClientError
          ? err.message
          : 'Không thể tải danh sách tài khoản nhân sự.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.roleCode === 'ADMIN') {
      void loadUsers(false);
    } else {
      setLoading(false);
    }
  }, [user?.roleCode, loadUsers]);

  // Auto-sync default department when selecting role in Create Modal
  const handleSelectCreateRole = (nextRole: RoleCode) => {
    setRoleCode(nextRole);
    if (nextRole === 'SALES' || nextRole === 'SALES_LEAD') {
      setDepartment('sales');
    } else if (
      nextRole === 'MKT_STAFF' ||
      nextRole === 'MKT_LEAD' ||
      nextRole === 'ADS' ||
      nextRole === 'DESIGNER'
    ) {
      setDepartment('marketing');
    } else if (nextRole === 'BOD') {
      setDepartment('management');
    } else if (nextRole === 'ADMIN') {
      setDepartment('admin');
    }
  };

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((item) => {
      if (selectedDept !== 'ALL' && item.department !== selectedDept) {
        return false;
      }
      if (!q) return true;
      const roleLabel = (ROLE_LABELS[item.roleCode] || '').toLowerCase();
      const depLabel = (DEPARTMENT_LABELS[item.department] || '').toLowerCase();
      return (
        item.fullName.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        (item.phone && item.phone.toLowerCase().includes(q)) ||
        roleLabel.includes(q) ||
        depLabel.includes(q)
      );
    });
  }, [users, selectedDept, searchQuery]);

  const deptCounts = useMemo(() => {
    const counts: Record<'ALL' | DepartmentCode, number> = {
      ALL: users.length,
      management: 0,
      sales: 0,
      marketing: 0,
      admin: 0,
    };
    for (const u of users) {
      if (counts[u.department] !== undefined) {
        counts[u.department] += 1;
      }
    }
    return counts;
  }, [users]);

  if (!user || user.roleCode !== 'ADMIN') return null;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setCreating(true);
    try {
      await apiRequest('/api/v1/users', {
        method: 'POST',
        csrfToken: user.csrfToken,
        body: {
          fullName,
          email,
          phone,
          roleCode,
          department,
          initialPassword,
        },
      });
      setFullName('');
      setEmail('');
      setPhone('');
      setInitialPassword('');
      setShowCreateModal(false);
      setFeedback({
        type: 'ok',
        text: `Đã cấp tài khoản nhân sự mới cho ${fullName} (${email}) thành công.`,
      });
      await loadUsers(true);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof ApiClientError ? err.message : 'Không thể tạo tài khoản.',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (target: AdminUserDto) => {
    setFeedback(null);
    try {
      await apiRequest('/api/v1/users', {
        method: 'PATCH',
        csrfToken: user.csrfToken,
        body: {
          userId: target.id,
          isActive: !target.isActive,
        },
      });
      setFeedback({
        type: 'ok',
        text: target.isActive
          ? `Đã tạm khóa tài khoản ${target.fullName} (${target.email}).`
          : `Đã mở khóa tài khoản ${target.fullName} (${target.email}).`,
      });
      await loadUsers(true);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof ApiClientError ? err.message : 'Không thể đổi trạng thái tài khoản.',
      });
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    setDeleteDialogError(null);
    setFeedback(null);

    try {
      await apiRequest('/api/v1/users', {
        method: 'DELETE',
        csrfToken: user.csrfToken,
        body: { userId: userToDelete.id },
      });

      const deletedName = userToDelete.fullName;
      const deletedEmail = userToDelete.email;
      setUserToDelete(null);
      setFeedback({
        type: 'ok',
        text: `Đã xóa tài khoản ${deletedName} (${deletedEmail}) và thu hồi toàn bộ phiên đăng nhập liên quan.`,
      });
      await loadUsers(true);
    } catch (err) {
      setDeleteDialogError(
        err instanceof ApiClientError ? err.message : 'Không thể xóa tài khoản nhân sự lúc này.',
      );
    } finally {
      setDeleting(false);
    }
  };

  const activeCount = users.filter((u) => u.isActive).length;
  const leadCount = users.filter((u) =>
    ['ADMIN', 'BOD', 'SALES_LEAD', 'MKT_LEAD'].includes(u.roleCode),
  ).length;

  return (
    <div className="space-y-4">
      {/* Top Executive Header Card (Duy nhất 1 nút Cấp tài khoản nhân sự mở Modal) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:px-6 sm:py-5 shadow-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Quản lý Phòng ban &amp; Tài khoản
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200/80 text-[#1E3A8A] text-xs font-bold">
                <Users className="w-3.5 h-3.5" />
                <span>{users.length} nhân sự</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-bold">
                <UserCheck className="w-3.5 h-3.5" />
                <span>{activeCount} đang hoạt động</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200/80 text-amber-800 text-xs font-bold">
                <Crown className="w-3.5 h-3.5 text-amber-600" />
                <span>{leadCount} Quản lý / Trưởng nhóm</span>
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Quản trị danh sách nhân sự theo 4 khối phòng ban và phân quyền chuẩn 8 vai trò BA.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="h-10 px-4 rounded-xl bg-[#1E3A8A] hover:bg-[#2563EB] text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all shrink-0 self-start lg:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            <span>Cấp tài khoản nhân sự</span>
          </button>
        </div>

        {/* Department Filter Pills & Quick Search Toolbar */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { code: 'ALL', label: 'Tất cả phòng ban' },
                { code: 'sales', label: 'Phòng Kinh doanh' },
                { code: 'marketing', label: 'Phòng Marketing' },
                { code: 'management', label: 'Ban Giám đốc' },
                { code: 'admin', label: 'Quản trị Hệ thống' },
              ] as const
            ).map((tab) => {
              const isSelected = selectedDept === tab.code;
              const count = deptCounts[tab.code] ?? 0;
              return (
                <button
                  key={tab.code}
                  type="button"
                  onClick={() => setSelectedDept(tab.code)}
                  className={`h-8 px-3 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100/80 hover:bg-slate-200/70 text-slate-600'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-white text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên nhân sự, email, SĐT, vai trò..."
              className="w-full h-8 pl-8 pr-7 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          role="status"
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-[11px] font-bold underline opacity-75 hover:opacity-100"
          >
            Đóng
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-between">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => void loadUsers(true)}
            className="px-2.5 py-1 rounded-lg bg-white border border-red-200 text-red-700 font-bold"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Enterprise Directory Table */}
      <section className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 text-slate-500 border-b border-slate-200/80 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-5 font-bold">Nhân sự</th>
                <th className="py-3 px-4 font-bold">Thông tin liên hệ</th>
                <th className="py-3 px-4 font-bold">Phòng ban</th>
                <th className="py-3 px-4 font-bold">Vai trò &amp; Phân quyền</th>
                <th className="py-3 px-4 font-bold">Trạng thái</th>
                <th className="py-3 px-5 font-bold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Đang tải danh sách nhân sự...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Không tìm thấy nhân sự nào khớp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((item) => {
                  const roleMeta = ROLE_BADGE_META[item.roleCode] || {
                    label: ROLE_LABELS[item.roleCode] || item.roleCode,
                    shortCode: item.roleCode,
                    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                    avatarClass: 'bg-slate-200 text-slate-700',
                  };
                  const deptMeta = DEPARTMENT_BADGE_META[item.department] || {
                    label: DEPARTMENT_LABELS[item.department] || item.department,
                    dotClass: 'bg-slate-400',
                    pillClass: 'bg-slate-50 text-slate-700 border-slate-200',
                  };
                  const isSelf = item.id === user.id;

                  return (
                    <tr
                      key={item.id}
                      className={`group transition-colors ${
                        !item.isActive
                          ? 'bg-slate-50/60 opacity-75'
                          : 'hover:bg-blue-50/25'
                      }`}
                    >
                      {/* Col 1: Avatar + Full Name */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <div
                              className={`w-9 h-9 rounded-xl font-display font-extrabold text-xs grid place-items-center ${roleMeta.avatarClass}`}
                            >
                              {getInitials(item.fullName)}
                            </div>
                            <span
                              title={item.isActive ? 'Đang hoạt động' : 'Đang tạm khóa'}
                              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                                item.isActive ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <strong className="font-bold text-slate-900 text-[13px] truncate">
                                {item.fullName}
                              </strong>
                              {isSelf && (
                                <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-[#1E3A8A] text-[10px] font-bold">
                                  Bạn
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium">
                              Mã NV: #{String(item.id).padStart(3, '0')}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Col 2: Email & Phone */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{item.email}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-mono">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{item.phone || 'Chưa cập nhật'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Col 3: Department */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${deptMeta.pillClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${deptMeta.dotClass}`} />
                          <span>{deptMeta.label}</span>
                        </span>
                      </td>

                      {/* Col 4: Role Badge */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${roleMeta.badgeClass}`}
                          >
                            {roleMeta.isLeadOrExec ? (
                              <Crown className="w-3 h-3 opacity-90 shrink-0" />
                            ) : (
                              <ShieldCheck className="w-3 h-3 opacity-75 shrink-0" />
                            )}
                            <span>{roleMeta.label}</span>
                          </span>
                        </div>
                      </td>

                      {/* Col 5: Status */}
                      <td className="py-3.5 px-4">
                        {item.isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-[11px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Hoạt động
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
                            <Lock className="w-3 h-3" />
                            Tạm khóa
                          </span>
                        )}
                      </td>

                      {/* Col 6: Direct Inline Actions */}
                      <td className="py-3.5 px-5 text-right">
                        {isSelf ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-[11px] font-semibold">
                            Đang đăng nhập
                          </span>
                        ) : (
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setUserToEdit(item);
                                setEditRoleCode(item.roleCode);
                                setEditDepartment(item.department);
                              }}
                              title="Đổi vai trò & phòng ban"
                              className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-semibold inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                            >
                              <Pencil className="w-3.5 h-3.5 text-slate-500" />
                              <span>Sửa</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleToggleActive(item)}
                              title={
                                item.isActive
                                  ? 'Tạm khóa tài khoản này'
                                  : 'Mở khóa tài khoản này'
                              }
                              className={`h-8 px-2.5 rounded-lg border font-semibold inline-flex items-center gap-1 transition-colors shadow-2xs ${
                                item.isActive
                                  ? 'border-amber-200 bg-amber-50/60 hover:bg-amber-100/80 text-amber-800'
                                  : 'border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800'
                              }`}
                            >
                              {item.isActive ? (
                                <>
                                  <Lock className="w-3.5 h-3.5" />
                                  <span className="hidden xl:inline">Khóa</span>
                                </>
                              ) : (
                                <>
                                  <Unlock className="w-3.5 h-3.5" />
                                  <span className="hidden xl:inline">Mở</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setDeleteDialogError(null);
                                setUserToDelete(item);
                              }}
                              title="Xóa tài khoản"
                              className="w-8 h-8 rounded-lg border border-red-200/80 bg-red-50/40 hover:bg-red-100/80 text-red-600 grid place-items-center transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal Cấp tài khoản nhân sự (Chỉ bật lên khi bấm nút Cấp tài khoản) */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-elevated animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pb-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1E3A8A] grid place-items-center shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-slate-900">
                    Cấp tài khoản nhân sự mới
                  </h2>
                  <p className="text-xs text-slate-500">
                    Phân quyền chuẩn 8 vai trò BA · Không mở đăng ký tự do
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateUser(e)} className="mt-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Họ và tên nhân sự
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn An"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50/40 text-xs text-slate-900 focus:bg-white focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email công việc
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ten.nv@toantrung.vn"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50/40 text-xs text-slate-900 focus:bg-white focus:border-[#2563EB] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0903xxxxxx"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50/40 text-xs text-slate-900 focus:bg-white focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Vai trò BA
                  </label>
                  <select
                    value={roleCode}
                    onChange={(e) => handleSelectCreateRole(e.target.value as RoleCode)}
                    className="w-full h-10 px-2.5 rounded-xl border border-slate-200 bg-slate-50/40 text-xs font-semibold text-slate-900 focus:bg-white focus:border-[#2563EB] focus:outline-none"
                  >
                    {ROLE_CODES.map((code) => (
                      <option key={code} value={code}>
                        {ROLE_LABELS[code]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phòng ban trực thuộc
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value as DepartmentCode)}
                    className="w-full h-10 px-2.5 rounded-xl border border-slate-200 bg-slate-50/40 text-xs font-semibold text-slate-900 focus:bg-white focus:border-[#2563EB] focus:outline-none"
                  >
                    {DEPARTMENTS.map((dep) => (
                      <option key={dep} value={dep}>
                        {DEPARTMENT_LABELS[dep]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mật khẩu khởi tạo (tối thiểu 8 ký tự)
                </label>
                <input
                  type="password"
                  required
                  value={initialPassword}
                  onChange={(e) => setInitialPassword(e.target.value)}
                  placeholder="Nhập mật khẩu khởi tạo ban đầu"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50/40 text-xs text-slate-900 focus:bg-white focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="h-10 px-5 rounded-xl bg-[#1E3A8A] hover:bg-[#2563EB] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors disabled:opacity-60"
                >
                  <Plus className="w-4 h-4" />
                  <span>{creating ? 'Đang khởi tạo...' : 'Xác nhận cấp tài khoản'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Sửa Vai trò & Phòng ban */}
      {userToEdit && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
          onClick={() => setUserToEdit(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-elevated space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1E3A8A] grid place-items-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-slate-900">
                    Cập nhật Phòng ban &amp; Vai trò
                  </h2>
                  <p className="text-xs text-slate-500">
                    {userToEdit.fullName} · {userToEdit.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUserToEdit(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Vai trò phân quyền (8 vai trò BA)
                </label>
                <select
                  value={editRoleCode}
                  onChange={(e) => setEditRoleCode(e.target.value as RoleCode)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 focus:border-[#2563EB] focus:outline-none"
                >
                  {ROLE_CODES.map((code) => (
                    <option key={code} value={code}>
                      {ROLE_LABELS[code]} ({code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Phòng ban trực thuộc
                </label>
                <select
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value as DepartmentCode)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 focus:border-[#2563EB] focus:outline-none"
                >
                  {DEPARTMENTS.map((dep) => (
                    <option key={dep} value={dep}>
                      {DEPARTMENT_LABELS[dep]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5 text-xs">
              <button
                type="button"
                disabled={savingEdit}
                onClick={() => setUserToEdit(null)}
                className="h-9 px-4 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={savingEdit}
                onClick={async () => {
                  setSavingEdit(true);
                  try {
                    await apiRequest('/api/v1/users', {
                      method: 'PATCH',
                      csrfToken: user.csrfToken,
                      body: {
                        userId: userToEdit.id,
                        roleCode: editRoleCode,
                        department: editDepartment,
                      },
                    });
                    setFeedback({
                      type: 'ok',
                      text: `Đã cập nhật vai trò & phòng ban cho ${userToEdit.fullName}.`,
                    });
                    setUserToEdit(null);
                    await loadUsers(true);
                  } catch (err) {
                    setFeedback({
                      type: 'err',
                      text:
                        err instanceof ApiClientError
                          ? err.message
                          : 'Lỗi cập nhật thông tin nhân sự.',
                    });
                  } finally {
                    setSavingEdit(false);
                  }
                }}
                className="h-9 px-4 rounded-xl bg-[#1E3A8A] hover:bg-[#2563EB] text-white font-bold shadow-xs"
              >
                {savingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Account Deletion */}
      {userToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
          onClick={() => !deleting && setUserToDelete(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-elevated space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-red-50 border border-red-200 text-red-600 grid place-items-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h2
                    id="delete-account-dialog-title"
                    className="font-display text-base font-bold text-slate-900"
                  >
                    Xác nhận xóa tài khoản nhân sự
                  </h2>
                  <p className="text-xs text-slate-500">
                    Thu hồi vĩnh viễn quyền truy cập hệ thống
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setUserToDelete(null)}
                aria-label="Đóng hộp thoại"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1">
              <p className="text-slate-500">Tài khoản được chọn:</p>
              <strong className="font-bold text-slate-900 text-sm block">
                {userToDelete.fullName}
              </strong>
              <p className="text-slate-600">{userToDelete.email}</p>
              <p className="text-slate-500">
                Vai trò: <strong>{ROLE_LABELS[userToDelete.roleCode]}</strong> ·{' '}
                {DEPARTMENT_LABELS[userToDelete.department] || userToDelete.department}
              </p>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Sau khi xóa, tài khoản này sẽ bị gỡ khỏi danh sách nhân sự hoạt động và mọi phiên
              đăng nhập hiện tại sẽ bị hủy ngay lập tức. Toàn bộ hồ sơ Lead, lịch sử công việc và
              nhật ký kiểm toán liên quan vẫn được bảo toàn nguyên vẹn.
            </p>

            {deleteDialogError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold"
              >
                {deleteDialogError}
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setUserToDelete(null)}
                className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors disabled:opacity-50"
              >
                Hủy
              </button>

              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleConfirmDeleteUser()}
                className="h-10 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-60"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleting ? 'Đang xóa...' : 'Xóa tài khoản'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
