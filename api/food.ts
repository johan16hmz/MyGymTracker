export const runtime = 'nodejs';

export const foodFields = 'code,product_name,product_name_fr,generic_name,generic_name_fr,categories_tags,brands,nutriments,quantity,product_quantity_unit,serving_size,serving_quantity';
const foodAgent = 'MyGymTracker/1.0 (https://www.my-gym-tracker.app)';
const cache = new Map<string, { expires:number; data:unknown }>();
function cached(key:string) {
  const entry=cache.get(key);
  if(entry && entry.expires>Date.now())return entry.data;
  cache.delete(key);
}
function remember(key:string,data:unknown) {
  if(cache.size>=200)cache.delete(cache.keys().next().value!);
  cache.set(key,{expires:Date.now()+3600000,data});
}
const productUrl = (barcode:string) => `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${foodFields}`;

export function foodUpstreamUrl(params: URLSearchParams) {
  const barcode = params.get('barcode')?.trim();
  const query = params.get('query')?.trim();
  if (barcode && !query && /^\d{8,14}$/.test(barcode)) return productUrl(barcode);
  if (query && !barcode && query.length >= 2 && query.length <= 80 && !/[\u0000-\u001f]/.test(query)) {
    // Plain full-text words, not Lucene field/operator expressions or exact
    // quoted field values. Preserve accents while removing query syntax.
    const terms=query.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
    if(!terms)return null;
    const search = new URLSearchParams({q:terms,langs:'fr,en',boost_phrase:'true',page_size:'24',page:'1',fields:'code,product_name,product_name_fr,generic_name,generic_name_fr,categories_tags,brands'});
    return `https://search.openfoodfacts.org/search?${search}`;
  }
  return null;
}

export async function GET(request: Request) {
  const url = foodUpstreamUrl(new URL(request.url).searchParams);
  if (!url) return Response.json({ error: 'Code-barres ou recherche invalide.' }, { status: 400 });

  try {
    const previous=cached(url);
    if(previous!==undefined)return foodJson(previous);
    const upstream = await fetch(url, {
      headers: { 'User-Agent': foodAgent },
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok) return Response.json({ error: upstream.status === 429 ? 'Trop de recherches. Patiente une minute.' : 'Base alimentaire indisponible.' }, { status: upstream.status === 429 ? 429 : 502 });
    // A successful HTTP status can still contain an upstream error page.
    // Validate JSON rather than surfacing an HTML parsing error to the user.
    let data:unknown=await upstream.json();
    if(!data || typeof data!=='object')throw new Error('Invalid food response');
    if(new URL(url).hostname==='search.openfoodfacts.org') {
      const hits=(data as {hits?:unknown}).hits;
      if(!Array.isArray(hits))throw new Error('Invalid search response');
      const products=hits.slice(0,24).filter((hit):hit is Record<string,unknown>=>!!hit && typeof hit==='object').map((hit):Record<string,unknown>=>({
        ...hit,
        brands:Array.isArray(hit.brands)?hit.brands.filter(brand=>typeof brand==='string').join(', '):hit.brands,
      }));
      // The search index contains names, not nutrition facts. Hydrate the first
      // six results via the product API, without overwhelming the provider.
      // Other products can still be selected and loaded on demand by barcode.
      await Promise.all(products.slice(0,6).map(async(product,index)=>{
        if(typeof product.code!=='string' || !/^\d{8,14}$/.test(product.code))return;
        const detailUrl=productUrl(product.code);
        try {
          let details=cached(detailUrl);
          if(details===undefined) {
            const response=await fetch(detailUrl,{headers:{'User-Agent':foodAgent},signal:AbortSignal.timeout(4000)});
            if(!response.ok)return;
            details=await response.json();
            if(!details || typeof details!=='object' || (details as {status?:unknown}).status!==1)return;
            remember(detailUrl,details);
          }
          const food=(details as {product?:unknown}).product;
          if(food && typeof food==='object')products[index]={...product,...food};
        }catch { /* Preserve the searchable name; never invent missing facts. */ }
      }));
      data={products};
    }
    remember(url,data);
    return foodJson(data);
  } catch {
    return Response.json({ error: 'Recherche indisponible. Réessaie plus tard.' }, { status: 502 });
  }
}

function foodJson(data:unknown) {
  return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, s-maxage=3600'}});
}
