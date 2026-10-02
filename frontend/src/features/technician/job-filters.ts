// Business: One-thumb filter so tech sees Today / Upcoming / Completed fast.
// Technical: Toggle data-group cards; show inline empty note when none match.
export function initJobFilters(): void {
  const pills = Array.from(
    document.querySelectorAll<HTMLElement>('.pill[data-filter]'),
  );
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>('.job-card[data-group]'),
  );
  const empty = document.getElementById('jobsEmpty');
  if (pills.length === 0 || cards.length === 0) return;
  pills.forEach((pill) => {
    pill.addEventListener('click', () => {
      pills.forEach((p) => {
        p.classList.remove('active');
        p.setAttribute('aria-selected', 'false');
      });
      pill.classList.add('active');
      pill.setAttribute('aria-selected', 'true');
      const f = pill.getAttribute('data-filter');
      let visible = 0;
      cards.forEach((card) => {
        const show = f === 'all' || card.getAttribute('data-group') === f;
        card.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      if (empty) empty.hidden = visible !== 0;
    });
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initJobFilters, { once: true });
  } else {
    initJobFilters();
  }
}
