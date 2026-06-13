/**
 * Generate sample analysis JSON files for Spanish, Polish, and Russian.
 * These serve as starter dictionaries similar to the German B1 topics.
 * 
 * Run: npx tsx scripts/generate-sample-data.ts
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

interface WordEntry {
  stem: string;
  displayForm: string;
  forms: Record<string, number>;
  totalCount: number;
  sections: number[];
  pos: 'Noun' | 'Verb' | 'Adjective' | 'Other';
  examples: string[];
}

interface SectionStats {
  index: number;
  title: string;
  totalWords: number;
  totalTokens: number;
  uniqueStems: number;
  newStems: number;
  cumulativeUniqueStems: number;
  newWords: string[];
}

interface AnalysisResult {
  meta: {
    source: string;
    language: string;
    analyzedAt: string;
    totalSections: number;
    totalWords: number;
    totalTokens: number;
    totalUniqueStems: number;
    stemmer: string;
  };
  sections: SectionStats[];
  vocabulary: WordEntry[];
  frequencyDistribution: Array<{ minOccurrences: number; stemCount: number; percentage: number }>;
}

// ─── Spanish B1 Topics ───

const spanishTopics = [
  {
    title: "¿Deberías dormir la siesta?",
    words: ["dormir", "siesta", "trabajo", "oficina", "descanso", "energía", "concentración", "almuerzo", "minutos", "sofá", "después", "ventaja", "errores", "productividad", "costumbre", "infancia", "padre", "fin", "semana", "relajarse", "desventaja", "gente", "lugar", "largo", "cansado", "personalmente", "casa", "ayudar", "estrés", "café"]
  },
  {
    title: "Aprender idiomas: ¿Es necesario?",
    words: ["idioma", "aprender", "futuro", "cultura", "comunicar", "inglés", "español", "mundo", "viajar", "oportunidad", "carrera", "difícil", "tiempo", "practicar", "aplicación", "flexible", "vacaciones", "tolerante", "entender", "hablar", "estudiar", "universidad", "trabajo", "experiencia", "amigo", "extranjero", "país", "tradición", "conocer", "importante"]
  },
  {
    title: "Vivir en el extranjero",
    words: ["mudarse", "aventura", "independiente", "nostalgia", "familia", "extrañar", "burocracia", "adaptarse", "sueño", "clima", "sol", "oportunidades", "seguridad", "valentía", "abierto", "nuevo", "diferente", "costumbre", "comida", "transporte", "alquiler", "caro", "sociedad", "integración", "cultura", "lengua", "barrera", "soledad", "amistades", "crecimiento"]
  },
  {
    title: "Tecnología y niños",
    words: ["teléfono", "niño", "pantalla", "jugar", "internet", "seguro", "educación", "límite", "aplicación", "edad", "deberes", "distracción", "padres", "control", "tableta", "contenido", "prohibir", "permitir", "responsabilidad", "digital", "videojuego", "adicción", "equilibrio", "creatividad", "lectura", "desarrollo", "social", "herramienta", "moderno", "tecnología"]
  },
  {
    title: "Comida orgánica: ¿Vale la pena?",
    words: ["orgánico", "saludable", "mercado", "verdura", "fruta", "químico", "pesticida", "natural", "precio", "supermercado", "jardín", "cocina", "sabor", "ecológico", "producción", "animal", "campo", "granja", "calidad", "etiqueta", "certificado", "consumidor", "alimentación", "sostenible", "dieta", "nutrición", "inversión", "salud", "medio", "ambiente"]
  },
  {
    title: "Deporte y ejercicio",
    words: ["deporte", "ejercicio", "gimnasio", "correr", "nadar", "caminar", "salud", "cuerpo", "entrenamiento", "músculo", "resistencia", "rutina", "motivación", "disciplina", "equipo", "competición", "meta", "progreso", "lesión", "descanso", "nutrición", "bienestar", "energía", "fuerza", "flexibilidad", "yoga", "bicicleta", "maratón", "rendimiento", "constancia"]
  },
  {
    title: "El medio ambiente",
    words: ["reciclaje", "contaminación", "planeta", "basura", "plástico", "energía", "renovable", "cambio", "climático", "bosque", "océano", "agua", "aire", "proteger", "reducir", "reutilizar", "huella", "carbono", "solar", "eólico", "sostenible", "biodiversidad", "ecosistema", "naturaleza", "conservación", "extinción", "especie", "deforestación", "emisiones", "conciencia"]
  },
  {
    title: "Trabajo remoto",
    words: ["remoto", "oficina", "casa", "productividad", "horario", "flexible", "reunión", "video", "comunicación", "equipo", "distancia", "concentración", "ventaja", "desventaja", "tecnología", "internet", "balance", "profesional", "empresa", "compañero", "proyecto", "organización", "disciplina", "espacio", "escritorio", "comodidad", "ahorro", "transporte", "libertad", "responsabilidad"]
  }
];

const spanishExampleSentences: Record<string, string[]> = {
  "dormir": ["Es importante dormir bien para tener energía durante el día.", "Muchas personas prefieren dormir la siesta después del almuerzo."],
  "trabajo": ["El trabajo en la oficina puede ser estresante.", "Busco un trabajo con horario flexible."],
  "aprender": ["Aprender idiomas abre muchas puertas.", "Nunca es tarde para aprender algo nuevo."],
  "familia": ["La familia es lo más importante para muchas personas.", "Extraño mucho a mi familia cuando viajo."],
  "salud": ["La salud es más importante que el dinero.", "Hacer ejercicio es bueno para la salud."],
  "deporte": ["El deporte es fundamental para mantener una vida saludable.", "Practico deporte tres veces por semana."],
};

// ─── Polish B1 Topics ───

const polishTopics = [
  {
    title: "Czy warto uczyć się języków obcych?",
    words: ["język", "uczyć", "obcy", "angielski", "niemiecki", "komunikacja", "kultura", "podróż", "praca", "przyszłość", "szkoła", "studia", "tłumaczenie", "wymowa", "gramatyka", "słownictwo", "lekcja", "nauczyciel", "student", "egzamin", "certyfikat", "trudny", "łatwy", "ćwiczenie", "rozmowa", "praktyka", "umiejętność", "kariera", "możliwość", "świat"]
  },
  {
    title: "Zdrowe odżywianie",
    words: ["zdrowie", "jedzenie", "dieta", "witaminy", "owoce", "warzywa", "białko", "kalorie", "posiłek", "śniadanie", "obiad", "kolacja", "gotować", "przepis", "produkty", "ekologiczny", "supermarket", "naturalny", "cena", "organiczny", "smak", "kuchnia", "restauracja", "fast", "food", "mięso", "ryba", "mleko", "chleb", "masło"]
  },
  {
    title: "Sport i aktywność fizyczna",
    words: ["sport", "ćwiczenia", "siłownia", "bieganie", "pływanie", "piłka", "nożna", "rower", "trening", "zdrowie", "kondycja", "wytrzymałość", "mięśnie", "motywacja", "dyscyplina", "drużyna", "zawody", "maraton", "cel", "postęp", "kontuzja", "odpoczynek", "rozgrzewka", "stretching", "wynik", "siła", "energía", "aktywność", "ruch", "relaks"]
  },
  {
    title: "Technologia w życiu codziennym",
    words: ["komputer", "telefon", "internet", "aplikacja", "technologia", "programowanie", "strona", "media", "społecznościowe", "email", "wiadomość", "zdjęcie", "wideo", "gra", "bezpieczeństwo", "hasło", "dane", "prywatność", "aktualizacja", "system", "urządzenie", "ekran", "bateria", "ładowarka", "kabel", "drukarka", "oprogramowanie", "cyfrowy", "sztuczna", "inteligencja"]
  },
  {
    title: "Podróżowanie",
    words: ["podróż", "samolot", "pociąg", "autobus", "hotel", "rezerwacja", "walizka", "paszport", "bilet", "lotnisko", "dworzec", "mapa", "przewodnik", "turysta", "zabytki", "plaża", "góry", "morze", "jezioro", "wakacje", "urlop", "wycieczka", "kraj", "miasto", "kultura", "tradycja", "pamiątka", "fotografia", "przygoda", "wspomnienia"]
  },
  {
    title: "Ochrona środowiska",
    words: ["środowisko", "recykling", "zanieczyszczenie", "klimat", "energia", "odnawialna", "las", "ocean", "woda", "powietrze", "ochrona", "śmieci", "plastik", "segregacja", "ekologia", "ślad", "węglowy", "emisje", "bioróżnorodność", "gatunek", "wymieranie", "deforestacja", "globalne", "ocieplenie", "natura", "planeta", "zasoby", "oszczędzanie", "zrównoważony", "rozwój"]
  },
  {
    title: "Praca i kariera",
    words: ["praca", "kariera", "zawód", "firma", "szef", "kolega", "biuro", "wynagrodzenie", "urlop", "doświadczenie", "kwalifikacje", "rozmowa", "kwalifikacyjna", "CV", "list", "motywacyjny", "awans", "projekt", "spotkanie", "obowiązki", "umowa", "etat", "zlecenie", "pracodawca", "pracownik", "branża", "stanowisko", "kompetencje", "rozwój", "sukces"]
  },
  {
    title: "Mieszkanie i dom",
    words: ["mieszkanie", "dom", "pokój", "kuchnia", "łazienka", "salon", "sypialnia", "balkon", "ogród", "piwnica", "strych", "meble", "remont", "wynajem", "czynsz", "właściciel", "lokator", "sąsiad", "budynek", "piętro", "winda", "klucz", "drzwi", "okno", "ściana", "podłoga", "sufit", "oświetlenie", "ogrzewanie", "klimatyzacja"]
  }
];

const polishExamples: Record<string, string[]> = {
  "język": ["Uczę się języka niemieckiego od dwóch lat.", "Język angielski jest bardzo przydatny w pracy."],
  "praca": ["Szukam pracy w branży IT.", "Praca zdalna staje się coraz bardziej popularna."],
  "sport": ["Sport pomaga utrzymać dobrą kondycję.", "Uprawiam sport trzy razy w tygodniu."],
  "podróż": ["Podróż do Japonii była niezapomniana.", "Lubię podróżować po Europie."],
  "zdrowie": ["Zdrowie jest najważniejsze.", "Regularne ćwiczenia poprawiają zdrowie."],
};

// ─── Russian B1 Topics ───

const russianTopics = [
  {
    title: "Стоит ли учить иностранные языки?",
    words: ["язык", "учить", "иностранный", "английский", "немецкий", "общение", "культура", "путешествие", "работа", "будущее", "школа", "университет", "перевод", "произношение", "грамматика", "словарь", "урок", "учитель", "студент", "экзамен", "сертификат", "трудный", "лёгкий", "упражнение", "разговор", "практика", "навык", "карьера", "возможность", "мир"]
  },
  {
    title: "Здоровое питание",
    words: ["здоровье", "еда", "диета", "витамины", "фрукты", "овощи", "белок", "калории", "завтрак", "обед", "ужин", "готовить", "рецепт", "продукты", "органический", "магазин", "натуральный", "цена", "вкус", "кухня", "ресторан", "мясо", "рыба", "молоко", "хлеб", "масло", "сахар", "соль", "вода", "напиток"]
  },
  {
    title: "Спорт и физическая активность",
    words: ["спорт", "упражнение", "зал", "бег", "плавание", "футбол", "велосипед", "тренировка", "мышцы", "выносливость", "мотивация", "дисциплина", "команда", "соревнование", "марафон", "цель", "прогресс", "травма", "отдых", "разминка", "результат", "сила", "энергия", "активность", "движение", "тело", "здоровье", "фитнес", "йога", "гибкость"]
  },
  {
    title: "Технологии в повседневной жизни",
    words: ["компьютер", "телефон", "интернет", "приложение", "технология", "программирование", "сайт", "социальный", "сеть", "сообщение", "фотография", "видео", "игра", "безопасность", "пароль", "данные", "конфиденциальность", "обновление", "система", "устройство", "экран", "батарея", "зарядка", "кабель", "принтер", "программа", "цифровой", "искусственный", "интеллект", "робот"]
  },
  {
    title: "Путешествия",
    words: ["путешествие", "самолёт", "поезд", "автобус", "гостиница", "бронирование", "чемодан", "паспорт", "билет", "аэропорт", "вокзал", "карта", "гид", "турист", "достопримечательность", "пляж", "горы", "море", "озеро", "отпуск", "каникулы", "экскурсия", "страна", "город", "культура", "традиция", "сувенир", "фотография", "приключение", "воспоминания"]
  },
  {
    title: "Защита окружающей среды",
    words: ["окружающий", "среда", "переработка", "загрязнение", "климат", "энергия", "возобновляемый", "лес", "океан", "вода", "воздух", "защита", "мусор", "пластик", "сортировка", "экология", "углеродный", "след", "выбросы", "биоразнообразие", "вид", "вымирание", "вырубка", "глобальный", "потепление", "природа", "планета", "ресурсы", "экономия", "устойчивый"]
  },
  {
    title: "Работа и карьера",
    words: ["работа", "карьера", "профессия", "компания", "начальник", "коллега", "офис", "зарплата", "отпуск", "опыт", "квалификация", "собеседование", "резюме", "повышение", "проект", "совещание", "обязанности", "договор", "должность", "компетенция", "развитие", "успех", "руководитель", "подчинённый", "стажировка", "мотивация", "продуктивность", "дедлайн", "отчёт", "предприятие"]
  },
  {
    title: "Жильё и дом",
    words: ["квартира", "дом", "комната", "кухня", "ванная", "гостиная", "спальня", "балкон", "сад", "подвал", "чердак", "мебель", "ремонт", "аренда", "коммунальные", "хозяин", "жилец", "сосед", "здание", "этаж", "лифт", "ключ", "дверь", "окно", "стена", "пол", "потолок", "освещение", "отопление", "кондиционер"]
  }
];

const russianExamples: Record<string, string[]> = {
  "язык": ["Я изучаю иностранные языки с детства.", "Русский язык — один из самых сложных в мире."],
  "работа": ["Я ищу работу в сфере IT.", "Удалённая работа становится всё популярнее."],
  "спорт": ["Спорт помогает поддерживать здоровье.", "Я занимаюсь спортом три раза в неделю."],
  "путешествие": ["Путешествие в Японию было незабываемым.", "Я люблю путешествовать по Европе."],
  "здоровье": ["Здоровье — самое важное в жизни.", "Регулярные упражнения улучшают здоровье."],
};

// ─── Generator ───

function generateAnalysis(
  lang: string,
  source: string,
  topics: Array<{ title: string; words: string[] }>,
  examples: Record<string, string[]>
): AnalysisResult {
  const now = new Date().toISOString();
  const allUniqueStems = new Set<string>();
  const wordCounts: Record<string, number> = {};
  const wordSections: Record<string, number[]> = {};

  // Build sections
  const sections: SectionStats[] = [];
  let cumulativeStems = 0;

  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    const newWords: string[] = [];
    
    for (const word of topic.words) {
      const stem = word.toLowerCase();
      if (!allUniqueStems.has(stem)) {
        newWords.push(stem);
      }
      allUniqueStems.add(stem);
      wordCounts[stem] = (wordCounts[stem] || 0) + Math.floor(Math.random() * 8) + 1;
      if (!wordSections[stem]) wordSections[stem] = [];
      if (!wordSections[stem].includes(i)) wordSections[stem].push(i);
    }

    cumulativeStems = allUniqueStems.size;
    
    sections.push({
      index: i,
      title: topic.title,
      totalWords: topic.words.length * 8,
      totalTokens: topic.words.length * 4,
      uniqueStems: topic.words.length,
      newStems: newWords.length,
      cumulativeUniqueStems: cumulativeStems,
      newWords
    });
  }

  // Build vocabulary
  const vocabulary: WordEntry[] = Object.keys(wordCounts)
    .map(stem => ({
      stem,
      displayForm: stem,
      forms: { [stem]: wordCounts[stem] },
      totalCount: wordCounts[stem],
      sections: wordSections[stem] || [],
      pos: (stem.length > 6 ? 'Noun' : stem.length > 4 ? 'Verb' : 'Adjective') as WordEntry['pos'],
      examples: examples[stem] || []
    }))
    .sort((a, b) => b.totalCount - a.totalCount);

  // Frequency distribution
  const freqBuckets = [1, 2, 3, 5, 10, 20, 50];
  const frequencyDistribution = freqBuckets.map(min => {
    const count = vocabulary.filter(w => w.totalCount >= min).length;
    return {
      minOccurrences: min,
      stemCount: count,
      percentage: Math.round((count / vocabulary.length) * 100)
    };
  });

  const totalWords = sections.reduce((s, sec) => s + sec.totalWords, 0);
  const totalTokens = sections.reduce((s, sec) => s + sec.totalTokens, 0);

  return {
    meta: {
      source,
      language: lang,
      analyzedAt: now,
      totalSections: sections.length,
      totalWords,
      totalTokens,
      totalUniqueStems: allUniqueStems.size,
      stemmer: 'simplemma'
    },
    sections,
    vocabulary,
    frequencyDistribution
  };
}

// ─── Generate all files ───

const outputDir = resolve('./web/public');

const esData = generateAnalysis('es', 'built-in/spanish-b1-topics', spanishTopics, spanishExampleSentences);
writeFileSync(resolve(outputDir, 'spanish-b1-topics.json'), JSON.stringify(esData, null, 2), 'utf-8');
console.log(`✓ Spanish B1 Topics: ${esData.meta.totalUniqueStems} stems, ${esData.meta.totalSections} sections`);

const plData = generateAnalysis('pl', 'built-in/polish-b1-topics', polishTopics, polishExamples);
writeFileSync(resolve(outputDir, 'polish-b1-topics.json'), JSON.stringify(plData, null, 2), 'utf-8');
console.log(`✓ Polish B1 Topics: ${plData.meta.totalUniqueStems} stems, ${plData.meta.totalSections} sections`);

const ruData = generateAnalysis('ru', 'built-in/russian-b1-topics', russianTopics, russianExamples);
writeFileSync(resolve(outputDir, 'russian-b1-topics.json'), JSON.stringify(ruData, null, 2), 'utf-8');
console.log(`✓ Russian B1 Topics: ${ruData.meta.totalUniqueStems} stems, ${ruData.meta.totalSections} sections`);

console.log('\nDone! Generated sample analysis files for Spanish, Polish, and Russian.');
