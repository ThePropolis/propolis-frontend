'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Spinner } from '@/components/ui/Spinner';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type Listing = {
  id: string;
  title: string;
  nickname?: string;
  active?: boolean;
  source?: string;
  address_building_name?: string;
  address_full?: string;
  address_city?: string;
  address_state?: string;
  property_type?: string;
  room_type?: string;
  bedrooms?: number;
  bathrooms?: number;
  accommodates?: number;
  area_square_feet?: number;
  base_price?: number;
  currency?: string;
  min_nights?: number;
  max_nights?: number;
  minimum_age?: number;
  security_deposit_fee?: number;
  extra_person_fee?: number;
  weekly_price_factor?: number;
  monthly_price_factor?: number;
  guests_included?: number;
  cleaning_status?: string;
  description_summary?: string;
  amenities?: string[];
  tags?: string[];
  pictures?: string[];
  thumbnail_url?: string;
};

type Reservation = {
  id: string;
  guesty_created_at: string;
  total_paid: number;
};

type Tab = 'overview' | 'reservations' | 'amenities' | 'pricing';

export default function ListingPage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = use(params);
  const router = useRouter();
  const { token } = useAuthStore();

  const [listing, setListing] = useState<Listing | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [listRes, resRes] = await Promise.allSettled([
          fetch(`${API_URL}/api/properties/listings`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/api/reservations?listing_id=${listingId}`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (listRes.status === 'fulfilled' && listRes.value.ok) {
          const data: Listing[] = await listRes.value.json();
          const found = (Array.isArray(data) ? data : []).find((l) => l.id === listingId);
          setListing(found || null);
        }

        if (resRes.status === 'fulfilled' && resRes.value.ok) {
          const data = await resRes.value.json();
          setReservations(Array.isArray(data) ? data : data.data || []);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token, listingId]);

  const totalRevenue = reservations.reduce((s, r) => s + r.total_paid, 0);
  const avgRevenue = reservations.length ? totalRevenue / reservations.length : 0;
  const recentReservations = [...reservations]
    .sort((a, b) => new Date(b.guesty_created_at).getTime() - new Date(a.guesty_created_at).getTime())
    .slice(0, 5);

  const thumb = listing?.pictures?.[0] || listing?.thumbnail_url;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'reservations', label: 'Reservations' },
    { id: 'amenities', label: 'Amenities' },
    { id: 'pricing', label: 'Pricing' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-5 w-5" />
        </button>
        {listing && (
          <nav className="flex items-center gap-1 text-sm text-gray-500">
            <Link href="/properties" className="hover:text-gray-700">Properties</Link>
            {listing.address_building_name && (
              <>
                <ChevronRight className="h-4 w-4" />
                <Link
                  href={`/properties/buildings/${encodeURIComponent(listing.address_building_name)}`}
                  className="hover:text-gray-700"
                >
                  {listing.address_building_name}
                </Link>
              </>
            )}
            <ChevronRight className="h-4 w-4" />
            <span className="text-gray-900 font-medium">{listing.title}</span>
          </nav>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" /><span className="ml-3 text-gray-600">Loading property…</span>
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
      ) : !listing ? (
        <div className="text-center py-12 text-gray-500">Property not found.</div>
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{listing.title}</h1>
              {listing.nickname && <p className="text-gray-500">{listing.nickname}</p>}
              {listing.address_full && (
                <p className="text-sm text-gray-400 mt-1">
                  {listing.address_full}
                  {listing.address_city && `, ${listing.address_city}`}
                  {listing.address_state && `, ${listing.address_state}`}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <div className="text-2xl font-bold text-gray-900">${listing.base_price}</div>
              <div className="text-xs text-gray-400">per night · {listing.currency || 'USD'}</div>
              <div className="flex gap-2 mt-2 justify-end">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${listing.active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {listing.active ? 'Active' : 'Inactive'}
                </span>
                {listing.cleaning_status && (
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${listing.cleaning_status === 'clean' ? 'bg-blue-50 text-blue-700' : 'bg-yellow-50 text-yellow-700'}`}>
                    {listing.cleaning_status === 'clean' ? 'Clean' : 'Needs Cleaning'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Photo */}
          {thumb && (
            <div className="rounded-xl overflow-hidden bg-gray-100" style={{ height: 360 }}>
              <img src={thumb} alt={listing.title} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Guests', value: listing.accommodates ?? '—' },
              { label: 'Bedrooms', value: listing.bedrooms ?? '—' },
              { label: 'Bathrooms', value: listing.bathrooms ?? '—' },
              { label: 'Sq Ft', value: listing.area_square_feet ?? '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                <div className="text-xl font-bold text-gray-900">{value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex gap-6">
              {tabs.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`py-2 text-sm font-medium border-b-2 transition-colors ${tab === id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab content */}
          {tab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Property Details</h2>
                <dl className="space-y-3">
                  {([
                    { label: 'Property Type', value: listing.property_type },
                    { label: 'Room Type', value: listing.room_type },
                    { label: 'Min Nights', value: listing.min_nights != null ? String(listing.min_nights) : null },
                    { label: 'Max Nights', value: listing.max_nights != null ? String(listing.max_nights) : null },
                    listing.minimum_age != null ? { label: 'Minimum Age', value: String(listing.minimum_age) } : null,
                    { label: 'Security Deposit', value: listing.security_deposit_fee != null ? `$${listing.security_deposit_fee}` : null },
                  ] as ({ label: string; value: string | null | undefined } | null)[]).filter((x): x is { label: string; value: string } => x != null && x.value != null).map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-sm">
                      <dt className="text-gray-500">{label}</dt>
                      <dd className="text-gray-900 font-medium capitalize">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Reservation Statistics</h2>
                <dl className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">Total Reservations</dt>
                    <dd className="font-bold text-gray-900">{reservations.length}</dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">Total Revenue</dt>
                    <dd className="font-bold text-green-600">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">Average per Reservation</dt>
                    <dd className="font-bold text-gray-900">${Math.round(avgRevenue).toLocaleString()}</dd>
                  </div>
                </dl>
              </div>
              {listing.description_summary && (
                <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="font-semibold text-gray-900 mb-3">Description</h2>
                  <p className="text-sm text-gray-700 leading-relaxed">{listing.description_summary}</p>
                </div>
              )}
            </div>
          )}

          {tab === 'reservations' && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">Recent Reservations</h2>
              </div>
              {recentReservations.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">No reservation data available.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {recentReservations.map((r) => (
                    <div key={r.id} className="px-6 py-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">#{r.id}</p>
                        <p className="text-xs text-gray-500">{new Date(r.guesty_created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">${r.total_paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <p className="text-xs text-gray-400">Total Paid</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'amenities' && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Amenities</h2>
              {(listing.amenities || []).length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {(listing.amenities || []).map((a) => (
                    <div key={a} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-sm text-gray-700">
                      <span className="text-green-500">✓</span>{a}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No amenities listed.</p>
              )}
              {(listing.tags || []).length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {(listing.tags || []).map((t) => (
                      <span key={t} className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'pricing' && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Pricing Information</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  { label: 'Base Price', value: listing.base_price != null ? `$${listing.base_price} ${listing.currency || 'USD'}` : null },
                  { label: 'Weekly Price Factor', value: listing.weekly_price_factor != null ? `${listing.weekly_price_factor}x` : null },
                  { label: 'Monthly Price Factor', value: listing.monthly_price_factor != null ? `${listing.monthly_price_factor}x` : null },
                  { label: 'Extra Person Fee', value: listing.extra_person_fee != null ? `$${listing.extra_person_fee}` : null },
                  { label: 'Security Deposit', value: listing.security_deposit_fee != null ? `$${listing.security_deposit_fee}` : null },
                  { label: 'Guests Included', value: listing.guests_included != null ? String(listing.guests_included) : null },
                ] as ({ label: string; value: string | null }[])).filter((x): x is { label: string; value: string } => x.value != null).map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm py-2 border-b border-gray-100 last:border-0">
                    <dt className="text-gray-500">{label}</dt>
                    <dd className="font-medium text-gray-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </>
      )}
    </div>
  );
}
