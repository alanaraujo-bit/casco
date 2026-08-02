import type { MetadataRoute } from 'next'

/**
 * Ícones em `public/icones/`: são os únicos que o manifesto de PWA usa. Os
 * ícones de `src/app/` (favicon.ico, icon.svg, apple-icon.png) são detectados
 * por convenção do Next e não entram aqui — este arquivo é só para a tela
 * inicial do celular (Android/Chrome; o iOS lê o `apple-icon.png` direto).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Casco',
    short_name: 'Casco',
    description: 'Gestão para distribuidoras com vasilhame retornável — água e gás.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f3f4f6',
    theme_color: '#f3f4f6',
    icons: [
      { src: '/icones/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icones/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icones/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
