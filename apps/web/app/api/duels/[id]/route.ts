import { LOCALES, type Locale } from '@ronduel/shared';
import { NextResponse } from 'next/server';

import { getDuelView } from '@/lib/server-store';

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { searchParams } = new URL(req.url);
  const rawLocale = searchParams.get('locale') ?? 'en';
  const locale: Locale = LOCALES.includes(rawLocale as Locale) ? (rawLocale as Locale) : 'en';
  const duel = getDuelView(id, locale);
  if (!duel) {
    return NextResponse.json({ error: 'Duel not found' }, { status: 404 });
  }
  return NextResponse.json(duel);
}
