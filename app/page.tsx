'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';

// Settings interface
interface Settings {
  darkMode: boolean;
  defaultView: 'summary' | 'hrt' | 'trt' | 'providers';
  showRegions: boolean;
  compactMode: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
  // New settings
  showTrendChart: boolean;
  showDistribution: boolean;
  showComparison: boolean;
  showAnomalies: boolean;
  showWeeklyChanges: boolean;
  immediateThreshold: number;
  highlightThreshold: number;
  defaultQuickView: 'shortest' | 'longest';
  tableDensity: 'compact' | 'normal' | 'spacious';
  colorBlindMode: boolean;
}

interface ScrapingResult {
  name: string;
  type: string;
  location: string;
  daysOutUntilAppointment: number;
  scrapedAt?: string;
  history?: number[]; // 7-day history for sparklines
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
  dailyChanges: { name: string; type: string; change: number; current: number; previousValue?: number }[];
  weeklyChanges: { name: string; type: string; change: number }[];
  trendData: TrendPoint[];
  bestStates: { name: string; daysOut: number }[];
  worstStates: { name: string; daysOut: number }[];
  regionalStats: { region: string; avgWait: number; count: number }[];
  daysAnalyzed: number;
  previousDayAvg?: number;
}

// US State coordinates for map
const stateCoords: Record<string, { x: number; y: number }> = {
  'Alabama': { x: 65, y: 60 }, 'Alaska': { x: 12, y: 85 }, 'Arizona': { x: 22, y: 55 },
  'Arkansas': { x: 52, y: 52 }, 'California': { x: 10, y: 42 }, 'Colorado': { x: 32, y: 42 },
  'Connecticut': { x: 88, y: 28 }, 'Delaware': { x: 85, y: 35 }, 'Florida': { x: 75, y: 72 },
  'Georgia': { x: 72, y: 58 }, 'Hawaii': { x: 25, y: 88 }, 'Idaho': { x: 20, y: 22 },
  'Illinois': { x: 58, y: 38 }, 'Indiana': { x: 62, y: 38 }, 'Iowa': { x: 50, y: 32 },
  'Kansas': { x: 42, y: 42 }, 'Kentucky': { x: 65, y: 42 }, 'Louisiana': { x: 52, y: 65 },
  'Maine': { x: 92, y: 12 }, 'Maryland': { x: 82, y: 35 }, 'Massachusetts': { x: 90, y: 24 },
  'Michigan': { x: 62, y: 25 }, 'Minnesota': { x: 48, y: 18 }, 'Mississippi': { x: 58, y: 58 },
  'Missouri': { x: 52, y: 42 }, 'Montana': { x: 25, y: 15 }, 'Nebraska': { x: 40, y: 32 },
  'Nevada': { x: 15, y: 35 }, 'New Hampshire': { x: 90, y: 18 }, 'New Jersey': { x: 86, y: 32 },
  'New Mexico': { x: 28, y: 55 }, 'New York': { x: 82, y: 22 }, 'North Carolina': { x: 78, y: 48 },
  'North Dakota': { x: 40, y: 15 }, 'Ohio': { x: 68, y: 35 }, 'Oklahoma': { x: 42, y: 52 },
  'Oregon': { x: 12, y: 20 }, 'Pennsylvania': { x: 78, y: 30 }, 'Rhode Island': { x: 90, y: 26 },
  'South Carolina': { x: 75, y: 52 }, 'South Dakota': { x: 40, y: 22 }, 'Tennessee': { x: 65, y: 48 },
  'Texas': { x: 38, y: 65 }, 'Utah': { x: 22, y: 38 }, 'Vermont': { x: 88, y: 15 },
  'Virginia': { x: 78, y: 40 }, 'Washington': { x: 12, y: 10 }, 'West Virginia': { x: 75, y: 38 },
  'Wisconsin': { x: 55, y: 22 }, 'Wyoming': { x: 30, y: 28 }
};

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
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [quickViewMode, setQuickViewMode] = useState<'shortest' | 'longest'>('shortest');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'wait' | 'type' | 'location'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showMap, setShowMap] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    darkMode: false,
    defaultView: 'summary',
    showRegions: true,
    compactMode: false,
    autoRefresh: false,
    refreshInterval: 5,
    // New settings defaults
    showTrendChart: true,
    showDistribution: true,
    showComparison: true,
    showAnomalies: true,
    showWeeklyChanges: true,
    immediateThreshold: 3,
    highlightThreshold: 14,
    defaultQuickView: 'shortest',
    tableDensity: 'normal',
    colorBlindMode: false,
  });

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('fountain-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings(prev => ({ ...prev, ...parsed }));
        if (parsed.defaultView) setView(parsed.defaultView);
        if (parsed.defaultQuickView) setQuickViewMode(parsed.defaultQuickView);
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

  // Apply dark mode
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

  // Available dates
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
        setShowMap(false);
        (document.activeElement as HTMLElement)?.blur();
      }
      if (e.key === 'p' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        window.print();
      }
      if (e.key === 'm') {
        setShowMap(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch data
  const fetchData = useCallback(async (date?: string) => {
    setLoading(true);
    try {
      const dateParam = date ? `?date=${date}` : '';
      const [dataRes, analyticsRes, datesRes] = await Promise.all([
        fetch(`/api/data${dateParam}`).then(r => r.json()),
        fetch(`/api/analytics${dateParam}`).then(r => r.json()),
        fetch('/api/dates').then(r => r.json())
      ]);
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle date selection
  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    if (date) {
      fetchData(date);
    } else {
      fetchData();
    }
  };

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

  // Filter and sort data
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

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'wait':
          cmp = (a.daysOutUntilAppointment ?? 999) - (b.daysOutUntilAppointment ?? 999);
          break;
        case 'type':
          cmp = a.type.localeCompare(b.type);
          break;
        case 'location':
          cmp = (a.location || '').localeCompare(b.location || '');
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [data, view, search, sortBy, sortDir]);

  // Calculate distribution
  const distribution = useMemo(() => {
    const validData = data.filter(d => d.daysOutUntilAppointment >= 0);
    const immThresh = settings.immediateThreshold;
    const highThresh = settings.highlightThreshold;
    return {
      immediate: validData.filter(d => d.daysOutUntilAppointment <= immThresh).length,
      good: validData.filter(d => d.daysOutUntilAppointment > immThresh && d.daysOutUntilAppointment <= 7).length,
      moderate: validData.filter(d => d.daysOutUntilAppointment > 7 && d.daysOutUntilAppointment < highThresh).length,
      long: validData.filter(d => d.daysOutUntilAppointment >= highThresh).length,
      total: validData.length
    };
  }, [data, settings.immediateThreshold, settings.highlightThreshold]);

  // HRT vs TRT comparison
  const typeComparison = useMemo(() => {
    const hrt = data.filter(d => d.type === 'HRT' && d.daysOutUntilAppointment >= 0);
    const trt = data.filter(d => d.type === 'TRT' && d.daysOutUntilAppointment >= 0);
    
    const avgHrt = hrt.length ? hrt.reduce((s, d) => s + d.daysOutUntilAppointment, 0) / hrt.length : 0;
    const avgTrt = trt.length ? trt.reduce((s, d) => s + d.daysOutUntilAppointment, 0) / trt.length : 0;
    
    const bestHrt = hrt.length ? Math.min(...hrt.map(d => d.daysOutUntilAppointment)) : 0;
    const bestTrt = trt.length ? Math.min(...trt.map(d => d.daysOutUntilAppointment)) : 0;
    
    return {
      hrt: { count: hrt.length, avg: avgHrt, best: bestHrt },
      trt: { count: trt.length, avg: avgTrt, best: bestTrt }
    };
  }, [data]);

  // Anomalies (>50% change)
  const anomalies = useMemo(() => {
    if (!analytics?.dailyChanges) return [];
    return analytics.dailyChanges.filter(c => {
      if (!c.previousValue || c.previousValue === 0) return false;
      const pctChange = Math.abs(c.change / c.previousValue) * 100;
      return pctChange >= 50;
    });
  }, [analytics]);

  // Get color for wait time
  const getWaitColor = (days: number): string => {
    if (days <= 3) return 'var(--teal)';
    if (days <= 7) return 'var(--blue)';
    if (days <= 14) return 'var(--amber)';
    return 'var(--rose)';
  };

  // Sparkline component
  const Sparkline = ({ values }: { values: number[] }) => {
    if (!values || values.length === 0) return null;
    const max = Math.max(...values, 1);
    return (
      <div className="sparkline">
        {values.map((v, i) => (
          <div 
            key={i} 
            className="sparkline-bar" 
            style={{ height: `${(v / max) * 100}%` }}
          />
        ))}
      </div>
    );
  };

  // Export CSV
  const exportCSV = () => {
    const headers = ['Name', 'Type', 'Location', 'Days Out'];
    const rows = filtered.map(d => [
      d.name, d.type, d.location || '', 
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

  // Format helpers
  const getLastUpdated = () => {
    if (!lastUpdated || isNaN(lastUpdated.getTime())) return '';
    return lastUpdated.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  };

  const timestamp = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

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
            <button onClick={() => setSelectedState(null)} className="text-[var(--accent)] hover:underline text-sm">
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
                      <div className="w-full bg-[var(--text)]" style={{ height: `${Math.max(height, 5)}%` }} />
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
            <button onClick={() => setCompareMode(false)} className="text-[var(--accent)] hover:underline text-sm">
              ← Back
            </button>
            <div className="flex items-center gap-4">
              <select value={compareDate1} onChange={(e) => setCompareDate1(e.target.value)}
                className="border border-[var(--border)] px-3 py-1 text-sm bg-transparent">
                <option value="">Select date 1</option>
                {availableDates.map(d => (
                  <option key={d} value={d}>{new Date(d).toLocaleDateString()}</option>
                ))}
              </select>
              <span className="text-[var(--muted)]">vs</span>
              <select value={compareDate2} onChange={(e) => setCompareDate2(e.target.value)}
                className="border border-[var(--border)] px-3 py-1 text-sm bg-transparent">
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
                        change && change < 0 ? 'text-teal-700' : change && change > 0 ? 'text-[var(--accent)]' : ''
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

  // Map view
  if (showMap) {
    return (
      <div className="min-h-screen">
        <header className="border-b border-[var(--border)] print:hidden">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <button onClick={() => setShowMap(false)} className="text-[var(--accent)] hover:underline text-sm">
              ← Back
            </button>
            <h1 className="font-serif text-xl">Geographic Heatmap</h1>
            <div />
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">
          {/* Legend */}
          <div className="flex items-center gap-6 mb-6 text-[12px]">
            <span className="text-[var(--muted)]">Wait Time:</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ background: 'var(--teal)' }} />
              <span>≤3d</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ background: 'var(--blue)' }} />
              <span>4-7d</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ background: 'var(--amber)' }} />
              <span>8-14d</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ background: 'var(--rose)' }} />
              <span>&gt;14d</span>
            </div>
          </div>
          
          {/* Map */}
          <div className="relative bg-[#f4f3f0] dark:bg-[#1f1f1f] border border-[var(--border)] rounded-lg p-8" style={{ aspectRatio: '1.6' }}>
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {data.filter(d => d.type === 'HRT' || d.type === 'TRT').map((item, i) => {
                // Extract state name from location or name
                const stateName = Object.keys(stateCoords).find(s => 
                  item.name.includes(s) || item.location?.includes(s)
                );
                if (!stateName) return null;
                const coords = stateCoords[stateName];
                const color = getWaitColor(item.daysOutUntilAppointment);
                
                return (
                  <g key={i} onClick={() => setSelectedState(item.name)} style={{ cursor: 'pointer' }}>
                    <circle
                      cx={coords.x}
                      cy={coords.y}
                      r={3}
                      fill={color}
                      stroke="white"
                      strokeWidth={0.5}
                    />
                    <title>{item.name}: {item.daysOutUntilAppointment}d</title>
                  </g>
                );
              })}
            </svg>
            <div className="absolute bottom-4 left-4 text-[11px] text-[var(--muted)]">
              Click a point to view details
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Main view
  return (
    <div className="min-h-screen">
      {/* Masthead */}
      <header className="border-b-2 border-[var(--text)] print:border-b bg-gradient-to-b from-white to-[var(--bg)]">
        <div className="max-w-6xl mx-auto px-6 py-6">
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

      {/* HEADLINE SUMMARY */}
      {analytics && (
        <div className="bg-[var(--text)] text-[var(--bg)] py-3">
          <div className="max-w-6xl mx-auto px-6 text-center text-[13px]">
            <span className="font-semibold">
              Average wait time is {analytics.currentStats.avgWait.toFixed(1)} days
            </span>
            {analytics.previousDayAvg && (
              <span className={analytics.currentStats.avgWait < analytics.previousDayAvg ? 'text-teal-300' : 'text-rose-300'}>
                {' '}({analytics.currentStats.avgWait < analytics.previousDayAvg ? '↓' : '↑'}
                {Math.abs(analytics.currentStats.avgWait - analytics.previousDayAvg).toFixed(1)} from yesterday)
              </span>
            )}
            <span className="mx-3 opacity-50">•</span>
            <span className="text-teal-300">{analytics.currentStats.immediate} locations with immediate availability</span>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="border-b border-[var(--border)] bg-[#f4f3f0] print:hidden">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-4 text-[12px] flex-wrap">
          <div className="relative">
            <input
              id="search-input"
              type="text"
              placeholder="Search... (/)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-[var(--border)] px-3 py-1.5 w-40 bg-white text-sm focus:outline-none focus:border-[var(--text)]"
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)]">×</button>
            )}
          </div>
          
          {/* Date Selector */}
          <select 
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="border border-[var(--border)] px-3 py-1.5 bg-white text-sm"
          >
            <option value="">Today</option>
            {availableDates.map(d => (
              <option key={d} value={d}>{new Date(d).toLocaleDateString()}</option>
            ))}
          </select>
          
          <span className="text-[var(--muted)]">|</span>
          
          <button onClick={() => setCompareMode(true)} className="hover:text-[var(--text)] text-[var(--muted)]">
            Compare
          </button>
          <button onClick={() => setShowMap(true)} className="hover:text-[var(--text)] text-[var(--muted)]">
            Map (m)
          </button>
          <button onClick={exportCSV} className="hover:text-[var(--text)] text-[var(--muted)]">
            Export
          </button>
          <button onClick={() => window.print()} className="hover:text-[var(--text)] text-[var(--muted)]">
            Print
          </button>

          <div className="ml-auto flex items-center gap-4">
            <a href="https://docs.google.com/spreadsheets/d/1vOXJEegJHJizatcXErv_dOLuWCiz_z8fGZasSDde2tc/edit"
              target="_blank" className="text-[var(--accent)] hover:underline">Full Data →</a>
            <button onClick={() => setShowSettings(!showSettings)}
              className="p-1.5 hover:bg-[var(--border)] rounded transition-colors" title="Settings">
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
        <div className="border-b border-[var(--border)] bg-[#f4f3f0] dark:bg-[#1f1f1f] print:hidden">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[var(--text)]">Settings</h3>
              <button onClick={() => setShowSettings(false)} className="text-[var(--muted)] hover:text-[var(--text)]">✕</button>
            </div>
            
            {/* Appearance */}
            <div className="mb-6">
              <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-3">Appearance</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[13px] text-[var(--text)]">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={settings.darkMode}
                    onChange={(e) => updateSettings({ darkMode: e.target.checked })}
                    className="w-4 h-4 accent-[var(--accent)]" />
                  <span>Dark Mode</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={settings.colorBlindMode}
                    onChange={(e) => updateSettings({ colorBlindMode: e.target.checked })}
                    className="w-4 h-4 accent-[var(--accent)]" />
                  <span>Color Blind Mode</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--muted)]">Density:</span>
                  <select
                    value={settings.tableDensity}
                    onChange={(e) => updateSettings({ tableDensity: e.target.value as Settings['tableDensity'] })}
                    className="border border-[var(--border)] px-2 py-1 text-[12px] bg-white dark:bg-[#1a1a1a] rounded"
                  >
                    <option value="compact">Compact</option>
                    <option value="normal">Normal</option>
                    <option value="spacious">Spacious</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Dashboard Panels */}
            <div className="mb-6">
              <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-3">Dashboard Panels</div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-[13px] text-[var(--text)]">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={settings.showTrendChart}
                    onChange={(e) => updateSettings({ showTrendChart: e.target.checked })}
                    className="w-4 h-4 accent-[var(--accent)]" />
                  <span>Trend Chart</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={settings.showDistribution}
                    onChange={(e) => updateSettings({ showDistribution: e.target.checked })}
                    className="w-4 h-4 accent-[var(--accent)]" />
                  <span>Distribution</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={settings.showComparison}
                    onChange={(e) => updateSettings({ showComparison: e.target.checked })}
                    className="w-4 h-4 accent-[var(--accent)]" />
                  <span>HRT vs TRT</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={settings.showAnomalies}
                    onChange={(e) => updateSettings({ showAnomalies: e.target.checked })}
                    className="w-4 h-4 accent-[var(--accent)]" />
                  <span>Anomalies</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={settings.showRegions}
                    onChange={(e) => updateSettings({ showRegions: e.target.checked })}
                    className="w-4 h-4 accent-[var(--accent)]" />
                  <span>Regions</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={settings.showWeeklyChanges}
                    onChange={(e) => updateSettings({ showWeeklyChanges: e.target.checked })}
                    className="w-4 h-4 accent-[var(--accent)]" />
                  <span>Weekly Changes</span>
                </label>
              </div>
            </div>

            {/* Thresholds */}
            <div className="mb-6">
              <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-3">Thresholds</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[13px] text-[var(--text)]">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--muted)]">Immediate:</span>
                  <select
                    value={settings.immediateThreshold}
                    onChange={(e) => updateSettings({ immediateThreshold: parseInt(e.target.value) })}
                    className="border border-[var(--border)] px-2 py-1 text-[12px] bg-white dark:bg-[#1a1a1a] rounded w-20"
                  >
                    <option value={1}>≤1 day</option>
                    <option value={2}>≤2 days</option>
                    <option value={3}>≤3 days</option>
                    <option value={5}>≤5 days</option>
                    <option value={7}>≤7 days</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--muted)]">Long wait:</span>
                  <select
                    value={settings.highlightThreshold}
                    onChange={(e) => updateSettings({ highlightThreshold: parseInt(e.target.value) })}
                    className="border border-[var(--border)] px-2 py-1 text-[12px] bg-white dark:bg-[#1a1a1a] rounded w-20"
                  >
                    <option value={7}>≥7 days</option>
                    <option value={10}>≥10 days</option>
                    <option value={14}>≥14 days</option>
                    <option value={21}>≥21 days</option>
                    <option value={30}>≥30 days</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Defaults */}
            <div className="mb-6">
              <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-3">Defaults</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[13px] text-[var(--text)]">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--muted)]">View:</span>
                  <select
                    value={settings.defaultView}
                    onChange={(e) => updateSettings({ defaultView: e.target.value as Settings['defaultView'] })}
                    className="border border-[var(--border)] px-2 py-1 text-[12px] bg-white dark:bg-[#1a1a1a] rounded"
                  >
                    <option value="summary">All</option>
                    <option value="hrt">HRT</option>
                    <option value="trt">TRT</option>
                    <option value="providers">Providers</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--muted)]">Quick View:</span>
                  <select
                    value={settings.defaultQuickView}
                    onChange={(e) => updateSettings({ defaultQuickView: e.target.value as Settings['defaultQuickView'] })}
                    className="border border-[var(--border)] px-2 py-1 text-[12px] bg-white dark:bg-[#1a1a1a] rounded"
                  >
                    <option value="shortest">Shortest Wait</option>
                    <option value="longest">Longest Wait</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Auto-refresh */}
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-3">Auto-refresh</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[13px] text-[var(--text)]">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={settings.autoRefresh}
                    onChange={(e) => updateSettings({ autoRefresh: e.target.checked })}
                    className="w-4 h-4 accent-[var(--accent)]" />
                  <span>Enable Auto-refresh</span>
                </label>
                {settings.autoRefresh && (
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--muted)]">Interval:</span>
                    <select
                      value={settings.refreshInterval}
                      onChange={(e) => updateSettings({ refreshInterval: parseInt(e.target.value) })}
                      className="border border-[var(--border)] px-2 py-1 text-[12px] bg-white dark:bg-[#1a1a1a] rounded"
                    >
                      <option value={1}>1 min</option>
                      <option value={5}>5 min</option>
                      <option value={10}>10 min</option>
                      <option value={15}>15 min</option>
                      <option value={30}>30 min</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Reset button */}
            <div className="mt-6 pt-4 border-t border-[var(--border)]">
              <button
                onClick={() => {
                  localStorage.removeItem('fountain-settings');
                  window.location.reload();
                }}
                className="text-[12px] text-[var(--accent)] hover:underline"
              >
                Reset all settings to defaults
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* 7-DAY TREND CHART */}
        {settings.showTrendChart && analytics?.trendData && analytics.trendData.length > 0 && (
          <div className="mb-8 p-6 border border-[var(--border)] bg-white dark:bg-[#1a1a1a] rounded-lg">
            <h2 className="font-serif text-xl mb-4">7-Day Trend</h2>
            <div className="h-40 flex items-end gap-1">
              {analytics.trendData.map((point, i) => {
                const max = Math.max(...analytics.trendData.map(p => Math.max(p.hrtAvg, p.trtAvg, p.avgWait)), 1);
                const avgH = (point.avgWait / max) * 100;
                const hrtH = (point.hrtAvg / max) * 100;
                const trtH = (point.trtAvg / max) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex gap-0.5 items-end justify-center h-28">
                      <div className="w-2 bg-[var(--rose)]" style={{ height: `${Math.max(hrtH, 3)}%` }} title={`HRT: ${point.hrtAvg.toFixed(1)}d`} />
                      <div className="w-2 bg-[var(--blue)]" style={{ height: `${Math.max(trtH, 3)}%` }} title={`TRT: ${point.trtAvg.toFixed(1)}d`} />
                    </div>
                    <span className="text-[10px] text-[var(--muted)]">
                      {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 text-[11px]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[var(--rose)]" />
                <span>HRT</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[var(--blue)]" />
                <span>TRT</span>
              </div>
            </div>
          </div>
        )}

        {/* DISTRIBUTION + TYPE COMPARISON + ANOMALIES */}
        {(settings.showDistribution || settings.showComparison || settings.showAnomalies) && (
        <div className={`grid grid-cols-1 gap-6 mb-8 ${
          [settings.showDistribution, settings.showComparison, settings.showAnomalies].filter(Boolean).length === 3 ? 'md:grid-cols-3' :
          [settings.showDistribution, settings.showComparison, settings.showAnomalies].filter(Boolean).length === 2 ? 'md:grid-cols-2' : ''
        }`}>
          {/* Wait Time Distribution */}
          {settings.showDistribution && (
          <div className={`p-5 border border-[var(--border)] bg-white dark:bg-[#1a1a1a] rounded-lg ${settings.colorBlindMode ? 'color-blind' : ''}`}>
            <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-3">
              Wait Time Distribution
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-24 text-[12px]">⚡ ≤{settings.immediateThreshold}d</div>
                <div className="flex-1 h-5 bg-[var(--border)] rounded overflow-hidden">
                  <div className={`h-full bg-[var(--teal)] transition-all ${settings.colorBlindMode ? 'pattern-dots' : ''}`}
                    style={{ width: `${(distribution.immediate / distribution.total) * 100}%` }} />
                </div>
                <div className="w-8 text-right text-[12px] font-semibold">{distribution.immediate}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-24 text-[12px]">✅ {settings.immediateThreshold + 1}-7d</div>
                <div className="flex-1 h-5 bg-[var(--border)] rounded overflow-hidden">
                  <div className={`h-full bg-[var(--blue)] transition-all ${settings.colorBlindMode ? 'pattern-lines' : ''}`}
                    style={{ width: `${(distribution.good / distribution.total) * 100}%` }} />
                </div>
                <div className="w-8 text-right text-[12px] font-semibold">{distribution.good}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-24 text-[12px]">⚠️ 8-{settings.highlightThreshold - 1}d</div>
                <div className="flex-1 h-5 bg-[var(--border)] rounded overflow-hidden">
                  <div className={`h-full bg-[var(--amber)] transition-all ${settings.colorBlindMode ? 'pattern-cross' : ''}`}
                    style={{ width: `${(distribution.moderate / distribution.total) * 100}%` }} />
                </div>
                <div className="w-8 text-right text-[12px] font-semibold">{distribution.moderate}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-24 text-[12px]">❌ ≥{settings.highlightThreshold}d</div>
                <div className="flex-1 h-5 bg-[var(--border)] rounded overflow-hidden">
                  <div className={`h-full bg-[var(--rose)] transition-all ${settings.colorBlindMode ? 'pattern-zigzag' : ''}`}
                    style={{ width: `${(distribution.long / distribution.total) * 100}%` }} />
                </div>
                <div className="w-8 text-right text-[12px] font-semibold">{distribution.long}</div>
              </div>
            </div>
          </div>
          )}

          {/* HRT vs TRT Comparison */}
          {settings.showComparison && (
          <div className="p-5 border border-[var(--border)] bg-white dark:bg-[#1a1a1a] rounded-lg">
            <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-3">
              HRT vs TRT
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className={`text-center p-3 bg-rose-50 dark:bg-rose-950/30 rounded ${settings.colorBlindMode ? 'border-2 border-dashed border-[var(--rose)]' : ''}`}>
                <div className="text-[11px] text-[var(--rose)] font-semibold mb-1">HRT</div>
                <div className="text-2xl font-bold tabular-nums">{typeComparison.hrt.avg.toFixed(1)}<span className="text-sm">d avg</span></div>
                <div className="text-[11px] text-[var(--muted)] mt-1">Best: {typeComparison.hrt.best}d</div>
                <div className="text-[11px] text-[var(--muted)]">{typeComparison.hrt.count} locations</div>
              </div>
              <div className={`text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded ${settings.colorBlindMode ? 'border-2 border-solid border-[var(--blue)]' : ''}`}>
                <div className="text-[11px] text-[var(--blue)] font-semibold mb-1">TRT</div>
                <div className="text-2xl font-bold tabular-nums">{typeComparison.trt.avg.toFixed(1)}<span className="text-sm">d avg</span></div>
                <div className="text-[11px] text-[var(--muted)] mt-1">Best: {typeComparison.trt.best}d</div>
                <div className="text-[11px] text-[var(--muted)]">{typeComparison.trt.count} locations</div>
              </div>
            </div>
          </div>
          )}

          {/* Anomalies */}
          {settings.showAnomalies && (
          <div className="p-5 border border-[var(--border)] bg-white dark:bg-[#1a1a1a] rounded-lg">
            <div className="text-[11px] uppercase tracking-wider text-[var(--amber)] font-semibold mb-3">
              ⚠️ Significant Changes
            </div>
            {anomalies.length === 0 ? (
              <div className="text-[13px] text-[var(--muted)]">No anomalies detected today</div>
            ) : (
              <div className="space-y-2">
                {anomalies.slice(0, 4).map((a, i) => (
                  <div key={i} className="flex justify-between items-center text-[12px]">
                    <span className="truncate flex-1">{a.name}</span>
                    <span className={`tabular-nums font-semibold ${a.change < 0 ? 'text-[var(--teal)]' : 'text-[var(--rose)]'}`}>
                      {a.change > 0 ? '+' : ''}{a.change}d
                      <span className="text-[var(--muted)] ml-1">
                        ({a.previousValue ? ((a.change / a.previousValue) * 100).toFixed(0) : 0}%)
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
        </div>
        )}

        {/* QUICK VIEW + STATS */}
        <div className="grid grid-cols-12 gap-8 mb-12 print:grid-cols-1">
          <div className="col-span-8 print:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1">Quick View</div>
                <h2 className="font-serif text-2xl">
                  {quickViewMode === 'shortest' ? 'Shortest Wait Times' : 'Longest Wait Times'}
                </h2>
              </div>
              <div className="flex gap-1 text-[12px]">
                <button onClick={() => setQuickViewMode('shortest')}
                  className={`px-3 py-1 border transition-colors ${
                    quickViewMode === 'shortest'
                      ? 'bg-[var(--teal)] text-white border-[var(--teal)]'
                      : 'border-[var(--border)] hover:border-[var(--teal)] text-[var(--muted)]'
                  }`}>Shortest</button>
                <button onClick={() => setQuickViewMode('longest')}
                  className={`px-3 py-1 border transition-colors ${
                    quickViewMode === 'longest'
                      ? 'bg-[var(--rose)] text-white border-[var(--rose)]'
                      : 'border-[var(--border)] hover:border-[var(--rose)] text-[var(--muted)]'
                  }`}>Longest</button>
              </div>
            </div>
            <div className="space-y-1">
              {(quickViewMode === 'shortest' ? analytics?.bestStates : analytics?.worstStates)?.slice(0, 10).map((s, i) => (
                <div key={i} className={`flex justify-between py-2 border-b border-[var(--border)] cursor-pointer ${
                  quickViewMode === 'shortest' ? 'hover:bg-teal-50 dark:hover:bg-teal-950/30' : 'hover:bg-rose-50 dark:hover:bg-rose-950/30'
                }`} onClick={() => setSelectedState(s.name)}>
                  <span>{s.name}</span>
                  <span className={`tabular-nums font-medium ${
                    quickViewMode === 'shortest' ? 'text-[var(--teal)]' : 'text-[var(--rose)]'
                  }`}>{s.daysOut}d</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="col-span-4 border-l border-[var(--border)] pl-8 print:col-span-1 print:border-l-0 print:pl-0">
            <div className="mb-8">
              <div className="text-[11px] uppercase tracking-wider text-[var(--blue)] font-semibold mb-3">Today&apos;s Stats</div>
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

            {settings.showRegions && analytics?.regionalStats && analytics.regionalStats.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[var(--purple)] font-semibold mb-3">By Region</div>
                {analytics.regionalStats.map((r, i) => (
                  <div key={i} className="flex justify-between py-1 text-[13px]">
                    <span className="text-[var(--muted)]">{r.region}</span>
                    <span className="tabular-nums text-[var(--purple)]">{r.avgWait.toFixed(1)}d</span>
                  </div>
                ))}
              </div>
            )}

            {/* Week-over-Week */}
            {settings.showWeeklyChanges && analytics?.weeklyChanges && analytics.weeklyChanges.length > 0 && (
              <div className="mt-8 pt-4 border-t border-[var(--border)]">
                <div className="text-[11px] uppercase tracking-wider text-[var(--amber)] font-semibold mb-3">Week-over-Week</div>
                {analytics.weeklyChanges.slice(0, 5).map((c, i) => (
                  <div key={i} className="flex justify-between py-1 text-[12px]">
                    <span className="text-[var(--muted)] truncate flex-1">{c.name}</span>
                    <span className={`tabular-nums ml-2 ${c.change < 0 ? 'text-[var(--teal)]' : 'text-[var(--rose)]'}`}>
                      {c.change > 0 ? '+' : ''}{c.change}d
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Daily Changes with Percentage */}
        {analytics && analytics.dailyChanges.length > 0 && (
          <div className="mb-12 border-t-2 border-[var(--text)] pt-6">
            <h2 className="font-serif text-xl mb-4">Changes Since Yesterday</h2>
            <div className="grid grid-cols-2 gap-8 print:grid-cols-1">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-teal-700 dark:text-teal-400 font-semibold mb-2">Improved</div>
                {analytics.dailyChanges.filter(c => c.change < 0).slice(0, 6).map((c, i) => (
                  <div key={i} className="flex justify-between py-1 text-[13px] border-b border-[var(--border)]">
                    <span>{c.name}</span>
                    <span className="text-teal-700 dark:text-teal-400 tabular-nums">
                      {c.change}d
                      {c.previousValue && (
                        <span className="text-[var(--muted)] ml-1 text-[11px]">
                          ({((c.change / c.previousValue) * 100).toFixed(0)}%)
                        </span>
                      )}
                    </span>
                  </div>
                ))}
                {analytics.dailyChanges.filter(c => c.change < 0).length === 0 && (
                  <div className="text-[var(--muted)] text-[13px]">None today</div>
                )}
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[var(--accent)] font-semibold mb-2">Longer Wait</div>
                {analytics.dailyChanges.filter(c => c.change > 0).slice(0, 6).map((c, i) => (
                  <div key={i} className="flex justify-between py-1 text-[13px] border-b border-[var(--border)]">
                    <span>{c.name}</span>
                    <span className="text-[var(--accent)] tabular-nums">
                      +{c.change}d
                      {c.previousValue && (
                        <span className="text-[var(--muted)] ml-1 text-[11px]">
                          (+{((c.change / c.previousValue) * 100).toFixed(0)}%)
                        </span>
                      )}
                    </span>
                  </div>
                ))}
                {analytics.dailyChanges.filter(c => c.change > 0).length === 0 && (
                  <div className="text-[var(--muted)] text-[13px]">None today</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Complete Listing with Sort */}
        <div className="border-t-2 border-[var(--text)] pt-6">
          <div className="flex items-center justify-between mb-4 print:hidden">
            <h2 className="font-serif text-xl">Complete Listing</h2>
            <div className="flex gap-1 text-[12px]">
              {(['summary', 'hrt', 'trt', 'providers'] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1 border transition-colors ${
                    view === v 
                      ? v === 'hrt' ? 'bg-[var(--rose)] text-white border-[var(--rose)]' :
                        v === 'trt' ? 'bg-[var(--blue)] text-white border-[var(--blue)]' :
                        v === 'providers' ? 'bg-[var(--purple)] text-white border-[var(--purple)]' :
                        'bg-[var(--text)] text-[var(--bg)] border-[var(--text)]'
                      : 'border-[var(--border)] hover:border-[var(--text)]'
                  }`}>
                  {v === 'summary' ? 'All' : v.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <table className={`w-full ${
            settings.tableDensity === 'compact' ? 'text-[12px]' :
            settings.tableDensity === 'spacious' ? 'text-[14px]' : 'text-[13px]'
          }`}>
            <thead>
              <tr className="border-b-2 border-[var(--text)] text-left">
                <th className={`font-semibold cursor-pointer hover:text-[var(--accent)] ${
                  settings.tableDensity === 'compact' ? 'py-1' :
                  settings.tableDensity === 'spacious' ? 'py-3' : 'py-2'
                }`} onClick={() => handleSort('name')}>
                  Name {sortBy === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className={`font-semibold w-20 print:hidden cursor-pointer hover:text-[var(--accent)] ${
                  settings.tableDensity === 'compact' ? 'py-1' :
                  settings.tableDensity === 'spacious' ? 'py-3' : 'py-2'
                }`} onClick={() => handleSort('type')}>
                  Type {sortBy === 'type' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className={`font-semibold cursor-pointer hover:text-[var(--accent)] ${
                  settings.tableDensity === 'compact' ? 'py-1' :
                  settings.tableDensity === 'spacious' ? 'py-3' : 'py-2'
                }`} onClick={() => handleSort('location')}>
                  Location {sortBy === 'location' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className={`font-semibold text-right w-24 cursor-pointer hover:text-[var(--accent)] ${
                  settings.tableDensity === 'compact' ? 'py-1' :
                  settings.tableDensity === 'spacious' ? 'py-3' : 'py-2'
                }`} onClick={() => handleSort('wait')}>
                  Wait {sortBy === 'wait' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr key={i} className="border-b border-[var(--border)] hover:bg-[#f4f3f0] dark:hover:bg-[#252525] cursor-pointer"
                  onClick={() => setSelectedState(item.name)}>
                  <td className={`hover:text-[var(--accent)] ${
                    settings.tableDensity === 'compact' ? 'py-1' :
                    settings.tableDensity === 'spacious' ? 'py-3' : 'py-2'
                  }`}>
                    {item.name}
                    {item.history && <Sparkline values={item.history} />}
                  </td>
                  <td className={`print:hidden ${
                    settings.tableDensity === 'compact' ? 'py-1' :
                    settings.tableDensity === 'spacious' ? 'py-3' : 'py-2'
                  }`}>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                      item.type === 'HRT' ? 'bg-rose-100 dark:bg-rose-950/50 text-[var(--rose)]' :
                      item.type === 'TRT' ? 'bg-blue-100 dark:bg-blue-950/50 text-[var(--blue)]' :
                      'bg-purple-100 dark:bg-purple-950/50 text-[var(--purple)]'
                    } ${settings.colorBlindMode ? (item.type === 'HRT' ? 'border border-dashed' : 'border border-solid') : ''}`}>{item.type}</span>
                  </td>
                  <td className={`text-[var(--muted)] ${
                    settings.tableDensity === 'compact' ? 'py-1' :
                    settings.tableDensity === 'spacious' ? 'py-3' : 'py-2'
                  }`}>{item.location || '—'}</td>
                  <td className={`text-right tabular-nums font-medium ${
                    settings.tableDensity === 'compact' ? 'py-1' :
                    settings.tableDensity === 'spacious' ? 'py-3' : 'py-2'
                  } ${
                    item.daysOutUntilAppointment <= settings.immediateThreshold ? 'text-[var(--teal)]' :
                    item.daysOutUntilAppointment <= 7 ? 'text-[var(--blue)]' :
                    item.daysOutUntilAppointment < settings.highlightThreshold ? 'text-[var(--amber)]' :
                    'text-[var(--rose)]'
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
      <div className="max-w-6xl mx-auto px-6 mb-8 print:hidden">
        <div className="border border-[var(--border)] p-6 bg-[#f4f3f0] dark:bg-[#1f1f1f]">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Daily Email Digest</div>
              <div className="text-[13px] text-[var(--muted)]">Get availability updates in your inbox every morning</div>
            </div>
            <a href="mailto:daniel@fountain.net?subject=Subscribe%20to%20Daily%20Digest&body=Please%20add%20me%20to%20the%20daily%20availability%20email%20list."
              className="border border-[var(--text)] px-4 py-2 text-sm hover:bg-[var(--text)] hover:text-[var(--bg)] transition-colors">
              Subscribe
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t-2 border-[var(--text)] print:border-t">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex justify-between items-center text-[12px]">
            <div className="text-[var(--muted)]">
              Updated daily at 5:00 AM ET · Press / to search · m for map · ⌘P to print
            </div>
            <div className="flex gap-6 print:hidden">
              <a href="mailto:daniel@fountain.net?subject=Dashboard%20Feedback"
                className="text-[var(--muted)] hover:text-[var(--text)]">Feedback</a>
              <a href="https://docs.google.com/spreadsheets/d/1vOXJEegJHJizatcXErv_dOLuWCiz_z8fGZasSDde2tc/edit"
                target="_blank" className="text-[var(--muted)] hover:text-[var(--text)]">Source Data</a>
            </div>
          </div>
        </div>
      </footer>

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
