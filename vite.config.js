import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({server:{proxy:{'/api':'http://127.0.0.1:3000'}},build:{rollupOptions:{input:{main:resolve('index.html'),demo:resolve('demo.html')}}}});
