export function buildUrl(path) {
  return `${window.location.protocol}//${window.location.host}${window.CONTEXT_PATH}/${path}`;
}
