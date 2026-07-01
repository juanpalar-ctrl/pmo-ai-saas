/**
 * src/config/language.ts
 * Idioma del CONTENIDO generado por IA (Fase 1: es/en).
 * NO traduce la UI estática — solo lo que produce el modelo (reportes, riesgo,
 * económico, chat). El default siempre es 'es' para preservar el comportamiento
 * histórico cuando no llega un idioma.
 */

export type Lang = 'es' | 'en';

/**
 * Normaliza cualquier locale (navigator.language / Accept-Language, ej. "en-US",
 * "es-CO") al set soportado. Cualquier cosa que no sea inglés cae a español.
 */
export function normalizeLang(raw?: string | null): Lang {
  return raw && raw.toLowerCase().startsWith('en') ? 'en' : 'es';
}

/**
 * Directiva que se antepone a los prompts para fijar el idioma de salida.
 * Preserva estructura, marcadores (===...===) y claves JSON — traduce solo el
 * texto legible por humanos.
 */
export function languageDirective(lang: Lang): string {
  if (lang === 'en') {
    return `OUTPUT LANGUAGE — CRITICAL: Write the ENTIRE response in English. Translate every heading, table header, label and free-text value into natural, professional English. Keep the exact same structure, the ===MARKERS=== and all JSON keys UNCHANGED — translate only human-readable text.`;
  }
  return `IDIOMA DE SALIDA: Escribe TODA la respuesta en español.`;
}

export type RagColor = 'red' | 'yellow' | 'green';

/**
 * Etiqueta RAG localizada. Misma semántica de color que ragRisk()/ragBudget()
 * en public/projects.html, para que reporte y dashboard no se contradigan.
 */
export function ragLabel(color: RagColor, lang: Lang): string {
  const M: Record<RagColor, Record<Lang, string>> = {
    red:    { es: '🔴 Rojo',     en: '🔴 Red' },
    yellow: { es: '🟡 Amarillo', en: '🟡 Yellow' },
    green:  { es: '🟢 Verde',    en: '🟢 Green' },
  };
  return M[color][lang];
}
