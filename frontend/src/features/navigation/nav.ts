// Business: Sticky nav, mobile drawer and ambient motion that signal a live service page.
// Technical: Passive scroll listeners + rAF decay; all IDs preserved for existing markup.
import { getEl, isDesktop, prefersReducedMotion } from '../shared/dom';

export function initNavScroll(): void {
  // Business: Keep navigation readable once the customer scrolls past the hero.
  // Technical: Toggle .stuck on #nav after 20px using a passive scroll listener.
  const nav = getEl('nav');
  if (!nav) return;
  window.addEventListener(
    'scroll',
    () => {
      nav.classList.toggle('stuck', window.scrollY > 20);
    },
    { passive: true },
  );
}

export function initDrawer(): void {
  // Business: Mobile customers need a thumb-friendly menu that opens/closes reliably.
  // Technical: Toggle .open on hamburger + drawer; close on link, outside tap, Escape.
  const hamburger = getEl('navHamburger');
  const drawer = getEl('mobileDrawer');
  if (!hamburger || !drawer) return;
  const open = (): void => {
    hamburger.classList.add('open');
    drawer.classList.add('open');
    hamburger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    drawer.style.transform = '';
  };
  const close = (): void => {
    hamburger.classList.remove('open');
    drawer.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    drawer.style.transform = '';
  };
  hamburger.addEventListener('click', () => {
    if (drawer.classList.contains('open')) close();
    else open();
  });
  drawer.querySelectorAll('.drawer-link').forEach((link) => {
    link.addEventListener('click', close);
  });
  document.addEventListener('click', (event) => {
    const target = event.target as Node;
    if (
      drawer.classList.contains('open') &&
      !drawer.contains(target) &&
      !hamburger.contains(target)
    ) {
      close();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
  // Business: Story sheet dismisses with a downward thumb swipe like social apps.
  // Technical: Track handle touch, drag drawer, close past 110px else snap back.
  const handle = getEl('drawerHandle');
  const dragTarget = handle ?? drawer;
  let dragY: number | null = null;
  let dragDelta = 0;
  dragTarget.addEventListener(
    'touchstart',
    (event) => {
      if (!drawer.classList.contains('open')) return;
      dragY = event.touches[0]?.clientY ?? null;
      dragDelta = 0;
      drawer.style.transition = 'none';
    },
    { passive: true },
  );
  dragTarget.addEventListener(
    'touchmove',
    (event) => {
      if (dragY === null || !drawer.classList.contains('open')) return;
      const y = event.touches[0]?.clientY ?? dragY;
      dragDelta = Math.max(0, y - dragY);
      drawer.style.transform = `translateY(${dragDelta}px)`;
    },
    { passive: true },
  );
  const endDrag = (): void => {
    if (dragY === null) return;
    drawer.style.transition = '';
    if (dragDelta > 110) close();
    else drawer.style.transform = '';
    dragY = null;
    dragDelta = 0;
  };
  dragTarget.addEventListener('touchend', endDrag);
  dragTarget.addEventListener('touchcancel', endDrag);
}

export function initWrench(): void {
  // Business: Tiny ambient signal that the service page is alive and responsive.
  // Technical: Scroll velocity spins #navWrench with friction decay via rAF.
  const wrench = getEl('navWrench');
  if (!wrench || !isDesktop() || prefersReducedMotion()) return;
  let lastY = window.scrollY;
  let rotation = 0;
  let velocity = 0;
  let scheduled = false;
  const tick = (): void => {
    velocity *= 0.8;
    rotation += velocity;
    wrench.style.transform = `rotate(${rotation.toFixed(1)}deg)`;
    if (Math.abs(velocity) > 0.1) {
      window.requestAnimationFrame(tick);
    } else {
      scheduled = false;
    }
  };
  window.addEventListener(
    'scroll',
    () => {
      const currentY = window.scrollY;
      velocity += (currentY - lastY) * 2.2;
      velocity = Math.max(-50, Math.min(50, velocity));
      lastY = currentY;
      if (!scheduled) {
        scheduled = true;
        window.requestAnimationFrame(tick);
      }
    },
    { passive: true },
  );
}

export function initContextPill(): void {
  // Business: One-thumb contextual CTA for mobile testing.
  // Technical: Mobile-only pill; shows past hero, hides in form/contact, morphs per section.
  if (window.innerWidth > 768) return;
  const pill = getEl('ctxPill');
  const label = getEl('ctxLabel');
  if (!pill || !label) return;
  const setLabel = (text: string): void => {
    if (label.textContent !== text) label.textContent = text;
  };
  const onScroll = (): void => {
    const y = window.scrollY;
    // Business: Pill must be visible for testing — show whenever past hero.
    // Technical: Hide only when drawer open or form/contactcta in view.
    const drawerOpen = document.getElementById('mobileDrawer')?.classList.contains('open');
    const requestEl = getEl('request');
    const contactEl = document.querySelector('.final-cta');
    const inRect = (el: HTMLElement | null): boolean => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight * 0.6 && r.bottom > window.innerHeight * 0.4;
    };
    const pastHero = y > window.innerHeight * 0.35;
    const busy = drawerOpen || inRect(requestEl) || inRect(contactEl as HTMLElement | null);
    if (!pastHero || busy) {
      pill.classList.remove('show');
      pill.classList.remove('hide-down');
      return;
    }
    pill.classList.add('show');
    pill.classList.remove('hide-down');
  };
  const sections: Array<{ id: string; text: string }> = [
    { id: 'services', text: 'Choose your appliance →' },
    { id: 'how-it-works', text: '60-sec request →' },
    { id: 'faq', text: 'Still unsure? Get Checked →' },
    { id: 'contact', text: 'Talk to us →' },
  ];
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const found = sections.find((s) => entry.target.id === s.id);
        if (found) setLabel(found.text);
      }
    },
    { rootMargin: '-40% 0px -40% 0px', threshold: 0 },
  );
  sections.forEach((s) => {
    const el = document.getElementById(s.id);
    if (el) observer.observe(el);
  });
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

export function initKeyboardActivation(): void {
  // Business: Keyboard users can activate appliance and time options with Enter/Space.
  // Technical: Typed listeners replace deprecated inline onkeydown handlers.
  document.querySelectorAll<HTMLElement>('#appGrid .app-opt').forEach((opt) => {
    opt.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        opt.click();
      }
    });
  });
  document.querySelectorAll<HTMLElement>('.time-opt').forEach((opt) => {
    opt.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        opt.click();
      }
    });
  });
  document.querySelectorAll<HTMLElement>('.svc-card').forEach((card) => {
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        (card as HTMLElement).click();
      }
    });
  });
  document.querySelectorAll<HTMLElement>('.hiw-item').forEach((item) => {
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        (item as HTMLElement).click();
      }
    });
  });
}
