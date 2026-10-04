// Business: FAQ answers stay scannable by journey stage (Before / During / After).
// Technical: Single-open accordion + mobile-only category filter; desktop shows all.

export function toggleFaq(btn: HTMLElement): void {
  // Business: Let customers expand one answer at a time without leaving the page.
  // Technical: Collapse all items, then expand the tapped one.
  const item = btn.closest('.faq-item');
  if (!item) return;
  const answer = item.querySelector<HTMLElement>('.faq-a');
  const isOpen = item.classList.contains('is-open');
  document.querySelectorAll('.faq-item.is-open').forEach((open) => {
    open.classList.remove('is-open');
    const body = open.querySelector<HTMLElement>('.faq-a');
    if (body) body.style.maxHeight = '0';
    open.querySelector('.faq-q')?.setAttribute('aria-expanded', 'false');
    // Business: Keep the +/- symbol in sync so customers see open state.
    // Technical: Reset every collapsed toggle back to plus.
    const toggle = open.querySelector('.faq-toggle');
    if (toggle) toggle.textContent = '+';
  });
  if (!isOpen && answer) {
    item.classList.add('is-open');
    answer.style.maxHeight = `${answer.scrollHeight}px`;
    btn.setAttribute('aria-expanded', 'true');
    const toggle = item.querySelector('.faq-toggle');
    if (toggle) toggle.textContent = '−';
  }
}

export function switchFaqCat(cat: string, btn: HTMLElement): void {
  // Business: Filter FAQs by journey stage so answers stay scannable on mobile.
  // Technical: Toggle .faq-cat active state and show/hide items by data-cat on mobile.
  document.querySelectorAll('.faq-cat').forEach((t) => t.classList.remove('is-active'));
  btn.classList.add('is-active');
  // Business: Desktop shows all 3 columns at once; filtering is mobile-only.
  // Technical: On desktop reset display and keep existing open state untouched.
  if (window.innerWidth > 768) {
    document.querySelectorAll<HTMLElement>('.faq-item').forEach((i) => {
      i.style.display = '';
    });
    return;
  }
  const visible: HTMLElement[] = [];
  document.querySelectorAll<HTMLElement>('.faq-item').forEach((item) => {
    const show = item.dataset['cat'] === cat;
    // Business: Tapped category must actually appear on mobile.
    // Technical: Stylesheet hard-hides during/after, so "" is not enough — use block.
    item.style.display = show ? 'block' : 'none';
    const toggle = item.querySelector('.faq-toggle');
    if (!show) {
      item.classList.remove('is-open');
      const body = item.querySelector<HTMLElement>('.faq-a');
      if (body) body.style.maxHeight = '0';
      item.querySelector('.faq-q')?.setAttribute('aria-expanded', 'false');
      if (toggle) toggle.textContent = '+';
    } else {
      if (toggle && !item.classList.contains('is-open')) toggle.textContent = '+';
      visible.push(item);
    }
  });
  const first = visible[0];
  if (first) {
    const answer = first.querySelector<HTMLElement>('.faq-a');
    const toggle = first.querySelector('.faq-toggle');
    first.classList.add('is-open');
    if (answer) answer.style.maxHeight = `${answer.scrollHeight}px`;
    first.querySelector('.faq-q')?.setAttribute('aria-expanded', 'true');
    if (toggle) toggle.textContent = '−';
  }
}

export function initFaqMobile(): void {
  // Business: Mobile shows one category at a time with the first answer open.
  // Technical: Force before-items visible on small screens; restore on resize.
  if (window.innerWidth > 768) return;
  const items = Array.from(document.querySelectorAll<HTMLElement>('.faq-item'));
  if (items.length === 0) return;
  const before = items.filter((i) => i.dataset['cat'] === 'before');
  const target = before.length > 0 ? before : items;
  target.forEach((item, i) => {
    item.style.display = 'block';
    const answer = item.querySelector<HTMLElement>('.faq-a');
    const btn = item.querySelector<HTMLElement>('.faq-q');
    const toggle = item.querySelector('.faq-toggle');
    if (i === 0) {
      item.classList.add('is-open');
      if (answer) answer.style.maxHeight = `${answer.scrollHeight}px`;
      btn?.setAttribute('aria-expanded', 'true');
      if (toggle) toggle.textContent = '−';
    } else if (item.dataset['cat'] === target[0]?.dataset['cat']) {
      item.classList.remove('is-open');
      if (answer) answer.style.maxHeight = '0';
      btn?.setAttribute('aria-expanded', 'false');
      if (toggle) toggle.textContent = '+';
    }
  });
  items.forEach((item) => {
    if (item.dataset['cat'] !== target[0]?.dataset['cat']) {
      item.style.display = 'none';
      item.classList.remove('is-open');
      const body = item.querySelector<HTMLElement>('.faq-a');
      if (body) body.style.maxHeight = '0';
    }
  });
  // Business: Rotating to desktop must restore all 3 columns.
  // Technical: Clear inline hiding once viewport grows past mobile.
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      document.querySelectorAll<HTMLElement>('.faq-item').forEach((it) => {
        it.style.display = '';
      });
    }
  });
}

export function initKeyboardFaq(scope: ParentNode = document): void {
  scope.querySelectorAll<HTMLElement>('.faq-item .faq-q').forEach(() => {
    // buttons already handle Enter/Space natively; no extra JS needed
  });
}
