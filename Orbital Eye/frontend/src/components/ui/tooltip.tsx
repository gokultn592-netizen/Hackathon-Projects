import * as React from 'react';

export function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="relative group inline-block">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-50 pointer-events-none">
        <div className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-[11px] px-2 py-0.5 rounded-[4px] whitespace-nowrap shadow-md">
          {text}
        </div>
      </div>
    </div>
  );
}
