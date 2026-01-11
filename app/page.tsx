'use client';

import { useEffect, useState } from 'react';

interface ScrapingResult {
  name: string;
  type: string;
  location: string;
  daysOutUntilAppointment: number;
}

interface Analytics {
  success: boolean;
  currentStats: { totalLinks: number; avgWait: number; immediate: number };
  dailyChanges: { name: string; type: string; change: number; current: number }[];
  weeklyChanges: { name: string; type: string; change: number }[];
  trendData: { date: string; avgWait: number; hrtAvg: number; trtAvg: number }[];
  bestStates: { name: string; daysOut: number }[];
  worstStates: { name: string; daysOut: number }[];
  regionalStats: { region: string; avgWait: number; count: number }[];
  daysAnalyzed: number;
}

export default function Home() {
  const [data, setData] = useState<ScrapingResult[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'summary' | 'hrt' | 'trt' | 'providers'>('summary');
  const [selectedDate, setSelectedDate] = useState('latest');
  const [dates, setDates] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/data').then(r => r.json()),
      fetch('/api/analytics').then(r => r.json())
    ]).then(([dataRes, analyticsRes]) => {
      if (dataRes.success) setData(dataRes.data);
      if (analyticsRes.success) {
        setAnalytics(analyticsRes);
        if (analyticsRes.trendData) {
          setDates(analyticsRes.trendData.map((t: any) => t.date));
        }
      }
    }).finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const timestamp = now.toLocaleString('en-US', { 
    weekday: 'long',
    month: 'long', 
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  const filtered = view === 'summary' ? data : 
    data.filter(d => view === 'hrt' ? d.type === 'HRT' : 
                     view === 'trt' ? d.type === 'TRT' : 
                     d.type === 'Provider');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--muted)]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Masthead */}
      <header className="border-b-2 border-[var(--text)]">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)] mb-2">
              Fountain Health Services
            </div>
            <h1 className="font-serif text-4xl font-semibold tracking-tight">
              Availability Report
            </h1>
            <div className="text-[11px] text-[var(--muted)] mt-2 tracking-wide">
              {timestamp}
            </div>
          </div>
        </div>
      </header>

      {/* Ticker */}
      <div className="border-b border-[var(--border)] bg-[#f4f3f0]">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-8 text-[12px]">
          <span className="font-semibold">TODAY</span>
          <span>{data.length} links tracked</span>
          <span>Avg wait: {analytics?.currentStats.avgWait.toFixed(1)}d</span>
          <span>{analytics?.currentStats.immediate} immediate</span>
          <a 
            href="https://docs.google.com/spreadsheets/d/1vOXJEegJHJizatcXErv_dOLuWCiz_z8fGZasSDde2tc/edit"
            target="_blank"
            className="ml-auto text-[var(--accent)] hover:underline"
          >
            Full Data →
          </a>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Lead Story */}
        <div className="grid grid-cols-12 gap-8 mb-12">
          <div className="col-span-8">
            <div className="text-[11px] uppercase tracking-wider text-[var(--accent)] font-semibold mb-2">
              Quick View
            </div>
            <h2 className="font-serif text-2xl mb-4">Shortest Wait Times</h2>
            <div className="space-y-1">
              {analytics?.bestStates.slice(0, 8).map((s, i) => (
                <div key={i} className="flex justify-between py-2 border-b border-[var(--border)]">
                  <span>{s.name}</span>
                  <span className="tabular-nums font-medium">{s.daysOut}d</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="col-span-4 border-l border-[var(--border)] pl-8">
            <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-2">
              Longest Wait
            </div>
            <div className="space-y-1">
              {analytics?.worstStates.slice(0, 5).map((s, i) => (
                <div key={i} className="flex justify-between py-2 border-b border-[var(--border)] text-[13px]">
                  <span className="text-[var(--muted)]">{s.name}</span>
                  <span className="tabular-nums">{s.daysOut}d</span>
                </div>
              ))}
            </div>

            {analytics && analytics.regionalStats.length > 0 && (
              <div className="mt-8">
                <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-2">
                  By Region
                </div>
                {analytics.regionalStats.map((r, i) => (
                  <div key={i} className="flex justify-between py-1 text-[13px]">
                    <span className="text-[var(--muted)]">{r.region}</span>
                    <span className="tabular-nums">{r.avgWait.toFixed(1)}d</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Daily Changes */}
        {analytics && analytics.dailyChanges.length > 0 && (
          <div className="mb-12 border-t-2 border-[var(--text)] pt-6">
            <h2 className="font-serif text-xl mb-4">Changes Since Yesterday</h2>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-teal-700 font-semibold mb-2">
                  Improved
                </div>
                {analytics.dailyChanges.filter(c => c.change < 0).slice(0, 6).map((c, i) => (
                  <div key={i} className="flex justify-between py-1 text-[13px] border-b border-[var(--border)]">
                    <span>{c.name}</span>
                    <span className="text-teal-700 tabular-nums">{c.change}d</span>
                  </div>
                ))}
                {analytics.dailyChanges.filter(c => c.change < 0).length === 0 && (
                  <div className="text-[var(--muted)] text-[13px]">None today</div>
                )}
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[var(--accent)] font-semibold mb-2">
                  Longer Wait
                </div>
                {analytics.dailyChanges.filter(c => c.change > 0).slice(0, 6).map((c, i) => (
                  <div key={i} className="flex justify-between py-1 text-[13px] border-b border-[var(--border)]">
                    <span>{c.name}</span>
                    <span className="text-[var(--accent)] tabular-nums">+{c.change}d</span>
                  </div>
                ))}
                {analytics.dailyChanges.filter(c => c.change > 0).length === 0 && (
                  <div className="text-[var(--muted)] text-[13px]">None today</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Full Listing */}
        <div className="border-t-2 border-[var(--text)] pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl">Complete Listing</h2>
            <div className="flex gap-1 text-[12px]">
              {(['summary', 'hrt', 'trt', 'providers'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1 border ${
                    view === v 
                      ? 'bg-[var(--text)] text-[var(--bg)] border-[var(--text)]' 
                      : 'border-[var(--border)] hover:border-[var(--text)]'
                  }`}
                >
                  {v === 'summary' ? 'All' : v.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b-2 border-[var(--text)] text-left">
                <th className="py-2 font-semibold">Name</th>
                <th className="py-2 font-semibold w-20">Type</th>
                <th className="py-2 font-semibold">Location</th>
                <th className="py-2 font-semibold text-right w-16">Wait</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr key={i} className="border-b border-[var(--border)] hover:bg-[#f4f3f0]">
                  <td className="py-2">{item.name}</td>
                  <td className="py-2 text-[var(--muted)]">{item.type}</td>
                  <td className="py-2 text-[var(--muted)]">{item.location || '—'}</td>
                  <td className={`py-2 text-right tabular-nums font-medium ${
                    item.daysOutUntilAppointment <= 2 ? 'text-teal-700' :
                    item.daysOutUntilAppointment >= 7 ? 'text-[var(--accent)]' : ''
                  }`}>
                    {item.daysOutUntilAppointment >= 0 ? `${item.daysOutUntilAppointment}d` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[12px] text-[var(--muted)] mt-4">
            Showing {filtered.length} of {data.length} entries
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-[var(--text)] mt-12">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex justify-between items-center text-[12px]">
            <div className="text-[var(--muted)]">
              Updated daily at 5:00 AM ET
            </div>
            <div className="flex gap-6">
              <a 
                href="mailto:daniel@fountain.net?subject=Dashboard%20Feedback"
                className="text-[var(--muted)] hover:text-[var(--text)]"
              >
                Send Feedback
              </a>
              <a 
                href="https://docs.google.com/spreadsheets/d/1vOXJEegJHJizatcXErv_dOLuWCiz_z8fGZasSDde2tc/edit"
                target="_blank"
                className="text-[var(--muted)] hover:text-[var(--text)]"
              >
                Source Data
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
