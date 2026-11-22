import { GoogleGenAI } from '@google/genai';
import type { Locale, QuestionType } from '@ronduel/shared';

export interface LocalizedQuestionDraft {
  prompt: string;
  options: [string, string, string, string];
  explanation: string;
}

export interface GeneratedDraftTemplate {
  type: QuestionType;
  correctIndex?: number;
  content: Partial<Record<Locale, LocalizedQuestionDraft>> & Record<'ro' | 'en', LocalizedQuestionDraft>;
}

export const CURATED_TOPIC_BANK: Record<string, GeneratedDraftTemplate[]> = {
  astronomy: [
    {
      type: 'mcq',
      correctIndex: 0,
      content: {
        ro: {
          prompt: 'Care este cea mai mare planetă din Sistemul nostru Solar?',
          options: ['Jupiter', 'Saturn', 'Neptun', 'Uranus'],
          explanation:
            'Jupiter are o masă de peste două ori mai mare decât toate celelalte planete la un loc.',
        },
        en: {
          prompt: 'Which is the largest planet in our Solar System?',
          options: ['Jupiter', 'Saturn', 'Neptune', 'Uranus'],
          explanation: 'Jupiter is more than twice as massive as all the other planets combined.',
        },
        es: {
          prompt: '¿Cuál es el planeta más grande de nuestro Sistema Solar?',
          options: ['Júpiter', 'Saturno', 'Neptuno', 'Urano'],
          explanation: 'Júpiter tiene más del doble de masa que todos los demás planetas juntos.',
        },
        pt: {
          prompt: 'Qual é o maior planeta do nosso Sistema Solar?',
          options: ['Júpiter', 'Saturno', 'Netuno', 'Urano'],
          explanation:
            'Júpiter tem mais do que o dobro da massa de todos os outros planetas juntos.',
        },
      },
    },
    {
      type: 'mcq',
      correctIndex: 0,
      content: {
        ro: {
          prompt: 'Care este cea mai apropiată stea de Pământ, după Soare?',
          options: ['Proxima Centauri', 'Sirius', 'Betelgeuse', 'Vega'],
          explanation: 'Proxima Centauri se află la aproximativ 4,24 ani-lumină de Sistemul Solar.',
        },
        en: {
          prompt: 'Which is the closest star to Earth after the Sun?',
          options: ['Proxima Centauri', 'Sirius', 'Betelgeuse', 'Vega'],
          explanation:
            'Proxima Centauri is located about 4.24 light-years away from the Solar System.',
        },
        es: {
          prompt: '¿Cuál es la estrella más cercana a la Tierra después del Sol?',
          options: ['Próxima Centauri', 'Sirio', 'Betelgeuse', 'Vega'],
          explanation: 'Próxima Centauri se encuentra a unos 4,24 años luz del Sistema Solar.',
        },
        pt: {
          prompt: 'Qual é a estrela mais próxima da Terra depois do Sol?',
          options: ['Proxima Centauri', 'Sirius', 'Betelgeuse', 'Vega'],
          explanation: 'Proxima Centauri está a cerca de 4,24 anos-luz do Sistema Solar.',
        },
      },
    },
    {
      type: 'mcq',
      correctIndex: 0,
      content: {
        ro: {
          prompt: 'Pe ce planetă din Sistemul Solar se află vulcanul gigant Olympus Mons?',
          options: ['Marte', 'Venus', 'Mercur', 'Jupiter'],
          explanation:
            'Olympus Mons de pe Marte are aproximativ 22 km înălțime, fiind cel mai înalt vulcan planetar cunoscut.',
        },
        en: {
          prompt: 'On which planet in the Solar System is the giant volcano Olympus Mons located?',
          options: ['Mars', 'Venus', 'Mercury', 'Jupiter'],
          explanation:
            'Olympus Mons on Mars stands about 22 km high, making it the tallest known planetary volcano.',
        },
        es: {
          prompt: '¿En qué planeta del Sistema Solar se encuentra el volcán gigante Olympus Mons?',
          options: ['Marte', 'Venus', 'Mercurio', 'Júpiter'],
          explanation:
            'El Monte Olimpo en Marte mide unos 22 km de altura, el volcán planetario más alto conocido.',
        },
        pt: {
          prompt: 'Em qual planeta do Sistema Solar fica o vulcão gigante Olympus Mons?',
          options: ['Marte', 'Vênus', 'Mercúrio', 'Júpiter'],
          explanation:
            'O Olympus Mons em Marte tem cerca de 22 km de altura, o maior vulcão planetário conhecido.',
        },
      },
    },
    {
      type: 'order',
      content: {
        ro: {
          prompt: 'Ordonează planetele de la cea mai apropiată la cea mai îndepărtată de Soare:',
          options: ['Mercur', 'Venus', 'Pământ', 'Marte'],
          explanation:
            'Cele patru planete telurice interioare sunt Mercur, Venus, Pământ și Marte.',
        },
        en: {
          prompt: 'Order the planets from closest to farthest from the Sun:',
          options: ['Mercury', 'Venus', 'Earth', 'Mars'],
          explanation: 'The four inner rocky planets are Mercury, Venus, Earth, and Mars.',
        },
        es: {
          prompt: 'Ordena los planetas del más cercano al más lejano al Sol:',
          options: ['Mercurio', 'Venus', 'Tierra', 'Marte'],
          explanation:
            'Los cuatro planetas rocosos interiores son Mercurio, Venus, Tierra y Marte.',
        },
        pt: {
          prompt: 'Ordene os planetas do mais próximo ao mais distante do Sol:',
          options: ['Mercúrio', 'Vênus', 'Terra', 'Marte'],
          explanation: 'Os quatro planetas rochosos internos são Mercúrio, Vênus, Terra e Marte.',
        },
      },
    },
    {
      type: 'odd',
      correctIndex: 0,
      content: {
        ro: {
          prompt: 'Găsește intrusul: care dintre următoarele NU este o planetă din Sistemul Solar?',
          options: ['Sirius', 'Neptun', 'Saturn', 'Venus'],
          explanation:
            'Sirius este o stea (cea mai strălucitoare de pe cerul nopții), nu o planetă.',
        },
        en: {
          prompt: 'Find the odd one out: which of these is NOT a planet in our Solar System?',
          options: ['Sirius', 'Neptune', 'Saturn', 'Venus'],
          explanation: 'Sirius is a star (the brightest in the night sky), not a planet.',
        },
        es: {
          prompt: 'Encuentra al intruso: ¿cuál de estos NO es un planeta del Sistema Solar?',
          options: ['Sirio', 'Neptuno', 'Saturno', 'Venus'],
          explanation:
            'Sirio es una estrella (la más brillante del cielo nocturno), no un planeta.',
        },
        pt: {
          prompt: 'Encontre o intruso: qual destes NÃO é um planeta do Sistema Solar?',
          options: ['Sirius', 'Netuno', 'Saturno', 'Vênus'],
          explanation: 'Sirius é uma estrela (a mais brilhante do céu noturno), não um planeta.',
        },
      },
    },
  ],
  history: [
    {
      type: 'mcq',
      correctIndex: 0,
      content: {
        ro: {
          prompt: 'În ce an a avut loc Marea Unire de la Alba Iulia?',
          options: ['1918', '1859', '1877', '1922'],
          explanation:
            'Marea Adunare Națională de la Alba Iulia a votat Unirea la 1 decembrie 1918.',
        },
        en: {
          prompt: 'In which year did the Great Union of Alba Iulia take place in Romania?',
          options: ['1918', '1859', '1877', '1922'],
          explanation:
            'The National Assembly at Alba Iulia proclaimed the Great Union on December 1, 1918.',
        },
        es: {
          prompt: '¿En qué año tuvo lugar la Gran Unión de Alba Iulia en Rumanía?',
          options: ['1918', '1859', '1877', '1922'],
          explanation:
            'La Asamblea Nacional de Alba Iulia proclamó la Gran Unión el 1 de diciembre de 1918.',
        },
        pt: {
          prompt: 'Em que ano ocorreu a Grande União de Alba Iulia na Romênia?',
          options: ['1918', '1859', '1877', '1922'],
          explanation:
            'A Assembleia Nacional de Alba Iulia proclamou a Grande União em 1 de dezembro de 1918.',
        },
      },
    },
    {
      type: 'mcq',
      correctIndex: 0,
      content: {
        ro: {
          prompt: 'Cine a fost primul om care a pășit pe Lună în 1969?',
          options: ['Neil Armstrong', 'Buzz Aldrin', 'Iuri Gagarin', 'Michael Collins'],
          explanation:
            'Neil Armstrong a pășit pe Lună la 20 iulie 1969 în cadrul misiunii Apollo 11.',
        },
        en: {
          prompt: 'Who was the first person to walk on the Moon in 1969?',
          options: ['Neil Armstrong', 'Buzz Aldrin', 'Yuri Gagarin', 'Michael Collins'],
          explanation: 'Neil Armstrong stepped onto the Moon on July 20, 1969 during Apollo 11.',
        },
        es: {
          prompt: '¿Quién fue la primera persona en caminar sobre la Luna en 1969?',
          options: ['Neil Armstrong', 'Buzz Aldrin', 'Yuri Gagarin', 'Michael Collins'],
          explanation: 'Neil Armstrong pisó la Luna el 20 de julio de 1969 en la misión Apolo 11.',
        },
        pt: {
          prompt: 'Quem foi a primeira pessoa a caminhar na Lua em 1969?',
          options: ['Neil Armstrong', 'Buzz Aldrin', 'Yuri Gagarin', 'Michael Collins'],
          explanation:
            'Neil Armstrong pisou na Lua em 20 de julho de 1969 durante a missão Apollo 11.',
        },
      },
    },
    {
      type: 'order',
      content: {
        ro: {
          prompt: 'Ordonează cronologic aceste invenții, de la cea mai veche la cea mai recentă:',
          options: ['Tiparul cu litere mobile', 'Motorul cu abur', 'Telefonul', 'Internetul (WWW)'],
          explanation:
            'Tiparul lui Gutenberg (~1440), motorul cu abur (~1712/1776), telefonul (1876), World Wide Web (1989).',
        },
        en: {
          prompt: 'Order these inventions chronologically from oldest to most recent:',
          options: ['Movable-type printing press', 'Steam engine', 'Telephone', 'World Wide Web'],
          explanation:
            'Gutenberg press (~1440), steam engine (~1712/1776), telephone (1876), World Wide Web (1989).',
        },
        es: {
          prompt: 'Ordena cronológicamente estos inventos del más antiguo al más reciente:',
          options: ['Imprenta de tipos móviles', 'Máquina de vapor', 'Teléfono', 'World Wide Web'],
          explanation:
            'Imprenta de Gutenberg (~1440), máquina de vapor (~1712/1776), teléfono (1876), WWW (1989).',
        },
        pt: {
          prompt: 'Ordene cronologicamente estas invenções da mais antiga à mais recente:',
          options: ['Prensa de tipos móveis', 'Motor a vapor', 'Telefone', 'World Wide Web'],
          explanation:
            'Prensa de Gutenberg (~1440), motor a vapor (~1712/1776), telefone (1876), WWW (1989).',
        },
      },
    },
  ],
  physics: [
    {
      type: 'mcq',
      correctIndex: 0,
      content: {
        ro: {
          prompt: 'Care este unitatea de măsură în Sistemul Internațional pentru forță?',
          options: ['Newton (N)', 'Joule (J)', 'Watt (W)', 'Pascal (Pa)'],
          explanation:
            'Forța se măsoară în Newtoni (1 N = 1 kg·m/s²), în timp ce Joule măsoară energia.',
        },
        en: {
          prompt: 'What is the SI unit of force?',
          options: ['Newton (N)', 'Joule (J)', 'Watt (W)', 'Pascal (Pa)'],
          explanation:
            'Force is measured in Newtons (1 N = 1 kg·m/s²), whereas Joules measure energy.',
        },
        es: {
          prompt: '¿Cuál es la unidad de fuerza en el Sistema Internacional?',
          options: ['Newton (N)', 'Julio (J)', 'Vatio (W)', 'Pascal (Pa)'],
          explanation:
            'La fuerza se mide en Newtons (1 N = 1 kg·m/s²), mientras que el Julio mide energía.',
        },
        pt: {
          prompt: 'Qual é a unidade de força no Sistema Internacional (SI)?',
          options: ['Newton (N)', 'Joule (J)', 'Watt (W)', 'Pascal (Pa)'],
          explanation:
            'A força é medida em Newtons (1 N = 1 kg·m/s²), enquanto o Joule mede energia.',
        },
      },
    },
    {
      type: 'mcq',
      correctIndex: 0,
      content: {
        ro: {
          prompt: 'Care este viteza aproximativă a luminii în vid?',
          options: ['300.000 km/s', '150.000 km/s', '340 m/s', '30.000 km/s'],
          explanation: 'Lumina se propagă în vid cu aproximativ 299.792 km/s (~300.000 km/s).',
        },
        en: {
          prompt: 'What is the approximate speed of light in a vacuum?',
          options: ['300,000 km/s', '150,000 km/s', '340 m/s', '30,000 km/s'],
          explanation: 'Light travels in a vacuum at roughly 299,792 km/s (~300,000 km/s).',
        },
        es: {
          prompt: '¿Cuál es la velocidad aproximada de la luz en el vacío?',
          options: ['300.000 km/s', '150.000 km/s', '340 m/s', '30.000 km/s'],
          explanation: 'La luz viaja en el vacío a unos 299.792 km/s (~300.000 km/s).',
        },
        pt: {
          prompt: 'Qual é a velocidade aproximada da luz no vácuo?',
          options: ['300.000 km/s', '150.000 km/s', '340 m/s', '30.000 km/s'],
          explanation: 'A luz viaja no vácuo a aproximadamente 299.792 km/s (~300.000 km/s).',
        },
      },
    },
  ],
  logic: [
    {
      type: 'logic',
      correctIndex: 0,
      content: {
        ro: {
          prompt: 'Ce număr urmează în șirul: 3, 6, 12, 24, ...?',
          options: ['48', '36', '42', '54'],
          explanation:
            'Fiecare termen se obține prin înmulțirea termenului precedent cu 2 (24 × 2 = 48).',
        },
        en: {
          prompt: 'Which number comes next in the sequence: 3, 6, 12, 24, ...?',
          options: ['48', '36', '42', '54'],
          explanation: 'Each term is double the previous term (24 × 2 = 48).',
        },
        es: {
          prompt: '¿Qué número sigue en la serie: 3, 6, 12, 24, ...?',
          options: ['48', '36', '42', '54'],
          explanation: 'Cada término es el doble del anterior (24 × 2 = 48).',
        },
        pt: {
          prompt: 'Qual número vem a seguir na sequência: 3, 6, 12, 24, ...?',
          options: ['48', '36', '42', '54'],
          explanation: 'Cada termo é o dobro do anterior (24 × 2 = 48).',
        },
      },
    },
    {
      type: 'logic',
      correctIndex: 0,
      content: {
        ro: {
          prompt:
            'Dacă 5 mașini produc 5 piese în 5 minute, în câte minute produc 100 de mașini 100 de piese?',
          options: ['5 minute', '100 minute', '20 minute', '1 minut'],
          explanation:
            'Fiecare mașină produce o piesă în 5 minute, deci 100 de mașini în paralel tot 5 minute lucrează.',
        },
        en: {
          prompt:
            'If 5 machines make 5 parts in 5 minutes, how long does it take 100 machines to make 100 parts?',
          options: ['5 minutes', '100 minutes', '20 minutes', '1 minute'],
          explanation:
            'Each machine takes 5 minutes to make 1 part, so 100 machines working simultaneously take 5 minutes.',
        },
        es: {
          prompt:
            'Si 5 máquinas hacen 5 piezas en 5 minutos, ¿cuánto tardan 100 máquinas en hacer 100 piezas?',
          options: ['5 minutos', '100 minutos', '20 minutos', '1 minuto'],
          explanation:
            'Cada máquina tarda 5 minutos en hacer 1 pieza, por lo que 100 máquinas en paralelo tardan 5 minutos.',
        },
        pt: {
          prompt:
            'Se 5 máquinas fazem 5 peças em 5 minutos, quanto tempo 100 máquinas levam para fazer 100 peças?',
          options: ['5 minutos', '100 minutos', '20 minutos', '1 minuto'],
          explanation:
            'Cada máquina leva 5 minutos por peça; 100 máquinas trabalhando juntas levam os mesmos 5 minutos.',
        },
      },
    },
  ],
  geography: [
    {
      type: 'mcq',
      correctIndex: 0,
      content: {
        ro: {
          prompt: 'Prin câte capitale europene trece fluviul Dunărea?',
          options: ['4 capitale', '3 capitale', '5 capitale', '2 capitale'],
          explanation:
            'Dunărea traversează patru capitale: Viena, Bratislava, Budapesta și Belgrad.',
        },
        en: {
          prompt: 'How many European capital cities does the Danube River flow through?',
          options: ['4 capitals', '3 capitals', '5 capitals', '2 capitals'],
          explanation:
            'The Danube flows through four capitals: Vienna, Bratislava, Budapest, and Belgrade.',
        },
        es: {
          prompt: '¿Por cuántas capitales europeas pasa el río Danubio?',
          options: ['4 capitales', '3 capitales', '5 capitales', '2 capitales'],
          explanation:
            'El Danubio atraviesa cuatro capitales: Viena, Bratislava, Budapest y Belgrado.',
        },
        pt: {
          prompt: 'Por quantas capitais europeias passa o rio Danúbio?',
          options: ['4 capitais', '3 capitais', '5 capitais', '2 capitais'],
          explanation:
            'O Danúbio atravessa quatro capitais: Viena, Bratislava, Budapeste e Belgrado.',
        },
      },
    },
    {
      type: 'mcq',
      correctIndex: 0,
      content: {
        ro: {
          prompt: 'Care este cel mai înalt vârf montan din România?',
          options: ['Vârful Moldoveanu', 'Vârful Negoiu', 'Vârful Omu', 'Vârful Parângul Mare'],
          explanation: 'Vârful Moldoveanu din Munții Făgăraș are altitudinea de 2.544 metri.',
        },
        en: {
          prompt: 'Which is the highest mountain peak in Romania?',
          options: ['Moldoveanu Peak', 'Negoiu Peak', 'Omu Peak', 'Parângul Mare Peak'],
          explanation:
            'Moldoveanu Peak in the Făgăraș Mountains reaches an elevation of 2,544 meters.',
        },
        es: {
          prompt: '¿Cuál es el pico montañoso más alto de Rumanía?',
          options: ['Pico Moldoveanu', 'Pico Negoiu', 'Pico Omu', 'Pico Parângul Mare'],
          explanation:
            'El Pico Moldoveanu en los Montes Făgăraș alcanza los 2.544 metros de altitud.',
        },
        pt: {
          prompt: 'Qual é o pico de montanha mais alto da Romênia?',
          options: ['Pico Moldoveanu', 'Pico Negoiu', 'Pico Omu', 'Pico Parângul Mare'],
          explanation: 'O Pico Moldoveanu nas Montanhas Făgăraș tem 2.544 metros de altitude.',
        },
      },
    },
  ],
};

