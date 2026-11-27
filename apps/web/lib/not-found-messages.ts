import type { Locale } from '@ronduel/shared';

export interface NotFoundCopy {
  code: string;
  title: string;
  body: string;
  backToToday: string;
}

export const NOT_FOUND_MESSAGES: Record<Locale, NotFoundCopy> = {
  bg: {
    code: '404 · Грешка',
    title: 'Страницата не е намерена',
    body: 'За съжаление страницата, която търсиш, не съществува или е преместена.',
    backToToday: 'Обратно към днешния рунд',
  },
  cs: {
    code: '404 · Chyba',
    title: 'Stránka nenalezena',
    body: 'Omlouváme se, stránka, kterou hledáte, neexistuje nebo byla přesunuta.',
    backToToday: 'Zpět na dnešní kolo',
  },
  da: {
    code: '404 · Fejl',
    title: 'Siden blev ikke fundet',
    body: 'Beklager, den side, du leder efter, findes ikke eller er blevet flyttet.',
    backToToday: 'Tilbage til dagens runde',
  },
  de: {
    code: '404 · Fehler',
    title: 'Seite nicht gefunden',
    body: 'Entschuldigung, die gesuchte Seite existiert nicht oder wurde verschoben.',
    backToToday: 'Zurück zur heutigen Runde',
  },
  el: {
    code: '404 · Σφάλμα',
    title: 'Η σελίδα δεν βρέθηκε',
    body: 'Λυπούμαστε, η σελίδα που αναζητάτε δεν υπάρχει ή έχει μετακινηθεί.',
    backToToday: 'Πίσω στον σημερινό γύρο',
  },
  en: {
    code: '404 · Error',
    title: 'Page not found',
    body: 'Sorry, the page you are looking for does not exist or has been moved.',
    backToToday: "Back to today's round",
  },
  es: {
    code: '404 · Error de página',
    title: 'Página no encontrada',
    body: 'Lo sentimos, la página que buscas no existe o ha sido movida.',
    backToToday: 'Volver a la ronda de hoy',
  },
  et: {
    code: '404 · Viga',
    title: 'Lehte ei leitud',
    body: 'Vabandust, lehte, mida otsid, ei eksisteeri või see on teisaldatud.',
    backToToday: 'Tagasi tänase vooru juurde',
  },
  fi: {
    code: '404 · Virhe',
    title: 'Sivua ei löytynyt',
    body: 'Valitettavasti etsimääsi sivua ei ole olemassa tai se on siirretty.',
    backToToday: 'Takaisin päivän kierrokseen',
  },
  fr: {
    code: '404 · Erreur',
    title: 'Page introuvable',
    body: "Désolé, la page que tu recherches n'existe pas ou a été déplacée.",
    backToToday: 'Retour à la manche du jour',
  },
  ga: {
    code: '404 · Earráid',
    title: 'Níor aimsíodh an leathanach',
    body: 'Tá brón orainn, níl an leathanach atá á lorg agat ann nó aistríodh é.',
    backToToday: 'Ar ais go babhta an lae inniu',
  },
  hr: {
    code: '404 · Pogreška',
    title: 'Stranica nije pronađena',
    body: 'Nažalost, stranica koju tražite ne postoji ili je premještena.',
    backToToday: 'Natrag na današnju rundu',
  },
  hu: {
    code: '404 · Hiba',
    title: 'Az oldal nem található',
    body: 'Sajnos a keresett oldal nem létezik, vagy áthelyezték.',
    backToToday: 'Vissza a mai fordulóhoz',
  },
  it: {
    code: '404 · Errore',
    title: 'Pagina non trovata',
    body: 'Spiacenti, la pagina che stai cercando non esiste o è stata spostata.',
    backToToday: 'Torna alla manche di oggi',
  },
  lt: {
    code: '404 · Klaida',
    title: 'Puslapis nerastas',
    body: 'Atsiprašome, puslapis, kurio ieškote, neegzistuoja arba buvo perkeltas.',
    backToToday: 'Grįžti į šios dienos raundą',
  },
  lv: {
    code: '404 · Kļūda',
    title: 'Lapa nav atrasta',
    body: 'Diemžēl lapa, kuru meklējat, nepastāv vai ir pārvietota.',
    backToToday: 'Atpakaļ uz šodienas kārtu',
  },
  mt: {
    code: '404 · Żball',
    title: 'Il-paġna ma nstabitx',
    body: 'Jiddispjaċina, il-paġna li qed tfittex ma teżistix jew ġiet imċaqilqa.',
    backToToday: 'Lura għar-rawnd tal-lum',
  },
  nb: {
    code: '404 · Feil',
    title: 'Siden ble ikke funnet',
    body: 'Beklager, siden du leter etter finnes ikke eller har blitt flyttet.',
    backToToday: 'Tilbake til dagens runde',
  },
  nl: {
    code: '404 · Fout',
    title: 'Pagina niet gevonden',
    body: 'Sorry, de pagina die je zoekt bestaat niet of is verplaatst.',
    backToToday: 'Terug naar de ronde van vandaag',
  },
  pl: {
    code: '404 · Błąd',
    title: 'Nie znaleziono strony',
    body: 'Przepraszamy, strona, której szukasz, nie istnieje lub została przeniesiona.',
    backToToday: 'Wróć do dzisiejszej rundy',
  },
  pt: {
    code: '404 · Erro',
    title: 'Página não encontrada',
    body: 'Desculpe, a página que procura não existe ou foi movida.',
    backToToday: 'Voltar à ronda de hoje',
  },
  ro: {
    code: '404 · Eroare',
    title: 'Pagina nu există',
    body: 'Ne pare rău, pagina pe care o cauți nu există sau a fost mutată.',
    backToToday: 'Înapoi la runda de azi',
  },
  sk: {
    code: '404 · Chyba',
    title: 'Stránka sa nenašla',
    body: 'Prepáčte, stránka, ktorú hľadáte, neexistuje alebo bola presunutá.',
    backToToday: 'Späť na dnešné kolo',
  },
  sl: {
    code: '404 · Napaka',
    title: 'Stran ni bila najdena',
    body: 'Oprostite, stran, ki jo iščete, ne obstaja ali pa je bila premaknjena.',
    backToToday: 'Nazaj na današnji krog',
  },
  sv: {
    code: '404 · Fel',
    title: 'Sidan hittades inte',
    body: 'Tyvärr finns inte sidan du letar efter eller så har den flyttats.',
    backToToday: 'Tillbaka till dagens omgång',
  },
  uk: {
    code: '404 · Помилка',
    title: 'Сторінку не знайдено',
    body: 'На жаль, сторінка, яку ви шукаєте, не існує або була переміщена.',
    backToToday: 'Повернутися до сьогоднішнього раунду',
  },
};

function normalizeCandidate(raw: string | null | undefined): Locale | null {
  if (!raw) return null;
  let candidate = raw.trim().toLowerCase().split('-')[0] || '';
  if (candidate === 'no' || candidate === 'nn') candidate = 'nb';
  return candidate in NOT_FOUND_MESSAGES ? (candidate as Locale) : null;
}

export function resolveNotFoundLocale(pathname?: string): Locale {
  if (pathname) {
    const firstSeg = pathname.split('/').filter(Boolean)[0];
    const fromPath = normalizeCandidate(firstSeg);
    if (fromPath) return fromPath;
  }

  if (typeof document !== 'undefined') {
    try {
      const m = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
      if (m?.[1]) {
        const fromCookie = normalizeCandidate(decodeURIComponent(m[1]));
        if (fromCookie) return fromCookie;
      }
    } catch {}
  }

  if (typeof window !== 'undefined') {
    try {
      const fromStorage = normalizeCandidate(window.localStorage.getItem('ronduel_locale'));
      if (fromStorage) return fromStorage;
    } catch {}

    const navLangs = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const lang of navLangs) {
      const fromNav = normalizeCandidate(lang);
      if (fromNav) return fromNav;
    }
  }

  return 'en';
}
