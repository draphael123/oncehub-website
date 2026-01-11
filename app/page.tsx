'use client';

import { useEffect, useState } from 'react';

interface ScrapingResult {
  name: string;
  type: string;
  location: string;
  daysOutUntilAppointment: number;
  firstAvailableDate: string | null;
  scrapedAt: string;
  error?: string;
}

interface TrendPoint {
  date: string;
  avgWait: number;
  totalLinks: number;
  immediate: number;
  hrtAvg: number;
  trtAvg: number;
}

interface Change {
  name: string;
  type: string;
  change: number;
  current: number;
  previous?: number;
  weekAgo?: number;
}

interface RegionalStat {
  region: string;
  count: number;
  avgWait: number;
}

interface Analytics {
  success: boolean;
  currentStats: {
    totalLinks: number;
    avgWait: number;
    immediate: number;
  };
  dailyChanges: Change[];
  weeklyChanges: Change[];
  trendData: TrendPoint[];
  bestStates: { name: string; type: string; daysOut: number }[];
  worstStates: { name: string; type: string; daysOut: number }[];
  regionalStats: RegionalStat[];
  daysAnalyzed: number;
  latestDate: string;
}

export default function Home() {
  const [data, setData] = useState<ScrapingResult[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'daily' | 'weekly' | 'data'>('overview');
  const [filter, setFilter] = useState<'all' | 'HRT' | 'TRT' | 'Provider'>('all');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('latest');

  useEffect(() => {
    Promise.all([fetchData(), fetchAnalytics()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedDate !== 'latest') {
      fetchDataForDate(selectedDate);
    } else {
      fetchData();
    }
  }, [selectedDate]);

  async function fetchData() {
    try {
      const response = await fetch('/api/data');
      const result = await response.json();
      if (result.success) setData(result.data);
    } catch (err) {
      console.error('Data fetch error:', err);
    }
  }

  async function fetchDataForDate(date: string) {
    try {
      setLoading(true);
      const response = await fetch(`/api/data?date=${date}`);
      const result = await response.json();
      if (result.success) setData(result.data);
    } catch (err) {
      console.error('Data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAnalytics() {
    try {
      const response = await fetch('/api/analytics');
      const result = await response.json();
      if (result.success) {
        setAnalytics(result);
        // Extract available dates from trend data
        if (result.trendData && result.trendData.length > 0) {
          setAvailableDates(result.trendData.map((t: TrendPoint) => t.date));
        }
      }
    } catch (err) {
      console.error('Analytics fetch error:', err);
    }
  }

  const filteredData = data.filter(item => filter === 'all' || item.type === filter);
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getWaitLabel = (days: number) => {
    if (days < 0) return { text: 'N/A', color: 'text-stone-400' };
    if (days <= 2) return { text: `${days}d`, color: 'text-teal-600' };
    if (days <= 5) return { text: `${days}d`, color: 'text-stone-700' };
    if (days <= 10) return { text: `${days}d`, color: 'text-amber-600' };
    return { text: `${days}d`, color: 'text-rose-600' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-stone-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold text-stone-900 tracking-tight">
              Fountain Availability
            </h1>
            <p className="text-stone-500 text-sm">OnceHub scheduling data</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Date Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-stone-500">Date:</label>
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-sm border border-stone-300 rounded-md px-3 py-2 bg-white text-stone-700 hover:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-200"
              >
                <option value="latest">Latest</option>
                {availableDates.map(date => (
                  <option key={date} value={date}>
                    {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </option>
                ))}
              </select>
            </div>
            <a 
              href="https://docs.google.com/spreadsheets/d/1vOXJEegJHJizatcXErv_dOLuWCiz_z8fGZasSDde2tc/edit"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-stone-600 hover:text-stone-900 border border-stone-300 px-4 py-2 rounded-md hover:border-stone-400 transition-colors"
            >
              View Spreadsheet
            </a>
          </div>
        </div>
      </header>

      {/* Nav */}
      <nav className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-8">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'daily', label: 'Daily Changes' },
              { id: 'weekly', label: 'Weekly Trends' },
              { id: 'data', label: 'All Data' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'text-stone-900 border-stone-900'
                    : 'text-stone-500 border-transparent hover:text-stone-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
              <Stat label="Total Links" value={data.length} />
              <Stat label="Immediate (≤3d)" value={analytics?.currentStats.immediate || 0} />
              <Stat label="Avg Wait" value={`${(analytics?.currentStats.avgWait || 0).toFixed(1)} days`} />
              <Stat label="Days Tracked" value={analytics?.daysAnalyzed || 1} />
            </div>

            {/* Two columns */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Best */}
              <div className="bg-white rounded-lg border border-stone-200 p-5">
                <h2 className="text-sm font-semibold text-stone-900 uppercase tracking-wide mb-4">
                  Shortest Wait
                </h2>
                <div className="space-y-3">
                  {analytics?.bestStates.map((item, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-stone-700">{item.name}</span>
                      <span className="text-teal-600 font-medium tabular-nums">{item.daysOut}d</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Worst */}
              <div className="bg-white rounded-lg border border-stone-200 p-5">
                <h2 className="text-sm font-semibold text-stone-900 uppercase tracking-wide mb-4">
                  Longest Wait
                </h2>
                <div className="space-y-3">
                  {analytics?.worstStates.map((item, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-stone-700">{item.name}</span>
                      <span className="text-rose-600 font-medium tabular-nums">{item.daysOut}d</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Regional */}
            {analytics && analytics.regionalStats.length > 0 && (
              <div className="bg-white rounded-lg border border-stone-200 p-5">
                <h2 className="text-sm font-semibold text-stone-900 uppercase tracking-wide mb-4">
                  By Region
                </h2>
                <div className="grid grid-cols-4 gap-4">
                  {analytics.regionalStats.map((region, i) => (
                    <div key={i} className="text-center py-3">
                      <div className="text-2xl font-semibold text-stone-900 tabular-nums">
                        {region.avgWait.toFixed(1)}d
                      </div>
                      <div className="text-stone-500 text-sm">{region.region}</div>
                      <div className="text-stone-400 text-xs">{region.count} links</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Daily */}
        {activeTab === 'daily' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-stone-900">Daily Changes</h2>
              <p className="text-stone-500 text-sm">Comparing today vs yesterday</p>
            </div>

            {analytics && analytics.dailyChanges.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg border border-stone-200 p-5">
                  <h3 className="text-sm font-semibold text-teal-700 uppercase tracking-wide mb-4">
                    Improved
                  </h3>
                  <div className="space-y-3">
                    {analytics.dailyChanges.filter(c => c.change < 0).length > 0 ? (
                      analytics.dailyChanges.filter(c => c.change < 0).map((item, i) => (
                        <div key={i} className="flex justify-between items-center text-sm">
                          <span className="text-stone-700">{item.name}</span>
                          <span className="text-teal-600 font-medium">{item.change}d</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-stone-400 text-sm">No improvements</p>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-stone-200 p-5">
                  <h3 className="text-sm font-semibold text-rose-700 uppercase tracking-wide mb-4">
                    Worsened
                  </h3>
                  <div className="space-y-3">
                    {analytics.dailyChanges.filter(c => c.change > 0).length > 0 ? (
                      analytics.dailyChanges.filter(c => c.change > 0).map((item, i) => (
                        <div key={i} className="flex justify-between items-center text-sm">
                          <span className="text-stone-700">{item.name}</span>
                          <span className="text-rose-600 font-medium">+{item.change}d</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-stone-400 text-sm">No delays</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-stone-200 p-8 text-center">
                <p className="text-stone-500">Need multiple days of data for comparison</p>
              </div>
            )}
          </div>
        )}

        {/* Weekly */}
        {activeTab === 'weekly' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-stone-900">Weekly Trends</h2>
              <p className="text-stone-500 text-sm">Average wait time over the past week</p>
            </div>

            {analytics && analytics.trendData.length > 1 ? (
              <>
                <div className="bg-white rounded-lg border border-stone-200 p-5">
                  <div className="h-40 flex items-end gap-3">
                    {analytics.trendData.map((point, i) => {
                      const maxWait = Math.max(...analytics.trendData.map(p => p.avgWait), 1);
                      const height = (point.avgWait / maxWait) * 100;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2">
                          <span className="text-xs text-stone-600 font-medium">
                            {point.avgWait.toFixed(1)}
                          </span>
                          <div 
                            className="w-full bg-stone-800 rounded-sm"
                            style={{ height: `${Math.max(height, 5)}%` }}
                          />
                          <span className="text-xs text-stone-400">{formatDate(point.date)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg border border-stone-200 p-5">
                    <div className="text-sm text-stone-500 mb-1">HRT Average</div>
                    <div className="text-3xl font-semibold text-stone-900 tabular-nums">
                      {analytics.trendData[analytics.trendData.length - 1].hrtAvg.toFixed(1)} days
                    </div>
                  </div>
                  <div className="bg-white rounded-lg border border-stone-200 p-5">
                    <div className="text-sm text-stone-500 mb-1">TRT Average</div>
                    <div className="text-3xl font-semibold text-stone-900 tabular-nums">
                      {analytics.trendData[analytics.trendData.length - 1].trtAvg.toFixed(1)} days
                    </div>
                  </div>
                </div>

                {analytics.weeklyChanges.length > 0 && (
                  <div className="bg-white rounded-lg border border-stone-200 p-5">
                    <h3 className="text-sm font-semibold text-stone-900 uppercase tracking-wide mb-4">
                      Notable Changes This Week
                    </h3>
                    <div className="grid md:grid-cols-2 gap-3">
                      {analytics.weeklyChanges.slice(0, 10).map((item, i) => (
                        <div key={i} className="flex justify-between items-center text-sm py-2 border-b border-stone-100 last:border-0">
                          <span className="text-stone-700">{item.name}</span>
                          <span className={item.change < 0 ? 'text-teal-600' : 'text-rose-600'}>
                            {item.change > 0 ? '+' : ''}{item.change}d
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-lg border border-stone-200 p-8 text-center">
                <p className="text-stone-500">Need more historical data for trends</p>
              </div>
            )}
          </div>
        )}

        {/* All Data */}
        {activeTab === 'data' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-stone-900">All Data</h2>
                <p className="text-stone-500 text-sm">{filteredData.length} links</p>
              </div>
              <div className="flex gap-2">
                {(['all', 'HRT', 'TRT', 'Provider'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      filter === f
                        ? 'bg-stone-900 text-white'
                        : 'bg-white text-stone-600 border border-stone-300 hover:border-stone-400'
                    }`}
                  >
                    {f === 'all' ? 'All' : f}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50">
                    <th className="px-4 py-3 text-left font-medium text-stone-600">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-stone-600">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-stone-600">Location</th>
                    <th className="px-4 py-3 text-right font-medium text-stone-600">Wait</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item, i) => {
                    const wait = getWaitLabel(item.daysOutUntilAppointment);
                    return (
                      <tr key={i} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                        <td className="px-4 py-3 text-stone-900">{item.name}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                            item.type === 'HRT' ? 'bg-rose-100 text-rose-700' :
                            item.type === 'TRT' ? 'bg-sky-100 text-sky-700' :
                            'bg-stone-100 text-stone-700'
                          }`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-stone-500">{item.location || '—'}</td>
                        <td className={`px-4 py-3 text-right font-medium tabular-nums ${wait.color}`}>
                          {wait.text}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Suggestion */}
      <div className="max-w-6xl mx-auto px-6 pb-8">
        <div className="bg-white rounded-lg border border-stone-200 p-5 flex items-center justify-between">
          <div>
            <div className="font-medium text-stone-900">Have feedback?</div>
            <div className="text-stone-500 text-sm">Help improve this dashboard</div>
          </div>
          <a
            href="mailto:daniel@fountain.net?subject=Dashboard%20Feedback"
            className="text-sm text-stone-600 hover:text-stone-900 border border-stone-300 px-4 py-2 rounded-md hover:border-stone-400 transition-colors"
          >
            Send Feedback
          </a>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center text-sm text-stone-500">
          <span>Updated daily at 5 AM EST</span>
          <a 
            href="https://docs.google.com/spreadsheets/d/1vOXJEegJHJizatcXErv_dOLuWCiz_z8fGZasSDde2tc/edit"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-stone-700"
          >
            View Spreadsheet →
          </a>
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg border border-stone-200 p-4">
      <div className="text-sm text-stone-500 mb-1">{label}</div>
      <div className="text-2xl font-semibold text-stone-900 tabular-nums">{value}</div>
    </div>
  );
}
