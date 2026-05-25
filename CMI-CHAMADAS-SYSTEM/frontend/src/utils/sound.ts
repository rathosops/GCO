/**
 * Utilitário de Som - CMI Sistema de Chamadas
 * 
 * Otimizado para Samsung Tizen TV Browser
 * 
 * Melhores práticas aplicadas:
 * - HTMLAudioElement nativo (suportado em todos os navegadores Tizen)
 * - Preload dos arquivos MP3 para resposta instantânea
 * - Cache de instâncias para reutilização
 * - Novas instâncias para reprodução múltipla simultânea
 * - MP3 como formato (universalmente suportado)
 * 
 * Arquivos de áudio:
 * - /sfx/chamada_sfx.mp3 - Som de nova chamada (toca 3x no painel)
 * - /sfx/chamada_medico_triagem.mp3 - Som de rechamada (paciente demorando)
 */

// Caminhos dos arquivos de áudio (na pasta public/sfx/)
export const SOUNDS = {
  /** Som de nova chamada - toca 3x quando paciente é chamado */
  CHAMADA_SFX: '/sfx/chamada_sfx.mp3',
  /** Som de rechamada - toca 3x quando médico/triagem clica "Emitir Chamada" */
  CHAMADA_MEDICO_TRIAGEM: '/sfx/chamada_medico_triagem.mp3',
} as const;

// Cache de instâncias de áudio para reutilização (reprodução única)
const audioCache: Record<string, HTMLAudioElement> = {};

// Flag para verificar se os sons foram pré-carregados
let soundsPreloaded = false;

/**
 * Obtém ou cria uma instância de áudio do cache
 * Usado para reprodução única onde reutilização é desejada
 */
function getAudio(src: string): HTMLAudioElement {
  if (!audioCache[src]) {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = src;
    audioCache[src] = audio;
  }
  return audioCache[src];
}

/**
 * Toca um som uma vez
 * 
 * @param src - Caminho do arquivo de áudio
 * @param volume - Volume de 0 a 1 (padrão: 1.0)
 */
export async function playSound(src: string, volume = 1.0): Promise<void> {
  try {
    const audio = getAudio(src);
    audio.volume = Math.min(1, Math.max(0, volume));
    audio.currentTime = 0;
    await audio.play();
  } catch (error) {
    // Em TVs, erros de autoplay são comuns - não exibir warning
    if (error instanceof Error && !error.message.includes('user gesture')) {
      console.warn('[SFX] Erro ao tocar som:', error.message);
    }
  }
}

/**
 * Toca um som múltiplas vezes em sequência
 * 
 * Cria novas instâncias de Audio para cada reprodução para evitar
 * conflitos de timing em TVs com processamento mais lento.
 * 
 * @param src - Caminho do arquivo de áudio
 * @param times - Número de vezes para tocar (padrão: 3)
 * @param intervalMs - Intervalo entre cada reprodução em ms (padrão: 400ms)
 * @param volume - Volume de 0 a 1 (padrão: 1.0)
 */
export function playSoundMultiple(
  src: string,
  times = 3,
  intervalMs = 400,
  volume = 1.0
): void {
  const safeVolume = Math.min(1, Math.max(0, volume));
  
  for (let i = 0; i < times; i++) {
    setTimeout(() => {
      try {
        // Cria nova instância para cada reprodução
        // Isso evita conflitos quando o som anterior ainda não terminou
        const audio = new Audio(src);
        audio.volume = safeVolume;
        audio.play().catch(() => {
          // Ignora erros silenciosamente (comum em TVs sem interação do usuário)
        });
      } catch {
        // Ignora erros de criação de áudio
      }
    }, i * intervalMs);
  }
}

/**
 * Som de chamada para o painel
 * Toca o som chamada_sfx.mp3 três vezes rapidamente
 * 
 * Usado quando:
 * - Nova chamada é criada (paciente sendo chamado)
 * - Médico/Triagem clica "Emitir Chamada" (rechamada)
 */
export function playChamadaPainel(): void {
  playSoundMultiple(SOUNDS.CHAMADA_SFX, 3, 400, 1.0);
}

/**
 * Som de chamada único
 * Toca o som uma vez apenas
 */
export function playChamadaSingle(): void {
  playSound(SOUNDS.CHAMADA_SFX, 1.0);
}

/**
 * Som para emitir chamada (médico/triagem rechamando paciente)
 * 
 * NOTA: Este som é tocado no PAINEL, não localmente.
 * O médico/triagem chama a API que envia evento WebSocket
 * para o painel tocar o som.
 * 
 * Esta função está aqui para consistência e testes.
 */
export function playEmitirChamada(): void {
  playSoundMultiple(SOUNDS.CHAMADA_MEDICO_TRIAGEM, 3, 350, 1.0);
}

/**
 * Pré-carrega os sons para evitar atrasos na primeira reprodução
 * 
 * Importante para TVs Samsung onde o carregamento inicial pode ser lento.
 * Deve ser chamado no useEffect do componente principal.
 * 
 * Técnica: Cria elementos <audio> com preload="auto" que o navegador
 * começará a baixar imediatamente.
 */
export function preloadSounds(): void {
  if (soundsPreloaded) return;
  
  Object.values(SOUNDS).forEach((src) => {
    try {
      // Método 1: Criar Audio com preload
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = src;
      
      // Método 2: Adicionar ao cache para reutilização
      audioCache[src] = audio;
      
      // Método 3: Para TVs mais antigas, tentar fazer um fetch
      // Isso força o navegador a cachear o arquivo
      if ('fetch' in window) {
        fetch(src, { mode: 'no-cors' }).catch(() => {});
      }
    } catch {
      // Ignora erros de preload
    }
  });
  
  soundsPreloaded = true;
}

/**
 * Verifica se o navegador suporta reprodução de áudio
 */
export function isAudioSupported(): boolean {
  try {
    const audio = new Audio();
    return audio.canPlayType('audio/mpeg') !== '';
  } catch {
    return false;
  }
}

/**
 * Testa se o som pode ser reproduzido
 * Útil para debug em TVs
 */
export async function testSound(): Promise<boolean> {
  try {
    const audio = new Audio(SOUNDS.CHAMADA_SFX);
    audio.volume = 0.1;
    await audio.play();
    audio.pause();
    return true;
  } catch {
    return false;
  }
}
