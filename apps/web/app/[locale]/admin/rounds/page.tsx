'use client';

import {
  ArrowClockwise,
  CheckCircle,
  Flag,
  Lightning,
  Sparkle,
  WarningCircle,
} from '@phosphor-icons/react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button, Card, Chip, Toast } from '@/components/ui';

interface AdminRoundQuestion {
  index: number;
  id: string;
  type: string;
  category: string;
  difficulty: 1 | 2 | 3;
  prompt: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  reportCount: number;
  flagged: boolean;
}

interface AdminRoundItem {
  date: string;
  roundNumber: number;
  theme: string;
  status: 'ready' | 'reserve' | 'scheduled';
  promotedFromReserve?: boolean;
  questions: AdminRoundQuestion[];
}

export default function AdminRoundsPage() {
  const locale = useLocale();
  const [rounds, setRounds] = useState<AdminRoundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [replacingKey, setReplacingKey] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const loadRounds = () => {
    fetch('/api/admin/rounds?days=7')
      .then((r) => r.json())
      .then((d) => {
        if (d.rounds) setRounds(d.rounds);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRounds();
  }, []);

  const handleReplaceQuestion = async (date: string, questionIndex: number) => {
    const key = `${date}_${questionIndex}`;
    setReplacingKey(key);
    try {
      const res = await fetch('/api/admin/rounds/replace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, questionIndex }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast('Întrebarea a fost înlocuită cu succes cu Gemini!');
        loadRounds();
      } else {
        setToast(`Eroare: ${data.error || 'Nu s-a putut înlocui'}`);
      }
    } catch {
      setToast('Eroare de rețea');
    } finally {
      setReplacingKey(null);
      setTimeout(() => setToast(''), 3000);
    }
  };

  return (
    <main className="mx-auto flex max-w-[800px] flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-ink text-2xl font-black">Runde Zilnice (Next 7 Days)</h1>
          <p className="text-muted text-xs font-medium">
            Verifică bufferul de runde, generarea automată Gemini, răspunsurile și raportările
            utilizatorilor.
          </p>
        </div>
        <Link href={`/${locale}/admin`}>
          <Button size="sm" variant="secondary">
            Panou Admin
          </Button>
        </Link>
      </div>

      {toast && (
        <div className="flex justify-center">
          <Toast message={toast} tone="success" />
        </div>
      )}

      {loading && (
        <div className="text-muted py-12 text-center text-sm font-bold">Se încarcă rundele...</div>
      )}

      {!loading && rounds.length === 0 && (
        <Card className="text-muted p-8 text-center">Nu s-au găsit runde programate.</Card>
      )}

      {!loading &&
        rounds.map((round) => (
          <Card key={round.date} className="border-border space-y-4 border-2 p-5 shadow-sm">
            <div className="border-border-subtle flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-ink text-lg font-black">
                    Runda #{round.roundNumber} ({round.date})
                  </span>
                  <Chip
                    tone={round.status === 'ready' ? 'volt' : 'neutral'}
                    className="px-2 py-0 text-[10px] font-black"
                  >
                    {round.status.toUpperCase()}
                  </Chip>
                  {round.promotedFromReserve && (
                    <Chip tone="gold" className="px-2 py-0 text-[10px] font-black">
                      REZERVĂ ACTIVATĂ
                    </Chip>
                  )}
                </div>
                <p className="text-muted mt-0.5 text-xs font-bold">
                  Tema: <span className="text-ink">{round.theme}</span>
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {round.questions.map((q) => {
                const isReplacing = replacingKey === `${round.date}_${q.index}`;
                return (
                  <div
                    key={q.id || q.index}
                    className={`space-y-2 rounded-xl border p-3.5 transition ${
                      q.flagged ? 'border-wrong bg-wrong/5' : 'border-border-subtle bg-surface-2/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-muted text-xs font-black uppercase">
                            Q{q.index + 1} · {q.type.toUpperCase()} · Dif {q.difficulty}/3
                          </span>
                          <span className="text-muted text-xs font-bold">({q.category})</span>
                          {q.reportCount > 0 && (
                            <span
                              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-black ${
                                q.flagged
                                  ? 'bg-wrong text-white'
                                  : 'bg-gold/20 text-gold-strong dark:text-gold'
                              }`}
                            >
                              <Flag size={12} weight="fill" />
                              {q.reportCount} {q.reportCount === 1 ? 'raport' : 'rapoarte'}
                              {q.flagged && ' (ALERTĂ EXCLUS DIN DEDUP)'}
                            </span>
                          )}
                        </div>
                        <p className="text-ink text-sm font-bold">{q.prompt}</p>
                      </div>

                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={isReplacing}
                        onClick={() => handleReplaceQuestion(round.date, q.index)}
                        className="h-8 shrink-0 px-2.5 text-xs font-bold"
                      >
                        <ArrowClockwise
                          size={14}
                          weight="bold"
                          className={isReplacing ? 'mr-1 animate-spin' : 'mr-1'}
                        />
                        {isReplacing ? 'Se regenerează…' : 'Înlocuiește întrebarea'}
                      </Button>
                    </div>

                    <div className="border-border-subtle/60 space-y-1 border-t pt-1 text-xs">
                      <p className="text-correct-text flex items-center gap-1.5 font-extrabold">
                        <CheckCircle size={14} weight="bold" />
                        Răspuns corect: {q.correctAnswer}
                      </p>
                      {q.explanation && (
                        <p className="text-muted text-[11px] leading-relaxed">
                          Explicație: {q.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
    </main>
  );
}
