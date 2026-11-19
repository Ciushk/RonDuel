import { getLocalDateString } from '@ronduel/shared';
import { ImageResponse } from 'next/og';

import { getLeagueByCodeOrId, getRoundMeta } from '@/lib/server-store';

// Note: satori requires `display: flex` on any div with more than one child,
// so every text label below is rendered as a single string node.
export async function GET(_req: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const league = getLeagueByCodeOrId(code);
  const meta = getRoundMeta(getLocalDateString(new Date(), league?.tz ?? 'UTC'));

  const leagueName = league?.name ?? `League ${code.toUpperCase()}`;
  const subline = league
    ? `${league.memberCount} players · Can you beat them?`
    : 'Can you beat them?';

  return new ImageResponse(
    <div
      style={{
        width: '1200px',
        height: '630px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '56px',
        background: '#FFF7EC',
        color: '#16131F',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', fontSize: 52, fontWeight: 800 }}>
          <span style={{ color: '#D7261E' }}>Ron</span>
          <span style={{ margin: '0 8px' }}>/</span>
          <span style={{ color: '#1E4FD8' }}>Duel</span>
        </div>
        <div
          style={{
            display: 'flex',
            background: '#C6FF3D',
            border: '3px solid #16131F',
            borderRadius: '14px',
            padding: '10px 22px',
            fontSize: 28,
            fontWeight: 800,
          }}
        >
          {`Round #${meta.roundNumber}`}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', fontSize: 64, fontWeight: 800 }}>{leagueName}</div>
        <div style={{ display: 'flex', fontSize: 32, color: '#5B5668' }}>{subline}</div>
      </div>

      <div style={{ display: 'flex', height: '16px', width: '100%' }}>
        <div style={{ display: 'flex', flex: 1, background: '#FF5A4E' }} />
        <div style={{ display: 'flex', flex: 1, background: '#3D7BFF' }} />
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
