'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldAlert,
  X,
} from 'lucide-react';
import { apiRequest, ApiClientError } from '@/core/http/client';

export interface ChangePasswordDialogProps {
  isOpen: boolean;
  onClose: () => void;
  csrfToken?: string;
  onSuccess?: (message: string) => void;
}

function evaluatePasswordStrength(pw: string): {
  score: number;
  label: string;
  colorClass: string;
  textClass: string;
} {
  if (!pw) {
    return {
      score: 0,
      label: 'Chưa nhập',
      colorClass: 'bg-slate-200',
      textClass: 'text-slate-400',
    };
  }
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score += 1;

  if (score <= 1) {
    return {
      score: 1,
      label: 'Yếu (Cần tối thiểu 8 ký tự)',
      colorClass: 'bg-red-500',
      textClass: 'text-red-600',
    };
  }
  if (score === 2) {
    return {
      score: 2,
      label: 'Trung bình',
      colorClass: 'bg-amber-500',
      textClass: 'text-amber-600',
    };
  }
  if (score === 3) {
    return {
      score: 3,
      label: 'Khá mạnh',
      colorClass: 'bg-blue-600',
      textClass: 'text-blue-600',
    };
  }
  return {
    score: 4,
    label: 'Rất mạnh',
    colorClass: 'bg-emerald-600',
    textClass: 'text-emerald-600',
  };
}

export function ChangePasswordDialog({
  isOpen,
  onClose,
  csrfToken,
  onSuccess,
}: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setErrorMsg(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  const strength = useMemo(() => evaluatePasswordStrength(newPassword), [newPassword]);
  const isConfirmTouched = confirmPassword.length > 0;
  const isConfirmMatch = isConfirmTouched && newPassword === confirmPassword;

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!currentPassword) {
      setErrorMsg('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg('Mật khẩu mới phải có tối thiểu 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không trùng khớp với mật khẩu mới.');
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest('/api/v1/profile', {
        method: 'POST',
        csrfToken,
        body: {
          currentPassword,
          newPassword,
          confirmPassword,
        },
      });
      const successText =
        'Đã cập nhật mật khẩu thành công. Toàn bộ các phiên đăng nhập cũ trên thiết bị khác đã được thu hồi.';
      onSuccess?.(successText);
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof ApiClientError
          ? err.message
          : 'Không thể cập nhật mật khẩu lúc này. Vui lòng kiểm tra lại.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-[2px] animate-in fade-in duration-150"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 grid place-items-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="change-password-dialog-title"
                className="font-display text-base font-bold text-slate-900"
              >
                Đổi mật khẩu đăng nhập
              </h2>
              <p className="text-xs text-slate-500">
                Bảo vệ tài khoản nội bộ Toàn Trung CRM
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="Đóng hộp thoại đổi mật khẩu"
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 grid place-items-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-4">
          {/* Security Notice Alert */}
          <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200/90 flex items-start gap-2.5 text-xs text-amber-900 leading-relaxed">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Khi đổi mật khẩu mới, toàn bộ các phiên đăng nhập cũ trên thiết bị khác sẽ tự động
              thu hồi để bảo mật.
            </span>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Mật khẩu hiện tại */}
          <div>
            <label
              htmlFor="dialog-current-password"
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              Mật khẩu hiện tại <span className="text-red-500">*</span>
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                id="dialog-current-password"
                type={showCurrent ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Nhập mật khẩu đang sử dụng"
                className="w-full h-10 pl-10 pr-10 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                aria-label={showCurrent ? 'Ẩn mật khẩu hiện tại' : 'Hiện mật khẩu hiện tại'}
                className="absolute right-3 p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 2. Mật khẩu mới + Strength Meter */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="dialog-new-password"
                className="block text-xs font-bold text-slate-700"
              >
                Mật khẩu mới <span className="text-red-500">*</span>
              </label>
              <span className={`text-[11px] font-bold ${strength.textClass}`}>
                Độ mạnh: {strength.label}
              </span>
            </div>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                id="dialog-new-password"
                type={showNew ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 8 ký tự (chữ hoa, chữ thường, số)"
                className="w-full h-10 pl-10 pr-10 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                aria-label={showNew ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'}
                className="absolute right-3 p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* 4-segment Password Strength Bar */}
            <div className="grid grid-cols-4 gap-1.5 mt-2">
              {[1, 2, 3, 4].map((level) => (
                <div
                  key={level}
                  className={`h-1.5 rounded-full transition-colors ${
                    strength.score >= level ? strength.colorClass : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* 3. Xác nhận mật khẩu mới + Instant Matching Validation */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="dialog-confirm-password"
                className="block text-xs font-bold text-slate-700"
              >
                Xác nhận mật khẩu mới <span className="text-red-500">*</span>
              </label>
              {isConfirmTouched && (
                <span
                  className={`text-[11px] font-bold inline-flex items-center gap-1 ${
                    isConfirmMatch ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {isConfirmMatch ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Trùng khớp</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Chưa khớp</span>
                    </>
                  )}
                </span>
              )}
            </div>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                id="dialog-confirm-password"
                type={showConfirm ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới để xác nhận"
                className={`w-full h-10 pl-10 pr-10 rounded-xl border bg-white text-xs text-slate-900 focus:outline-none ${
                  !isConfirmTouched
                    ? 'border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15'
                    : isConfirmMatch
                      ? 'border-emerald-400 focus:border-emerald-600'
                      : 'border-red-300 focus:border-red-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}
                className="absolute right-3 p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-colors disabled:opacity-60"
            >
              <KeyRound className="w-4 h-4" />
              <span>{submitting ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

