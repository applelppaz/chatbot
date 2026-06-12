import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-col">
      <BackgroundDecor />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-28 pt-[max(env(safe-area-inset-top),1.25rem)]">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

function BackgroundDecor() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-gradient-to-br from-slate-50 via-white to-indigo-50"
    >
      <div className="absolute -top-32 -left-24 h-72 w-72 rounded-full bg-indigo-200/45 blur-3xl" />
      <div className="absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-violet-200/40 blur-3xl" />
      <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-rose-200/30 blur-3xl" />
    </div>
  );
}
