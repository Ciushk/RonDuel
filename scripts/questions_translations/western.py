# -*- coding: utf-8 -*-
"""
Translations for the 30 seed questions in:
- de (German)
- fr (French)
- it (Italian)
- nl (Dutch)
"""

DATA = {
  "de": {
    "q-mcq-01": {
      "prompt": "Welcher Planet hat das kürzeste Jahr?",
      "options": ["Merkur", "Venus", "Mars", "Erde"],
      "explanation": "Merkur umkreist die Sonne in nur 88 Erdtagen."
    },
    "q-mcq-02": {
      "prompt": "Was ist die Hauptstadt von Australien?",
      "options": ["Canberra", "Sydney", "Melbourne", "Perth"],
      "explanation": "Canberra wurde 1908 als Kompromiss zwischen Sydney und Melbourne gewählt."
    },
    "q-mcq-03": {
      "prompt": "Welches chemische Element hat das Symbol „Fe“?",
      "options": ["Eisen", "Fluor", "Blei", "Zinn"],
      "explanation": "Fe stammt vom lateinischen Wort ferrum ab, was Eisen bedeutet."
    },
    "q-mcq-04": {
      "prompt": "In welchem Jahr fiel die Berliner Mauer?",
      "options": ["1989", "1991", "1985", "1979"],
      "explanation": "Die Berliner Mauer fiel am 9. November 1989."
    },
    "q-mcq-05": {
      "prompt": "Welcher ist der größte Ozean der Erde?",
      "options": ["Pazifik", "Atlantik", "Indischer Ozean", "Arktischer Ozean"],
      "explanation": "Der Pazifische Ozean bedeckt mehr als 30 % der Erdoberfläche."
    },
    "q-mcq-06": {
      "prompt": "Welches Land schenkte den USA die Freiheitsstatue?",
      "options": ["Frankreich", "Vereinigtes Königreich", "Spanien", "Italien"],
      "explanation": "Frankreich schenkte den USA die Freiheitsstatue im Jahr 1886."
    },
    "q-mcq-07": {
      "prompt": "Wer malte die Mona Lisa?",
      "options": ["Leonardo da Vinci", "Michelangelo", "Raffael", "Botticelli"],
      "explanation": "Leonardo da Vinci malte die Mona Lisa Anfang des 16. Jahrhunderts."
    },
    "q-mcq-08": {
      "prompt": "Welcher ist der längste Fluss Südamerikas?",
      "options": ["Amazonas", "Paraná", "Orinoco", "São Francisco"],
      "explanation": "Der Amazonas erstreckt sich über etwa 6.400 km durch Südamerika."
    },
    "q-mcq-09": {
      "prompt": "Welches Gas nehmen Pflanzen für die Fotosynthese hauptsächlich auf?",
      "options": ["Kohlendioxid", "Sauerstoff", "Stickstoff", "Helium"],
      "explanation": "Pflanzen nehmen CO2 auf und geben bei der Fotosynthese Sauerstoff ab."
    },
    "q-mcq-10": {
      "prompt": "Was ist die kleinste Primzahl?",
      "options": ["2", "1", "3", "0"],
      "explanation": "2 ist die kleinste Primzahl und die einzige gerade Primzahl."
    },
    "q-order-01": {
      "prompt": "Ordne diese Planeten nach Abstand zur Sonne, der nächste zuerst:",
      "options": ["Venus", "Erde", "Mars", "Jupiter"],
      "explanation": "Von der Sonne nach außen: Merkur, Venus, Erde, Mars, Jupiter."
    },
    "q-order-02": {
      "prompt": "Ordne diese Ereignisse chronologisch, das früheste zuerst:",
      "options": ["Erste Mondlandung", "Fall der Berliner Mauer", "Euro-Münzen im Umlauf", "Erstes iPhone erscheint"],
      "explanation": "1969 → 1989 → 2002 → 2007."
    },
    "q-order-03": {
      "prompt": "Ordne von der kleinsten zur größten Einheit:",
      "options": ["Byte", "Kilobyte", "Megabyte", "Gigabyte"],
      "explanation": "Jede Einheit vergrößert sich um das 1.000-fache (oder 1.024 binär)."
    },
    "q-order-04": {
      "prompt": "Ordne diese Länder nach Fläche, das größte zuerst:",
      "options": ["Russland", "Kanada", "Brasilien", "Australien"],
      "explanation": "Russland > Kanada > Brasilien > Australien nach Landfläche."
    },
    "q-order-05": {
      "prompt": "Ordne diese Zahlen von der kleinsten zur größten:",
      "options": ["0.5", "2/3", "0.7", "3/4"],
      "explanation": "0.5 < 0,666… (2/3) < 0.7 < 0,75 (3/4)."
    },
    "q-odd-01": {
      "prompt": "Was ist KEIN Säugetier?",
      "options": ["Hai", "Delfin", "Fledermaus", "Wal"],
      "explanation": "Haie sind Fische; Delfine, Fledermäuse und Wale sind Säugetiere."
    },
    "q-odd-02": {
      "prompt": "Welche Zahl ist KEINE Primzahl?",
      "options": ["15", "7", "11", "13"],
      "explanation": "15 ist durch 3 und 5 teilbar (15 = 3 × 5)."
    },
    "q-odd-03": {
      "prompt": "Was ist KEIN Saiten- oder Streichinstrument?",
      "options": ["Trompete", "Violine", "Cello", "Bratsche"],
      "explanation": "Eine Trompete ist ein Blechblasinstrument."
    },
    "q-odd-04": {
      "prompt": "Welche Stadt ist KEINE Landeshauptstadt?",
      "options": ["Barcelona", "Paris", "Rom", "Madrid"],
      "explanation": "Madrid ist die Hauptstadt Spaniens; Barcelona ist die Hauptstadt Kataloniens."
    },
    "q-odd-05": {
      "prompt": "Was ist KEIN Planet?",
      "options": ["Der Mond", "Merkur", "Venus", "Mars"],
      "explanation": "Der Mond ist der natürliche Satellit der Erde."
    },
    "q-logic-01": {
      "prompt": "Welche Zahl folgt: 2, 4, 8, 16, …?",
      "options": ["32", "24", "30", "18"],
      "explanation": "Jede Zahl verdoppelt die vorherige."
    },
    "q-logic-02": {
      "prompt": "Welche Zahl folgt: 1, 1, 2, 3, 5, 8, …?",
      "options": ["13", "11", "12", "15"],
      "explanation": "Fibonacci-Folge: 5 + 8 = 13."
    },
    "q-logic-03": {
      "prompt": "3 Katzen fangen 3 Mäuse in 3 Minuten. Wie viele Katzen fangen 100 Mäuse in 100 Minuten?",
      "options": ["3", "100", "33", "9"],
      "explanation": "Jede Katze fängt 1 Maus alle 3 Minuten, also fangen 3 Katzen 100 Mäuse in 100 Minuten."
    },
    "q-logic-04": {
      "prompt": "Ein Schläger und ein Ball kosten 1,10$ zusammen. Der Schläger kostet 1,00$ mehr als der Ball. Was kostet der Ball?",
      "options": ["0,05$", "0,10$", "0,15$", "0,01$"],
      "explanation": "Ball = 0,05$, Schläger = 1,05$, gesamt = 1,10$."
    },
    "q-logic-05": {
      "prompt": "Wie viel sind 15 % von 200?",
      "options": ["30", "15", "20", "35"],
      "explanation": "10 % von 200 ist 20, plus 5 % (10) ergibt 30."
    },
    "q-logic-06": {
      "prompt": "Ana ist älter als Ben. Ben ist älter als Cara. Wer ist am jüngsten?",
      "options": ["Cara", "Ana", "Ben", "Nicht bestimmbar"],
      "explanation": "Ana > Ben > Cara, also ist Cara am jüngsten."
    },
    "q-logic-07": {
      "prompt": "Welchen Winkel bilden die Uhrzeiger um genau 3:00 Uhr?",
      "options": ["90°", "45°", "180°", "60°"],
      "explanation": "Ein Viertel eines 360°-Kreises sind 90°."
    },
    "q-logic-08": {
      "prompt": "Welche Zahl folgt: 3, 6, 11, 18, 27, …?",
      "options": ["38", "36", "35", "40"],
      "explanation": "Die Abstände wachsen jeweils um 2 (+3, +5, +7, +9, +11)."
    },
    "q-logic-09": {
      "prompt": "Wie viele Minuten haben 2,5 Stunden?",
      "options": ["150", "125", "250", "130"],
      "explanation": "2,5 × 60 = 150 Minuten."
    },
    "q-logic-10": {
      "prompt": "Eine Uhr zeigt 9:00. Welche Uhrzeit zeigt sie 15 Stunden später an?",
      "options": ["12:00", "6:00", "3:00", "9:00"],
      "explanation": "Nach 12 Stunden ist es wieder 9:00, plus 3 Stunden = 12:00."
    }
  },
  "fr": {
    "q-mcq-01": {
      "prompt": "Quelle planète a l'année la plus courte ?",
      "options": ["Mercure", "Vénus", "Mars", "Terre"],
      "explanation": "Mercure fait le tour du Soleil en seulement 88 jours terrestres."
    },
    "q-mcq-02": {
      "prompt": "Quelle est la capitale de l'Australie ?",
      "options": ["Canberra", "Sydney", "Melbourne", "Perth"],
      "explanation": "Canberra a été choisie en 1908 comme compromis entre Sydney et Melbourne."
    },
    "q-mcq-03": {
      "prompt": "Quel élément chimique a pour symbole « Fe » ?",
      "options": ["Fer", "Fluor", "Plomb", "Étain"],
      "explanation": "Fe vient du mot latin ferrum, qui signifie fer."
    },
    "q-mcq-04": {
      "prompt": "En quelle année le mur de Berlin est-il tombé ?",
      "options": ["1989", "1991", "1985", "1979"],
      "explanation": "Le mur de Berlin est tombé le 9 novembre 1989."
    },
    "q-mcq-05": {
      "prompt": "Quel est le plus grand océan de la Terre ?",
      "options": ["Pacifique", "Atlantique", "Indien", "Arctique"],
      "explanation": "L'océan Pacifique couvre plus de 30 % de la surface de la Terre."
    },
    "q-mcq-06": {
      "prompt": "Quel pays a offert la statue de la Liberté aux États-Unis ?",
      "options": ["France", "Royaume-Uni", "Espagne", "Italie"],
      "explanation": "La France a offert la statue de la Liberté aux États-Unis en 1886."
    },
    "q-mcq-07": {
      "prompt": "Qui a peint la Joconde ?",
      "options": ["Léonard de Vinci", "Michel-Ange", "Raphaël", "Botticelli"],
      "explanation": "Léonard de Vinci a peint la Joconde au début du XVIe siècle."
    },
    "q-mcq-08": {
      "prompt": "Quel est le plus long fleuve d'Amérique du Sud ?",
      "options": ["Amazone", "Paraná", "Orénoque", "São Francisco"],
      "explanation": "L'Amazone s'étend sur environ 6 400 km en Amérique du Sud."
    },
    "q-mcq-09": {
      "prompt": "Quel gaz les plantes absorbent-elles principalement pour la photosynthèse ?",
      "options": ["Dioxyde de carbone", "Oxygène", "Azote", "Hélium"],
      "explanation": "Les plantes absorbent du CO2 et rejettent de l'oxygène lors de la photosynthèse."
    },
    "q-mcq-10": {
      "prompt": "Quel est le plus petit nombre premier ?",
      "options": ["2", "1", "3", "0"],
      "explanation": "2 est le plus petit nombre premier et le seul qui soit pair."
    },
    "q-order-01": {
      "prompt": "Classe ces planètes par distance au Soleil, de la plus proche à la plus éloignée :",
      "options": ["Vénus", "Terre", "Mars", "Jupiter"],
      "explanation": "Du Soleil vers l'extérieur : Mercure, Vénus, Terre, Mars, Jupiter."
    },
    "q-order-02": {
      "prompt": "Classe ces événements du plus ancien au plus récent :",
      "options": ["Premier pas sur la Lune", "Chute du mur de Berlin", "Mise en circulation de l'euro", "Sortie du premier iPhone"],
      "explanation": "1969 → 1989 → 2002 → 2007."
    },
    "q-order-03": {
      "prompt": "Classe ces unités de la plus petite à la plus grande :",
      "options": ["Octet", "Kilooctet", "Mégaoctet", "Gigaoctet"],
      "explanation": "Chaque unité est multipliée par 1 000 (ou 1 024 en binaire)."
    },
    "q-order-04": {
      "prompt": "Classe ces pays par superficie, du plus grand au plus petit :",
      "options": ["Russie", "Canada", "Brésil", "Australie"],
      "explanation": "Russie > Canada > Brésil > Australie selon la superficie."
    },
    "q-order-05": {
      "prompt": "Classe ces nombres du plus petit au plus grand :",
      "options": ["0.5", "2/3", "0.7", "3/4"],
      "explanation": "0,5 < 0,666… (2/3) < 0,7 < 0,75 (3/4)."
    },
    "q-odd-01": {
      "prompt": "Lequel n'est PAS un mammifère ?",
      "options": ["Requin", "Dauphin", "Chauve-souris", "Baleine"],
      "explanation": "Les requins sont des poissons ; dauphins, chauves-souris et baleines sont des mammifères."
    },
    "q-odd-02": {
      "prompt": "Lequel n'est PAS un nombre premier ?",
      "options": ["15", "7", "11", "13"],
      "explanation": "15 est divisible par 3 et par 5 (15 = 3 × 5)."
    },
    "q-odd-03": {
      "prompt": "Lequel n'est PAS un instrument à cordes ?",
      "options": ["Trompette", "Violon", "Violoncelle", "Alto"],
      "explanation": "La trompette est un instrument à vent de la famille des cuivres."
    },
    "q-odd-04": {
      "prompt": "Laquelle n'est PAS une capitale nationale ?",
      "options": ["Barcelone", "Paris", "Rome", "Madrid"],
      "explanation": "Madrid est la capitale de l'Espagne ; Barcelone est la capitale de la Catalogne."
    },
    "q-odd-05": {
      "prompt": "Lequel n'est PAS une planète ?",
      "options": ["La Lune", "Mercure", "Vénus", "Mars"],
      "explanation": "La Lune est le satellite naturel de la Terre."
    },
    "q-logic-01": {
      "prompt": "Quel nombre vient ensuite : 2, 4, 8, 16, … ?",
      "options": ["32", "24", "30", "18"],
      "explanation": "Chaque nombre est le double du précédent."
    },
    "q-logic-02": {
      "prompt": "Quel nombre vient ensuite : 1, 1, 2, 3, 5, 8, … ?",
      "options": ["13", "11", "12", "15"],
      "explanation": "Suite de Fibonacci : 5 + 8 = 13."
    },
    "q-logic-03": {
      "prompt": "Si 3 chats attrapent 3 souris en 3 min, combien de chats en attrapent 100 en 100 min ?",
      "options": ["3", "100", "33", "9"],
      "explanation": "Chaque chat attrape 1 souris en 3 minutes, donc 3 chats attrapent 100 souris en 100 minutes."
    },
    "q-logic-04": {
      "prompt": "Une batte et une balle coûtent 1,10$ au total. La batte coûte 1,00$ de plus que la balle. Combien coûte la balle ?",
      "options": ["0,05$", "0,10$", "0,15$", "0,01$"],
      "explanation": "Balle = 0,05$, batte = 1,05$, total = 1,10$."
    },
    "q-logic-05": {
      "prompt": "Combien font 15 % de 200 ?",
      "options": ["30", "15", "20", "35"],
      "explanation": "10 % de 200 vaut 20, plus 5 % (10) font 30."
    },
    "q-logic-06": {
      "prompt": "Ana est plus âgée que Ben. Ben est plus âgé que Cara. Qui est le plus jeune ?",
      "options": ["Cara", "Ana", "Ben", "Impossible à dire"],
      "explanation": "Ana > Ben > Cara, donc Cara est la plus jeune."
    },
    "q-logic-07": {
      "prompt": "Quel angle forment les aiguilles d'une horloge à exactement 3 h 00 ?",
      "options": ["90°", "45°", "180°", "60°"],
      "explanation": "Un quart d'un cercle de 360° équivaut à 90°."
    },
    "q-logic-08": {
      "prompt": "Quel nombre vient ensuite : 3, 6, 11, 18, 27, … ?",
      "options": ["38", "36", "35", "40"],
      "explanation": "Les écarts augmentent de 2 à chaque étape (+3, +5, +7, +9, +11)."
    },
    "q-logic-09": {
      "prompt": "Combien de minutes y a-t-il dans 2,5 heures ?",
      "options": ["150", "125", "250", "130"],
      "explanation": "2,5 × 60 = 150 minutes."
    },
    "q-logic-10": {
      "prompt": "Une horloge indique 9 h 00. Quelle heure indiquera-t-elle 15 heures plus tard ?",
      "options": ["12:00", "6:00", "3:00", "9:00"],
      "explanation": "Sur une horloge de 12 heures, après 12 heures il est de nouveau 9 h 00, plus 3 heures = 12 h 00."
    }
  },
  "it": {
    "q-mcq-01": {
      "prompt": "Quale pianeta ha l'anno più breve?",
      "options": ["Mercurio", "Venere", "Marte", "Terra"],
      "explanation": "Mercurio compie un'orbita intorno al Sole in soli 88 giorni terrestri."
    },
    "q-mcq-02": {
      "prompt": "Qual è la capitale dell'Australia?",
      "options": ["Canberra", "Sydney", "Melbourne", "Perth"],
      "explanation": "Canberra fu scelta nel 1908 come compromesso tra Sydney e Melbourne."
    },
    "q-mcq-03": {
      "prompt": "Quale elemento chimico ha il simbolo \"Fe\"?",
      "options": ["Ferro", "Fluoro", "Piombo", "Stagno"],
      "explanation": "Fe deriva dalla parola latina ferrum, che significa ferro."
    },
    "q-mcq-04": {
      "prompt": "In quale anno è caduto il Muro di Berlino?",
      "options": ["1989", "1991", "1985", "1979"],
      "explanation": "Il Muro di Berlino è caduto il 9 novembre 1989."
    },
    "q-mcq-05": {
      "prompt": "Qual è l'oceano più grande della Terra?",
      "options": ["Pacifico", "Atlantico", "Indiano", "Artico"],
      "explanation": "L'Oceano Pacifico copre oltre il 30% della superficie terrestre."
    },
    "q-mcq-06": {
      "prompt": "Quale paese ha donato la Statua della Libertà agli Stati Uniti?",
      "options": ["Francia", "Regno Unito", "Spagna", "Italia"],
      "explanation": "La Francia donò la Statua della Libertà agli Stati Uniti nel 1886."
    },
    "q-mcq-07": {
      "prompt": "Chi ha dipinto la Gioconda?",
      "options": ["Leonardo da Vinci", "Michelangelo", "Raffaello", "Botticelli"],
      "explanation": "Leonardo da Vinci dipinse la Gioconda all'inizio del Cinquecento."
    },
    "q-mcq-08": {
      "prompt": "Qual è il fiume più lungo del Sud America?",
      "options": ["Rio delle Amazzoni", "Paraná", "Orinoco", "São Francisco"],
      "explanation": "Il Rio delle Amazzoni si estende per circa 6.400 km attraverso il Sud America."
    },
    "q-mcq-09": {
      "prompt": "Quale gas assorbono principalmente le piante per la fotosintesi?",
      "options": ["Anidride carbonica", "Ossigeno", "Azoto", "Elio"],
      "explanation": "Le piante assorbono CO2 e rilasciano ossigeno durante la fotosintesi."
    },
    "q-mcq-10": {
      "prompt": "Qual è il numero primo più piccolo?",
      "options": ["2", "1", "3", "0"],
      "explanation": "2 è il numero primo più piccolo e l'unico numero primo pari."
    },
    "q-order-01": {
      "prompt": "Ordina questi pianeti per distanza dal Sole, dal più vicino:",
      "options": ["Venere", "Terra", "Marte", "Giove"],
      "explanation": "Dal Sole verso l'esterno: Mercurio, Venere, Terra, Marte, Giove."
    },
    "q-order-02": {
      "prompt": "Ordina questi eventi dal più antico al più recente:",
      "options": ["Primo allunaggio", "Caduta del Muro di Berlino", "L'euro entra in circolazione", "Lancio del primo iPhone"],
      "explanation": "1969 → 1989 → 2002 → 2007."
    },
    "q-order-03": {
      "prompt": "Ordina dal più piccolo al più grande:",
      "options": ["Byte", "Kilobyte", "Megabyte", "Gigabyte"],
      "explanation": "Ogni unità scala di 1.000 volte (o 1.024 in binario)."
    },
    "q-order-04": {
      "prompt": "Ordina questi paesi per superficie, dal più esteso:",
      "options": ["Russia", "Canada", "Brasile", "Australia"],
      "explanation": "Russia > Canada > Brasile > Australia per estensione terrestre."
    },
    "q-order-05": {
      "prompt": "Ordina questi numeri dal più piccolo al più grande:",
      "options": ["0.5", "2/3", "0.7", "3/4"],
      "explanation": "0,5 < 0,666… (2/3) < 0,7 < 0,75 (3/4)."
    },
    "q-odd-01": {
      "prompt": "Quale NON è un mammifero?",
      "options": ["Squalo", "Delfino", "Pipistrello", "Balena"],
      "explanation": "Gli squali sono pesci; delfini, pipistrelli e balene sono mammiferi."
    },
    "q-odd-02": {
      "prompt": "Quale NON è un numero primo?",
      "options": ["15", "7", "11", "13"],
      "explanation": "15 è divisibile per 3 e 5 (15 = 3 × 5)."
    },
    "q-odd-03": {
      "prompt": "Quale NON è uno strumento a corda?",
      "options": ["Tromba", "Violino", "Violoncello", "Viola"],
      "explanation": "La tromba è uno strumento a fiato (ottone)."
    },
    "q-odd-04": {
      "prompt": "Quale NON è una capitale nazionale?",
      "options": ["Barcellona", "Parigi", "Roma", "Madrid"],
      "explanation": "Madrid è la capitale della Spagna; Barcellona è il capoluogo della Catalogna."
    },
    "q-odd-05": {
      "prompt": "Quale NON è un pianeta?",
      "options": ["La Luna", "Mercurio", "Venere", "Marte"],
      "explanation": "La Luna è il satellite naturale della Terra."
    },
    "q-logic-01": {
      "prompt": "Quale numero segue: 2, 4, 8, 16, …?",
      "options": ["32", "24", "30", "18"],
      "explanation": "Ogni numero raddoppia il precedente."
    },
    "q-logic-02": {
      "prompt": "Quale numero segue: 1, 1, 2, 3, 5, 8, …?",
      "options": ["13", "11", "12", "15"],
      "explanation": "Successione di Fibonacci: 5 + 8 = 13."
    },
    "q-logic-03": {
      "prompt": "Se 3 gatti prendono 3 topi in 3 minuti, quanti gatti servono per 100 topi in 100 minuti?",
      "options": ["3", "100", "33", "9"],
      "explanation": "Ogni gatto cattura 1 topo ogni 3 minuti, quindi 3 gatti catturano 100 topi in 100 minuti."
    },
    "q-logic-04": {
      "prompt": "Una mazza e una palla costano 1,10$ in totale. La mazza costa 1,00$ in più della palla. Quanto costa la palla?",
      "options": ["0,05$", "0,10$", "0,15$", "0,01$"],
      "explanation": "Palla = 0,05$, mazza = 1,05$, totale = 1,10$."
    },
    "q-logic-05": {
      "prompt": "Quanto è il 15% di 200?",
      "options": ["30", "15", "20", "35"],
      "explanation": "Il 10% di 200 è 20, più il 5% (10) fa 30."
    },
    "q-logic-06": {
      "prompt": "Ana è più vecchia di Ben. Ben è più vecchio di Cara. Chi è la persona più giovane?",
      "options": ["Cara", "Ana", "Ben", "Non si può sapere"],
      "explanation": "Ana > Ben > Cara, quindi Cara è la più giovane."
    },
    "q-logic-07": {
      "prompt": "Quale angolo formano le lancette dell'orologio alle 3:00 in punto?",
      "options": ["90°", "45°", "180°", "60°"],
      "explanation": "Un quarto di un cerchio di 360° è 90°."
    },
    "q-logic-08": {
      "prompt": "Quale numero segue: 3, 6, 11, 18, 27, …?",
      "options": ["38", "36", "35", "40"],
      "explanation": "Le differenze aumentano di 2 a ogni passo (+3, +5, +7, +9, +11)."
    },
    "q-logic-09": {
      "prompt": "Quanti minuti ci sono in 2,5 ore?",
      "options": ["150", "125", "250", "130"],
      "explanation": "2,5 × 60 = 150 minuti."
    },
    "q-logic-10": {
      "prompt": "Un orologio segna le 9:00. Che ora segnerà 15 ore dopo?",
      "options": ["12:00", "6:00", "3:00", "9:00"],
      "explanation": "Su un orologio a 12 ore, dopo 12 ore sono ancora le 9:00, più 3 ore = 12:00."
    }
  },
  "nl": {
    "q-mcq-01": {
      "prompt": "Welke planeet heeft het kortste jaar?",
      "options": ["Mercurius", "Venus", "Mars", "Aarde"],
      "explanation": "Mercurius draait in slechts 88 aardse dagen om de zon."
    },
    "q-mcq-02": {
      "prompt": "Wat is de hoofdstad van Australië?",
      "options": ["Canberra", "Sydney", "Melbourne", "Perth"],
      "explanation": "Canberra werd in 1908 gekozen als compromis tussen Sydney en Melbourne."
    },
    "q-mcq-03": {
      "prompt": "Welk chemisch element heeft het symbool \"Fe\"?",
      "options": ["IJzer", "Fluor", "Lood", "Tin"],
      "explanation": "Fe komt van het Latijnse woord ferrum, wat ijzer betekent."
    },
    "q-mcq-04": {
      "prompt": "In welk jaar viel de Berlijnse Muur?",
      "options": ["1989", "1991", "1985", "1979"],
      "explanation": "De Berlijnse Muur viel op 9 november 1989."
    },
    "q-mcq-05": {
      "prompt": "Wat is de grootste oceaan op aarde?",
      "options": ["Stille Oceaan", "Atlantische Oceaan", "Indische Oceaan", "Arctische Oceaan"],
      "explanation": "De Stille Oceaan beslaat meer dan 30% van het aardoppervlak."
    },
    "q-mcq-06": {
      "prompt": "Welk land schonk het Vrijheidsbeeld aan de Verenigde Staten?",
      "options": ["Frankrijk", "Verenigd Koninkrijk", "Spanje", "Italië"],
      "explanation": "Frankrijk schonk het Vrijheidsbeeld in 1886 aan de Verenigde Staten."
    },
    "q-mcq-07": {
      "prompt": "Wie schilderde de Mona Lisa?",
      "options": ["Leonardo da Vinci", "Michelangelo", "Rafaël", "Botticelli"],
      "explanation": "Leonardo da Vinci schilderde de Mona Lisa aan het begin van de 16e eeuw."
    },
    "q-mcq-08": {
      "prompt": "Wat is de langste rivier in Zuid-Amerika?",
      "options": ["Amazone", "Paraná", "Orinoco", "São Francisco"],
      "explanation": "De Amazone heeft een lengte van ongeveer 6.400 km."
    },
    "q-mcq-09": {
      "prompt": "Welk gas nemen planten vooral op voor fotosynthese?",
      "options": ["Kooldioxide", "Zuurstof", "Stikstof", "Helium"],
      "explanation": "Planten nemen CO2 op en geven zuurstof af tijdens fotosynthese."
    },
    "q-mcq-10": {
      "prompt": "Wat is het kleinste priemgetal?",
      "options": ["2", "1", "3", "0"],
      "explanation": "2 is het kleinste priemgetal en het enige even priemgetal."
    },
    "q-order-01": {
      "prompt": "Rangschik deze planeten op afstand van de zon, dichtstbijzijnde eerst:",
      "options": ["Venus", "Aarde", "Mars", "Jupiter"],
      "explanation": "Vanaf de zon naar buiten: Mercurius, Venus, Aarde, Mars, Jupiter."
    },
    "q-order-02": {
      "prompt": "Rangschik deze gebeurtenissen van oud naar nieuw:",
      "options": ["Eerste maanlanding", "Val van de Berlijnse Muur", "Euromunten in omloop", "Eerste iPhone uitgebracht"],
      "explanation": "1969 → 1989 → 2002 → 2007."
    },
    "q-order-03": {
      "prompt": "Rangschik van klein naar groot:",
      "options": ["Byte", "Kilobyte", "Megabyte", "Gigabyte"],
      "explanation": "Elke eenheid is 1.000 keer groter (of 1.024 in binair)."
    },
    "q-order-04": {
      "prompt": "Rangschik deze landen op oppervlakte, grootste eerst:",
      "options": ["Rusland", "Canada", "Brazilië", "Australië"],
      "explanation": "Rusland > Canada > Brazilië > Australië op basis van oppervlakte."
    },
    "q-order-05": {
      "prompt": "Rangschik deze getallen van klein naar groot:",
      "options": ["0.5", "2/3", "0.7", "3/4"],
      "explanation": "0,5 < 0,666… (2/3) < 0,7 < 0,75 (3/4)."
    },
    "q-odd-01": {
      "prompt": "Wat is GEEN zoogdier?",
      "options": ["Haai", "Dolfijn", "Vleermuis", "Walvis"],
      "explanation": "Haaien zijn vissen; dolfijnen, vleermuizen en walvissen zijn zoogdieren."
    },
    "q-odd-02": {
      "prompt": "Wat is GEEN priemgetal?",
      "options": ["15", "7", "11", "13"],
      "explanation": "15 is deelbaar door 3 en 5 (15 = 3 × 5)."
    },
    "q-odd-03": {
      "prompt": "Wat is GEEN snaarinstrument?",
      "options": ["Trompet", "Viool", "Cello", "Altviool"],
      "explanation": "Een trompet is een koperblaasinstrument."
    },
    "q-odd-04": {
      "prompt": "Wat is GEEN nationale hoofdstad?",
      "options": ["Barcelona", "Parijs", "Rome", "Madrid"],
      "explanation": "Madrid is de hoofdstad van Spanje; Barcelona is de hoofdstad van Catalonië."
    },
    "q-odd-05": {
      "prompt": "Wat is GEEN planeet?",
      "options": ["De maan", "Mercurius", "Venus", "Mars"],
      "explanation": "De maan is de natuurlijke satelliet van de aarde."
    },
    "q-logic-01": {
      "prompt": "Wat is het volgende getal: 2, 4, 8, 16, …?",
      "options": ["32", "24", "30", "18"],
      "explanation": "Elk getal is het dubbele van het vorige."
    },
    "q-logic-02": {
      "prompt": "Wat is het volgende getal: 1, 1, 2, 3, 5, 8, …?",
      "options": ["13", "11", "12", "15"],
      "explanation": "Fibonacci-reeks: 5 + 8 = 13."
    },
    "q-logic-03": {
      "prompt": "Als 3 katten 3 muizen vangen in 3 min, hoeveel katten vangen dan 100 muizen in 100 min?",
      "options": ["3", "100", "33", "9"],
      "explanation": "Elke kat vangt 1 muis in 3 minuten, dus 3 katten vangen 100 muizen in 100 minuten."
    },
    "q-logic-04": {
      "prompt": "Een knuppel en een bal kosten samen 1,10$. De knuppel kost 1,00$ meer dan de bal. Hoeveel kost de bal?",
      "options": ["0,05$", "0,10$", "0,15$", "0,01$"],
      "explanation": "Bal = 0,05$, knuppel = 1,05$, totaal = 1,10$."
    },
    "q-logic-05": {
      "prompt": "Hoeveel is 15% van 200?",
      "options": ["30", "15", "20", "35"],
      "explanation": "10% van 200 is 20, plus 5% (10) maakt 30."
    },
    "q-logic-06": {
      "prompt": "Ana is ouder dan Ben. Ben is ouder dan Cara. Wie is de jongste?",
      "options": ["Cara", "Ana", "Ben", "Niet te bepalen"],
      "explanation": "Ana > Ben > Cara, dus Cara is de jongste."
    },
    "q-logic-07": {
      "prompt": "Welke hoek maken de wijzers van de klok om precies 3:00 uur?",
      "options": ["90°", "45°", "180°", "60°"],
      "explanation": "Een kwart van een cirkel van 360° is 90°."
    },
    "q-logic-08": {
      "prompt": "Wat is het volgende getal: 3, 6, 11, 18, 27, …?",
      "options": ["38", "36", "35", "40"],
      "explanation": "De verschillen nemen steeds met 2 toe (+3, +5, +7, +9, +11)."
    },
    "q-logic-09": {
      "prompt": "Hoeveel minuten zitten er in 2,5 uur?",
      "options": ["150", "125", "250", "130"],
      "explanation": "2,5 × 60 = 150 minuten."
    },
    "q-logic-10": {
      "prompt": "Een klok geeft 9:00 aan. Hoe laat is het 15 uur later?",
      "options": ["12:00", "6:00", "3:00", "9:00"],
      "explanation": "Na 12 uur is het weer 9:00, plus nog 3 uur = 12:00."
    }
  }
}
