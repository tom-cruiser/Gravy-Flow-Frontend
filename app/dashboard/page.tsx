'use client';

import { GridCanvas } from '@/components/canvas/GridCanvas';
import { NewServiceButton } from '@/components/canvas/NewServiceButton';
import { RightDrawer } from '@/components/drawer/RightDrawer';
import { QuotaWidget } from '@/components/drawer/QuotaWidget';
import { AccountMenu } from '@/components/auth/AccountMenu';
import { useCanvasStore } from '@/store/canvasStore';
import { useEffect } from 'react';
import { readGitHubSetupResult } from '@/lib/githubApi';
import { toast } from '@/store/toastStore';

export default function DashboardPage() {
  const selectedNodeId = useCanvasStore((state) => state.selectedNodeId);
  const drawerOpen = Boolean(selectedNodeId);

  // Outcome of the GitHub App install round trip (?github=… from the setup callback).
  useEffect(() => {
    const result = readGitHubSetupResult();
    if (result) toast.push({ variant: result.variant, message: result.message, title: 'GitHub' });
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-brand-950">
      <GridCanvas />
      {/* Quota widget fades out when drawer opens, fades in when closed */}
      <div
        className={`pointer-events-none fixed right-6 top-6 z-20 transition-all duration-300 ${
          drawerOpen ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0 pointer-events-auto'
        }`}
      >
        <QuotaWidget />
      </div>
      <NewServiceButton />
      <AccountMenu />
      <RightDrawer open={drawerOpen} />
    </main>
  );
}
