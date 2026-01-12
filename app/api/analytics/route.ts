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
        
        // Skip dashboard/summary rows - these have numeric data like "22 (100.0%)"
        if (/^\d+\s*\([\d.]+%\)$/.test(name)) continue;
        
        // Skip excluded names
        if (name.toLowerCase().includes('daniel raphael')) continue;
        
        // Require valid oncehub.com URL in column 3
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
        console.log(`Analytics: Found ${data.length} items in tab "${tabName}"`);
        return data;
      }
    } catch {
      continue;
    }
  }
  
  return null;
}

export async function GET() {
  try {
    // Try to get today's data
    const today = new Date();
    let latestData = await fetchDataForDate(today);
    let dataDate = today;
    
    // If no data today, try yesterday
    if (!latestData || latestData.length === 0) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      latestData = await fetchDataForDate(yesterday);
      dataDate = yesterday;
    }
    
    // Try 2 days ago
    if (!latestData || latestData.length === 0) {
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      latestData = await fetchDataForDate(twoDaysAgo);
      dataDate = twoDaysAgo;
    }
    
    if (!latestData || latestData.length === 0) {
      console.log('Analytics: No data found for any recent date');
      return NextResponse.json({
        success: false,
        error: 'No data available',
        currentStats: { totalLinks: 0, avgWait: 0, immediate: 0 },
        bestStates: [],
        worstStates: [],
        regionalStats: [],
        dailyChanges: [],
        trendData: [],
        daysAnalyzed: 0,
      });
    }

    console.log(`Analytics: Using ${latestData.length} items from ${dataDate.toDateString()}`);

    // Calculate stats from the data
    const validData = latestData.filter(d => d.daysOut >= 0);
    
    const currentStats = {
      totalLinks: latestData.length,
      avgWait: validData.length > 0 
        ? validData.reduce((sum, d) => sum + d.daysOut, 0) / validData.length 
        : 0,
      immediate: validData.filter(d => d.daysOut <= 3).length,
    };

    // Get states only (HRT + TRT)
    const statesOnly = latestData.filter(d => 
      (d.type === 'HRT' || d.type === 'TRT') && d.daysOut >= 0
    );
    
    // Best (shortest wait) and worst (longest wait) states
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

    return NextResponse.json({
      success: true,
      currentStats,
      bestStates,
      worstStates,
      regionalStats,
      dailyChanges: [],
      weeklyChanges: [],
      trendData: [],
      daysAnalyzed: 1,
      latestDate: dataDate.toISOString().split('T')[0],
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
      trendData: [],
      daysAnalyzed: 0,
    }, { status: 500 });
  }
}
