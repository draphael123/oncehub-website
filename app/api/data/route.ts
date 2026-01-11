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

async function fetchFromGoogleSheets(): Promise<ScrapingResult[]> {
  try {
    // Get list of sheets using the Google Sheets API v4 (public access)
    const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}?fields=sheets.properties.title&key=`;
    
    // Try to fetch sheet names from the published HTML page
    const publishedUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/pubhtml`;
    const htmlResponse = await fetch(publishedUrl, { cache: 'no-store' });
    const html = await htmlResponse.text();
    
    // Extract tab names from the HTML - look for "Results" tabs
    const tabMatches = html.match(/Results[^"<>]*\d{4}-\d{2}-\d{2}/g) || [];
    const resultsTabs = [...new Set(tabMatches)].sort().reverse();
    
    if (resultsTabs.length === 0) {
      // Fallback: try to find any tab with date pattern
      const datePattern = /gid=(\d+)[^>]*>([^<]*\d{4}-\d{2}-\d{2}[^<]*)</g;
      let match;
      while ((match = datePattern.exec(html)) !== null) {
        if (match[2].includes('Results')) {
          resultsTabs.push(match[2].trim());
        }
      }
    }
    
    // Use the most recent Results tab, or fall back to a default
    const latestTab = resultsTabs[0] || 'Results';
    
    // Fetch CSV data from the sheet
    const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(latestTab)}`;
    const csvResponse = await fetch(csvUrl, { cache: 'no-store' });
    
    if (!csvResponse.ok) {
      throw new Error(`Failed to fetch CSV: ${csvResponse.status}`);
    }
    
    const csvText = await csvResponse.text();
    const rows = parseCSV(csvText);
    
    if (rows.length < 2) {
      throw new Error('No data rows found');
    }
    
    return parseRowsToResults(rows, latestTab);
  } catch (error) {
    console.error('Error fetching from Google Sheets:', error);
    throw error;
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

function parseRowsToResults(rows: string[][], tabName: string): ScrapingResult[] {
  const headers = rows[0].map(h => (h || '').toLowerCase().trim());
  
  const nameIndex = headers.findIndex(h => h.includes('name') && !h.includes('url'));
  const categoryIndex = headers.findIndex(h => h.includes('category') || h.includes('type'));
  const locationIndex = headers.findIndex(h => h.includes('location') || h.includes('state'));
  const daysOutIndex = headers.findIndex(h => h.includes('days') && h.includes('out'));
  const firstAvailableIndex = headers.findIndex(h => h.includes('first') && h.includes('available'));
  const errorIndex = headers.findIndex(h => h.includes('error'));
  
  // Extract date from tab name
  const dateMatch = tabName.match(/(\d{4}-\d{2}-\d{2})/);
  const scrapeDate = dateMatch ? new Date(dateMatch[1]) : new Date();
  
  const results: ScrapingResult[] = [];
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    
    const name = nameIndex >= 0 ? (row[nameIndex] || '').trim() : '';
    if (!name) continue;
    
    const category = categoryIndex >= 0 ? (row[categoryIndex] || '').trim() : '';
    const location = locationIndex >= 0 ? (row[locationIndex] || '').trim() : '';
    const daysOutStr = daysOutIndex >= 0 ? (row[daysOutIndex] || '').trim() : '';
    const firstAvailable = firstAvailableIndex >= 0 ? (row[firstAvailableIndex] || '').trim() : '';
    const error = errorIndex >= 0 ? (row[errorIndex] || '').trim() : '';
    
    // Parse days out
    let daysOut = -1;
    if (daysOutStr) {
      const cleaned = daysOutStr.replace(/[⚡✅❌🟡🔴]/g, '').trim();
      const parsed = parseInt(cleaned, 10);
      if (!isNaN(parsed)) {
        daysOut = parsed;
      }
    }
    
    // Determine type
    let type = category || 'Unknown';
    if (name.startsWith('HRT ')) type = 'HRT';
    else if (name.startsWith('TRT ')) type = 'TRT';
    else if (name.startsWith('Provider: ')) type = 'Provider';
    
    // Extract location from name if needed
    let finalLocation = location;
    if (!finalLocation && (type === 'HRT' || type === 'TRT')) {
      const match = name.match(/(?:HRT|TRT)\s+(.+)/);
      if (match) finalLocation = match[1];
    }
    
    results.push({
      name,
      type,
      location: finalLocation,
      daysOutUntilAppointment: daysOut,
      firstAvailableDate: firstAvailable || null,
      scrapedAt: scrapeDate.toISOString(),
      error: error || undefined,
    });
  }
  
  return results;
}

export async function GET() {
  try {
    const results = await fetchFromGoogleSheets();
    
    // Sort by days out (ascending), with errors at the end
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
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch data',
      data: [],
    }, { status: 500 });
  }
}

