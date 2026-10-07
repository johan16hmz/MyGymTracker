function cameraErrorName(error: unknown) {
  return error && typeof error === 'object' && 'name' in error ? error.name : undefined;
}

export function foodCameraErrorMessage(error: unknown) {
  switch (cameraErrorName(error)) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Accès caméra refusé. Autorise la caméra pour ce site dans ton navigateur, puis réessaie.';
    case 'NotFoundError':
      return 'Aucune caméra détectée sur cet appareil. Tu peux saisir le code-barres ci-dessous.';
    case 'NotReadableError':
    case 'AbortError':
      return 'La caméra est occupée ou indisponible. Ferme les autres applications qui l’utilisent, puis réessaie.';
    default:
      return 'Caméra indisponible. Réessaie ou saisis le code-barres ci-dessous.';
  }
}

export async function requestFoodCamera(devices: Pick<MediaDevices, 'getUserMedia'>) {
  try {
    return await devices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } });
  } catch (error) {
    // Retry only unsupported constraints, never repeat a denied permission request.
    if (cameraErrorName(error) !== 'OverconstrainedError') throw error;
    return devices.getUserMedia({ audio: false, video: true });
  }
}

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
