'use client';

import { Flame, Lightning, Moon, Sun, Trophy } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';

import { Avatar, Button, Card, Chip, Sheet, TimerBar, Toast, Wordmark } from '@/components/ui';

type ThemeMode = 'light' | 'dark' | 'high-contrast';

export default function DevUiPage() {
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-5 py-8">
      <header className="border-border-subtle flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <div className="flex items-center gap-3">
          <img src="/brand/icon.svg" alt="RonDuel icon" width={48} height={48} />
          <div>
            <Wordmark size="md" />
            <p className="text-muted text-sm">Split Court Design System — /dev/ui</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Theme switcher">
          <Button
            size="sm"
            variant={theme === 'light' ? 'primary' : 'secondary'}
            onClick={() => setTheme('light')}
            aria-pressed={theme === 'light'}
          >
            <Sun size={18} weight="bold" aria-hidden="true" />
            Light
          </Button>
          <Button
            size="sm"
            variant={theme === 'dark' ? 'blue' : 'secondary'}
            onClick={() => setTheme('dark')}
            aria-pressed={theme === 'dark'}
          >
            <Moon size={18} weight="bold" aria-hidden="true" />
            Dark
          </Button>
          <Button
            size="sm"
            variant={theme === 'high-contrast' ? 'volt' : 'secondary'}
            onClick={() => setTheme('high-contrast')}
            aria-pressed={theme === 'high-contrast'}
          >
            High Contrast
          </Button>
        </div>
      </header>

      <section aria-labelledby="typography-heading" className="space-y-4">
        <h1 id="typography-heading" className="font-display text-3xl font-extrabold">
          Typography &amp; Diacritics
        </h1>
        <Card className="space-y-3">
          <p className="font-display text-4xl font-extrabold">Bricolage Grotesque 800 — 1,200</p>
          <p className="text-base">
            DM Sans body copy: Romanian diacritics check — <strong>ș ț ă â î Ș Ț Ă Â Î</strong> (În
            fiecare zi, un duel rapid cu prietenii tăi!).
          </p>
          <p className="rd-tabular text-lg font-bold">
            JetBrains Mono tabular: #142 · 00:09.75 · 1,040 pts
          </p>
        </Card>
      </section>

      <section aria-labelledby="buttons-heading" className="space-y-4">
        <h2 id="buttons-heading" className="font-display text-2xl font-extrabold">
          Buttons
        </h2>
        <Card className="flex flex-wrap gap-3">
          <Button variant="primary">Play today&apos;s round</Button>
          <Button variant="blue">Join league</Button>
          <Button variant="volt">
            <Lightning size={18} weight="fill" aria-hidden="true" />
            Fast answer
          </Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Leave round</Button>
          <Button disabled>Disabled</Button>
        </Card>
      </section>

      <section aria-labelledby="chips-avatars-heading" className="space-y-4">
        <h2 id="chips-avatars-heading" className="font-display text-2xl font-extrabold">
          Chips &amp; Avatars
        </h2>
        <Card className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Chip tone="neutral">Space 🚀</Chip>
            <Chip tone="volt">
              <Flame size={14} weight="fill" aria-hidden="true" />
              12-day streak
            </Chip>
            <Chip tone="gold">
              <Trophy size={14} weight="fill" aria-hidden="true" />
              Rank #1
            </Chip>
            <Chip tone="red">Ron Red</Chip>
            <Chip tone="blue">Duel Blue</Chip>
            <Chip tone="correct">+184</Chip>
            <Chip tone="wrong">Time out</Chip>
          </div>
          <div className="flex items-center gap-3">
            <Avatar nickname="Ana Popescu" size="sm" />
            <Avatar nickname="Mihai" size="md" />
            <Avatar nickname="João Silva" size="lg" />
            <Avatar nickname="Lucía" size="md" />
          </div>
        </Card>
      </section>

      <section aria-labelledby="timer-heading" className="space-y-4">
        <h2 id="timer-heading" className="font-display text-2xl font-extrabold">
          Timer Bar
        </h2>
        <Card className="space-y-4">
          <TimerBar remainingMs={7_400} limitMs={10_000} />
          <TimerBar remainingMs={2_100} limitMs={10_000} />
        </Card>
      </section>

      <section aria-labelledby="sheet-toast-heading" className="space-y-4">
        <h2 id="sheet-toast-heading" className="font-display text-2xl font-extrabold">
          Sheet &amp; Toasts
        </h2>
        <Card className="space-y-4">
          <div>
            <Button variant="blue" onClick={() => setSheetOpen(true)}>
              Open Sheet
            </Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Toast message="Result copied to clipboard" tone="success" />
            <Toast message="You're offline. Today's round needs a connection." tone="info" />
            <Toast message="Nickname already taken in this league." tone="error" />
          </div>
        </Card>
      </section>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Pick your nickname">
        <p className="text-muted mb-4 text-sm">
          No account needed for your first round. You can upgrade later to save your streak.
        </p>
        <Button fullWidth onClick={() => setSheetOpen(false)}>
          Continue
        </Button>
      </Sheet>
    </main>
  );
}
