import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://chanmaoyoupu.com',
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
  },
});
