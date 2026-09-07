/** Beep corto con WebAudio para feedback audible del lector QR. */

let ctx: AudioContext | null = null

function audioCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
    }
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }
    return ctx
  } catch {
    return null
  }
}

/**
 * Reproduce un tono corto. Frecuencias sugeridas:
 * 880 = éxito · 660 = aviso · 440 = sin membresía · 300/280 = error.
 */
export function playBeep(freq = 880, duration = 0.12): void {
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (prefersReduced) return
  const ac = audioCtx()
  if (!ac) return
  try {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration)
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.start()
    osc.stop(ac.currentTime + duration + 0.02)
  } catch {
    // sin audio disponible: ignorar
  }
}