import * as React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'critical' | 'warning' | 'nominal';
}

export function Badge({ className = '', variant = 'default', ...props }: BadgeProps) {
  const variantStyles = {
    default: 'border-zinc-800 bg-zinc-900 text-zinc-300',
    critical: 'border-red-500/30 bg-red-500/10 text-red-500 shadow-[0_0_8px_rgba(239,68,68,0.25)]',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-500',
    nominal: 'border-zinc-800 bg-zinc-900 text-zinc-400',
  }[variant];

  return (
    <div
      className={`inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[11px] font-medium transition-colors ${variantStyles} ${className}`}
      {...props}
    />
  );
}
