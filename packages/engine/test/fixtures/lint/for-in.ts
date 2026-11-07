export function f(o: object) {
  for (const k in o) {
    void k;
  }
}
