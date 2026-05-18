'use client';

import { useEffect, useState } from 'react';
import {
  UserCog, Plus, Trash2, Save, X, Search, Users as UsersIcon,
  Shield, Copy, Check, Eye, EyeOff, RefreshCw, Mail, MoreHorizontal,
  KeyRound, UserCheck, UserX, AlertTriangle
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { Dropdown } from '@/components/ui/Dropdown';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type Role = 'owner' | 'investor' | 'operator';
type UserRow = {
  id: string; email: string; full_name: string; role: Role;
  is_active: boolean; avatar_url?: string | null;
  created_at: string; last_sign_in_at?: string | null;
};

function timeAgo(iso: string) {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return d.toLocaleDateString();
  } catch { return ''; }
}

function initials(u: UserRow) {
  const base = (u.full_name || u.email || '').trim();
  const parts = base.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (base[0] || '?').toUpperCase();
}

function roleBadgeClass(r: Role) {
  if (r === 'owner') return 'bg-purple-50 text-purple-700 border-purple-200';
  if (r === 'investor') return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
  let pw = '';
  for (let i = 0; i < 14; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

export default function AdminUsersPage() {
  const { token } = useAuthStore();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState(new Set<string>());
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ email: '', full_name: '', role: 'investor' as Role, temp_password: '' });
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);

  const [confirmDeleteUser, setConfirmDeleteUser] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [roleTarget, setRoleTarget] = useState<UserRow | null>(null);
  const [roleDraft, setRoleDraft] = useState<Role>('investor');
  const [roleSaving, setRoleSaving] = useState(false);

  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetVisible, setResetVisible] = useState(false);
  const [resetCopied, setResetCopied] = useState(false);
  const [resetSaving, setResetSaving] = useState(false);

  const authHeader = () => ({ Authorization: `Bearer ${token}` });

  const setBusy = (id: string, busy: boolean) =>
    setBusyIds((prev) => { const next = new Set(prev); busy ? next.add(id) : next.delete(id); return next; });

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/users`, { headers: authHeader() });
      if (!res.ok) throw new Error(`Failed to load users (${res.status})`);
      const data = await res.json();
      setUsers(data.users || []);
    } catch (e: unknown) {
      if (!silent) toast.error(e instanceof Error ? e.message : 'Failed to load users');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function updateField(id: string, patch: Partial<UserRow>, successMsg: string) {
    setBusy(id, true);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Update failed (${res.status})`); }
      await load(true);
      toast.success(successMsg);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Update failed'); } finally { setBusy(id, false); }
  }

  async function toggleActive(u: UserRow) {
    await updateField(u.id, { is_active: !u.is_active },
      u.is_active ? `${u.full_name || u.email} deactivated` : `${u.full_name || u.email} reactivated`);
  }

  async function submitRoleChange() {
    if (!roleTarget) return;
    if (roleDraft === roleTarget.role) { setRoleTarget(null); return; }
    setRoleSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${roleTarget.id}`, {
        method: 'PATCH',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: roleDraft })
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Update failed (${res.status})`); }
      await load(true);
      toast.success(`${roleTarget.full_name || roleTarget.email} is now ${roleDraft}`);
      setRoleTarget(null);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed to change role'); } finally { setRoleSaving(false); }
  }

  async function submitReset() {
    if (!resetTarget) return;
    if (resetPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setResetSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${resetTarget.id}/reset-password`, {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: resetPassword })
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Reset failed (${res.status})`); }
      toast.success(`Password reset for ${resetTarget.full_name || resetTarget.email}`);
      setResetTarget(null); setResetPassword('');
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed to reset password'); } finally { setResetSaving(false); }
  }

  async function hardDelete(u: UserRow) {
    setDeleting(true); setBusy(u.id, true);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${u.id}?hard=true`, { method: 'DELETE', headers: authHeader() });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Delete failed (${res.status})`); }
      setConfirmDeleteUser(null);
      await load(true);
      toast.success(`${u.full_name || u.email} permanently deleted`);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Delete failed'); } finally { setDeleting(false); setBusy(u.id, false); }
  }

  async function submitAdd() {
    setAddError(null);
    if (!form.email || !form.full_name || !form.temp_password) { setAddError('All fields are required'); return; }
    setAdding(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/users`, {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Create failed (${res.status})`); }
      await load(true);
      toast.success(`${form.full_name} added as ${form.role}`);
      setShowAdd(false);
      setForm({ email: '', full_name: '', role: 'investor', temp_password: '' });
    } catch (e: unknown) { setAddError(e instanceof Error ? e.message : 'Create failed'); } finally { setAdding(false); }
  }

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesQ = !q || u.email.toLowerCase().includes(q) || (u.full_name || '').toLowerCase().includes(q);
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesQ && matchesRole;
  });

  const counts = {
    total: users.length,
    owners: users.filter((u) => u.role === 'owner').length,
    investors: users.filter((u) => u.role === 'investor').length,
    operators: users.filter((u) => u.role === 'operator').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-50">
            <UserCog className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Users &amp; Roles</h1>
            <p className="text-sm text-gray-500">Create users, assign roles, and manage access.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={() => { setForm({ email: '', full_name: '', role: 'investor', temp_password: '' }); setAddError(null); setPasswordVisible(false); setPasswordCopied(false); setShowAdd(true); }} className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700">
            <Plus className="h-4 w-4" /> Add user
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Total users', value: counts.total, tint: 'bg-gray-100 text-gray-700' },
          { label: 'Owners', value: counts.owners, tint: 'bg-purple-50 text-purple-700' },
          { label: 'Investors', value: counts.investors, tint: 'bg-blue-50 text-blue-700' },
          { label: 'Operators', value: counts.operators, tint: 'bg-amber-50 text-amber-700' }
        ].map((card) => (
          <div key={card.label} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.tint}`}>
              <UsersIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">{card.label}</div>
              {loading ? <Skeleton height="1.5rem" width="2rem" /> : <div className="text-xl font-semibold text-gray-900">{card.value}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {(['all', 'owner', 'investor', 'operator'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${roleFilter === r ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last login</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><Skeleton height="2.25rem" width="2.25rem" rounded="full" /><div className="flex flex-col gap-1"><Skeleton height="0.9rem" width="10rem" /><Skeleton height="0.75rem" width="12rem" /></div></div></td>
                  <td className="px-4 py-3"><Skeleton height="1.5rem" width="5rem" rounded="full" /></td>
                  <td className="px-4 py-3"><Skeleton height="1.25rem" width="4rem" rounded="full" /></td>
                  <td className="px-4 py-3"><Skeleton height="0.9rem" width="5rem" /></td>
                  <td className="px-4 py-3"><Skeleton height="0.9rem" width="4rem" /></td>
                  <td className="px-4 py-3"><div className="flex justify-end"><Skeleton height="1.75rem" width="2rem" /></div></td>
                </tr>
              ))
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center">
                  <div className="mx-auto flex max-w-xs flex-col items-center gap-2">
                    <UsersIcon className="h-10 w-10 text-gray-300" />
                    <p className="font-medium text-gray-700">No users match</p>
                    <p className="text-xs text-gray-500">Try adjusting your search or filter.</p>
                    {(searchQuery || roleFilter !== 'all') && (
                      <button onClick={() => { setSearchQuery(''); setRoleFilter('all'); }} className="mt-2 text-xs font-medium text-teal-600 hover:text-teal-700">
                        Clear filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.id} className={`transition hover:bg-gray-50/60 ${!u.is_active ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt={u.full_name || u.email} className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-gray-100" />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-xs font-medium text-white">
                          {initials(u)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-medium text-gray-900">{u.full_name || '—'}</div>
                        <div className="flex items-center gap-1 text-xs text-gray-500"><Mail className="h-3 w-3" /><span className="truncate">{u.email}</span></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${roleBadgeClass(u.role)}`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    {u.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700"><span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Active</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"><span className="h-1.5 w-1.5 rounded-full bg-gray-400" /> Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{u.last_sign_in_at ? timeAgo(u.last_sign_in_at) : <span className="italic text-gray-400">Never</span>}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{timeAgo(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end">
                      <Dropdown
                        align="right"
                        trigger={
                          <button disabled={busyIds.has(u.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50">
                            {busyIds.has(u.id) ? <Spinner size="xs" /> : <MoreHorizontal className="h-4 w-4" />}
                          </button>
                        }
                      >
                        <button onClick={() => { setRoleTarget(u); setRoleDraft(u.role); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"><Shield className="h-4 w-4 text-gray-400" /> Change role</button>
                        <button onClick={() => { setResetTarget(u); setResetPassword(''); setResetVisible(false); setResetCopied(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"><KeyRound className="h-4 w-4 text-gray-400" /> Reset password</button>
                        <div className="my-1 border-t border-gray-100" />
                        <button onClick={() => toggleActive(u)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                          {u.is_active ? <><UserX className="h-4 w-4 text-gray-400" /> Deactivate</> : <><UserCheck className="h-4 w-4 text-gray-400" /> Reactivate</>}
                        </button>
                        <button onClick={() => setConfirmDeleteUser(u)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete permanently</button>
                      </Dropdown>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && filteredUsers.length > 0 && (
        <p className="text-xs text-gray-500">Showing {filteredUsers.length} of {users.length} {users.length === 1 ? 'user' : 'users'}</p>
      )}

      {/* Add user modal */}
      {showAdd && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4" onClick={() => setShowAdd(false)}>
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-50"><Plus className="h-4 w-4 text-teal-600" /></div><h3 className="text-lg font-semibold text-gray-900">Add user</h3></div>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close"><X className="h-5 w-5" /></button>
            </header>
            <div className="space-y-4 px-5 py-5">
              <label className="block text-sm"><span className="mb-1 block font-medium text-gray-700">Full name</span>
                <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Jane Doe" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
              </label>
              <label className="block text-sm"><span className="mb-1 block font-medium text-gray-700">Email</span>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@example.com" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
              </label>
              <div>
                <span className="mb-1 block text-sm font-medium text-gray-700">Role</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['owner', 'investor', 'operator'] as const).map((r) => (
                    <button key={r} type="button" onClick={() => setForm({ ...form, role: r })} className={`rounded-lg border px-3 py-2 text-xs font-medium capitalize transition ${form.role === r ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{r}</button>
                  ))}
                </div>
              </div>
              <div>
                <span className="mb-1 block text-sm font-medium text-gray-700">Temporary password</span>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input type={passwordVisible ? 'text' : 'password'} value={form.temp_password} onChange={(e) => setForm({ ...form, temp_password: e.target.value })} placeholder="Share with the user manually" className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 font-mono text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
                    <button type="button" onClick={() => setPasswordVisible((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <button type="button" onClick={() => { setForm({ ...form, temp_password: generatePassword() }); setPasswordCopied(false); }} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"><RefreshCw className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={async () => { if (!form.temp_password) return; await navigator.clipboard.writeText(form.temp_password); setPasswordCopied(true); toast.info('Password copied'); setTimeout(() => setPasswordCopied(false), 2000); }} disabled={!form.temp_password} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                    {passwordCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">Share manually via Slack or email. User can change this after first login.</p>
              </div>
              {addError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{addError}</div>}
            </div>
            <footer className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
              <button onClick={() => setShowAdd(false)} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={submitAdd} disabled={adding} className="inline-flex min-w-[110px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-70">
                {adding ? <><Spinner size="sm" color="white" /> Creating…</> : <><Save className="h-4 w-4" /> Create user</>}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Change role modal */}
      {roleTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4" onClick={() => setRoleTarget(null)}>
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-50"><Shield className="h-4 w-4 text-teal-600" /></div><h3 className="text-lg font-semibold text-gray-900">Change role</h3></div>
              <button onClick={() => setRoleTarget(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </header>
            <div className="space-y-4 px-5 py-5">
              <p className="text-sm text-gray-600">Updating role for <span className="font-medium text-gray-900">{roleTarget.full_name || roleTarget.email}</span>.</p>
              <div className="grid grid-cols-3 gap-2">
                {(['owner', 'investor', 'operator'] as const).map((r) => (
                  <button key={r} type="button" onClick={() => setRoleDraft(r)} className={`rounded-lg border px-3 py-2 text-xs font-medium capitalize transition ${roleDraft === r ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{r}</button>
                ))}
              </div>
              {(roleTarget.role === 'owner' || roleDraft === 'owner') && roleDraft !== roleTarget.role && (
                <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{roleDraft === 'owner' ? 'Granting owner gives full app access including user management. Double-check.' : 'Removing owner revokes admin access. Make sure at least one other owner exists.'}</span>
                </div>
              )}
            </div>
            <footer className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
              <button onClick={() => setRoleTarget(null)} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={submitRoleChange} disabled={roleSaving || roleDraft === roleTarget.role} className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60">
                {roleSaving ? <><Spinner size="sm" color="white" /> Saving…</> : <><Save className="h-4 w-4" /> Save</>}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4" onClick={() => setResetTarget(null)}>
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50"><KeyRound className="h-4 w-4 text-amber-600" /></div><h3 className="text-lg font-semibold text-gray-900">Reset password</h3></div>
              <button onClick={() => setResetTarget(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </header>
            <div className="space-y-4 px-5 py-5">
              <p className="text-sm text-gray-600">Set a new password for <span className="font-medium text-gray-900">{resetTarget.full_name || resetTarget.email}</span>.</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input type={resetVisible ? 'text' : 'password'} value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="New password (min 8 chars)" className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 font-mono text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
                  <button type="button" onClick={() => setResetVisible((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {resetVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <button type="button" onClick={() => { setResetPassword(generatePassword()); setResetCopied(false); }} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"><RefreshCw className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={async () => { if (!resetPassword) return; await navigator.clipboard.writeText(resetPassword); setResetCopied(true); toast.info('Password copied'); setTimeout(() => setResetCopied(false), 2000); }} disabled={!resetPassword} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  {resetCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              {resetPassword && resetPassword.length < 8 && <p className="text-xs text-amber-700">Must be at least 8 characters.</p>}
            </div>
            <footer className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
              <button onClick={() => setResetTarget(null)} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={submitReset} disabled={resetSaving || resetPassword.length < 8} className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60">
                {resetSaving ? <><Spinner size="sm" color="white" /> Resetting…</> : <><KeyRound className="h-4 w-4" /> Reset password</>}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDeleteUser && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4" onClick={() => setConfirmDeleteUser(null)}>
          <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50"><Trash2 className="h-5 w-5 text-red-600" /></div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Permanently delete user?</h3>
                  <p className="mt-1 text-sm text-gray-600"><span className="font-medium text-gray-800">{confirmDeleteUser.full_name || confirmDeleteUser.email}</span> will be removed from Supabase Auth. This cannot be undone.</p>
                  <p className="mt-2 text-xs text-gray-500">If you only want to revoke access, use <strong>Deactivate</strong> instead.</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
              <button onClick={() => setConfirmDeleteUser(null)} disabled={deleting} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={() => hardDelete(confirmDeleteUser)} disabled={deleting} className="inline-flex min-w-[150px] items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-70">
                {deleting ? <><Spinner size="sm" color="white" /> Deleting…</> : <><Trash2 className="h-4 w-4" /> Delete permanently</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
