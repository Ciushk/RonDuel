import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RonDuel',
    short_name: 'RonDuel',
    description: 'The daily duel for your group chat.',
    start_url: '/?source=pwa',
    display: 'standalone',
    background_color: '#FFF7EC',
    theme_color: '#FF5A4E',
    icons: [
      {
        src: '/brand/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/brand/icon-maskable.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Play today',
        short_name: 'Play',
        url: '/en/play',
      },
      {
        name: 'My leagues',
        short_name: 'Leagues',
        url: '/en',
      },
    ],
  };
}
