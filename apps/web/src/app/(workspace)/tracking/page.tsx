import React from 'react';
import { BlankModuleState } from '@/core/ui/BlankModuleState';

export default function TrackingModulePage() {
  return (
    <BlankModuleState
      moduleCode="M02"
      title="Tracking & đồng bộ"
      description="Ghi nhận nguồn UTM/Webhook và đồng bộ dữ liệu Google Ads, Google Analytics 4, Search Console."
      teamLabel="Nhóm 2 — Cát Cần Sỹ"
      branchName="feature/tracking-integration"
    />
  );
}

