import { Card, Wordmark } from '@/components/ui';

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-6 px-5 py-12">
      <Wordmark size="lg" />
      <Card className="w-full space-y-3 text-center">
        <h1 className="font-display text-2xl font-extrabold">You&apos;re offline</h1>
        <p className="text-muted text-sm">
          Today&apos;s round needs a connection so scores stay fair.
        </p>
      </Card>
    </main>
  );
}
