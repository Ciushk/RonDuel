import json
import os
import re

MESSAGES_DIR = "apps/web/messages"

with open(os.path.join(MESSAGES_DIR, "en.json"), "r", encoding="utf-8") as f:
    en = json.load(f)

# Specific per-language overrides for strings that happened to match English
OVERRIDES = {
    "fr": {
        "nav.duels": "Les Duels",
        "league.challengeBtn": "Défier en 1v1",
        "league.rankSuffix": "(Rang #{rank})",
        "duel.challengerFallback": "Créateur",
        "duel.vsBadge": "c.",
        "profile.proBadge": "Pro",
        "explainer.step1Title": "6 questions, env. 3 min",
        "explainer.demoCard": "RonDuel n° 12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5",
        "legal.footerCookies": "Témoins (cookies)",
        "common.points": "{points} points",
        "common.rankPlace": "Rang #{rank}",
        "common.versus": "contre {name}",
        "home.roundMeta": "6 questions · env. 3 min",
        "leagues.joinByCodeShort": "Code d'invitation",
        "leagues.globalBadge": "MONDIAL",
        "leagues.adminBadge": "ADMIN",
        "league.emojiLabel": "Émoticône",
        "ronbot.adminTitle": "Co-pilote Admin",
        "settings.themeProMidnight": "Pro : Court de Minuit",
        "settings.themeProClay": "Pro : Terre Battue",
        "settings.themeProNeon": "Pro : Arcade Néon",
    },
    "es": {
        "duel.vsBadge": "vs.",
        "common.versus": "contra {name}",
        "league.emojiLabel": "Emoticono",
        "leagues.adminBadge": "ADMIN",
        "leagues.globalBadge": "MUNDIAL",
        "profile.proBadge": "Pro",
        "explainer.demoCard": "RonDuel n.º 12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5",
        "legal.footerCookies": "Política de cookies",
        "ronbot.adminTitle": "Copiloto de admin",
        "settings.themeProMidnight": "Pro: Pista Nocturna",
        "settings.themeProClay": "Pro: Pista de Tierra",
        "settings.themeProNeon": "Pro: Recreativa Neón",
    },
    "de": {
        "duel.vsBadge": "vs.",
        "common.versus": "gegen {name}",
        "league.emojiLabel": "Emoji-Symbol",
        "leagues.adminBadge": "ADMIN",
        "profile.proBadge": "Pro",
        "explainer.demoCard": "RonDuel Nr. 12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5",
        "legal.footerCookies": "Cookie-Hinweise",
        "ronbot.adminTitle": "Admin-Kopilot",
        "settings.themeProMidnight": "Pro: Mitternachtsplatz",
        "settings.themeProClay": "Pro: Sandplatz",
        "settings.themeProNeon": "Pro: Neon-Arkade",
    },
    "it": {
        "onboarding.nicknameLabel": "Soprannome",
        "league.adminLabel": "Amministratore: {name}",
        "league.emojiLabel": "Emoticon",
        "duel.vsBadge": "contro",
        "profile.proBadge": "Pro",
        "settings.themeProMidnight": "Pro: Campo Notturno",
        "settings.themeProClay": "Pro: Terra Rossa",
        "settings.themeProNeon": "Pro: Arcade Neon",
        "explainer.demoCard": "RonDuel n. 12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5",
        "legal.footerPrivacy": "Informativa privacy",
        "auth.emailLabel": "Indirizzo e-mail",
        "auth.passwordLabel": "Parola d'ordine",
        "a11y.homeLink": "RonDuel – pagina iniziale",
        "common.versus": "contro {name}",
        "leagues.adminBadge": "ADMIN",
    },
    "pt": {
        "league.adminLabel": "Administrador: {name}",
        "league.emojiLabel": "Emoticon",
        "duel.vsBadge": "vs.",
        "profile.proBadge": "Pro",
        "settings.themeProMidnight": "Pro: Campo Noturno",
        "settings.themeProClay": "Pro: Saibro",
        "settings.themeProNeon": "Pro: Fliperama Neon",
        "explainer.demoCard": "RonDuel n.º 12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5",
        "legal.footerCookies": "Política de cookies",
        "auth.emailLabel": "Endereço de e-mail",
        "common.points": "{points} pontos",
        "common.versus": "contra {name}",
        "leagues.globalBadge": "MUNDIAL",
        "leagues.adminBadge": "ADMIN",
    },
    "nl": {
        "nav.duels": "1v1 Duels",
        "play.startNow": "Nu starten 3-2-1",
        "result.correctCount": "{correct} van de {total} juist",
        "league.challengeBtn": "Défier 1v1",
        "league.emojiLabel": "Emoticon",
        "duel.title": "1v1 Scherm-duel",
        "duel.vsBadge": "tegen",
        "duel.rematch": "Revanche",
        "profile.proBadge": "Pro",
        "profile.details": "Details bekijken",
        "pro.subscribeCta": "Start met RonDuel Pro",
        "settings.themeProMidnight": "Pro: Middernachtbaan",
        "settings.themeProClay": "Pro: Gravelbaan",
        "settings.themeProNeon": "Pro: Neon Arcadehal",
        "explainer.demoCard": "RonDuel nr. 12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5",
        "legal.footerPrivacy": "Privacybeleid",
        "legal.footerCookies": "Cookiebeleid",
        "common.versus": "tegen {name}",
        "account.later": "Niet nu",
        "leagues.joinByCodeShort": "Code invoeren",
        "leagues.adminBadge": "ADMIN",
        "duels.walkoverBadge": "Forfait 🏆",
    },
    "pl": {
        "play.startNow": "Zacznij 3-2-1",
        "league.emojiLabel": "Emotikon",
        "duel.vsBadge": "kontra",
        "profile.proBadge": "Pro",
        "explainer.demoCard": "RonDuel nr 12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5",
        "common.versus": "przeciwko {name}",
        "ronbot.adminTitle": "Asystent admina",
        "leagues.adminBadge": "ADMIN",
    },
    "cs": {
        "duel.vsBadge": "proti",
        "league.emojiLabel": "Emotikon",
        "profile.proBadge": "Pro",
        "explainer.demoCard": "RonDuel č. 12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5",
        "common.versus": "proti {name}",
        "ronbot.adminTitle": "Kopilot admina",
        "leagues.adminBadge": "ADMIN",
    },
    "sk": {
        "league.challengeBtn": "Vyzvať na 1v1",
        "league.emojiLabel": "Emotikon",
        "duel.vsBadge": "proti",
        "profile.proBadge": "Pro",
        "explainer.demoCard": "RonDuel č. 12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5",
        "legal.footerCookies": "Zásady cookies",
        "ronbot.adminTitle": "Kopilot admina",
        "common.versus": "proti {name}",
        "leagues.adminBadge": "ADMIN",
    },
    "bg": {
        "duel.vsBadge": "срещу",
        "league.emojiLabel": "Емотикон",
        "profile.proBadge": "Pro",
        "explainer.demoCard": "RonDuel № 12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5",
        "common.versus": "срещу {name}",
        "ronbot.adminTitle": "Копилот на админа",
        "leagues.adminBadge": "АДМИН",
    },
    "hr": {
        "league.emojiLabel": "Emotikon",
        "duel.vsBadge": "protiv",
        "profile.proBadge": "Pro",
        "explainer.demoCard": "RonDuel br. 12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5",
        "ronbot.adminTitle": "Admin kopilot",
        "leagues.adminBadge": "ADMIN",
        "common.versus": "protiv {name}",
    },
    "sl": {
        "league.emojiLabel": "Smeško",
        "duel.vsBadge": "proti",
        "profile.proBadge": "Pro",
        "explainer.demoCard": "RonDuel št. 12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5",
        "ronbot.adminTitle": "Admin kopilot",
        "common.versus": "proti {name}",
        "leagues.adminBadge": "ADMIN",
    },
    "uk": {
        "duel.vsBadge": "проти",
        "profile.proBadge": "Pro",
        "explainer.demoCard": "RonDuel № 12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5",
        "auth.emailLabel": "Електронна пошта",
        "ronbot.adminTitle": "Адмін-помічник",
        "leagues.adminBadge": "АДМІН",
        "league.emojiLabel": "Емодзі",
    },
    "hu": {
        "league.adminLabel": "Adminisztrátor: {name}",
        "league.emojiLabel": "Hangulatjel",
        "duel.vsBadge": "ellene",
        "profile.proBadge": "Pro",
        "settings.themeProMidnight": "Pro: Éjféli pálya",
        "settings.themeProClay": "Pro: Salakos pálya",
        "settings.themeProNeon": "Pro: Neon Arcade",
        "explainer.demoCard": "RonDuel 12. sz. · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5",
        "leagues.adminBadge": "ADMIN",
        "common.versus": "ellenfél: {name}",
    },
    "el": {
        "league.emojiLabel": "Εικονίδιο",
        "duel.vsBadge": "κατά",
        "profile.proBadge": "Pro",
        "settings.themeProMidnight": "Pro: Νυχτερινό γήπεδο",
        "settings.themeProClay": "Pro: Χωμάτινο γήπεδο",
        "settings.themeProNeon": "Pro: Νέον Arcade",
        "explainer.demoCard": "RonDuel αρ. 12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5",
        "common.versus": "κατά {name}",
        "leagues.adminBadge": "ADMIN",
    },
    "ga": {
        "league.emojiLabel": "Straoiseog",
        "duel.vsBadge": "in aghaidh",
        "profile.proBadge": "Pro",
        "settings.themeProMidnight": "Pro: Cúirt Meán Oíche",
        "settings.themeProClay": "Pro: Cúirt Chré",
        "settings.themeProNeon": "Pro: Stuara Neon",
        "explainer.demoCard": "RonDuel #12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5",
        "common.versus": "in aghaidh {name}",
        "leagues.adminBadge": "ADMIN",
    },
    "mt": {
        "league.emojiLabel": "Emotikona",
        "duel.vsBadge": "kontra",
        "duel.rematch": "Rivincita",
        "profile.proBadge": "Pro",
        "settings.themeProMidnight": "Pro: Qorti ta Nofs il-Lejl",
        "settings.themeProClay": "Pro: Qorti tat-Tafal",
        "settings.themeProNeon": "Pro: Arkata Neon",
        "explainer.demoCard": "RonDuel nru 12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5",
        "legal.footerCookies": "Politika tal-cookies",
        "auth.emailLabel": "Indirizz elettroniku",
        "duels.draw": "Parità",
        "common.versus": "kontra {name}",
        "leagues.adminBadge": "ADMIN",
    },
    "sv": {
        "league.adminLabel": "Administratör: {name}",
        "league.emojiLabel": "Emoji-ikon",
        "profile.proBadge": "Pro",
        "settings.themeProMidnight": "Pro: Midnattsbana",
        "settings.themeProClay": "Pro: Grusbana",
        "settings.themeProNeon": "Pro: Neonarkad",
        "explainer.demoCard": "RonDuel nr 12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5",
        "ronbot.adminTitle": "Admin-medpilot",
        "leagues.adminBadge": "ADMIN",
        "duels.walkoverBadge": "Walkover (seger) 🏆",
        "duel.vsBadge": "mot",
        "common.versus": "mot {name}",
    },
    "da": {
        "league.adminLabel": "Administrator: {name}",
        "league.emojiLabel": "Emoji-ikon",
        "profile.proBadge": "Pro",
        "settings.themeProMidnight": "Pro: Midnatbane",
        "settings.themeProClay": "Pro: Grusbane",
        "settings.themeProNeon": "Pro: Neon-arkade",
        "explainer.demoCard": "RonDuel nr. 12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5",
        "ronbot.adminTitle": "Admin-medpilot",
        "leagues.adminBadge": "ADMIN",
        "duel.vsBadge": "mod",
        "common.versus": "mod {name}",
    },
    "nb": {
        "play.startNow": "Start nå 3-2-1",
        "league.adminLabel": "Administrator: {name}",
        "league.shareWhatsApp": "Del via WhatsApp",
        "league.emojiLabel": "Emoji-ikon",
        "profile.proBadge": "Pro",
        "pro.subscribeCta": "Start med RonDuel Pro",
        "settings.themeProMidnight": "Pro: Midnattsbane",
        "settings.themeProClay": "Pro: Grusbane",
        "settings.themeProNeon": "Pro: Neonarkade",
        "explainer.demoCard": "RonDuel nr. 12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5",
        "ronbot.adminTitle": "Admin-medpilot",
        "leagues.adminBadge": "ADMIN",
        "duels.walkoverBadge": "Walkover (seier) 🏆",
        "duel.vsBadge": "mot",
        "common.versus": "mot {name}",
    },
    "fi": {
        "league.emojiLabel": "Emoji-kuvake",
        "duel.vsBadge": "vastaan",
        "profile.proBadge": "Pro",
        "settings.themeProMidnight": "Pro: Keskiyön kenttä",
        "settings.themeProClay": "Pro: Massakenttä",
        "settings.themeProNeon": "Pro: Neon-arkadi",
        "explainer.demoCard": "RonDuel nro 12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5",
        "common.versus": "vastaan {name}",
        "ronbot.adminTitle": "Ylläpidon apuri",
        "leagues.adminBadge": "ADMIN",
    },
    "et": {
        "common.versus": "vastu {name}",
        "leagues.adminBadge": "ADMIN",
        "duel.vsBadge": "vastu",
        "league.emojiLabel": "Emotikon",
        "profile.proBadge": "Pro",
        "settings.themeProMidnight": "Pro: Südaöö väljak",
        "settings.themeProClay": "Pro: Saviliivaväljak",
        "settings.themeProNeon": "Pro: Neoon-arkaad",
        "explainer.demoCard": "RonDuel nr 12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5",
        "ronbot.adminTitle": "Admini kaaspiloot",
    },
    "lt": {
        "profile.proBadge": "Pro",
        "settings.themeProMidnight": "Pro: Vidurnakčio kortas",
        "settings.themeProClay": "Pro: Grunto kortas",
        "settings.themeProNeon": "Pro: Neono arkada",
        "explainer.demoCard": "RonDuel nr. 12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5",
        "duel.vsBadge": "prieš",
        "common.versus": "prieš {name}",
        "league.emojiLabel": "Jaustukas",
        "leagues.adminBadge": "ADMIN",
        "ronbot.adminTitle": "Admino pagalbininkas",
    },
    "lv": {
        "profile.proBadge": "Pro",
        "settings.themeProMidnight": "Pro: Pusnakts korts",
        "settings.themeProClay": "Pro: Māla korts",
        "settings.themeProNeon": "Pro: Neona pasāža",
        "explainer.demoCard": "RonDuel nr. 12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5",
        "duel.vsBadge": "pret",
        "common.versus": "pret {name}",
        "league.emojiLabel": "Emocijzīme",
        "leagues.adminBadge": "ADMIN",
        "ronbot.adminTitle": "Admina palīgs",
    },
    "ro": {
        "league.challengeBtn": "Provoacă la duel 1v1",
        "league.adminLabel": "Administrator: {name}",
        "league.emojiLabel": "Emoji-ul ligii",
        "duel.vsBadge": "contra",
        "profile.proBadge": "Pro",
        "settings.themeProMidnight": "Pro: Teren Nocturn",
        "settings.themeProClay": "Pro: Zgură",
        "settings.themeProNeon": "Pro: Neon Arcade",
        "explainer.demoCard": "RonDuel nr. 12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5",
        "auth.emailLabel": "Adresă de email",
        "common.versus": "contra {name}",
        "leagues.globalBadge": "GLOBALĂ",
        "leagues.adminBadge": "ADMIN",
    }
}

