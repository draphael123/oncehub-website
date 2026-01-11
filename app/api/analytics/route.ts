import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const GOOGLE_SHEET_ID = '1vOXJEegJHJizatcXErv_dOLuWCiz_z8fGZasSDde2tc';

interface DataItem {
  name: string;
  type: string;
  location: string;
  daysOut: number;
}

interface DayData {
  date: string;
  tabName: string;
  data: DataItem[];
}

function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  const lines = csvText.split('\n');
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    const row: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current);
    rows.push(row);
  }
  
  return rows;
}

function parseRowsToData(rows: string[][]): DataItem[] {
  return rows.slice(1)
    .filter(row => row[0] && ['HRT', 'TRT', 'Provider'].includes(row[0].trim()))
    .map(row => {
      const daysOutRaw = (row[4] || '').trim();
      let daysOut = -1;
      const match = daysOutRaw.match(/(\d+)/);
      if (match) daysOut = parseInt(match[1], 10);
      
      return {
        name: (row[2] || '').trim(),
        type: (row[0] || '').trim(),
        location: (row[1] || '').trim(),
        daysOut,
      };
    })
    .filter(d => d.name);
}

// Generate tab names to try for a given date
function getTabNamesForDate(date: Date): string[] {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  
  const tabs: string[] = [];
  
  // Try with various timestamps
  for (const time of ['03:48:30 EST', '03:48:30 ET', '03:00:00 EST', '08:00:00 EST', '08:00:00 UTC', '']) {
    const suffix = time ? ` ${time}` : '';
    tabs.push(`Results ${month}-${day}-${year}${suffix}`);
  }
  
  // Also try YYYY-MM-DD format
  tabs.push(`Results ${year}-${month}-${day}`);
  
  return tabs;
}

async function fetchDataForDate(date: Date): Promise<DayData | null> {
  const tabNames = getTabNamesForDate(date);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  
  for (const tabName of tabNames) {
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
      const response = await fetch(csvUrl, { cache: 'no-store' });
      
      if (!response.ok) continue;
      
      const csvText = await response.text();
      if (!csvText || csvText.length < 100) continue;
      
      const rows = parseCSV(csvText);
      const hasValidData = rows.some(row => 
        row[0] && ['HRT', 'TRT', 'Provider'].includes(row[0].trim())
      );
      
      if (!hasValidData) continue;
      
      const data = parseRowsToData(rows);
      if (data.length > 0) {
        return {
          date: `${year}-${month}-${day}`,
          tabName,
          data,
        };
      }
    } catch {
      continue;
    }
  }
  
  return null;
}

async function getHistoricalData(): Promise<DayData[]> {
  const days: DayData[] = [];
  const today = new Date();
  
  // Fetch data for the past 7 days in parallel
  const promises = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    promises.push(fetchDataForDate(date));
  }
  
  const results = await Promise.all(promises);
  
  for (const result of results) {
    if (result && result.data.length > 0) {
      days.push(result);
    }
  }
  
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

