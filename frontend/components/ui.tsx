"use client";

import React, { useEffect } from "react";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md transition-opacity duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Double-Bezel Modal Architecture */}
      <div
        className="bezel-shell animate-modal-reveal w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bezel-core p-6">
          <div className="mb-5 flex items-center justify-between border-b border-white/[0.06] pb-4">
            <h2 className="text-sm font-semibold tracking-tight text-white">{title}</h2>
            <button
              onClick={onClose}
              className="pressable rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400"
              aria-label="Close dialog"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 1l10 10M11 1L1 11" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  id,
  ...props
}: { label: string; hint?: string; id?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = id || `field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="mb-4">
      <label htmlFor={generatedId} className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-slate-400">
        {label}
      </label>
      <input
        id={generatedId}
        {...props}
        className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 font-mono text-xs text-slate-100 placeholder:text-slate-600 transition focus:border-indigo-500/80 focus:bg-black/80 focus:outline-none focus:ring-1 focus:ring-indigo-500/80"
      />
      {hint && <span className="mt-1.5 block text-[11px] leading-relaxed text-slate-500">{hint}</span>}
    </div>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  icon,
  children,
  ...props
}: {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  icon?: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const baseStyles =
    "pressable group inline-flex items-center justify-center font-medium tracking-tight select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070a] disabled:cursor-not-allowed disabled:opacity-40";

  const sizeStyles =
    size === "sm"
      ? "px-3.5 py-1.5 text-xs rounded-xl gap-2"
      : "px-5 py-2.5 text-xs rounded-xl gap-2.5";

  const variantStyles = {
    primary:
      "bg-indigo-600 text-white border border-indigo-400/40 shadow-[0_1px_2px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:bg-indigo-500 active:bg-indigo-600",
    secondary:
      "bg-white/[0.04] text-slate-200 border border-white/10 hover:bg-white/[0.08] hover:border-white/20 active:bg-white/[0.04]",
    ghost:
      "text-slate-400 hover:text-white hover:bg-white/[0.06] active:bg-transparent",
    danger:
      "bg-rose-500/15 text-rose-200 border border-rose-500/30 hover:bg-rose-500/25 active:bg-rose-500/15",
  }[variant];

  return (
    <button className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`} {...props}>
      <span>{children}</span>
      {icon && (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 transition-transform duration-200 group-hover:translate-x-0.5">
          {icon}
        </span>
      )}
    </button>
  );
}
