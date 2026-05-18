'use client';

interface SkeletonProps {
  height?: string;
  width?: string;
  rounded?: string;
  className?: string;
}

export function Skeleton({ height = '1rem', width = '100%', rounded = 'md', className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded-${rounded} ${className}`}
      style={{ height, width }}
    />
  );
}
