'use client';

import { useCallback, useEffect, useState } from 'react';

import { Button, Card, Chip, Toast, Wordmark } from '@/components/ui';

interface AdminQuestion {
  id: string;
  type: 'mcq' | 'order' | 'odd' | 'logic';
  difficulty: 1 | 2 | 3;
  topics: string[];
  source: 'human' | 'ai_draft';
  reviewStatus: 'draft' | 'in_review' | 'approved' | 'rejected';
  lastUsedOn?: string;
  factChecklist?: string[];
  duplicateWarnings: string[];
  content: {
    en?: {
      prompt: string;
      options: string[];
    };
  };
}

interface AdminDashboardData {
  questions: AdminQuestion[];
  scheduledRounds: Array<{
    date: string;
    roundNumber: number;
    questionIds: string[];
    topicOfTheDay: string;
    status: string;
  }>;
  ops: {
    totalPlays: number;
    finishedPlays: number;
    completionRatePct: number;
    avgScore: number;
  };
}

export default function AdminPage() {
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [topic, setTopic] = useState('Astronomy');
  const [scheduleDate, setScheduleDate] = useState('2026-12-10');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    const res = await fetch('/api/admin', {
      headers: { 'x-admin-token': 'local-admin' },
    });
    if (res.ok) {
      setData(await res.json());
    }
  }, []);

  useEffect(() => {
    if (adminUnlocked) {
      void loadDashboard();
    }
  }, [adminUnlocked, loadDashboard]);

  const handleGenerateDrafts = async () => {
    setError('');
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': 'local-admin' },
      body: JSON.stringify({
        action: 'generate_drafts',
        topic,
        type: 'mcq',
        difficulty: 2,
        count: 2,
      }),
    });
    if (res.ok) {
      setToast('Generated 2 AI drafts (reviewStatus: draft)');
      void loadDashboard();
    }
  };

  const handleApprove = async (questionId: string) => {
    setError('');
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': 'local-admin' },
      body: JSON.stringify({
        action: 'approve_question',
        questionId,
      }),
    });
    if (res.ok) {
      setToast(`Approved ${questionId}`);
      void loadDashboard();
    }
  };

  const handleScheduleFirstSix = async (includeDrafts: boolean) => {
    if (!data) return;
    setError('');
    const pool = includeDrafts
      ? data.questions.slice(0, 6)
      : data.questions.filter((q) => q.reviewStatus === 'approved').slice(0, 6);
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': 'local-admin' },
      body: JSON.stringify({
        action: 'schedule_round',
        date: scheduleDate,
        questionIds: pool.map((q) => q.id),
        topicOfTheDay: `${topic} 🚀`,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? 'Failed to schedule round');
      return;
    }
    setToast(`Scheduled round for ${scheduleDate}`);
    void loadDashboard();
  };

  if (!adminUnlocked) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4">
        <Wordmark size="md" />
        <Card className="w-full space-y-4 text-center">
          <h1 className="font-display text-2xl font-extrabold">Admin Panel (403 Protected)</h1>
          <p className="text-muted text-xs">
            Requires Firebase custom claim <code>admin: true</code>.
          </p>
          <Button fullWidth onClick={() => setAdminUnlocked(true)}>
            Authenticate as Local Admin
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <header className="border-border-subtle flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Wordmark size="sm" />
          <Chip tone="gold">Admin Console</Chip>
        </div>
        {toast && <Toast message={toast} tone="success" />}
      </header>

      {data && (
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card variant="subtle">
            <p className="text-muted text-xs">Today&apos;s plays</p>
            <p className="rd-tabular font-display text-3xl font-extrabold">{data.ops.totalPlays}</p>
          </Card>
          <Card variant="subtle">
            <p className="text-muted text-xs">Completion rate</p>
            <p className="rd-tabular font-display text-3xl font-extrabold">
              {data.ops.completionRatePct}%
            </p>
          </Card>
          <Card variant="subtle">
            <p className="text-muted text-xs">Average score</p>
            <p className="rd-tabular font-display text-3xl font-extrabold">{data.ops.avgScore}</p>
          </Card>
          <Card variant="subtle">
            <p className="text-muted text-xs">Question bank</p>
            <p className="rd-tabular font-display text-3xl font-extrabold">
              {data.questions.length}
            </p>
          </Card>
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="font-display text-xl font-extrabold">AI-Assisted Drafting (Gemini 3.8)</h2>
          <p className="text-muted text-xs">
            Drafts are saved with <code>source: &apos;ai_draft&apos;</code> and{' '}
            <code>reviewStatus: &apos;draft&apos;</code>. Server blocks scheduling until approved.
          </p>
          <input
            type="password"
            aria-label="Admin Gemini API Key"
            placeholder="GEMINI_API_KEY (doar pt. Admin)"
            defaultValue={
              typeof window !== 'undefined'
                ? (window.localStorage.getItem('ronduel_gemini_api_key_v1') ?? '')
                : ''
            }
            onChange={(e) => {
              const v = e.target.value.trim();
              if (v) window.localStorage.setItem('ronduel_gemini_api_key_v1', v);
              else window.localStorage.removeItem('ronduel_gemini_api_key_v1');
            }}
            className="border-border-subtle bg-surface-2 min-h-10 w-full rounded-[12px] border px-3 text-xs font-medium"
          />
          <input
            type="text"
            aria-label="Draft topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="border-border bg-surface-2 min-h-11 w-full rounded-[12px] border-2 px-3 text-sm font-bold"
          />
          <Button size="sm" onClick={() => void handleGenerateDrafts()}>
            Generate drafts
          </Button>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-display text-xl font-extrabold">
            Round Scheduler (180-Day Anti-Repetition)
          </h2>
          <input
            type="date"
            aria-label="Schedule date"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            className="border-border bg-surface-2 min-h-11 w-full rounded-[12px] border-2 px-3 text-sm font-bold"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="blue" onClick={() => void handleScheduleFirstSix(false)}>
              Schedule 6 Approved
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void handleScheduleFirstSix(true)}>
              Try Scheduling Top 6 (Includes Drafts)
            </Button>
          </div>
          {error && <p className="text-wrong text-xs font-bold">{error}</p>}
        </Card>
      </section>

      {data && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-extrabold">Question Bank &amp; Review Queue</h2>
          <div className="space-y-2">
            {data.questions.slice(0, 10).map((q) => (
              <Card
                key={q.id}
                variant="subtle"
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Chip tone={q.reviewStatus === 'approved' ? 'correct' : 'gold'}>
                      {q.reviewStatus}
                    </Chip>
                    <Chip tone="neutral">{q.source}</Chip>
                    <span className="rd-tabular text-muted text-xs">{q.id}</span>
                  </div>
                  <p className="text-sm font-bold">{q.content.en?.prompt}</p>
                  {q.factChecklist && (
                    <ul className="text-muted list-inside list-disc text-xs">
                      {q.factChecklist.map((item) => (
                        <li key={item}>Verify the fact: {item}</li>
                      ))}
                    </ul>
                  )}
                </div>
                {q.reviewStatus !== 'approved' && (
                  <Button size="sm" variant="volt" onClick={() => void handleApprove(q.id)}>
                    Approve Draft
                  </Button>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
