# -*- coding: utf-8 -*-
"""
Translations for the 30 seed trivia questions in Slavic languages:
- pl (Polish)
- cs (Czech)
- sk (Slovak)
- bg (Bulgarian)
- hr (Croatian)
- sl (Slovenian)
- uk (Ukrainian)
"""

DATA = {
  "pl": {
    "q-mcq-01": {
      "prompt": "Która planeta ma najkrótszy rok?",
      "options": ["Merkury", "Wenus", "Mars", "Ziemia"],
      "explanation": "Merkury okrąża Słońce w zaledwie 88 dni ziemskich."
    },
    "q-mcq-02": {
      "prompt": "Co jest stolicą Australii?",
      "options": ["Canberra", "Sydney", "Melbourne", "Perth"],
      "explanation": "Canberra została wybrana w 1908 roku jako kompromis między Sydney a Melbourne."
    },
    "q-mcq-03": {
      "prompt": "Który pierwiastek chemiczny ma symbol „Fe”?",
      "options": ["Żelazo", "Fluor", "Ołów", "Cyna"],
      "explanation": "Symbol Fe pochodzi od łacińskiego słowa ferrum, oznaczającego żelazo."
    },
    "q-mcq-04": {
      "prompt": "W którym roku runął Mur Berliński?",
      "options": ["1989", "1991", "1985", "1979"],
      "explanation": "Mur Berliński runął 9 listopada 1989 roku."
    },
    "q-mcq-05": {
      "prompt": "Jaki jest największy ocean na Ziemi?",
      "options": ["Spokojny", "Atlantycki", "Indyjski", "Arktyczny"],
      "explanation": "Ocean Spokojny (Pacyfik) pokrywa ponad 30% powierzchni Ziemi."
    },
    "q-mcq-06": {
      "prompt": "Który kraj podarował Statuę Wolności Stanom Zjednoczonym?",
      "options": ["Francja", "Wielka Brytania", "Hiszpania", "Włochy"],
      "explanation": "Francja podarowała Statuę Wolności Stanom Zjednoczonym w 1886 roku."
    },
    "q-mcq-07": {
      "prompt": "Kto namalował Mona Lisę?",
      "options": ["Leonardo da Vinci", "Michał Anioł", "Rafael Santi", "Botticelli"],
      "explanation": "Leonardo da Vinci namalował Mona Lisę na początku XVI wieku."
    },
    "q-mcq-08": {
      "prompt": "Jaka jest najdłuższa rzeka w Ameryce Południowej?",
      "options": ["Amazonka", "Parana", "Orinoko", "São Francisco"],
      "explanation": "Amazonka ma około 6400 km długości."
    },
    "q-mcq-09": {
      "prompt": "Jaki gaz rośliny pochłaniają głównie z powietrza do fotosyntezy?",
      "options": ["Dwutlenek węgla", "Tlen", "Azot", "Hel"],
      "explanation": "Rośliny pochłaniają CO2 i uwalniają tlen podczas fotosyntezy."
    },
    "q-mcq-10": {
      "prompt": "Jaka jest najmniejsza liczba pierwsza?",
      "options": ["2", "1", "3", "0"],
      "explanation": "2 to najmniejsza liczba pierwsza i jedyna parzysta."
    },
    "q-order-01": {
      "prompt": "Uporządkuj planety według odległości od Słońca, najbliższa jako pierwsza:",
      "options": ["Wenus", "Ziemia", "Mars", "Jowisz"],
      "explanation": "Od Słońca na zewnątrz: Merkury, Wenus, Ziemia, Mars, Jowisz."
    },
    "q-order-02": {
      "prompt": "Uporządkuj te wydarzenia od najwcześniejszego do najpóźniejszego:",
      "options": ["Pierwsze lądowanie na Księżycu", "Upadek Muru Berlińskiego", "Wprowadzenie monet euro", "Premiera pierwszego iPhone'a"],
      "explanation": "1969 → 1989 → 2002 → 2007."
    },
    "q-order-03": {
      "prompt": "Uporządkuj jednostki od najmniejszej do największej:",
      "options": ["Bajt", "Kilobajt", "Megabajt", "Gigabajt"],
      "explanation": "Każda kolejna jednostka rośnie 1000-krotnie (lub 1024-krotnie binarnie)."
    },
    "q-order-04": {
      "prompt": "Uporządkuj państwa według powierzchni, największe jako pierwsze:",
      "options": ["Rosja", "Kanada", "Brazylia", "Australia"],
      "explanation": "Rosja > Kanada > Brazylia > Australia pod względem powierzchni."
    },
    "q-order-05": {
      "prompt": "Uporządkuj liczby od najmniejszej do największej:",
      "options": ["0,5", "2/3", "0,7", "3/4"],
      "explanation": "0,5 < 0,666… (2/3) < 0,7 < 0,75 (3/4)."
    },
    "q-odd-01": {
      "prompt": "Które ze zwierząt NIE jest ssakiem?",
      "options": ["Rekin", "Delfin", "Nietoperz", "Wieloryb"],
      "explanation": "Rekiny to ryby; delfiny, nietoperze i wieloryby to ssaki."
    },
    "q-odd-02": {
      "prompt": "Która z tych liczb NIE jest liczbą pierwszą?",
      "options": ["15", "7", "11", "13"],
      "explanation": "15 dzieli się przez 3 i 5 (15 = 3 × 5)."
    },
    "q-odd-03": {
      "prompt": "Który z tych instrumentów NIE jest strunowy?",
      "options": ["Trąbka", "Skrzypce", "Wiolonczela", "Altówka"],
      "explanation": "Trąbka jest instrumentem dętym blaszanym."
    },
    "q-odd-04": {
      "prompt": "Które z tych miast NIE jest stolicą państwa?",
      "options": ["Barcelona", "Paryż", "Rzym", "Madryt"],
      "explanation": "Madryt jest stolicą Hiszpanii; Barcelona jest stolicą Katalonii."
    },
    "q-odd-05": {
      "prompt": "Który z tych obiektów NIE jest planetą?",
      "options": ["Księżyc", "Merkury", "Wenus", "Mars"],
      "explanation": "Księżyc jest naturalnym satelitą Ziemi."
    },
    "q-logic-01": {
      "prompt": "Jaka liczba jest następna: 2, 4, 8, 16, …?",
      "options": ["32", "24", "30", "18"],
      "explanation": "Każda kolejna liczba jest podwojeniem poprzedniej."
    },
    "q-logic-02": {
      "prompt": "Jaka liczba jest następna: 1, 1, 2, 3, 5, 8, …?",
      "options": ["13", "11", "12", "15"],
      "explanation": "Ciąg Fibonacciego: 5 + 8 = 13."
    },
    "q-logic-03": {
      "prompt": "Jeśli 3 koty łapią 3 myszy w 3 minuty, ile kotów potrzeba do złapania 100 myszy w 100 minut?",
      "options": ["3", "100", "33", "9"],
      "explanation": "Każdy kot łapie 1 mysz w 3 minuty, więc 3 koty złapią 100 myszy w 100 minut."
    },
    "q-logic-04": {
      "prompt": "Kij i piłka kosztują łącznie 1,10 $. Kij jest o 1,00 $ droższy od piłki. Ile kosztuje piłka?",
      "options": ["0,05 $", "0,10 $", "0,15 $", "0,01 $"],
      "explanation": "Piłka = 0,05 $, kij = 1,05 $, razem = 1,10 $."
    },
    "q-logic-05": {
      "prompt": "Ile to jest 15% z 200?",
      "options": ["30", "15", "20", "35"],
      "explanation": "10% z 200 to 20, a 5% to 10; 20 + 10 = 30."
    },
    "q-logic-06": {
      "prompt": "Ana jest starsza od Bena. Ben jest starszy od Cary. Kto jest najmłodszy?",
      "options": ["Cara", "Ana", "Ben", "Nie da się określić"],
      "explanation": "Ana > Ben > Cara, więc Cara jest najmłodsza."
    },
    "q-logic-07": {
      "prompt": "Jaki kąt tworzą wskazówki zegara dokładnie o godzinie 3:00?",
      "options": ["90°", "45°", "180°", "60°"],
      "explanation": "Jedna czwarta pełnego koła (360°) to 90°."
    },
    "q-logic-08": {
      "prompt": "Jaka liczba jest następna: 3, 6, 11, 18, 27, …?",
      "options": ["38", "36", "35", "40"],
      "explanation": "Różnice między liczbami rosną o 2: +3, +5, +7, +9, +11."
    },
    "q-logic-09": {
      "prompt": "Ile minut to 2,5 godziny?",
      "options": ["150", "125", "250", "130"],
      "explanation": "2,5 × 60 = 150 minut."
    },
    "q-logic-10": {
      "prompt": "Zegar wskazuje 9:00. Którą godzinę pokaże za 15 godzin?",
      "options": ["12:00", "6:00", "3:00", "9:00"],
      "explanation": "Po 12 godzinach znów jest 9:00, plus 3 godziny daje 12:00."
    }
  },
  "cs": {
    "q-mcq-01": {
      "prompt": "Která planeta má nejkratší rok?",
      "options": ["Merkur", "Venuše", "Mars", "Země"],
      "explanation": "Merkur oběhne Slunce za pouhých 88 pozemských dní."
    },
    "q-mcq-02": {
      "prompt": "Jaké je hlavní město Austrálie?",
      "options": ["Canberra", "Sydney", "Melbourne", "Perth"],
      "explanation": "Canberra byla vybrána v roce 1908 jako kompromis mezi Sydney a Melbourne."
    },
    "q-mcq-03": {
      "prompt": "Který chemický prvek má značku „Fe“?",
      "options": ["Železo", "Fluor", "Olovo", "Cín"],
      "explanation": "Fe pochází z latinského slova ferrum, což znamená železo."
    },
    "q-mcq-04": {
      "prompt": "Ve kterém roce padla Berlínská zeď?",
      "options": ["1989", "1991", "1985", "1979"],
      "explanation": "Berlínská zeď padla 9. listopadu 1989."
    },
    "q-mcq-05": {
      "prompt": "Který oceán je na Zemi největší?",
      "options": ["Tichý", "Atlantský", "Indický", "Severní ledový"],
      "explanation": "Tichý oceán pokrývá více než 30 % zemského povrchu."
    },
    "q-mcq-06": {
      "prompt": "Která země darovala Sochu Svobody Spojeným státům?",
      "options": ["Francie", "Velká Británie", "Španělsko", "Itálie"],
      "explanation": "Francie darovala Sochu Svobody USA v roce 1886."
    },
    "q-mcq-07": {
      "prompt": "Kdo namaloval Monu Lisu?",
      "options": ["Leonardo da Vinci", "Michelangelo", "Raffael", "Botticelli"],
      "explanation": "Leonardo da Vinci namaloval Monu Lisu na počátku 16. století."
    },
    "q-mcq-08": {
      "prompt": "Jaká je nejdelší řeka Jižní Ameriky?",
      "options": ["Amazonka", "Paraná", "Orinoko", "São Francisco"],
      "explanation": "Amazonka měří přibližně 6 400 km."
    },
    "q-mcq-09": {
      "prompt": "Který plyn rostliny pohlcují ze vzduchu pro fotosyntézu?",
      "options": ["Oxid uhličitý", "Kyslík", "Dusík", "Helium"],
      "explanation": "Rostliny při fotosyntéze pohlcují CO2 a uvolňují kyslík."
    },
    "q-mcq-10": {
      "prompt": "Jaké je nejmenší prvočíslo?",
      "options": ["2", "1", "3", "0"],
      "explanation": "Číslo 2 je nejmenší prvočíslo a jediné sudé prvočíslo."
    },
    "q-order-01": {
      "prompt": "Seřaďte tyto planety podle vzdálenosti od Slunce, od nejbližší:",
      "options": ["Venuše", "Země", "Mars", "Jupiter"],
      "explanation": "Pořadí od Slunce: Merkur, Venuše, Země, Mars, Jupiter."
    },
    "q-order-02": {
      "prompt": "Seřaďte tyto události od nejstarší po nejnovější:",
      "options": ["První přistání na Měsíci", "Pád Berlínské zdi", "Zavedení euromincí do oběhu", "Vydání prvního iPhonu"],
      "explanation": "1969 → 1989 → 2002 → 2007."
    },
    "q-order-03": {
      "prompt": "Seřaďte jednotky od nejmenší po největší:",
      "options": ["Bajt", "Kilobajt", "Megabajt", "Gigabajt"],
      "explanation": "Každá jednotka je tisíckrát (binárně 1024×) větší než předchozí."
    },
    "q-order-04": {
      "prompt": "Seřaďte tyto země podle rozlohy, od největší:",
      "options": ["Rusko", "Kanada", "Brazílie", "Austrálie"],
      "explanation": "Podle rozlohy: Rusko > Kanada > Brazílie > Austrálie."
    },
    "q-order-05": {
      "prompt": "Seřaďte tato čísla od nejmenšího po největší:",
      "options": ["0,5", "2/3", "0,7", "3/4"],
      "explanation": "0,5 < 0,666… (2/3) < 0,7 < 0,75 (3/4)."
    },
    "q-odd-01": {
      "prompt": "Které z těchto zvířat NENÍ savec?",
      "options": ["Žralok", "Delfín", "Netopýr", "Velryba"],
      "explanation": "Žraloci jsou paryby; delfíni, netopýři i velryby jsou savci."
    },
    "q-odd-02": {
      "prompt": "Které z těchto čísel NENÍ prvočíslo?",
      "options": ["15", "7", "11", "13"],
      "explanation": "Číslo 15 je dělitelné 3 a 5 (15 = 3 × 5)."
    },
    "q-odd-03": {
      "prompt": "Který z těchto nástrojů NENÍ strunný?",
      "options": ["Trubka", "Housle", "Violoncello", "Viola"],
      "explanation": "Trubka je žesťový dechový nástroj."
    },
    "q-odd-04": {
      "prompt": "Které z těchto měst NENÍ hlavní město státu?",
      "options": ["Barcelona", "Paříž", "Řím", "Madrid"],
      "explanation": "Madrid je hlavní město Španělska; Barcelona je hlavní město Katalánska."
    },
    "q-odd-05": {
      "prompt": "Které z těchto těles NENÍ planeta?",
      "options": ["Měsíc", "Merkur", "Venuše", "Mars"],
      "explanation": "Měsíc je přirozená družice Země."
    },
    "q-logic-01": {
      "prompt": "Jaké číslo následuje: 2, 4, 8, 16, …?",
      "options": ["32", "24", "30", "18"],
      "explanation": "Každé číslo je dvojnásobkem předchozího."
    },
    "q-logic-02": {
      "prompt": "Jaké číslo následuje: 1, 1, 2, 3, 5, 8, …?",
      "options": ["13", "11", "12", "15"],
      "explanation": "Fibonacciho posloupnost: 5 + 8 = 13."
    },
    "q-logic-03": {
      "prompt": "Pokud 3 kočky chytí 3 myši za 3 minuty, kolik koček chytí 100 myší za 100 minut?",
      "options": ["3", "100", "33", "9"],
      "explanation": "Každá kočka chytí 1 myš za 3 minuty, takže 3 kočky chytí 100 myší za 100 minut."
    },
    "q-logic-04": {
      "prompt": "Pálka a míček stojí dohromady 1,10 $. Pálka je o 1,00 $ dražší než míček. Kolik stojí míček?",
      "options": ["0,05 $", "0,10 $", "0,15 $", "0,01 $"],
      "explanation": "Míček = 0,05 $, pálka = 1,05 $, dohromady = 1,10 $."
    },
    "q-logic-05": {
      "prompt": "Kolik je 15 % z 200?",
      "options": ["30", "15", "20", "35"],
      "explanation": "10 % z 200 je 20, dalších 5 % je 10; 20 + 10 = 30."
    },
    "q-logic-06": {
      "prompt": "Anna je starší než Ben. Ben je starší než Klára. Kdo je nejmladší?",
      "options": ["Klára", "Anna", "Ben", "Nelze určit"],
      "explanation": "Anna > Ben > Klára, takže Klára je nejmladší."
    },
    "q-logic-07": {
      "prompt": "Jaký úhel svírají hodinové ručičky přesně ve 3:00?",
      "options": ["90°", "45°", "180°", "60°"],
      "explanation": "Čtvrtina kruhu o 360° je 90°."
    },
    "q-logic-08": {
      "prompt": "Jaké číslo následuje: 3, 6, 11, 18, 27, …?",
      "options": ["38", "36", "35", "40"],
      "explanation": "Rozdíly mezi čísly rostou o 2: +3, +5, +7, +9, +11."
    },
    "q-logic-09": {
      "prompt": "Kolik minut je 2,5 hodiny?",
      "options": ["150", "125", "250", "130"],
      "explanation": "2,5 × 60 = 150 minut."
    },
    "q-logic-10": {
      "prompt": "Hodiny ukazují 9:00. Jaký čas budou ukazovat za 15 hodin?",
      "options": ["12:00", "6:00", "3:00", "9:00"],
      "explanation": "Za 12 hodin je opět 9:00, plus další 3 hodiny je 12:00."
    }
  },
  "sk": {
    "q-mcq-01": {
      "prompt": "Ktorá planéta má najkratší rok?",
      "options": ["Merkúr", "Venuša", "Mars", "Zem"],
      "explanation": "Merkúr obehne Slnko za iba 88 pozemských dní."
    },
    "q-mcq-02": {
      "prompt": "Aké je hlavné mesto Austrálie?",
      "options": ["Canberra", "Sydney", "Melbourne", "Perth"],
      "explanation": "Canberra bola vybraná v roku 1908 ako kompromis medzi mestami Sydney a Melbourne."
    },
    "q-mcq-03": {
      "prompt": "Ktorý chemický prvok má značku „Fe“?",
      "options": ["Železo", "Fluór", "Olovo", "Cín"],
      "explanation": "Fe pochádza z latinského slova ferrum, čo znamená železo."
    },
    "q-mcq-04": {
      "prompt": "V ktorom roku padol Berlínsky múr?",
      "options": ["1989", "1991", "1985", "1979"],
      "explanation": "Berlínsky múr padol 9. novembra 1989."
    },
    "q-mcq-05": {
      "prompt": "Ktorý je najväčší oceán na Zemi?",
      "options": ["Tichý", "Atlantický", "Indický", "Severný ľadový"],
      "explanation": "Tichý oceán pokrýva viac ako 30 % povrchu Zeme."
    },
    "q-mcq-06": {
      "prompt": "Ktorá krajina darovala Sochu slobody Spojeným štátom?",
      "options": ["Francúzsko", "Spojené kráľovstvo", "Španielsko", "Taliansko"],
      "explanation": "Francúzsko darovalo Sochu slobody USA v roku 1886."
    },
    "q-mcq-07": {
      "prompt": "Kto namaľoval Monu Lízu?",
      "options": ["Leonardo da Vinci", "Michelangelo", "Raffael", "Botticelli"],
      "explanation": "Leonardo da Vinci namaľoval Monu Lízu začiatkom 16. storočia."
    },
    "q-mcq-08": {
      "prompt": "Aká je najdlhšia rieka Južnej Ameriky?",
      "options": ["Amazonka", "Paraná", "Orinoko", "São Francisco"],
      "explanation": "Amazonka meria približne 6 400 km."
    },
    "q-mcq-09": {
      "prompt": "Ktorý plyn rastliny absorbujú zo vzduchu na fotosyntézu?",
      "options": ["Oxid uhličitý", "Kyslík", "Dusík", "Hélium"],
      "explanation": "Rastliny pri fotosyntéze pohlcujú CO2 a uvoľňujú kyslík."
    },
    "q-mcq-10": {
      "prompt": "Aké je najmenšie prvočíslo?",
      "options": ["2", "1", "3", "0"],
      "explanation": "Číslo 2 je najmenšie a jediné párne prvočíslo."
    },
    "q-order-01": {
      "prompt": "Usporiadajte planéty podľa vzdialenosti od Slnka, od najbližšej:",
      "options": ["Venuša", "Zem", "Mars", "Jupiter"],
      "explanation": "Poradie od Slnka: Merkúr, Venuša, Zem, Mars, Jupiter."
    },
    "q-order-02": {
      "prompt": "Usporiadajte tieto udalosti od najstaršej po najnovšiu:",
      "options": ["Prvé pristátie na Mesiaci", "Pád Berlínskeho múru", "Zavedenie euromincí do obehu", "Predstavenie prvého iPhonu"],
      "explanation": "1969 → 1989 → 2002 → 2007."
    },
    "q-order-03": {
      "prompt": "Usporiadajte jednotky od najmenšej po najväčšiu:",
      "options": ["Bajt", "Kilobajt", "Megabajt", "Gigabajt"],
      "explanation": "Každá jednotka rastie 1 000-násobne (binárne 1 024-násobne)."
    },
    "q-order-04": {
      "prompt": "Usporiadajte tieto krajiny podľa rozlohy, od najväčšej:",
      "options": ["Rusko", "Kanada", "Brazília", "Austrália"],
      "explanation": "Podľa rozlohy: Rusko > Kanada > Brazília > Austrália."
    },
    "q-order-05": {
      "prompt": "Usporiadajte tieto čísla od najmenšieho po najväčšie:",
      "options": ["0,5", "2/3", "0,7", "3/4"],
      "explanation": "0,5 < 0,666… (2/3) < 0,7 < 0,75 (3/4)."
    },
    "q-odd-01": {
      "prompt": "Ktoré z týchto zvierat NIE JE cicavec?",
      "options": ["Žralok", "Delfín", "Netopier", "Veľryba"],
      "explanation": "Žraloky sú drsnokožce; delfíny, netopiere aj veľryby sú cicavce."
    },
    "q-odd-02": {
      "prompt": "Ktoré z týchto čísel NIE JE prvočíslo?",
      "options": ["15", "7", "11", "13"],
      "explanation": "Číslo 15 je deliteľné 3 a 5 (15 = 3 × 5)."
    },
    "q-odd-03": {
      "prompt": "Ktorý z týchto nástrojov NIE JE strunový?",
      "options": ["Trúbka", "Husle", "Violončelo", "Viola"],
      "explanation": "Trúbka je plechový dychový nástroj."
    },
    "q-odd-04": {
      "prompt": "Ktoré z týchto miest NIE JE hlavné mesto štátu?",
      "options": ["Barcelona", "Paríž", "Rím", "Madrid"],
      "explanation": "Madrid je hlavné mesto Španielska; Barcelona je hlavné mesto Katalánska."
    },
    "q-odd-05": {
      "prompt": "Ktoré z týchto telies NIE JE planéta?",
      "options": ["Mesiac", "Merkúr", "Venuša", "Mars"],
      "explanation": "Mesiac je prirodzená družica Zeme."
    },
    "q-logic-01": {
      "prompt": "Aké číslo nasleduje: 2, 4, 8, 16, …?",
      "options": ["32", "24", "30", "18"],
      "explanation": "Každé číslo je dvojnásobkom predchádzajúceho."
    },
    "q-logic-02": {
      "prompt": "Aké číslo nasleduje: 1, 1, 2, 3, 5, 8, …?",
      "options": ["13", "11", "12", "15"],
      "explanation": "Fibonacciho postupnosť: 5 + 8 = 13."
    },
    "q-logic-03": {
      "prompt": "Ak 3 mačky chytia 3 myši za 3 minúty, koľko mačiek chytí 100 myší za 100 minút?",
      "options": ["3", "100", "33", "9"],
      "explanation": "Každá mačka chytí 1 myš za 3 minúty, takže 3 mačky chytia 100 myší za 100 minút."
    },
    "q-logic-04": {
      "prompt": "Pálka a loptička stoja spolu 1,10 $. Pálka je o 1,00 $ drahšia ako loptička. Koľko stojí loptička?",
      "options": ["0,05 $", "0,10 $", "0,15 $", "0,01 $"],
      "explanation": "Loptička = 0,05 $, pálka = 1,05 $, spolu = 1,10 $."
    },
    "q-logic-05": {
      "prompt": "Koľko je 15 % z 200?",
      "options": ["30", "15", "20", "35"],
      "explanation": "10 % z 200 je 20, ďalších 5 % je 10; 20 + 10 = 30."
    },
    "q-logic-06": {
      "prompt": "Anna je staršia ako Ben. Ben je starší ako Klára. Kto je najmladší?",
      "options": ["Klára", "Anna", "Ben", "Nedá sa určiť"],
      "explanation": "Anna > Ben > Klára, takže najmladšia je Klára."
    },
    "q-logic-07": {
      "prompt": "Aký uhol zvierajú hodinové ručičky presne o 3:00?",
      "options": ["90°", "45°", "180°", "60°"],
      "explanation": "Štvrtina 360-stupňového kruhu je 90°."
    },
    "q-logic-08": {
      "prompt": "Aké číslo nasleduje: 3, 6, 11, 18, 27, …?",
      "options": ["38", "36", "35", "40"],
      "explanation": "Rozdiely medzi číslami rastú o 2: +3, +5, +7, +9, +11."
    },
    "q-logic-09": {
      "prompt": "Koľko minút je 2,5 hodiny?",
      "options": ["150", "125", "250", "130"],
      "explanation": "2,5 × 60 = 150 minút."
    },
    "q-logic-10": {
      "prompt": "Hodiny ukazujú 9:00. Aký čas budú ukazovať o 15 hodín?",
      "options": ["12:00", "6:00", "3:00", "9:00"],
      "explanation": "O 12 hodín bude opäť 9:00, plus ďalšie 3 hodiny je 12:00."
    }
  },
  "bg": {
    "q-mcq-01": {
      "prompt": "Коя планета има най-кратката година?",
      "options": ["Меркурий", "Венера", "Марс", "Земя"],
      "explanation": "Меркурий обикаля около Слънцето само за 88 земни дни."
    },
    "q-mcq-02": {
      "prompt": "Коя е столицата на Австралия?",
      "options": ["Канбера", "Сидни", "Мелбърн", "Пърт"],
      "explanation": "Канбера е избрана през 1908 г. като компромис между Сидни и Мелбърн."
    },
    "q-mcq-03": {
      "prompt": "Кой химичен елемент има символ „Fe“?",
      "options": ["Желязо", "Флуор", "Олово", "Калай"],
      "explanation": "Fe произлиза от латинската дума ferrum, означаваща желязо."
    },
    "q-mcq-04": {
      "prompt": "През коя година пада Берлинската стена?",
      "options": ["1989", "1991", "1985", "1979"],
      "explanation": "Берлинската стена пада на 9 ноември 1989 г."
    },
    "q-mcq-05": {
      "prompt": "Кой е най-големият океан на Земята?",
      "options": ["Тихи", "Атлантически", "Индийски", "Северен ледовит"],
      "explanation": "Тихият океан покрива над 30% от повърхността на Земята."
    },
    "q-mcq-06": {
      "prompt": "Коя държава подарява Статуята на свободата на САЩ?",
      "options": ["Франция", "Обединеното кралство", "Испания", "Италия"],
      "explanation": "Франция подарява Статуята на свободата на САЩ през 1886 г."
    },
    "q-mcq-07": {
      "prompt": "Кой е нарисувал Мона Лиза?",
      "options": ["Леонардо да Винчи", "Микеланджело", "Рафаело", "Ботичели"],
      "explanation": "Леонардо да Винчи рисува Мона Лиза в началото на XVI век."
    },
    "q-mcq-08": {
      "prompt": "Коя е най-дългата река в Южна Америка?",
      "options": ["Амазонка", "Парана", "Ориноко", "Сао Франсиско"],
      "explanation": "Река Амазонка е с дължина около 6400 км."
    },
    "q-mcq-09": {
      "prompt": "Кой газ поемат растенията от въздуха при фотосинтеза?",
      "options": ["Въглероден диоксид", "Кислород", "Азот", "Хелий"],
      "explanation": "Растенията поемат CO2 и отделят кислород по време на фотосинтеза."
    },
    "q-mcq-10": {
      "prompt": "Кое е най-малкото просто число?",
      "options": ["2", "1", "3", "0"],
      "explanation": "2 е най-малкото просто число и единственото четно просто число."
    },
    "q-order-01": {
      "prompt": "Подредете планетите по разстояние от Слънцето, най-близката първа:",
      "options": ["Венера", "Земя", "Марс", "Юпитер"],
      "explanation": "Редът от Слънцето: Меркурий, Венера, Земя, Марс, Юпитер."
    },
    "q-order-02": {
      "prompt": "Подредете тези събития от най-ранното към най-късното:",
      "options": ["Първо кацане на Луната", "Падане на Берлинската стена", "Въвеждане на евро монетите", "Пускане на първия iPhone"],
      "explanation": "1969 → 1989 → 2002 → 2007."
    },
    "q-order-03": {
      "prompt": "Подредете мерните единици от най-малката към най-голямата:",
      "options": ["Байт", "Килобайт", "Мегабайт", "Гигабайт"],
      "explanation": "Всяка следваща единица е 1000 пъти (или 1024 в двоична система) по-голяма."
    },
    "q-order-04": {
      "prompt": "Подредете страните по площ, най-голямата първа:",
      "options": ["Русия", "Канада", "Бразилия", "Австралия"],
      "explanation": "По площ: Русия > Канада > Бразилия > Австралия."
    },
    "q-order-05": {
      "prompt": "Подредете тези числа от най-малкото към най-голямото:",
      "options": ["0,5", "2/3", "0,7", "3/4"],
      "explanation": "0,5 < 0,666… (2/3) < 0,7 < 0,75 (3/4)."
    },
    "q-odd-01": {
      "prompt": "Кое от изброените НЕ е бозайник?",
      "options": ["Акула", "Делфин", "Прилеп", "Кит"],
      "explanation": "Акулите са риби; делфините, прилепите и китовете са бозайници."
    },
    "q-odd-02": {
      "prompt": "Кое от тези числа НЕ е просто число?",
      "options": ["15", "7", "11", "13"],
      "explanation": "15 се дели на 3 и на 5 (15 = 3 × 5)."
    },
    "q-odd-03": {
      "prompt": "Кой от тези инструменти НЕ е струнен?",
      "options": ["Тромпет", "Цигулка", "Виолончело", "Виола"],
      "explanation": "Тромпетът е меден духов инструмент."
    },
    "q-odd-04": {
      "prompt": "Кой от тези градове НЕ е национална столица?",
      "options": ["Барселона", "Париж", "Рим", "Мадрид"],
      "explanation": "Мадрид е столицата на Испания; Барселона е столицата на Каталуния."
    },
    "q-odd-05": {
      "prompt": "Кой от тези обекти НЕ е планета?",
      "options": ["Луната", "Меркурий", "Венера", "Марс"],
      "explanation": "Луната е естествен спътник на Земята."
    },
    "q-logic-01": {
      "prompt": "Кое число следва: 2, 4, 8, 16, …?",
      "options": ["32", "24", "30", "18"],
      "explanation": "Всяко число е удвоената стойност на предишното."
    },
    "q-logic-02": {
      "prompt": "Кое число следва: 1, 1, 2, 3, 5, 8, …?",
      "options": ["13", "11", "12", "15"],
      "explanation": "Редица на Фибоначи: 5 + 8 = 13."
    },
    "q-logic-03": {
      "prompt": "Ако 3 котки хващат 3 мишки за 3 минути, колко котки са нужни за 100 мишки за 100 минути?",
      "options": ["3", "100", "33", "9"],
      "explanation": "Всяка котка хваща по 1 мишка на 3 минути, така че 3 котки хващат 100 мишки за 100 минути."
    },
    "q-logic-04": {
      "prompt": "Бухалка и топка струват общо $1,10. Бухалката е с $1,00 по-скъпа от топката. Колко струва топката?",
      "options": ["$0,05", "$0,10", "$0,15", "$0,01"],
      "explanation": "Топка = $0,05, бухалка = $1,05, общо = $1,10."
    },
    "q-logic-05": {
      "prompt": "Колко е 15% от 200?",
      "options": ["30", "15", "20", "35"],
      "explanation": "10% от 200 е 20, а 5% е 10; 20 + 10 = 30."
    },
    "q-logic-06": {
      "prompt": "Ана е по-голяма от Бен. Бен е по-голям от Кара. Кой е най-млад?",
      "options": ["Кара", "Ана", "Бен", "Не може да се определи"],
      "explanation": "Ана > Бен > Кара, следователно Кара е най-млада."
    },
    "q-logic-07": {
      "prompt": "Какъв ъгъл сключват стрелките на часовника точно в 3:00?",
      "options": ["90°", "45°", "180°", "60°"],
      "explanation": "Една четвърт от пълен кръг (360°) е точно 90°."
    },
    "q-logic-08": {
      "prompt": "Кое число следва: 3, 6, 11, 18, 27, …?",
      "options": ["38", "36", "35", "40"],
      "explanation": "Разликите между числата нарастват с 2: +3, +5, +7, +9, +11."
    },
    "q-logic-09": {
      "prompt": "Колко минути има в 2,5 часа?",
      "options": ["150", "125", "250", "130"],
      "explanation": "2,5 × 60 = 150 минути."
    },
    "q-logic-10": {
      "prompt": "Часовник показва 9:00. Колко часа ще показва след 15 часа?",
      "options": ["12:00", "6:00", "3:00", "9:00"],
      "explanation": "След 12 часа отново е 9:00, плюс още 3 часа става 12:00."
    }
  },
  "hr": {
    "q-mcq-01": {
      "prompt": "Koji planet ima najkraću godinu?",
      "options": ["Merkur", "Venera", "Mars", "Zemlja"],
      "explanation": "Merkur obiđe Sunce za samo 88 zemaljskih dana."
    },
    "q-mcq-02": {
      "prompt": "Koji je glavni grad Australije?",
      "options": ["Canberra", "Sydney", "Melbourne", "Perth"],
      "explanation": "Canberra je odabrana 1908. godine kao kompromis između Sydneya i Melbournea."
    },
    "q-mcq-03": {
      "prompt": "Koji kemijski element ima simbol „Fe”?",
      "options": ["Željezo", "Fluor", "Olovo", "Kositar"],
      "explanation": "Fe dolazi od latinske riječi ferrum, što znači željezo."
    },
    "q-mcq-04": {
      "prompt": "Koje je godine pao Berlinski zid?",
      "options": ["1989", "1991", "1985", "1979"],
      "explanation": "Berlinski zid pao je 9. studenoga 1989."
    },
    "q-mcq-05": {
      "prompt": "Koji je najveći ocean na Zemlji?",
      "options": ["Tihi", "Atlantski", "Indijski", "Arktički"],
      "explanation": "Tihi ocean pokriva više od 30 % površine Zemlje."
    },
    "q-mcq-06": {
      "prompt": "Koja je zemlja poklonila Kip slobode Sjedinjenim Državama?",
      "options": ["Francuska", "Ujedinjeno Kraljevstvo", "Španjolska", "Italija"],
      "explanation": "Francuska je poklonila Kip slobode SAD-u 1886. godine."
    },
    "q-mcq-07": {
      "prompt": "Tko je naslikao Mona Lisu?",
      "options": ["Leonardo da Vinci", "Michelangelo", "Rafael", "Botticelli"],
      "explanation": "Leonardo da Vinci naslikao je Mona Lisu početkom 16. stoljeća."
    },
    "q-mcq-08": {
      "prompt": "Koja je najduža rijeka u Južnoj Americi?",
      "options": ["Amazona", "Paraná", "Orinoco", "São Francisco"],
      "explanation": "Rijeka Amazona dugačka je približno 6400 km."
    },
    "q-mcq-09": {
      "prompt": "Koji plin biljke uglavnom upijaju iz zraka za fotosintezu?",
      "options": ["Ugljikov dioksid", "Kisik", "Dušik", "Helij"],
      "explanation": "Biljke tijekom fotosinteze apsorbiraju CO2 i oslobađaju kisik."
    },
    "q-mcq-10": {
      "prompt": "Koji je najmanji prosti broj?",
      "options": ["2", "1", "3", "0"],
      "explanation": "Broj 2 je najmanji i jedini parni prosti broj."
    },
    "q-order-01": {
      "prompt": "Poredajte ove planete po udaljenosti od Sunca, počevši od najbližeg:",
      "options": ["Venera", "Zemlja", "Mars", "Jupiter"],
      "explanation": "Redoslijed od Sunca: Merkur, Venera, Zemlja, Mars, Jupiter."
    },
    "q-order-02": {
      "prompt": "Poredajte ove događaje od najstarijeg prema najnovijem:",
      "options": ["Prvo slijetanje na Mjesec", "Pad Berlinskog zida", "Uvođenje kovanica eura", "Izlazak prvog iPhonea"],
      "explanation": "1969. → 1989. → 2002. → 2007."
    },
    "q-order-03": {
      "prompt": "Poredajte jedinice od najmanje prema najvećoj:",
      "options": ["Bajt", "Kilobajt", "Megabajt", "Gigabajt"],
      "explanation": "Svaka je jedinica 1000 puta (ili 1024 binarno) veća od prethodne."
    },
    "q-order-04": {
      "prompt": "Poredajte ove zemlje po površini, počevši od najveće:",
      "options": ["Rusija", "Kanada", "Brazil", "Australija"],
      "explanation": "Po površini: Rusija > Kanada > Brazil > Australija."
    },
    "q-order-05": {
      "prompt": "Poredajte ove brojeve od najmanjeg prema najvećem:",
      "options": ["0,5", "2/3", "0,7", "3/4"],
      "explanation": "0,5 < 0,666… (2/3) < 0,7 < 0,75 (3/4)."
    },
    "q-odd-01": {
      "prompt": "Koja od ovih životinja NIJE sisavac?",
      "options": ["Morski pas", "Dupin", "Šišmiš", "Kit"],
      "explanation": "Morski psi su ribe; dupini, šišmiši i kitovi su sisavci."
    },
    "q-odd-02": {
      "prompt": "Koji od ovih brojeva NIJE prosti broj?",
      "options": ["15", "7", "11", "13"],
      "explanation": "Broj 15 djeljiv je s 3 i 5 (15 = 3 × 5)."
    },
    "q-odd-03": {
      "prompt": "Koji od ovih instrumenata NIJE žičani instrument?",
      "options": ["Truba", "Violina", "Violončelo", "Viola"],
      "explanation": "Truba je limeni puhački instrument."
    },
    "q-odd-04": {
      "prompt": "Koji od ovih gradova NIJE glavni grad države?",
      "options": ["Barcelona", "Pariz", "Rim", "Madrid"],
      "explanation": "Madrid je glavni grad Španjolske; Barcelona je glavni grad Katalonije."
    },
    "q-odd-05": {
      "prompt": "Koje od ovih tijela NIJE planet?",
      "options": ["Mjesec", "Merkur", "Venera", "Mars"],
      "explanation": "Mjesec je Zemljin prirodni satelit."
    },
    "q-logic-01": {
      "prompt": "Koji broj slijedi: 2, 4, 8, 16, …?",
      "options": ["32", "24", "30", "18"],
      "explanation": "Svaki broj dvostruko je veći od prethodnog."
    },
    "q-logic-02": {
      "prompt": "Koji broj slijedi: 1, 1, 2, 3, 5, 8, …?",
      "options": ["13", "11", "12", "15"],
      "explanation": "Fibonaccijev niz: 5 + 8 = 13."
    },
    "q-logic-03": {
      "prompt": "Ako 3 mačke uhvate 3 miša u 3 minute, koliko je mačaka potrebno za 100 miševa u 100 minuta?",
      "options": ["3", "100", "33", "9"],
      "explanation": "Svaka mačka uhvati 1 miša svake 3 minute, pa 3 mačke uhvate 100 miševa u 100 minuta."
    },
    "q-logic-04": {
      "prompt": "Palica i loptica koštaju ukupno 1,10 $. Palica košta 1,00 $ više od loptice. Koliko košta loptica?",
      "options": ["0,05 $", "0,10 $", "0,15 $", "0,01 $"],
      "explanation": "Loptica = 0,05 $, palica = 1,05 $, ukupno = 1,10 $."
    },
    "q-logic-05": {
      "prompt": "Koliko je 15 % od 200?",
      "options": ["30", "15", "20", "35"],
      "explanation": "10 % od 200 je 20, plus 5 % (10) iznosi 30."
    },
    "q-logic-06": {
      "prompt": "Ana je starija od Bena. Ben je stariji od Care. Tko je najmlađi?",
      "options": ["Cara", "Ana", "Ben", "Ne može se odrediti"],
      "explanation": "Ana > Ben > Cara, pa je Cara najmlađa."
    },
    "q-logic-07": {
      "prompt": "Koji kut zatvaraju kazaljke sata točno u 3:00?",
      "options": ["90°", "45°", "180°", "60°"],
      "explanation": "Četvrtina kruga od 360° iznosi 90°."
    },
    "q-logic-08": {
      "prompt": "Koji broj slijedi: 3, 6, 11, 18, 27, …?",
      "options": ["38", "36", "35", "40"],
      "explanation": "Razlike među brojevima rastu za 2: +3, +5, +7, +9, +11."
    },
    "q-logic-09": {
      "prompt": "Koliko minuta ima u 2,5 sata?",
      "options": ["150", "125", "250", "130"],
      "explanation": "2,5 × 60 = 150 minuta."
    },
    "q-logic-10": {
      "prompt": "Sat pokazuje 9:00. Koliko će sati pokazivati nakon 15 sati?",
      "options": ["12:00", "6:00", "3:00", "9:00"],
      "explanation": "Nakon 12 sati opet je 9:00, plus 3 sata daje 12:00."
    }
  },
  "sl": {
    "q-mcq-01": {
      "prompt": "Kateri planet ima najkrajše leto?",
      "options": ["Merkur", "Venera", "Mars", "Zemlja"],
      "explanation": "Merkur obkroži Sonce v pičlih 88 zemeljskih dneh."
    },
    "q-mcq-02": {
      "prompt": "Katero je glavno mesto Avstralije?",
      "options": ["Canberra", "Sydney", "Melbourne", "Perth"],
      "explanation": "Canberra je bila izbrana leta 1908 kot kompromis med Sydneyjem in Melbournom."
    },
    "q-mcq-03": {
      "prompt": "Kateri kemijski element ima simbol »Fe«?",
      "options": ["Železo", "Fluor", "Svinec", "Kositer"],
      "explanation": "Simbol Fe izhaja iz latinske besede ferrum, kar pomeni železo."
    },
    "q-mcq-04": {
      "prompt": "Katerega leta je padel Berlinski zid?",
      "options": ["1989", "1991", "1985", "1979"],
      "explanation": "Berlinski zid je padel 9. novembra 1989."
    },
    "q-mcq-05": {
      "prompt": "Kateri je največji ocean na Zemlji?",
      "options": ["Tihi", "Atlantski", "Indijski", "Arktični"],
      "explanation": "Tihi ocean pokriva več kot 30 % površja Zemlje."
    },
    "q-mcq-06": {
      "prompt": "Katera država je Združenim državam podarila Kip svobode?",
      "options": ["Francija", "Združeno kraljestvo", "Španija", "Italija"],
      "explanation": "Francija je ZDA podarila Kip svobode leta 1886."
    },
    "q-mcq-07": {
      "prompt": "Kdo je naslikal Mono Lizo?",
      "options": ["Leonardo da Vinci", "Michelangelo", "Rafael", "Botticelli"],
      "explanation": "Leonardo da Vinci je Mono Lizo naslikal v začetku 16. stoletja."
    },
    "q-mcq-08": {
      "prompt": "Katera je najdaljša reka v Južni Ameriki?",
      "options": ["Amazonka", "Parana", "Orinoko", "São Francisco"],
      "explanation": "Reka Amazonka meri približno 6400 km."
    },
    "q-mcq-09": {
      "prompt": "Kateri plin rastline v glavnem črpajo iz zraka za fotosintezo?",
      "options": ["Ogljikov dioksid", "Kisik", "Dušik", "Helij"],
      "explanation": "Rastline med fotosintezo sprejemajo CO2 in sproščajo kisik."
    },
    "q-mcq-10": {
      "prompt": "Katero je najmanjše praštevilo?",
      "options": ["2", "1", "3", "0"],
      "explanation": "Število 2 je najmanjše in edino sodo praštevilo."
    },
    "q-order-01": {
      "prompt": "Razvrstite te planete po oddaljenosti od Sonca, od najbližjega naprej:",
      "options": ["Venera", "Zemlja", "Mars", "Jupiter"],
      "explanation": "Vrstni red od Sonca: Merkur, Venera, Zemlja, Mars, Jupiter."
    },
    "q-order-02": {
      "prompt": "Razvrstite te dogodke od najzgodnejšega do najnovejšega:",
      "options": ["Prvi pristanek na Luni", "Padec Berlinskega zidu", "Uvedba evrskih kovancev", "Izid prvega iPhona"],
      "explanation": "1969 → 1989 → 2002 → 2007."
    },
    "q-order-03": {
      "prompt": "Razvrstite enote od najmanjše do največje:",
      "options": ["Bajt", "Kilobajt", "Megabajt", "Gigabajt"],
      "explanation": "Vsaka enota je 1000-krat (binarno 1024-krat) večja od prejšnje."
    },
    "q-order-04": {
      "prompt": "Razvrstite te države po površini, od največje naprej:",
      "options": ["Rusija", "Kanada", "Brazilija", "Avstralija"],
      "explanation": "Po površini: Rusija > Kanada > Brazilija > Avstralija."
    },
    "q-order-05": {
      "prompt": "Razvrstite ta števila od najmanjšega do največjega:",
      "options": ["0,5", "2/3", "0,7", "3/4"],
      "explanation": "0,5 < 0,666… (2/3) < 0,7 < 0,75 (3/4)."
    },
    "q-odd-01": {
      "prompt": "Katera od teh živali NI sesalec?",
      "options": ["Morski pes", "Delfin", "Netopir", "Kit"],
      "explanation": "Morski psi so ribe; delfini, netopirji in kiti so sesalci."
    },
    "q-odd-02": {
      "prompt": "Katero od teh števil NI praštevilo?",
      "options": ["15", "7", "11", "13"],
      "explanation": "Število 15 je deljivo s 3 in 5 (15 = 3 × 5)."
    },
    "q-odd-03": {
      "prompt": "Katero od teh glasbil NI strunsko glasbilo?",
      "options": ["Trobenta", "Violina", "Violončelo", "Viola"],
      "explanation": "Trobenta je trobilo."
    },
    "q-odd-04": {
      "prompt": "Katero od teh mest NI državna prestolnica?",
      "options": ["Barcelona", "Pariz", "Rim", "Madrid"],
      "explanation": "Madrid je prestolnica Španije; Barcelona je prestolnica Katalonije."
    },
    "q-odd-05": {
      "prompt": "Katero od teh teles NI planet?",
      "options": ["Luna", "Merkur", "Venera", "Mars"],
      "explanation": "Luna je naravni satelit Zemlje."
    },
    "q-logic-01": {
      "prompt": "Katero število sledi: 2, 4, 8, 16, …?",
      "options": ["32", "24", "30", "18"],
      "explanation": "Vsako število je dvakratnik prejšnjega."
    },
    "q-logic-02": {
      "prompt": "Katero število sledi: 1, 1, 2, 3, 5, 8, …?",
      "options": ["13", "11", "12", "15"],
      "explanation": "Fibonaccijevo zaporedje: 5 + 8 = 13."
    },
    "q-logic-03": {
      "prompt": "Če 3 mačke ujamejo 3 miši v 3 minutah, koliko mačk potrebujemo za 100 miši v 100 minutah?",
      "options": ["3", "100", "33", "9"],
      "explanation": "Vsaka mačka ujame 1 miš v 3 minutah, zato 3 mačke ujamejo 100 miši v 100 minutah."
    },
    "q-logic-04": {
      "prompt": "Kij in žogica skupaj staneta 1,10 $. Kij stane 1,00 $ več kot žogica. Koliko stane žogica?",
      "options": ["0,05 $", "0,10 $", "0,15 $", "0,01 $"],
      "explanation": "Žogica = 0,05 $, kij = 1,05 $, skupaj = 1,10 $."
    },
    "q-logic-05": {
      "prompt": "Koliko je 15 % od 200?",
      "options": ["30", "15", "20", "35"],
      "explanation": "10 % od 200 je 20, plus 5 % (10) je 30."
    },
    "q-logic-06": {
      "prompt": "Ana je starejša od Bena. Ben je starejši od Care. Kdo je najmlajši?",
      "options": ["Cara", "Ana", "Ben", "Ni mogoče določiti"],
      "explanation": "Ana > Ben > Cara, torej je Cara najmlajša."
    },
    "q-logic-07": {
      "prompt": "Kakšen kot oklepata urna in minutna kazalca natanko ob 3:00?",
      "options": ["90°", "45°", "180°", "60°"],
      "explanation": "Četrtina polnega kroga (360°) meri 90°."
    },
    "q-logic-08": {
      "prompt": "Katero število sledi: 3, 6, 11, 18, 27, …?",
      "options": ["38", "36", "35", "40"],
      "explanation": "Razlike med števili naraščajo za 2: +3, +5, +7, +9, +11."
    },
    "q-logic-09": {
      "prompt": "Koliko minut je v 2,5 urah?",
      "options": ["150", "125", "250", "130"],
      "explanation": "2,5 × 60 = 150 minut."
    },
    "q-logic-10": {
      "prompt": "Ura kaže 9:00. Koliko bo kazala čez 15 ur?",
      "options": ["12:00", "6:00", "3:00", "9:00"],
      "explanation": "Čez 12 ur je znova 9:00, plus 3 ure je 12:00."
    }
  },
  "uk": {
    "q-mcq-01": {
      "prompt": "На якій планеті найкоротший рік?",
      "options": ["Меркурій", "Венера", "Марс", "Земля"],
      "explanation": "Меркурій обертається навколо Сонця лише за 88 земних днів."
    },
    "q-mcq-02": {
      "prompt": "Яке місто є столицею Австралії?",
      "options": ["Канберра", "Сідней", "Мельбурн", "Перт"],
      "explanation": "Канберру обрали у 1908 році як компроміс між Сіднеєм і Мельбурном."
    },
    "q-mcq-03": {
      "prompt": "Який хімічний елемент позначається символом «Fe»?",
      "options": ["Залізо", "Фтор", "Свинець", "Олово"],
      "explanation": "Fe походить від латинського слова ferrum, що означає залізо."
    },
    "q-mcq-04": {
      "prompt": "У якому році впав Берлінський мур?",
      "options": ["1989", "1991", "1985", "1979"],
      "explanation": "Берлінський мур упав 9 листопада 1989 року."
    },
    "q-mcq-05": {
      "prompt": "Який океан є найбільшим на Землі?",
      "options": ["Тихий", "Атлантичний", "Індійський", "Північний Льодовитий"],
      "explanation": "Тихий океан вкриває понад 30% поверхні Землі."
    },
    "q-mcq-06": {
      "prompt": "Яка країна подарувала США Статую Свободи?",
      "options": ["Франція", "Велика Британія", "Іспанія", "Італія"],
      "explanation": "Франція подарувала Статую Свободи США у 1886 році."
    },
    "q-mcq-07": {
      "prompt": "Хто написав картину «Мона Ліза»?",
      "options": ["Леонардо да Вінчі", "Мікеланджело", "Рафаель", "Боттічеллі"],
      "explanation": "Леонардо да Вінчі створив «Мону Лізу» на початку XVI століття."
    },
    "q-mcq-08": {
      "prompt": "Яка річка є найдовшою в Південній Америці?",
      "options": ["Амазонка", "Парана", "Оріноко", "Сан-Франсиску"],
      "explanation": "Довжина річки Амазонка становить близько 6400 км."
    },
    "q-mcq-09": {
      "prompt": "Який газ рослини переважно поглинають з повітря для фотосинтезу?",
      "options": ["Вуглекислий газ", "Кисень", "Азот", "Гелій"],
      "explanation": "Під час фотосинтезу рослини поглинають CO2 та виділяють кисень."
    },
    "q-mcq-10": {
      "prompt": "Яке найменше просте число?",
      "options": ["2", "1", "3", "0"],
      "explanation": "2 — найменше і єдине парне просте число."
    },
    "q-order-01": {
      "prompt": "Розташуйте планети за відстанню від Сонця, найближча перша:",
      "options": ["Венера", "Земля", "Марс", "Юпітер"],
      "explanation": "Порядок від Сонця: Меркурій, Венера, Земля, Марс, Юпітер."
    },
    "q-order-02": {
      "prompt": "Розташуйте події від найдавнішої до найновішої:",
      "options": ["Перша висадка на Місяць", "Падіння Берлінського муру", "Введення монет євро в обіг", "Вихід першого iPhone"],
      "explanation": "1969 → 1989 → 2002 → 2007."
    },
    "q-order-03": {
      "prompt": "Розташуйте одиниці від найменшої до найбільшої:",
      "options": ["Байт", "Кілобайт", "Мегабайт", "Гігабайт"],
      "explanation": "Кожна одиниця збільшується в 1000 разів (або в 1024 у двійковій системі)."
    },
    "q-order-04": {
      "prompt": "Розташуйте країни за площею, найбільша перша:",
      "options": ["Росія", "Канада", "Бразилія", "Австралія"],
      "explanation": "За площею: Росія > Канада > Бразилія > Австралія."
    },
    "q-order-05": {
      "prompt": "Розташуйте ці числа від найменшого до найбільшого:",
      "options": ["0,5", "2/3", "0,7", "3/4"],
      "explanation": "0,5 < 0,666… (2/3) < 0,7 < 0,75 (3/4)."
    },
    "q-odd-01": {
      "prompt": "Хто з перелічених НЕ є ссавцем?",
      "options": ["Акула", "Дельфін", "Кажан", "Кит"],
      "explanation": "Акули — це риби; дельфіни, кажани та кити є ссавцями."
    },
    "q-odd-02": {
      "prompt": "Яке з цих чисел НЕ є простим?",
      "options": ["15", "7", "11", "13"],
      "explanation": "15 ділиться на 3 та 5 (15 = 3 × 5)."
    },
    "q-odd-03": {
      "prompt": "Який із цих інструментів НЕ є струнним?",
      "options": ["Труба", "Скрипка", "Віолончель", "Альт"],
      "explanation": "Труба — це мідний духовий інструмент."
    },
    "q-odd-04": {
      "prompt": "Яке з цих міст НЕ є столицею держави?",
      "options": ["Барселона", "Париж", "Рим", "Мадрид"],
      "explanation": "Мадрид — столиця Іспанії; Барселона — столиця Каталонії."
    },
    "q-odd-05": {
      "prompt": "Яке з цих тіл НЕ є планетою?",
      "options": ["Місяць", "Меркурій", "Венера", "Марс"],
      "explanation": "Місяць — це природний супутник Землі."
    },
    "q-logic-01": {
      "prompt": "Яке число наступне: 2, 4, 8, 16, …?",
      "options": ["32", "24", "30", "18"],
      "explanation": "Кожне наступне число вдвічі більше за попереднє."
    },
    "q-logic-02": {
      "prompt": "Яке число наступне: 1, 1, 2, 3, 5, 8, …?",
      "options": ["13", "11", "12", "15"],
      "explanation": "Послідовність Фібоначчі: 5 + 8 = 13."
    },
    "q-logic-03": {
      "prompt": "Якщо 3 коти ловлять 3 мишей за 3 хвилини, скільки котів потрібно, щоб зловити 100 мишей за 100 хвилин?",
      "options": ["3", "100", "33", "9"],
      "explanation": "Кожен кіт ловить 1 мишу за 3 хвилини, тому 3 коти зловлять 100 мишей за 100 хвилин."
    },
    "q-logic-04": {
      "prompt": "Бита та м'яч разом коштують $1,10. Бита на $1,00 дорожча за м'яч. Скільки коштує м'яч?",
      "options": ["$0,05", "$0,10", "$0,15", "$0,01"],
      "explanation": "М'яч = $0,05, бита = $1,05, разом = $1,10."
    },
    "q-logic-05": {
      "prompt": "Скільки буде 15% від 200?",
      "options": ["30", "15", "20", "35"],
      "explanation": "10% від 200 — це 20, плюс 5% (10) дорівнює 30."
    },
    "q-logic-06": {
      "prompt": "Анна старша за Бена. Бен старший за Кару. Хто наймолодший?",
      "options": ["Кара", "Анна", "Бен", "Неможливо визначити"],
      "explanation": "Анна > Бен > Кара, отже Кара наймолодша."
    },
    "q-logic-07": {
      "prompt": "Який кут утворюють годинна та хвилинна стрілки рівно о 3:00?",
      "options": ["90°", "45°", "180°", "60°"],
      "explanation": "Чверть повного кола (360°) становить 90°."
    },
    "q-logic-08": {
      "prompt": "Яке число наступне: 3, 6, 11, 18, 27, …?",
      "options": ["38", "36", "35", "40"],
      "explanation": "Різниця між числами зростає на 2: +3, +5, +7, +9, +11."
    },
    "q-logic-09": {
      "prompt": "Скільки хвилин у 2,5 годинах?",
      "options": ["150", "125", "250", "130"],
      "explanation": "2,5 × 60 = 150 хвилин."
    },
    "q-logic-10": {
      "prompt": "Годинник показує 9:00. Який час він покаже через 15 годин?",
      "options": ["12:00", "6:00", "3:00", "9:00"],
      "explanation": "Через 12 годин знову буде 9:00, плюс ще 3 години — це 12:00."
    }
  }
}
