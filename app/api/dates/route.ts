import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const GOOGLE_SHEET_ID = '1vOXJEegJHJizatcXErv_dOLuWCiz_z8fGZasSDde2tc';

// Generate all tab names to try for a given date
// Covers the full scrape window (3-5 AM EST) with minute-level granularity
function generateTabNames(date: Date): string[] {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  
  const tabs: string[] = [];
  const baseDate = `${month}-${day}-${year}`;
  
  // Generate timestamps for the typical scrape window (3:00 AM - 5:00 AM EST)
  for (let hour = 3; hour <= 5; hour++) {
    for (let minute = 0; minute < 60; minute += 5) {
      const h = String(hour).padStart(2, '0');
      const m = String(minute).padStart(2, '0');
      for (const sec of ['00', '09', '30', '42']) {
        tabs.push(`Results ${baseDate} ${h}:${m}:${sec} EST`);
        tabs.push(`Results ${baseDate} ${h}:${m}:${sec} ET`);
      }
    }
  }
  
  // Also try without timestamp and YYYY-MM-DD format
  tabs.push(`Results ${baseDate}`);
  tabs.push(`Results ${year}-${month}-${day}`);
  
  return tabs;
}

async function checkDateHasData(date: Date): Promise<boolean> {
  const tabNames = generateTabNames(date);
  
  for (const tabName of tabNames) {
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
      const response = await fetch(csvUrl, { cache: 'no-store' });
      
      if (!response.ok) continue;
      
      const text = await response.text();
      // Check if it has actual data (must have oncehub.com URLs, not dashboard summary)
      if (text.includes('oncehub.com') && (text.includes('HRT') || text.includes('TRT') || text.includes('Provider'))) {
        return true;
      }
    } catch {
      continue;
    }
  }
  
  return false;
}

export async function GET() {
  try {
    const dates: string[] = [];
    const today = new Date();
    
    // Check last 14 days
    const promises: Promise<{ date: string; hasData: boolean }>[] = [];
    
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      promises.push(
        checkDateHasData(date).then(hasData => ({ date: dateStr, hasData }))
      );
    }
    
    const results = await Promise.all(promises);
    
    for (const result of results) {
      if (result.hasData) {
        dates.push(result.date);
      }
    }
    
    return NextResponse.json({
      success: true,
      dates: dates.sort().reverse(), // Most recent first
      count: dates.length,
    });
  } catch (error) {
    console.error('Dates API Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch dates',
      dates: [],
    }, { status: 500 });
  }
}
