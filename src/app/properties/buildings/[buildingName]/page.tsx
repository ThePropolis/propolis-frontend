'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Users, CheckCircle2, DollarSign } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Spinner } from '@/components/ui/Spinner';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type Listing = {
  id: string;
  title: string;
  nickname?: string;
  active?: boolean;
  source: 'guesty' | 'doorloop';
  address_building_name?: string;
  address_full?: string;
  address_city?: string;
  address_state?: string;
  property_type?: string;
  type?: string;
  bedrooms?: number;
  bathrooms?: number;
  accommodates?: number;
  base_price?: number;
  area_square_feet?: number;
  cleaning_status?: string;
  pictures?: string[];
  thumbnail_url?: string;
};

function normalizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+(apartments?|complex|building|tower|plaza|court|place)s?$/i, '')
    .trim();
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 flex items-center gap-4">
      <div className="p-2 bg-blue-50 rounded-lg text-blue-600">{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function BuildingPage({ params }: { params: Promise<{ buildingName: string }> }) {
  const { buildingName } = use(params);
  const decoded = decodeURIComponent(buildingName);
  const router = useRouter();
  const { token } = useAuthStore();

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [guestyRes, doorloopRes] = await Promise.allSettled([
          fetch(`${API_URL}/api/properties/listings`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/api/doorloop/properties`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        const all: Listing[] = [];
        if (guestyRes.status === 'fulfilled' && guestyRes.value.ok) {
          const data = await guestyRes.value.json();
          (Array.isArray(data) ? data : []).forEach((l: Listing) => all.push({ ...l, source: 'guesty' }));
        }
        if (doorloopRes.status === 'fulfilled' && doorloopRes.value.ok) {
          const data = await doorloopRes.value.json();
          (data.data || []).forEach((p: Listing & { name?: string }) =>
            all.push({ ...p, source: 'doorloop', title: p.name || p.title })
          );
        }

        const norm = normalizeName(decoded);
        const filtered = all.filter((l) => l.address_building_name && normalizeName(l.address_building_name) === norm);
        setListings(filtered);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token, decoded]);

  const buildingInfo = listings[0];
  const avgPrice = listings.length
    ? Math.round(listings.reduce((s, l) => s + (l.base_price || 0), 0) / listings.length)
    : 0;
  const totalCapacity = listings.reduce((s, l) => s + (l.accommodates || 0), 0);
  const active = listings.filter((l) => l.active).length;
  const propertyTypes = Array.from(new Set(listings.map((l) => l.property_type || l.type).filter(Boolean)));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{decoded}</h1>
          {buildingInfo?.address_full && (
            <p className="text-sm text-gray-500">
              {buildingInfo.address_full}
              {buildingInfo.address_city && `, ${buildingInfo.address_city}`}
              {buildingInfo.address_state && `, ${buildingInfo.address_state}`}
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" /><span className="ml-3 text-gray-600">Loading building data…</span>
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<Building2 className="h-6 w-6" />}
              label="Total Properties"
              value={listings.length}
              sub={`${listings.filter((l) => l.source === 'guesty').length} STR · ${listings.filter((l) => l.source === 'doorloop').length} LTR`}
            />
            <StatCard icon={<CheckCircle2 className="h-6 w-6" />} label="Active" value={active} />
            <StatCard icon={<Users className="h-6 w-6" />} label="Total Capacity" value={totalCapacity} />
            <StatCard icon={<DollarSign className="h-6 w-6" />} label="Avg Price" value={`$${avgPrice}`} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Property Types</h3>
              <div className="space-y-2">
                {propertyTypes.length === 0 ? (
                  <p className="text-sm text-gray-400">No type data</p>
                ) : (
                  propertyTypes.map((type) => (
                    <div key={type} className="flex justify-between text-sm">
                      <span className="text-gray-600 capitalize">{type}</span>
                      <span className="font-medium text-gray-900">
                        {listings.filter((l) => (l.property_type || l.type) === type).length}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6 flex items-center justify-center">
              <div className="text-center text-gray-400 text-sm">
                <div className="mb-1">Revenue tracking</div>
                <div className="text-xs">Coming soon</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Properties in {decoded}</h2>
              <span className="text-sm text-gray-500">{listings.length} properties</span>
            </div>
            {listings.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No properties found for this building.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {listings.map((l) => {
                  const thumb = l.pictures?.[0] || l.thumbnail_url;
                  return (
                    <div key={`${l.source}-${l.id}`} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors">
                      {thumb ? (
                        <img src={thumb} alt={l.title} className="w-16 h-16 object-cover rounded-lg shrink-0" loading="lazy" />
                      ) : (
                        <div className="w-16 h-16 bg-gray-100 rounded-lg shrink-0 flex items-center justify-center">
                          <Building2 className="h-6 w-6 text-gray-300" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{l.title}</p>
                        {l.nickname && <p className="text-xs text-gray-500">{l.nickname}</p>}
                        <div className="flex gap-3 mt-1 text-xs text-gray-500">
                          {(l.property_type || l.type) && <span className="capitalize">{l.property_type || l.type}</span>}
                          {l.bedrooms != null && <span>{l.bedrooms} bed</span>}
                          {l.accommodates != null && <span>Sleeps {l.accommodates}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-gray-900">${l.base_price}</p>
                        <p className="text-xs text-gray-400">/{l.source === 'doorloop' ? 'mo' : 'night'}</p>
                      </div>
                      <span className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium ${l.source === 'guesty' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                        {l.source === 'guesty' ? 'STR' : 'LTR'}
                      </span>
                      <Link
                        href={`/properties/listings/${l.id}`}
                        className="shrink-0 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        View
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
