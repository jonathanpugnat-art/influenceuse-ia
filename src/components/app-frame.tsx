import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";

type AppFrameProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function AppFrame({ title, description, action, children }: AppFrameProps) {
  return (
    <AppShell>
      <main className="page-in mx-auto w-full max-w-6xl px-5 py-7 md:px-10 md:py-10">
        <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-line pb-5">
          <div className="max-w-2xl">
            <p className="telemetry mb-2 text-[0.625rem] text-dim">Ofmia / Studio</p>
            <h1 className="font-display text-3xl font-bold tracking-[-0.03em] text-balance uppercase md:text-4xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-3 max-w-prose text-sm text-pretty text-mute">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
        {children}
      </main>
    </AppShell>
  );
}
