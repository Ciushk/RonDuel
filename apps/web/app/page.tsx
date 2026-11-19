import Link from 'next/link';

import { Card, Chip, Wordmark } from '@/components/ui';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-6 px-5 py-12">
      <div className="rd-seam h-2 w-24 rounded-full" aria-hidden="true" />
      <Wordmark size="lg" />
      <p className="text-muted text-center text-base">
        The daily duel for your group chat. Phase 0 foundations are live.
      </p>
      <Card className="w-full space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-display text-lg font-extrabold">Split Court UI</span>
          <Chip tone="volt">Phase 0</Chip>
        </div>
        <p className="text-muted text-sm">
          Inspect the design system tokens, typography, and accessible base components.
        </p>
        <Link
          href="/dev/ui"
          className="rd-sticker rd-sticker-pressable bg-ron inline-flex min-h-12 w-full items-center justify-center rounded-[14px] px-5 text-base font-bold text-[#16131F]"
        >
          Open /dev/ui showcase
        </Link>
      </Card>
    </main>
  );
}
