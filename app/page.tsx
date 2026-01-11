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

interface ApiResponse {
  success: boolean;
  count: number;
  lastUpdated: string;
  data: ScrapingResult[];
  error?: string;
}

export default function Home() {
  const [data, setData] = useState<ScrapingResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'HRT' | 'TRT' | 'Provider'>('all');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const response = await fetch('/api/data');
      const result: ApiResponse = await response.json();
      
      if (result.success) {
        setData(result.data);
        setLastUpdated(result.lastUpdated);
        setError(null);
      } else {
        setError(result.error || 'Failed to load data');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }

  const filteredData = data.filter(item => {
    if (filter === 'all') return true;
    return item.type === filter;
  });

  const statesOnly = data.filter(item => item.type === 'HRT' || item.type === 'TRT');
  const validStates = statesOnly.filter(item => item.daysOutUntilAppointment >= 0);
  const shortestWait = validStates.slice(0, 10);
  const longestWait = [...validStates].sort((a, b) => b.daysOutUntilAppointment - a.daysOutUntilAppointment).slice(0, 10);

  // Stats
  const avgDays = validStates.length > 0 
    ? (validStates.reduce((sum, item) => sum + item.daysOutUntilAppointment, 0) / validStates.length).toFixed(1)
    : '0';
  const immediate = validStates.filter(item => item.daysOutUntilAppointment <= 3).length;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getDaysColor = (days: number) => {
    if (days < 0) return 'text-gray-400';
    if (days <= 2) return 'text-emerald-400';
    if (days <= 5) return 'text-green-400';
    if (days <= 10) return 'text-amber-400';
    if (days <= 20) return 'text-orange-400';
    return 'text-rose-400';
  };

  const getDaysBg = (days: number) => {
    if (days < 0) return 'bg-gray-500/20';
    if (days <= 2) return 'bg-emerald-500/20';
    if (days <= 5) return 'bg-green-500/20';
    if (days <= 10) return 'bg-amber-500/20';
    if (days <= 20) return 'bg-orange-500/20';
    return 'bg-rose-500/20';
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-cyan-600/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute -bottom-40 right-1/3 w-72 h-72 bg-pink-600/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>

      {/* Header */}
      <header className="relative border-b border-white/10 backdrop-blur-xl bg-black/30 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-5 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 via-purple-500 to-pink-500 flex items-center justify-center text-2xl shadow-lg shadow-purple-500/25">
              📊
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                OnceHub Availability
              </h1>
              {lastUpdated && (
                <p className="text-white/50 text-sm">
                  Updated {formatDate(lastUpdated)}
                </p>
              )}
            </div>
          </div>
          <a 
            href="https://docs.google.com/spreadsheets/d/1vOXJEegJHJizatcXErv_dOLuWCiz_z8fGZasSDde2tc/edit"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white rounded-xl font-medium text-sm flex items-center gap-2 transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-105"
          >
            <span>📄</span>
            View Full Report
          </a>
        </div>
      </header>

      <main className="relative max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-purple-500/30 rounded-full"></div>
              <div className="w-20 h-20 border-4 border-transparent border-t-cyan-400 rounded-full animate-spin absolute top-0"></div>
            </div>
            <p className="mt-6 text-white/60 animate-pulse">Loading availability data...</p>
          </div>
        ) : error ? (
          <div className="bg-gradient-to-r from-rose-500/10 to-orange-500/10 border border-rose-500/30 rounded-2xl p-8 text-center max-w-md mx-auto">
            <div className="text-5xl mb-4">⚠️</div>
            <p className="text-rose-400 text-lg mb-4">{error}</p>
            <button 
              onClick={fetchData}
              className="px-6 py-3 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 rounded-xl text-white font-medium transition-all hover:scale-105"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20 rounded-2xl p-5 backdrop-blur-sm">
                <div className="text-cyan-400 text-sm font-medium mb-1">Total Links</div>
                <div className="text-4xl font-bold text-white">{data.length}</div>
              </div>
              <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 backdrop-blur-sm">
                <div className="text-emerald-400 text-sm font-medium mb-1">Immediate (≤3 days)</div>
                <div className="text-4xl font-bold text-white">{immediate}</div>
              </div>
              <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 rounded-2xl p-5 backdrop-blur-sm">
                <div className="text-purple-400 text-sm font-medium mb-1">Avg Wait Time</div>
                <div className="text-4xl font-bold text-white">{avgDays}<span className="text-lg text-white/50 ml-1">days</span></div>
              </div>
              <div className="bg-gradient-to-br from-pink-500/10 to-pink-500/5 border border-pink-500/20 rounded-2xl p-5 backdrop-blur-sm">
                <div className="text-pink-400 text-sm font-medium mb-1">States Tracked</div>
                <div className="text-4xl font-bold text-white">{statesOnly.length}</div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Shortest Wait */}
              <div className="bg-gradient-to-br from-emerald-500/10 via-green-500/5 to-transparent border border-emerald-500/20 rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-xl">⚡</div>
                  <h2 className="text-xl font-bold text-emerald-400">Shortest Wait Times</h2>
                </div>
                <div className="space-y-2">
                  {shortestWait.map((item, i) => (
                    <div 
                      key={i} 
                      className="flex justify-between items-center py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                      style={{animationDelay: `${i * 50}ms`}}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-emerald-400/60 text-sm font-mono w-5">{i + 1}</span>
                        <span className="text-white">{item.name}</span>
                      </div>
                      <span className={`font-bold px-3 py-1 rounded-lg ${getDaysBg(item.daysOutUntilAppointment)} ${getDaysColor(item.daysOutUntilAppointment)}`}>
                        {item.daysOutUntilAppointment}d
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Longest Wait */}
              <div className="bg-gradient-to-br from-rose-500/10 via-orange-500/5 to-transparent border border-rose-500/20 rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center text-xl">🕐</div>
                  <h2 className="text-xl font-bold text-rose-400">Longest Wait Times</h2>
                </div>
                <div className="space-y-2">
                  {longestWait.map((item, i) => (
                    <div 
                      key={i} 
                      className="flex justify-between items-center py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-rose-400/60 text-sm font-mono w-5">{i + 1}</span>
                        <span className="text-white">{item.name}</span>
                      </div>
                      <span className={`font-bold px-3 py-1 rounded-lg ${getDaysBg(item.daysOutUntilAppointment)} ${getDaysColor(item.daysOutUntilAppointment)}`}>
                        {item.daysOutUntilAppointment}d
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              {(['all', 'HRT', 'TRT', 'Provider'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
                    filter === f
                      ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg shadow-purple-500/25'
                      : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10'
                  }`}
                >
                  {f === 'all' ? '🌐 All Links' : f === 'HRT' ? '💗 HRT' : f === 'TRT' ? '💙 TRT' : '👤 Providers'}
                </button>
              ))}
            </div>

            {/* Full Table */}
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-white/5">
                      <th className="px-5 py-4 text-left text-white/60 font-medium text-sm">Name</th>
                      <th className="px-5 py-4 text-left text-white/60 font-medium text-sm">Type</th>
                      <th className="px-5 py-4 text-left text-white/60 font-medium text-sm">Location</th>
                      <th className="px-5 py-4 text-right text-white/60 font-medium text-sm">Wait Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((item, i) => (
                      <tr 
                        key={i} 
                        className="border-t border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <td className="px-5 py-4 text-white font-medium">{item.name}</td>
                        <td className="px-5 py-4">
                          <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                            item.type === 'HRT' ? 'bg-pink-500/20 text-pink-400' :
                            item.type === 'TRT' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-purple-500/20 text-purple-400'
                          }`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-white/60">{item.location || '—'}</td>
                        <td className="px-5 py-4 text-right">
                          <span className={`font-bold px-3 py-1.5 rounded-lg ${getDaysBg(item.daysOutUntilAppointment)} ${getDaysColor(item.daysOutUntilAppointment)}`}>
                            {item.daysOutUntilAppointment >= 0 ? `${item.daysOutUntilAppointment} days` : 'N/A'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Stats Footer */}
            <div className="mt-6 text-center text-white/40 text-sm">
              Showing {filteredData.length} of {data.length} links
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="relative border-t border-white/10 mt-16">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-white/40 text-sm">
              Data refreshed daily from OnceHub scheduling system
            </div>
            <a 
              href="https://docs.google.com/spreadsheets/d/1vOXJEegJHJizatcXErv_dOLuWCiz_z8fGZasSDde2tc/edit"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-2 transition-colors"
            >
              <span>📊</span>
              View Complete Spreadsheet
              <span>→</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
