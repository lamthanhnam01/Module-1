import React from 'react';
import { WorkspaceShell } from '@/core/layout/WorkspaceShell';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}

