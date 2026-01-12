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

// Generate tab names to try for a given date
// Uses common scrape times - scrape typically starts at 3 AM and takes ~1 hour
function generateTabNames(date: Date): string[] {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  
  const tabs: string[] = [];
  const baseDate = `${month}-${day}-${year}`;
  
  // Most common scrape start times (3:00-3:30 AM EST range)
  const commonTimes = [
    '03:00', '03:05', '03:10', '03:15', '03:17', '03:20', '03:25', '03:30',
    '03:35', '03:40', '03:45', '03:48', '03:50', '03:55',
    '04:00', '04:05', '04:10'
  ];
  
  for (const time of commonTimes) {
    // Try common second values
    tabs.push(`Results ${baseDate} ${time}:00 EST`);
    tabs.push(`Results ${baseDate} ${time}:09 EST`);
    tabs.push(`Results ${baseDate} ${time}:30 EST`);
  }
  
  // Also try without timestamp and YYYY-MM-DD format
  tabs.push(`Results ${baseDate}`);
  tabs.push(`Results ${year}-${month}-${day}`);
  
  return tabs;
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

function parseResults(rows: string[][], tabName: string): ScrapingResult[] {
  const results: ScrapingResult[] = [];
  
  // Try to extract date from tab name
  let tabDate = '';
  const tabMatch = tabName.match(/(\d{2})-(\d{2})-(\d{4})\s*(\d{2})?:?(\d{2})?:?(\d{2})?/);
  if (tabMatch) {
    const [, month, day, year, hour = '00', min = '00', sec = '00'] = tabMatch;
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
    
    // Skip dashboard/summary rows - these have numeric data in name column
    // Valid names should be like "HRT Arizona", "TRT Texas", "Provider: John Smith"
    // Dashboard rows have names like "22 (100.0%)"
    if (/^\d+\s*\([\d.]+%\)$/.test(name)) continue;
    
    // Skip excluded names
    if (name.toLowerCase().includes('daniel raphael')) continue;
    
    // Valid results should have a URL in column 3
    const url = (row[3] || '').trim();
    if (!url.includes('oncehub.com')) continue;
    
    // Parse days out
    let daysOut = -1;
    const daysMatch = daysOutRaw.match(/(\d+)/);
    if (daysMatch) {
      daysOut = parseInt(daysMatch[1], 10);
    }
    
    // Parse scrapedAt
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

async function fetchTabData(tabName: string): Promise<ScrapingResult[] | null> {
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
    const response = await fetch(csvUrl, { cache: 'no-store' });
    
    if (!response.ok) return null;
    
    const csvText = await response.text();
    if (!csvText || csvText.length < 50) return null;
    
    const rows = parseCSV(csvText);
    if (rows.length < 2) return null;
    
    // Check if valid data exists
    const hasValidData = rows.some(row => 
      row[0] && ['HRT', 'TRT', 'Provider'].includes(row[0].trim())
    );
    
    if (!hasValidData) return null;
    
    const results = parseResults(rows, tabName);
    return results.length > 0 ? results : null;
  } catch {
    return null;
  }
}

async function fetchFromGoogleSheets(): Promise<ScrapingResult[]> {
  const today = new Date();
  
  // Try today first, then work backwards
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const tabNames = generateTabNames(date);
    
    for (const tabName of tabNames) {
      const results = await fetchTabData(tabName);
      if (results && results.length > 0) {
        console.log(`Data API: Found ${results.length} items in tab "${tabName}"`);
        return results;
      }
    }
  }
  
  // Fallback: try common summary tabs
  const fallbackTabs = ['Daily Summary', 'Summary'];
  for (const tabName of fallbackTabs) {
    const results = await fetchTabData(tabName);
    if (results && results.length > 0) {
      console.log(`Data API: Found ${results.length} items in fallback tab "${tabName}"`);
      return results;
    }
  }
  
  throw new Error('Could not find valid Results tab');
}

async function fetchDataForDate(dateStr: string): Promise<ScrapingResult[]> {
  const date = new Date(dateStr);
  const tabNames = generateTabNames(date);
  
  for (const tabName of tabNames) {
    const results = await fetchTabData(tabName);
    if (results && results.length > 0) {
      return results;
    }
  }
  
  throw new Error(`No data found for date: ${dateStr}`);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    
    let results: ScrapingResult[];
    
    if (dateParam) {
      results = await fetchDataForDate(dateParam);
    } else {
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
    console.error('Data API Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch data',
      data: [],
    }, { status: 500 });
  }
}
