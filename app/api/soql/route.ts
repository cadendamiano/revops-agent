import { NextRequest, NextResponse } from 'next/server';
import { runSoql } from '@/lib/salesforce/soql';

export async function POST(req: NextRequest) {
  try {
    const { soql } = await req.json();
    if (typeof soql !== 'string') {
      return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 });
    }
    const result = runSoql(soql);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: 'SERVER_ERROR', hint: String(err) }, { status: 500 });
  }
}
