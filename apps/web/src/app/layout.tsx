import React from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { SessionProvider } from '@/core/session/SessionContext';

export const metadata: Metadata = {
  title: 'Toàn Trung V2 — Hệ thống Quản lý Marketing & Kinh doanh Nội bộ',
  description: 'Nền tảng quản trị nội bộ dành cho nhân sự Công ty Toàn Trung',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-canvas text-ink antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}

