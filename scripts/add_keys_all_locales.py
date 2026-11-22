import json
import os

MESSAGES_DIR = 'apps/web/messages'

LOCALES = [
    'ro', 'en', 'es', 'pt', 'de', 'fr', 'it', 'nl', 'pl', 'bg',
    'cs', 'da', 'el', 'et', 'fi', 'ga', 'hr', 'hu', 'lt', 'lv',
    'mt', 'nb', 'sk', 'sl', 'sv', 'uk',
]

TRANSLATIONS = {
    'ro': {
        'duel': {
            'versusLabel': '{me} contra {opponent}',
            'youLabel': 'TU',
        },
        'play': {
            'wrongWas': 'Greșit · era {answer}',
            'srCorrect': 'Corect, plus {points} puncte',
            'srWrong': 'Greșit. Răspunsul corect: {answer}',
            'srTimeout': 'Timpul a expirat',
            'fastBonus': 'rapid',
            'srOptionCorrect': '— corect',
            'srOptionWrong': '— alegerea ta, greșit',
        },
        'result': {
            'srScore': 'Scorul tău: {score} puncte',
            'personalBest': 'Record personal!',
            'tilesLabel': 'Rezultat: {correct} corecte din {total}',
        },
    },
    'en': {
        'duel': {
            'versusLabel': '{me} versus {opponent}',
            'youLabel': 'YOU',
        },
        'play': {
            'wrongWas': 'Wrong · was {answer}',
            'srCorrect': 'Correct, plus {points} points',
            'srWrong': 'Wrong. The correct answer was: {answer}',
            'srTimeout': 'Time expired',
            'fastBonus': 'fast',
            'srOptionCorrect': '— correct',
            'srOptionWrong': '— your choice, wrong',
        },
        'result': {
            'srScore': 'Your score: {score} points',
            'personalBest': 'Personal best!',
            'tilesLabel': 'Result: {correct} correct out of {total}',
        },
    },
    'es': {
        'duel': {
            'versusLabel': '{me} contra {opponent}',
            'youLabel': 'TÚ',
        },
        'play': {
            'wrongWas': 'Incorrecto · era {answer}',
            'srCorrect': 'Correcto, más {points} puntos',
            'srWrong': 'Incorrecto. La respuesta correcta era: {answer}',
            'srTimeout': 'Tiempo agotado',
            'fastBonus': 'rápido',
            'srOptionCorrect': '— correcto',
            'srOptionWrong': '— tu elección, incorrecta',
        },
        'result': {
            'srScore': 'Tu puntuación: {score} puntos',
            'personalBest': '¡Récord personal!',
            'tilesLabel': 'Resultado: {correct} correctas de {total}',
        },
    },
    'pt': {
        'duel': {
            'versusLabel': '{me} contra {opponent}',
            'youLabel': 'VOCÊ',
        },
        'play': {
            'wrongWas': 'Incorreto · era {answer}',
            'srCorrect': 'Correto, mais {points} pontos',
            'srWrong': 'Incorreto. A resposta correta era: {answer}',
            'srTimeout': 'Tempo esgotado',
            'fastBonus': 'rápido',
            'srOptionCorrect': '— correto',
            'srOptionWrong': '— sua escolha, incorreta',
        },
        'result': {
            'srScore': 'Sua pontuação: {score} pontos',
            'personalBest': 'Recorde pessoal!',
            'tilesLabel': 'Resultado: {correct} corretas de {total}',
        },
    },
    'de': {
        'duel': {
            'versusLabel': '{me} gegen {opponent}',
            'youLabel': 'DU',
        },
        'play': {
            'wrongWas': 'Falsch · es war {answer}',
            'srCorrect': 'Richtig, plus {points} Punkte',
            'srWrong': 'Falsch. Die richtige Antwort war: {answer}',
            'srTimeout': 'Zeit abgelaufen',
            'fastBonus': 'schnell',
            'srOptionCorrect': '— richtig',
            'srOptionWrong': '— deine Wahl, falsch',
        },
        'result': {
            'srScore': 'Deine Punktzahl: {score} Punkte',
            'personalBest': 'Persönliche Bestleistung!',
            'tilesLabel': 'Ergebnis: {correct} richtig von {total}',
        },
    },
    'fr': {
        'duel': {
            'versusLabel': '{me} contre {opponent}',
            'youLabel': 'TOI',
        },
        'play': {
            'wrongWas': 'Faux · c’était {answer}',
            'srCorrect': 'Correct, plus {points} points',
            'srWrong': 'Faux. La bonne réponse était : {answer}',
            'srTimeout': 'Temps écoulé',
            'fastBonus': 'rapide',
            'srOptionCorrect': '— correct',
            'srOptionWrong': '— ton choix, faux',
        },
        'result': {
            'srScore': 'Ton score : {score} points',
            'personalBest': 'Record personnel !',
            'tilesLabel': 'Résultat : {correct} corrects sur {total}',
        },
    },
    'it': {
        'duel': {
            'versusLabel': '{me} contro {opponent}',
            'youLabel': 'TU',
        },
        'play': {
            'wrongWas': 'Sbagliato · era {answer}',
            'srCorrect': 'Corretto, più {points} punti',
            'srWrong': 'Sbagliato. La risposta corretta era: {answer}',
            'srTimeout': 'Tempo scaduto',
            'fastBonus': 'veloce',
            'srOptionCorrect': '— corretto',
            'srOptionWrong': '— la tua scelta, errata',
        },
        'result': {
            'srScore': 'Il tuo punteggio: {score} punti',
            'personalBest': 'Record personale!',
            'tilesLabel': 'Risultato: {correct} corrette su {total}',
        },
    },
    'nl': {
        'duel': {
            'versusLabel': '{me} tegen {opponent}',
            'youLabel': 'JIJ',
        },
        'play': {
            'wrongWas': 'Fout · het was {answer}',
            'srCorrect': 'Juist, plus {points} punten',
            'srWrong': 'Fout. Het juiste antwoord was: {answer}',
            'srTimeout': 'Tijd verstreken',
            'fastBonus': 'snel',
            'srOptionCorrect': '— juist',
            'srOptionWrong': '— jouw keuze, fout',
        },
        'result': {
            'srScore': 'Jouw score: {score} punten',
            'personalBest': 'Persoonlijk record!',
            'tilesLabel': 'Resultaat: {correct} goed van {total}',
        },
    },
}

# Fallbacks for other European locales
DEFAULT_TRANSLATION = TRANSLATIONS['en']

for loc in LOCALES:
    filePath = os.path.join(MESSAGES_DIR, f'{loc}.json')
    with open(filePath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    tr = TRANSLATIONS.get(loc, DEFAULT_TRANSLATION)

    for section, keys in tr.items():
        if section not in data:
            data[section] = {}
        for k, v in keys.items():
            data[section][k] = v

    with open(filePath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

print("Added keys across all 26 message files successfully.")
