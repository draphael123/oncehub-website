import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const GOOGLE_SHEET_ID = '1vOXJEegJHJizatcXErv_dOLuWCiz_z8fGZasSDde2tc';

interface DayData {
  date: string;
  tabName: string;
  data: {
    name: string;
    type: string;
    location: string;
    daysOut: number;
  }[];
}

async function fetchTabData(tabName: string): Promise<any[]> {
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
    const response = await fetch(csvUrl, { cache: 'no-store' });
    
    if (!response.ok) return [];
    
    const csvText = await response.text();
    return parseCSV(csvText);
  } catch {
    return [];
  }
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

async function getHistoricalData(): Promise<DayData[]> {
  const days: DayData[] = [];
  const today = new Date();
  
  // Try to fetch last 7 days of data
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    
    // Try different tab name formats
    const possibleTabs = [
      `Results ${month}-${day}-${year}`,
      `Results ${year}-${month}-${day}`,
    ];
    
    for (const tabName of possibleTabs) {
      const rows = await fetchTabData(tabName);
      if (rows.length > 1) {
        const data = rows.slice(1)
          .filter(row => row[0] && ['HRT', 'TRT', 'Provider'].includes(row[0].trim()))
          .map(row => ({
            name: (row[2] || '').trim(),
            type: (row[0] || '').trim(),
            location: (row[1] || '').trim(),
            daysOut: parseInt((row[4] || '').replace(/[^\d]/g, '')) || -1,
          }));
        
        if (data.length > 0) {
          days.push({
            date: `${year}-${month}-${day}`,
            tabName,
            data,
          });
          break;
        }
      }
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
  const weekAgo = historical.length >= 7 ? historical[0] : null;
  
  // Calculate current stats
  const currentStats = {
    totalLinks: latest.data.length,
    avgWait: latest.data.filter(d => d.daysOut >= 0).reduce((sum, d) => sum + d.daysOut, 0) / 
             latest.data.filter(d => d.daysOut >= 0).length || 0,
    immediate: latest.data.filter(d => d.daysOut >= 0 && d.daysOut <= 3).length,
    byType: {
      HRT: latest.data.filter(d => d.type === 'HRT'),
      TRT: latest.data.filter(d => d.type === 'TRT'),
      Provider: latest.data.filter(d => d.type === 'Provider'),
    }
  };
  
  // Daily changes (vs yesterday)
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
  const weeklyChanges: { name: string; type: string; change: number; current: number; weekAgo: number }[] = [];
  if (weekAgo) {
    for (const item of latest.data) {
      const weekItem = weekAgo.data.find(p => p.name === item.name);
      if (weekItem && item.daysOut >= 0 && weekItem.daysOut >= 0) {
        const change = item.daysOut - weekItem.daysOut;
        if (Math.abs(change) >= 2) { // Only significant changes
          weeklyChanges.push({
            name: item.name,
            type: item.type,
            change,
            current: item.daysOut,
            weekAgo: weekItem.daysOut,
          });
        }
      }
    }
  }
  
  // Trends over time
  const trendData = historical.map(day => {
    const validData = day.data.filter(d => d.daysOut >= 0);
    return {
      date: day.date,
      avgWait: validData.reduce((sum, d) => sum + d.daysOut, 0) / validData.length || 0,
      totalLinks: day.data.length,
      immediate: validData.filter(d => d.daysOut <= 3).length,
      hrtAvg: day.data.filter(d => d.type === 'HRT' && d.daysOut >= 0).reduce((sum, d) => sum + d.daysOut, 0) / 
              day.data.filter(d => d.type === 'HRT' && d.daysOut >= 0).length || 0,
      trtAvg: day.data.filter(d => d.type === 'TRT' && d.daysOut >= 0).reduce((sum, d) => sum + d.daysOut, 0) / 
              day.data.filter(d => d.type === 'TRT' && d.daysOut >= 0).length || 0,
    };
  });
  
  // Identify best/worst performers
  const statesOnly = latest.data.filter(d => d.type === 'HRT' || d.type === 'TRT');
  const bestStates = [...statesOnly].filter(d => d.daysOut >= 0).sort((a, b) => a.daysOut - b.daysOut).slice(0, 5);
  const worstStates = [...statesOnly].filter(d => d.daysOut >= 0).sort((a, b) => b.daysOut - a.daysOut).slice(0, 5);
  
  // Regional analysis
  const regions: Record<string, string[]> = {
    'West': ['California', 'Oregon', 'Washington', 'Nevada', 'Arizona', 'Utah', 'Colorado', 'New Mexico', 'Montana', 'Idaho', 'Wyoming'],
    'Midwest': ['Ohio', 'Michigan', 'Indiana', 'Illinois', 'Wisconsin', 'Minnesota', 'Iowa', 'Missouri', 'Nebraska', 'Kansas', 'North Dakota', 'South Dakota'],
    'South': ['Texas', 'Florida', 'Georgia', 'North Carolina', 'Virginia', 'Tennessee', 'Kentucky', 'Alabama', 'Mississippi', 'Louisiana', 'Arkansas', 'Oklahoma', 'South Carolina', 'Maryland'],
    'Northeast': ['New York', 'New Jersey', 'Pennsylvania', 'Massachusetts', 'Connecticut', 'New Hampshire', 'Vermont', 'Maine', 'Rhode Island', 'Delaware'],
  };
  
  const regionalStats = Object.entries(regions).map(([region, states]) => {
    const regionData = statesOnly.filter(d => states.some(s => d.location.includes(s) || d.name.includes(s)));
    const validData = regionData.filter(d => d.daysOut >= 0);
    return {
      region,
      count: regionData.length,
      avgWait: validData.length > 0 ? validData.reduce((sum, d) => sum + d.daysOut, 0) / validData.length : 0,
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
    const analysis = analyzeData(historical);
    
    if (!analysis) {
      return NextResponse.json({
        success: false,
        error: 'No data available for analysis',
      }, { status: 404 });
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
    }, { status: 500 });
  }
}

