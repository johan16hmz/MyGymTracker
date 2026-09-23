export const runtime = 'nodejs';

const fields = 'code,product_name,product_name_fr,brands,nutriments,quantity,product_quantity_unit';

export async function GET(request: Request) {
  const barcode = new URL(request.url).searchParams.get('barcode')?.trim();
  if (!barcode || !/^\d{8,14}$/.test(barcode)) {
    return Response.json({ error: 'Code-barres invalide.' }, { status: 400 });
  }

  try {
    const upstream = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${fields}`, {
      headers: { 'User-Agent': 'MyGymTracker/1.0 (https://mygymtracker-five.vercel.app)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok) return Response.json({ error: 'Base alimentaire indisponible.' }, { status: 502 });
    return new Response(await upstream.text(), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600' },
    });
  } catch {
    return Response.json({ error: 'Recherche indisponible. Réessaie plus tard.' }, { status: 502 });
  }
}
