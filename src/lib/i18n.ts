// The UI is English-only. useT() is kept as an identity helper so call sites stay simple.
export function useT(): (s: string) => string {
  return (s: string) => s;
}
