import { defineConfig, normalizePath } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react-swc';
import vitePluginBundleObfuscator from 'vite-plugin-bundle-obfuscator';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { logging, server as wisp } from '@mercuryworkshop/wisp-js/server';
import { createBareServer } from "@tomphttp/bare-server-node";
import { bareModulePath } from '@mercuryworkshop/bare-as-module3';
import { libcurlPath } from '@mercuryworkshop/libcurl-transport';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';
import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { uvPath } from '@titaniumnetwork-dev/ultraviolet';
import dotenv from "dotenv";

dotenv.config();
const useBare = process.env.BARE === "false" ? false : true;
const __dirname = dirname(fileURLToPath(import.meta.url));
logging.set_level(logging.NONE);
let bare;

const routeRequest = (req, resOrSocket, head) => {
  if (req.url?.startsWith('/wisp/')) return wisp.routeRequest(req, resOrSocket, head);
  if (bare?.shouldRoute(req))
    return head ? bare.routeUpgrade(req, resOrSocket, head) : bare.routeRequest(req, resOrSocket);
};

const obf = {
  enable: true,
  autoExcludeNodeModules: true,
  threadPool: true,
  options: {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.5,
    deadCodeInjection: false,
    debugProtection: false,
    disableConsoleOutput: true,
    identifierNamesGenerator: 'hexadecimal',
    selfDefending: true,
    simplify: true,
    splitStrings: false,
    stringArray: true,
    stringArrayEncoding: [],
    stringArrayCallsTransform: false,
    transformObjectKeys: false,
    unicodeEscapeSequence: false,
    ignoreImports: true,
  },
};

export default defineConfig(({ command }) => {
  const environment = command === 'serve' ? 'dev' : 'stable';

  return {
    // 1. FIXED PATHS FOR GITHUB PAGES
    base: '/doge-v5/', 

    plugins: [
      react(),
      vitePluginBundleObfuscator(obf),
      viteStaticCopy({
        targets: [
          { src: [normalizePath(resolve(libcurlPath, '*'))], dest: 'libcurl' },
          { src: [normalizePath(resolve(baremuxPath, '*'))], dest: 'baremux' },
          { src: [normalizePath(resolve(scramjetPath, '*'))], dest: 'scram' },
          useBare && { src: [normalizePath(resolve(bareModulePath, '*'))], dest: 'baremod' },
          {
            src: [
              normalizePath(resolve(uvPath, 'uv.handler.js')),
              normalizePath(resolve(uvPath, 'uv.client.js')),
              normalizePath(resolve(uvPath, 'uv.bundle.js')),
              normalizePath(resolve(uvPath, 'sw.js')),
            ],
            dest: 'uv',
          },
        ].filter(Boolean),
      }),
      {
        name: 'server',
        apply: 'serve',
        configureServer(server) {
          bare = createBareServer('/seal/');
          server.httpServer?.on('upgrade', (req, sock, head) => routeRequest(req, sock, head));
          server.middlewares.use((req, res, next) => routeRequest(req, res) || next());
        },
      },
    ],
    build: {
      esbuild: { 
        legalComments: 'none',
        treeShaking: true
      },
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          loader: resolve(__dirname, 'src/static/loader.html'),
        },
        output: {
          entryFileNames: '[hash].js',
          chunkFileNames: (chunk) =>
            chunk.name === 'vendor-modules' ? 'chunks/vendor-modules.[hash].js' : 'chunks/[hash].js',
          assetFileNames: 'assets/[hash].[ext]',
          manualChunks: (id) => (id.includes('node_modules') ? 'vendor-modules' : undefined),
        },
      },
      minify: 'esbuild',
      sourcemap: false
    },
    define: {
      __ENVIRONMENT__: JSON.stringify(environment)
    }
  };
});
