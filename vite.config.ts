import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api/food': {
        target: 'https://world.openfoodfacts.org',
        changeOrigin: true,
        headers: { 'User-Agent': 'MyGymTracker/1.0 (https://mygymtracker-five.vercel.app)' },
        rewrite(path) {
          const barcode = new URL(path, 'http://localhost').searchParams.get('barcode') ?? '';
          return `/api/v2/product/${encodeURIComponent(barcode)}.json?fields=code,product_name,product_name_fr,brands,nutriments,quantity,product_quantity_unit`;
        },
      },
    },
  },
});
