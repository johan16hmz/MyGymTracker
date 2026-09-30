export function isRecoveryLocation(href: string) {
  const url = new URL(href);
  return url.searchParams.get('auth') === 'recovery' || new URLSearchParams(url.hash.slice(1)).get('type') === 'recovery';
}

export function clearRecoveryLocation() {
  const url = new URL(window.location.href);
  url.searchParams.delete('auth');
  url.hash = '';
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

export function hasRecoveryErrorLocation(href: string) {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  return url.searchParams.has('error') || url.searchParams.has('error_code') || hash.has('error') || hash.has('error_code');
}
