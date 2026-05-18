'use client';

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  color?: 'white' | 'teal' | 'gray';
}

const sizeMap = { xs: 'h-3 w-3', sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };
const colorMap = {
  white: 'border-white',
  teal: 'border-teal-600',
  gray: 'border-gray-400'
};

export function Spinner({ size = 'md', color = 'teal' }: SpinnerProps) {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-t-transparent ${sizeMap[size]} ${colorMap[color]}`}
    />
  );
}
