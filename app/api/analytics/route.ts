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
  date: Date;
  data: DataItem[];
  avgWait: number;
  hrtAvg: number;
  trtAvg: number;
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

// Generate tab names to try for a given date
function generateTabNames(date: Date): string[] {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  
  const tabs: string[] = [];
  const baseDate = `${month}-${day}-${year}`;
  
  // Most common scrape start times
  const commonTimes = [
    '03:00', '03:05', '03:10', '03:15', '03:17', '03:20', '03:25', '03:30',
    '03:35', '03:40', '03:45', '03:48', '03:50', '03:55',
    '04:00', '04:05', '04:10'
  ];
  
  for (const time of commonTimes) {
    tabs.push(`Results ${baseDate} ${time}:00 EST`);
    tabs.push(`Results ${baseDate} ${time}:09 EST`);
    tabs.push(`Results ${baseDate} ${time}:30 EST`);
  }
  
  tabs.push(`Results ${baseDate}`);
  tabs.push(`Results ${year}-${month}-${day}`);
  
  return tabs;
}

async function fetchDataForDate(date: Date): Promise<DataItem[] | null> {
  const tabNames = generateTabNames(date);
  
  for (const tabName of tabNames) {
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
      const response = await fetch(csvUrl, { cache: 'no-store' });
      
      if (!response.ok) continue;
      
      const csvText = await response.text();
      if (!csvText || csvText.length < 50) continue;
      
      const rows = parseCSV(csvText);
      
      // Check if valid data exists
      const hasValidData = rows.some(row => 
        row[0] && ['HRT', 'TRT', 'Provider'].includes(row[0].trim())
      );
      
      if (!hasValidData) continue;
      
      // Parse the rows
      const data: DataItem[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const category = (row[0] || '').trim();
        if (!['HRT', 'TRT', 'Provider'].includes(category)) continue;
        
        const name = (row[2] || '').trim();
        if (!name) continue;
        
        // Skip dashboard/summary rows
        if (/^\d+\s*\([\d.]+%\)$/.test(name)) continue;
        
        // Skip excluded names
        if (name.toLowerCase().includes('daniel raphael')) continue;
        
        // Require valid oncehub.com URL
        const url = (row[3] || '').trim();
        if (!url.includes('oncehub.com')) continue;
        
        const daysOutRaw = (row[4] || '').trim();
        let daysOut = -1;
        const match = daysOutRaw.match(/(\d+)/);
        if (match) daysOut = parseInt(match[1], 10);
        
        data.push({
          name,
          type: category,
          location: (row[1] || '').trim(),
          daysOut,
        });
      }
      
      if (data.length > 0) {
        return data;
      }
    } catch {
      continue;
    }
  }
  
  return null;
}

function calculateDayStats(data: DataItem[]): { avgWait: number; hrtAvg: number; trtAvg: number } {
  const valid = data.filter(d => d.daysOut >= 0);
  const hrt = valid.filter(d => d.type === 'HRT');
  const trt = valid.filter(d => d.type === 'TRT');
  
  return {
    avgWait: valid.length > 0 ? valid.reduce((s, d) => s + d.daysOut, 0) / valid.length : 0,
    hrtAvg: hrt.length > 0 ? hrt.reduce((s, d) => s + d.daysOut, 0) / hrt.length : 0,
    trtAvg: trt.length > 0 ? trt.reduce((s, d) => s + d.daysOut, 0) / trt.length : 0,
  };
}

