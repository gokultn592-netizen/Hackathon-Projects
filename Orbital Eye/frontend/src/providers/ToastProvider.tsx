import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';

export type ToastType = 'info' | 'success' | 'error' | 'warning';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  timestamp: number;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idCounter = useRef(0);

  const timeoutsRef = useRef<number[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++idCounter.current;
    setToasts((prev) => [...prev, { id, message, type, timestamp: Date.now() }]);
    const timer = window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
    timeoutsRef.current.push(timer);
  }, []);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast }}>
      {children}
      <div
        role="region"
        aria-live="polite"
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-sm w-full"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={
              `rounded-xl shadow-2xl px-5 py-4 text-sm font-medium border backdrop-blur-md transition-all duration-300 animate-in slide-in-from-right-4 fade-in ` +
              (toast.type === 'success'
                ? 'bg-emerald-900/80 text-emerald-100 border-emerald-600/40'
                : toast.type === 'error'
                ? 'bg-red-900/80 text-red-100 border-red-600/40'
                : toast.type === 'warning'
                ? 'bg-amber-900/80 text-amber-100 border-amber-600/40'
                : 'bg-blue-900/80 text-blue-100 border-blue-600/40')
            }
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0">
                {toast.type === 'success' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                ) : toast.type === 'error' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="15" x2="12" y2="9"/><line x1="12" y1="12" x2="12.01" y2="12"/></svg>
                ) : toast.type === 'warning' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="12" x2="12" y2="6"/></svg>
                )}
              </span>
              <span className="leading-relaxed">{toast.message}</span>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx.showToast;
}
