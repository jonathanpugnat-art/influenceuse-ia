import Link from "next/link";
import type { ReactNode } from "react";

import { AccountButton } from "@/components/account-button";
import { AppTabs } from "@/components/app-tabs";
import { CreditBalance } from "@/components/credit-balance";
import { Wordmark } from "@/components/wordmark";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col md:grid md:grid-cols-[14rem_minmax(0,1fr)]">
      <aside className="flex flex-col gap-4 border-b border-line bg-panel px-3 py-4 md:sticky md:top-0 md:h-[100dvh] md:gap-0 md:border-r md:border-b-0 md:px-3 md:py-5">
        <div className="flex items-center justify-between md:block md:px-2 md:pb-4 md:border-b md:border-line">
          <Link href="/" className="ring-focus inline-flex">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-2 md:hidden">
            <CreditBalance />
            <AccountButton />
          </div>
        </div>
        <div className="md:mt-5">
          <p className="telemetry mb-2 hidden px-2 text-[0.625rem] text-dim md:block">Nav</p>
          <AppTabs />
        </div>
        <div className="mt-auto hidden flex-col gap-3 border-t border-line px-2 pt-4 md:flex">
          <CreditBalance />
          <div className="flex items-center gap-3">
            <AccountButton />
            <span className="telemetry text-[0.625rem] text-mute">Compte</span>
          </div>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
