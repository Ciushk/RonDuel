import { ImageResponse } from 'next/og';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locale = searchParams.get('locale') ?? 'ro';

  const copyByLocale: Record<string, { tagline: string; caption: string; cta: string }> = {
    ro: {
      tagline: 'Trivia zilnic pentru grupul tău de prieteni',
      caption: '6 întrebări · un minut · o singură încercare pe zi',
      cta: 'Fă-ți ligă cu prietenii și vezi cine e cel mai tare',
    },
    en: {
      tagline: 'Daily trivia for your friend group',
      caption: '6 questions · one minute · one attempt per day',
      cta: 'Start a league with friends and see who tops the board',
    },
    es: {
      tagline: 'Trivia diario para tu grupo de amigos',
      caption: '6 preguntas · un minuto · un intento al día',
      cta: 'Crea una liga con tus amigos y mira quién es el mejor',
    },
    pt: {
      tagline: 'Trivia diário para o seu grupo de amigos',
      caption: '6 perguntas · um minuto · uma tentativa por dia',
      cta: 'Crie uma liga com amigos e veja quem manda melhor',
    },
  };

  const copy = copyByLocale[locale] ?? copyByLocale.ro!;

  return new ImageResponse(
    <div
      style={{
        width: '1200px',
        height: '630px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px 56px',
        background: '#FFF7EC',
        color: '#16131F',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', fontSize: 56, fontWeight: 800 }}>
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
            fontSize: 26,
            fontWeight: 800,
          }}
        >
          {copy.tagline}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          background: '#FFFFFF',
          border: '4px solid #16131F',
          borderRadius: '24px',
          padding: '32px 40px',
          boxShadow: '0 8px 0 #16131F',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 42,
            fontWeight: 800,
            letterSpacing: '-0.01em',
          }}
        >
          {'RonDuel #12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5'}
        </div>
        <div style={{ display: 'flex', fontSize: 28, color: '#5B5668', fontWeight: 600 }}>
          {copy.caption}
        </div>
        <div style={{ display: 'flex', fontSize: 26, color: '#1E4FD8', fontWeight: 700 }}>
          {copy.cta}
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
