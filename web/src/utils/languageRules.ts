export function getArticle(word: string, pos: string, lang: string): string | null {
  if (pos !== 'Noun' || !word) return null;

  const w = word.toLowerCase();

  if (lang === 'spanish') {
    // Highly accurate Spanish rules
    if (
      w.endsWith('a') ||
      w.endsWith('ción') ||
      w.endsWith('sión') ||
      w.endsWith('dad') ||
      w.endsWith('tad') ||
      w.endsWith('tud') ||
      w.endsWith('ez') ||
      w.endsWith('eza') ||
      w.endsWith('umbre') ||
      w.endsWith('sis')
    ) {
      if (['día', 'mapa', 'planeta', 'sofá', 'programa', 'sistema'].includes(w)) return 'el';
      return 'la';
    }

    if (
      w.endsWith('o') ||
      w.endsWith('or') ||
      w.endsWith('án') ||
      w.endsWith('aje') ||
      w.endsWith('ma') ||
      w.endsWith('ambre') ||
      w.endsWith('er')
    ) {
      if (['mano', 'radio', 'moto', 'foto'].includes(w)) return 'la';
      return 'el';
    }

    return 'el/la'; // Default ambiguous
  }

  if (lang === 'german') {
    // German rules are notoriously tricky, but these cover a lot of common words
    if (
      w.endsWith('ung') ||
      w.endsWith('heit') ||
      w.endsWith('keit') ||
      w.endsWith('schaft') ||
      w.endsWith('ion') ||
      w.endsWith('tät') ||
      w.endsWith('ik') ||
      w.endsWith('ur') ||
      w.endsWith('in') ||
      w.endsWith('ie') ||
      w.endsWith('enz') ||
      w.endsWith('anz') ||
      w.endsWith('ade') ||
      w.endsWith('age')
    ) {
      return 'die';
    }

    if (
      w.endsWith('chen') ||
      w.endsWith('lein') ||
      w.endsWith('ment') ||
      w.endsWith('um') ||
      w.endsWith('ma') ||
      w.endsWith('nis')
    ) {
      if (['erlaubnis', 'kenntnis', 'finsternis'].includes(w)) return 'die';
      return 'das';
    }

    if (
      w.endsWith('ig') ||
      w.endsWith('ling') ||
      w.endsWith('ismus') ||
      w.endsWith('ist') ||
      w.endsWith('or') ||
      w.endsWith('ent') ||
      w.endsWith('ant') ||
      w.endsWith('eur') ||
      w.endsWith('iker') ||
      w.endsWith('ast')
    ) {
      return 'der';
    }

    if (w.endsWith('e')) {
      if (['name', 'junge', 'käse', 'gedanke'].includes(w)) return 'der';
      if (['auge', 'ende'].includes(w)) return 'das';
      return 'die';
    }
    
    if (w.endsWith('er')) {
      if (['wasser', 'wetter', 'fenster', 'zimmer', 'alter', 'messer'].includes(w)) return 'das';
      if (['mutter', 'tochter', 'butter', 'schwester', 'nummer'].includes(w)) return 'die';
      return 'der';
    }

    return null;
  }

  return null;
}

export function formatNounCapitalization(wordForm: string, lang: string): string {
  if (lang === 'german' && wordForm && wordForm.length > 0) {
    return wordForm.charAt(0).toUpperCase() + wordForm.slice(1);
  }
  return wordForm;
}
