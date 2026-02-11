import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    // Vercel provides country code via x-vercel-ip-country header (free, zero-latency)
    const country = request.headers.get('x-vercel-ip-country') || 'IN';

    return NextResponse.json({ country });
}
