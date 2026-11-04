import { defineConfig, type Preset } from '@vite-pwa/assets-generator/config';

// App icons for the installed web app, generated from public/icon.svg at build time.
// Maskable (Android) and Apple icons fill the rounded corners with the brand colour, since
// the phone applies its own icon shape.
const brandFill = { padding: 0, resizeOptions: { background: '#b5d92b' } };

const preset: Preset = {
  transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']], padding: 0 },
  maskable: { sizes: [512], ...brandFill },
  apple: { sizes: [180], ...brandFill },
};

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset,
  images: ['public/icon.svg'],
});
