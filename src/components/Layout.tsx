import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-24 pt-[max(env(safe-area-inset-top),1rem)]">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
