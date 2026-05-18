import { create } from 'zustand';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface ListingData {
  id: number;
  guesty_created_at: Date;
  total_paid: number;
  property_full_name?: string;
  source: 'guesty' | 'doorloop';
}

export interface ListingNames {
  property_names: string[];
  building_names: string[];
}

interface PropertyState {
  listingNames: ListingNames;
  listingData: Record<string, ListingData[]>;
  loading: boolean;
  error: string | null;
  namesLoaded: boolean;

  loadListingNames: (token: string) => Promise<void>;
  getDataFor: (
    token: string,
    unit_names?: string[],
    building_names?: string[],
    date_start?: string,
    date_end?: string,
    beds?: number,
    property_type?: string,
  ) => Promise<void>;
  clearProperties: (names: string[]) => void;
  reset: () => void;
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export const usePropertyStore = create<PropertyState>((set, get) => ({
  listingNames: { property_names: [], building_names: [] },
  listingData: {},
  loading: false,
  error: null,
  namesLoaded: false,

  async loadListingNames(token) {
    if (get().namesLoaded) return;
    set({ loading: true, error: null });
    try {
      const [guestyRes, doorloopRes] = await Promise.all([
        fetch(`${API_URL}/api/reservations/names`, { headers: authHeader(token) }),
        fetch(`${API_URL}/api/doorloop/properties`, { headers: authHeader(token) }),
      ]);

      const guestyNames = guestyRes.ok ? await guestyRes.json() : { property_names: [], building_names: [] };
      const doorloopData = doorloopRes.ok ? await doorloopRes.json() : { data: [] };
      const doorloopNames = (doorloopData.data || []).map((p: { name: string }) => p.name);

      set({
        listingNames: {
          property_names: [...new Set([...(guestyNames.property_names || []), ...doorloopNames])],
          building_names: [...new Set([...(guestyNames.building_names || []), ...doorloopNames])],
        },
        loading: false,
        namesLoaded: true,
      });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Error fetching names' });
    }
  },

  async getDataFor(token, unit_names, building_names, date_start, date_end, beds, property_type) {
    set({ loading: true, error: null });
    try {
      const url = new URL(`${API_URL}/api/reservations`);
      if (property_type) url.searchParams.set('property_type', property_type);
      if (beds) url.searchParams.set('number_of_beds', beds.toString());
      if (date_start) url.searchParams.set('date_start', date_start);
      if (date_end) url.searchParams.set('date_end', date_end);
      building_names?.forEach((n) => url.searchParams.append('building_names', n));
      unit_names?.forEach((n) => url.searchParams.append('property_full_names', n));

      const [guestyRes, doorloopRes] = await Promise.all([
        fetch(url.toString(), { headers: authHeader(token) }),
        fetch(`${API_URL}/api/doorloop/properties`, { headers: authHeader(token) }),
      ]);

      const grouped: Record<string, ListingData[]> = {};

      if (guestyRes.ok) {
        const guestyData: ListingData[] = await guestyRes.json();
        guestyData.forEach((r) => {
          const name = r.property_full_name || 'Unknown';
          if (!grouped[name]) grouped[name] = [];
          grouped[name].push({ ...r, source: 'guesty' });
        });
      }

      if (doorloopRes.ok) {
        const doorloopData = await doorloopRes.json();
        (doorloopData.data || []).forEach((p: { id: string; name: string; createdAt: string }) => {
          if (!grouped[p.name]) grouped[p.name] = [];
          grouped[p.name].push({
            id: parseInt(p.id),
            guesty_created_at: new Date(p.createdAt),
            total_paid: 0,
            property_full_name: p.name,
            source: 'doorloop',
          });
        });
      }

      set({ listingData: grouped, loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Error fetching data' });
    }
  },

  clearProperties(names) {
    set((s) => {
      const next = { ...s.listingData };
      names.forEach((n) => delete next[n]);
      return { listingData: next };
    });
  },

  reset() {
    set({ listingNames: { property_names: [], building_names: [] }, listingData: {}, loading: false, error: null, namesLoaded: false });
  },
}));
