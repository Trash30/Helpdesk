import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface MultiSelectProps {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}

export function MultiSelect({ options, value, onChange, placeholder }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex h-9 min-w-[150px] items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm"
      >
        <span className="text-muted-foreground truncate">
          {placeholder}{value.length > 0 && <span className="ml-1 rounded-full bg-primary text-primary-foreground text-xs px-1.5 py-0.5">{value.length}</span>}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[170px] rounded-md border bg-popover shadow-md py-1">
          {options.map(opt => (
            <label
              key={opt.value}
              className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-accent"
            >
              <input
                type="checkbox"
                checked={value.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="h-4 w-4 rounded border-input"
              />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
