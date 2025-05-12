declare global {
  interface Window {
    __ISOSCRIBE__?: Record<string, Isoscribe>;
  }
}

export {};
