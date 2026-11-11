import React from 'react';
import { BlankModuleState } from '@/core/ui/BlankModuleState';

export default function LeadsModulePage() {
  return (
    <BlankModuleState
      moduleCode="M01"
      title="Quản lý Lead"
      description="Tiếp nhận và theo dõi khách hàng tiềm năng, quản lý phân công và tiến độ Pipeline Kinh doanh."
      teamLabel="Nhóm 1 — Lâm Thành Nam"
      branchName="feature/lead-management"
    />
  );
}

