'use client';

import { create } from 'zustand';
import type { DoorloopProperty } from '../lib/types/doorloop';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface PropertyOption {
  id: string;
  name: string;
}

interface GlobalPropertyFilterState {
  selectedProperty: PropertyOption | null;
  availableProperties: PropertyOption[];
  loading: boolean;
  error: string | null;
  loadProperties: () => Promise<void>;
  setSelectedProperty: (property: PropertyOption | null) => void;
  clearSelectedProperty: () => void;
}

export const useGlobalPropertyFilterStore = create<GlobalPropertyFilterState>((set) => ({
  selectedProperty: null,
  availableProperties: [],
  loading: false,
  error: null,

  loadProperties: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/api/doorloop/properties`);
      if (!res.ok) {
        set({ loading: false, error: `Failed to load properties: ${res.status} ${res.statusText}`, availableProperties: [] });
        return;
      }
      const data = await res.json();

      const properties: PropertyOption[] = data.data.map((p: DoorloopProperty) => ({
        id: p.id,
        name: p.name
      }));

      const excluded = ['3320 NW 5th Ave', '3320 nw 5th ave', '3320 NW 5th Avenue'];
      const filtered = properties.filter(
        (p) => !excluded.some((ex) => p.name.toLowerCase().trim() === ex.toLowerCase().trim())
      );

      const jurnyOnly: PropertyOption[] = [
        { id: 'jurny-olive-apartments', name: 'Olive Apartments' }
      ];

      const all = [...filtered, ...jurnyOnly].sort((a, b) => a.name.localeCompare(b.name));

      set({ availableProperties: all, loading: false, error: null });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load properties',
        availableProperties: []
      });
    }
  },

  setSelectedProperty: (property) => set({ selectedProperty: property }),
  clearSelectedProperty: () => set({ selectedProperty: null })
}));
