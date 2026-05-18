'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';

interface CardWidgetProps {
  info?: string;
  marginBottom?: boolean;
  title: ReactNode;
  children: ReactNode;
}

export function CardWidget({ info, marginBottom = true, title, children }: CardWidgetProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        showTooltip &&
        tooltipRef.current &&
        buttonRef.current &&
        !tooltipRef.current.contains(e.target as Node) &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setShowTooltip(false);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showTooltip]);

  return (
    <div
      className={`bg-gray-50 p-6 rounded-xl border-2 relative flex flex-col justify-between ${marginBottom ? 'mb-6' : ''}`}
      style={{
        borderColor: 'var(--color-propolis-teal)',
        minHeight: '180px',
        minWidth: '220px',
        boxShadow: '0 2px 8px 0 rgba(0,0,0,0.03)'
      }}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="text-xs text-gray-500 font-semibold">{title}</div>
        {info && (
          <div className="relative flex items-center ml-2">
            <button
              ref={buttonRef}
              onClick={(e) => { e.stopPropagation(); setShowTooltip((v) => !v); }}
              className="h-5 w-5 flex items-center justify-center text-gray-400 hover:text-yellow-400 cursor-pointer transition-colors"
              aria-label="Show formula"
              aria-expanded={showTooltip}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 16v-4m0-4h.01" />
              </svg>
            </button>
            {showTooltip && (
              <div
                ref={tooltipRef}
                className="absolute left-1/2 top-full z-10 mt-2 w-40 -translate-x-1/2 rounded bg-white p-2 text-xs text-gray-700 shadow-lg"
              >
                {info}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col justify-center">{children}</div>
    </div>
  );
}
