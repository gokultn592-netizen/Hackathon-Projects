import * as React from 'react';

interface DropdownMenuProps {
  children: React.ReactNode;
}

interface DropdownMenuContextType {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextType | undefined>(undefined);

export function DropdownMenu({ children }: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div ref={menuRef} className="relative inline-block text-left">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

export function DropdownMenuTrigger({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  const context = React.useContext(DropdownMenuContext);
  if (!context) throw new Error('DropdownMenuTrigger must be used within DropdownMenu');

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>, {
      onClick: (e: React.MouseEvent) => {
        children.props.onClick?.(e);
        context.setOpen((prev) => !prev);
      },
    });
  }

  return (
    <button
      type="button"
      onClick={() => context.setOpen((prev) => !prev)}
      className="inline-flex items-center justify-center rounded-[4px] p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
    >
      {children}
    </button>
  );
}

export function DropdownMenuContent({
  children,
  className = '',
  align = 'end',
}: {
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'end';
}) {
  const context = React.useContext(DropdownMenuContext);
  if (!context) throw new Error('DropdownMenuContent must be used within DropdownMenu');

  if (!context.open) return null;

  const alignClass = align === 'end' ? 'right-0' : 'left-0';

  return (
    <div
      className={`absolute z-50 mt-1 min-w-[180px] rounded-[4px] border border-zinc-800 bg-zinc-900 p-1 text-zinc-100 shadow-lg ${alignClass} ${className}`}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({
  children,
  onClick,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const context = React.useContext(DropdownMenuContext);
  if (!context) throw new Error('DropdownMenuItem must be used within DropdownMenu');

  return (
    <button
      type="button"
      onClick={() => {
        onClick?.();
        context.setOpen(false);
      }}
      className={`flex w-full items-center px-2 py-1.5 text-[11px] font-medium text-zinc-300 rounded-[2px] hover:bg-zinc-800 hover:text-zinc-100 transition-colors text-left ${className}`}
    >
      {children}
    </button>
  );
}
