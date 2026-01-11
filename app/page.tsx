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
  const [activeTab, setActiveTab] = useState<'overview' | 'daily' | 'weekly' | 'trends'>('overview');
  const [filter, setFilter] = useState<'all' | 'HRT' | 'TRT' | 'Provider'>('all');

  useEffect(() => {
    Promise.all([fetchData(), fetchAnalytics()]).finally(() => setLoading(false));
  }, []);

  async function fetchData() {
    try {
      const response = await fetch('/api/data');
      const result = await response.json();
      if (result.success) setData(result.data);
    } catch (err) {
      console.error('Data fetch error:', err);
    }
  }

  async function fetchAnalytics() {
    try {
      const response = await fetch('/api/analytics');
      const result = await response.json();
      if (result.success) setAnalytics(result);
    } catch (err) {
      console.error('Analytics fetch error:', err);
    }
  }

  const filteredData = data.filter(item => filter === 'all' || item.type === filter);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getDaysColor = (days: number) => {
    if (days < 0) return 'text-gray-400';
    if (days <= 2) return 'text-emerald-400';
    if (days <= 5) return 'text-green-400';
    if (days <= 10) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getChangeColor = (change: number) => {
    if (change < 0) return 'text-emerald-400';
    if (change > 0) return 'text-rose-400';
    return 'text-gray-400';
  };

  const getChangeBg = (change: number) => {
    if (change < 0) return 'bg-emerald-500/20';
    if (change > 0) return 'bg-rose-500/20';
    return 'bg-gray-500/20';
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-cyan-600/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute -bottom-40 right-1/3 w-72 h-72 bg-pink-600/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>

      {/* Header */}
      <header className="relative border-b border-white/10 backdrop-blur-xl bg-black/30 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 via-purple-500 to-pink-500 flex items-center justify-center text-xl">
              📊
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                OnceHub Analytics
              </h1>
              <p className="text-white/40 text-xs">Real-time availability tracking & insights</p>
            </div>
          </div>
          <a 
            href="https://docs.google.com/spreadsheets/d/1vOXJEegJHJizatcXErv_dOLuWCiz_z8fGZasSDde2tc/edit"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white rounded-lg font-medium text-sm transition-all hover:scale-105"
          >
            📄 Full Report
          </a>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="relative border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {[
              { id: 'overview', label: '📈 Overview', icon: '📈' },
              { id: 'daily', label: '📅 Daily Report', icon: '📅' },
              { id: 'weekly', label: '📊 Weekly Trends', icon: '📊' },
              { id: 'trends', label: '🔮 Analysis', icon: '🔮' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-5 py-3 font-medium text-sm transition-all border-b-2 ${
                  activeTab === tab.id
                    ? 'text-cyan-400 border-cyan-400 bg-cyan-400/5'
                    : 'text-white/50 border-transparent hover:text-white/80 hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="relative max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-purple-500/30 rounded-full"></div>
              <div className="w-16 h-16 border-4 border-transparent border-t-cyan-400 rounded-full animate-spin absolute top-0"></div>
            </div>
            <p className="mt-4 text-white/60">Loading analytics...</p>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard title="Total Links" value={data.length} icon="🔗" color="cyan" />
                  <MetricCard title="Immediate (≤3d)" value={analytics?.currentStats.immediate || 0} icon="⚡" color="emerald" />
                  <MetricCard title="Avg Wait" value={`${(analytics?.currentStats.avgWait || 0).toFixed(1)}d`} icon="⏱️" color="purple" />
                  <MetricCard title="Days Analyzed" value={analytics?.daysAnalyzed || 1} icon="📅" color="pink" />
                </div>

                {/* Quick Insights */}
                {analytics && (
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Top Performers */}
                    <div className="bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-2xl p-5">
                      <h3 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2">
                        <span>🏆</span> Best Availability
                      </h3>
                      <div className="space-y-2">
                        {analytics.bestStates.map((item, i) => (
                          <div key={i} className="flex justify-between items-center py-2 px-3 rounded-lg bg-white/5">
                            <span className="text-white/90">{item.name}</span>
                            <span className="text-emerald-400 font-bold">{item.daysOut}d</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Needs Attention */}
                    <div className="bg-gradient-to-br from-rose-500/10 to-transparent border border-rose-500/20 rounded-2xl p-5">
                      <h3 className="text-lg font-bold text-rose-400 mb-4 flex items-center gap-2">
                        <span>⚠️</span> Longest Waits
                      </h3>
                      <div className="space-y-2">
                        {analytics.worstStates.map((item, i) => (
                          <div key={i} className="flex justify-between items-center py-2 px-3 rounded-lg bg-white/5">
                            <span className="text-white/90">{item.name}</span>
                            <span className="text-rose-400 font-bold">{item.daysOut}d</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Regional Analysis */}
                {analytics && analytics.regionalStats.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <span>🗺️</span> Regional Overview
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {analytics.regionalStats.map((region, i) => (
                        <div key={i} className="bg-white/5 rounded-xl p-4 text-center">
                          <div className="text-white/60 text-sm mb-1">{region.region}</div>
                          <div className="text-2xl font-bold text-white">{region.avgWait.toFixed(1)}d</div>
                          <div className="text-white/40 text-xs">{region.count} links</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Daily Report Tab */}
            {activeTab === 'daily' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 rounded-2xl p-6">
                  <h2 className="text-2xl font-bold text-white mb-2">📅 Daily Report</h2>
                  <p className="text-white/60">Changes from yesterday to today</p>
                </div>

                {analytics && analytics.dailyChanges.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Improved */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                      <h3 className="text-lg font-bold text-emerald-400 mb-4">✅ Improved (Faster)</h3>
                      <div className="space-y-2">
                        {analytics.dailyChanges.filter(c => c.change < 0).map((item, i) => (
                          <div key={i} className="flex justify-between items-center py-2 px-3 rounded-lg bg-emerald-500/10">
                            <div>
                              <span className="text-white">{item.name}</span>
                              <span className="text-white/40 text-sm ml-2">({item.type})</span>
                            </div>
                            <div className="text-right">
                              <span className="text-emerald-400 font-bold">{item.change}d</span>
                              <span className="text-white/40 text-sm ml-2">{item.previous}→{item.current}</span>
                            </div>
                          </div>
                        ))}
                        {analytics.dailyChanges.filter(c => c.change < 0).length === 0 && (
                          <p className="text-white/40 text-center py-4">No improvements today</p>
                        )}
                      </div>
                    </div>

                    {/* Worsened */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                      <h3 className="text-lg font-bold text-rose-400 mb-4">⚠️ Worsened (Slower)</h3>
                      <div className="space-y-2">
                        {analytics.dailyChanges.filter(c => c.change > 0).map((item, i) => (
                          <div key={i} className="flex justify-between items-center py-2 px-3 rounded-lg bg-rose-500/10">
                            <div>
                              <span className="text-white">{item.name}</span>
                              <span className="text-white/40 text-sm ml-2">({item.type})</span>
                            </div>
                            <div className="text-right">
                              <span className="text-rose-400 font-bold">+{item.change}d</span>
                              <span className="text-white/40 text-sm ml-2">{item.previous}→{item.current}</span>
                            </div>
                          </div>
                        ))}
                        {analytics.dailyChanges.filter(c => c.change > 0).length === 0 && (
                          <p className="text-white/40 text-center py-4">No delays today</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-white/40">
                    <p>No daily comparison data available yet.</p>
                    <p className="text-sm mt-2">Check back tomorrow for daily changes.</p>
                  </div>
                )}
              </div>
            )}

            {/* Weekly Trends Tab */}
            {activeTab === 'weekly' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-6">
                  <h2 className="text-2xl font-bold text-white mb-2">📊 Weekly Trends</h2>
                  <p className="text-white/60">How availability has changed over the past week</p>
                </div>

                {/* Trend Chart */}
                {analytics && analytics.trendData.length > 1 && (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <h3 className="text-lg font-bold text-white mb-4">Average Wait Time Trend</h3>
                    <div className="h-48 flex items-end gap-2">
                      {analytics.trendData.map((point, i) => {
                        const maxWait = Math.max(...analytics.trendData.map(p => p.avgWait));
                        const height = (point.avgWait / maxWait) * 100;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-2">
                            <div 
                              className="w-full bg-gradient-to-t from-cyan-500 to-purple-500 rounded-t-lg transition-all hover:from-cyan-400 hover:to-purple-400"
                              style={{ height: `${height}%`, minHeight: '20px' }}
                            >
                              <div className="text-center text-xs font-bold text-white pt-1">
                                {point.avgWait.toFixed(1)}d
                              </div>
                            </div>
                            <div className="text-white/40 text-xs">{formatDate(point.date)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Weekly Changes */}
                {analytics && analytics.weeklyChanges.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <h3 className="text-lg font-bold text-white mb-4">Significant Weekly Changes</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {analytics.weeklyChanges.map((item, i) => (
                        <div key={i} className={`flex justify-between items-center py-3 px-4 rounded-lg ${getChangeBg(item.change)}`}>
                          <div>
                            <span className="text-white font-medium">{item.name}</span>
                            <span className="text-white/40 text-sm ml-2">{item.type}</span>
                          </div>
                          <div className={`font-bold ${getChangeColor(item.change)}`}>
                            {item.change > 0 ? '+' : ''}{item.change}d
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* HRT vs TRT Comparison */}
                {analytics && analytics.trendData.length > 0 && (
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-gradient-to-br from-pink-500/10 to-transparent border border-pink-500/20 rounded-2xl p-5">
                      <h3 className="text-lg font-bold text-pink-400 mb-3">💗 HRT Trend</h3>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-white">
                          {analytics.trendData[analytics.trendData.length - 1].hrtAvg.toFixed(1)}
                        </span>
                        <span className="text-white/40">days avg</span>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 rounded-2xl p-5">
                      <h3 className="text-lg font-bold text-blue-400 mb-3">💙 TRT Trend</h3>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-white">
                          {analytics.trendData[analytics.trendData.length - 1].trtAvg.toFixed(1)}
                        </span>
                        <span className="text-white/40">days avg</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Analysis Tab */}
            {activeTab === 'trends' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-6">
                  <h2 className="text-2xl font-bold text-white mb-2">🔮 Data Analysis</h2>
                  <p className="text-white/60">Deep dive into availability patterns</p>
                </div>

                {/* Filter */}
                <div className="flex flex-wrap gap-2">
                  {(['all', 'HRT', 'TRT', 'Provider'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                        filter === f
                          ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white'
                          : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      {f === 'all' ? 'All' : f}
                    </button>
                  ))}
                </div>

                {/* Full Data Table */}
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-white/5">
                        <th className="px-4 py-3 text-left text-white/60 text-sm">Name</th>
                        <th className="px-4 py-3 text-left text-white/60 text-sm">Type</th>
                        <th className="px-4 py-3 text-left text-white/60 text-sm">Location</th>
                        <th className="px-4 py-3 text-right text-white/60 text-sm">Wait</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.map((item, i) => (
                        <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                          <td className="px-4 py-3 text-white">{item.name}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              item.type === 'HRT' ? 'bg-pink-500/20 text-pink-400' :
                              item.type === 'TRT' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-purple-500/20 text-purple-400'
                            }`}>{item.type}</span>
                          </td>
                          <td className="px-4 py-3 text-white/60">{item.location || '—'}</td>
                          <td className={`px-4 py-3 text-right font-bold ${getDaysColor(item.daysOutUntilAppointment)}`}>
                            {item.daysOutUntilAppointment >= 0 ? `${item.daysOutUntilAppointment}d` : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Suggestion Box */}
      <div className="relative max-w-7xl mx-auto px-4 mt-12">
        <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-2xl">
                💡
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Have a Suggestion?</h3>
                <p className="text-white/60 text-sm">Help us improve this dashboard with your feedback</p>
              </div>
            </div>
            <a
              href="mailto:daniel@fountain.net?subject=OnceHub%20Dashboard%20Suggestion&body=Hi%2C%0A%0AI%20have%20a%20suggestion%20for%20the%20OnceHub%20dashboard%3A%0A%0A"
              className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white rounded-xl font-medium transition-all hover:scale-105 shadow-lg shadow-purple-500/25 flex items-center gap-2"
            >
              <span>✉️</span>
              Send Suggestion
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative border-t border-white/10 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-white/40 text-sm">
            Data refreshed daily at 5 AM EST
          </div>
          <a 
            href="https://docs.google.com/spreadsheets/d/1vOXJEegJHJizatcXErv_dOLuWCiz_z8fGZasSDde2tc/edit"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 text-sm"
          >
            View Complete Spreadsheet →
          </a>
        </div>
      </footer>
    </div>
  );
}

function MetricCard({ title, value, icon, color }: { title: string; value: string | number; icon: string; color: string }) {
  const colorClasses: Record<string, string> = {
    cyan: 'from-cyan-500/10 to-cyan-500/5 border-cyan-500/20',
    emerald: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20',
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-500/20',
    pink: 'from-pink-500/10 to-pink-500/5 border-pink-500/20',
  };
  
  const textColors: Record<string, string> = {
    cyan: 'text-cyan-400',
    emerald: 'text-emerald-400',
    purple: 'text-purple-400',
    pink: 'text-pink-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-2xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className={`text-sm font-medium ${textColors[color]}`}>{title}</span>
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
    </div>
  );
}
