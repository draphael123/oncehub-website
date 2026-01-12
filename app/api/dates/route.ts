import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const GOOGLE_SHEET_ID = '1vOXJEegJHJizatcXErv_dOLuWCiz_z8fGZasSDde2tc';

// Generate tab names to try for a given date (simplified for speed)
function generateTabNames(date: Date): string[] {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  
  const tabs: string[] = [];
  const baseDate = `${month}-${day}-${year}`;
  
  // Just try a few common times for date checking (speed optimization)
  const commonTimes = ['03:00', '03:15', '03:17', '03:30', '03:45', '03:48', '04:00'];
  
  for (const time of commonTimes) {
    tabs.push(`Results ${baseDate} ${time}:00 EST`);
    tabs.push(`Results ${baseDate} ${time}:09 EST`);
  }
  
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
