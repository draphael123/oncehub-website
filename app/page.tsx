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
  const [filter, setFilter] = useState<'all' | 'HRT' | 'TRT'>('all');

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

  const statesOnly = filteredData.filter(item => item.type === 'HRT' || item.type === 'TRT');
  const shortestWait = statesOnly.filter(item => item.daysOutUntilAppointment >= 0).slice(0, 10);
  const longestWait = statesOnly.filter(item => item.daysOutUntilAppointment >= 0).slice(-10).reverse();

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  const getDaysColor = (days: number) => {
    if (days < 0) return 'text-gray-400';
    if (days <= 3) return 'text-emerald-400';
    if (days <= 7) return 'text-green-400';
    if (days <= 14) return 'text-yellow-400';
    if (days <= 21) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800/50 backdrop-blur-sm bg-slate-950/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            OnceHub Availability Report
          </h1>
          {lastUpdated && (
            <p className="text-slate-400 text-sm mt-1">
              Last updated: {formatDate(lastUpdated)}
            </p>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-950/50 border border-red-800 rounded-xl p-6 text-center">
            <p className="text-red-400">{error}</p>
            <button 
              onClick={fetchData}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Shortest Wait */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                <h2 className="text-xl font-semibold text-emerald-400 mb-4 flex items-center gap-2">
                  <span className="text-2xl">🟢</span> Shortest Wait Times
                </h2>
                <div className="space-y-2">
                  {shortestWait.map((item, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-slate-800/50 last:border-0">
                      <span className="text-slate-300">{item.name}</span>
                      <span className={`font-mono font-bold ${getDaysColor(item.daysOutUntilAppointment)}`}>
                        {item.daysOutUntilAppointment} days
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Longest Wait */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                <h2 className="text-xl font-semibold text-red-400 mb-4 flex items-center gap-2">
                  <span className="text-2xl">🔴</span> Longest Wait Times
                </h2>
                <div className="space-y-2">
                  {longestWait.map((item, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-slate-800/50 last:border-0">
                      <span className="text-slate-300">{item.name}</span>
                      <span className={`font-mono font-bold ${getDaysColor(item.daysOutUntilAppointment)}`}>
                        {item.daysOutUntilAppointment} days
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6">
              {(['all', 'HRT', 'TRT'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    filter === f
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {f === 'all' ? 'All Links' : f}
                </button>
              ))}
            </div>

            {/* Full Table */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-slate-400 font-medium">Name</th>
                      <th className="px-4 py-3 text-left text-slate-400 font-medium">Type</th>
                      <th className="px-4 py-3 text-left text-slate-400 font-medium">Location</th>
                      <th className="px-4 py-3 text-right text-slate-400 font-medium">Days Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((item, i) => (
                      <tr 
                        key={i} 
                        className="border-t border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-4 py-3 text-slate-200">{item.name}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            item.type === 'HRT' ? 'bg-pink-900/50 text-pink-300' :
                            item.type === 'TRT' ? 'bg-blue-900/50 text-blue-300' :
                            'bg-slate-700 text-slate-300'
                          }`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{item.location || '-'}</td>
                        <td className={`px-4 py-3 text-right font-mono font-bold ${getDaysColor(item.daysOutUntilAppointment)}`}>
                          {item.daysOutUntilAppointment >= 0 ? item.daysOutUntilAppointment : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-6 text-center text-slate-500 text-sm">
              Showing {filteredData.length} of {data.length} links
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-slate-500 text-sm">
          Data sourced from OnceHub scheduling system
        </div>
      </footer>
    </div>
  );
}
