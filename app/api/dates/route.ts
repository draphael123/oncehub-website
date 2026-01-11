import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const GOOGLE_SHEET_ID = '1vOXJEegJHJizatcXErv_dOLuWCiz_z8fGZasSDde2tc';

async function getAllResultsTabs(): Promise<string[]> {
  const dates: string[] = [];
  
  // Try to get sheet names from the Google Sheets API (public)
  // We'll check for Results tabs for the past 30 days
  const today = new Date();
  
  for (let i = 0; i < 30; i++) {
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
      try {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
        const response = await fetch(csvUrl, { 
          cache: 'no-store',
          headers: { 'Accept': 'text/csv' }
        });
        
        if (response.ok) {
          const text = await response.text();
          // Check if it has actual data (not just an error page)
          if (text.includes('HRT') || text.includes('TRT') || text.includes('Provider')) {
            dates.push(`${year}-${month}-${day}`);
            break; // Found this date, move to next
          }
        }
      } catch {
        continue;
      }
    }
  }
  
  return dates.sort().reverse(); // Most recent first
}

export async function GET() {
  try {
    const dates = await getAllResultsTabs();
    
    return NextResponse.json({
      success: true,
      dates,
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

