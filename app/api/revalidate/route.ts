import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // Check for secret token
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    
    if (secret !== process.env.REVALIDATE_SECRET) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
    }
    
    // Revalidate the main page and data API
    revalidatePath('/', 'page');
    revalidatePath('/api/data', 'page');
    
    return NextResponse.json({
      revalidated: true,
      timestamp: new Date().toISOString(),
      message: 'Cache cleared successfully',
    });
  } catch (error) {
    return NextResponse.json({
      revalidated: false,
      error: error instanceof Error ? error.message : 'Revalidation failed',
    }, { status: 500 });
  }
}

// Also support GET for simple health checks
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}



