/** Browser requests stay on the current preview/deployment origin.
 * Native clients still require the absolute API origin supplied at build time.
 */
export function mobileApiBase(platform: string, domain?: string): string {
  return platform === 'web' || !domain ? '' : `https://${domain}`;
}
