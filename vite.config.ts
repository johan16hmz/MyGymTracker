import { defineConfig } from 'vite';
import { GET as getFood } from './api/food.ts';

export default defineConfig({
  plugins: [{
    name: 'nutrition-food-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? '/', 'http://localhost');
        if (url.pathname !== '/api/food') return next();
        if (request.method !== 'GET') {
          response.writeHead(405, { Allow: 'GET', 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ error: 'Méthode non autorisée.' }));
          return;
        }
        // Use the same validated backend as production. Browser cookies and
        // origin/encoding headers must never be forwarded to the food provider.
        const result = await getFood(new Request(url));
        response.statusCode = result.status;
        result.headers.forEach((value, key) => response.setHeader(key, value));
        response.end(await result.text());
      });
    },
  }],
});