def set_nested(d, dot_key, value):
    parts = dot_key.split('.')
    cur = d
    for p in parts[:-1]:
        if p not in cur or not isinstance(cur[p], dict):
            cur[p] = {}
        cur = cur[p]
    cur[parts[-1]] = value

# Also ensure en.json profile.proBadge is 'Pro'
set_nested(en, "profile.proBadge", "Pro")
with open(os.path.join(MESSAGES_DIR, "en.json"), "w", encoding="utf-8") as f:
    json.dump(en, f, ensure_ascii=False, indent=2)
    f.write("\n")

for lang, overrides in OVERRIDES.items():
    file_path = os.path.join(MESSAGES_DIR, f"{lang}.json")
    if not os.path.exists(file_path):
        continue
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    for k, v in overrides.items():
        set_nested(data, k, v)
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

print("Cleaned Check C overrides successfully!")

ADDITIONAL = {
    "cs": {
        "play.startNow": "Startovat 3-2-1",
        "legal.footerCookies": "Zásady cookies",
    },
    "da": {
        "play.startNow": "Start nu 3-2-1",
        "league.challengeBtn": "Udfordr 1v1",
        "league.shareWhatsApp": "Del via WhatsApp",
        "league.shareNative": "Del invitation",
        "duel.title": "1v1 Duel",
        "pro.subscribeCta": "Tilmeld RonDuel Pro",
        "legal.footerCookies": "Cookiepolitik",
        "duels.walkoverBadge": "Walkover (sejr) 🏆",
    },
    "de": {
        "play.startNow": "Jetzt starten 3-2-1",
        "league.adminLabel": "Verwalter: {name}",
        "profile.details": "Details anzeigen",
        "settings.theme": "Design",
        "leagues.joinByCodeShort": "# Einladungscode",
        "leagues.globalBadge": "WELTWEIT",
    },
    "el": {
        "profile.emailPlaceholder": "onoma@example.com",
        "legal.footerCookies": "Πολιτική cookies",
        "auth.emailLabel": "Διεύθυνση email",
        "auth.emailPlaceholder": "onoma@example.com",
        "leagues.globalBadge": "ΠΑΓΚΟΣΜΙΑ",
    },
    "es": {
        "result.errorStatus": "Error: {status}",
        "league.adminLabel": "Administrador: {name}",
        "notFound.code": "404 · Error de página",
        "common.error": "Fallo",
        "common.points": "{points} pts.",
    },
    "et": {
        "league.adminLabel": "Administraator: {name}",
    },
    "ga": {
        "explainer.demoCard": "RonDuel Uimh. 12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5",
    },
    "hu": {
        "settings.themeProNeon": "Pro: Neon Játékterem",
    },
    "ro": {
        "settings.themeProNeon": "Pro: Arcade Neon",
    }
}

for lang, overrides in ADDITIONAL.items():
    file_path = os.path.join(MESSAGES_DIR, f"{lang}.json")
    if not os.path.exists(file_path):
        continue
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    for k, v in overrides.items():
        set_nested(data, k, v)
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

print("Applied additional overrides!")
