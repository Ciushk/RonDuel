import json
import glob
import re
from step1_translations import DATA, STEP1_KEYS

# 1. Correct typo in sv DATA
DATA["sv"]["errors.LEAGUE_FULL"] = "Ligan är full. Maxgränsen för gratisliga har nåtts."

PRO_PRICES = {
    "en": ("{price} / month", "{price} / year (Save {percent}%)"),
    "ro": ("{price} / lună", "{price} / an (Economisești {percent}%)"),
    "de": ("{price} / Monat", "{price} / Jahr ({percent}% sparen)"),
    "fr": ("{price} / mois", "{price} / an (Économise {percent} %)"),
    "es": ("{price} / mes", "{price} / año (Ahorra {percent}%)"),
    "it": ("{price} / mese", "{price} / anno (Risparmi il {percent}%)"),
    "pt": ("{price} / mês", "{price} / ano (Economize {percent}%)"),
    "nl": ("{price} / maand", "{price} / jaar (Bespaar {percent}%)"),
    "bg": ("{price} / месец", "{price} / година (Спести {percent}%)"),
    "cs": ("{price} / měsíc", "{price} / rok (Ušetříte {percent} %)"),
    "da": ("{price} / måned", "{price} / år (Spar {percent}%)"),
    "el": ("{price} / μήνα", "{price} / έτος (Εξοικονόμηση {percent}%)"),
    "et": ("{price} / kuu", "{price} / aasta (Säästa {percent}%)"),
    "fi": ("{price} / kk", "{price} / vuosi (Säästä {percent} %)"),
    "ga": ("{price} / mí", "{price} / bliain (Sábháil {percent}%)"),
    "hr": ("{price} / mjesečno", "{price} / godišnje (Uštedi {percent}%)"),
    "hu": ("{price} / hó", "{price} / év ({percent}% megtakarítás)"),
    "lt": ("{price} / mėn.", "{price} / metams (Sutaupykite {percent} %)"),
    "lv": ("{price} / mēnesī", "{price} / gadā (Ietaupi {percent}%)"),
    "mt": ("{price} / xahar", "{price} / sena (Iffranka {percent}%)"),
    "nb": ("{price} / måned", "{price} / år (Spar {percent} %)"),
    "pl": ("{price} / miesiąc", "{price} / rok (Oszczędzasz {percent}%)"),
    "sk": ("{price} / mesiac", "{price} / rok (Ušetríte {percent} %)"),
    "sl": ("{price} / mesec", "{price} / leto (Prihrani {percent} %)"),
    "sv": ("{price} / månad", "{price} / år (Spara {percent} %)"),
    "uk": ("{price} / місяць", "{price} / рік (Економія {percent}%)"),
}

MT_FIXES = {
    "auth.passwordLabel": "Il-password",
    "auth.usernameLabel": "Isem tal-utent",
    "nav.settings": "Issettjar",
    "settings.title": "Issettjar",
    "profile.settingsRow": "Issettjar",
    "legal.imprint.title": "Dettalji ta' identifikazzjoni u kuntatt",
    "legal.footerImprint": "Dettalji ta' identifikazzjoni u kuntatt",
    "league.membersCount": "{count, plural, one {plejer #} two {żewġ plejers} few {# plejers} many {#-il plejer} other {# plejer}}"
}

def set_nested(d, key, val):
    parts = key.split('.')
    curr = d
    for p in parts[:-1]:
        if p not in curr:
            curr[p] = {}
        curr = curr[p]
    curr[parts[-1]] = val

for path in sorted(glob.glob("apps/web/messages/*.json")):
    loc = path.split('/')[-1].replace('.json', '')
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 1.1 Apply translations
    if loc in DATA:
        for k, v in DATA[loc].items():
            set_nested(data, k, v)

    # 1.2 Apply MT fixes
    if loc == "mt":
        for k, v in MT_FIXES.items():
            set_nested(data, k, v)

    # 1.3 Fix league.membersCount for en and ro, and replace =1 { across all fields
    if loc == "en":
        data["league"]["membersCount"] = "{count, plural, one {# player} other {# players}}"
    elif loc == "ro":
        data["league"]["membersCount"] = "{count, plural, one {# jucător} few {# jucători} other {# de jucători}}"

    # 1.4 Apply pro prices
    if loc in PRO_PRICES:
        m, y = PRO_PRICES[loc]
        data["pro"]["monthly"] = m
        data["pro"]["yearly"] = y

    # Replace all =1 { with one { and remove any € in values recursively
    def sanitize(obj):
        if isinstance(obj, dict):
            return {k: sanitize(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [sanitize(v) for v in obj]
        elif isinstance(obj, str):
            s = obj
            # Step 1.3: replace =1 { with one {
            s = re.sub(r'=\s*1\s*\{', 'one {', s)
            # Step 1.4: replace € symbol in strings (like legal text) with EUR
            if '€' in s:
                s = s.replace('€4.99', '4.99 EUR').replace('4,99 €', '4.99 EUR')
                s = s.replace('€39.99', '39.99 EUR').replace('39,99 €', '39.99 EUR')
                s = s.replace('€', 'EUR')
            return s
        return obj

    data = sanitize(data)

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')

print("All 26 message files updated for Step 1 successfully.")
