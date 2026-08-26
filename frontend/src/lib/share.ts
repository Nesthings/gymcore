export type PlatformType = 'ios' | 'android' | 'desktop'

// Detecta el SO del socio para abrir WhatsApp real (app en móvil, web en
// escritorio) en lugar de depender de un redirect genérico.
export function detectPlatform(): PlatformType {
  const ua = navigator.userAgent || ''
  // iPadOS 13+ se reporta como "MacIntel": lo distinguimos por el tacto.
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  if (
    /Macintosh/.test(ua) &&
    (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints != null &&
    (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1
  ) {
    return 'ios'
  }
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

export function isMobilePlatform(): boolean {
  return detectPlatform() !== 'desktop'
}

// Construye el enlace que abre WhatsApp (app en móvil, web en escritorio)
// con la frase y el enlace del pase ya codificados.
export function buildWhatsAppUrl(message: string): string {
  const encoded = encodeURIComponent(message)
  const platform = detectPlatform()
  if (platform === 'ios') return `whatsapp://send?text=${encoded}`
  if (platform === 'android') return `https://api.whatsapp.com/send?text=${encoded}`
  return `https://web.whatsapp.com/send?text=${encoded}`
}