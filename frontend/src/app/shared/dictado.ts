/**
 * Dictado por voz con la Web Speech API (Chrome y Edge; pide permiso de
 * micrófono la primera vez). Pensado para el taller: hablar en vez de escribir
 * con las manos sucias.
 */

interface ReconocimientoVoz {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (evento: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: (evento: { error: string }) => void;
  onend: () => void;
  start(): void;
  stop(): void;
}

type ConstructorVoz = new () => ReconocimientoVoz;

function constructorVoz(): ConstructorVoz | null {
  if (typeof window === 'undefined') return null;
  const ventana = window as unknown as Record<string, ConstructorVoz | undefined>;
  return ventana['SpeechRecognition'] ?? ventana['webkitSpeechRecognition'] ?? null;
}

export const dictadoDisponible = (): boolean => constructorVoz() !== null;

/**
 * Empieza a escuchar. Entrega lo dicho (con mayúscula inicial) y avisa al
 * terminar. Devuelve con qué detenerlo antes de tiempo.
 */
export function dictar(alOir: (frase: string) => void, alTerminar: (error?: string) => void): () => void {
  const Constructor = constructorVoz();
  if (!Constructor) {
    alTerminar('no-disponible');
    return () => undefined;
  }

  const rec = new Constructor();
  rec.lang = 'es-BO';
  rec.interimResults = false;
  rec.continuous = false;
  rec.onresult = (evento) => {
    const dicho = Array.from(evento.results)
      .map((resultado) => resultado[0].transcript)
      .join(' ')
      .trim();
    if (dicho) alOir(dicho.charAt(0).toUpperCase() + dicho.slice(1));
  };
  rec.onerror = (evento) => alTerminar(evento.error);
  rec.onend = () => alTerminar();
  rec.start();
  return () => rec.stop();
}

/** Suma una frase al final de un texto, con un espacio en medio. */
export const sumarFrase = (texto: string, frase: string): string =>
  texto.trim() ? `${texto.trim()} ${frase}` : frase;
