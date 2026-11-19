import type { Metadata } from 'next';

import { getLeagueByCodeOrId } from '@/lib/server-store';

import { JoinLeagueClient } from './JoinLeagueClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const league = getLeagueByCodeOrId(code);
  const title = league ? `Join ${league.name} on RonDuel` : `Join RonDuel League ${code}`;
  const ogImage = `/api/og/league/${encodeURIComponent(code)}`;

  return {
    title,
    description: 'Can you beat them in today’s 60-second daily duel?',
    openGraph: {
      title,
      description: 'Can you beat them in today’s 60-second daily duel?',
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
  };
}

export default async function LeagueInvitePage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { code } = await params;
  const league = getLeagueByCodeOrId(code);

  return (
    <JoinLeagueClient
      code={code}
      leagueName={league?.name ?? `League ${code.toUpperCase()}`}
      memberCount={league?.memberCount ?? 0}
      members={(league?.allTime ?? []).slice(0, 5).map((m) => m.nickname)}
    />
  );
}
