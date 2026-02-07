export function makeId(prefix: string): string {
  const part = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  return `${prefix}_${part}`;
}
