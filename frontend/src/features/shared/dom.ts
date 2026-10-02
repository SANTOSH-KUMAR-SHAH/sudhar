// Business: Shared DOM helpers used by every customer feature module.
// Technical: Tiny pure wrappers so feature files stay small and testable.

export function getEl<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isDesktop(): boolean {
  return window.innerWidth > 768;
}
