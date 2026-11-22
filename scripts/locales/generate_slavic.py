#!/usr/bin/env python3
import json
import re
import sys
from scripts.locales.base import EN_DATA

# Polish, Czech, Slovak, Bulgarian, Croatian, Slovenian already generated in /tmp
sys.path.insert(0, '/tmp')
from gen_pl import PL_DATA
from gen_cs import CS_DATA
from gen_sk import SK_DATA
from gen_bg import BG_DATA
from gen_hr import HR_DATA
from gen_sl import SL_DATA
from validator import validate_dict

UK_DATA = {
    # Step 2
    "errors.RESULT_NOT_FOUND": "Результат не знайдено.",

    # Step 3.A
    "a11y.mainNav": "Основна навігація",
    "a11y.bottomNav": "Нижня навігація",
    "a11y.homeLink": "RonDuel – головна",
    "a11y.toggleTheme": "Змінити тему",
    "a11y.previousPage": "Попередня сторінка",
    "a11y.splash": "Екран привітання RonDuel",
    "a11y.roundDone": "Раунд завершено",
    "a11y.roundAvailable": "Раунд доступний",
    "nav.duelsYourTurnBadge": "{count, plural, one {# дуель очікує на твій хід} few {# дуелі очікують на твій хід} many {# дуелей очікують на твій хід} other {# дуелі очікують на твій хід}}",
    "settings.languageSearchPlaceholder": "Пошук мови…",
    "settings.languageNoResults": "Мову не знайдено",
    "common.cancel": "Скасувати",
    "consent.ariaLabel": "Згода на файли cookie та аналітику",
    "common.close": "Закрити",
    "a11y.timeRemaining": "Час, що залишився",
    "common.error": "Помилка",
    "common.loading": "Завантаження…",
    "common.retry": "Спробувати знову",
    "common.save": "Зберегти",
    "common.saving": "Збереження…",
    "common.creating": "Створення…",
    "common.sending": "Надсилання…",
    "common.open": "Відкрити",
    "common.goPro": "Отримати Pro",
    "common.playNow": "Грати зараз",
    "common.leaderboards": "Таблиці лідерів",
    "common.todayRound": "Сьогоднішній раунд",
    "common.networkError": "Помилка мережі.",
    "common.networkErrorRetry": "Помилка мережі. Спробуй ще раз.",
    "common.points": "{points} балів",
    "common.rankPlace": "#{rank} місце",
    "common.versus": "проти {name}",
    "common.hoursLeft": "Залишилося {hours} год",
    "common.daysCount": "{count, plural, one {# день} few {# дні} many {# днів} other {# дня}}",
    "common.you": "Ти",
    "common.yourRank": "Твоє місце: #{rank}",
    "common.playedTodayCount": "{count, plural, one {# зіграв сьогодні} few {# зіграли сьогодні} many {# зіграли сьогодні} other {# зіграло сьогодні}}",

    # Step 3.B RonBot Mascot
    "ronbot.streakAlive": "Чудова серія! Так тримати!",
    "ronbot.streakAtRisk": "Серія під загрозою! Зіграй сьогодні!",
    "ronbot.firstRound": "Твій перший раунд! Успіхів!",
    "ronbot.perfectScore": "Неймовірно! Ідеальний результат!",
    "ronbot.duelWaiting": "На тебе чекає дуель! Зроби свій хід!",
    "ronbot.genericCheer": "Готовий до щоденного виклику?",
    "ronbot.ariaLabel": "RonBot – твій помічник",
    "ronbot.speechAriaLabel": "Повідомлення від RonBot",

    # Step 3.C Home page
    "home.ready": "Готовий",
    "home.todayPlayed": "Зіграно",
    "home.archive": "Архів",
    "home.archiveRoundTitle": "Раунд #{number} ({date})",
    "home.streakShield": "Щит серії активний",
    "home.streakAtRiskTitle": "{days, plural, one {Твоя серія в # день під загрозою!} few {Твоя серія в # дні під загрозою!} many {Твоя серія в # днів під загрозою!} other {Твоя серія в # дня під загрозою!}}",
    "home.streakAtRiskBody": "Зіграй до півночі, щоб не втратити серію.",
    "home.todayLeaderboard": "Сьогоднішні лідери",
    "home.allTimeLeaderboard": "За весь час",
    "home.emptyLeaderboard": "Ще ніхто не зіграв сьогодні. Будь першим!",
    "home.shareTodayText": "Я зіграв сьогоднішній раунд RonDuel! Спробуй перевершити мій результат: {url}",
    "home.cardAriaLabel": "Картка щоденного раунду",
    "home.leaderboardAriaLabel": "Таблиця лідерів",

    # Step 3.D Account Linking Sheet
    "account.linkTitle": "Збережи свій прогрес",
    "account.linkSubtitle": "Прив'яжи пошту або Google, щоб грати на будь-якому пристрої.",
    "account.googleButton": "Продовжити з Google",
    "account.emailPlaceholder": "твоя@пошта.com",
    "account.sendLink": "Надіслати посилання для входу",
    "account.linkSent": "Перевір пошту! Ми надіслали посилання для входу.",
    "account.linkSuccess": "Акаунт успішно прив'язано!",
    "account.linkError": "Не вдалося прив'язати акаунт. Спробуй ще раз.",
    "account.anonymousWarning": "Зараз ти граєш як гість. Якщо очистити браузер, прогрес буде втрачено.",
    "account.dismiss": "Пізніше",

    # Step 3.AUTH Auth Modal
    "auth.modalTitle": "Увійти в RonDuel",
    "auth.modalSubtitle": "Збережи свої серії, ліги та досягнення.",
    "auth.googleSuccess": "Вхід успішний!",
    "auth.googleFailed": "Помилка входу через Google.",
    "auth.emailInvalid": "Будь ласка, введи дійсну адресу пошти.",
    "auth.sendingCode": "Надсилання…",
    "auth.errors.googleNoEmail": "Твій Google-акаунт не надав електронну адресу.",

    # Step 3.E Leagues Page
    "leagues.title": "Твої ліги",
    "leagues.myLeagues": "Мої ліги",
    "leagues.worldLeague": "Світова ліга",
    "leagues.createLeague": "Створити лігу",
    "leagues.joinByCode": "Приєднатися за кодом",
    "leagues.emptyList": "Ти ще не вступив у жодну лігу. Створи власну або приєднайся за кодом друга!",
    "leagues.proBanner": "Отримай Pro для створення необмеженої кількості ліг і великих змагань.",
    "leagues.codePlaceholder": "Код запрошення (6 знаків)",
    "leagues.joinSubmit": "Приєднатися",
    "leagues.myCount": "{count, plural, one {# ліга} few {# ліги} many {# ліг} other {# ліги}}",
    "leagues.privateCount": "{count, plural, one {# приватна ліга} few {# приватні ліги} many {# приватних ліг} other {# приватної ліги}}",
    "leagues.worldPlayersCount": "{count, plural, one {# гравець у світі} few {# гравці у світі} many {# гравців у світі} other {# гравця у світі}}",
    "leagues.registeredCount": "{count, plural, one {# зареєстрована ліга} few {# зареєстровані ліги} many {# зареєстрованих ліг} other {# зареєстрованої ліги}}",
    "leagues.privateCountMax": "{count, plural, one {# приватна ліга} few {# приватні ліги} many {# приватних ліг} other {# приватної ліги}} (макс. {max})",
    "leagues.roundsPlayed": "{count, plural, one {# зіграний раунд} few {# зіграні раунди} many {# зіграних раундів} other {# зіграного раунду}}",

    # Step 3.ELEAGUES More Leagues
    "leagues.tabMy": "Мої ліги",
    "leagues.tabExplore": "Огляд",
    "leagues.searchPlaceholder": "Пошук ліг…",
    "leagues.noResults": "Ліга не знайдена",
    "leagues.membersCount": "Учасників: {count}",
    "leagues.codeLabel": "Код: {code}",
    "leagues.ownerBadge": "Власник",

    # Step 3.F Create League Wizard
    "createLeague.title": "Створити нову лігу",
    "createLeague.stepName": "Назва ліги",
    "createLeague.namePlaceholder": "Наприклад: Інтелектуали",
    "createLeague.stepTheme": "Тема ліги",
    "createLeague.stepPrivacy": "Конфіденційність",
    "createLeague.publicLabel": "Публічна",
    "createLeague.publicDesc": "Будь-хто з кодом може приєднатися одразу.",
    "createLeague.privateLabel": "Приватна (Pro)",
    "createLeague.privateDesc": "Потрібне схвалення власника.",
    "createLeague.submit": "Створити лігу",
    "createLeague.success": "Лігу успішно створено!",

    # Step 3.G League Detail Page
    "league.inviteFriends": "Запросити друзів",
    "league.copyCode": "Скопіювати код",
    "league.codeCopied": "Код скопійовано!",
    "league.shareInvite": "Запросити через посилання",
    "league.membersTab": "Учасники",
    "league.standingsTab": "Таблиця",
    "league.settingsTab": "Налаштування",
    "league.leaveLeague": "Вийти з ліги",
    "league.deleteLeague": "Видалити лігу",
    "league.confirmLeave": "Ти впевнений, що хочеш вийти з ліги?",
    "league.confirmDelete": "Ти впевнений, що хочеш видалити цю лігу? Цю дію не можна скасувати.",
    "league.renameLeague": "Перейменувати лігу",
    "league.newNamePlaceholder": "Нова назва ліги",
    "league.roundsCount": "{count, plural, one {# раунд} few {# раунди} many {# раундів} other {# раунду}}",
    "league.fullBannerFree": "Ця ліга заповнена ({count}/{max}). Потрібен Pro для збільшення ліміту.",
    "league.fullBannerPro": "Досягнуто ліміту Pro ({count}/{max}).",

    # Step 3.GLEAGUE More League Detail
    "league.ownerActions": "Дії адміністратора",
    "league.removeMember": "Видалити",
    "league.regenerateCode": "Оновити код",
    "league.codeRegenerated": "Код оновлено!",
    "league.emptyStandings": "У цій лізі ще ніхто не зіграв.",
    "league.memberJoined": "Приєднався {date}",
    "league.adminBadge": "Адмін",

    # Step 3.H Join by Code Client
    "join.title": "Приєднатися до ліги",
    "join.enterNickname": "Введи свій нікнейм для гри",
    "join.nicknamePlaceholder": "Твій нікнейм",
    "join.submit": "Приєднатися і грати",
    "join.invalidCode": "Недійсний або застарілий код запрошення.",
    "join.alreadyMember": "Ти вже є учасником цієї ліги!",

    # Step 3.I Duels Hub Page
    "duels.title": "Дуелі 1 на 1",
    "duels.createDuel": "Нова дуель",
    "duels.yourTurn": "Твій хід",
    "duels.waiting": "Очікують",
    "duels.finished": "Завершені",
    "duels.emptyYourTurn": "Немає активних дуелей на твоєму ходу.",
    "duels.emptyWaiting": "Немає дуелей в очікуванні відповіді.",
    "duels.emptyFinished": "Немає завершених дуелей.",
    "duels.monthlyLimit": "Використано дуелей цього місяця: {count}/{max}",
    "duels.activeLimit": "Активних дуелей: {count}/{max}",
    "duels.goProUnlimited": "Перейди на Pro для необмеженої кількості дуелей!",
    "duels.opponentWaiting": "Очікуємо суперника",
    "duels.you": "Ти",
    "duels.walkoverWon": "Перемога через неявку суперника",

    # Step 3.J Duel Play & Detail
    "duel.waitingOpponentTitle": "Очікуємо суперника",
    "duel.waitingOpponentDesc": "Надішли це посилання другові, щоб розпочати дуель:",
    "duel.copyDuelLink": "Скопіювати посилання на дуель",
    "duel.linkCopied": "Посилання скопійовано!",
    "duel.shareWhatsApp": "Поділитися у WhatsApp",
    "duel.shareTelegram": "Поділитися в Telegram",
    "duel.startPlaying": "Грати свій раунд",
    "duel.opponentPlayed": "{name} вже зіграв свій раунд!",
    "duel.youWon": "🎉 Ти переміг!",
    "duel.youLost": "Ти поступився цього разу.",
    "duel.drawTitle": "Нічия!",
    "duel.h2hTitle": "Історія зустрічей",
    "duel.h2hStats": "Перемог: {wins} | Поразок: {losses} | Нічиїх: {draws}",
    "duel.expiresIn": "Закінчується через {time}",
    "duel.challenger": "Ініціатор",
    "duel.opponent": "Суперник",
    "duel.roundSummary": "Підсумок дуелі",

    # Step 3.JDUEL More Duel Strings
    "duel.creator": "Творець дуелі",
    "duel.playNow": "Грати зараз",
    "duel.myTurnAction": "Твоя черга відповідати!",
    "duel.resultPending": "Очікуємо, поки суперник завершить гру.",
    "duel.expired": "Ця дуель закінчилася.",

    # Step 3.K Play Page
    "play.timeLeft": "Час:",
    "play.questionCounter": "Питання {current} з {total}",
    "play.submitOrder": "Підтвердити порядок",
    "play.orderInstruction": "Перетягни або натисни варіанти в правильному порядку",
    "play.oddInstruction": "Обери зайвий варіант, що не підходить до інших",
    "play.logicInstruction": "Проаналізуй підказки та обери правильну відповідь",
    "play.mcqInstruction": "Обери одну правильну відповідь",
    "play.speedBonus": "+{points} балів за швидкість!",
    "play.timeout": "Час вичерпано!",
    "play.correct": "Правильно!",
    "play.wrong": "Неправильно",
    "play.leaveConfirm": "Ти впевнений, що хочеш залишити раунд? Твій прогрес буде збережено як є.",

    # Step 3.L Result Page
    "result.roundComplete": "Раунд завершено!",
    "result.scoreTitle": "Твій результат",
    "result.scorePoints": "{score} балів",
    "result.speedAverage": "Сер. час: {time}с",
    "result.streakTitle": "Серія днів",
    "result.shareCta": "Поділитися результатом",
    "result.shareStreak": "🔥 {count, plural, one {# день серії} few {# дні серії} many {# днів серії} other {# дня серії}}",
    "result.beatMe": "Спробуй перевершити мене в RonDuel!",
    "result.nextRoundIn": "Наступний раунд через {time}",
    "result.reviewAnswers": "Переглянути відповіді",
    "result.correctAnswerLabel": "Правильна відповідь:",
    "result.yourAnswerLabel": "Твоя відповідь:",
    "result.explanationLabel": "Пояснення:",

    # Step 3.LRESULT More Result
    "result.rankInLeague": "Твоє місце в лізі {name}: #{rank}",
    "result.rankWorld": "Твоє місце у світі: #{rank}",
    "result.proThemeBonus": "Тема Pro розблокована!",
    "result.copiedToClipboard": "Результат скопійовано в буфер!",

    # Step 3.M Me / Profile Page
    "profile.title": "Твій профіль",
    "profile.nickname": "Нікнейм",
    "profile.changeNickname": "Змінити нікнейм",
    "profile.nicknameCooldown": "Нікнейм можна змінювати лише раз на 30 днів.",
    "profile.statsTitle": "Статистика",
    "profile.totalScore": "Усього балів",
    "profile.roundsPlayed": "Зіграно раундів",
    "profile.winRate": "Відсоток перемог",
    "profile.currentStreak": "Поточна серія",
    "profile.bestStreak": "Найкраща серія",
    "profile.proStatus": "Статус Pro",
    "profile.proActive": "Активний до {date}",
    "profile.proInactive": "Неактивний",
    "profile.manageSub": "Керувати підпискою",
    "profile.exportData": "Експортувати мої дані",
    "profile.deleteAccount": "Видалити акаунт",
    "profile.confirmDelete": "Видалити всі дані назавжди? Цю дію не можна скасувати.",

    # Step 3.N Settings Page
    "settings.title": "Налаштування",
    "settings.language": "Мова застосунку",
    "settings.theme": "Тема оформлення",
    "settings.themeLight": "Світла",
    "settings.themeDark": "Темна",
    "settings.themeSystem": "Системна",
    "settings.notifications": "Сповіщення",
    "settings.dailyReminder": "Щоденне нагадування",
    "settings.reminderTime": "Час нагадування",
    "settings.sound": "Звуки гри",
    "settings.vibration": "Вібрація",
    "settings.relaxedTimer": "Розслаблений режим (+50% часу)",
    "settings.relaxedTimerDesc": "Раунди не будуть враховуватися в публічних рейтингах.",
    "settings.privacy": "Конфіденційність та GDPR",
    "settings.terms": "Правила та умови",
    "settings.version": "Версія RonDuel {version}",

    # Step 3.O Legal & Rules
    "legal.navLabel": "Юридичні документи",
    "rules.title": "Офіційний регламент RonDuel",
    "rules.subtitle": "Правила щоденних вікторин, система балів та дуелі 1 на 1.",

    # Step 3.P Themes
    "themes.general": "Загальні знання",
    "themes.science": "Наука та технології",
    "themes.history": "Історія та цивілізації",
    "themes.geography": "Географія та світ",
    "themes.pop_culture": "Поп-культура та медіа",
    "themes.arts_literature": "Мистецтво та література",
    "themes.sports": "Спорт та активності",
    "themes.food_drink": "Кулінарія та напої",
    "themes.nature": "Природа та тварини",
    "themes.music": "Музика та кіно",

    # Step 3.Q Leaderboard Podium & Standings
    "leaderboard.yourPosition": "Твоя позиція в рейтингу",
    "leaderboard.youAreHere": "Ти тут 📍",
    "leaderboard.myPlace": "Моє місце 🎯",
    "leaderboard.yourPlaceLabel": "Твоє місце:",
    "leaderboard.topPlayers": "Топ гравців",
    "leaderboard.allTime": "За весь час",
    "leaderboard.weekly": "Цього тижня",
    "leaderboard.daily": "Сьогодні",

    # Pro Plan & Extra Features
    "pro.heroTitle": "Виведи свої інтелектуальні дуелі на новий рівень",
    "pro.heroSubtitle": "Необмежені приватні ліги, щотижневий захист серії та детальна аналітика.",
    "pro.feature1": "Необмежені дуелі 1v1",
    "pro.feature2": "Створення ліг без обмеження учасників",
    "pro.feature3": "Щотижневий захист серії (1 пропущений день)",
    "pro.feature4": "Ексклюзивні візуальні теми Pro",
    "pro.monthlyPrice": "€2,99 / місяць",
    "pro.yearlyPrice": "€24,99 / рік (знижка 30%)",
    "pro.ctaMonthly": "Підписатися на місяць",
    "pro.ctaYearly": "Підписатися на рік",
    "pro.badge": "PRO",

    # Extra common strings
    "common.back": "Назад",
    "common.next": "Далі",
    "common.finish": "Завершити",
    "common.start": "Почати",
    "common.confirm": "Підтвердити",
    "common.cancelAction": "Скасувати",
    "common.saved": "Збережено!",
    "common.copied": "Скопійовано!",
    "common.share": "Поділитися",
    "common.loadingData": "Завантаження даних…",
    "common.search": "Пошук",
    "common.filter": "Фільтр",
    "common.all": "Усі",
    "common.none": "Немає",
    "common.yes": "Так",
    "common.no": "Ні",
}

print(f"Validating Ukrainian dictionary with {len(UK_DATA)} keys...")
validate_dict('uk', UK_DATA)

# Now assemble scripts/locales/slavic.py
print("Assembling scripts/locales/slavic.py...")
all_slavic = {
    "pl": PL_DATA,
    "cs": CS_DATA,
    "sk": SK_DATA,
    "bg": BG_DATA,
    "hr": HR_DATA,
    "sl": SL_DATA,
    "uk": UK_DATA,
}

with open("scripts/locales/slavic.py", "w", encoding="utf-8") as f:
    f.write("# Slavic translations (pl, cs, sk, bg, hr, sl, uk) for RonDuel i18n\n\n")
    f.write("DATA = {\n")
    for lang in ["pl", "cs", "sk", "bg", "hr", "sl", "uk"]:
        d = all_slavic[lang]
        validate_dict(lang, d)
        f.write(f'  "{lang}": {{\n')
        for k in EN_DATA.keys():
            val = d[k]
            val_escaped = val.replace('\\', '\\\\').replace('"', '\\"')
            f.write(f'    "{k}": "{val_escaped}",\n')
        f.write("  },\n")
    f.write("}\n")

print("Successfully created scripts/locales/slavic.py!")
