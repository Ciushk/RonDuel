import { notFound } from 'next/navigation';

import { Card } from '@/components/ui';

const LEGAL_DOCS: Record<string, { title: string; body: string[] }> = {
  terms: {
    title: 'Terms of Service',
    body: [
      'Controller: [LEGAL_ENTITY_NAME], [REGISTERED_ADDRESS], [CONTACT_EMAIL].',
      'RonDuel is a free-to-play daily trivia and logic game for adults aged 16 and older. No gambling, no cash prizes.',
      'Placeholder legal text — replace with final reviewed EU Terms before public launch.',
    ],
  },
  privacy: {
    title: 'Privacy Policy (GDPR)',
    body: [
      'Data Controller: [LEGAL_ENTITY_NAME], [REGISTERED_ADDRESS], [CONTACT_EMAIL].',
      'Data processors: Google Cloud / Firebase (EU eur3 & europe-west1), Stripe (Phase 3), PostHog Cloud EU (opt-in only).',
      'You may export your data or delete your account at any time from Settings.',
    ],
  },
  cookies: {
    title: 'Cookie & Storage Policy',
    body: [
      'Essential local storage is used strictly to preserve your anonymous session and preferences.',
      'Analytics (PostHog EU) are disabled by default and only enabled after explicit opt-in.',
    ],
  },
  imprint: {
    title: 'Imprint / Contact',
    body: ['[LEGAL_ENTITY_NAME]', '[REGISTERED_ADDRESS]', 'Contact: [CONTACT_EMAIL]'],
  },
};

export function generateStaticParams() {
  return Object.keys(LEGAL_DOCS).map((doc) => ({ doc }));
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const entry = LEGAL_DOCS[doc];
  if (!entry) notFound();

  return (
    <main className="mx-auto max-w-[480px] space-y-4 px-4 py-6">
      <h1 className="font-display text-3xl font-extrabold">{entry.title}</h1>
      <Card variant="subtle" className="space-y-3 text-sm text-ink">
        {entry.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </Card>
    </main>
  );
}