function resolveBucketKey(topic: string, type: QuestionType): string {
  const norm = topic.toLowerCase();
  if (
    type === 'logic' ||
    norm.includes('logic') ||
    norm.includes('math') ||
    norm.includes('mate')
  ) {
    return 'logic';
  }
  if (
    norm.includes('astro') ||
    norm.includes('spa') ||
    norm.includes('stea') ||
    norm.includes('planet')
  ) {
    return 'astronomy';
  }
  if (norm.includes('istori') || norm.includes('histor')) {
    return 'history';
  }
  if (
    norm.includes('fizic') ||
    norm.includes('physic') ||
    norm.includes('stiint') ||
    norm.includes('scien')
  ) {
    return 'physics';
  }
  if (norm.includes('geogra') || norm.includes('tara') || norm.includes('capitol')) {
    return 'geography';
  }
  return 'astronomy';
}

export function pickCuratedTemplates(params: {
  topic: string;
  type: QuestionType;
  count: number;
  offsetSeed: number;
}): GeneratedDraftTemplate[] {
  const bucketKey = resolveBucketKey(params.topic, params.type);
  const bucket = CURATED_TOPIC_BANK[bucketKey] ?? CURATED_TOPIC_BANK.astronomy!;
  const allTemplates = [
    ...bucket.filter((t) => t.type === params.type),
    ...bucket,
    ...Object.values(CURATED_TOPIC_BANK).flat(),
  ];

  const picked: GeneratedDraftTemplate[] = [];
  for (let i = 0; i < params.count; i += 1) {
    const template = allTemplates[(params.offsetSeed + i) % allTemplates.length]!;
    picked.push(structuredClone(template));
  }
  return picked;
}

