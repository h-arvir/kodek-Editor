import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const ScrollArea = forwardRef(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('overflow-auto', className)}
      {...props}
    >
      {children}
    </div>
  );
});

ScrollArea.displayName = 'ScrollArea';