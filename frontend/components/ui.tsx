"use client";

import React, { useEffect, useRef } from "react";

export function Modal({
  title,
  subtitle,
  onClose,
  instant = false,
  maxWidth = "max-w-md",
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  instant?: boolean;
  maxWidth?: string;
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`bezel-shell w-full ${maxWidth} shadow-2xl ${instant ? "" : "animate-modal-reveal"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bezel-core p-6">
          <div className="mb-5 flex items-start justify-between gap-3 border-b border-white/[0.06] pb-4">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-tight text-white">{title}</h2>
              {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="pressable shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400"
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
  error,
  id,
  ...props
}: {
  label: string;
  hint?: string;
  error?: string;
  id?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = id || `field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="mb-4">
      <label
        htmlFor={generatedId}
        className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-slate-400"
      >
        {label}
      </label>
      <input
        id={generatedId}
        {...props}
        className={`w-full rounded-xl border bg-black/50 px-3.5 py-2.5 font-mono text-xs text-slate-100 placeholder:text-slate-600 transition-[border-color,background-color,box-shadow] duration-150 focus:bg-black/80 focus:outline-none focus:ring-1 ${
          error
            ? "border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/60"
            : "border-white/10 focus:border-indigo-500/80 focus:ring-indigo-500/80"
        }`}
      />
      {error ? (
        <span className="mt-1.5 block text-[11px] leading-relaxed text-rose-400">{error}</span>
      ) : (
        hint && <span className="mt-1.5 block text-[11px] leading-relaxed text-slate-500">{hint}</span>
      )}
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
      ? "px-3 py-1.5 text-xs rounded-lg gap-1.5"
      : "px-4 py-2 text-xs rounded-xl gap-2";

  const variantStyles = {
    primary:
      "bg-indigo-600 text-white border border-indigo-400/40 shadow-[0_1px_2px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-indigo-500 active:bg-indigo-600",
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
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-md bg-white/10 transition-transform duration-150 group-hover:translate-x-0.5">
          {icon}
        </span>
      )}
    </button>
  );
}

/**
 * Emil Kowalski Hold-to-Delete Button:
 * Slow & deliberate on press (900ms linear clip-path fill),
 * snappy on release (180ms ease-out snap-back).
 */
export function HoldToDeleteButton({
  onConfirm,
  label = "Hold to Remove",
  disabled = false,
}: {
  onConfirm: () => void;
  label?: string;
  disabled?: boolean;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startHold = () => {
    if (disabled) return;
    timerRef.current = setTimeout(() => {
      onConfirm();
    }, 900);
  };

  const cancelHold = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => cancelHold();
  }, []);

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !e.repeat) startHold();
      }}
      onKeyUp={cancelHold}
      className="pressable hold-delete-btn relative inline-flex select-none items-center gap-1.5 overflow-hidden rounded-lg border border-rose-500/25 bg-rose-500/[0.08] px-3 py-1.5 text-xs font-medium text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:opacity-40"
      title="Press and hold for 0.9s to confirm removal"
    >
      <span
        aria-hidden="true"
        className="hold-delete-overlay pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 bg-rose-600 text-white"
      >
        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 3h8M4.5 3V2h3v1M3 3v7a1 1 0 001 1h4a1 1 0 001-1V3" />
        </svg>
        <span>{label}</span>
      </span>
      <svg className="h-3 w-3 shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2 3h8M4.5 3V2h3v1M3 3v7a1 1 0 001 1h4a1 1 0 001-1V3" />
      </svg>
      <span>{label}</span>
    </button>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 items-center justify-center rounded border border-white/15 bg-white/[0.06] px-1.5 font-mono text-[10px] font-medium text-slate-400 shadow-[inset_0_-1px_0_rgba(255,255,255,0.1)]">
      {children}
    </kbd>
  );
}
