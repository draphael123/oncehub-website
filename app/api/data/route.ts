import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const GOOGLE_SHEET_ID = '1vOXJEegJHJizatcXErv_dOLuWCiz_z8fGZasSDde2tc';

interface ScrapingResult {
  name: string;
  type: string;
  location: string;
  daysOutUntilAppointment: number;
  firstAvailableDate: string | null;
  scrapedAt: string;
  error?: string;
}

// Known recent Results tabs - we'll try these in order
const TABS_TO_TRY = [
  'Results 01-11-2026 03:48:30 EST',
  'Results 01-10-2026',
  'Results 01-09-2026',
  'Daily Summary',
  'Summary',
];

async function fetchFromGoogleSheets(): Promise<ScrapingResult[]> {
  let lastError: Error | null = null;
  
  // Try each tab until one works
  for (const tabName of TABS_TO_TRY) {
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
      const response = await fetch(csvUrl, { cache: 'no-store' });
      
      if (!response.ok) continue;
      
      const csvText = await response.text();
      if (!csvText || csvText.length < 100) continue;
      
      const rows = parseCSV(csvText);
      if (rows.length < 2) continue;
      
      // Check if this looks like our data (has HRT/TRT/Provider in first column)
      const hasValidData = rows.some(row => 
        row[0] && ['HRT', 'TRT', 'Provider'].includes(row[0].trim())
      );
      
      if (!hasValidData) continue;
      
      console.log('Successfully fetched from tab:', tabName);
      return parseResults(rows, tabName);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      continue;
    }
  }
  
  // If all tabs fail, try to dynamically find a Results tab
  try {
    return await tryDynamicTabSearch();
  } catch (err) {
    throw lastError || new Error('No valid data tab found');
  }
}

async function tryDynamicTabSearch(): Promise<ScrapingResult[]> {
  // Generate possible tab names based on recent dates
  const today = new Date();
  const possibleTabs: string[] = [];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    
    // Try different formats
    possibleTabs.push(`Results ${month}-${day}-${year}`);
    possibleTabs.push(`Results ${year}-${month}-${day}`);
  }
  
  for (const tabName of possibleTabs) {
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
      const response = await fetch(csvUrl, { cache: 'no-store' });
      
      if (!response.ok) continue;
      
      const csvText = await response.text();
      const rows = parseCSV(csvText);
      
      const hasValidData = rows.some(row => 
        row[0] && ['HRT', 'TRT', 'Provider'].includes(row[0].trim())
      );
      
      if (hasValidData) {
        console.log('Found tab via dynamic search:', tabName);
        return parseResults(rows, tabName);
      }
    } catch {
      continue;
    }
  }
  
  throw new Error('Could not find valid Results tab');
}

function parseResults(rows: string[][], tabName: string): ScrapingResult[] {
  const results: ScrapingResult[] = [];
  
  // Try to extract date from tab name (e.g., "Results 01-11-2026 03:48:30 EST")
  let tabDate = '';
  const tabMatch = tabName.match(/(\d{2})-(\d{2})-(\d{4})\s*(\d{2}):(\d{2}):(\d{2})/);
  if (tabMatch) {
    const [, month, day, year, hour, min, sec] = tabMatch;
    tabDate = `${year}-${month}-${day}T${hour}:${min}:${sec}`;
  }
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 5) continue;
    
    const category = (row[0] || '').trim();
    const location = (row[1] || '').trim();
    const name = (row[2] || '').trim();
    const daysOutRaw = (row[4] || '').trim();
    const firstAvailable = row[7] ? row[7].trim() : null;
    const scrapedAtRaw = row[8] ? row[8].trim() : '';
    const errorCode = row[9] ? row[9].trim() : '';
    
    // Skip if not a valid category
    if (!['HRT', 'TRT', 'Provider'].includes(category)) continue;
    if (!name) continue;
    
    // Parse days out
    let daysOut = -1;
    const daysMatch = daysOutRaw.match(/(\d+)/);
    if (daysMatch) {
      daysOut = parseInt(daysMatch[1], 10);
    }
    
    // Parse scrapedAt - format: "2026-01-11 03:48:30 ET"
    let scrapedAt = tabDate;
    if (scrapedAtRaw) {
      const dateMatch = scrapedAtRaw.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
      if (dateMatch) {
        const [, year, month, day, hour, min, sec] = dateMatch;
        scrapedAt = `${year}-${month}-${day}T${hour}:${min}:${sec}`;
      }
    }
    
    results.push({
      name,
      type: category,
      location,
      daysOutUntilAppointment: daysOut,
      firstAvailableDate: firstAvailable,
      scrapedAt: scrapedAt || new Date().toISOString(),
      error: errorCode || undefined,
    });
  }
  
  return results;
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    
    let results: ScrapingResult[];
    
    if (dateParam) {
      // Fetch data for specific date
      results = await fetchDataForDate(dateParam);
    } else {
      // Fetch latest data
      results = await fetchFromGoogleSheets();
    }
    
    const sorted = results.sort((a, b) => {
      if (a.error && !b.error) return 1;
      if (!a.error && b.error) return -1;
      if (a.daysOutUntilAppointment < 0 && b.daysOutUntilAppointment >= 0) return 1;
      if (a.daysOutUntilAppointment >= 0 && b.daysOutUntilAppointment < 0) return -1;
      return a.daysOutUntilAppointment - b.daysOutUntilAppointment;
    });
    
    return NextResponse.json({
      success: true,
      count: sorted.length,
      lastUpdated: sorted[0]?.scrapedAt || new Date().toISOString(),
      date: dateParam || 'latest',
      data: sorted,
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch data',
      data: [],
    }, { status: 500 });
  }
}

async function fetchDataForDate(dateStr: string): Promise<ScrapingResult[]> {
  // Parse the date and try to find matching tab
  const date = new Date(dateStr);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  
  const possibleTabs = [
    `Results ${month}-${day}-${year}`,
    `Results ${year}-${month}-${day}`,
  ];
  
  for (const tabName of possibleTabs) {
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
      const response = await fetch(csvUrl, { cache: 'no-store' });
      
      if (!response.ok) continue;
      
      const csvText = await response.text();
      const rows = parseCSV(csvText);
      
      const hasValidData = rows.some(row => 
        row[0] && ['HRT', 'TRT', 'Provider'].includes(row[0].trim())
      );
      
      if (hasValidData) {
        return parseResults(rows, tabName);
      }
    } catch {
      continue;
    }
  }
  
  throw new Error(`No data found for date: ${dateStr}`);
}
