'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { useGlobalPropertyFilterStore } from '@/stores/globalPropertyFilterStore';

export function PropertyDropdown() {
  const { selectedProperty, availableProperties, loading, error, loadProperties, setSelectedProperty, clearSelectedProperty } =
    useGlobalPropertyFilterStore();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProperties();
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const buttonText = selectedProperty
    ? selectedProperty.name
    : loading
    ? 'Loading…'
    : 'All Properties';

  return (
    <div className="relative min-w-[180px]" ref={ref}>
      <button
        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm text-gray-700 bg-white shadow-sm transition-all ${selectedProperty ? 'border-orange-400 bg-orange-50' : 'border-gray-300 hover:border-gray-400'}`}
        onClick={() => setIsOpen((v) => !v)}
        disabled={loading}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="flex-1 text-left truncate">{buttonText}</span>
          {selectedProperty && (
            <span
              className="flex items-center justify-center p-0.5 bg-black/10 rounded cursor-pointer hover:bg-black/20"
              onClick={(e) => { e.stopPropagation(); clearSelectedProperty(); setIsOpen(false); }}
              role="button"
              tabIndex={0}
              aria-label="Clear selection"
            >
              <X className="w-3 h-3" />
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-[calc(100%+0.25rem)] left-0 right-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[300px] overflow-y-auto">
          {loading ? (
            <div className="px-3 py-2 text-sm text-gray-500">Loading properties…</div>
          ) : error ? (
            <div className="px-3 py-2 text-sm text-red-600">Error: {error}</div>
          ) : availableProperties.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">No properties available</div>
          ) : (
            <>
              <button
                className={`block w-full px-3 py-2.5 text-left text-sm hover:bg-gray-50 ${!selectedProperty ? 'bg-orange-50 text-orange-600' : 'text-gray-700'}`}
                onClick={() => { clearSelectedProperty(); setIsOpen(false); }}
              >
                All Properties
              </button>
              <div className="h-px bg-gray-200 my-1" />
              {availableProperties.map((p) => (
                <button
                  key={p.id}
                  className={`block w-full px-3 py-2.5 text-left text-sm hover:bg-gray-50 truncate ${selectedProperty?.id === p.id ? 'bg-orange-50 text-orange-600' : 'text-gray-700'}`}
                  onClick={() => { setSelectedProperty(p); setIsOpen(false); }}
                >
                  {p.name}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
