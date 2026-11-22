# -*- coding: utf-8 -*-
"""
Translations for the 30 seed questions in:
- sv (Swedish)
- da (Danish)
- nb (Norwegian Bokmål)
- fi (Finnish)
- et (Estonian)
- lt (Lithuanian)
- lv (Latvian)
- hu (Hungarian)
"""

DATA = {
  "sv": {
    "q-mcq-01": {
      "prompt": "Vilken planet har det kortaste året?",
      "options": ["Merkurius", "Venus", "Mars", "Jorden"],
      "explanation": "Merkurius kretsar runt solen på bara 88 jorddygn."
    },
    "q-mcq-02": {
      "prompt": "Vad är Australiens huvudstad?",
      "options": ["Canberra", "Sydney", "Melbourne", "Perth"],
      "explanation": "Canberra valdes 1908 som en kompromiss mellan Sydney och Melbourne."
    },
    "q-mcq-03": {
      "prompt": "Vilket grundämne har den kemiska beteckningen \"Fe\"?",
      "options": ["Järn", "Fluor", "Bly", "Tenn"],
      "explanation": "Fe kommer från det latinska ordet ferrum, som betyder järn."
    },
    "q-mcq-04": {
      "prompt": "Vilket år föll Berlinmuren?",
      "options": ["1989", "1991", "1985", "1979"],
      "explanation": "Berlinmuren föll den 9 november 1989."
    },
    "q-mcq-05": {
      "prompt": "Vilken är jordens största ocean?",
      "options": ["Stilla havet", "Atlanten", "Indiska oceanen", "Norra ishavet"],
      "explanation": "Stilla havet täcker mer än 30 % av jordens yta."
    },
    "q-mcq-06": {
      "prompt": "Vilket land gav Frihetsgudinnan till USA?",
      "options": ["Frankrike", "Storbritannien", "Spanien", "Italien"],
      "explanation": "Frankrike gav Frihetsgudinnan som gåva till USA år 1886."
    },
    "q-mcq-07": {
      "prompt": "Vem målade Mona Lisa?",
      "options": ["Leonardo da Vinci", "Michelangelo", "Rafael", "Botticelli"],
      "explanation": "Leonardo da Vinci målade Mona Lisa i början av 1500-talet."
    },
    "q-mcq-08": {
      "prompt": "Vilken är Sydamerikas längsta flod?",
      "options": ["Amazonfloden", "Paraná", "Orinoco", "São Francisco"],
      "explanation": "Amazonfloden sträcker sig ungefär 6 400 km genom Sydamerika."
    },
    "q-mcq-09": {
      "prompt": "Vilken gas tar växter främst upp ur luften för fotosyntes?",
      "options": ["Koldioxid", "Syre", "Kväve", "Helium"],
      "explanation": "Växter tar upp CO2 och avger syre under fotosyntesen."
    },
    "q-mcq-10": {
      "prompt": "Vilket är det minsta primtalet?",
      "options": ["2", "1", "3", "0"],
      "explanation": "2 är det minsta primtalet och det enda jämna primtalet."
    },
    "q-order-01": {
      "prompt": "Sortera planeterna efter avstånd från solen, närmast först:",
      "options": ["Venus", "Jorden", "Mars", "Jupiter"],
      "explanation": "Från solen och utåt: Merkurius, Venus, Jorden, Mars, Jupiter."
    },
    "q-order-02": {
      "prompt": "Sortera händelserna från tidigast till senast:",
      "options": ["Första månlandningen", "Berlinmurens fall", "Euromynt införs", "Första iPhone lanseras"],
      "explanation": "1969 → 1989 → 2002 → 2007."
    },
    "q-order-03": {
      "prompt": "Sortera från minst till störst:",
      "options": ["Byte", "Kilobyte", "Megabyte", "Gigabyte"],
      "explanation": "Varje enhet ökar med en faktor 1 000 (eller 1 024 binärt)."
    },
    "q-order-04": {
      "prompt": "Sortera länderna efter landyta, störst först:",
      "options": ["Ryssland", "Kanada", "Brasilien", "Australien"],
      "explanation": "Ryssland > Kanada > Brasilien > Australien efter landyta."
    },
    "q-order-05": {
      "prompt": "Sortera talen från minst till störst:",
      "options": ["0,5", "2/3", "0,7", "3/4"],
      "explanation": "0,5 < 0,666… (2/3) < 0,7 < 0,75 (3/4)."
    },
    "q-odd-01": {
      "prompt": "Vilket av följande är INTE ett däggdjur?",
      "options": ["Haj", "Delfin", "Fladdermus", "Val"],
      "explanation": "Hajar är fiskar; delfiner, fladdermöss och valar är däggdjur."
    },
    "q-odd-02": {
      "prompt": "Vilket av följande är INTE ett primtal?",
      "options": ["15", "7", "11", "13"],
      "explanation": "15 kan delas med 3 och 5 (15 = 3 × 5)."
    },
    "q-odd-03": {
      "prompt": "Vilket av följande är INTE ett stränginstrument?",
      "options": ["Trumpet", "Fiol", "Cello", "Viola"],
      "explanation": "Trumpeten är ett bleckblåsinstrument."
    },
    "q-odd-04": {
      "prompt": "Vilken av följande är INTE en nationell huvudstad?",
      "options": ["Barcelona", "Paris", "Rom", "Madrid"],
      "explanation": "Madrid är Spaniens huvudstad; Barcelona är regionhuvudstad i Katalonien."
    },
    "q-odd-05": {
      "prompt": "Vilken av följande är INTE en planet?",
      "options": ["Månen", "Merkurius", "Venus", "Mars"],
      "explanation": "Månen är jordens naturliga satellit."
    },
    "q-logic-01": {
      "prompt": "Vad kommer härnäst: 2, 4, 8, 16, …?",
      "options": ["32", "24", "30", "18"],
      "explanation": "Varje tal är det dubbla av föregående tal."
    },
    "q-logic-02": {
      "prompt": "Vad kommer härnäst: 1, 1, 2, 3, 5, 8, …?",
      "options": ["13", "11", "12", "15"],
      "explanation": "Fibonaccital: 5 + 8 = 13."
    },
    "q-logic-03": {
      "prompt": "Om 3 katter fångar 3 möss på 3 minuter, hur många katter behövs för att fånga 100 möss på 100 minuter?",
      "options": ["3", "100", "33", "9"],
      "explanation": "Varje katt tar 1 mus på 3 minuter, så 3 katter fångar 100 möss på 100 minuter."
    },
    "q-logic-04": {
      "prompt": "Ett slagträ och en boll kostar 1,10 $ totalt. Slagträt kostar 1,00 $ mer än bollen. Vad kostar bollen?",
      "options": ["0,05 $", "0,10 $", "0,15 $", "0,01 $"],
      "explanation": "Boll = 0,05 $, slagträ = 1,05 $, totalt = 1,10 $."
    },
    "q-logic-05": {
      "prompt": "Vad är 15 % av 200?",
      "options": ["30", "15", "20", "35"],
      "explanation": "10 % av 200 är 20, plus 5 % (10) blir 30."
    },
    "q-logic-06": {
      "prompt": "Ana är äldre än Ben. Ben är äldre än Cara. Vem är yngst?",
      "options": ["Cara", "Ana", "Ben", "Går inte att avgöra"],
      "explanation": "Ana > Ben > Cara, alltså är Cara yngst."
    },
    "q-logic-07": {
      "prompt": "Vilken vinkel bildar visarna klockan exakt 3:00?",
      "options": ["90°", "45°", "180°", "60°"],
      "explanation": "En fjärdedel av en cirkel på 360° är 90°."
    },
    "q-logic-08": {
      "prompt": "Vad kommer härnäst: 3, 6, 11, 18, 27, …?",
      "options": ["38", "36", "35", "40"],
      "explanation": "Skillnaden mellan talen ökar med 2 för varje steg (+3, +5, +7, +9, +11)."
    },
    "q-logic-09": {
      "prompt": "Hur många minuter är det på 2,5 timmar?",
      "options": ["150", "125", "250", "130"],
      "explanation": "2,5 × 60 = 150 minuter."
    },
    "q-logic-10": {
      "prompt": "Klockan är 9:00. Vad visar den 15 timmar senare?",
      "options": ["12:00", "6:00", "3:00", "9:00"],
      "explanation": "Efter 12 timmar är klockan 9:00 igen, plus 3 timmar ger 12:00."
    }
  },
  "da": {
    "q-mcq-01": {
      "prompt": "Hvilken planet har det korteste år?",
      "options": ["Merkur", "Venus", "Mars", "Jorden"],
      "explanation": "Merkur kredser om solen på kun 88 jorddøgn."
    },
    "q-mcq-02": {
      "prompt": "Hvad er Australiens hovedstad?",
      "options": ["Canberra", "Sydney", "Melbourne", "Perth"],
      "explanation": "Canberra blev valgt i 1908 som et kompromis mellem Sydney og Melbourne."
    },
    "q-mcq-03": {
      "prompt": "Hvilket grundstof har det kemiske symbol \"Fe\"?",
      "options": ["Jern", "Fluor", "Bly", "Tin"],
      "explanation": "Fe kommer fra det latinske ord ferrum, der betyder jern."
    },
    "q-mcq-04": {
      "prompt": "Hvilket år faldt Berlinmuren?",
      "options": ["1989", "1991", "1985", "1979"],
      "explanation": "Berlinmuren faldt den 9. november 1989."
    },
    "q-mcq-05": {
      "prompt": "Hvad er Jordens største ocean?",
      "options": ["Stillehavet", "Atlanten", "Det Indiske Ocean", "Det Nordlige Ishav"],
      "explanation": "Stillehavet dækker mere end 30 % af Jordens overflade."
    },
    "q-mcq-06": {
      "prompt": "Hvilket land forærede Frihedsgudinden til USA?",
      "options": ["Frankrig", "Storbritannien", "Spanien", "Italien"],
      "explanation": "Frankrig forærede Frihedsgudinden til USA i 1886."
    },
    "q-mcq-07": {
      "prompt": "Hvem malede Mona Lisa?",
      "options": ["Leonardo da Vinci", "Michelangelo", "Rafael", "Botticelli"],
      "explanation": "Leonardo da Vinci malede Mona Lisa i begyndelsen af 1500-tallet."
    },
    "q-mcq-08": {
      "prompt": "Hvad er den længste flod i Sydamerika?",
      "options": ["Amazonfloden", "Paraná", "Orinoco", "São Francisco"],
      "explanation": "Amazonfloden strækker sig cirka 6.400 km gennem Sydamerika."
    },
    "q-mcq-09": {
      "prompt": "Hvilken gas optager planter primært fra luften til fotosyntese?",
      "options": ["Kuldioxid", "Ilt", "Kvælstof", "Helium"],
      "explanation": "Planter optager CO2 og frigiver ilt under fotosyntesen."
    },
    "q-mcq-10": {
      "prompt": "Hvad er det mindste primtal?",
      "options": ["2", "1", "3", "0"],
      "explanation": "2 er det mindste primtal og det eneste lige primtal."
    },
    "q-order-01": {
      "prompt": "Sortér disse planeter efter afstand fra solen, nærmest først:",
      "options": ["Venus", "Jorden", "Mars", "Jupiter"],
      "explanation": "Fra solen og udefter: Merkur, Venus, Jorden, Mars, Jupiter."
    },
    "q-order-02": {
      "prompt": "Sortér disse begivenheder fra tidligst til senest:",
      "options": ["Første månelanding", "Berlinmurens fald", "Euromønter tages i brug", "Første iPhone lanceres"],
      "explanation": "1969 → 1989 → 2002 → 2007."
    },
    "q-order-03": {
      "prompt": "Sortér fra mindst til størst:",
      "options": ["Byte", "Kilobyte", "Megabyte", "Gigabyte"],
      "explanation": "Hver enhed ganges med 1.000 (eller 1.024 binært)."
    },
    "q-order-04": {
      "prompt": "Sortér disse lande efter areal, største først:",
      "options": ["Rusland", "Canada", "Brasilien", "Australien"],
      "explanation": "Rusland > Canada > Brasilien > Australien målt på landareal."
    },
    "q-order-05": {
      "prompt": "Sortér disse tal fra mindst til størst:",
      "options": ["0,5", "2/3", "0,7", "3/4"],
      "explanation": "0,5 < 0,666… (2/3) < 0,7 < 0,75 (3/4)."
    },
    "q-odd-01": {
      "prompt": "Hvilket af følgende er IKKE et pattedyr?",
      "options": ["Haj", "Delfin", "Flagermus", "Hval"],
      "explanation": "Hajer er fisk; delfiner, flagermus og hvaler er pattedyr."
    },
    "q-odd-02": {
      "prompt": "Hvilket af følgende er IKKE et primtal?",
      "options": ["15", "7", "11", "13"],
      "explanation": "15 kan deles med 3 og 5 (15 = 3 × 5)."
    },
    "q-odd-03": {
      "prompt": "Hvilket af følgende er IKKE et strengeinstrument?",
      "options": ["Trompet", "Violin", "Cello", "Bratsch"],
      "explanation": "En trompet er et messingblæseinstrument."
    },
    "q-odd-04": {
      "prompt": "Hvilken af følgende er IKKE en national hovedstad?",
      "options": ["Barcelona", "Paris", "Rom", "Madrid"],
      "explanation": "Madrid er Spaniens hovedstad; Barcelona er regionshovedstad i Catalonien."
    },
    "q-odd-05": {
      "prompt": "Hvilken af følgende er IKKE en planet?",
      "options": ["Månen", "Merkur", "Venus", "Mars"],
      "explanation": "Månen er Jordens naturlige satellit."
    },
    "q-logic-01": {
      "prompt": "Hvilket tal kommer derefter: 2, 4, 8, 16, …?",
      "options": ["32", "24", "30", "18"],
      "explanation": "Hvert tal fordobler det foregående."
    },
    "q-logic-02": {
      "prompt": "Hvilket tal kommer derefter: 1, 1, 2, 3, 5, 8, …?",
      "options": ["13", "11", "12", "15"],
      "explanation": "Fibonacci-følgen: 5 + 8 = 13."
    },
    "q-logic-03": {
      "prompt": "Hvis 3 katte fanger 3 mus på 3 minutter, hvor mange katte skal der til at fange 100 mus på 100 minutter?",
      "options": ["3", "100", "33", "9"],
      "explanation": "Hver kat fanger 1 mus hvert 3. minut, så 3 katte fanger 100 mus på 100 minutter."
    },
    "q-logic-04": {
      "prompt": "Et bat og en bold koster 1,10 $ i alt. Battet koster 1,00 $ mere end bolden. Hvad koster bolden?",
      "options": ["0,05 $", "0,10 $", "0,15 $", "0,01 $"],
      "explanation": "Bold = 0,05 $, bat = 1,05 $, i alt = 1,10 $."
    },
    "q-logic-05": {
      "prompt": "Hvad er 15 % af 200?",
      "options": ["30", "15", "20", "35"],
      "explanation": "10 % af 200 er 20, plus 5 % (10) giver 30."
    },
    "q-logic-06": {
      "prompt": "Ana er ældre end Ben. Ben er ældre end Cara. Hvem er yngst?",
      "options": ["Cara", "Ana", "Ben", "Kan ikke afgøres"],
      "explanation": "Ana > Ben > Cara, så Cara er yngst."
    },
    "q-logic-07": {
      "prompt": "Hvilken vinkel danner viserne, når klokken er præcis 3:00?",
      "options": ["90°", "45°", "180°", "60°"],
      "explanation": "En fjerdedel af en cirkel på 360° er 90°."
    },
    "q-logic-08": {
      "prompt": "Hvilket tal kommer derefter: 3, 6, 11, 18, 27, …?",
      "options": ["38", "36", "35", "40"],
      "explanation": "Forskellen vokser med 2 for hvert trin (+3, +5, +7, +9, +11)."
    },
    "q-logic-09": {
      "prompt": "Hvor mange minutter er der i 2,5 timer?",
      "options": ["150", "125", "250", "130"],
      "explanation": "2,5 × 60 = 150 minutter."
    },
    "q-logic-10": {
      "prompt": "Et ur viser 9:00. Hvad viser det 15 timer senere?",
      "options": ["12:00", "6:00", "3:00", "9:00"],
      "explanation": "Efter 12 timer viser det 9:00 igen, plus 3 timer giver 12:00."
    }
  },
  "nb": {
    "q-mcq-01": {
      "prompt": "Hvilken planet har det korteste året?",
      "options": ["Merkur", "Venus", "Mars", "Jorden"],
      "explanation": "Merkur går i bane rundt solen på bare 88 jorddøgn."
    },
    "q-mcq-02": {
      "prompt": "Hva er hovedstaden i Australia?",
      "options": ["Canberra", "Sydney", "Melbourne", "Perth"],
      "explanation": "Canberra ble valgt i 1908 som et kompromiss mellom Sydney og Melbourne."
    },
    "q-mcq-03": {
      "prompt": "Hvilket grunnstoff har kjemisk symbol \"Fe\"?",
      "options": ["Jern", "Fluor", "Bly", "Tinn"],
      "explanation": "Fe kommer fra det latinske ordet ferrum, som betyr jern."
    },
    "q-mcq-04": {
      "prompt": "Hvilket år falt Berlinmuren?",
      "options": ["1989", "1991", "1985", "1979"],
      "explanation": "Berlinmuren falt 9. november 1989."
    },
    "q-mcq-05": {
      "prompt": "Hva er jordens største hav?",
      "options": ["Stillehavet", "Atlanterhavet", "Det indiske hav", "Nordishavet"],
      "explanation": "Stillehavet dekker mer enn 30 % av jordens overflate."
    },
    "q-mcq-06": {
      "prompt": "Hvilket land ga Frihetsgudinnen i gave til USA?",
      "options": ["Frankrike", "Storbritannia", "Spania", "Italia"],
      "explanation": "Frankrike ga Frihetsgudinnen i gave til USA i 1886."
    },
    "q-mcq-07": {
      "prompt": "Hvem malte Mona Lisa?",
      "options": ["Leonardo da Vinci", "Michelangelo", "Rafael", "Botticelli"],
      "explanation": "Leonardo da Vinci malte Mona Lisa tidlig på 1500-tallet."
    },
    "q-mcq-08": {
      "prompt": "Hva er den lengste elven i Sør-Amerika?",
      "options": ["Amazonaselven", "Paraná", "Orinoco", "São Francisco"],
      "explanation": "Amazonaselven strekker seg omtrent 6 400 km gjennom Sør-Amerika."
    },
    "q-mcq-09": {
      "prompt": "Hvilken gass tar planter hovedsakelig opp fra luften til fotosyntesen?",
      "options": ["Karbondioksid", "Oksygen", "Nitrogen", "Helium"],
      "explanation": "Planter tar opp CO2 og frigjør oksygen under fotosyntesen."
    },
    "q-mcq-10": {
      "prompt": "Hva er det minste primtallet?",
      "options": ["2", "1", "3", "0"],
      "explanation": "2 er det minste primtallet og det eneste partallet blant primtallene."
    },
    "q-order-01": {
      "prompt": "Sorter disse planetene etter avstand fra solen, nærmest først:",
      "options": ["Venus", "Jorden", "Mars", "Jupiter"],
      "explanation": "Fra solen og utover: Merkur, Venus, Jorden, Mars, Jupiter."
    },
    "q-order-02": {
      "prompt": "Sorter disse hendelsene fra tidligst til senest:",
      "options": ["Første månelanding", "Berlinmurens fall", "Euromynter tas i bruk", "Første iPhone lanseres"],
      "explanation": "1969 → 1989 → 2002 → 2007."
    },
    "q-order-03": {
      "prompt": "Sorter fra minst til størst:",
      "options": ["Byte", "Kilobyte", "Megabyte", "Gigabyte"],
      "explanation": "Hver enhet øker med 1 000 (eller 1 024 binært)."
    },
    "q-order-04": {
      "prompt": "Sorter disse landene etter landareal, størst først:",
      "options": ["Russland", "Canada", "Brasil", "Australia"],
      "explanation": "Russland > Canada > Brasil > Australia etter landareal."
    },
    "q-order-05": {
      "prompt": "Sorter disse tallene fra minst til størst:",
      "options": ["0,5", "2/3", "0,7", "3/4"],
      "explanation": "0,5 < 0,666… (2/3) < 0,7 < 0,75 (3/4)."
    },
    "q-odd-01": {
      "prompt": "Hvilket av disse er IKKE et pattedyr?",
      "options": ["Hai", "Delfin", "Flaggermus", "Hval"],
      "explanation": "Haier er fisker; delfiner, flaggermus og hvaler er pattedyr."
    },
    "q-odd-02": {
      "prompt": "Hvilket av disse er IKKE et primtall?",
      "options": ["15", "7", "11", "13"],
      "explanation": "15 er delelig med 3 og 5 (15 = 3 × 5)."
    },
    "q-odd-03": {
      "prompt": "Hvilket av disse er IKKE et strengeinstrument?",
      "options": ["Trompet", "Fiolin", "Cello", "Bratsj"],
      "explanation": "Trompet er et messingblåseinstrument."
    },
    "q-odd-04": {
      "prompt": "Hvilken av disse er IKKE en nasjonal hovedstad?",
      "options": ["Barcelona", "Paris", "Roma", "Madrid"],
      "explanation": "Madrid er Spanias hovedstad; Barcelona er hovedstaden i Catalonia."
    },
    "q-odd-05": {
      "prompt": "Hvilken av disse er IKKE en planet?",
      "options": ["Månen", "Merkur", "Venus", "Mars"],
      "explanation": "Månen er jordens naturlige satellitt."
    },
    "q-logic-01": {
      "prompt": "Hvilket tall kommer neste: 2, 4, 8, 16, …?",
      "options": ["32", "24", "30", "18"],
      "explanation": "Hvert tall er det dobbelte av det forrige."
    },
    "q-logic-02": {
      "prompt": "Hvilket tall kommer neste: 1, 1, 2, 3, 5, 8, …?",
      "options": ["13", "11", "12", "15"],
      "explanation": "Fibonacci-følgen: 5 + 8 = 13."
    },
    "q-logic-03": {
      "prompt": "Hvis 3 katter fanger 3 mus på 3 minutter, hvor mange katter trengs for å fange 100 mus på 100 minutter?",
      "options": ["3", "100", "33", "9"],
      "explanation": "Hver katt tar 1 mus hvert 3. minutt, så 3 katter fanger 100 mus på 100 minutter."
    },
    "q-logic-04": {
      "prompt": "Et balltre og en ball koster 1,10 $ totalt. Balltreet koster 1,00 $ mer enn ballen. Hva koster ballen?",
      "options": ["0,05 $", "0,10 $", "0,15 $", "0,01 $"],
      "explanation": "Ball = 0,05 $, balltre = 1,05 $, totalt = 1,10 $."
    },
    "q-logic-05": {
      "prompt": "Hva er 15 % av 200?",
      "options": ["30", "15", "20", "35"],
      "explanation": "10 % av 200 er 20, pluss 5 % (10) gir 30."
    },
    "q-logic-06": {
      "prompt": "Ana er eldre enn Ben. Ben er eldre enn Cara. Hvem er yngst?",
      "options": ["Cara", "Ana", "Ben", "Kan ikke avgjøres"],
      "explanation": "Ana > Ben > Cara, altså er Cara yngst."
    },
    "q-logic-07": {
      "prompt": "Hvilken vinkel danner viserne når klokken er nøyaktig 3:00?",
      "options": ["90°", "45°", "180°", "60°"],
      "explanation": "En fjerdedel av en sirkel på 360° er 90°."
    },
    "q-logic-08": {
      "prompt": "Hvilket tall kommer neste: 3, 6, 11, 18, 27, …?",
      "options": ["38", "36", "35", "40"],
      "explanation": "Differansene øker med 2 for hvert trinn (+3, +5, +7, +9, +11)."
    },
    "q-logic-09": {
      "prompt": "Hvor mange minutter er det i 2,5 timer?",
      "options": ["150", "125", "250", "130"],
      "explanation": "2,5 × 60 = 150 minutter."
    },
    "q-logic-10": {
      "prompt": "En klokke viser 9:00. Hva viser den 15 timer senere?",
      "options": ["12:00", "6:00", "3:00", "9:00"],
      "explanation": "Etter 12 timer er den 9:00 igjen, pluss 3 timer gir 12:00."
    }
  },
  "fi": {
    "q-mcq-01": {
      "prompt": "Millä planeetalla on lyhyin vuosi?",
      "options": ["Merkurius", "Venus", "Mars", "Maa"],
      "explanation": "Merkurius kiertää Auringon vain 88 Maan vuorokaudessa."
    },
    "q-mcq-02": {
      "prompt": "Mikä on Australian pääkaupunki?",
      "options": ["Canberra", "Sydney", "Melbourne", "Perth"],
      "explanation": "Canberra valittiin vuonna 1908 kompromissina Sydneyn ja Melbournen välillä."
    },
    "q-mcq-03": {
      "prompt": "Minkä alkuaineen kemiallinen merkki on \"Fe\"?",
      "options": ["Rauta", "Fluori", "Lyijy", "Tina"],
      "explanation": "Fe tulee latinan sanasta ferrum, joka tarkoittaa rautaa."
    },
    "q-mcq-04": {
      "prompt": "Minä vuonna Berliinin muuri murtui?",
      "options": ["1989", "1991", "1985", "1979"],
      "explanation": "Berliinin muuri murtui 9. marraskuuta 1989."
    },
    "q-mcq-05": {
      "prompt": "Mikä on maapallon suurin valtameri?",
      "options": ["Tyyni valtameri", "Atlantin valtameri", "Intian valtameri", "Pohjoinen jäämeri"],
      "explanation": "Tyyni valtameri peittää yli 30 % maapallon pinta-alasta."
    },
    "q-mcq-06": {
      "prompt": "Mikä maa lahjoitti Vapaudenpatsaan Yhdysvalloille?",
      "options": ["Ranska", "Yhdistynyt kuningaskunta", "Espanja", "Italia"],
      "explanation": "Ranska lahjoitti Vapaudenpatsaan Yhdysvalloille vuonna 1886."
    },
    "q-mcq-07": {
      "prompt": "Kuka maalasi Mona Lisan?",
      "options": ["Leonardo da Vinci", "Michelangelo", "Raffaello", "Botticelli"],
      "explanation": "Leonardo da Vinci maalasi Mona Lisan 1500-luvun alussa."
    },
    "q-mcq-08": {
      "prompt": "Mikä on Etelä-Amerikan pisin joki?",
      "options": ["Amazon", "Paraná", "Orinoco", "São Francisco"],
      "explanation": "Amazonjoki on noin 6 400 kilometriä pitkä."
    },
    "q-mcq-09": {
      "prompt": "Mitä kaasua kasvit ottavat ilmasta fotosynteesiä varten?",
      "options": ["Hiilidioksidia", "Happea", "Typpeä", "Heliumia"],
      "explanation": "Kasvit sitovat hiilidioksidia ja vapauttavat happea fotosynteesissä."
    },
    "q-mcq-10": {
      "prompt": "Mikä on pienin alkuluku?",
      "options": ["2", "1", "3", "0"],
      "explanation": "2 on pienin alkuluku ja ainoa parillinen alkuluku."
    },
    "q-order-01": {
      "prompt": "Järjestä planeetat etäisyyden mukaan Auringosta, lähin ensin:",
      "options": ["Venus", "Maa", "Mars", "Jupiter"],
      "explanation": "Auringosta ulospäin: Merkurius, Venus, Maa, Mars, Jupiter."
    },
    "q-order-02": {
      "prompt": "Järjestä tapahtumat varhaisimmasta uusimpaan:",
      "options": ["Ensimmäinen kuulento", "Berliinin muurin murtuminen", "Eurokolikot käyttöön", "Ensimmäinen iPhone julkaistaan"],
      "explanation": "1969 → 1989 → 2002 → 2007."
    },
    "q-order-03": {
      "prompt": "Järjestä pienimmästä suurimpaan:",
      "options": ["Tavu", "Kilotavu", "Megatavu", "Gigatavu"],
      "explanation": "Jokainen yksikkö on 1 000-kertainen (tai binäärisenä 1 024)."
    },
    "q-order-04": {
      "prompt": "Järjestä maat pinta-alan mukaan, suurin ensin:",
      "options": ["Venäjä", "Kanada", "Brasilia", "Australia"],
      "explanation": "Venäjä > Kanada > Brasilia > Australia pinta-alan mukaan."
    },
    "q-order-05": {
      "prompt": "Järjestä luvut pienimmästä suurimpaan:",
      "options": ["0,5", "2/3", "0,7", "3/4"],
      "explanation": "0,5 < 0,666… (2/3) < 0,7 < 0,75 (3/4)."
    },
    "q-odd-01": {
      "prompt": "Mikä näistä EI ole nisäkäs?",
      "options": ["Hai", "Delfiini", "Lepakko", "Valas"],
      "explanation": "Hait ovat kaloja; delfiinit, lepakot ja valaat ovat nisäkkäitä."
    },
    "q-odd-02": {
      "prompt": "Mikä näistä EI ole alkuluku?",
      "options": ["15", "7", "11", "13"],
      "explanation": "15 on jaollinen luvuilla 3 ja 5 (15 = 3 × 5)."
    },
    "q-odd-03": {
      "prompt": "Mikä näistä EI ole kielisoitin?",
      "options": ["Trumpetti", "Viulu", "Sello", "Alttoviulu"],
      "explanation": "Trumpetti on vaskipuhallin."
    },
    "q-odd-04": {
      "prompt": "Mikä näistä EI ole valtion pääkaupunki?",
      "options": ["Barcelona", "Pariisi", "Rooma", "Madrid"],
      "explanation": "Madrid on Espanjan pääkaupunki; Barcelona on Katalonian pääkaupunki."
    },
    "q-odd-05": {
      "prompt": "Mikä näistä EI ole planeetta?",
      "options": ["Kuu", "Merkurius", "Venus", "Mars"],
      "explanation": "Kuu on Maan luonnollinen kiertolainen."
    },
    "q-logic-01": {
      "prompt": "Mikä luku tulee seuraavaksi: 2, 4, 8, 16, …?",
      "options": ["32", "24", "30", "18"],
      "explanation": "Jokainen luku on edellisen kaksinkertainen arvo."
    },
    "q-logic-02": {
      "prompt": "Mikä luku tulee seuraavaksi: 1, 1, 2, 3, 5, 8, …?",
      "options": ["13", "11", "12", "15"],
      "explanation": "Fibonaccin lukujono: 5 + 8 = 13."
    },
    "q-logic-03": {
      "prompt": "Jos 3 kissaa nappaa 3 hiirtä 3 minuutissa, montako kissaa tarvitaan nappaamaan 100 hiirtä 100 minuutissa?",
      "options": ["3", "100", "33", "9"],
      "explanation": "Kukin kissa nappaa 1 hiiren 3 minuutissa, joten 3 kissaa riittää."
    },
    "q-logic-04": {
      "prompt": "Maila ja pallo maksavat yhteensä 1,10 $. Maila maksaa 1,00 $ enemmän kuin pallo. Paljonko pallo maksaa?",
      "options": ["0,05 $", "0,10 $", "0,15 $", "0,01 $"],
      "explanation": "Pallo = 0,05 $, maila = 1,05 $, yhteensä = 1,10 $."
    },
    "q-logic-05": {
      "prompt": "Paljonko on 15 % luvusta 200?",
      "options": ["30", "15", "20", "35"],
      "explanation": "10 % luvusta 200 on 20, ja siihen lisättävä 5 % (10) tekee 30."
    },
    "q-logic-06": {
      "prompt": "Ana on vanhempi kuin Ben. Ben on vanhempi kuin Cara. Kuka on nuorin?",
      "options": ["Cara", "Ana", "Ben", "Ei voi tietää"],
      "explanation": "Ana > Ben > Cara, joten Cara on nuorin."
    },
    "q-logic-07": {
      "prompt": "Mikä on kellon viisareiden kulma tasan kello 3:00?",
      "options": ["90°", "45°", "180°", "60°"],
      "explanation": "Neljännes 360 asteen ympyrästä on 90 astetta."
    },
    "q-logic-08": {
      "prompt": "Mikä luku tulee seuraavaksi: 3, 6, 11, 18, 27, …?",
      "options": ["38", "36", "35", "40"],
      "explanation": "Lukujen erotukset kasvavat kahdella (+3, +5, +7, +9, +11)."
    },
    "q-logic-09": {
      "prompt": "Kuinka monta minuuttia on 2,5 tunnissa?",
      "options": ["150", "125", "250", "130"],
      "explanation": "2,5 × 60 = 150 minuuttia."
    },
    "q-logic-10": {
      "prompt": "Kello näyttää 9:00. Mitä se näyttää 15 tuntia myöhemmin?",
      "options": ["12:00", "6:00", "3:00", "9:00"],
      "explanation": "12 tunnin päästä kello on taas 9:00, ja 3 tuntia lisää antaa 12:00."
    }
  },
  "et": {
    "q-mcq-01": {
      "prompt": "Millisel planeedil on kõige lühem aasta?",
      "options": ["Merkuur", "Veenus", "Marss", "Maa"],
      "explanation": "Merkuur teeb tiiru ümber Päikese kõigest 88 Maa ööpäevaga."
    },
    "q-mcq-02": {
      "prompt": "Mis on Austraalia pealinn?",
      "options": ["Canberra", "Sydney", "Melbourne", "Perth"],
      "explanation": "Canberra valiti 1908. aastal kompromissina Sydney ja Melbourne'i vahel."
    },
    "q-mcq-03": {
      "prompt": "Millise keemilise elemendi sümbol on \"Fe\"?",
      "options": ["Raud", "Fluor", "Plii", "Tina"],
      "explanation": "Fe tuleneb ladinakeelsest sõnast ferrum, mis tähendab rauda."
    },
    "q-mcq-04": {
      "prompt": "Mis aastal langes Berliini müür?",
      "options": ["1989", "1991", "1985", "1979"],
      "explanation": "Berliini müür langes 9. novembril 1989."
    },
    "q-mcq-05": {
      "prompt": "Mis on Maa suurim ookean?",
      "options": ["Vaikne ookean", "Atlandi ookean", "India ookean", "Põhja-Jäämeri"],
      "explanation": "Vaikne ookean katab üle 30% Maa pinnast."
    },
    "q-mcq-06": {
      "prompt": "Milline riik kinkis Ameerika Ühendriikidele Vabadussamba?",
      "options": ["Prantsusmaa", "Ühendkuningriik", "Hispaania", "Itaalia"],
      "explanation": "Prantsusmaa kinkis Vabadussamba USA-le 1886. aastal."
    },
    "q-mcq-07": {
      "prompt": "Kes maalis Mona Lisa?",
      "options": ["Leonardo da Vinci", "Michelangelo", "Raffael", "Botticelli"],
      "explanation": "Leonardo da Vinci maalis Mona Lisa 1500. aastate alguses."
    },
    "q-mcq-08": {
      "prompt": "Mis on Lõuna-Ameerika pikim jõgi?",
      "options": ["Amazonas", "Paraná", "Orinoco", "São Francisco"],
      "explanation": "Amazonase jõgi on umbes 6400 km pikkune."
    },
    "q-mcq-09": {
      "prompt": "Millist gaasi seovad taimed fotosünteesiks peamiselt õhust?",
      "options": ["Süsihappegaas", "Hapnik", "Lämmastik", "Heelium"],
      "explanation": "Taimed seovad CO2 ja eraldavad fotosünteesi käigus hapnikku."
    },
    "q-mcq-10": {
      "prompt": "Mis on vähim algarv?",
      "options": ["2", "1", "3", "0"],
      "explanation": "2 on vähim algarv ja ainus paarisalgarv."
    },
    "q-order-01": {
      "prompt": "Järjesta planeedid kauguse järgi Päikesest, alates lähimast:",
      "options": ["Veenus", "Maa", "Marss", "Jupiter"],
      "explanation": "Päikesest väljapoole: Merkuur, Veenus, Maa, Marss, Jupiter."
    },
    "q-order-02": {
      "prompt": "Järjesta need sündmused varaseimast hiliseimani:",
      "options": ["Esimene Kuule maandumine", "Berliini müüri langemine", "Euromüntide käibele tulek", "Esimese iPhone'i esitlus"],
      "explanation": "1969 → 1989 → 2002 → 2007."
    },
    "q-order-03": {
      "prompt": "Järjesta väikseimast suurimani:",
      "options": ["Bait", "Kilobait", "Megabait", "Gigabait"],
      "explanation": "Iga järgmine ühik on 1000 korda suurem (kahendsüsteemis 1024)."
    },
    "q-order-04": {
      "prompt": "Järjesta need riigid pindala järgi, alates suurimast:",
      "options": ["Venemaa", "Kanada", "Brasiilia", "Austraalia"],
      "explanation": "Pindala järgi: Venemaa > Kanada > Brasiilia > Austraalia."
    },
    "q-order-05": {
      "prompt": "Järjesta need arvud väikseimast suurimani:",
      "options": ["0,5", "2/3", "0,7", "3/4"],
      "explanation": "0,5 < 0,666… (2/3) < 0,7 < 0,75 (3/4)."
    },
    "q-odd-01": {
      "prompt": "Milline neist EI OLE imetaja?",
      "options": ["Hai", "Delfiin", "Nahkhiir", "Vaal"],
      "explanation": "Haid on kalad; delfiinid, nahkhiired ja vaalad on imetajad."
    },
    "q-odd-02": {
      "prompt": "Milline neist EI OLE algarv?",
      "options": ["15", "7", "11", "13"],
      "explanation": "15 jagub 3 ja 5-ga (15 = 3 × 5)."
    },
    "q-odd-03": {
      "prompt": "Milline neist EI OLE keelpill?",
      "options": ["Trompet", "Viiul", "Tšello", "Bioola"],
      "explanation": "Trompet on vaskpuhkpill."
    },
    "q-odd-04": {
      "prompt": "Milline neist EI OLE riigi pealinn?",
      "options": ["Barcelona", "Pariis", "Rooma", "Madrid"],
      "explanation": "Madrid on Hispaania pealinn; Barcelona on Kataloonia keskus."
    },
    "q-odd-05": {
      "prompt": "Milline neist EI OLE planeet?",
      "options": ["Kuu", "Merkuur", "Veenus", "Marss"],
      "explanation": "Kuu on Maa looduslik kaaslane."
    },
    "q-logic-01": {
      "prompt": "Mis arv järgneb: 2, 4, 8, 16, …?",
      "options": ["32", "24", "30", "18"],
      "explanation": "Iga arv on eelmisest kaks korda suurem."
    },
    "q-logic-02": {
      "prompt": "Mis arv järgneb: 1, 1, 2, 3, 5, 8, …?",
      "options": ["13", "11", "12", "15"],
      "explanation": "Fibonacci jada: 5 + 8 = 13."
    },
    "q-logic-03": {
      "prompt": "Kui 3 kassi püüavad 3 hiirt 3 minutiga, mitu kassi on vaja 100 hiire püüdmiseks 100 minutiga?",
      "options": ["3", "100", "33", "9"],
      "explanation": "Iga kass püüab 1 hiire 3 minutiga, seega 3 kassi püüavad 100 hiirt 100 minutiga."
    },
    "q-logic-04": {
      "prompt": "Kurikas ja pall maksavad kokku 1,10 $. Kurikas maksab 1,00 $ rohkem kui pall. Kui palju maksab pall?",
      "options": ["0,05 $", "0,10 $", "0,15 $", "0,01 $"],
      "explanation": "Pall = 0,05 $, kurikas = 1,05 $, kokku = 1,10 $."
    },
    "q-logic-05": {
      "prompt": "Kui palju on 15% arvust 200?",
      "options": ["30", "15", "20", "35"],
      "explanation": "10% arvust 200 on 20 ja lisaks 5% (10) teeb kokku 30."
    },
    "q-logic-06": {
      "prompt": "Ana on vanem kui Ben. Ben on vanem kui Cara. Kes on noorim?",
      "options": ["Cara", "Ana", "Ben", "Ei saa kindlaks teha"],
      "explanation": "Ana > Ben > Cara, seega on Cara noorim."
    },
    "q-logic-07": {
      "prompt": "Mis nurga moodustavad kellaosutid täpselt kell 3:00?",
      "options": ["90°", "45°", "180°", "60°"],
      "explanation": "Veerand 360° ringist on 90°."
    },
    "q-logic-08": {
      "prompt": "Mis arv järgneb: 3, 6, 11, 18, 27, …?",
      "options": ["38", "36", "35", "40"],
      "explanation": "Arvude vahed kasvavad 2 võrra (+3, +5, +7, +9, +11)."
    },
    "q-logic-09": {
      "prompt": "Mitu minutit on 2,5 tunnis?",
      "options": ["150", "125", "250", "130"],
      "explanation": "2,5 × 60 = 150 minutit."
    },
    "q-logic-10": {
      "prompt": "Kell näitab 9:00. Mis aega näitab see 15 tundi hiljem?",
      "options": ["12:00", "6:00", "3:00", "9:00"],
      "explanation": "12 tunni pärast on taas 9:00, pluss 3 tundi = 12:00."
    }
  },
  "lt": {
    "q-mcq-01": {
      "prompt": "Kuri planeta turi trumpiausius metus?",
      "options": ["Merkurijus", "Venera", "Marsas", "Žemė"],
      "explanation": "Merkurijus apskrieja Saulę vos per 88 Žemės paras."
    },
    "q-mcq-02": {
      "prompt": "Kokia yra Australijos sostinė?",
      "options": ["Kanbera", "Sidnėjus", "Melburnas", "Pertas"],
      "explanation": "Kanbera buvo pasirinkta 1908 m. kaip kompromisas tarp Sidnėjaus ir Melburno."
    },
    "q-mcq-03": {
      "prompt": "Kurio cheminio elemento simbolis yra „Fe“?",
      "options": ["Geležis", "Fluoras", "Švinas", "Alavas"],
      "explanation": "Fe kilęs iš lotyniško žodžio ferrum, reiškiančio geležį."
    },
    "q-mcq-04": {
      "prompt": "Kuriais metais griuvo Berlyno siena?",
      "options": ["1989", "1991", "1985", "1979"],
      "explanation": "Berlyno siena griuvo 1989 m. lapkričio 9 d."
    },
    "q-mcq-05": {
      "prompt": "Kuris vandenynas yra didžiausias Žemėje?",
      "options": ["Ramusis vandenynas", "Atlanto vandenynas", "Indijos vandenynas", "Arkties vandenynas"],
      "explanation": "Ramusis vandenynas užima daugiau nei 30 % Žemės paviršiaus."
    },
    "q-mcq-06": {
      "prompt": "Kuri šalis padovanojo Laisvės statulą JAV?",
      "options": ["Prancūzija", "Jungtinė Karalystė", "Ispanija", "Italija"],
      "explanation": "Prancūzija padovanojo Laisvės statulą JAV 1886 m."
    },
    "q-mcq-07": {
      "prompt": "Kas nutapė „Moną Lizą“?",
      "options": ["Leonardas da Vinčis", "Mikelandželas", "Rafaelis", "Botičelis"],
      "explanation": "Leonardas da Vinčis nutapė „Moną Lizą“ XVI a. pradžioje."
    },
    "q-mcq-08": {
      "prompt": "Kokia yra ilgiausia Pietų Amerikos upė?",
      "options": ["Amazonė", "Parana", "Orinokas", "San Fransiskas"],
      "explanation": "Amazonės upė driekiasi maždaug 6 400 km Pietų Amerikoje."
    },
    "q-mcq-09": {
      "prompt": "Kokias dujas augalai daugiausia sugeria iš oro fotosintezei?",
      "options": ["Anglies dioksidą", "Deguonį", "Azotą", "Helį"],
      "explanation": "Augalai sugeria CO2 ir fotosintezės metu išskiria deguonį."
    },
    "q-mcq-10": {
      "prompt": "Koks yra mažiausias pirminis skaičius?",
      "options": ["2", "1", "3", "0"],
      "explanation": "2 yra mažiausias pirminis skaičius ir vienintelis lyginis pirminis skaičius."
    },
    "q-order-01": {
      "prompt": "Išrikiuokite planetas pagal atstumą nuo Saulės, pradedant artimiausia:",
      "options": ["Venera", "Žemė", "Marsas", "Jupiteris"],
      "explanation": "Nuo Saulės į išorę: Merkurijus, Venera, Žemė, Marsas, Jupiteris."
    },
    "q-order-02": {
      "prompt": "Išrikiuokite šiuos įvykius nuo ankstyviausio iki vėlyviausio:",
      "options": ["Pirmasis nusileidimas Mėnulyje", "Berlyno sienos griūtis", "Eurų monetos apyvartoje", "Pirmojo „iPhone“ pasirodymas"],
      "explanation": "1969 → 1989 → 2002 → 2007."
    },
    "q-order-03": {
      "prompt": "Išrikiuokite nuo mažiausio iki didžiausio:",
      "options": ["Baitas", "Kilobaitas", "Megabaitas", "Gigabaitas"],
      "explanation": "Kiekvienas vienetas didėja 1 000 kartų (arba 1 024 dvejetainėje sistemoje)."
    },
    "q-order-04": {
      "prompt": "Išrikiuokite šalis pagal sausumos plotą, pradedant didžiausia:",
      "options": ["Rusija", "Kanada", "Brazilija", "Australija"],
      "explanation": "Pagal plotą: Rusija > Kanada > Brazilija > Australija."
    },
    "q-order-05": {
      "prompt": "Išrikiuokite šiuos skaičius nuo mažiausio iki didžiausio:",
      "options": ["0,5", "2/3", "0,7", "3/4"],
      "explanation": "0,5 < 0,666… (2/3) < 0,7 < 0,75 (3/4)."
    },
    "q-odd-01": {
      "prompt": "Kuris iš šių gyvūnų NĖRA žinduolis?",
      "options": ["Ryklys", "Delfinas", "Šikšnosparnis", "Banginis"],
      "explanation": "Rykliai yra žuvys; delfinai, šikšnosparniai ir banginiai – žinduoliai."
    },
    "q-odd-02": {
      "prompt": "Kuris iš šių skaičių NĖRA pirminis?",
      "options": ["15", "7", "11", "13"],
      "explanation": "15 dalijasi iš 3 ir 5 (15 = 3 × 5)."
    },
    "q-odd-03": {
      "prompt": "Kuris iš šių instrumentų NĖRA styginis?",
      "options": ["Trimitas", "Smuikas", "Violončelė", "Altas"],
      "explanation": "Trimitas yra varinis pučiamasis instrumentas."
    },
    "q-odd-04": {
      "prompt": "Kuris iš šių miestų NĖRA šalies sostinė?",
      "options": ["Barselona", "Paryžius", "Roma", "Madridas"],
      "explanation": "Madridas yra Ispanijos sostinė; Barselona yra Katalonijos sostinė."
    },
    "q-odd-05": {
      "prompt": "Kuris iš šių objektų NĖRA planeta?",
      "options": ["Mėnulis", "Merkurijus", "Venera", "Marsas"],
      "explanation": "Mėnulis yra gamtinis Žemės palydovas."
    },
    "q-logic-01": {
      "prompt": "Koks skaičius eina toliau: 2, 4, 8, 16, …?",
      "options": ["32", "24", "30", "18"],
      "explanation": "Kiekvienas skaičius yra dvigubai didesnis už ankstesnįjį."
    },
    "q-logic-02": {
      "prompt": "Koks skaičius eina toliau: 1, 1, 2, 3, 5, 8, …?",
      "options": ["13", "11", "12", "15"],
      "explanation": "Fibonačio seka: 5 + 8 = 13."
    },
    "q-logic-03": {
      "prompt": "Jei 3 katės sugauna 3 peles per 3 minutes, kiek kačių reikia sugauti 100 pelių per 100 minučių?",
      "options": ["3", "100", "33", "9"],
      "explanation": "Kiekviena katė sugauna po 1 pelę kas 3 minutes, tad 3 katės sugaus 100 pelių per 100 minučių."
    },
    "q-logic-04": {
      "prompt": "Lazda ir kamuoliukas kartu kainuoja 1,10 $. Lazda kainuoja 1,00 $ daugiau nei kamuoliukas. Kiek kainuoja kamuoliukas?",
      "options": ["0,05 $", "0,10 $", "0,15 $", "0,01 $"],
      "explanation": "Kamuoliukas = 0,05 $, lazda = 1,05 $, iš viso = 1,10 $."
    },
    "q-logic-05": {
      "prompt": "Kiek yra 15 % nuo 200?",
      "options": ["30", "15", "20", "35"],
      "explanation": "10 % nuo 200 yra 20, o pridėjus 5 % (10) gaunama 30."
    },
    "q-logic-06": {
      "prompt": "Ana yra vyresnė už Beną. Benas yra vyresnis už Karą. Kas yra jauniausias?",
      "options": ["Kara", "Ana", "Benas", "Neįmanoma nustatyti"],
      "explanation": "Ana > Benas > Kara, todėl Kara yra jauniausia."
    },
    "q-logic-07": {
      "prompt": "Kokį kampą sudaro laikrodžio rodyklės lygiai 3:00 valandą?",
      "options": ["90°", "45°", "180°", "60°"],
      "explanation": "Ketvirtadalis 360° apskritimo yra 90°."
    },
    "q-logic-08": {
      "prompt": "Koks skaičius eina toliau: 3, 6, 11, 18, 27, …?",
      "options": ["38", "36", "35", "40"],
      "explanation": "Skirtumai didėja po 2 kiekviename žingsnyje (+3, +5, +7, +9, +11)."
    },
    "q-logic-09": {
      "prompt": "Kiek minučių yra 2,5 valandos?",
      "options": ["150", "125", "250", "130"],
      "explanation": "2,5 × 60 = 150 minučių."
    },
    "q-logic-10": {
      "prompt": "Laikrodis rodo 9:00. Ką jis rodys po 15 valandų?",
      "options": ["12:00", "6:00", "3:00", "9:00"],
      "explanation": "Po 12 valandų vėl bus 9:00, pridėjus dar 3 valandas = 12:00."
    }
  },
  "lv": {
    "q-mcq-01": {
      "prompt": "Kurai planētai ir visīsākais gads?",
      "options": ["Merkurs", "Venera", "Marss", "Zeme"],
      "explanation": "Merkurs apriņķo Sauli vien 88 Zemes dienās."
    },
    "q-mcq-02": {
      "prompt": "Kura ir Austrālijas galvaspilsēta?",
      "options": ["Kanbera", "Sidneja", "Melburna", "Pērta"],
      "explanation": "Kanbera tika izvēlēta 1908. gadā kā kompromiss starp Sidneju un Melburnu."
    },
    "q-mcq-03": {
      "prompt": "Kura ķīmiskā elementa simbols ir \"Fe\"?",
      "options": ["Dzelzs", "Fluors", "Svins", "Alva"],
      "explanation": "Fe cēlies no latīņu vārda ferrum, kas nozīmē dzelzs."
    },
    "q-mcq-04": {
      "prompt": "Kurā gadā krita Berlīnes mūris?",
      "options": ["1989", "1991", "1985", "1979"],
      "explanation": "Berlīnes mūris krita 1989. gada 9. novembrī."
    },
    "q-mcq-05": {
      "prompt": "Kurš ir lielākais okeāns uz Zemes?",
      "options": ["Klusais okeāns", "Atlantijas okeāns", "Indijas okeāns", "Ziemeļu Ledus okeāns"],
      "explanation": "Klusais okeāns aizņem vairāk nekā 30 % no Zemes virsmas."
    },
    "q-mcq-06": {
      "prompt": "Kura valsts uzdāvināja Brīvības statuju ASV?",
      "options": ["Francija", "Apvienotā Karaliste", "Spānija", "Itālija"],
      "explanation": "Francija uzdāvināja Brīvības statuju ASV 1886. gadā."
    },
    "q-mcq-07": {
      "prompt": "Kurš uzgleznoja Monu Lizu?",
      "options": ["Leonardo da Vinči", "Mikelandželo", "Rafaēls", "Botičelli"],
      "explanation": "Leonardo da Vinči uzgleznoja Monu Lizu 16. gadsimta sākumā."
    },
    "q-mcq-08": {
      "prompt": "Kura ir garākā upe Dienvidamerikā?",
      "options": ["Amazone", "Parana", "Orinoko", "Sanfransisku"],
      "explanation": "Amazones upe stiepjas aptuveni 6 400 km garumā Dienvidamerikā."
    },
    "q-mcq-09": {
      "prompt": "Kādu gāzi augi fotosintēzei galvenokārt uzņem no gaisa?",
      "options": ["Oglekļa dioksīdu", "Skābekli", "Slāpekli", "Hēliju"],
      "explanation": "Augi uzņem CO2 un fotosintēzes laikā izdala skābekli."
    },
    "q-mcq-10": {
      "prompt": "Kāds ir mazākais pirmskaitlis?",
      "options": ["2", "1", "3", "0"],
      "explanation": "2 ir mazākais pirmskaitlis un vienīgais pāra pirmskaitlis."
    },
    "q-order-01": {
      "prompt": "Sakārto šīs planētas pēc attāluma no Saules, sākot ar tuvāko:",
      "options": ["Venera", "Zeme", "Marss", "Jupiters"],
      "explanation": "No Saules virzienā uz āru: Merkurs, Venera, Zeme, Marss, Jupiters."
    },
    "q-order-02": {
      "prompt": "Sakārto šos notikumus secībā no agrākā līdz vēlākajam:",
      "options": ["Pirmā nolaišanās uz Mēness", "Berlīnes mūra krišana", "Eiro monētu laišana apgrozībā", "Pirmā iPhone iznākšana"],
      "explanation": "1969 → 1989 → 2002 → 2007."
    },
    "q-order-03": {
      "prompt": "Sakārto no mazākā uz lielāko:",
      "options": ["Baits", "Kilobaits", "Megabaits", "Gigabaits"],
      "explanation": "Katra mērvienība pieaug 1 000 reižu (vai 1 024 binārajā sistēmā)."
    },
    "q-order-04": {
      "prompt": "Sakārto šīs valstis pēc sauszemes platības, sākot ar lielāko:",
      "options": ["Krievija", "Kanāda", "Brazīlija", "Austrālija"],
      "explanation": "Pēc platības: Krievija > Kanāda > Brazīlija > Austrālija."
    },
    "q-order-05": {
      "prompt": "Sakārto šos skaitļus no mazākā uz lielāko:",
      "options": ["0,5", "2/3", "0,7", "3/4"],
      "explanation": "0,5 < 0,666… (2/3) < 0,7 < 0,75 (3/4)."
    },
    "q-odd-01": {
      "prompt": "Kurš no šiem NAV zīdītājs?",
      "options": ["Haizivs", "Delfīns", "Sikspārnis", "Valis"],
      "explanation": "Haizivis ir zivis; delfīni, sikspārņi un vaļi ir zīdītāji."
    },
    "q-odd-02": {
      "prompt": "Kurš no šiem NAV pirmskaitlis?",
      "options": ["15", "7", "11", "13"],
      "explanation": "15 dalās ar 3 un 5 (15 = 3 × 5)."
    },
    "q-odd-03": {
      "prompt": "Kurš no šiem NAV stīgu instruments?",
      "options": ["Trompete", "Vijole", "Čells", "Alts"],
      "explanation": "Trompete ir metāla pūšaminstruments."
    },
    "q-odd-04": {
      "prompt": "Kura no šīm NAV valsts galvaspilsēta?",
      "options": ["Barselona", "Parīze", "Roma", "Madride"],
      "explanation": "Madride ir Spānijas galvaspilsēta; Barselona ir Katalonijas galvaspilsēta."
    },
    "q-odd-05": {
      "prompt": "Kurš no šiem NAV planēta?",
      "options": ["Mēness", "Merkurs", "Venera", "Marss"],
      "explanation": "Mēness ir Zemes dabiskais pavadonis."
    },
    "q-logic-01": {
      "prompt": "Kāds skaitlis seko tālāk: 2, 4, 8, 16, …?",
      "options": ["32", "24", "30", "18"],
      "explanation": "Katrs nākamais skaitlis ir divreiz lielāks par iepriekšējo."
    },
    "q-logic-02": {
      "prompt": "Kāds skaitlis seko tālāk: 1, 1, 2, 3, 5, 8, …?",
      "options": ["13", "11", "12", "15"],
      "explanation": "Fibonači virkne: 5 + 8 = 13."
    },
    "q-logic-03": {
      "prompt": "Ja 3 kaķi noķer 3 peles 3 minūtēs, cik kaķu vajadzīgs, lai noķertu 100 peles 100 minūtēs?",
      "options": ["3", "100", "33", "9"],
      "explanation": "Katrs kaķis noķer 1 peli 3 minūtēs, tātad 3 kaķi noķers 100 peles 100 minūtēs."
    },
    "q-logic-04": {
      "prompt": "Nūja un bumbiņa kopā maksā 1,10 $. Nūja maksā par 1,00 $ vairāk nekā bumbiņa. Cik maksā bumbiņa?",
      "options": ["0,05 $", "0,10 $", "0,15 $", "0,01 $"],
      "explanation": "Bumbiņa = 0,05 $, nūja = 1,05 $, kopā = 1,10 $."
    },
    "q-logic-05": {
      "prompt": "Cik ir 15% no 200?",
      "options": ["30", "15", "20", "35"],
      "explanation": "10% no 200 ir 20, plus 5% (10) ir 30."
    },
    "q-logic-06": {
      "prompt": "Ana ir vecāka par Benu. Bens ir vecāks par Karu. Kurš ir visjaunākais?",
      "options": ["Kara", "Ana", "Bens", "Nevar noteikt"],
      "explanation": "Ana > Bens > Kara, tātad Kara ir visjaunākā."
    },
    "q-logic-07": {
      "prompt": "Kādu leņķi veido pulksteņa rādītāji tieši pulksten 3:00?",
      "options": ["90°", "45°", "180°", "60°"],
      "explanation": "Ceturtdaļa no 360° apļa ir 90°."
    },
    "q-logic-08": {
      "prompt": "Kāds skaitlis seko tālāk: 3, 6, 11, 18, 27, …?",
      "options": ["38", "36", "35", "40"],
      "explanation": "Starpības pieaug par 2 katrā solī (+3, +5, +7, +9, +11)."
    },
    "q-logic-09": {
      "prompt": "Cik minūšu ir 2,5 stundās?",
      "options": ["150", "125", "250", "130"],
      "explanation": "2,5 × 60 = 150 minūtes."
    },
    "q-logic-10": {
      "prompt": "Pulkstenis rāda 9:00. Cik tas rādīs pēc 15 stundām?",
      "options": ["12:00", "6:00", "3:00", "9:00"],
      "explanation": "Pēc 12 stundām pulkstenis atkal rāda 9:00, pieskaitot 3 stundas = 12:00."
    }
  },
  "hu": {
    "q-mcq-01": {
      "prompt": "Melyik bolygón a legrövidebb az év?",
      "options": ["Merkúr", "Vénusz", "Mars", "Föld"],
      "explanation": "A Merkúr mindössze 88 földi nap alatt kerüli meg a Napot."
    },
    "q-mcq-02": {
      "prompt": "Mi Ausztrália fővárosa?",
      "options": ["Canberra", "Sydney", "Melbourne", "Perth"],
      "explanation": "Canberrát 1908-ban választották kompromisszumként Sydney és Melbourne között."
    },
    "q-mcq-03": {
      "prompt": "Melyik kémiai elem vegyjele az „Fe”?",
      "options": ["Vas", "Fluor", "Ólom", "Ón"],
      "explanation": "Az Fe a latin ferrum szóból ered, amely vasat jelent."
    },
    "q-mcq-04": {
      "prompt": "Melyik évben omlott le a berlini fal?",
      "options": ["1989", "1991", "1985", "1979"],
      "explanation": "A berlini fal 1989. november 9-én omlott le."
    },
    "q-mcq-05": {
      "prompt": "Melyik a Föld legnagyobb óceánja?",
      "options": ["Csendes-óceán", "Atlanti-óceán", "Indiai-óceán", "Jeges-tenger"],
      "explanation": "A Csendes-óceán a Föld felszínének több mint 30%-át borítja."
    },
    "q-mcq-06": {
      "prompt": "Melyik ország ajándékozta a Szabadság-szobrot az Egyesült Államoknak?",
      "options": ["Franciaország", "Egyesült Királyság", "Spanyolország", "Olaszország"],
      "explanation": "Franciaország 1886-ban ajándékozta a Szabadság-szobrot az USA-nak."
    },
    "q-mcq-07": {
      "prompt": "Ki festette a Mona Lisát?",
      "options": ["Leonardo da Vinci", "Michelangelo", "Raffaello", "Botticelli"],
      "explanation": "Leonardo da Vinci az 1500-as évek elején festette a Mona Lisát."
    },
    "q-mcq-08": {
      "prompt": "Melyik Dél-Amerika leghosszabb folyója?",
      "options": ["Amazonas", "Paraná", "Orinoco", "São Francisco"],
      "explanation": "Az Amazonas folyó mintegy 6400 km hosszan kanyarog Dél-Amerikában."
    },
    "q-mcq-09": {
      "prompt": "Melyik gázt kötik meg leginkább a növények a fotoszintézishez a levegőből?",
      "options": ["Szén-dioxid", "Oxigén", "Nitrogén", "Hélium"],
      "explanation": "A növények CO2-t kötnek meg és oxigént bocsátanak ki a fotoszintézis során."
    },
    "q-mcq-10": {
      "prompt": "Melyik a legkisebb prímszám?",
      "options": ["2", "1", "3", "0"],
      "explanation": "A 2 a legkisebb prímszám és az egyetlen páros prím."
    },
    "q-order-01": {
      "prompt": "Állítsd sorrendbe a bolygókat a Naptól mért távolságuk alapján (a legközelebbitől):",
      "options": ["Vénusz", "Föld", "Mars", "Jupiter"],
      "explanation": "A Naptól kifelé haladva: Merkúr, Vénusz, Föld, Mars, Jupiter."
    },
    "q-order-02": {
      "prompt": "Állítsd időrendbe ezeket az eseményeket a legrégebbitől a legújabbig:",
      "options": ["Első holdraszállás", "A berlini fal leomlása", "Az euróérmék bevezetése", "Az első iPhone bemutatása"],
      "explanation": "1969 → 1989 → 2002 → 2007."
    },
    "q-order-03": {
      "prompt": "Állítsd sorrendbe a legkisebbtől a legnagyobbig:",
      "options": ["Bájt", "Kilobájt", "Megabájt", "Gigabájt"],
      "explanation": "Minden egység 1000-szeresére nő (binárisan 1024-szeresére)."
    },
    "q-order-04": {
      "prompt": "Állítsd sorrendbe az országokat szárazföldi területük szerint, a legnagyobbal kezdve:",
      "options": ["Oroszország", "Kanada", "Brazília", "Ausztrália"],
      "explanation": "Terület szerint: Oroszország > Kanada > Brazília > Ausztrália."
    },
    "q-order-05": {
      "prompt": "Állítsd sorrendbe a számokat a legkisebbtől a legnagyobbig:",
      "options": ["0,5", "2/3", "0,7", "3/4"],
      "explanation": "0,5 < 0,666… (2/3) < 0,7 < 0,75 (3/4)."
    },
    "q-odd-01": {
      "prompt": "Melyik NEM emlősállat az alábbiak közül?",
      "options": ["Cápa", "Delfin", "Denevér", "Bálna"],
      "explanation": "A cápák halak; a delfinek, a denevérek és a bálnák emlősök."
    },
    "q-odd-02": {
      "prompt": "Melyik NEM prímszám az alábbiak közül?",
      "options": ["15", "7", "11", "13"],
      "explanation": "A 15 osztható 3-mal és 5-tel is (15 = 3 × 5)."
    },
    "q-odd-03": {
      "prompt": "Melyik NEM húros hangszer az alábbiak közül?",
      "options": ["Trombita", "Hegedű", "Cselló", "Brácsa"],
      "explanation": "A trombita rézfúvós hangszer."
    },
    "q-odd-04": {
      "prompt": "Melyik NEM nemzeti főváros az alábbiak közül?",
      "options": ["Barcelona", "Párizs", "Róma", "Madrid"],
      "explanation": "Madrid Spanyolország fővárosa; Barcelona Katalónia székhelye."
    },
    "q-odd-05": {
      "prompt": "Melyik NEM bolygó az alábbiak közül?",
      "options": ["Hold", "Merkúr", "Vénusz", "Mars"],
      "explanation": "A Hold a Föld természetes kísérője (holdja)."
    },
    "q-logic-01": {
      "prompt": "Melyik szám következik: 2, 4, 8, 16, …?",
      "options": ["32", "24", "30", "18"],
      "explanation": "Minden szám az előző kétszerese."
    },
    "q-logic-02": {
      "prompt": "Melyik szám következik: 1, 1, 2, 3, 5, 8, …?",
      "options": ["13", "11", "12", "15"],
      "explanation": "Fibonacci-sorozat: 5 + 8 = 13."
    },
    "q-logic-03": {
      "prompt": "Ha 3 macska 3 perc alatt 3 egeret fog meg, hány macska kell 100 egér megfogásához 100 perc alatt?",
      "options": ["3", "100", "33", "9"],
      "explanation": "Minden macska 3 percenként fog meg 1 egeret, így 3 macska elegendő."
    },
    "q-logic-04": {
      "prompt": "Egy ütő és egy labda összesen 1,10 $-ba kerül. Az ütő 1,00 $-ral drágább, mint a labda. Mennyibe kerül a labda?",
      "options": ["0,05 $", "0,10 $", "0,15 $", "0,01 $"],
      "explanation": "Labda = 0,05 $, ütő = 1,05 $, összesen = 1,10 $."
    },
    "q-logic-05": {
      "prompt": "Mennyi 200-nak a 15%-a?",
      "options": ["30", "15", "20", "35"],
      "explanation": "200 10%-a 20, plusz az 5% (10) összesen 30."
    },
    "q-logic-06": {
      "prompt": "Ana idősebb, mint Ben. Ben idősebb, mint Cara. Ki a legfiatalabb?",
      "options": ["Cara", "Ana", "Ben", "Nem határozható meg"],
      "explanation": "Ana > Ben > Cara, tehát Cara a legfiatalabb."
    },
    "q-logic-07": {
      "prompt": "Mekkora szöget zárnak be az óramutatók pontosan 3:00-kor?",
      "options": ["90°", "45°", "180°", "60°"],
      "explanation": "A 360°-os kör egynegyede 90°."
    },
    "q-logic-08": {
      "prompt": "Melyik szám következik: 3, 6, 11, 18, 27, …?",
      "options": ["38", "36", "35", "40"],
      "explanation": "A különbségek 2-vel nőnek lépésenként (+3, +5, +7, +9, +11)."
    },
    "q-logic-09": {
      "prompt": "Hány perc van 2,5 órában?",
      "options": ["150", "125", "250", "130"],
      "explanation": "2,5 × 60 = 150 perc."
    },
    "q-logic-10": {
      "prompt": "Egy óra 9:00-t mutat. Mit mutat 15 órával később?",
      "options": ["12:00", "6:00", "3:00", "9:00"],
      "explanation": "12 óra múlva ismét 9:00 lesz, plusz 3 óra = 12:00."
    }
  }
}
