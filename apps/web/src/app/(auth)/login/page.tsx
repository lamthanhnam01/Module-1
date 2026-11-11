'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, HelpCircle, Lock, User } from 'lucide-react';
import { apiRequest, ApiClientError } from '@/core/http/client';
import { useSession } from '@/core/session/SessionContext';
import type { SessionUserDto } from '@toantrung/contracts';

const REMEMBER_USER_KEY = 'tt_v2_remembered_identifier';
const DEFAULT_HERO_IMAGE = '/brand/login-hero-led-building.jpg';

export default function LoginPage() {
  const router = useRouter();
  const { user, branding, refreshSession, refreshUnreadCount } = useSession();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberUsername, setRememberUsername] = useState(false);
  const [showForgotHelp, setShowForgotHelp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(REMEMBER_USER_KEY);
      if (saved) {
        setIdentifier(saved);
        setRememberUsername(true);
      }
    } catch {
      // Ignore storage access errors
    }
  }, []);

  useEffect(() => {
    if (user) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      await apiRequest<{ user: SessionUserDto }>('/api/v1/auth/login', {
        method: 'POST',
        body: {
          identifier: identifier.trim(),
          password,
          rememberUsername,
        },
      });

      try {
        if (rememberUsername && identifier.trim()) {
          window.localStorage.setItem(REMEMBER_USER_KEY, identifier.trim());
        } else {
          window.localStorage.removeItem(REMEMBER_USER_KEY);
        }
      } catch {
        // Ignore storage write issues
      }

      await refreshSession();
      await refreshUnreadCount();
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(
          'Không thể kết nối máy chủ xác thực. Vui lòng kiểm tra trạng thái dịch vụ.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isCustomHero =
    Boolean(branding.loginHero.url) &&
    !branding.loginHero.isDefault &&
    branding.loginHero.url !== '/brand/showroom-toan-trung.webp';

  const heroImageUrl =
    isCustomHero && branding.loginHero.url ? branding.loginHero.url : DEFAULT_HERO_IMAGE;

  const crop = branding.loginHero.crop || { zoom: 1, offsetX: 0, offsetY: 0, frameScale: 1 };
  const effectiveZoom = Math.max(1, crop.zoom / Math.max(0.6, crop.frameScale || 1));
  const posX = Math.max(0, Math.min(100, 50 - crop.offsetX));
  const posY = Math.max(0, Math.min(100, 50 - crop.offsetY));

  return (
    <div className="relative min-h-screen w-full flex flex-col lg:flex-row bg-white overflow-hidden select-none">
      {/* Subtle Decorative Corner Curves on the Right White Canvas */}
      <div
        aria-hidden="true"
        className="hidden lg:block pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full border border-blue-100/80 bg-gradient-to-br from-blue-50/40 to-transparent z-0"
      />
      <div
        aria-hidden="true"
        className="hidden lg:block pointer-events-none absolute -bottom-28 -right-16 w-96 h-96 rounded-full bg-gradient-to-tl from-blue-50/70 via-slate-50/40 to-transparent z-0"
      />

      {/* LEFT SECTION: Architectural LED Building Hero with Slanted Diagonal Split */}
      <section className="relative w-full lg:w-[62%] h-72 sm:h-96 lg:h-screen shrink-0 overflow-hidden bg-white z-10">
        <div
          className="relative w-full h-full overflow-hidden"
          style={
            isCustomHero
              ? {
                  clipPath: 'polygon(0 0, 98% 0, 77.2% 100%, 0 100%)',
                }
              : undefined
          }
        >
          <img
            src={heroImageUrl}
            alt={branding.loginHero.altText || 'Toàn Trung LED Display Solutions'}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = DEFAULT_HERO_IMAGE;
            }}
            style={
              isCustomHero
                ? {
                    objectPosition: `${posX}% ${posY}%`,
                    transform: `scale(${effectiveZoom.toFixed(3)})`,
                    transformOrigin: `${posX}% ${posY}%`,
                  }
                : {
                    objectPosition: 'left center',
                  }
            }
            className="w-full h-full object-cover transition-transform duration-300"
          />

          {/* Overlay Brand Identity Badge only when Admin uploads a custom photo without embedded logo */}
          {isCustomHero && (
            <>
              <div className="absolute inset-0 bg-gradient-to-tr from-slate-900/20 via-transparent to-blue-900/15 pointer-events-none" />
              <div className="absolute top-8 left-8 sm:top-10 sm:left-12 z-20 flex items-center gap-3.5">
                <div className="flex items-center gap-3 bg-white/90 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-md">
                  <img
                    src={branding.logo.url || '/brand/logo-toan-trung.png'}
                    alt={branding.logo.altText || 'Logo Toàn Trung'}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/brand/logo-toan-trung.png';
                    }}
                    className="h-8 w-auto object-contain"
                  />
                  <div className="pl-3 border-l border-slate-200">
                    <strong className="font-display text-sm font-extrabold tracking-wide text-[#0B3B8C] block uppercase leading-none">
                      TOÀN TRUNG
                    </strong>
                    <span className="text-[9px] font-semibold tracking-[0.2em] text-slate-600 block uppercase mt-1">
                      LED DISPLAY SOLUTIONS
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* RIGHT SECTION: Clean White Authentication Form */}
      <main className="relative z-20 w-full lg:w-[44%] lg:-ml-[6%] flex-1 lg:h-screen flex flex-col justify-center items-center px-6 sm:px-12 lg:pl-6 lg:pr-16 py-10 overflow-y-auto select-text">
        <div className="w-full max-w-[380px] mx-auto">
          {/* Heading & Subtitle */}
          <div className="mb-8">
            <h1 className="font-display text-[30px] sm:text-[34px] font-bold text-[#0F172A] tracking-tight leading-tight">
              Đăng nhập
            </h1>
            <p className="text-[14px] text-slate-500 mt-1.5 font-normal">
              Chào mừng bạn quay trở lại hệ thống
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 px-4 py-3 rounded-[10px] bg-red-50 border border-red-200 text-red-700 text-xs font-medium leading-relaxed"
            >
              {errorMessage}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5" noValidate>
            <div>
              <label
                htmlFor="login-identifier"
                className="block text-[13px] font-semibold text-slate-700 mb-2"
              >
                Email hoặc tên đăng nhập
              </label>
              <div className="flex items-center gap-3 h-12 px-4 rounded-[10px] border border-slate-200 bg-white focus-within:border-[#0B3B8C] focus-within:ring-4 focus-within:ring-[#0B3B8C]/10 transition-all">
                <User className="w-[18px] h-[18px] text-slate-400 shrink-0 stroke-[1.75]" />
                <input
                  id="login-identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Nhập tài khoản của bạn"
                  className="w-full h-full bg-transparent text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-[13px] font-semibold text-slate-700 mb-2"
              >
                Mật khẩu
              </label>
              <div className="flex items-center gap-3 h-12 px-4 rounded-[10px] border border-slate-200 bg-white focus-within:border-[#0B3B8C] focus-within:ring-4 focus-within:ring-[#0B3B8C]/10 transition-all">
                <Lock className="w-[18px] h-[18px] text-slate-400 shrink-0 stroke-[1.75]" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  className="w-full h-full bg-transparent text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                >
                  {showPassword ? (
                    <Eye className="w-[18px] h-[18px] stroke-[1.75]" />
                  ) : (
                    <EyeOff className="w-[18px] h-[18px] stroke-[1.75]" />
                  )}
                </button>
              </div>
            </div>

            {/* Checkbox "Ghi nhớ đăng nhập" & Link "Quên mật khẩu?" */}
            <div className="flex items-center justify-between pt-0.5 text-[13px]">
              <label className="inline-flex items-center gap-2.5 text-slate-600 cursor-pointer select-none font-medium">
                <input
                  type="checkbox"
                  checked={rememberUsername}
                  onChange={(e) => setRememberUsername(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#0B3B8C] focus:ring-[#0B3B8C]"
                />
                <span>Ghi nhớ đăng nhập</span>
              </label>

              <button
                type="button"
                onClick={() => setShowForgotHelp((v) => !v)}
                className="font-semibold text-[#1E40AF] hover:underline"
              >
                Quên mật khẩu?
              </button>
            </div>

            {showForgotHelp && (
              <div className="p-3.5 rounded-[10px] bg-blue-50/80 border border-blue-200 text-xs text-slate-700 leading-relaxed flex items-start gap-2.5">
                <HelpCircle className="w-4 h-4 text-[#0B3B8C] shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold text-slate-900 block mb-0.5">
                    Cấp lại mật khẩu
                  </strong>
                  Vui lòng liên hệ Quản trị viên hệ thống để được xác minh và đặt lại mật khẩu.
                </div>
              </div>
            )}

            {/* Primary Button: "Đăng nhập →" */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-[10px] bg-[#0B3B8C] hover:bg-[#082F70] text-white font-semibold text-[15px] inline-flex items-center justify-center gap-2.5 shadow-md shadow-[#0B3B8C]/20 transition-all disabled:opacity-60"
            >
              <span>{submitting ? 'Đang xác thực...' : 'Đăng nhập'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Divider "Hoặc" */}
          <div className="relative my-7 flex items-center justify-center">
            <div className="w-full border-t border-slate-100" />
            <span className="relative bg-white px-4 text-[12px] text-slate-400 font-normal">
              Hoặc
            </span>
            <div className="w-full border-t border-slate-100" />
          </div>

          {/* Footer */}
          <footer className="text-center text-[12px] text-slate-400 font-normal">
            © 2026 Toàn Trung. All rights reserved.
          </footer>
        </div>
      </main>
    </div>
  );
}
