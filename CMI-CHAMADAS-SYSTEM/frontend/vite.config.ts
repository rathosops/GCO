import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3001,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Otimizações para TV Samsung
    target: 'es2020', // Tizen suporta ES2020
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug'],
      },
      mangle: true,
    },
    rollupOptions: {
      output: {
        // Chunks menores para carregamento mais rápido
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          icons: ['lucide-react'],
        },
        // Nomes curtos para reduzir tamanho
        chunkFileNames: 'js/[hash:8].js',
        entryFileNames: 'js/[hash:8].js',
        assetFileNames: 'assets/[hash:8].[ext]',
      },
    },
    // Limite de aviso de chunk
    chunkSizeWarningLimit: 500,
  },
  // CSS otimizado
  css: {
    devSourcemap: false,
  },
  // Preview otimizado
  preview: {
    port: 3001,
    host: true,
  },
});