export async function generateLiveGeminiTemplates(params: {
  topic: string;
  type: QuestionType;
  difficulty: 1 | 2 | 3;
  count: number;
}): Promise<GeneratedDraftTemplate[] | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const client = new GoogleGenAI({ apiKey });
    const prompt = `Generate ${params.count} real, engaging trivia/logic question(s) for RonDuel on topic "${params.topic}", question type "${params.type}", difficulty ${params.difficulty}/3.
Return ONLY a valid JSON array where each element has:
{
  "type": "${params.type}",
  "correctIndex": 0,
  "content": {
    "ro": { "prompt": "Întrebarea în română cu diacritice corecte (ș, ț, ă, â, î)?", "options": ["Varianta corectă", "Distractor 2", "Distractor 3", "Distractor 4"], "explanation": "Explicație scurtă și clară." },
    "en": { "prompt": "Question in English?", "options": ["Correct option", "Distractor 2", "Distractor 3", "Distractor 4"], "explanation": "Short clear explanation." },
    "es": { "prompt": "¿Pregunta en español?", "options": ["Opción correcta", "Distractor 2", "Distractor 3", "Distractor 4"], "explanation": "Explicación breve y clara." },
    "pt": { "prompt": "Pergunta em português?", "options": ["Opção correta", "Distrator 2", "Distrator 3", "Distrator 4"], "explanation": "Explicação curta e clara." }
  }
}
Important: Put the correct answer at index 0 in options (or for "order" type, put the 4 items in the exact correct chronological/increasing order). Never include "[AI Draft]" or placeholder strings.`;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text?.trim();
    if (!rawText) return null;
    const parsed = JSON.parse(rawText) as GeneratedDraftTemplate[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed.slice(0, params.count);
  } catch {
    return null;
  }
}
