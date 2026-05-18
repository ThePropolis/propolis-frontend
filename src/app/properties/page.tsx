'use client';

import { useEffect, useState } from 'react';
import { Search, Building } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Spinner } from '@/components/ui/Spinner';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type Listing = {
  id: string;
  title: string;
  type?: string;
  active?: boolean;
  source: 'guesty' | 'doorloop';
  address?: { formattedAddress?: string };
  bedrooms?: number;
  base_price?: number;
};

export default function PropertiesPage() {
  const { token } = useAuthStore();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [guestyRes, doorloopRes] = await Promise.allSettled([
          fetch(`${API_URL}/api/properties/listings`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/api/doorloop/properties`, { headers: { Authorization: `Bearer ${token}` } })
        ]);

        const combined: Listing[] = [];

        if (guestyRes.status === 'fulfilled' && guestyRes.value.ok) {
          const data = await guestyRes.value.json();
          (Array.isArray(data) ? data : []).forEach((l: Listing) => combined.push({ ...l, source: 'guesty' }));
        }

        if (doorloopRes.status === 'fulfilled' && doorloopRes.value.ok) {
          const data = await doorloopRes.value.json();
          (data.data || []).forEach((p: Listing & { name?: string }) => combined.push({ ...p, source: 'doorloop', title: p.name || p.title }));
        }

        setListings(combined);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load properties');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  const filtered = listings.filter((l) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || l.title?.toLowerCase().includes(q) || l.address?.formattedAddress?.toLowerCase().includes(q);
    const matchesActive = !activeOnly || l.active;
    return matchesSearch && matchesActive;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Properties</h1>
          <p className="text-sm text-gray-500 mt-1">Short and long term properties overview.</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search properties..."
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-4 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} className="rounded" />
          Active only
        </label>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Spinner size="lg" /> <span className="ml-3 text-gray-600">Loading properties…</span></div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <Building className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No properties match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((l) => (
            <div key={`${l.source}-${l.id}`} className="rounded-xl border border-gray-200 bg-white p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900 text-sm leading-tight flex-1 mr-2">{l.title}</h3>
                <span className={`shrink-0 px-2 py-0.5 text-xs rounded-full font-medium ${l.source === 'guesty' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                  {l.source}
                </span>
              </div>
              {l.address?.formattedAddress && <p className="text-xs text-gray-500 mb-2 truncate">{l.address.formattedAddress}</p>}
              <div className="flex items-center gap-3 text-xs text-gray-500">
                {l.type && <span>{l.type}</span>}
                {l.bedrooms && <span>{l.bedrooms} bed</span>}
                {l.base_price && <span>${l.base_price}/mo</span>}
                <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium ${l.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {l.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
