import { JoinLeagueClient } from './JoinLeagueClient';

export function generateStaticParams() {
  return [{ code: '_shell' }];
}

export default async function LeagueInvitePage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { code } = await params;

  return (
    <JoinLeagueClient
      code={code}
      leagueName={`League ${code === '_shell' ? '' : code.toUpperCase()}`}
      memberCount={1}
      members={[]}
    />
  );
}
