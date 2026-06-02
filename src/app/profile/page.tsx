'use client';

import { useEffect, useRef, useState } from 'react';
import { User as UserIcon, Upload, Save, Shield, Mail, Camera, Trash2, KeyRound, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { Spinner } from '@/components/ui/Spinner';
import { Skeleton } from '@/components/ui/Skeleton';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type Profile = { email: string; full_name: string; role: string; avatar_url?: string | null };

function roleColor(r: string) {
  if (r === 'owner') return 'bg-purple-50 text-purple-700 border-purple-200';
  if (r === 'investor') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (r === 'operator') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-gray-50 text-gray-700 border-gray-200';
}

export default function ProfilePage() {
  const { token, logout, updateUser } = useAuthStore();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fullName, setFullName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const authHeader = () => ({ Authorization: `Bearer ${token}` });

  async function loadMe() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, { headers: authHeader() });
      if (!res.ok) throw new Error(`Failed to load profile (${res.status})`);
      const p: Profile = await res.json();
      setProfile(p);
      setFullName(p.full_name || '');
      updateUser({ full_name: p.full_name || '', avatar_url: p.avatar_url ?? null });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadMe(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveName() {
    if (!fullName.trim()) { toast.error('Name cannot be empty'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        method: 'PATCH',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName.trim() })
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Save failed (${res.status})`); }
      const updated: Profile = await res.json();
      setProfile(updated);
      updateUser({ full_name: updated.full_name });
      toast.success('Profile updated');
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed to save'); } finally { setSaving(false); }
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please pick an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_URL}/api/auth/me/avatar`, {
        method: 'POST',
        headers: authHeader(),
        body: fd
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Upload failed (${res.status})`); }
      const { avatar_url } = await res.json();
      setProfile((p) => p ? { ...p, avatar_url } : p);
      updateUser({ avatar_url });
      toast.success('Profile picture updated');
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Upload failed'); } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function changePassword() {
    if (newPw.length < 8) { toast.error('New password must be at least 8 characters'); return; }
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return; }
    if (newPw === currentPw) { toast.error('New password must differ from current'); return; }
    setChangingPw(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/me/password`, {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPw, new_password: newPw })
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Password change failed (${res.status})`); }
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setShowCurrent(false); setShowNew(false);
      toast.success('Password updated. Use it next time you log in.');
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed to change password'); } finally { setChangingPw(false); }
  }

  const initials = (fullName || profile?.email || 'U')
    .split(/\s+|@/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-50">
          <UserIcon className="h-6 w-6 text-teal-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Your profile</h1>
          <p className="text-sm text-gray-500">Update your name and profile picture.</p>
        </div>
      </div>

      {/* Avatar */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <div className="relative">
            {loading ? (
              <Skeleton height="6rem" width="6rem" rounded="full" />
            ) : profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="h-24 w-24 rounded-full object-cover ring-4 ring-white shadow-md" />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-2xl font-semibold text-white shadow-md">
                {initials}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-teal-600 text-white shadow-lg transition hover:bg-teal-700 disabled:opacity-70"
              aria-label="Upload photo"
            >
              {uploading ? <Spinner size="sm" color="white" /> : <Camera className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">Profile picture</h2>
            <p className="mt-1 text-sm text-gray-500">PNG, JPG or GIF. Max 5 MB. Square images look best.</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
              >
                <Upload className="h-4 w-4" />
                {uploading ? 'Uploading…' : 'Upload new'}
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
          </div>
        </div>
      </section>

      {/* Details */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Account details</h2>
        <p className="mt-1 text-sm text-gray-500">Email and role are managed by the admin.</p>
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Full name</span>
            {loading ? <Skeleton height="2.5rem" /> : (
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            )}
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Email</span>
              <div className="inline-flex w-full items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                <Mail className="h-4 w-4 text-gray-400" />
                {loading ? '…' : profile?.email}
              </div>
            </div>
            <div>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Role</span>
              {loading ? <Skeleton height="2.5rem" /> : (
                <div className={`inline-flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm capitalize ${roleColor(profile?.role || '')}`}>
                  <Shield className="h-4 w-4" />{profile?.role}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            onClick={saveName}
            disabled={saving || loading || fullName.trim() === (profile?.full_name || '')}
            className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
          >
            {saving ? <><Spinner size="sm" color="white" /> Saving…</> : <><Save className="h-4 w-4" /> Save changes</>}
          </button>
        </div>
      </section>

      {/* Change password */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-teal-600" />
          <h2 className="text-lg font-semibold text-gray-900">Change password</h2>
        </div>
        <p className="mt-1 text-sm text-gray-500">You&apos;ll need your current password. Minimum 8 characters.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Current password</span>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <button type="button" onClick={() => setShowCurrent((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">New password</span>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <button type="button" onClick={() => setShowNew((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Confirm new password</span>
            <input
              type={showNew ? 'text' : 'password'}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </label>
        </div>
        {newPw && newPw.length < 8 && <p className="mt-2 text-xs text-amber-700">Password must be at least 8 characters.</p>}
        {newPw && confirmPw && newPw !== confirmPw && <p className="mt-2 text-xs text-amber-700">Passwords do not match.</p>}
        <div className="mt-5 flex justify-end">
          <button
            onClick={changePassword}
            disabled={changingPw || !currentPw || newPw.length < 8 || newPw !== confirmPw}
            className="inline-flex min-w-[150px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
          >
            {changingPw ? <><Spinner size="sm" color="white" /> Updating…</> : <><KeyRound className="h-4 w-4" /> Change password</>}
          </button>
        </div>
      </section>

      {/* Session */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Session</h2>
        <p className="mt-1 text-sm text-gray-500">Sign out of this browser.</p>
        <button
          onClick={() => logout()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" /> Log out
        </button>
      </section>
    </div>
  );
}
