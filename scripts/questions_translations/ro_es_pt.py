# -*- coding: utf-8 -*-
"""
Translations for the 30 seed questions in:
- ro (Romanian with strict ș/ț/ă/â/î)
- es (Spanish)
- pt (Portuguese)
"""

DATA = {
  "ro": {
    "q-mcq-01": {
      "prompt": "Care planetă are cel mai scurt an?",
      "options": ["Mercur", "Venus", "Marte", "Pământ"],
      "explanation": "Mercur orbitează Soarele în doar 88 de zile pământești."
    },
    "q-mcq-02": {
      "prompt": "Care este capitala Australiei?",
      "options": ["Canberra", "Sydney", "Melbourne", "Perth"],
      "explanation": "Canberra a fost aleasă în 1908 ca un compromis între Sydney și Melbourne."
    },
    "q-mcq-03": {
      "prompt": "Care element chimic are simbolul „Fe”?",
      "options": ["Fier", "Fluor", "Plumb", "Staniu"],
      "explanation": "Fe provine din cuvântul latin ferrum, care înseamnă fier."
    },
    "q-mcq-04": {
      "prompt": "În ce an a căzut Zidul Berlinului?",
      "options": ["1989", "1991", "1985", "1979"],
      "explanation": "Zidul Berlinului a căzut pe 9 noiembrie 1989."
    },
    "q-mcq-05": {
      "prompt": "Care este cel mai mare ocean de pe Pământ?",
      "options": ["Pacific", "Atlantic", "Indian", "Arctic"],
      "explanation": "Oceanul Pacific acoperă peste 30% din suprafața Pământului."
    },
    "q-mcq-06": {
      "prompt": "Ce țară a dăruit Statuia Libertății Statelor Unite?",
      "options": ["Franța", "Regatul Unit", "Spania", "Italia"],
      "explanation": "Franța a dăruit Statuia Libertății Statelor Unite în 1886."
    },
    "q-mcq-07": {
      "prompt": "Cine a pictat Mona Lisa?",
      "options": ["Leonardo da Vinci", "Michelangelo", "Rafael", "Botticelli"],
      "explanation": "Leonardo da Vinci a pictat Mona Lisa la începutul anilor 1500."
    },
    "q-mcq-08": {
      "prompt": "Care este cel mai lung fluviu din America de Sud?",
      "options": ["Amazon", "Paraná", "Orinoco", "São Francisco"],
      "explanation": "Fluviul Amazon are aproximativ 6.400 km lungime."
    },
    "q-mcq-09": {
      "prompt": "Ce gaz absorb plantele din aer pentru fotosinteză?",
      "options": ["Dioxid de carbon", "Oxigen", "Azot", "Heliu"],
      "explanation": "Plantele absorb CO2 și eliberează oxigen în timpul fotosintezei."
    },
    "q-mcq-10": {
      "prompt": "Care este cel mai mic număr prim?",
      "options": ["2", "1", "3", "0"],
      "explanation": "2 este cel mai mic număr prim și singurul număr prim par."
    },
    "q-order-01": {
      "prompt": "Ordonează aceste planete după distanța de la Soare, cea mai apropiată prima:",
      "options": ["Venus", "Pământ", "Marte", "Jupiter"],
      "explanation": "De la Soare spre exterior: Mercur, Venus, Pământ, Marte, Jupiter."
    },
    "q-order-02": {
      "prompt": "Ordonează aceste evenimente de la cel mai vechi la cel mai recent:",
      "options": ["Prima aselenizare", "Căderea Zidului Berlinului", "Monedele euro intră în circulație", "Lansarea primului iPhone"],
      "explanation": "1969 → 1989 → 2002 → 2007."
    },
    "q-order-03": {
      "prompt": "Ordonează de la cel mai mic la cel mai mare:",
      "options": ["Byte", "Kilobyte", "Megabyte", "Gigabyte"],
      "explanation": "Fiecare unitate crește de 1.000 de ori (sau 1.024 în binar)."
    },
    "q-order-04": {
      "prompt": "Ordonează aceste țări după suprafață, cea mai mare prima:",
      "options": ["Rusia", "Canada", "Brazilia", "Australia"],
      "explanation": "Rusia > Canada > Brazilia > Australia după suprafață."
    },
    "q-order-05": {
      "prompt": "Ordonează aceste numere de la cel mai mic la cel mai mare:",
      "options": ["0.5", "2/3", "0.7", "3/4"],
      "explanation": "0.5 < 0.666… (2/3) < 0.7 < 0.75 (3/4)."
    },
    "q-odd-01": {
      "prompt": "Care dintre acestea NU este un mamifer?",
      "options": ["Rechinul", "Delfinul", "Liliacul", "Balena"],
      "explanation": "Rechinii sunt pești; delfinii, liliecii și balenele sunt mamifere."
    },
    "q-odd-02": {
      "prompt": "Care dintre acestea NU este un număr prim?",
      "options": ["15", "7", "11", "13"],
      "explanation": "15 se divide cu 3 și cu 5 (15 = 3 × 5)."
    },
    "q-odd-03": {
      "prompt": "Care dintre acestea NU este un instrument cu corzi?",
      "options": ["Trompeta", "Vioara", "Violoncelul", "Viola"],
      "explanation": "Trompeta este un instrument de suflat din alamă."
    },
    "q-odd-04": {
      "prompt": "Care dintre acestea NU este o capitală națională?",
      "options": ["Barcelona", "Paris", "Roma", "Madrid"],
      "explanation": "Madrid este capitala Spaniei; Barcelona este capitala Cataloniei."
    },
    "q-odd-05": {
      "prompt": "Care dintre acestea NU este o planetă?",
      "options": ["Luna", "Mercur", "Venus", "Marte"],
      "explanation": "Luna este satelitul natural al Pământului."
    },
    "q-logic-01": {
      "prompt": "Ce număr urmează: 2, 4, 8, 16, …?",
      "options": ["32", "24", "30", "18"],
      "explanation": "Fiecare număr este dublul celui anterior."
    },
    "q-logic-02": {
      "prompt": "Ce număr urmează: 1, 1, 2, 3, 5, 8, …?",
      "options": ["13", "11", "12", "15"],
      "explanation": "Șirul lui Fibonacci: 5 + 8 = 13."
    },
    "q-logic-03": {
      "prompt": "Dacă 3 pisici prind 3 șoareci în 3 minute, de câte pisici e nevoie pentru 100 de șoareci în 100 de minute?",
      "options": ["3", "100", "33", "9"],
      "explanation": "Fiecare pisică prinde 1 șoarece la fiecare 3 minute, deci 3 pisici prind 100 de șoareci în 100 de minute."
    },
    "q-logic-04": {
      "prompt": "O bâtă și o minge costă 1,10$ în total. Bâta costă cu 1,00$ mai mult decât mingea. Cât costă mingea?",
      "options": ["0,05$", "0,10$", "0,15$", "0,01$"],
      "explanation": "Mingea = 0,05$, bâta = 1,05$, total = 1,10$."
    },
    "q-logic-05": {
      "prompt": "Cât este 15% din 200?",
      "options": ["30", "15", "20", "35"],
      "explanation": "10% din 200 este 20, plus 5% (10) este egal cu 30."
    },
    "q-logic-06": {
      "prompt": "Ana este mai în vârstă decât Ben. Ben este mai în vârstă decât Cara. Cine este cel mai tânăr?",
      "options": ["Cara", "Ana", "Ben", "Nu se poate determina"],
      "explanation": "Ana > Ben > Cara, prin urmare Cara este cea mai tânără."
    },
    "q-logic-07": {
      "prompt": "Ce unghi formează limbile ceasului la ora exactă 3:00?",
      "options": ["90°", "45°", "180°", "60°"],
      "explanation": "Un sfert dintr-un cerc de 360° are 90°."
    },
    "q-logic-08": {
      "prompt": "Ce număr urmează: 3, 6, 11, 18, 27, …?",
      "options": ["38", "36", "35", "40"],
      "explanation": "Diferențele dintre numere cresc cu 2 la fiecare pas: +3, +5, +7, +9, +11."
    },
    "q-logic-09": {
      "prompt": "Câte minute sunt în 2,5 ore?",
      "options": ["150", "125", "250", "130"],
      "explanation": "2,5 × 60 = 150 de minute."
    },
    "q-logic-10": {
      "prompt": "Un ceas arată ora 9:00. Ce oră va arăta după 15 ore?",
      "options": ["12:00", "6:00", "3:00", "9:00"],
      "explanation": "După 12 ore este din nou 9:00, plus încă 3 ore = ora 12:00."
    }
  },
  "es": {
    "q-mcq-01": {
      "prompt": "¿Qué planeta tiene el año más corto?",
      "options": ["Mercurio", "Venus", "Marte", "Tierra"],
      "explanation": "Mercurio orbita alrededor del Sol en solo 88 días terrestres."
    },
    "q-mcq-02": {
      "prompt": "¿Cuál es la capital de Australia?",
      "options": ["Canberra", "Sídney", "Melbourne", "Perth"],
      "explanation": "Canberra fue elegida en 1908 como compromiso entre Sídney y Melbourne."
    },
    "q-mcq-03": {
      "prompt": "¿Qué elemento químico tiene el símbolo \"Fe\"?",
      "options": ["Hierro", "Flúor", "Plomo", "Estaño"],
      "explanation": "Fe proviene de la palabra latina ferrum, que significa hierro."
    },
    "q-mcq-04": {
      "prompt": "¿En qué año cayó el Muro de Berlín?",
      "options": ["1989", "1991", "1985", "1979"],
      "explanation": "El Muro de Berlín cayó el 9 de noviembre de 1989."
    },
    "q-mcq-05": {
      "prompt": "¿Cuál es el océano más grande de la Tierra?",
      "options": ["Pacífico", "Atlántico", "Índico", "Ártico"],
      "explanation": "El océano Pacífico cubre más del 30% de la superficie terrestre."
    },
    "q-mcq-06": {
      "prompt": "¿Qué país regaló la Estatua de la Libertad a Estados Unidos?",
      "options": ["Francia", "Reino Unido", "España", "Italia"],
      "explanation": "Francia regaló la Estatua de la Libertad a EE. UU. en 1886."
    },
    "q-mcq-07": {
      "prompt": "¿Quién pintó la Mona Lisa?",
      "options": ["Leonardo da Vinci", "Miguel Ángel", "Rafael", "Botticelli"],
      "explanation": "Leonardo da Vinci pintó la Mona Lisa a principios del siglo XVI."
    },
    "q-mcq-08": {
      "prompt": "¿Cuál es el río más largo de América del Sur?",
      "options": ["Amazonas", "Paraná", "Orinoco", "São Francisco"],
      "explanation": "El río Amazonas tiene unos 6.400 km de longitud."
    },
    "q-mcq-09": {
      "prompt": "¿Qué gas absorben principalmente las plantas del aire para la fotosíntesis?",
      "options": ["Dióxido de carbono", "Oxígeno", "Nitrógeno", "Helio"],
      "explanation": "Las plantas absorben CO2 y liberan oxígeno durante la fotosíntesis."
    },
    "q-mcq-10": {
      "prompt": "¿Cuál es el número primo más pequeño?",
      "options": ["2", "1", "3", "0"],
      "explanation": "El 2 es el número primo más pequeño y el único primo par."
    },
    "q-order-01": {
      "prompt": "Ordena estos planetas por distancia al Sol, el más cercano primero:",
      "options": ["Venus", "Tierra", "Marte", "Júpiter"],
      "explanation": "Desde el Sol hacia afuera: Mercurio, Venus, Tierra, Marte, Júpiter."
    },
    "q-order-02": {
      "prompt": "Ordena estos eventos de más antiguo a más reciente:",
      "options": ["Primer alunizaje", "Caída del Muro de Berlín", "El euro entra en circulación", "Lanzamiento del primer iPhone"],
      "explanation": "1969 → 1989 → 2002 → 2007."
    },
    "q-order-03": {
      "prompt": "Ordena de menor a mayor:",
      "options": ["Byte", "Kilobyte", "Megabyte", "Gigabyte"],
      "explanation": "Cada unidad aumenta por 1.000 (o 1.024 en binario)."
    },
    "q-order-04": {
      "prompt": "Ordena estos países por superficie, el más grande primero:",
      "options": ["Rusia", "Canadá", "Brasil", "Australia"],
      "explanation": "Rusia > Canadá > Brasil > Australia por superficie terrestre."
    },
    "q-order-05": {
      "prompt": "Ordena estos números de menor a mayor:",
      "options": ["0.5", "2/3", "0.7", "3/4"],
      "explanation": "0.5 < 0.666… (2/3) < 0.7 < 0.75 (3/4)."
    },
    "q-odd-01": {
      "prompt": "¿Cuál NO es un mamífero?",
      "options": ["Tiburón", "Delfín", "Murciélago", "Ballena"],
      "explanation": "Los tiburones son peces; los delfines, murciélagos y ballenas son mamíferos."
    },
    "q-odd-02": {
      "prompt": "¿Cuál NO es un número primo?",
      "options": ["15", "7", "11", "13"],
      "explanation": "15 es divisible por 3 y 5 (15 = 3 × 5)."
    },
    "q-odd-03": {
      "prompt": "¿Cuál NO es un instrumento de cuerda?",
      "options": ["Trompeta", "Violín", "Violonchelo", "Viola"],
      "explanation": "La trompeta es un instrumento de viento metal."
    },
    "q-odd-04": {
      "prompt": "¿Cuál NO es una capital nacional?",
      "options": ["Barcelona", "París", "Roma", "Madrid"],
      "explanation": "Madrid es la capital de España; Barcelona es la capital de Cataluña."
    },
    "q-odd-05": {
      "prompt": "¿Cuál NO es un planeta?",
      "options": ["La Luna", "Mercurio", "Venus", "Marte"],
      "explanation": "La Luna es el satélite natural de la Tierra."
    },
    "q-logic-01": {
      "prompt": "¿Qué número sigue: 2, 4, 8, 16, …?",
      "options": ["32", "24", "30", "18"],
      "explanation": "Cada número duplica al anterior."
    },
    "q-logic-02": {
      "prompt": "¿Qué número sigue: 1, 1, 2, 3, 5, 8, …?",
      "options": ["13", "11", "12", "15"],
      "explanation": "Sucesión de Fibonacci: 5 + 8 = 13."
    },
    "q-logic-03": {
      "prompt": "Si 3 gatos cazan 3 ratones en 3 minutos, ¿cuántos gatos se necesitan para cazar 100 ratones en 100 minutos?",
      "options": ["3", "100", "33", "9"],
      "explanation": "Cada gato caza 1 ratón cada 3 minutos, por lo que 3 gatos cazan 100 ratones en 100 minutos."
    },
    "q-logic-04": {
      "prompt": "Un bate y una pelota cuestan 1,10$ en total. El bate cuesta 1,00$ más que la pelota. ¿Cuánto cuesta la pelota?",
      "options": ["0,05$", "0,10$", "0,15$", "0,01$"],
      "explanation": "Pelota = 0,05$, bate = 1,05$, total = 1,10$."
    },
    "q-logic-05": {
      "prompt": "¿Cuánto es el 15% de 200?",
      "options": ["30", "15", "20", "35"],
      "explanation": "El 10% de 200 es 20, más el 5% (10) es igual a 30."
    },
    "q-logic-06": {
      "prompt": "Ana es mayor que Ben. Ben es mayor que Cara. ¿Quién es la persona más joven?",
      "options": ["Cara", "Ana", "Ben", "No se puede saber"],
      "explanation": "Ana > Ben > Cara, por lo que Cara es la más joven."
    },
    "q-logic-07": {
      "prompt": "¿Qué ángulo forman las agujas del reloj a las 3:00 en punto?",
      "options": ["90°", "45°", "180°", "60°"],
      "explanation": "Un cuarto de un círculo de 360° es 90°."
    },
    "q-logic-08": {
      "prompt": "¿Qué número sigue: 3, 6, 11, 18, 27, …?",
      "options": ["38", "36", "35", "40"],
      "explanation": "Las diferencias aumentan en 2 en cada paso (+3, +5, +7, +9, +11)."
    },
    "q-logic-09": {
      "prompt": "¿Cuántos minutos hay en 2,5 horas?",
      "options": ["150", "125", "250", "130"],
      "explanation": "2,5 × 60 = 150 minutos."
    },
    "q-logic-10": {
      "prompt": "Un reloj marca las 9:00. ¿Qué hora marcará 15 horas después?",
      "options": ["12:00", "6:00", "3:00", "9:00"],
      "explanation": "En un reloj de 12 horas, tras 12 horas vuelve a ser 9:00, más 3 horas = 12:00."
    }
  },
  "pt": {
    "q-mcq-01": {
      "prompt": "Qual planeta tem o ano mais curto?",
      "options": ["Mercúrio", "Vênus", "Marte", "Terra"],
      "explanation": "Mercúrio orbita o Sol em apenas 88 dias terrestres."
    },
    "q-mcq-02": {
      "prompt": "Qual é a capital da Austrália?",
      "options": ["Camberra", "Sydney", "Melbourne", "Perth"],
      "explanation": "Camberra foi escolhida em 1908 como acordo entre Sydney e Melbourne."
    },
    "q-mcq-03": {
      "prompt": "Qual elemento químico tem o símbolo \"Fe\"?",
      "options": ["Ferro", "Flúor", "Chumbo", "Estanho"],
      "explanation": "Fe vem da palavra latina ferrum, que significa ferro."
    },
    "q-mcq-04": {
      "prompt": "Em que ano caiu o Muro de Berlim?",
      "options": ["1989", "1991", "1985", "1979"],
      "explanation": "O Muro de Berlim caiu a 9 de novembro de 1989."
    },
    "q-mcq-05": {
      "prompt": "Qual é o maior oceano da Terra?",
      "options": ["Pacífico", "Atlântico", "Índico", "Ártico"],
      "explanation": "O Oceano Pacífico cobre mais de 30% da superfície da Terra."
    },
    "q-mcq-06": {
      "prompt": "Que país ofereceu a Estátua da Liberdade aos Estados Unidos?",
      "options": ["França", "Reino Unido", "Espanha", "Itália"],
      "explanation": "A França presenteou os EUA com a Estátua da Liberdade em 1886."
    },
    "q-mcq-07": {
      "prompt": "Quem pintou a Mona Lisa?",
      "options": ["Leonardo da Vinci", "Michelangelo", "Rafael", "Botticelli"],
      "explanation": "Leonardo da Vinci pintou a Mona Lisa no início do século XVI."
    },
    "q-mcq-08": {
      "prompt": "Qual é o rio mais longo da América do Sul?",
      "options": ["Amazonas", "Paraná", "Orinoco", "São Francisco"],
      "explanation": "O rio Amazonas estende-se por cerca de 6.400 km."
    },
    "q-mcq-09": {
      "prompt": "Que gás as plantas absorvem do ar para a fotossíntese?",
      "options": ["Dióxido de carbono", "Oxigénio", "Azoto", "Hélio"],
      "explanation": "As plantas absorvem CO2 e libertam oxigénio durante a fotossíntese."
    },
    "q-mcq-10": {
      "prompt": "Qual é o menor número primo?",
      "options": ["2", "1", "3", "0"],
      "explanation": "2 é o menor número primo e o único primo par."
    },
    "q-order-01": {
      "prompt": "Ordena estes planetas por distância ao Sol, o mais próximo primeiro:",
      "options": ["Vênus", "Terra", "Marte", "Júpiter"],
      "explanation": "Do Sol para fora: Mercúrio, Vênus, Terra, Marte, Júpiter."
    },
    "q-order-02": {
      "prompt": "Ordena estes acontecimentos do mais antigo ao mais recente:",
      "options": ["Primeira alunissagem", "Queda do Muro de Berlim", "O euro entra em circulação", "Lançamento do primeiro iPhone"],
      "explanation": "1969 → 1989 → 2002 → 2007."
    },
    "q-order-03": {
      "prompt": "Ordena do menor para o maior:",
      "options": ["Byte", "Kilobyte", "Megabyte", "Gigabyte"],
      "explanation": "Cada unidade aumenta por 1.000 (ou 1.024 em binário)."
    },
    "q-order-04": {
      "prompt": "Ordena estes países por área terrestre, o maior primeiro:",
      "options": ["Rússia", "Canadá", "Brasil", "Austrália"],
      "explanation": "Rússia > Canadá > Brasil > Austrália em extensão territorial."
    },
    "q-order-05": {
      "prompt": "Ordena estes números do menor para o maior:",
      "options": ["0.5", "2/3", "0.7", "3/4"],
      "explanation": "0.5 < 0.666… (2/3) < 0.7 < 0.75 (3/4)."
    },
    "q-odd-01": {
      "prompt": "Qual NÃO é um mamífero?",
      "options": ["Tubarão", "Golfinho", "Morcego", "Baleia"],
      "explanation": "Tubarões são peixes; golfinhos, morcegos e baleias são mamíferos."
    },
    "q-odd-02": {
      "prompt": "Qual NÃO é um número primo?",
      "options": ["15", "7", "11", "13"],
      "explanation": "15 é divisível por 3 e 5 (15 = 3 × 5)."
    },
    "q-odd-03": {
      "prompt": "Qual NÃO é um instrumento de cordas?",
      "options": ["Trompete", "Violino", "Violoncelo", "Viola"],
      "explanation": "O trompete é um instrumento de sopro de metal."
    },
    "q-odd-04": {
      "prompt": "Qual NÃO é uma capital nacional?",
      "options": ["Barcelona", "Paris", "Roma", "Madrid"],
      "explanation": "Madrid é a capital de Espanha; Barcelona é a capital da Catalunha."
    },
    "q-odd-05": {
      "prompt": "Qual NÃO é um planeta?",
      "options": ["A Lua", "Mercúrio", "Vênus", "Marte"],
      "explanation": "A Lua é o satélite natural da Terra."
    },
    "q-logic-01": {
      "prompt": "Que número vem a seguir: 2, 4, 8, 16, …?",
      "options": ["32", "24", "30", "18"],
      "explanation": "Cada número duplica o anterior."
    },
    "q-logic-02": {
      "prompt": "Que número vem a seguir: 1, 1, 2, 3, 5, 8, …?",
      "options": ["13", "11", "12", "15"],
      "explanation": "Sequência de Fibonacci: 5 + 8 = 13."
    },
    "q-logic-03": {
      "prompt": "Se 3 gatos apanham 3 ratos em 3 minutos, quantos gatos são precisos para 100 ratos em 100 minutos?",
      "options": ["3", "100", "33", "9"],
      "explanation": "Cada gato apanha 1 rato a cada 3 minutos, logo 3 gatos apanham 100 ratos em 100 minutos."
    },
    "q-logic-04": {
      "prompt": "Um taco e uma bola custam 1,10$ no total. O taco custa 1,00$ a mais que a bola. Quanto custa a bola?",
      "options": ["0,05$", "0,10$", "0,15$", "0,01$"],
      "explanation": "Bola = 0,05$, taco = 1,05$, total = 1,10$."
    },
    "q-logic-05": {
      "prompt": "Quanto é 15% de 200?",
      "options": ["30", "15", "20", "35"],
      "explanation": "10% de 200 é 20, mais 5% (10) é igual a 30."
    },
    "q-logic-06": {
      "prompt": "A Ana é mais velha que o Ben. O Ben é mais velho que a Cara. Quem é a pessoa mais jovem?",
      "options": ["Cara", "Ana", "Ben", "Não é possível saber"],
      "explanation": "Ana > Ben > Cara, logo a Cara é a mais jovem."
    },
    "q-logic-07": {
      "prompt": "Que ângulo formam os ponteiros do relógio exatamente às 3:00?",
      "options": ["90°", "45°", "180°", "60°"],
      "explanation": "Um quarto de círculo de 360° é 90°."
    },
    "q-logic-08": {
      "prompt": "Que número vem a seguir: 3, 6, 11, 18, 27, …?",
      "options": ["38", "36", "35", "40"],
      "explanation": "As diferenças aumentam de 2 em 2 (+3, +5, +7, +9, +11)."
    },
    "q-logic-09": {
      "prompt": "Quantos minutos há em 2,5 horas?",
      "options": ["150", "125", "250", "130"],
      "explanation": "2,5 × 60 = 150 minutos."
    },
    "q-logic-10": {
      "prompt": "Um relógio marca as 9:00. Que horas marcará 15 horas depois?",
      "options": ["12:00", "6:00", "3:00", "9:00"],
      "explanation": "Após 12 horas volta a ser 9:00, mais 3 horas = 12:00."
    }
  }
}