export async function GET() {
  try {
    // Fetch data for the last 7 days
    const allDaysData: DayData[] = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      const data = await fetchDataForDate(date);
      if (data && data.length > 0) {
        const stats = calculateDayStats(data);
        allDaysData.push({
          date,
          data,
          avgWait: stats.avgWait,
          hrtAvg: stats.hrtAvg,
          trtAvg: stats.trtAvg,
        });
      }
    }

    if (allDaysData.length === 0) {
      console.log('Analytics: No data found for any recent date');
      return NextResponse.json({
        success: false,
        error: 'No data available',
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

    // Latest data (today or most recent)
    const latestDay = allDaysData[0];
    const latestData = latestDay.data;
    const previousDay = allDaysData.length > 1 ? allDaysData[1] : null;
    const weekAgoDay = allDaysData.length >= 7 ? allDaysData[6] : null;

    console.log(`Analytics: Using ${latestData.length} items from ${latestDay.date.toDateString()}`);

    // Calculate current stats
    const validData = latestData.filter(d => d.daysOut >= 0);
    
    const currentStats = {
      totalLinks: latestData.length,
      avgWait: validData.length > 0 
        ? validData.reduce((sum, d) => sum + d.daysOut, 0) / validData.length 
        : 0,
      immediate: validData.filter(d => d.daysOut <= 3).length,
    };

    // Previous day average for headline comparison
    const previousDayAvg = previousDay ? previousDay.avgWait : undefined;

    // Get states only (HRT + TRT)
    const statesOnly = latestData.filter(d => 
      (d.type === 'HRT' || d.type === 'TRT') && d.daysOut >= 0
    );
    
    // Best and worst states
    const sortedBest = [...statesOnly].sort((a, b) => a.daysOut - b.daysOut);
    const sortedWorst = [...statesOnly].sort((a, b) => b.daysOut - a.daysOut);
    
    const bestStates = sortedBest.slice(0, 10).map(d => ({
      name: d.name,
      type: d.type,
      location: d.location,
      daysOut: d.daysOut,
    }));
    
    const worstStates = sortedWorst.slice(0, 10).map(d => ({
      name: d.name,
      type: d.type,
      location: d.location,
      daysOut: d.daysOut,
    }));

    // Regional analysis
    const regions: Record<string, string[]> = {
      'West': ['California', 'CA', 'Oregon', 'OR', 'Washington', 'WA', 'Nevada', 'NV', 'Arizona', 'AZ', 'Utah', 'UT', 'Colorado', 'CO', 'New Mexico', 'NM', 'Montana', 'MT', 'Idaho', 'ID', 'Wyoming', 'WY', 'Alaska', 'AK', 'Hawaii', 'HI'],
      'Midwest': ['Ohio', 'OH', 'Michigan', 'MI', 'Indiana', 'IN', 'Illinois', 'IL', 'Wisconsin', 'WI', 'Minnesota', 'MN', 'Iowa', 'IA', 'Missouri', 'MO', 'Nebraska', 'NE', 'Kansas', 'KS', 'North Dakota', 'ND', 'South Dakota', 'SD'],
      'South': ['Texas', 'TX', 'Florida', 'FL', 'Georgia', 'GA', 'North Carolina', 'NC', 'Virginia', 'VA', 'Tennessee', 'TN', 'Kentucky', 'KY', 'Alabama', 'AL', 'Mississippi', 'MS', 'Louisiana', 'LA', 'Arkansas', 'AR', 'Oklahoma', 'OK', 'South Carolina', 'SC', 'Maryland', 'MD', 'West Virginia', 'WV', 'Delaware', 'DE', 'DC'],
      'Northeast': ['New York', 'NY', 'New Jersey', 'NJ', 'Pennsylvania', 'PA', 'Massachusetts', 'MA', 'Connecticut', 'CT', 'New Hampshire', 'NH', 'Vermont', 'VT', 'Maine', 'ME', 'Rhode Island', 'RI'],
    };
    
    const regionalStats = Object.entries(regions).map(([region, keywords]) => {
      const regionData = statesOnly.filter(d => 
        keywords.some(kw => 
          d.location.includes(kw) || 
          d.name.includes(kw) ||
          d.location.toLowerCase() === kw.toLowerCase()
        )
      );
      return {
        region,
        count: regionData.length,
        avgWait: regionData.length > 0 
          ? regionData.reduce((sum, d) => sum + d.daysOut, 0) / regionData.length 
          : 0,
      };
    });

    // Daily changes (compare today vs yesterday)
    const dailyChanges: { name: string; type: string; change: number; current: number; previousValue?: number }[] = [];
    if (previousDay) {
      for (const item of latestData) {
        if (item.daysOut < 0) continue;
        const prevItem = previousDay.data.find(d => d.name === item.name);
        if (prevItem && prevItem.daysOut >= 0) {
          const change = item.daysOut - prevItem.daysOut;
          if (change !== 0) {
            dailyChanges.push({
              name: item.name,
              type: item.type,
              change,
              current: item.daysOut,
              previousValue: prevItem.daysOut,
            });
          }
        }
      }
      // Sort by absolute change
      dailyChanges.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    }

    // Weekly changes (compare today vs 7 days ago)
    const weeklyChanges: { name: string; type: string; change: number }[] = [];
    if (weekAgoDay) {
      for (const item of latestData) {
        if (item.daysOut < 0) continue;
        const weekItem = weekAgoDay.data.find(d => d.name === item.name);
        if (weekItem && weekItem.daysOut >= 0) {
          const change = item.daysOut - weekItem.daysOut;
          if (change !== 0) {
            weeklyChanges.push({
              name: item.name,
              type: item.type,
              change,
            });
          }
        }
      }
      weeklyChanges.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    }

    // Trend data (reverse so oldest is first)
    const trendData = allDaysData.reverse().map(day => ({
      date: day.date.toISOString().split('T')[0],
      avgWait: day.avgWait,
      hrtAvg: day.hrtAvg,
      trtAvg: day.trtAvg,
    }));

    return NextResponse.json({
      success: true,
      currentStats,
      previousDayAvg,
      bestStates,
      worstStates,
      regionalStats,
      dailyChanges,
      weeklyChanges,
      trendData,
      daysAnalyzed: allDaysData.length,
      latestDate: latestDay.date.toISOString().split('T')[0],
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
