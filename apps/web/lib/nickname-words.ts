import type { Locale } from '@ronduel/shared';

export interface NicknameWordList {
  nouns: string[];
  adjectives: string[];
  feminineNouns?: string[];
  feminineAdjectives?: string[];
}

export const NICKNAME_WORDS: Record<Locale, NicknameWordList> = {
  "en": {
    "nouns": [
      "Fox",
      "Wolf",
      "Falcon",
      "Bear",
      "Eagle",
      "Stag",
      "Lynx",
      "Tiger",
      "Lion",
      "Otter",
      "Dolphin",
      "Raven",
      "Owl",
      "Bison"
    ],
    "adjectives": [
      "Swift",
      "Quick",
      "Brave",
      "Bold",
      "Wise",
      "Agile",
      "Mighty",
      "Clever",
      "Fearless",
      "Nimble"
    ]
  },
  "ro": {
    "nouns": [
      "Lupul",
      "\u0218oimul",
      "Ursul",
      "Vulturul",
      "Cerbul",
      "Castorul",
      "Ariciul",
      "R\u00e2sul",
      "Tigrul",
      "Leul",
      "Delfinul",
      "Corbul",
      "Zimbrul",
      "Vulpea",
      "Puma",
      "Pantera",
      "Vidra",
      "Bufni\u021ba"
    ],
    "adjectives": [
      "Rapid",
      "Viteaz",
      "Curajos",
      "\u00cen\u021belept",
      "Agil",
      "Puternic",
      "Iste\u021b",
      "Ne\u00eenfricat",
      "Sprinten",
      "Vigilent"
    ],
    "feminineNouns": [
      "Vulpea",
      "Puma",
      "Pantera",
      "Vidra",
      "Bufni\u021ba"
    ],
    "feminineAdjectives": [
      "Rapid\u0103",
      "Viteaz\u0103",
      "Curajoas\u0103",
      "\u00cen\u021beleapt\u0103",
      "Agil\u0103",
      "Puternic\u0103",
      "Istea\u021b\u0103",
      "Ne\u00eenfricat\u0103",
      "Sprinten\u0103",
      "Vigilent\u0103"
    ]
  },
  "de": {
    "nouns": [
      "Fuchs",
      "Wolf",
      "Falke",
      "Bär",
      "Adler",
      "Hirsch",
      "Luchs",
      "Tiger",
      "Löwe",
      "Otter",
      "Delfin",
      "Rabe",
      "Eule",
      "Bison"
    ],
    "adjectives": [
      "Flink",
      "Schnell",
      "Mutig",
      "Kühn",
      "Weise",
      "Gewandt",
      "Mächtig",
      "Schlau",
      "Furchtlos",
      "Wendig"
    ]
  },
  "fr": {
    "nouns": [
      "Renard",
      "Loup",
      "Faucon",
      "Ours",
      "Aigle",
      "Cerf",
      "Lynx",
      "Tigre",
      "Lion",
      "Loutre",
      "Dauphin",
      "Corbeau",
      "Hibou",
      "Bison"
    ],
    "adjectives": [
      "Vif",
      "Rapide",
      "Brave",
      "Hardi",
      "Sage",
      "Agile",
      "Puissant",
      "Malin",
      "Intrépide",
      "Leste"
    ]
  },
  "es": {
    "nouns": [
      "Zorro",
      "Lobo",
      "Halcón",
      "Oso",
      "Águila",
      "Ciervo",
      "Lince",
      "Tigre",
      "León",
      "Nutria",
      "Delfín",
      "Cuervo",
      "Búho",
      "Bisonte"
    ],
    "adjectives": [
      "Veloz",
      "Rápido",
      "Valiente",
      "Audaz",
      "Sabio",
      "Ágil",
      "Poderoso",
      "Listo",
      "Intrépido",
      "Diestro"
    ]
  },
  "it": {
    "nouns": [
      "Volpe",
      "Lupo",
      "Falco",
      "Orso",
      "Aquila",
      "Cervo",
      "Lince",
      "Tigre",
      "Leone",
      "Lontra",
      "Delfino",
      "Corvo",
      "Gufo",
      "Bisonte"
    ],
    "adjectives": [
      "Veloce",
      "Rapido",
      "Audace",
      "Fiero",
      "Saggio",
      "Agile",
      "Possente",
      "Scaltro",
      "Intrepido",
      "Scattante"
    ]
  },
  "pt": {
    "nouns": [
      "Raposa",
      "Lobo",
      "Falcão",
      "Urso",
      "Águia",
      "Cervo",
      "Lince",
      "Tigre",
      "Leão",
      "Lontra",
      "Golfinho",
      "Corvo",
      "Coruja",
      "Bisão"
    ],
    "adjectives": [
      "Veloz",
      "Rápido",
      "Corajoso",
      "Audaz",
      "Sábio",
      "Ágil",
      "Poderoso",
      "Esperto",
      "Intrépido",
      "Ágil"
    ]
  },
  "nl": {
    "nouns": [
      "Vos",
      "Wolf",
      "Valk",
      "Beer",
      "Arend",
      "Hert",
      "Lynx",
      "Tijger",
      "Leeuw",
      "Otter",
      "Dolfijn",
      "Raaf",
      "Uil",
      "Bizon"
    ],
    "adjectives": [
      "Snel",
      "Vlug",
      "Dapper",
      "Koen",
      "Wijs",
      "Lenig",
      "Machtig",
      "Slim",
      "Vreesloos",
      "Vief"
    ]
  },
  "pl": {
    "nouns": [
      "Lis",
      "Wilk",
      "Sokół",
      "Niedźwiedź",
      "Orzeł",
      "Jeleń",
      "Ryś",
      "Tygrys",
      "Lew",
      "Wydra",
      "Delfin",
      "Kruk",
      "Sowa",
      "Żubr"
    ],
    "adjectives": [
      "Szybki",
      "Bystry",
      "Odważny",
      "Śmiały",
      "Mądry",
      "Zwinny",
      "Potężny",
      "Sprytny",
      "Nieugięty",
      "Żwawy"
    ]
  },
  "cs": {
    "nouns": [
      "Lišák",
      "Vlk",
      "Sokol",
      "Medvěd",
      "Orel",
      "Jelen",
      "Rys",
      "Tygr",
      "Lev",
      "Vydra",
      "Delfín",
      "Krkavec",
      "Sova",
      "Zubr"
    ],
    "adjectives": [
      "Rychlý",
      "Bystrý",
      "Odvážný",
      "Smělý",
      "Moudrý",
      "Hbitý",
      "Mocný",
      "Chytrý",
      "Nebojácný",
      "Čilý"
    ]
  },
  "sk": {
    "nouns": [
      "Lišiak",
      "Vlk",
      "Sokol",
      "Medveď",
      "Orol",
      "Jeleň",
      "Rys",
      "Tiger",
      "Lev",
      "Vydra",
      "Delfín",
      "Krkavec",
      "Sova",
      "Zubor"
    ],
    "adjectives": [
      "Rýchly",
      "Bystrý",
      "Odvážny",
      "Smelý",
      "Múdry",
      "Hbitý",
      "Mocný",
      "Múdry",
      "Nebojácny",
      "Čulý"
    ]
  },
  "bg": {
    "nouns": [
      "Лисица",
      "Вълк",
      "Сокол",
      "Мечка",
      "Орел",
      "Елен",
      "Рис",
      "Тигър",
      "Лъв",
      "Видра",
      "Делфин",
      "Гарван",
      "Бухал",
      "Бизон"
    ],
    "adjectives": [
      "Бърз",
      "Смел",
      "Дързък",
      "Мъдър",
      "Пъргав",
      "Могъщ",
      "Хитър",
      "Безстрашен",
      "Ловък",
      "Стремителен"
    ]
  },
  "hr": {
    "nouns": [
      "Lisac",
      "Vuk",
      "Sokol",
      "Medvjed",
      "Orao",
      "Jelen",
      "Ris",
      "Tigar",
      "Lav",
      "Vidra",
      "Delfin",
      "Gavran",
      "Sova",
      "Bizon"
    ],
    "adjectives": [
      "Brzi",
      "Hrabri",
      "Smjeli",
      "Mudri",
      "Okretni",
      "Moćni",
      "Vješti",
      "Neustrašivi",
      "Hitri",
      "Oštroumni"
    ]
  },
  "sl": {
    "nouns": [
      "Lisjak",
      "Volk",
      "Sokol",
      "Medved",
      "Orel",
      "Jelen",
      "Ris",
      "Tiger",
      "Lev",
      "Vidra",
      "Delfin",
      "Krokar",
      "Sova",
      "Bizon"
    ],
    "adjectives": [
      "Hitri",
      "Pogumni",
      "Drzni",
      "Modri",
      "Okretni",
      "Močni",
      "Prebrisani",
      "Neustrašni",
      "Poskočni",
      "Bistri"
    ]
  },
  "uk": {
    "nouns": [
      "Лис",
      "Вовк",
      "Сокіл",
      "Ведмідь",
      "Орел",
      "Олень",
      "Рись",
      "Тигр",
      "Лев",
      "Видра",
      "Дельфін",
      "Крук",
      "Сова",
      "Бізон"
    ],
    "adjectives": [
      "Швидкий",
      "Хоробрий",
      "Сміливий",
      "Мудрий",
      "Спритний",
      "Могутній",
      "Розумний",
      "Безстрашний",
      "Прудкий",
      "Кмітливий"
    ]
  },
  "sv": {
    "nouns": [
      "Räv",
      "Varg",
      "Falk",
      "Björn",
      "Örn",
      "Hjort",
      "Lodjur",
      "Tiger",
      "Lejon",
      "Utter",
      "Delfin",
      "Korp",
      "Uggla",
      "Bison"
    ],
    "adjectives": [
      "Snabb",
      "Kvik",
      "Modig",
      "Djärv",
      "Klok",
      "Smidig",
      "Mäktig",
      "Klyftig",
      "Orädd",
      "Vig"
    ]
  },
  "da": {
    "nouns": [
      "Ræv",
      "Ulv",
      "Falk",
      "Bjørn",
      "Ørn",
      "Hjort",
      "Los",
      "Tiger",
      "Løve",
      "Odder",
      "Delfin",
      "Ravn",
      "Ugle",
      "Bison"
    ],
    "adjectives": [
      "Hurtig",
      "Kvik",
      "Modig",
      "Dristig",
      "Klog",
      "Smidig",
      "Mægtig",
      "Snild",
      "Frygtløs",
      "Vaks"
    ]
  },
  "nb": {
    "nouns": [
      "Rev",
      "Ulv",
      "Falk",
      "Bjørn",
      "Ørn",
      "Hjort",
      "Gaupe",
      "Tiger",
      "Løve",
      "Oter",
      "Delfin",
      "Ravn",
      "Ugle",
      "Bison"
    ],
    "adjectives": [
      "Rask",
      "Kjapp",
      "Modig",
      "Dristig",
      "Klok",
      "Smidig",
      "Mektig",
      "Skarp",
      "Fryktløs",
      "Kvikk"
    ]
  },
  "fi": {
    "nouns": [
      "Kettu",
      "Susi",
      "Haukka",
      "Karhu",
      "Kotka",
      "Peura",
      "Ilves",
      "Tiikeri",
      "Leijona",
      "Saukko",
      "Delfiini",
      "Korppi",
      "Pöllö",
      "Piisoni"
    ],
    "adjectives": [
      "Nopea",
      "Sukkela",
      "Rohkea",
      "Uljas",
      "Viisas",
      "Kettera",
      "Mahtava",
      "Nokkela",
      "Peloton",
      "Vilkast"
    ]
  },
  "et": {
    "nouns": [
      "Rebane",
      "Hunt",
      "Pistrik",
      "Karu",
      "Kotkas",
      "Hirv",
      "Ilves",
      "Tiiger",
      "Lõvi",
      "Saarmas",
      "Delfiin",
      "Kaaren",
      "Öökull",
      "Piison"
    ],
    "adjectives": [
      "Kiire",
      "Nobe",
      "Julge",
      "Vapper",
      "Tark",
      "Vilgas",
      "Võimas",
      "Kaval",
      "Kartmatu",
      "Krapsakas"
    ]
  },
  "lt": {
    "nouns": [
      "Lapė",
      "Vilkas",
      "Sakalas",
      "Lokys",
      "Erelis",
      "Elnias",
      "Lūšis",
      "Tigras",
      "Liūtas",
      "Ūdra",
      "Delfinas",
      "Varnas",
      "Pelėda",
      "Stumbras"
    ],
    "adjectives": [
      "Greitas",
      "Vikrus",
      "Drąsus",
      "Narsus",
      "Išmintingas",
      "Galingas",
      "Gudrus",
      "Bebaimis",
      "Žvitrus",
      "Budrus"
    ]
  },
  "lv": {
    "nouns": [
      "Lapsa",
      "Vilks",
      "Piekūns",
      "Lācis",
      "Ērglis",
      "Briedis",
      "Lūsis",
      "Tīģeris",
      "Lauva",
      "Ūdrs",
      "Delfīns",
      "Krauklis",
      "Pūce",
      "Bizons"
    ],
    "adjectives": [
      "Ātrs",
      "Veikls",
      "Drosmīgs",
      "Drošsirdīgs",
      "Gudrs",
      "Vājš",
      "Varens",
      "Attapīgs",
      "Bessbailīgs",
      "Možs"
    ]
  },
  "hu": {
    "nouns": [
      "Róka",
      "Farkas",
      "Sólyom",
      "Medve",
      "Sas",
      "Szarvas",
      "Hiúz",
      "Tigris",
      "Oroszlán",
      "Vidra",
      "Delfin",
      "Holló",
      "Bagoly",
      "Bölény"
    ],
    "adjectives": [
      "Gyors",
      "Fürge",
      "Bátor",
      "Merész",
      "Bölcs",
      "Ügyes",
      "Hatalmas",
      "Okos",
      "Rettenthetetlen",
      "Éber"
    ]
  },
  "el": {
    "nouns": [
      "Αλεπού",
      "Λύκος",
      "Γεράκι",
      "Αρκούδα",
      "Αετός",
      "Ελάφι",
      "Λύγκας",
      "Τίγρης",
      "Λιοντάρι",
      "Βίδρα",
      "Δελφίνι",
      "Κόρακας",
      "Κουκουβάγια",
      "Βίσονας"
    ],
    "adjectives": [
      "Γρήγορος",
      "Ταχύς",
      "Γενναίος",
      "Τολμηρός",
      "Σοφός",
      "Ευέλικτος",
      "Ισχυρός",
      "Έξυπνος",
      "Άφοβος",
      "Σβέλτος"
    ]
  },
  "ga": {
    "nouns": [
      "Sionnach",
      "MacTíre",
      "Fabhcún",
      "Béar",
      "Iolar",
      "Fia",
      "Lincse",
      "Tíogar",
      "Leon",
      "Dobharchú",
      "Deilf",
      "Fiach",
      "Ulchabhán",
      "Bíosún"
    ],
    "adjectives": [
      "Tapa",
      "Gasta",
      "Cróga",
      "Dána",
      "Críonna",
      "Aclaí",
      "Cumhachtach",
      "Cliste",
      "Neamheaglach",
      "Fuinniúil"
    ]
  },
  "mt": {
    "nouns": [
      "Volpi",
      "Lupu",
      "Falkun",
      "Ors",
      "Ajkla",
      "Cerv",
      "Lincie",
      "Tigra",
      "Iljun",
      "Lontra",
      "Dnfil",
      "Ċawlun",
      "Kokka",
      "Bisonte"
    ],
    "adjectives": [
      "Ħafif",
      "Mgħaġġel",
      "Kuraġġuż",
      "Bold",
      "Għaref",
      "Aġli",
      "Qawwi",
      "Intelliġenti",
      "BlaBiża",
      "Żust"
    ]
  }
};

