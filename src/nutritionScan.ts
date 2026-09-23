// A scanner can read a barcode directly or a QR containing a product URL / GS1 Digital Link.
export function foodCodeFromScan(raw: string): string | null {
  const value = raw.trim();
  if (/^\d{8,14}$/.test(value)) return value;

  // GS1 element strings may be encoded directly in a QR or Data Matrix.
  const gs1Element = value.match(/^(?:\]Q3|\]d2)?\s*\(?01\)?(\d{14})(?:\D|$)/i);
  if (gs1Element) return gs1Element[1];

  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    const path = decodeURIComponent(url.pathname);
    if (host === 'openfoodfacts.org' || host.endsWith('.openfoodfacts.org')) {
      const product = path.match(/\/(?:product|produit)\/(\d{8,14})(?:\/|$)/i);
      if (product) return product[1];
    }
    const digitalLink = path.match(/\/01\/(\d{8,14})(?:\/|$)/);
    if (digitalLink) return digitalLink[1];
    for (const key of ['gtin', 'ean', 'barcode', 'code', '01']) {
      const code = url.searchParams.get(key);
      if (code && /^\d{8,14}$/.test(code)) return code;
    }
  } catch { /* The decoded value is not a URL. */ }
  return null;
}
