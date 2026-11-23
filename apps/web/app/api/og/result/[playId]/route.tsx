import { ImageResponse } from 'next/og';

import { getPlayResult } from '@/lib/server-store';

// satori (next/og) has no emoji font, so the result line is drawn as coloured tiles instead of
// ⚡ 🟩 🟥 glyphs. Every div with more than one child needs `display: flex`.
const TILE_COLORS: Record<string, string> = {
  '⚡': '#C6FF3D',
  '🟩': '#5BD98B',
  '🟥': '#FF5A4E',
};

export async function GET(_req: Request, context: { params: Promise<{ playId: string }> }) {
  const { playId } = await context.params;
  const res = getPlayResult(playId);
  const roundLabel = `Round #${res?.roundNumber ?? 1}`;
  const scoreLabel = `${(res?.totalScore ?? 0).toLocaleString('en-US')} pts`;
  const streak = res?.streakCurrent ?? 0;
  const tiles = Array.from(res?.emojiLine || '⚡🟩⚡🟩⚡🟩').filter((e) => e in TILE_COLORS);

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
          {roundLabel}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', fontSize: 96, fontWeight: 800 }}>{scoreLabel}</div>
        <div style={{ display: 'flex', gap: '14px' }}>
          {tiles.map((e, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                width: '76px',
                height: '76px',
                borderRadius: '16px',
                border: '4px solid #16131F',
                background: TILE_COLORS[e],
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', fontSize: 34, color: '#5B5668' }}>
          {streak > 1 ? `${streak}-day streak · Can you beat me?` : 'Can you beat me?'}
        </div>
      </div>

      <div style={{ display: 'flex', height: '16px', width: '100%' }}>
        <div style={{ display: 'flex', flex: 1, background: '#FF5A4E' }} />
        <div style={{ display: 'flex', flex: 1, background: '#3D7BFF' }} />
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
