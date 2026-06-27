import type { ReactNode } from "react";

type Variant = "error" | "warning";

const VARIANTS: Record<Variant, { container: string; icon: string }> = {
  error: {
    container: "bg-rose-50 ring-rose-200/70 text-rose-800",
    icon: "text-rose-500",
  },
  warning: {
    container: "bg-amber-50 ring-amber-200/70 text-amber-900",
    icon: "text-amber-600",
  },
};

export function Alert({
  variant = "error",
  children,
}: {
  variant?: Variant;
  children: ReactNode;
}) {
  const v = VARIANTS[variant];
  return (
    <div
      className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm ring-1 ${v.container}`}
      role={variant === "error" ? "alert" : undefined}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        className={`h-5 w-5 flex-none ${v.icon}`}
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5" strokeLinecap="round" />
        <path d="M12 16.4v.6" strokeLinecap="round" />
      </svg>
      <div className="min-w-0 flex-1 break-words">{children}</div>
    </div>
  );
}
