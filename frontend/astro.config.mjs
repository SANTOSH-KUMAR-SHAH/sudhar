import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Business: Frontend uses the approved Astro + Tailwind + TypeScript stack.
// Technical: Tailwind v4 runs as a Vite plugin; static output is preserved.
export default defineConfig({
  site: 'https://sudhar-lab.example',
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});
