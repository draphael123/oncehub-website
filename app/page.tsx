'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';

// Settings interface
interface Settings {
  darkMode: boolean;
  defaultView: 'summary' | 'hrt' | 'trt' | 'providers';
  showRegions: boolean;
  compactMode: boolean;
  autoRefresh: boolean;
  refreshInterval: number; // minutes
}

interface ScrapingResult {
  name: string;
  type: string;
  location: string;
  daysOutUntilAppointment: number;
  scrapedAt?: string;
}

interface TrendPoint {
  date: string;
  avgWait: number;
  hrtAvg: number;
  trtAvg: number;
}

interface Analytics {
  success: boolean;
  currentStats: { totalLinks: number; avgWait: number; immediate: number };
  dailyChanges: { name: string; type: string; change: number; current: number }[];
  weeklyChanges: { name: string; type: string; change: number }[];
  trendData: TrendPoint[];
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
  const [search, setSearch] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [compareDate1, setCompareDate1] = useState('');
  const [compareDate2, setCompareDate2] = useState('');
  const [compareData, setCompareData] = useState<{date1: ScrapingResult[], date2: ScrapingResult[]} | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showEmailSignup, setShowEmailSignup] = useState(false);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [quickViewMode, setQuickViewMode] = useState<'shortest' | 'longest'>('shortest');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    darkMode: false,
    defaultView: 'summary',
    showRegions: true,
    compactMode: false,
    autoRefresh: false,
    refreshInterval: 5,
  });

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('fountain-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings(prev => ({ ...prev, ...parsed }));
        if (parsed.defaultView) setView(parsed.defaultView);
      } catch (e) {
        console.error('Failed to load settings');
      }
    }
  }, []);

  // Save settings to localStorage
  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('fountain-settings', JSON.stringify(updated));
      return updated;
    });
  };

  // Apply dark mode to document
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode]);

  // Auto-refresh
  useEffect(() => {
    if (!settings.autoRefresh) return;
    const interval = setInterval(() => {
      window.location.reload();
    }, settings.refreshInterval * 60 * 1000);
    return () => clearInterval(interval);
  }, [settings.autoRefresh, settings.refreshInterval]);

  // Available dates from API
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      
      if (e.key === '/') {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      }
      if (e.key === 'Escape') {
        setSearch('');
        setSelectedState(null);
        setCompareMode(false);
        (document.activeElement as HTMLElement)?.blur();
      }
      if (e.key === 'p' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/api/data').then(r => r.json()),
      fetch('/api/analytics').then(r => r.json()),
      fetch('/api/dates').then(r => r.json())
    ]).then(([dataRes, analyticsRes, datesRes]) => {
      if (dataRes.success) {
        setData(dataRes.data);
        setLastUpdated(new Date(dataRes.lastUpdated));
      }
      if (analyticsRes.success) {
        setAnalytics(analyticsRes);
      }
      if (datesRes.success && datesRes.dates) {
        setAvailableDates(datesRes.dates);
      }
    }).finally(() => setLoading(false));
  }, []);

  // Compare dates
  const fetchCompareData = useCallback(async () => {
    if (!compareDate1 || !compareDate2) return;
    try {
      const [res1, res2] = await Promise.all([
        fetch(`/api/data?date=${compareDate1}`).then(r => r.json()),
        fetch(`/api/data?date=${compareDate2}`).then(r => r.json())
      ]);
      setCompareData({
        date1: res1.success ? res1.data : [],
        date2: res2.success ? res2.data : []
      });
    } catch (e) {
      console.error('Compare fetch error:', e);
    }
  }, [compareDate1, compareDate2]);

  useEffect(() => {
    if (compareMode && compareDate1 && compareDate2) {
      fetchCompareData();
    }
  }, [compareMode, compareDate1, compareDate2, fetchCompareData]);

  // Filter data
  const filtered = useMemo(() => {
    let result = view === 'summary' ? data : 
      data.filter(d => view === 'hrt' ? d.type === 'HRT' : 
                       view === 'trt' ? d.type === 'TRT' : 
                       d.type === 'Provider');
    
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(d => 
        d.name.toLowerCase().includes(s) || 
        d.location?.toLowerCase().includes(s)
      );
    }
    return result;
  }, [data, view, search]);

  // Get trend for a specific item
  const getSparkline = (name: string): number[] => {
    // This would need historical data per item - simplified for now
    return [];
  };

  // Export to CSV
  const exportCSV = () => {
    const headers = ['Name', 'Type', 'Location', 'Days Out'];
    const rows = filtered.map(d => [
      d.name,
      d.type,
      d.location || '',
      d.daysOutUntilAppointment >= 0 ? d.daysOutUntilAppointment.toString() : 'N/A'
    ]);
    
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fountain-availability-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Format last update time
  const getLastUpdated = () => {
    if (!lastUpdated || isNaN(lastUpdated.getTime())) return '';
    return lastUpdated.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const timestamp = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--muted)]">Loading...</div>
      </div>
    );
  }

  // State detail view
  if (selectedState) {
    const stateData = data.find(d => d.name === selectedState);
    const stateChanges = analytics?.dailyChanges.filter(c => c.name === selectedState) || [];
    
    return (
      <div className="min-h-screen">
        <header className="border-b border-[var(--border)] print:hidden">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <button 
              onClick={() => setSelectedState(null)}
              className="text-[var(--accent)] hover:underline text-sm"
            >
              ← Back to all
            </button>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">
          <h1 className="font-serif text-3xl mb-2">{selectedState}</h1>
          <div className="text-[var(--muted)] mb-8">{stateData?.type}</div>
          
          <div className="grid grid-cols-3 gap-8 mb-8">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] mb-1">Current Wait</div>
              <div className="text-4xl font-semibold tabular-nums">
                {stateData?.daysOutUntilAppointment ?? '—'}
                <span className="text-lg text-[var(--muted)]">d</span>
              </div>
            </div>
          </div>

          {analytics?.trendData && analytics.trendData.length > 0 && (
            <div className="border-t border-[var(--border)] pt-6">
              <h2 className="font-serif text-xl mb-4">7-Day Trend</h2>
              <div className="h-32 flex items-end gap-2">
                {analytics.trendData.map((point, i) => {
                  const max = Math.max(...analytics.trendData.map(p => p.avgWait), 1);
                  const height = (point.avgWait / max) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-[var(--muted)]">{point.avgWait.toFixed(1)}</span>
                      <div 
                        className="w-full bg-[var(--text)]"
                        style={{ height: `${Math.max(height, 5)}%` }}
                      />
                      <span className="text-[10px] text-[var(--muted)]">
                        {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // Compare view
  if (compareMode) {
    return (
      <div className="min-h-screen">
        <header className="border-b border-[var(--border)] print:hidden">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <button 
              onClick={() => setCompareMode(false)}
              className="text-[var(--accent)] hover:underline text-sm"
            >
              ← Back
            </button>
            <div className="flex items-center gap-4">
              <select 
                value={compareDate1}
                onChange={(e) => setCompareDate1(e.target.value)}
                className="border border-[var(--border)] px-3 py-1 text-sm bg-transparent"
              >
                <option value="">Select date 1</option>
                {availableDates.map(d => (
                  <option key={d} value={d}>{new Date(d).toLocaleDateString()}</option>
                ))}
              </select>
              <span className="text-[var(--muted)]">vs</span>
              <select 
                value={compareDate2}
                onChange={(e) => setCompareDate2(e.target.value)}
                className="border border-[var(--border)] px-3 py-1 text-sm bg-transparent"
              >
                <option value="">Select date 2</option>
                {availableDates.map(d => (
                  <option key={d} value={d}>{new Date(d).toLocaleDateString()}</option>
                ))}
              </select>
            </div>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">
          <h1 className="font-serif text-2xl mb-6">Compare Dates</h1>
          {compareData && (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b-2 border-[var(--text)]">
                  <th className="py-2 text-left">Name</th>
                  <th className="py-2 text-right">{compareDate1 ? new Date(compareDate1).toLocaleDateString() : 'Date 1'}</th>
                  <th className="py-2 text-right">{compareDate2 ? new Date(compareDate2).toLocaleDateString() : 'Date 2'}</th>
                  <th className="py-2 text-right">Change</th>
                </tr>
              </thead>
              <tbody>
                {compareData.date1.map((item, i) => {
                  const item2 = compareData.date2.find(d => d.name === item.name);
                  const change = item2 ? item.daysOutUntilAppointment - item2.daysOutUntilAppointment : null;
                  return (
                    <tr key={i} className="border-b border-[var(--border)]">
                      <td className="py-2">{item.name}</td>
                      <td className="py-2 text-right tabular-nums">{item.daysOutUntilAppointment}d</td>
                      <td className="py-2 text-right tabular-nums">{item2?.daysOutUntilAppointment ?? '—'}d</td>
                      <td className={`py-2 text-right tabular-nums ${
                        change && change < 0 ? 'text-teal-700' : 
                        change && change > 0 ? 'text-[var(--accent)]' : ''
                      }`}>
                        {change !== null ? (change > 0 ? '+' : '') + change + 'd' : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Masthead */}
      <header className="border-b-2 border-[var(--text)] print:border-b bg-gradient-to-b from-white to-[var(--bg)]">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--teal)] font-semibold mb-2">
              Fountain Health Services
            </div>
            <h1 className="font-serif text-4xl font-semibold tracking-tight">
              Availability Report
            </h1>
            <div className="text-[11px] text-[var(--muted)] mt-2 tracking-wide flex items-center justify-center gap-3">
              <span>{timestamp}</span>
              {lastUpdated && !isNaN(lastUpdated.getTime()) && (
                <span className="bg-[#e8e6e1] px-2 py-0.5 rounded text-[10px]">
                  Data from {getLastUpdated()}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="border-b border-[var(--border)] bg-[#f4f3f0] print:hidden">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-6 text-[12px]">
          {/* Search */}
          <div className="relative">
            <input
              id="search-input"
              type="text"
              placeholder="Search... (press /)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-[var(--border)] px-3 py-1.5 w-48 bg-white text-sm focus:outline-none focus:border-[var(--text)]"
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)]"
              >
                ×
              </button>
            )}
          </div>
          
          <span className="text-[var(--muted)]">|</span>
          
          <button 
            onClick={() => setCompareMode(true)}
            className="hover:text-[var(--text)] text-[var(--muted)]"
          >
            Compare Dates
          </button>
          
          <button 
            onClick={exportCSV}
            className="hover:text-[var(--text)] text-[var(--muted)]"
          >
            Export CSV
          </button>
          
          <button 
            onClick={() => window.print()}
            className="hover:text-[var(--text)] text-[var(--muted)]"
          >
            Print
          </button>

          <div className="ml-auto flex items-center gap-4">
            <a 
              href="https://docs.google.com/spreadsheets/d/1vOXJEegJHJizatcXErv_dOLuWCiz_z8fGZasSDde2tc/edit"
              target="_blank"
              className="text-[var(--accent)] hover:underline"
            >
              Full Data →
            </a>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1.5 hover:bg-[var(--border)] rounded transition-colors"
              title="Settings"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="border-b border-[var(--border)] bg-white dark:bg-[#1a1a1a] print:hidden">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Settings</h3>
              <button 
                onClick={() => setShowSettings(false)}
                className="text-[var(--muted)] hover:text-[var(--text)]"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-[13px]">
              {/* Dark Mode */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.darkMode}
                  onChange={(e) => updateSettings({ darkMode: e.target.checked })}
                  className="w-4 h-4 accent-[var(--accent)]"
                />
                <span>Dark Mode</span>
              </label>

              {/* Compact Mode */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.compactMode}
                  onChange={(e) => updateSettings({ compactMode: e.target.checked })}
                  className="w-4 h-4 accent-[var(--accent)]"
                />
                <span>Compact View</span>
              </label>

              {/* Show Regions */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showRegions}
                  onChange={(e) => updateSettings({ showRegions: e.target.checked })}
                  className="w-4 h-4 accent-[var(--accent)]"
                />
                <span>Show Regions</span>
              </label>

              {/* Auto Refresh */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoRefresh}
                  onChange={(e) => updateSettings({ autoRefresh: e.target.checked })}
                  className="w-4 h-4 accent-[var(--accent)]"
                />
                <span>Auto-refresh ({settings.refreshInterval}m)</span>
              </label>

              {/* Default View */}
              <div className="flex items-center gap-2">
                <span className="text-[var(--muted)]">Default:</span>
                <select
                  value={settings.defaultView}
                  onChange={(e) => updateSettings({ defaultView: e.target.value as Settings['defaultView'] })}
                  className="border border-[var(--border)] px-2 py-1 text-[12px] bg-transparent rounded"
                >
                  <option value="summary">All</option>
                  <option value="hrt">HRT</option>
                  <option value="trt">TRT</option>
                  <option value="providers">Providers</option>
                </select>
              </div>

              {/* Refresh Interval */}
              {settings.autoRefresh && (
                <div className="flex items-center gap-2">
                  <span className="text-[var(--muted)]">Refresh:</span>
                  <select
                    value={settings.refreshInterval}
                    onChange={(e) => updateSettings({ refreshInterval: parseInt(e.target.value) })}
                    className="border border-[var(--border)] px-2 py-1 text-[12px] bg-transparent rounded"
                  >
                    <option value={1}>1 min</option>
                    <option value={5}>5 min</option>
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Lead Story */}
        <div className="grid grid-cols-12 gap-8 mb-12 print:grid-cols-1">
          <div className="col-span-8 print:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1">
                  Quick View
                </div>
                <h2 className="font-serif text-2xl">
                  {quickViewMode === 'shortest' ? 'Shortest Wait Times' : 'Longest Wait Times'}
                </h2>
              </div>
              <div className="flex gap-1 text-[12px]">
                <button
                  onClick={() => setQuickViewMode('shortest')}
                  className={`px-3 py-1 border transition-colors ${
                    quickViewMode === 'shortest'
                      ? 'bg-[var(--teal)] text-white border-[var(--teal)]'
                      : 'border-[var(--border)] hover:border-[var(--teal)] text-[var(--muted)]'
                  }`}
                >
                  Shortest
                </button>
                <button
                  onClick={() => setQuickViewMode('longest')}
                  className={`px-3 py-1 border transition-colors ${
                    quickViewMode === 'longest'
                      ? 'bg-[var(--rose)] text-white border-[var(--rose)]'
                      : 'border-[var(--border)] hover:border-[var(--rose)] text-[var(--muted)]'
                  }`}
                >
                  Longest
                </button>
              </div>
            </div>
            <div className="space-y-1">
              {(quickViewMode === 'shortest' ? analytics?.bestStates : analytics?.worstStates)?.slice(0, 10).map((s, i) => (
                <div 
                  key={i} 
                  className={`flex justify-between py-2 border-b border-[var(--border)] cursor-pointer ${
                    quickViewMode === 'shortest' ? 'hover:bg-teal-50' : 'hover:bg-rose-50'
                  }`}
                  onClick={() => setSelectedState(s.name)}
                >
                  <span className={quickViewMode === 'shortest' ? 'hover:text-[var(--teal)]' : 'hover:text-[var(--rose)]'}>
                    {s.name}
                  </span>
                  <span className={`tabular-nums font-medium ${
                    quickViewMode === 'shortest' ? 'text-[var(--teal)]' : 'text-[var(--rose)]'
                  }`}>
                    {s.daysOut}d
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="col-span-4 border-l border-[var(--border)] pl-8 print:col-span-1 print:border-l-0 print:pl-0">
            {/* Stats Summary */}
            <div className="mb-8">
              <div className="text-[11px] uppercase tracking-wider text-[var(--blue)] font-semibold mb-3">
                Today&apos;s Stats
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-[13px]">
                  <span className="text-[var(--muted)]">Total Links</span>
                  <span className="font-semibold">{analytics?.currentStats.totalLinks || 0}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-[var(--muted)]">Average Wait</span>
                  <span className="font-semibold">{analytics?.currentStats.avgWait.toFixed(1) || 0}d</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-[var(--muted)]">Immediate (≤3d)</span>
                  <span className="font-semibold text-[var(--teal)]">{analytics?.currentStats.immediate || 0}</span>
                </div>
              </div>
            </div>

            {settings.showRegions && analytics && analytics.regionalStats.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[var(--purple)] font-semibold mb-3">
                  By Region
                </div>
                {analytics.regionalStats.map((r, i) => (
                  <div key={i} className="flex justify-between py-1 text-[13px]">
                    <span className="text-[var(--muted)]">{r.region}</span>
                    <span className="tabular-nums text-[var(--purple)]">{r.avgWait.toFixed(1)}d</span>
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
            <div className="grid grid-cols-2 gap-8 print:grid-cols-1">
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
          <div className="flex items-center justify-between mb-4 print:hidden">
            <h2 className="font-serif text-xl">Complete Listing</h2>
            <div className="flex gap-1 text-[12px]">
              {(['summary', 'hrt', 'trt', 'providers'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1 border transition-colors ${
                    view === v 
                      ? v === 'hrt' ? 'bg-[var(--rose)] text-white border-[var(--rose)]' :
                        v === 'trt' ? 'bg-[var(--blue)] text-white border-[var(--blue)]' :
                        v === 'providers' ? 'bg-[var(--purple)] text-white border-[var(--purple)]' :
                        'bg-[var(--text)] text-[var(--bg)] border-[var(--text)]'
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
                <th className="py-2 font-semibold w-20 print:hidden">Type</th>
                <th className="py-2 font-semibold">Location</th>
                <th className="py-2 font-semibold text-right w-16">Wait</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr 
                  key={i} 
                  className="border-b border-[var(--border)] hover:bg-[#f4f3f0] cursor-pointer"
                  onClick={() => setSelectedState(item.name)}
                >
                  <td className="py-2 hover:text-[var(--accent)]">{item.name}</td>
                  <td className="py-2 print:hidden">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                      item.type === 'HRT' ? 'bg-rose-100 text-[var(--rose)]' :
                      item.type === 'TRT' ? 'bg-blue-100 text-[var(--blue)]' :
                      'bg-purple-100 text-[var(--purple)]'
                    }`}>
                      {item.type}
                    </span>
                  </td>
                  <td className="py-2 text-[var(--muted)]">{item.location || '—'}</td>
                  <td className={`py-2 text-right tabular-nums font-medium ${
                    item.daysOutUntilAppointment <= 2 ? 'text-[var(--teal)]' :
                    item.daysOutUntilAppointment >= 7 ? 'text-[var(--rose)]' : ''
                  }`}>
                    {item.daysOutUntilAppointment >= 0 ? `${item.daysOutUntilAppointment}d` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[12px] text-[var(--muted)] mt-4">
            {search ? `Found ${filtered.length} matching "${search}"` : `Showing ${filtered.length} of ${data.length} entries`}
          </div>
        </div>
      </main>

      {/* Email Signup */}
      <div className="max-w-5xl mx-auto px-6 mb-8 print:hidden">
        <div className="border border-[var(--border)] p-6 bg-[#f4f3f0]">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Daily Email Digest</div>
              <div className="text-[13px] text-[var(--muted)]">Get availability updates in your inbox every morning</div>
            </div>
            <a
              href="mailto:daniel@fountain.net?subject=Subscribe%20to%20Daily%20Digest&body=Please%20add%20me%20to%20the%20daily%20availability%20email%20list."
              className="border border-[var(--text)] px-4 py-2 text-sm hover:bg-[var(--text)] hover:text-[var(--bg)] transition-colors"
            >
              Subscribe
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t-2 border-[var(--text)] print:border-t">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex justify-between items-center text-[12px]">
            <div className="text-[var(--muted)]">
              Updated daily at 5:00 AM ET · Press / to search · ⌘P to print
            </div>
            <div className="flex gap-6 print:hidden">
              <a 
                href="mailto:daniel@fountain.net?subject=Dashboard%20Feedback"
                className="text-[var(--muted)] hover:text-[var(--text)]"
              >
                Feedback
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

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body { font-size: 11px; }
          .print\\:hidden { display: none !important; }
          .print\\:col-span-1 { grid-column: span 1; }
          .print\\:border-l-0 { border-left: none; }
          .print\\:pl-0 { padding-left: 0; }
          .print\\:grid-cols-1 { grid-template-columns: 1fr; }
          .print\\:border-b { border-bottom: 1px solid #000; }
          .print\\:border-t { border-top: 1px solid #000; }
        }
      `}</style>
    </div>
  );
}