function analyzeData(historical: DayData[]) {
  if (historical.length === 0) {
    return null;
  }
  
  const latest = historical[historical.length - 1];
  const previous = historical.length > 1 ? historical[historical.length - 2] : null;
  
  // Calculate current stats
  const validData = latest.data.filter(d => d.daysOut >= 0);
  const currentStats = {
    totalLinks: latest.data.length,
    avgWait: validData.length > 0 
      ? validData.reduce((sum, d) => sum + d.daysOut, 0) / validData.length 
      : 0,
    immediate: validData.filter(d => d.daysOut <= 3).length,
  };
  
  // Daily changes
  const dailyChanges: { name: string; type: string; change: number; current: number; previous: number }[] = [];
  if (previous) {
    for (const item of latest.data) {
      const prevItem = previous.data.find(p => p.name === item.name);
      if (prevItem && item.daysOut >= 0 && prevItem.daysOut >= 0) {
        const change = item.daysOut - prevItem.daysOut;
        if (change !== 0) {
          dailyChanges.push({
            name: item.name,
            type: item.type,
            change,
            current: item.daysOut,
            previous: prevItem.daysOut,
          });
        }
      }
    }
  }
  
  // Weekly changes
  const weekAgo = historical.length >= 7 ? historical[0] : null;
  const weeklyChanges: { name: string; type: string; change: number }[] = [];
  if (weekAgo) {
    for (const item of latest.data) {
      const weekItem = weekAgo.data.find(p => p.name === item.name);
      if (weekItem && item.daysOut >= 0 && weekItem.daysOut >= 0) {
        const change = item.daysOut - weekItem.daysOut;
        if (Math.abs(change) >= 2) {
          weeklyChanges.push({ name: item.name, type: item.type, change });
        }
      }
    }
  }
  
  // Trend data
  const trendData = historical.map(day => {
    const valid = day.data.filter(d => d.daysOut >= 0);
    const hrt = day.data.filter(d => d.type === 'HRT' && d.daysOut >= 0);
    const trt = day.data.filter(d => d.type === 'TRT' && d.daysOut >= 0);
    return {
      date: day.date,
      avgWait: valid.length > 0 ? valid.reduce((s, d) => s + d.daysOut, 0) / valid.length : 0,
      totalLinks: day.data.length,
      immediate: valid.filter(d => d.daysOut <= 3).length,
      hrtAvg: hrt.length > 0 ? hrt.reduce((s, d) => s + d.daysOut, 0) / hrt.length : 0,
      trtAvg: trt.length > 0 ? trt.reduce((s, d) => s + d.daysOut, 0) / trt.length : 0,
    };
  });
  
  // Best/worst states (HRT + TRT only)
  const statesOnly = latest.data.filter(d => (d.type === 'HRT' || d.type === 'TRT') && d.daysOut >= 0);
  const bestStates = [...statesOnly].sort((a, b) => a.daysOut - b.daysOut).slice(0, 10);
  const worstStates = [...statesOnly].sort((a, b) => b.daysOut - a.daysOut).slice(0, 10);
  
  // Regional analysis
  const regions: Record<string, string[]> = {
    'West': ['California', 'Oregon', 'Washington', 'Nevada', 'Arizona', 'Utah', 'Colorado', 'New Mexico', 'Montana', 'Idaho', 'Wyoming'],
    'Midwest': ['Ohio', 'Michigan', 'Indiana', 'Illinois', 'Wisconsin', 'Minnesota', 'Iowa', 'Missouri', 'Nebraska', 'Kansas'],
    'South': ['Texas', 'Florida', 'Georgia', 'North Carolina', 'Virginia', 'Tennessee', 'Kentucky', 'Maryland', 'South Carolina'],
    'Northeast': ['New York', 'New Jersey', 'Pennsylvania', 'Massachusetts', 'Connecticut', 'New Hampshire'],
  };
  
  const regionalStats = Object.entries(regions).map(([region, states]) => {
    const regionData = statesOnly.filter(d => 
      states.some(s => d.location.includes(s) || d.name.includes(s))
    );
    return {
      region,
      count: regionData.length,
      avgWait: regionData.length > 0 
        ? regionData.reduce((sum, d) => sum + d.daysOut, 0) / regionData.length 
        : 0,
    };
  });
  
  return {
    currentStats,
    dailyChanges: dailyChanges.sort((a, b) => a.change - b.change),
    weeklyChanges: weeklyChanges.sort((a, b) => a.change - b.change),
    trendData,
    bestStates,
    worstStates,
    regionalStats,
    daysAnalyzed: historical.length,
    latestDate: latest.date,
  };
}

export async function GET() {
  try {
    const historical = await getHistoricalData();
    
    console.log(`Analytics: Found ${historical.length} days of data`);
    if (historical.length > 0) {
      console.log(`Latest: ${historical[historical.length - 1].tabName} with ${historical[historical.length - 1].data.length} items`);
    }
    
    const analysis = analyzeData(historical);
    
    if (!analysis) {
      return NextResponse.json({
        success: false,
        error: 'No data available for analysis',
        currentStats: { totalLinks: 0, avgWait: 0, immediate: 0 },
        bestStates: [],
        worstStates: [],
        regionalStats: [],
        dailyChanges: [],
        weeklyChanges: [],
        trendData: [],
        daysAnalyzed: 0,
      });
    }
    
    return NextResponse.json({
      success: true,
      ...analysis,
    });
  } catch (error) {
    console.error('Analytics Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed',
      currentStats: { totalLinks: 0, avgWait: 0, immediate: 0 },
      bestStates: [],
      worstStates: [],
      regionalStats: [],
      dailyChanges: [],
      weeklyChanges: [],
      trendData: [],
      daysAnalyzed: 0,
    }, { status: 500 });
  }
}
