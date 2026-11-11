import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, Layers } from 'lucide-react';

export interface BlankModuleStateProps {
  moduleCode: 'M01' | 'M02' | 'M03' | 'M04' | 'M05';
  title: string;
  description: string;
  teamLabel: string;
  branchName: string;
}

export function BlankModuleState({
  title,
  description,
  teamLabel,
  branchName,
}: BlankModuleStateProps) {
  return (
    <div className="space-y-6">
      {/* Page Header — No decorative "Không gian làm việc" eyebrow */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink tracking-tight">
            {title}
          </h1>
          <p className="text-[13px] text-ink-muted mt-1.5 max-w-2xl leading-relaxed">
            {description}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 self-start sm:self-auto px-3.5 py-2 rounded-xl bg-white border border-slate-200/90 text-xs font-semibold text-slate-600 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span>Module đang được phát triển</span>
        </div>
      </div>

      {/* Empty Stage Card matching 01-module-trong.png */}
      <section className="bg-white border border-slate-200/80 rounded-2xl min-h-[500px] px-6 py-14 flex flex-col items-center justify-center text-center shadow-card">
        <div className="w-20 h-20 rounded-3xl bg-brand-soft border border-brand-border text-brand grid place-items-center mb-6 shadow-sm">
          <Layers className="w-8 h-8" />
        </div>

        <h2 className="font-display text-lg sm:text-xl font-bold text-ink">
          Module đang được phát triển
        </h2>
        <p className="text-[13px] text-ink-muted max-w-md mt-2.5 leading-relaxed">
          Trang này đã có đường dẫn và vị trí trong hệ thống; nhóm phụ trách sẽ bàn giao giao
          diện, API, hợp đồng DTO và cấu trúc dữ liệu riêng qua Pull Request mà không cần sửa
          khung điều hướng chung.
        </p>

        <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-full bg-slate-100/90 text-xs font-semibold text-slate-600">
          <span>{teamLabel}</span>
          <span className="text-slate-300">•</span>
          <code className="font-mono text-[11px] text-brand">{branchName}</code>
          <span className="text-slate-300">•</span>
          <span>Chưa có dữ liệu nghiệp vụ</span>
        </div>

        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:underline"
        >
          <span>Trở về tổng quan</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </section>
    </div>
  );
}