export function generateReadableNickname(locale: string = 'en'): string {
  const loc = (locale in NICKNAME_WORDS ? locale : 'en') as Locale;
  const wordData = NICKNAME_WORDS[loc] || NICKNAME_WORDS.en;

  let noun: string;
  let adj: string;

  if (loc === 'ro' && wordData.feminineNouns && wordData.feminineAdjectives) {
    const isFem = Math.random() < 0.35;
    if (isFem) {
      noun = wordData.feminineNouns[Math.floor(Math.random() * wordData.feminineNouns.length)]!;
      adj = wordData.feminineAdjectives[Math.floor(Math.random() * wordData.feminineAdjectives.length)]!;
    } else {
      const mascNouns = wordData.nouns.filter((n) => !wordData.feminineNouns!.includes(n));
      noun = mascNouns[Math.floor(Math.random() * mascNouns.length)]!;
      adj = wordData.adjectives[Math.floor(Math.random() * wordData.adjectives.length)]!;
    }
  } else {
    noun = wordData.nouns[Math.floor(Math.random() * wordData.nouns.length)]!;
    adj = wordData.adjectives[Math.floor(Math.random() * wordData.adjectives.length)]!;
  }

  const num = Math.floor(10 + Math.random() * 90);
  const name = `${noun} ${adj} ${num}`;
  return name.slice(0, 20);
}
