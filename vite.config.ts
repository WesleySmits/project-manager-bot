import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    root: './src/web',
    test: {
        root: path.resolve(__dirname),
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        environment: 'node',
    },
    build: {
        outDir: '../../dist/web',
        emptyOutDir: true,
    },
    server: {
        port: 5173,
        proxy: {
            '/api': 'http://localhost:3301',
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src/web'),
        },
    },
});
