import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

// Minimal button component with a few variants/sizes
const variants = {
  default: 'bg-primary text-white hover:opacity-90',
  ghost: 'bg-transparent hover:bg-muted',
};

const sizes = {
  sm: 'h-7 px-2 text-xs',
  md: 'h-9 px-3 text-sm',
  lg: 'h-10 px-4 text-sm',
};

export const Button = forwardRef(({ className, variant = 'default', size = 'md', ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-md transition-colors disabled:opacity-50 disabled:pointer-events-none',
        variants[variant] ?? variants.default,
        sizes[size] ?? sizes.md,
        className,
      )}
      {...props}
    />
  );
});

Button.displayName = 'Button';