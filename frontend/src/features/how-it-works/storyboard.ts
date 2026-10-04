// Business: 6-step storyboard (submit → call → visit → inspect → quote → approve).
// Technical: Desktop scroll-spy + mobile swipe carousel + scrubbed connector line.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getEl, isDesktop, prefersReducedMotion } from '../shared/dom';

gsap.registerPlugin(ScrollTrigger);

interface HiwSlide {
  tag: string;
  title: string;
}

export const HIW_DATA: HiwSlide[] = [
  { tag: 'Step 01 • Instant Online Form', title: 'You submit a request' },
  { tag: 'Step 02 • Confirmation Call', title: 'We call to confirm' },
  { tag: 'Step 03 • Technician Dispatch', title: 'Technician arrives at your door' },
  { tag: 'Step 04 • On-Site Fault Check', title: 'We inspect and diagnose' },
  { tag: 'Step 05 • Transparent Pricing', title: 'We present the repair quote' },
  { tag: 'Step 06 • Repair Approved', title: 'You approve — repair begins' },
];

export const HIW_TOTAL = HIW_DATA.length;

let currentHiwStep = 0;
let hiwTimer: number | null = null;

export function getHiwStep(): number {
  return currentHiwStep;
}

export function setHiwStep(idx: number, userInteracted = false): void {
  // Business: Show the matching step photo + caption as the customer explores.
  // Technical: Cross-fade slide images and mark the active step card.
  if (userInteracted && hiwTimer !== null) {
    window.clearInterval(hiwTimer);
    hiwTimer = null;
  }
  currentHiwStep = idx;
  for (let i = 0; i < HIW_TOTAL; i++) {
    // Business: Photo must follow the step the customer is reading.
    // Technical: Activate only the slide matching idx so cross-fade works.
    getEl(`hiwImg${i}`)?.classList.toggle('is-active', i === idx);
  }
  const pill = getEl('hiwStepPill');
  const tag = getEl('hiwCapTag');
  const title = getEl('hiwCapTitle');
  const slide = HIW_DATA[idx];
  if (pill) pill.textContent = `STEP 0${idx + 1} OF 06`;
  if (tag && slide) tag.textContent = slide.tag;
  if (title && slide) title.textContent = slide.title;
  document.querySelectorAll('.hiw-item').forEach((item, i) => {
    item.classList.toggle('is-active', i === idx);
    item.setAttribute('aria-expanded', String(i === idx));
  });
}

export function initHiwScrollSpy(): void {
  // Business: Pinned image follows each step 1→6 as customer scrolls, starting at 1.
  // Technical: Observe each .hiw-item crossing viewport center.
  if (!isDesktop() || prefersReducedMotion()) return;
  const items = Array.from(document.querySelectorAll<HTMLElement>('.hiw-item'));
  if (items.length === 0) return;
  // Business: Section must always start at step 1 when first seen.
  // Technical: Reset to 0 on load so scroll never lands on 4/5 directly.
  setHiwStep(0);
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const idx = items.indexOf(entry.target as HTMLElement);
        if (idx !== -1 && idx !== currentHiwStep) setHiwStep(idx);
      }
    },
    { root: null, rootMargin: '-42% 0px -42% 0px', threshold: 0 },
  );
  items.forEach((item) => observer.observe(item));
}

export function initMobileCarousel(): void {
  // Business: Mobile customers swipe through process steps as cards.
  // Technical: Track transform carousel with dots, arrows, touch swipe, autoplay.
  const track = getEl('hiwMobTrack');
  if (!track) return;
  const dots = Array.from(document.querySelectorAll('.hiw-mob-dot'));
  const prevBtn = getEl('hiwMobPrev');
  const nextBtn = getEl('hiwMobNext');
  const wrap = getEl('hiwMobTrackWrap');
  const total = HIW_TOTAL;
  let current = 0;
  let autoTimer: number | null = null;
  let touchStartX = 0;
  let touchEndX = 0;
  const goTo = (idx: number): void => {
    current = Math.max(0, Math.min(idx, total - 1));
    track.style.transform = `translateX(-${current * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle('is-active', i === current));
    if (prevBtn) (prevBtn as HTMLButtonElement).disabled = current === 0;
    if (nextBtn) (nextBtn as HTMLButtonElement).disabled = current === total - 1;
  };
  const startAuto = (): void => {
    if (autoTimer !== null) return;
    autoTimer = window.setInterval(() => {
      goTo(current < total - 1 ? current + 1 : 0);
    }, 4000);
  };
  const stopAuto = (): void => {
    if (autoTimer !== null) {
      window.clearInterval(autoTimer);
      autoTimer = null;
    }
  };
  prevBtn?.addEventListener('click', () => {
    stopAuto();
    goTo(current - 1);
  });
  nextBtn?.addEventListener('click', () => {
    stopAuto();
    goTo(current + 1);
  });
  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      stopAuto();
      const idx = Number((dot as HTMLElement).dataset['idx'] ?? '0');
      goTo(idx);
    });
  });
  wrap?.addEventListener(
    'touchstart',
    (e) => {
      touchStartX = e.changedTouches[0]?.screenX ?? 0;
    },
    { passive: true },
  );
  wrap?.addEventListener(
    'touchend',
    (e) => {
      touchEndX = e.changedTouches[0]?.screenX ?? 0;
      const diff = touchStartX - touchEndX;
      if (Math.abs(diff) > 40) {
        stopAuto();
        goTo(diff > 0 ? current + 1 : current - 1);
      }
    },
    { passive: true },
  );
  goTo(0);
  startAuto();
}

export function initHiwConnector(): void {
  // Business: Draw the process connector line as the customer reads each step.
  // Technical: GSAP scrubbed ScrollTrigger — line fills proportional to scroll.
  const steps = getEl('hiwSteps');
  const fill = getEl('hiwFill');
  if (!steps || !fill) return;
  gsap.set(fill, { width: '0%' });
  gsap.to(fill, {
    width: '100%',
    ease: 'none',
    scrollTrigger: {
      trigger: steps,
      start: 'top 80%',
      end: 'bottom 60%',
      scrub: true,
    },
  });
}
