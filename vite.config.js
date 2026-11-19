import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Waktu `npm run dev`, jalankan juga fungsi server di folder api/ (biar ga perlu `vercel dev`).
// Di Vercel, folder api/ otomatis jadi Vercel Functions.
function localApi() {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res, next) => {
        const name = (req.url || '').split('?')[0].replace(/^\/+|\/+$/g, '');
        if (!/^[a-z0-9-]+$/.test(name)) return next();
        let mod;
        try {
          mod = await server.ssrLoadModule(`/api/${name}.js`);
        } catch {
          return next();
        }
        let raw = '';
        for await (const chunk of req) raw += chunk;
        try {
          req.body = raw ? JSON.parse(raw) : {};
        } catch {
          req.body = {};
        }
        const shim = {
          status(code) {
            res.statusCode = code;
            return shim;
          },
          json(data) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
            return shim;
          },
        };
        try {
          await mod.default(req, shim);
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(e?.message || e) }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // baca GEMINI_API_KEY dkk dari .env.local buat fungsi server lokal
  const env = loadEnv(mode, process.cwd(), '');
  for (const k of ['GEMINI_API_KEY', 'GEMINI_IMAGE_MODEL', 'GEMINI_TEXT_MODEL']) if (env[k]) process.env[k] = env[k];
  return {
    plugins: [react(), localApi()],
    optimizeDeps: { exclude: ['@imgly/background-removal'] },
  };
});
