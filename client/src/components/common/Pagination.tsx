import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="sm" onClick={() => onChange(page - 1)} disabled={page === 1}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {start > 1 && (
        <>
          <Button variant={page === 1 ? 'default' : 'outline'} size="sm" onClick={() => onChange(1)}>1</Button>
          {start > 2 && <span className="px-2 text-muted-foreground">...</span>}
        </>
      )}
      {pages.map(p => (
        <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm" onClick={() => onChange(p)}>
          {p}
        </Button>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="px-2 text-muted-foreground">...</span>}
          <Button variant={page === totalPages ? 'default' : 'outline'} size="sm" onClick={() => onChange(totalPages)}>
            {totalPages}
          </Button>
        </>
      )}
      <Button variant="outline" size="sm" onClick={() => onChange(page + 1)} disabled={page === totalPages}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
