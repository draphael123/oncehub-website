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

async function getLatestResultsTab(): Promise<string> {
  // Fetch the published HTML to find tab names
  const publishedUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/pubhtml`;
  const response = await fetch(publishedUrl, { cache: 'no-store' });
  const html = await response.text();
  
  // Look for "Results" tabs with dates - format: "Results MM-DD-YYYY HH:MM:SS" or similar
  const tabPattern = /Results\s+\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2}\s+[A-Z]+/gi;
  const matches = html.match(tabPattern) || [];
  
  if (matches.length > 0) {
    // Sort to get the most recent (they should be date-sortable)
    const sorted = [...new Set(matches)].sort().reverse();
    return sorted[0];
  }
  
  // Fallback: try another pattern
  const altPattern = /Results\s+\d{4}-\d{2}-\d{2}/gi;
  const altMatches = html.match(altPattern) || [];
  if (altMatches.length > 0) {
    return [...new Set(altMatches)].sort().reverse()[0];
  }
  
  throw new Error('No Results tab found');
}

async function fetchFromGoogleSheets(): Promise<ScrapingResult[]> {
  // Get the latest results tab name
  const latestTab = await getLatestResultsTab();
  console.log('Fetching from tab:', latestTab);
  
  // Fetch CSV data
  const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(latestTab)}`;
  const response = await fetch(csvUrl, { cache: 'no-store' });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`);
  }
  
  const csvText = await response.text();
  const rows = parseCSV(csvText);
  
  // Skip header row, parse data rows
  const results: ScrapingResult[] = [];
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 5) continue;
    
    // Columns: Category, Location, Name, URL, Days Out, Score, Change, First Available, Scraped At, Error Code, Error Details
    const category = (row[0] || '').trim();
    const location = (row[1] || '').trim();
    const name = (row[2] || '').trim();
    const url = (row[3] || '').trim();
    const daysOutRaw = (row[4] || '').trim();
    const firstAvailable = (row[7] || '').trim();
    const scrapedAt = (row[8] || '').trim();
    const errorCode = (row[9] || '').trim();
    const errorDetails = (row[10] || '').trim();
    
    if (!name || !category) continue;
    
    // Parse days out (format: "⚡ 1" or "✅ 3")
    let daysOut = -1;
    const daysMatch = daysOutRaw.match(/(\d+)/);
    if (daysMatch) {
      daysOut = parseInt(daysMatch[1], 10);
    }
    
    results.push({
      name,
      type: category,
      location,
      daysOutUntilAppointment: daysOut,
      firstAvailableDate: firstAvailable || null,
      scrapedAt: scrapedAt || new Date().toISOString(),
      error: errorCode || errorDetails || undefined,
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
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    rows.push(row);
  }
  
  return rows;
}

export async function GET() {
  try {
    const results = await fetchFromGoogleSheets();
    
    // Sort by days out (ascending), errors at end
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
