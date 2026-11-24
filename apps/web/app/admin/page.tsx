'use client';

import Link from 'next/link';
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
  timerSec?: number;
  duplicateWarnings: string[];
  answer?: {
    correctIndex?: number;
    correctOrder?: string[];
    oddIndex?: number;
    numericAnswer?: number;
  };
  content: {
    ro?: { prompt: string; options: string[]; explanation?: string };
    en?: { prompt: string; options: string[]; explanation?: string };
    es?: { prompt: string; options: string[]; explanation?: string };
    pt?: { prompt: string; options: string[]; explanation?: string };
  };
  extraContent?: Record<string, { prompt: string; options: string[]; explanation?: string }>;
}

interface AdminDashboardData {
  questions: AdminQuestion[];
  scheduledRounds: Array<{
    date: string;
    roundNumber: number;
    questionIds: string[];
    topicOfTheDay: string;
    status: string;
    locked?: boolean;
  }>;
  upcomingWarnings: string[];
  leagues: Array<{
    id: string;
    name: string;
    inviteCode: string;
    ownerUid: string;
    memberCount: number;
    maxMembers: number;
    members: Array<{ uid: string; nickname: string; role: string; joinedAt: string }>;
    createdAt: string;
  }>;
  reports: Array<{
    id: string;
    targetType: string;
    targetId: string;
    reason: string;
    status: string;
    createdAt: string;
  }>;
  auditLogs: Array<{
    id: string;
    actorUid: string;
    actorEmail?: string;
    action: string;
    targetType: string;
    targetId: string;
    details: string;
    createdAt: string;
  }>;
  ops: {
    totalPlays: number;
    finishedPlays: number;
    completionRatePct: number;
    avgScore: number;
  };
}

