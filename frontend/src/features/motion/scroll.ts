// Business: Cinematic scroll feel (reveals, hero parallax, stagger, trust, footer).
// Technical: GSAP + ScrollTrigger only; respects prefers-reduced-motion everywhere.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { isDesktop, prefersReducedMotion } from '../shared/dom';

gsap.registerPlugin(ScrollTrigger);
gsap.defaults({ ease: 'power3.out', overwrite: 'auto' });

export function initMotionDefaults(): void {
  gsap.defaults({ ease: 'power3.out', overwrite: 'auto' });
}

export function initReveals(): void {
  // Business: Content rises into view as the customer scrolls each section.
  // Technical: ScrollTrigger.batch groups elements entering viewport within 0.12s.
  const mm = gsap.matchMedia();
  mm.add(
    {
      isDesktop: '(min-width: 768px)',
      reduceMotion: '(prefers-reduced-motion: reduce)',
    },
    (context) => {
      const { reduceMotion } = context.conditions as { reduceMotion: boolean };
      if (reduceMotion) {
        document.querySelectorAll<HTMLElement>('.reveal').forEach((el) => {
          el.classList.add('in');
        });
        return;
      }
      // Business: Sections rise softly so the page feels alive on scroll.
      // Technical: JS-only hidden state so no-JS still shows content; exclude cards.
      gsap.set('.reveal:not(.svc-card)', { autoAlpha: 0, y: 12 });
      ScrollTrigger.batch('.reveal:not(.svc-card)', {
        interval: 0.1,
        batchMax: 6,
        onEnter: (batch) => {
          gsap.to(batch, {
            autoAlpha: 1,
            y: 0,
            duration: 0.5,
            stagger: 0.06,
            ease: 'power2.out',
            clearProps: 'transform,visibility,opacity',
            onComplete: () => {
              batch.forEach((el) => el.classList.add('in'));
            },
          });
        },
        start: 'top 90%',
      });
    },
  );
}

export function initHeroParallax(): void {
  // Business: Hero depth illusion — background drifts slower than foreground text.
  // Technical: scale(1.35) buffer guarantees edges never expose during 0.15x travel.
  if (prefersReducedMotion()) return;
  const bgImg = document.querySelector<HTMLElement>('.hero-bg img');
  const section = document.querySelector<HTMLElement>('.hero');
  const inner = document.querySelector<HTMLElement>('.hero-inner');
  if (!bgImg || !section) return;
  bgImg.style.transform = 'translateY(0px) scale(1.35) translateZ(0)';
  bgImg.style.transition = 'transform 1.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      bgImg.style.transform = 'translateY(0px) scale(1.2) translateZ(0)';
    });
  });
  setTimeout(() => {
    bgImg.style.transition = 'none';
    setupScrollParallax(bgImg, section, inner);
  }, 1900);
}

function setupScrollParallax(
  bgImg: HTMLElement,
  section: HTMLElement,
  inner: HTMLElement | null,
): void {
  let lastScrollY = window.scrollY;
  let ticking = false;
  const applyParallax = (): void => {
    const scrollY = lastScrollY;
    const heroH = section.offsetHeight || 1;
    if (scrollY > heroH * 1.2) {
      ticking = false;
      return;
    }
    // Business: Background moves down (+Y) so it appears slower than the page.
    // Technical: Net viewport movement 0.85x creates depth without exposing edges.
    const bgY = scrollY * 0.15;
    bgImg.style.transform = `translateY(${bgY.toFixed(2)}px) scale(1.2) translateZ(0)`;
    if (inner) {
      const textY = -(scrollY * 0.06);
      const fadeStart = heroH * 0.45;
      const fadeEnd = heroH * 0.8;
      const t = Math.min(1, Math.max(0, (scrollY - fadeStart) / (fadeEnd - fadeStart)));
      inner.style.transform = `translateY(${textY.toFixed(2)}px) translateZ(0)`;
      inner.style.opacity = (1 - t).toFixed(3);
    }
    ticking = false;
  };
  window.addEventListener(
    'scroll',
    () => {
      lastScrollY = window.scrollY;
      if (!ticking) {
        requestAnimationFrame(applyParallax);
        ticking = true;
      }
    },
    { passive: true },
  );
  applyParallax();
}

export function initServiceStagger(): void {
  // Business: Service cards fade up with teal glow so categories feel alive.
  // Technical: JS-only hidden state, then stagger to visible on scroll.
  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    gsap.set('.svc-card', { autoAlpha: 0, y: 18 });
    ScrollTrigger.batch('.svc-card', {
      interval: 0.1,
      batchMax: 4,
      onEnter: (batch) => {
        gsap.to(batch, {
          autoAlpha: 1,
          y: 0,
          duration: 0.55,
          stagger: 0.1,
          ease: 'power2.out',
          clearProps: 'transform,visibility,opacity',
        });
      },
      start: 'top 88%',
      once: true,
    });
  });
  gsap.matchMedia().add('(prefers-reduced-motion: reduce)', () => {
    gsap.set('.svc-card', { clearProps: 'all' });
  });
}

export function initTrustBlocks(): void {
  // Business: Trust promises appear cleanly with minimal delay.
  // Technical: One-shot timeline triggered at 85% viewport.
  const section = document.querySelector<HTMLElement>('.trust-sec');
  const blocks = gsap.utils.toArray<HTMLElement>('.trust-block');
  if (!section || blocks.length === 0) return;
  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    gsap.set(blocks, { autoAlpha: 0, y: 14 });
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top 85%',
        toggleActions: 'play none none none',
      },
    });
    tl.to(blocks, {
      autoAlpha: 1,
      y: 0,
      duration: 0.45,
      stagger: 0.08,
      ease: 'power2.out',
      clearProps: 'transform,visibility,opacity',
    });
  });
  mm.add('(prefers-reduced-motion: reduce)', () => {
    gsap.set(blocks, { clearProps: 'all' });
    section.classList.add('mot-line-in');
  });
}

export function initFooterClose(): void {
  // Business: Closing CTA subtly insets like a completed job file near the footer.
  // Technical: Scroll-linked clip-path driven by viewport progress.
  const finalCta = document.querySelector<HTMLElement>('.final-cta');
  if (!finalCta || !isDesktop() || prefersReducedMotion()) return;
  const onScroll = (): void => {
    const rect = finalCta.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const progress = Math.max(0, Math.min(1, (vh - rect.top) / (rect.height || 1)));
    const bell = Math.sin(progress * Math.PI);
    if (bell < 0.02) {
      finalCta.style.clipPath = '';
      return;
    }
    const inset = (bell * 2.0).toFixed(2);
    const radius = Math.round(bell * 14);
    finalCta.style.clipPath = `inset(0 ${inset}% 0 ${inset}% round ${radius}px)`;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
