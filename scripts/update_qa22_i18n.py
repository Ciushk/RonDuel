import json
import os

LOCALES = [
    'ro', 'en', 'es', 'pt', 'de', 'fr', 'it', 'nl', 'pl', 'bg',
    'cs', 'da', 'el', 'et', 'fi', 'ga', 'hr', 'hu', 'lt', 'lv',
    'mt', 'nb', 'sk', 'sl', 'sv', 'uk',
]

MESSAGES_DIR = 'apps/web/messages'

I18N_DATA = {
    'ro': {
        'play': {
            'wrong': 'Greșit',
        },
        'result': {
            'emojiLegend': '⚡ corect și rapid · 🟩 corect · 🟥 greșit sau expirat',
            'correctCount': '{correct}/{total} corecte',
            'cheer0': 'Mâine e o nouă șansă 💪',
            'cheer1_2': 'Un început! Mâine mai bine 💪',
            'cheer3_4': 'Bine jucat! 👏',
            'cheer5': 'Aproape perfect! 🔥',
            'cheer6': 'Rundă perfectă! 🏆',
            'yourAnswer': 'Tu: {answer}',
        },
    },
    'en': {
        'play': {
            'wrong': 'Wrong',
        },
        'result': {
            'emojiLegend': '⚡ fast and correct · 🟩 correct · 🟥 wrong or timed out',
            'correctCount': '{correct}/{total} correct',
            'cheer0': 'Tomorrow is a new chance 💪',
            'cheer1_2': 'A start! Better tomorrow 💪',
            'cheer3_4': 'Well played! 👏',
            'cheer5': 'Almost perfect! 🔥',
            'cheer6': 'Perfect round! 🏆',
            'yourAnswer': 'You: {answer}',
        },
    },
    'es': {
        'play': {
            'wrong': 'Incorrecto',
        },
        'result': {
            'emojiLegend': '⚡ rápido y correcto · 🟩 correcto · 🟥 incorrecto o expirado',
            'correctCount': '{correct}/{total} correctas',
            'cheer0': '¡Mañana hay otra oportunidad! 💪',
            'cheer1_2': '¡Un comienzo! Mañana mejor 💪',
            'cheer3_4': '¡Bien jugado! 👏',
            'cheer5': '¡Casi perfecto! 🔥',
            'cheer6': '¡Ronda perfecta! 🏆',
            'yourAnswer': 'Tú: {answer}',
        },
    },
    'pt': {
        'play': {
            'wrong': 'Errado',
        },
        'result': {
            'emojiLegend': '⚡ rápido e correto · 🟩 correto · 🟥 incorreto ou expirado',
            'correctCount': '{correct}/{total} corretas',
            'cheer0': 'Amanhã é uma nova oportunidade 💪',
            'cheer1_2': 'Um bom começo! Amanhã será melhor 💪',
            'cheer3_4': 'Bem jogado! 👏',
            'cheer5': 'Quase perfeito! 🔥',
            'cheer6': 'Ronda perfeita! 🏆',
            'yourAnswer': 'Você: {answer}',
        },
    },
    'de': {
        'play': {
            'wrong': 'Falsch',
        },
        'result': {
            'emojiLegend': '⚡ schnell und richtig · 🟩 richtig · 🟥 falsch oder abgelaufen',
            'correctCount': '{correct}/{total} richtig',
            'cheer0': 'Morgen ist eine neue Chance 💪',
            'cheer1_2': 'Ein Anfang! Morgen wird es besser 💪',
            'cheer3_4': 'Gut gespielt! 👏',
            'cheer5': 'Fast perfekt! 🔥',
            'cheer6': 'Perfekte Runde! 🏆',
            'yourAnswer': 'Du: {answer}',
        },
    },
    'fr': {
        'play': {
            'wrong': 'Faux',
        },
        'result': {
            'emojiLegend': '⚡ rapide et correct · 🟩 correct · 🟥 faux ou expiré',
            'correctCount': '{correct}/{total} correctes',
            'cheer0': 'Demain est une nouvelle chance 💪',
            'cheer1_2': 'Un début ! Ce sera mieux demain 💪',
            'cheer3_4': 'Bien joué ! 👏',
            'cheer5': 'Presque parfait ! 🔥',
            'cheer6': 'Manche parfaite ! 🏆',
            'yourAnswer': 'Toi: {answer}',
        },
    },
    'it': {
        'play': {
            'wrong': 'Sbagliato',
        },
        'result': {
            'emojiLegend': '⚡ veloce e corretto · 🟩 corretto · 🟥 errato o scaduto',
            'correctCount': '{correct}/{total} corrette',
            'cheer0': 'Domani è un\'altra opportunità 💪',
            'cheer1_2': 'Un inizio! Domani andrà meglio 💪',
            'cheer3_4': 'Ben giocato! 👏',
            'cheer5': 'Quasi perfetto! 🔥',
            'cheer6': 'Round perfetto! 🏆',
            'yourAnswer': 'Tu: {answer}',
        },
    },
    'nl': {
        'play': {
            'wrong': 'Fout',
        },
        'result': {
            'emojiLegend': '⚡ snel en correct · 🟩 correct · 🟥 fout of verlopen',
            'correctCount': '{correct}/{total} correct',
            'cheer0': 'Morgen is er weer een kans 💪',
            'cheer1_2': 'Een begin! Morgen beter 💪',
            'cheer3_4': 'Goed gespeeld! 👏',
            'cheer5': 'Bijna perfect! 🔥',
            'cheer6': 'Perfecte ronde! 🏆',
            'yourAnswer': 'Jij: {answer}',
        },
    },
    'pl': {
        'play': {
            'wrong': 'Błędnie',
        },
        'result': {
            'emojiLegend': '⚡ szybko i poprawnie · 🟩 poprawnie · 🟥 błędnie lub czas minął',
            'correctCount': '{correct}/{total} poprawnych',
            'cheer0': 'Jutro kolejna szansa 💪',
            'cheer1_2': 'Początek! Jutro będzie lepiej 💪',
            'cheer3_4': 'Dobra gra! 👏',
            'cheer5': 'Prawie idealnie! 🔥',
            'cheer6': 'Runda idealna! 🏆',
            'yourAnswer': 'Ty: {answer}',
        },
    },
    'bg': {
        'play': {
            'wrong': 'Грешно',
        },
        'result': {
            'emojiLegend': '⚡ бързо и правилно · 🟩 правилно · 🟥 грешно или изтекло време',
            'correctCount': '{correct}/{total} верни',
            'cheer0': 'Утре е нов шанс 💪',
            'cheer1_2': 'Добро начало! Утре ще е по-добре 💪',
            'cheer3_4': 'Добра игра! 👏',
            'cheer5': 'Почти перфектно! 🔥',
            'cheer6': 'Перфектен рунд! 🏆',
            'yourAnswer': 'Ти: {answer}',
        },
    },
    'cs': {
        'play': {
            'wrong': 'Špatně',
        },
        'result': {
            'emojiLegend': '⚡ rychle a správně · 🟩 správně · 🟥 špatně nebo vypršel čas',
            'correctCount': '{correct}/{total} správně',
            'cheer0': 'Zítra je nová šance 💪',
            'cheer1_2': 'Dobrý začátek! Zítra to bude lepší 💪',
            'cheer3_4': 'Dobrá hra! 👏',
            'cheer5': 'Téměř dokonalé! 🔥',
            'cheer6': 'Perfektní kolo! 🏆',
            'yourAnswer': 'Ty: {answer}',
        },
    },
    'da': {
        'play': {
            'wrong': 'Forkert',
        },
        'result': {
            'emojiLegend': '⚡ hurtigt og korrekt · 🟩 korrekt · 🟥 forkert eller udløbet',
            'correctCount': '{correct}/{total} korrekte',
            'cheer0': 'I morgen er en ny chance 💪',
            'cheer1_2': 'En start! Bedre i morgen 💪',
            'cheer3_4': 'Godt spillet! 👏',
            'cheer5': 'Næsten perfekt! 🔥',
            'cheer6': 'Perfekt runde! 🏆',
            'yourAnswer': 'Dig: {answer}',
        },
    },
    'el': {
        'play': {
            'wrong': 'Λάθος',
        },
        'result': {
            'emojiLegend': '⚡ γρήγορα και σωστά · 🟩 σωστά · 🟥 λάθος ή έληξε ο χρόνος',
            'correctCount': '{correct}/{total} σωστά',
            'cheer0': 'Αύριο είναι μια νέα ευκαιρία 💪',
            'cheer1_2': 'Μια καλή αρχή! Καλύτερα αύριο 💪',
            'cheer3_4': 'Μπράβο! 👏',
            'cheer5': 'Σχεδόν τέλεια! 🔥',
            'cheer6': 'Τέλειος γύρος! 🏆',
            'yourAnswer': 'Εσύ: {answer}',
        },
    },
    'et': {
        'play': {
            'wrong': 'Vale',
        },
        'result': {
            'emojiLegend': '⚡ kiire ja õige · 🟩 õige · 🟥 vale või aegunud',
            'correctCount': '{correct}/{total} õiget',
            'cheer0': 'Homme on uus võimalus 💪',
            'cheer1_2': 'Hea algus! Homme läheb paremini 💪',
            'cheer3_4': 'Hästi mängitud! 👏',
            'cheer5': 'Peaaegu täiuslik! 🔥',
            'cheer6': 'Täiuslik voor! 🏆',
            'yourAnswer': 'Sina: {answer}',
        },
    },
    'fi': {
        'play': {
            'wrong': 'Väärin',
        },
        'result': {
            'emojiLegend': '⚡ nopea ja oikein · 🟩 oikein · 🟥 väärin tai aika loppui',
            'correctCount': '{correct}/{total} oikein',
            'cheer0': 'Huomenna on uusi mahdollisuus 💪',
            'cheer1_2': 'Alku sekin! Huomenna paremmin 💪',
            'cheer3_4': 'Hyvin pelattu! 👏',
            'cheer5': 'Melkein täydellinen! 🔥',
            'cheer6': 'Täydellinen kierros! 🏆',
            'yourAnswer': 'Sinä: {answer}',
        },
    },
    'ga': {
        'play': {
            'wrong': 'Mícheart',
        },
        'result': {
            'emojiLegend': '⚡ tapaidh agus ceart · 🟩 ceart · 🟥 mícheart nó as am',
            'correctCount': '{correct}/{total} ceart',
            'cheer0': 'Beidh lá eile amárach 💪',
            'cheer1_2': 'Tús maith! Níos fearr amárach 💪',
            'cheer3_4': 'Imeartha go maith! 👏',
            'cheer5': 'Beagnach foirfe! 🔥',
            'cheer6': 'Babhta foirfe! 🏆',
            'yourAnswer': 'Tusa: {answer}',
        },
    },
    'hr': {
        'play': {
            'wrong': 'Netočno',
        },
        'result': {
            'emojiLegend': '⚡ brzo i točno · 🟩 točno · 🟥 netočno ili isteklo vrijeme',
            'correctCount': '{correct}/{total} točnih',
            'cheer0': 'Sutra je nova prilika 💪',
            'cheer1_2': 'Početak! Sutra još bolje 💪',
            'cheer3_4': 'Dobro odigrano! 👏',
            'cheer5': 'Skoro savršeno! 🔥',
            'cheer6': 'Savršena runda! 🏆',
            'yourAnswer': 'Ti: {answer}',
        },
    },
    'hu': {
        'play': {
            'wrong': 'Hibás',
        },
        'result': {
            'emojiLegend': '⚡ gyors és helyes · 🟩 helyes · 🟥 hibás vagy lejárt',
            'correctCount': '{correct}/{total} helyes',
            'cheer0': 'Holnap új nap, új esély 💪',
            'cheer1_2': 'Kezdetnek jó! Holnap még jobb lesz 💪',
            'cheer3_4': 'Szép játék! 👏',
            'cheer5': 'Majdnem tökéletes! 🔥',
            'cheer6': 'Tökéletes forduló! 🏆',
            'yourAnswer': 'Te: {answer}',
        },
    },
    'lt': {
        'play': {
            'wrong': 'Neteisingai',
        },
        'result': {
            'emojiLegend': '⚡ greitai ir teisingai · 🟩 teisingai · 🟥 neteisingai arba baigėsi laikas',
            'correctCount': '{correct}/{total} teisingų',
            'cheer0': 'Rytoj nauja proga 💪',
            'cheer1_2': 'Pradžia! Rytoj bus geriau 💪',
            'cheer3_4': 'Puikus žaidimas! 👏',
            'cheer5': 'Beveik tobula! 🔥',
            'cheer6': 'Tobulas raundas! 🏆',
            'yourAnswer': 'Tu: {answer}',
        },
    },
    'lv': {
        'play': {
            'wrong': 'Nepareizi',
        },
        'result': {
            'emojiLegend': '⚡ ātri un pareizi · 🟩 pareizi · 🟥 nepareizi vai beidzies laiks',
            'correctCount': '{correct}/{total} pareizas',
            'cheer0': 'Rīt būs jauna iespēja 💪',
            'cheer1_2': 'Labs sākums! Rīt būs labāk 💪',
            'cheer3_4': 'Laba spēle! 👏',
            'cheer5': 'Gandrīz perfekti! 🔥',
            'cheer6': 'Perfekts raunds! 🏆',
            'yourAnswer': 'Tu: {answer}',
        },
    },
    'mt': {
        'play': {
            'wrong': 'Ħażin',
        },
        'result': {
            'emojiLegend': '⚡ malajr u korrett · 🟩 korrett · 🟥 ħażin jew skada l-ħin',
            'correctCount': '{correct}/{total} korretti',
            'cheer0': 'Għada ċans ġdid 💪',
            'cheer1_2': 'Bidu tajjeb! Għada aħjar 💪',
            'cheer3_4': 'Logħba tajba! 👏',
            'cheer5': 'Kważi perfett! 🔥',
            'cheer6': 'Rawnd perfett! 🏆',
            'yourAnswer': 'Inti: {answer}',
        },
    },
    'nb': {
        'play': {
            'wrong': 'Feil',
        },
        'result': {
            'emojiLegend': '⚡ raskt og riktig · 🟩 riktig · 🟥 feil eller utløpt tid',
            'correctCount': '{correct}/{total} riktige',
            'cheer0': 'I morgen er en ny sjanse 💪',
            'cheer1_2': 'En begynnelse! Bedre i morgen 💪',
            'cheer3_4': 'Bra spilt! 👏',
            'cheer5': 'Nesten perfekt! 🔥',
            'cheer6': 'Perfekt runde! 🏆',
            'yourAnswer': 'Du: {answer}',
        },
    },
    'sk': {
        'play': {
            'wrong': 'Nesprávne',
        },
        'result': {
            'emojiLegend': '⚡ rýchlo a správne · 🟩 správne · 🟥 nesprávne alebo vypršal čas',
            'correctCount': '{correct}/{total} správnych',
            'cheer0': 'Zajtra je nová šanca 💪',
            'cheer1_2': 'Začiatok! Zajtra to bude lepšie 💪',
            'cheer3_4': 'Dobrá hra! 👏',
            'cheer5': 'Takmer dokonalé! 🔥',
            'cheer6': 'Perfektné kolo! 🏆',
            'yourAnswer': 'Ty: {answer}',
        },
    },
    'sl': {
        'play': {
            'wrong': 'Napačno',
        },
        'result': {
            'emojiLegend': '⚡ hitro in pravilno · 🟩 pravilno · 🟥 napačno ali potekel čas',
            'correctCount': '{correct}/{total} pravilnih',
            'cheer0': 'Jutri je nova priložnost 💪',
            'cheer1_2': 'Začetek! Jutri bo bolje 💪',
            'cheer3_4': 'Dobro odigrano! 👏',
            'cheer5': 'Skoraj popolno! 🔥',
            'cheer6': 'Popoln krog! 🏆',
            'yourAnswer': 'Ti: {answer}',
        },
    },
    'sv': {
        'play': {
            'wrong': 'Fel',
        },
        'result': {
            'emojiLegend': '⚡ snabbt och rätt · 🟩 rätt · 🟥 fel eller tiden ute',
            'correctCount': '{correct}/{total} rätt',
            'cheer0': 'I morgon är en ny chans 💪',
            'cheer1_2': 'En början! Bättre i morgon 💪',
            'cheer3_4': 'Bra spelat! 👏',
            'cheer5': 'Nästan perfekt! 🔥',
            'cheer6': 'Perfekt runda! 🏆',
            'yourAnswer': 'Du: {answer}',
        },
    },
    'uk': {
        'play': {
            'wrong': 'Неправильно',
        },
        'result': {
            'emojiLegend': '⚡ швидко та правильно · 🟩 правильно · 🟥 неправильно або час вичерпано',
            'correctCount': '{correct}/{total} правильних',
            'cheer0': 'Завтра новий шанс 💪',
            'cheer1_2': 'Початок! Завтра буде краще 💪',
            'cheer3_4': 'Гарна гра! 👏',
            'cheer5': 'Майже ідеально! 🔥',
            'cheer6': 'Ідеальний раунд! 🏆',
            'yourAnswer': 'Ти: {answer}',
        },
    },
}

for loc in LOCALES:
    filepath = os.path.join(MESSAGES_DIR, f'{loc}.json')
    if not os.path.exists(filepath):
        print(f'Skipping missing {loc}.json')
        continue
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    loc_updates = I18N_DATA[loc]
    for section, sec_data in loc_updates.items():
        if section not in data:
            data[section] = {}
        for key, val in sec_data.items():
            data[section][key] = val

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f'Updated {loc}.json')