export default function AdminPage() {
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [activeTab, setActiveTab] = useState<'questions' | 'rounds' | 'leagues' | 'audit'>(
    'questions',
  );
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  // Questions filter state
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [previewLocale, setPreviewLocale] = useState<'ro' | 'en' | 'es' | 'pt' | 'pl'>('ro');
  const [searchQuery, setSearchQuery] = useState('');

  // AI Draft Generator state
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [draftTopic, setDraftTopic] = useState('Astronomie');
  const [draftType, setDraftType] = useState<'mcq' | 'order' | 'odd' | 'logic'>('mcq');
  const [draftCount, setDraftCount] = useState(2);
  const [draftLoading, setDraftLoading] = useState(false);

  // Question Editor state
  const [editingQuestion, setEditingQuestion] = useState<AdminQuestion | null>(null);
  const [editorLocale, setEditorLocale] = useState<'ro' | 'en' | 'es' | 'pt' | 'pl'>('ro');
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>('light');

  // League search
  const [leagueSearch, setLeagueSearch] = useState('');

  // Round Scheduler state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [scheduleTopic, setScheduleTopic] = useState('Știință & Univers 🚀');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  // Check stored auth on load
  useEffect(() => {
    const stored = sessionStorage.getItem('ronduel_admin_token');
    const email = sessionStorage.getItem('ronduel_admin_email');
    if (stored) {
      setAdminToken(stored);
      setAdminEmail(email);
    }
    // Also check URL param for login modal trigger (?login=1)
    if (typeof window !== 'undefined' && window.location.search.includes('login=1')) {
      setShowLoginModal(true);
    }
  }, []);

  const getHeaders = useCallback((): HeadersInit => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (adminToken) {
      if (adminToken === 'local-admin') {
        headers['x-admin-token'] = 'local-admin';
      } else {
        headers['Authorization'] = `Bearer ${adminToken}`;
      }
    }
    return headers;
  }, [adminToken]);

  const loadDashboard = useCallback(async () => {
    if (!adminToken) return;
    try {
      const res = await fetch('/api/admin', {
        headers: getHeaders(),
      });
      if (res.ok) {
        setData(await res.json());
      } else if (res.status === 403 || res.status === 404) {
        sessionStorage.removeItem('ronduel_admin_token');
        setAdminToken(null);
      }
    } catch {
      // network error
    }
  }, [adminToken, getHeaders]);

  useEffect(() => {
    if (adminToken) {
      void loadDashboard();
    }
  }, [adminToken, loadDashboard]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      if (!res.ok) {
        setLoginError('Autentificare eșuată sau contul nu deține drepturi de administrator.');
        setLoginLoading(false);
        return;
      }
      const body = (await res.json()) as { idToken: string; email?: string };
      sessionStorage.setItem('ronduel_admin_token', body.idToken);
      if (body.email) sessionStorage.setItem('ronduel_admin_email', body.email);
      setAdminToken(body.idToken);
      setAdminEmail(body.email ?? loginEmail);
      setShowLoginModal(false);
      setToast('Conectat cu succes');
    } catch {
      setLoginError('Eroare la conectare.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleDevBypass = () => {
    sessionStorage.setItem('ronduel_admin_token', 'local-admin');
    sessionStorage.setItem('ronduel_admin_email', 'admin_dev@ronduel.eu');
    setAdminToken('local-admin');
    setAdminEmail('admin_dev@ronduel.eu');
    setShowLoginModal(false);
    setToast('Conectat în modul de dezvoltare');
  };

  const handleLogout = () => {
    sessionStorage.removeItem('ronduel_admin_token');
    sessionStorage.removeItem('ronduel_admin_email');
    setAdminToken(null);
    setData(null);
  };

  // Actions
  const handleGenerateDrafts = async () => {
    setError('');
    setDraftLoading(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          action: 'generate_drafts',
          topic: draftTopic,
          type: draftType,
          difficulty: 2,
          count: draftCount,
        }),
      });
      if (res.ok) {
        setToast(`Au fost generate ${draftCount} drafturi AI.`);
        setShowDraftModal(false);
        void loadDashboard();
      } else {
        const body = await res.json();
        setError(body.error ?? 'Eroare la generare');
      }
    } finally {
      setDraftLoading(false);
    }
  };

  const handleApprove = async (questionId: string) => {
    setError('');
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        action: 'approve_question',
        questionId,
      }),
    });
    const body = await res.json();
    if (res.ok) {
      setToast(`Întrebarea ${questionId} a fost aprobată.`);
      void loadDashboard();
    } else {
      setError(body.error ?? 'Validare eșuată');
    }
  };

  const handleSaveQuestion = async (q: AdminQuestion, alsoApprove = false) => {
    setError('');
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        action: 'save_question',
        id: q.id,
        type: q.type,
        difficulty: q.difficulty,
        topics: q.topics,
        timerSec: q.timerSec ?? 15,
        content: q.content,
        extraContent: q.extraContent,
        answer: q.answer,
        reviewStatus: alsoApprove ? 'approved' : q.reviewStatus,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? 'Eroare la salvare');
      return;
    }
    if (alsoApprove) {
      await handleApprove(q.id);
    } else {
      setToast('Întrebarea a fost salvată.');
      setEditingQuestion(null);
      void loadDashboard();
    }
  };

  const handleScheduleRound = async () => {
    if (selectedQuestionIds.length !== 6) {
      setError('Trebuie să selectezi exact 6 întrebări pentru o rundă.');
      return;
    }
    setError('');
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        action: 'schedule_round',
        date: scheduleDate,
        questionIds: selectedQuestionIds,
        topicOfTheDay: scheduleTopic,
      }),
    });
    const body = await res.json();
    if (res.ok) {
      setToast(`Runda din ${scheduleDate} a fost programată.`);
      setShowScheduleModal(false);
      setSelectedQuestionIds([]);
      void loadDashboard();
    } else {
      setError(body.error ?? 'Eroare la programare');
    }
  };

  const handleRenameLeague = async (codeOrId: string, currentName: string) => {
    const newName = window.prompt('Numele nou al ligii (2–30 caractere):', currentName);
    if (!newName || newName.trim() === currentName) return;
    setError('');
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        action: 'rename_league',
        codeOrId,
        name: newName.trim(),
      }),
    });
    if (res.ok) {
      setToast('Liga a fost redenumită.');
      void loadDashboard();
    } else {
      const b = await res.json();
      setError(b.error ?? 'Eroare la redenumire');
    }
  };

  const handleDeleteLeague = async (codeOrId: string, name: string) => {
    if (!window.confirm(`Sigur dorești să ștergi definitiv liga "${name}"?`)) return;
    setError('');
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        action: 'delete_league',
        codeOrId,
      }),
    });
    if (res.ok) {
      setToast('Liga a fost ștearsă.');
      void loadDashboard();
    } else {
      const b = await res.json();
      setError(b.error ?? 'Eroare la ștergere');
    }
  };

  const handleRemoveMember = async (codeOrId: string, targetUid: string, nickname: string) => {
    if (!window.confirm(`Sigur dorești să elimini membrul "${nickname}" din ligă?`)) return;
    setError('');
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        action: 'remove_league_member',
        codeOrId,
        targetUid,
      }),
    });
    if (res.ok) {
      setToast('Membrul a fost eliminat.');
      void loadDashboard();
    } else {
      const b = await res.json();
      setError(b.error ?? 'Eroare la eliminare');
    }
  };

  // IF NOT AUTHENTICATED: RENDER BRANDED 404 WITHOUT REVEALING ADMIN
  if (!adminToken) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
        <Wordmark size="lg" />
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowLoginModal(true)}
            className="font-display text-muted hover:text-ink cursor-pointer text-sm font-extrabold uppercase tracking-widest transition-colors"
            title="Conectare"
          >
            404 · Error
          </button>
          <h1 className="font-display text-ink text-3xl font-extrabold">Pagina nu există</h1>
          <p className="text-muted mx-auto max-w-xs text-sm">
            Ne pare rău, pagina pe care o cauți nu există sau a fost mutată.
          </p>
        </div>
        <Link href="/ro" className="w-full">
          <Button variant="volt" fullWidth size="lg">
            Înapoi la runda de azi
          </Button>
        </Link>

        {showLoginModal && (
          <div className="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <Card className="w-full max-w-sm space-y-4 text-left">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-extrabold">Conectare securizată</h2>
                <button
                  type="button"
                  onClick={() => setShowLoginModal(false)}
                  className="text-muted hover:text-ink text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleLogin} className="space-y-3">
                <div>
                  <label className="text-muted block text-xs font-bold">Email administrator</label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="border-border bg-surface-2 text-ink mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="admin@ronduel.eu"
                  />
                </div>
                <div>
                  <label className="text-muted block text-xs font-bold">Parolă</label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="border-border bg-surface-2 text-ink mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                {loginError && <p className="text-wrong text-xs font-bold">{loginError}</p>}
                <Button fullWidth variant="volt" type="submit" disabled={loginLoading}>
                  {loginLoading ? 'Se verifică...' : 'Autentificare'}
                </Button>
              </form>

              {process.env.NODE_ENV !== 'production' && (
                <div className="border-border-subtle border-t pt-3">
                  <Button size="sm" variant="secondary" fullWidth onClick={handleDevBypass}>
                    Conectare rapidă (Dev harness)
                  </Button>
                </div>
              )}
            </Card>
          </div>
        )}
      </main>
    );
  }

  // FILTERED QUESTIONS
  const filteredQuestions = (data?.questions ?? []).filter((q) => {
    if (filterType !== 'all' && q.type !== filterType) return false;
    if (filterStatus !== 'all' && q.reviewStatus !== filterStatus) return false;
    if (searchQuery.trim()) {
      const qText = searchQuery.toLowerCase();
      const content =
        previewLocale === 'pl'
          ? (q.extraContent?.pl ?? q.content.en)
          : (q.content[previewLocale] ?? q.content.en);
      const matchPrompt = content?.prompt?.toLowerCase().includes(qText);
      const matchTopic = q.topics.some((t) => t.toLowerCase().includes(qText));
      const matchId = q.id.toLowerCase().includes(qText);
      if (!matchPrompt && !matchTopic && !matchId) return false;
    }
    return true;
  });

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* HEADER */}
      <header className="border-border-subtle flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Wordmark size="sm" />
          <Chip tone="gold">Admin Console</Chip>
          {adminEmail && <span className="text-muted text-xs font-medium">{adminEmail}</span>}
        </div>
        <div className="flex items-center gap-2">
          {toast && <Toast message={toast} tone="success" />}
          <Button size="sm" variant="secondary" onClick={handleLogout}>
            Deconectare
          </Button>
        </div>
      </header>

      {error && (
        <div className="border-wrong/30 bg-wrong/10 text-wrong rounded-xl border p-3 text-sm font-bold">
          {error}
        </div>
      )}

      {/* STATS OVERVIEW */}
      {data && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card variant="secondary" className="p-3 text-center">
            <span className="text-muted block text-xs font-bold uppercase">Total Jocuri</span>
            <span className="font-display text-2xl font-extrabold">{data.ops.totalPlays}</span>
          </Card>
          <Card variant="secondary" className="p-3 text-center">
            <span className="text-muted block text-xs font-bold uppercase">Rată finalizare</span>
            <span className="font-display text-correct-text text-2xl font-extrabold">
              {data.ops.completionRatePct}%
            </span>
          </Card>
          <Card variant="secondary" className="p-3 text-center">
            <span className="text-muted block text-xs font-bold uppercase">Scor mediu</span>
            <span className="font-display text-2xl font-extrabold">{data.ops.avgScore}</span>
          </Card>
          <Card variant="secondary" className="p-3 text-center">
            <span className="text-muted block text-xs font-bold uppercase">Ligi active</span>
            <span className="font-display text-2xl font-extrabold">{data.leagues.length}</span>
          </Card>
        </section>
      )}

      {/* TABS NAVIGATION */}
      <nav className="border-border-subtle flex gap-2 border-b pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('questions')}
          className={`rounded-lg px-4 py-2 text-sm font-extrabold transition-colors ${
            activeTab === 'questions'
              ? 'bg-ink text-surface'
              : 'text-muted hover:bg-surface-2 hover:text-ink'
          }`}
        >
          Întrebări ({data?.questions.length ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('rounds')}
          className={`rounded-lg px-4 py-2 text-sm font-extrabold transition-colors ${
            activeTab === 'rounds'
              ? 'bg-ink text-surface'
              : 'text-muted hover:bg-surface-2 hover:text-ink'
          }`}
        >
          Runde &amp; Calendar ({data?.scheduledRounds.length ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('leagues')}
          className={`rounded-lg px-4 py-2 text-sm font-extrabold transition-colors ${
            activeTab === 'leagues'
              ? 'bg-ink text-surface'
              : 'text-muted hover:bg-surface-2 hover:text-ink'
          }`}
        >
          Ligi ({data?.leagues.length ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`rounded-lg px-4 py-2 text-sm font-extrabold transition-colors ${
            activeTab === 'audit'
              ? 'bg-ink text-surface'
              : 'text-muted hover:bg-surface-2 hover:text-ink'
          }`}
        >
          Jurnal Audit ({data?.auditLogs.length ?? 0})
        </button>
      </nav>

      {/* TAB 1: QUESTIONS */}
      {activeTab === 'questions' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Caută în întrebări..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-border bg-surface-2 text-ink rounded-lg border px-3 py-1.5 text-xs font-medium"
              />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="border-border bg-surface-2 text-ink rounded-lg border px-2.5 py-1.5 text-xs font-bold"
              >
                <option value="all">Toate tipurile</option>
                <option value="mcq">Grilă (MCQ)</option>
                <option value="order">Ordonare</option>
                <option value="odd">Intrusul</option>
                <option value="logic">Logică</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border-border bg-surface-2 text-ink rounded-lg border px-2.5 py-1.5 text-xs font-bold"
              >
                <option value="all">Toate stările</option>
                <option value="draft">Draft</option>
                <option value="approved">Aprobat</option>
              </select>
              <div className="flex items-center gap-1 rounded-lg border p-1 text-xs font-bold">
                <span className="text-muted px-1">Limbă:</span>
                {(['ro', 'en', 'es', 'pt', 'pl'] as const).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setPreviewLocale(loc)}
                    className={`rounded px-1.5 py-0.5 uppercase ${
                      previewLocale === loc ? 'bg-ink text-surface' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => setShowDraftModal(true)}>
                ✨ Generează drafturi AI
              </Button>
              <Button
                size="sm"
                variant="volt"
                onClick={() =>
                  setEditingQuestion({
                    id: '',
                    type: 'mcq',
                    difficulty: 2,
                    topics: ['general'],
                    source: 'human',
                    reviewStatus: 'draft',
                    timerSec: 15,
                    duplicateWarnings: [],
                    content: {
                      ro: { prompt: '', options: ['', '', '', ''], explanation: '' },
                      en: { prompt: '', options: ['', '', '', ''], explanation: '' },
                      es: { prompt: '', options: ['', '', '', ''], explanation: '' },
                      pt: { prompt: '', options: ['', '', '', ''], explanation: '' },
                    },
                  })
                }
              >
                + Întrebare nouă
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {filteredQuestions.map((q) => {
              const display =
                previewLocale === 'pl'
                  ? (q.extraContent?.pl ?? q.content.en)
                  : (q.content[previewLocale] ?? q.content.en);
              const correctIdx = q.answer?.correctIndex ?? 0;
              return (
                <Card key={q.id} variant="secondary" className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip tone={q.reviewStatus === 'approved' ? 'correct' : 'gold'}>
                        {q.reviewStatus}
                      </Chip>
                      <Chip tone="neutral">{q.type.toUpperCase()}</Chip>
                      <Chip tone="neutral">Dificultate {q.difficulty}/3</Chip>
                      <Chip tone="neutral">⏱ {q.timerSec ?? 15}s</Chip>
                      <span className="rd-tabular text-muted text-xs">{q.id}</span>
                      {q.lastUsedOn && (
                        <span className="text-muted text-xs">
                          Folosit pe: <b>{q.lastUsedOn}</b>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setEditingQuestion(structuredClone(q))}
                      >
                        Editează
                      </Button>
                      {q.reviewStatus !== 'approved' && (
                        <Button size="sm" variant="volt" onClick={() => void handleApprove(q.id)}>
                          Aprobă
                        </Button>
                      )}
                    </div>
                  </div>

                  <p className="text-base font-bold">{display?.prompt}</p>

                  {display?.options && (
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {display.options.map((opt, idx) => {
                        const isCorrect = q.type === 'order' || idx === correctIdx;
                        return (
                          <div
                            key={idx}
                            className={`rounded-[10px] border px-3 py-1.5 text-xs font-bold ${
                              isCorrect
                                ? 'border-border bg-correct/20 text-correct-text'
                                : 'border-border-subtle bg-surface-2 text-ink'
                            }`}
                          >
                            {q.type === 'order' ? `${idx + 1}. ` : isCorrect ? '✓ ' : ''}
                            {opt}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {display?.explanation && (
                    <p className="text-muted text-xs">
                      <b>Explicație:</b> {display.explanation}
                    </p>
                  )}

                  {q.duplicateWarnings?.length > 0 && (
                    <div className="text-wrong rounded-lg bg-red-500/10 p-2 text-xs font-bold">
                      Avertisment similaritate cu: {q.duplicateWarnings.join(', ')}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* TAB 2: DAILY ROUNDS & CALENDAR */}
      {activeTab === 'rounds' && (
        <section className="space-y-4">
          {data?.upcomingWarnings && data.upcomingWarnings.length > 0 && (
            <div className="border-gold/30 bg-gold/10 text-gold-text space-y-1 rounded-xl border p-4 text-xs font-bold">
              <span className="font-display block text-sm uppercase">
                ⚠️ Avertismente runde viitoare (următoarele 7 zile)
              </span>
              {data.upcomingWarnings.map((w, idx) => (
                <p key={idx}>• {w}</p>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-extrabold">Calendar Runde</h2>
            <Button size="sm" variant="volt" onClick={() => setShowScheduleModal(true)}>
              + Programează o rundă
            </Button>
          </div>

          <div className="space-y-3">
            {data?.scheduledRounds.map((r) => (
              <Card key={r.date} variant="secondary" className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-base font-extrabold">
                      Runda #{r.roundNumber} ({r.date})
                    </span>
                    <Chip tone="gold">{r.topicOfTheDay}</Chip>
                    {r.locked && <Chip tone="neutral">🔒 Blocat (Zi începută)</Chip>}
                  </div>
                  <span className="text-muted text-xs font-bold uppercase">{r.status}</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {r.questionIds.map((qid) => (
                    <span
                      key={qid}
                      className="border-border bg-surface-2 rd-tabular rounded px-2 py-1 font-mono"
                    >
                      {qid}
                    </span>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* TAB 3: LEAGUES */}
      {activeTab === 'leagues' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <input
              type="text"
              placeholder="Caută după nume sau cod ligă..."
              value={leagueSearch}
              onChange={(e) => setLeagueSearch(e.target.value)}
              className="border-border bg-surface-2 text-ink w-full max-w-sm rounded-lg border px-3 py-1.5 text-xs font-medium"
            />
          </div>

          <div className="space-y-3">
            {data?.leagues
              .filter(
                (l) =>
                  !leagueSearch.trim() ||
                  l.name.toLowerCase().includes(leagueSearch.toLowerCase()) ||
                  l.inviteCode.toLowerCase().includes(leagueSearch.toLowerCase()),
              )
              .map((lg) => (
                <Card key={lg.id} variant="secondary" className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display text-base font-extrabold">{lg.name}</h3>
                      <p className="text-muted text-xs">
                        Cod: <b>{lg.inviteCode}</b> · Creată: {lg.createdAt?.slice(0, 10)} · Membri:{' '}
                        {lg.memberCount}/{lg.maxMembers}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleRenameLeague(lg.id, lg.name)}
                      >
                        Redenumește
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleDeleteLeague(lg.id, lg.name)}
                      >
                        Șterge liga
                      </Button>
                    </div>
                  </div>

                  <div className="border-border-subtle border-t pt-2">
                    <span className="text-muted block text-xs font-bold uppercase">Membri:</span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {lg.members.map((m) => (
                        <div
                          key={m.uid}
                          className="border-border bg-surface-2 flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs"
                        >
                          <span className="font-bold">{m.nickname}</span>
                          {m.uid === lg.ownerUid && <Chip tone="gold">Owner</Chip>}
                          <button
                            type="button"
                            onClick={() => void handleRemoveMember(lg.id, m.uid, m.nickname)}
                            className="text-wrong hover:text-wrong/80 ml-1 font-bold"
                            title="Elimină din ligă"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
          </div>
        </section>
      )}

      {/* TAB 4: AUDIT LOG */}
      {activeTab === 'audit' && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-extrabold">Jurnal de activitate admin</h2>
          <div className="space-y-2">
            {data?.auditLogs.map((log) => (
              <Card key={log.id} variant="secondary" className="p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Chip tone="neutral">{log.action}</Chip>
                    <span className="font-bold">{log.targetType}:</span>
                    <span className="rd-tabular font-mono text-xs">{log.targetId}</span>
                  </div>
                  <span className="text-muted text-xs">{log.createdAt}</span>
                </div>
                <p className="mt-1 text-xs">{log.details}</p>
                <span className="text-muted mt-1 block text-[10px]">
                  Actor: {log.actorEmail ?? log.actorUid}
                </span>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* MODAL: AI DRAFT GENERATOR */}
      {showDraftModal && (
        <div className="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-md space-y-4">
            <h2 className="font-display text-lg font-extrabold">Generează drafturi AI</h2>
            <div className="space-y-3 text-sm">
              <div>
                <label className="text-muted block text-xs font-bold">Subiect / Temă</label>
                <input
                  type="text"
                  value={draftTopic}
                  onChange={(e) => setDraftTopic(e.target.value)}
                  className="border-border bg-surface-2 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-muted block text-xs font-bold">Tip întrebare</label>
                <select
                  value={draftType}
                  onChange={(e) => setDraftType(e.target.value as any)}
                  className="border-border bg-surface-2 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="mcq">Grilă (MCQ)</option>
                  <option value="order">Ordonare</option>
                  <option value="odd">Intrusul</option>
                  <option value="logic">Logică</option>
                </select>
              </div>
              <div>
                <label className="text-muted block text-xs font-bold">Număr întrebări (1–5)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={draftCount}
                  onChange={(e) => setDraftCount(Number(e.target.value))}
                  className="border-border bg-surface-2 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowDraftModal(false)}>
                Anulează
              </Button>
              <Button
                variant="volt"
                onClick={() => void handleGenerateDrafts()}
                disabled={draftLoading}
              >
                {draftLoading ? 'Se generează...' : 'Generează'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: SCHEDULE ROUND */}
      {showScheduleModal && (
        <div className="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto">
            <h2 className="font-display text-lg font-extrabold">Programează o rundă</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="text-muted block text-xs font-bold">Data (YYYY-MM-DD)</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="border-border bg-surface-2 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-muted block text-xs font-bold">Tema zilei + Emoji</label>
                <input
                  type="text"
                  value={scheduleTopic}
                  onChange={(e) => setScheduleTopic(e.target.value)}
                  className="border-border bg-surface-2 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-muted flex items-center justify-between text-xs font-bold">
                <span>Selectează exact 6 întrebări ({selectedQuestionIds.length}/6):</span>
                {selectedQuestionIds.length === 6 && (
                  <span className="text-correct-text font-bold">✓ 6 selectate</span>
                )}
              </label>
              <div className="max-h-60 space-y-1.5 overflow-y-auto rounded-lg border p-2">
                {data?.questions
                  .filter((q) => q.reviewStatus === 'approved')
                  .map((q) => {
                    const isSelected = selectedQuestionIds.includes(q.id);
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedQuestionIds(selectedQuestionIds.filter((id) => id !== q.id));
                          } else if (selectedQuestionIds.length < 6) {
                            setSelectedQuestionIds([...selectedQuestionIds, q.id]);
                          }
                        }}
                        className={`flex w-full items-center justify-between rounded-md p-2 text-left text-xs ${
                          isSelected
                            ? 'bg-correct/20 text-correct-text font-bold'
                            : 'hover:bg-surface-2 text-ink'
                        }`}
                      >
                        <span className="truncate">
                          [{q.type.toUpperCase()}] {q.content.ro?.prompt ?? q.content.en?.prompt}
                        </span>
                        <span className="rd-tabular text-muted ml-2 shrink-0">{q.id}</span>
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowScheduleModal(false)}>
                Anulează
              </Button>
              <Button
                variant="volt"
                disabled={selectedQuestionIds.length !== 6}
                onClick={() => void handleScheduleRound()}
              >
                Programează
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: QUESTION EDITOR & LIVE PREVIEW */}
      {editingQuestion && (
        <div className="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="max-h-[92vh] w-full max-w-4xl space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="font-display text-lg font-extrabold">
                {editingQuestion.id ? `Editează ${editingQuestion.id}` : 'Întrebare nouă'}
              </h2>
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
                className="text-muted hover:text-ink text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* LEFT: FORM FIELDS */}
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-muted block text-xs font-bold">Tip</label>
                    <select
                      value={editingQuestion.type}
                      onChange={(e) =>
                        setEditingQuestion({
                          ...editingQuestion,
                          type: e.target.value as any,
                        })
                      }
                      className="border-border bg-surface-2 mt-1 w-full rounded border p-1.5 text-xs font-bold"
                    >
                      <option value="mcq">Grilă (MCQ)</option>
                      <option value="order">Ordonare</option>
                      <option value="odd">Intrusul</option>
                      <option value="logic">Logică</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-muted block text-xs font-bold">Dificultate</label>
                    <select
                      value={editingQuestion.difficulty}
                      onChange={(e) =>
                        setEditingQuestion({
                          ...editingQuestion,
                          difficulty: Number(e.target.value) as any,
                        })
                      }
                      className="border-border bg-surface-2 mt-1 w-full rounded border p-1.5 text-xs font-bold"
                    >
                      <option value={1}>1 (Ușor)</option>
                      <option value={2}>2 (Mediu)</option>
                      <option value={3}>3 (Dificil)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-muted block text-xs font-bold">Timer (secunde)</label>
                    <input
                      type="number"
                      min={8}
                      max={20}
                      value={editingQuestion.timerSec ?? 15}
                      onChange={(e) =>
                        setEditingQuestion({
                          ...editingQuestion,
                          timerSec: Number(e.target.value),
                        })
                      }
                      className="border-border bg-surface-2 mt-1 w-full rounded border p-1.5 text-xs font-bold"
                    />
                  </div>
                </div>

                {/* LOCALE TABS */}
                <div className="flex gap-1 border-b pb-1">
                  {(['ro', 'en', 'es', 'pt', 'pl'] as const).map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setEditorLocale(loc)}
                      className={`rounded px-2.5 py-1 text-xs font-bold uppercase transition-colors ${
                        editorLocale === loc
                          ? 'bg-ink text-surface'
                          : 'text-muted hover:bg-surface-2'
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>

                {/* CURRENT LOCALE INPUTS */}
                {(() => {
                  const currentContent =
                    editorLocale === 'pl'
                      ? (editingQuestion.extraContent?.pl ?? {
                          prompt: '',
                          options: ['', '', '', ''],
                          explanation: '',
                        })
                      : (editingQuestion.content[editorLocale] ?? {
                          prompt: '',
                          options: ['', '', '', ''],
                          explanation: '',
                        });

                  const updateCurrentLocale = (
                    patch: Partial<{ prompt: string; options: string[]; explanation: string }>,
                  ) => {
                    const next = { ...currentContent, ...patch };
                    if (editorLocale === 'pl') {
                      setEditingQuestion({
                        ...editingQuestion,
                        extraContent: { ...editingQuestion.extraContent, pl: next },
                      });
                    } else {
                      setEditingQuestion({
                        ...editingQuestion,
                        content: { ...editingQuestion.content, [editorLocale]: next },
                      });
                    }
                  };

                  return (
                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="text-muted block font-bold">
                          Întrebare / Prompt ({editorLocale.toUpperCase()})
                        </label>
                        <textarea
                          rows={2}
                          value={currentContent.prompt}
                          onChange={(e) => updateCurrentLocale({ prompt: e.target.value })}
                          className="border-border bg-surface-2 mt-1 w-full rounded border p-2 text-xs font-medium"
                          placeholder="Introdu textul întrebării..."
                        />
                      </div>

                      {editingQuestion.type !== 'logic' && (
                        <div>
                          <label className="text-muted mb-1 block font-bold">
                            Opțiuni de răspuns:
                          </label>
                          <div className="space-y-1.5">
                            {currentContent.options.map((opt, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="text-muted w-4 font-bold">{idx + 1}.</span>
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => {
                                    const nextOpts = [...currentContent.options];
                                    nextOpts[idx] = e.target.value;
                                    updateCurrentLocale({ options: nextOpts });
                                  }}
                                  className="border-border bg-surface-2 flex-1 rounded border px-2 py-1 text-xs"
                                />
                                {editingQuestion.type === 'mcq' && (
                                  <label className="flex items-center gap-1 text-[11px]">
                                    <input
                                      type="radio"
                                      name="correctIndex"
                                      checked={editingQuestion.answer?.correctIndex === idx}
                                      onChange={() =>
                                        setEditingQuestion({
                                          ...editingQuestion,
                                          answer: { correctIndex: idx },
                                        })
                                      }
                                    />
                                    Corect
                                  </label>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="text-muted block font-bold">
                          Explicație ({editorLocale.toUpperCase()})
                        </label>
                        <textarea
                          rows={2}
                          value={currentContent.explanation ?? ''}
                          onChange={(e) => updateCurrentLocale({ explanation: e.target.value })}
                          className="border-border bg-surface-2 mt-1 w-full rounded border p-2 text-xs font-medium"
                          placeholder="Explicație detaliată după răspuns..."
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* RIGHT: LIVE PLAYER PREVIEW */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted text-xs font-bold uppercase">
                    Live Player Preview ({editorLocale.toUpperCase()})
                  </span>
                  <div className="flex items-center gap-1 rounded border p-0.5 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setPreviewTheme('light')}
                      className={`rounded px-2 py-0.5 ${
                        previewTheme === 'light' ? 'bg-ink text-surface' : 'text-muted'
                      }`}
                    >
                      Light
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTheme('dark')}
                      className={`rounded px-2 py-0.5 ${
                        previewTheme === 'dark' ? 'bg-ink text-surface' : 'text-muted'
                      }`}
                    >
                      Dark
                    </button>
                  </div>
                </div>

                <div
                  className={`rounded-xl border p-4 shadow-sm transition-colors ${
                    previewTheme === 'dark'
                      ? 'border-neutral-700 bg-neutral-900 text-white'
                      : 'border-neutral-200 bg-white text-neutral-950'
                  }`}
                >
                  {(() => {
                    const c =
                      editorLocale === 'pl'
                        ? (editingQuestion.extraContent?.pl ?? editingQuestion.content.en)
                        : (editingQuestion.content[editorLocale] ?? editingQuestion.content.en);

                    return (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-xs opacity-75">
                          <span>
                            Tip: <b>{editingQuestion.type.toUpperCase()}</b>
                          </span>
                          <span>⏱ {editingQuestion.timerSec ?? 15}s</span>
                        </div>
                        <h3 className="font-display text-base font-extrabold">
                          {c?.prompt || 'Textul întrebării va apărea aici...'}
                        </h3>
                        {c?.options && (
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {c.options.map((opt, idx) => (
                              <div
                                key={idx}
                                className={`rounded-lg border p-2.5 text-xs font-bold ${
                                  previewTheme === 'dark'
                                    ? 'border-neutral-800 bg-neutral-800/60'
                                    : 'border-neutral-200 bg-neutral-50'
                                }`}
                              >
                                {editingQuestion.type === 'order' ? `${idx + 1}. ` : ''}
                                {opt || `Opțiunea ${idx + 1}`}
                              </div>
                            ))}
                          </div>
                        )}
                        {c?.explanation && (
                          <p className="text-xs opacity-80">
                            <b>Explicație:</b> {c.explanation}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="secondary" onClick={() => setEditingQuestion(null)}>
                Anulează
              </Button>
              <Button
                variant="secondary"
                onClick={() => void handleSaveQuestion(editingQuestion, false)}
              >
                Salvează ca Draft
              </Button>
              <Button variant="volt" onClick={() => void handleSaveQuestion(editingQuestion, true)}>
                Salvează și Aprobă
              </Button>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
