import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => {
  const isSingle = mode === 'singlefile';
  return {
    plugins: isSingle
      ? [react(), tailwindcss(), viteSingleFile()]
      : [react(), tailwindcss()],
    build: isSingle
      ? {
          outDir: 'dist-single',
          assetsInlineLimit: 100_000_000,
          cssCodeSplit: false,
        }
      : undefined,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
