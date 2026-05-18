'use client';

import { useState } from 'react';
import { Send, Users, Building, Calendar, Settings } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from '@/stores/toastStore';

type Target = 'long-term' | 'short-term' | 'all';

const stats = { longTermProperties: 24, shortTermProperties: 18, totalProperties: 42 };

function badgeColor(t: Target) {
  if (t === 'long-term') return 'bg-blue-100 text-blue-800';
  if (t === 'short-term') return 'bg-green-100 text-green-800';
  return 'bg-purple-100 text-purple-800';
}

export default function MessagesPage() {
  const [selectedTarget, setSelectedTarget] = useState<Target>('all');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  const recipientCount = selectedTarget === 'long-term' ? stats.longTermProperties : selectedTarget === 'short-term' ? stats.shortTermProperties : stats.totalProperties;
  const targetLabel = selectedTarget === 'long-term' ? 'long-term rental' : selectedTarget === 'short-term' ? 'short-term rental' : 'all rental';

  async function sendMessage() {
    if (!subject.trim() || !content.trim()) {
      toast.error('Please fill in both subject and message content');
      return;
    }
    setSending(true);
    try {
      await new Promise((r) => setTimeout(r, 2000));
      setSubject('');
      setContent('');
      toast.success('Example message sent successfully! (Not actually sent)');
    } catch {
      toast.error('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <Building className="h-5 w-5 text-blue-600" />
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.longTermProperties}</div>
            <div className="text-sm font-medium text-gray-500">Long-term</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <Calendar className="h-5 w-5 text-green-600" />
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.shortTermProperties}</div>
            <div className="text-sm font-medium text-gray-500">Short-term</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <Users className="h-5 w-5 text-purple-600" />
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalProperties}</div>
            <div className="text-sm font-medium text-gray-500">Total Properties</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-gray-700">
          <Settings className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Message Target</h2>
        </div>
        <div className="flex flex-col gap-3">
          {([
            { id: 'long-term' as Target, icon: <Building className="h-6 w-6 text-blue-600" />, bg: 'bg-blue-100', title: 'Long-term Rentals', sub: `${stats.longTermProperties} properties · Traditional leases`, badge: 'Doorloop' },
            { id: 'short-term' as Target, icon: <Calendar className="h-6 w-6 text-green-600" />, bg: 'bg-green-100', title: 'Short-term Rentals', sub: `${stats.shortTermProperties} properties · Airbnb & short stays`, badge: 'Guesty' },
            { id: 'all' as Target, icon: <Users className="h-6 w-6 text-purple-600" />, bg: 'bg-purple-100', title: 'All Rentals', sub: `${stats.totalProperties} properties · Complete portfolio`, badge: 'Combined' },
          ] as { id: Target; icon: React.ReactNode; bg: string; title: string; sub: string; badge: string }[]).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSelectedTarget(opt.id)}
              className={`flex items-center gap-4 rounded-xl border-2 p-5 text-left transition-all ${selectedTarget === opt.id ? 'border-blue-500 bg-slate-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'}`}
            >
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${opt.bg}`}>{opt.icon}</div>
              <div className="flex-1">
                <div className="text-lg font-semibold text-gray-900">{opt.title}</div>
                <div className="text-sm text-gray-500">{opt.sub}</div>
              </div>
              <span className={`rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide ${badgeColor(opt.id)}`}>{opt.badge}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-gray-700">
          <Send className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Compose Message</h2>
          <span className="ml-auto rounded-lg bg-gray-100 px-3 py-1 text-sm font-medium text-gray-500">
            To: {recipientCount} {targetLabel} properties
          </span>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="subject" className="text-sm font-semibold text-gray-700">Subject</label>
            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter message subject..."
              disabled={sending}
              className="rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="msg-content" className="text-sm font-semibold text-gray-700">Message Content</label>
            <textarea
              id="msg-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your message content here..."
              rows={8}
              disabled={sending}
              className="resize-y rounded-lg border border-gray-300 px-4 py-3 text-base font-inherit focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={sendMessage}
              disabled={sending || !subject.trim() || !content.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-700 px-8 py-3 text-base font-semibold text-white transition-all hover:-translate-y-px hover:shadow-lg disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:shadow-none disabled:from-gray-400 disabled:to-gray-400"
            >
              {sending ? <><Spinner size="sm" color="white" /> Sending...</> : <><Send className="h-4 w-4" /> Send Message</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
