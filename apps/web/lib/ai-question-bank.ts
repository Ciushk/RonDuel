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
          prompt: 'Care este cea mai mare planet\u0103 din Sistemul nostru Solar?',
          options: ['Jupiter', 'Saturn', 'Neptun', 'Uranus'],
          explanation:
            'Jupiter are o mas\u0103 de peste dou\u0103 ori mai mare dec\u00e2t toate celelalte planete la un loc.',
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
          prompt: 'Care este cea mai apropiat\u0103 stea de P\u0103m\u00e2nt, dup\u0103 Soare?',
          options: ['Proxima Centauri', 'Sirius', 'Betelgeuse', 'Vega'],
          explanation: 'Proxima Centauri se afl\u0103 la aproximativ 4,24 ani-lumin\u0103 de Sistemul Solar.',
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
          prompt: 'Pe ce planet\u0103 din Sistemul Solar se afl\u0103 vulcanul gigant Olympus Mons?',
          options: ['Marte', 'Venus', 'Mercur', 'Jupiter'],
          explanation:
            'Olympus Mons de pe Marte are aproximativ 22 km \u00een\u0103l\u021bime, fiind cel mai \u00eenalt vulcan planetar cunoscut.',
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
          prompt: 'Ordoneaz\u0103 planetele de la cea mai apropiat\u0103 la cea mai \u00eendep\u0103rtat\u0103 de Soare:',
          options: ['Mercur', 'Venus', 'P\u0103m\u00e2nt', 'Marte'],
          explanation:
            'Cele patru planete telurice interioare sunt Mercur, Venus, P\u0103m\u00e2nt \u0219i Marte.',
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
          prompt: 'G\u0103se\u0219te intrusul: care dintre urm\u0103toarele NU este o planet\u0103 din Sistemul Solar?',
          options: ['Sirius', 'Neptun', 'Saturn', 'Venus'],
          explanation:
            'Sirius este o stea (cea mai str\u0103lucitoare de pe cerul nop\u021bii), nu o planet\u0103.',
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
          prompt: '\u00cen ce an a avut loc Marea Unire de la Alba Iulia?',
          options: ['1918', '1859', '1877', '1922'],
          explanation:
            'Marea Adunare Na\u021bional\u0103 de la Alba Iulia a votat Unirea la 1 decembrie 1918.',
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
          prompt: 'Cine a fost primul om care a p\u0103\u0219it pe Lun\u0103 \u00een 1969?',
          options: ['Neil Armstrong', 'Buzz Aldrin', 'Iuri Gagarin', 'Michael Collins'],
          explanation:
            'Neil Armstrong a p\u0103\u0219it pe Lun\u0103 la 20 iulie 1969 \u00een cadrul misiunii Apollo 11.',
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
          prompt: 'Ordoneaz\u0103 cronologic aceste inven\u021bii, de la cea mai veche la cea mai recent\u0103:',
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
          prompt: 'Care este unitatea de m\u0103sur\u0103 \u00een Sistemul Interna\u021bional pentru for\u021b\u0103?',
          options: ['Newton (N)', 'Joule (J)', 'Watt (W)', 'Pascal (Pa)'],
          explanation:
            'For\u021ba se m\u0103soar\u0103 \u00een Newtoni (1 N = 1 kg·m/s²), \u00een timp ce Joule m\u0103soar\u0103 energia.',
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
          prompt: 'Care este viteza aproximativ\u0103 a luminii \u00een vid?',
          options: ['300.000 km/s', '150.000 km/s', '340 m/s', '30.000 km/s'],
          explanation: 'Lumina se propag\u0103 \u00een vid cu aproximativ 299.792 km/s (~300.000 km/s).',
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
          prompt: 'Ce num\u0103r urmeaz\u0103 \u00een \u0219irul: 3, 6, 12, 24, ...?',
          options: ['48', '36', '42', '54'],
          explanation:
            'Fiecare termen se ob\u021bine prin \u00eenmul\u021birea termenului precedent cu 2 (24 × 2 = 48).',
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
            'Dac\u0103 5 ma\u0219ini produc 5 piese \u00een 5 minute, \u00een c\u00e2te minute produc 100 de ma\u0219ini 100 de piese?',
          options: ['5 minute', '100 minute', '20 minute', '1 minut'],
          explanation:
            'Fiecare ma\u0219in\u0103 produce o pies\u0103 \u00een 5 minute, deci 100 de ma\u0219ini \u00een paralel tot 5 minute lucreaz\u0103.',
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
          prompt: 'Prin c\u00e2te capitale europene trece fluviul Dun\u0103rea?',
          options: ['4 capitale', '3 capitale', '5 capitale', '2 capitale'],
          explanation:
            'Dun\u0103rea traverseaz\u0103 patru capitale: Viena, Bratislava, Budapesta \u0219i Belgrad.',
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
          prompt: 'Care este cel mai \u00eenalt v\u00e2rf montan din Rom\u00e2nia?',
          options: ['V\u00e2rful Moldoveanu', 'V\u00e2rful Negoiu', 'V\u00e2rful Omu', 'V\u00e2rful Par\u00e2ngul Mare'],
          explanation: 'V\u00e2rful Moldoveanu din Mun\u021bii F\u0103g\u0103ra\u0219 are altitudinea de 2.544 metri.',
        },
        en: {
          prompt: 'Which is the highest mountain peak in Romania?',
          options: ['Moldoveanu Peak', 'Negoiu Peak', 'Omu Peak', 'Par\u00e2ngul Mare Peak'],
          explanation:
            'Moldoveanu Peak in the F\u0103g\u0103ra\u0219 Mountains reaches an elevation of 2,544 meters.',
        },
        es: {
          prompt: '\u00bfCu\u00e1l es el pico monta\u00f1oso m\u00e1s alto de Ruman\u00eda?',
          options: ['Pico Moldoveanu', 'Pico Negoiu', 'Pico Omu', 'Pico Par\u00e2ngul Mare'],
          explanation:
            'El Pico Moldoveanu en los Montes F\u0103g\u0103ra\u0219 alcanza los 2.544 metros de altitud.',
        },
        pt: {
          prompt: 'Qual \u00e9 o pico de montanha mais alto da Rom\u00eania?',
          options: ['Pico Moldoveanu', 'Pico Negoiu', 'Pico Omu', 'Pico Par\u00e2ngul Mare'],
          explanation: 'O Pico Moldoveanu nas Montanhas F\u0103g\u0103ra\u0219 tem 2.544 metros de altitude.',
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
    "ro": { "prompt": "\u00centrebarea \u00een rom\u00e2n\u0103 cu diacritice corecte (\u0219, \u021b, \u0103, \u00e2, \u00ee)?", "options": ["Varianta corect\u0103", "Distractor 2", "Distractor 3", "Distractor 4"], "explanation": "Explica\u021bie scurt\u0103 \u0219i clar\u0103." },
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
