export const GERMAN_STOP_WORDS = new Set([
  // Articles
  "der", "die", "das", "den", "dem", "des",
  "ein", "eine", "einen", "einem", "einer", "eines",
  // Pronouns
  "ich", "du", "er", "sie", "es", "wir", "ihr",
  "mich", "dich", "sich", "uns", "euch",
  "mir", "dir", "ihm", "ihnen",
  "mein", "meine", "meinen", "meinem", "meiner", "meines",
  "dein", "deine", "deinen", "deinem", "deiner", "deines",
  "sein", "seine", "seinen", "seinem", "seiner", "seines",
  "ihr", "ihre", "ihren", "ihrem", "ihrer", "ihres",
  "unser", "unsere", "unseren", "unserem", "unserer", "unseres",
  "euer", "eure", "euren", "eurem", "eurer", "eures",
  // Demonstratives / Relatives
  "dieser", "diese", "dieses", "diesen", "diesem",
  "jener", "jene", "jenes", "jenen", "jenem",
  "welcher", "welche", "welches", "welchen", "welchem",
  // Prepositions
  "in", "an", "auf", "aus", "bei", "mit", "nach", "von", "zu",
  "für", "über", "unter", "vor", "hinter", "neben", "zwischen",
  "um", "durch", "gegen", "ohne", "bis", "seit", "während",
  // Conjunctions
  "und", "oder", "aber", "denn", "sondern", "weil", "dass",
  "wenn", "als", "ob", "obwohl", "damit", "bevor", "nachdem",
  "solange", "sowohl", "weder", "noch", "entweder",
  // Auxiliary / Modal verbs
  "ist", "sind", "war", "waren", "bin", "bist", "seid",
  "hat", "haben", "hatte", "hatten", "habe", "hast",
  "wird", "werden", "wurde", "wurden", "wirst", "werdet",
  "kann", "können", "konnte", "konnten", "kannst", "könnt",
  "muss", "müssen", "musste", "mussten", "musst", "müsst",
  "soll", "sollen", "sollte", "sollten", "sollst", "sollt",
  "will", "wollen", "wollte", "wollten", "willst", "wollt",
  "darf", "dürfen", "durfte", "durften", "darfst", "dürft",
  "mag", "mögen", "mochte", "mochten", "magst", "mögt",
  "möchte", "möchten", "möchtest", "möchtet",
  // Common adverbs / particles
  "nicht", "auch", "so", "da", "dort", "hier", "nur", "schon",
  "noch", "mehr", "sehr", "ganz", "ja", "nein", "doch",
  "dann", "nun", "mal", "eben", "halt", "wohl",
  "immer", "nie", "oft", "manchmal", "wieder",
  "jetzt", "heute", "gestern", "morgen",
  // Question words
  "was", "wer", "wen", "wem", "wessen", "wo", "wie", "warum", "wann",
  // Other function words
  "man", "kein", "keine", "keinen", "keinem", "keiner", "keines",
  "alle", "alles", "jeder", "jede", "jedes", "jeden", "jedem",
  "viel", "viele", "vielen", "vielem", "vieler",
  "etwas", "nichts",
  "selbst", "selber",
  "zum", "zur", "vom", "am", "im", "ins", "ans",
  "darüber", "dazu", "davon", "dabei", "dafür", "dagegen",
  "darum", "darauf", "daraus", "daran", "darin",
]);

export const SPANISH_STOP_WORDS = new Set([
  // Articles
  "el", "la", "los", "las", "un", "una", "unos", "unas",
  // Pronouns
  "yo", "tú", "él", "ella", "ello", "nosotros", "nosotras", "vosotros", "vosotras", "ellos", "ellas",
  "me", "te", "se", "nos", "os", "lo", "la", "le", "los", "las", "les",
  "mi", "mis", "tu", "tus", "su", "sus", "nuestro", "nuestra", "nuestros", "nuestras", "vuestro", "vuestra", "vuestros", "vuestras",
  // Prepositions
  "a", "ante", "bajo", "cabe", "con", "contra", "de", "desde", "durante", "en", "entre", "hacia", "hasta", "mediante", "para", "por", "según", "sin", "so", "sobre", "tras",
  // Conjunctions
  "y", "e", "ni", "que", "o", "u", "pero", "mas", "sino", "porque", "pues", "aunque", "si",
  // Verbs
  "soy", "eres", "es", "somos", "sois", "son",
  "estoy", "estás", "está", "estamos", "estáis", "están",
  "he", "has", "ha", "hemos", "habéis", "han",
  "tengo", "tienes", "tiene", "tenemos", "tenéis", "tienen",
  "fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron",
  // Adverbs / Other
  "no", "sí", "ya", "muy", "más", "cuando", "donde", "quien", "quienes", "como", "cual", "cuales", "cuanto", "cuanta", "cuantos", "cuantas",
  "este", "esta", "estos", "estas", "ese", "esa", "esos", "esas", "aquel", "aquella", "aquellos", "aquellas", "esto", "eso", "aquello",
  "todo", "toda", "todos", "todas", "algo", "nada", "alguien", "nadie", "alguno", "alguna", "algunos", "algunas", "ninguno", "ninguna"
]);

export const POLISH_STOP_WORDS = new Set([
  // Pronouns
  "ja", "ty", "on", "ona", "ono", "my", "wy", "oni", "one",
  "mnie", "ciebie", "jego", "jej", "nas", "was", "ich",
  "mi", "ci", "mu", "nim", "nią", "nami", "wami", "nimi",
  "mój", "moja", "moje", "twój", "twoja", "twoje", "nasz", "nasza", "nasze", "wasz", "wasza", "wasze",
  // Prepositions
  "w", "z", "na", "do", "dla", "o", "od", "po", "nad", "pod", "przed", "za", "przy", "bez", "u",
  // Conjunctions
  "i", "a", "oraz", "albo", "lub", "czy", "ale", "lecz", "jednak", "żeby", "aby", "bo", "ponieważ", "że", "jeśli", "jeżeli",
  // Verbs
  "jestem", "jesteś", "jest", "jesteśmy", "jesteście", "są",
  "byłem", "byłeś", "był", "była", "było", "byliśmy", "byliście", "byli", "były",
  "będę", "będziesz", "będzie", "będziemy", "będziecie", "będą",
  // Other
  "nie", "tak", "już", "jeszcze", "tylko", "też", "bardzo", "bardziej",
  "to", "ten", "ta", "ci", "te", "tam", "tu", "tutaj",
  "kto", "co", "gdzie", "kiedy", "jak", "dlaczego",
  "się", "sobie", "sobą",
  "wszystko", "wszyscy", "coś", "nic", "ktoś", "nikt"
]);

export function getStopWords(lang: string): Set<string> {
  if (lang === 'es') return SPANISH_STOP_WORDS;
  if (lang === 'pl') return POLISH_STOP_WORDS;
  return GERMAN_STOP_WORDS;
}
