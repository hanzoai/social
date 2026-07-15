'use client';
// Generic, app-agnostic UI atoms (Button, Modal, StatTile). Kept separate from
// the named domain components so the domain pieces stay small and portable.
import { ReactNode, MouseEventHandler } from 'react';
import clsx from 'clsx';

export function Button({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled,
  title,
  className,
}: {
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle';
  type?: 'button' | 'submit';
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const styles = {
    primary:
      'bg-[#7c5cff] hover:bg-[#6a49f2] text-white shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset]',
    ghost: 'bg-transparent hover:bg-white/5 text-zinc-200 border border-white/10',
    subtle: 'bg-white/5 hover:bg-white/10 text-zinc-200',
    danger: 'bg-transparent hover:bg-red-500/10 text-red-400 border border-red-500/20',
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        styles,
        className
      )}
    >
      {children}
    </button>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:p-8"
      onMouseDown={onClose}
    >
      <div
        className={clsx(
          'mt-6 w-full rounded-2xl border border-white/10 bg-[#131316] shadow-2xl',
          width
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <h2 className="text-[15px] font-semibold text-zinc-100">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#131316] px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div
        className={clsx(
          'mt-1 text-2xl font-semibold tabular-nums',
          accent ? 'text-[#a48bff]' : 'text-zinc-100'
        )}
      >
        {value}
      </div>
      {sub ? <div className="mt-0.5 text-xs text-zinc-500">{sub}</div> : null}
    </div>
  );
}
