'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { PublicBrandingDto, SessionUserDto } from '@toantrung/contracts';
import { apiRequest } from '../http/client';

const DEFAULT_BRANDING: PublicBrandingDto = {
  organizationName: 'Toàn Trung',
  workspaceName: 'Toàn Trung',
  loginHeadline: 'Đăng nhập',
  loginSubheadline: 'Chào mừng bạn quay trở lại hệ thống nội bộ Toàn Trung',
  footerText: '© 2026 Toàn Trung · Hệ thống quản lý nội bộ dành cho nhân sự công ty',
  logo: {
    slot: 'logo',
    url: '/brand/logo-toan-trung.png',
    isDefault: true,
    altText: 'Logo Công ty Toàn Trung',
    coverPosition: 'center',
    crop: { zoom: 1, offsetX: 0, offsetY: 0, frameScale: 1 },
    mimeType: 'image/png',
    fileSizeBytes: null,
    width: null,
    height: null,
    updatedAt: null,
    updatedByName: null,
    recommendedSpec: 'PNG/WebP nền trong suốt · Tỷ lệ ~3.5:1 (khuyến nghị 420×120px, tối đa 2 MB)',
  },
  loginHero: {
    slot: 'login_hero',
    url: '/brand/login-hero-led-building.jpg',
    isDefault: true,
    altText: 'Không gian trưng bày giải pháp màn hình LED Toàn Trung',
    coverPosition: 'center',
    crop: { zoom: 1, offsetX: 0, offsetY: 0, frameScale: 1 },
    mimeType: 'image/webp',
    fileSizeBytes: null,
    width: null,
    height: null,
    updatedAt: null,
    updatedByName: null,
    recommendedSpec: 'WebP/JPG/PNG thực tế công ty · Tỷ lệ 16:9 hoặc 16:10 (khuyến nghị 1200×750px, tối đa 5 MB)',
  },
  dashboardBanner: {
    headline: 'Quản lý tập trung. Phối hợp hiệu quả.',
    description:
      'Kết nối xuyên suốt hoạt động Kinh doanh, Marketing, Quảng cáo và Thiết kế trên một nền tảng thống nhất theo đúng ma trận phân quyền 8 vai trò BA.',
    showButton: true,
    buttonLabel: 'Khám phá 5 phân hệ',
    buttonHref: '/leads',
    showImage: true,
    imageUrl: '/brand/showroom-toan-trung.webp',
    imageAlt: 'Phòng trưng bày giải pháp màn hình LED Toàn Trung',
    isDefaultImage: true,
    updatedAt: null,
    updatedByName: null,
  },
};

interface SessionContextValue {
  user: SessionUserDto | null;
  loading: boolean;
  branding: PublicBrandingDto;
  unreadCount: number;
  refreshSession: () => Promise<SessionUserDto | null>;
  refreshBranding: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  setBrandingState: (next: PublicBrandingDto) => void;
  setUnreadCountState: (count: number) => void;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  user: null,
  loading: true,
  branding: DEFAULT_BRANDING,
  unreadCount: 0,
  refreshSession: async () => null,
  refreshBranding: async () => {},
  refreshUnreadCount: async () => {},
  setBrandingState: () => {},
  setUnreadCountState: () => {},
  logout: async () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUserDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState<PublicBrandingDto>(DEFAULT_BRANDING);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const router = useRouter();
  const pathname = usePathname();

  const refreshBranding = useCallback(async () => {
    try {
      const res = await apiRequest<{ branding: PublicBrandingDto }>('/api/v1/settings/branding');
      if (res.branding) {
        setBranding(res.branding);
      }
    } catch {
      // Fallback to verified official assets in public/brand
    }
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await apiRequest<{ unreadCount: number }>('/api/v1/notifications');
      setUnreadCount(res.unreadCount ?? 0);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const res = await apiRequest<{ user: SessionUserDto }>('/api/v1/auth/me');
      setUser(res.user);
      return res.user;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshBranding();
    void refreshSession().then((u) => {
      if (u) {
        void refreshUnreadCount();
      }
    });
  }, [refreshBranding, refreshSession, refreshUnreadCount]);

  useEffect(() => {
    if (!loading && !user && pathname && pathname !== '/login') {
      router.replace('/login');
    }
  }, [loading, user, pathname, router]);

  const logout = useCallback(async () => {
    try {
      await apiRequest('/api/v1/auth/logout', {
        method: 'POST',
        csrfToken: user?.csrfToken,
      });
    } catch {
      // Clear local session state regardless
    }
    setUser(null);
    setUnreadCount(0);
    router.replace('/login');
  }, [router, user?.csrfToken]);

  return (
    <SessionContext.Provider
      value={{
        user,
        loading,
        branding,
        unreadCount,
        refreshSession,
        refreshBranding,
        refreshUnreadCount,
        setBrandingState: setBranding,
        setUnreadCountState: setUnreadCount,
        logout,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
