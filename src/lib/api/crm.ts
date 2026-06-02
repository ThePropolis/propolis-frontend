import { PUBLIC_API_URL } from '$env/static/public';
import { auth } from './auth';
import { get } from 'svelte/store';

function headers() {
  const token = get(auth).token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export async function getSourcePlatforms() {
  const r = await fetch(`${PUBLIC_API_URL}/api/crm/source-platforms`, { headers: headers() });
  if (!r.ok) throw new Error('Failed to load source platforms');
  return r.json();
}

export async function getLifecycleStatuses(businessLine?: string) {
  const url = businessLine
    ? `${PUBLIC_API_URL}/api/crm/lifecycle-statuses?business_line=${businessLine}`
    : `${PUBLIC_API_URL}/api/crm/lifecycle-statuses`;
  const r = await fetch(url, { headers: headers() });
  if (!r.ok) throw new Error('Failed to load lifecycle statuses');
  return r.json();
}

export async function getLeads(params: { business_line?: string; limit?: number } = {}) {
  const q = new URLSearchParams();
  if (params.business_line) q.set('business_line', params.business_line);
  if (params.limit) q.set('limit', String(params.limit));
  const r = await fetch(`${PUBLIC_API_URL}/api/crm/leads?${q}`, { headers: headers() });
  if (!r.ok) throw new Error('Failed to load leads');
  return r.json();
}

export async function getLead(id: string) {
  const r = await fetch(`${PUBLIC_API_URL}/api/crm/leads/${id}`, { headers: headers() });
  if (!r.ok) throw new Error('Failed to load lead');
  return r.json();
}

export async function updateLeadStatus(leadId: string, lifecycleStatusId: string, notes?: string) {
  const r = await fetch(`${PUBLIC_API_URL}/api/crm/leads/${leadId}/status`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ lifecycle_status_id: lifecycleStatusId, notes })
  });
  if (!r.ok) throw new Error('Failed to update lead status');
  return r.json();
}

export async function getSyncLog() {
  const r = await fetch(`${PUBLIC_API_URL}/api/crm/sync-log`, { headers: headers() });
  if (!r.ok) throw new Error('Failed to load sync log');
  return r.json();
}
