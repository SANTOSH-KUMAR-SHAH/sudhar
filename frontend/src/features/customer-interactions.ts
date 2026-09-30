import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Set GSAP project defaults — consistent timing across the site
gsap.defaults({ ease: "power3.out", overwrite: "auto" });

// Business: Every customer interaction (nav, form, FAQ, storyboard, scroll motion)
// Business: belongs to one typed module so the homepage behaves identically everywhere.
// Technical: Strict TypeScript + Motion One; all DOM hooks keep existing IDs/classes.

declare global {
  interface Window {
    pickAppliance: (type: string, _el?: HTMLElement | null) => void;
    chooseApp: (el: HTMLElement, type: string) => void;
    pickTime: (el: HTMLElement, time: string) => void;
    toStep: (step: number) => void;
    submitRequest: () => void;
    toggleFaq: (btn: HTMLElement) => void;
    switchFaqCat: (cat: string, btn: HTMLElement) => void;
    setHiwStep: (idx: number, userInteracted?: boolean) => void;
  }
}

interface HiwSlide {
  tag: string;
  title: string;
}

const HIW_DATA: HiwSlide[] = [
  { tag: "Step 01 • Instant Online Form", title: "You submit a request" },
  { tag: "Step 02 • Confirmation Call", title: "We call to confirm" },
  { tag: "Step 03 • Technician Dispatch", title: "Technician arrives at your door" },
  { tag: "Step 04 • On-Site Fault Check", title: "We inspect and diagnose" },
  { tag: "Step 05 • Transparent Pricing", title: "We present the repair quote" },
  { tag: "Step 06 • Repair Approved", title: "You approve — repair begins" },
];

const HIW_TOTAL = 6;

let currentStep = 1;
let chosenAppliance = "";
let currentHiwStep = 0;
let hiwTimer: number | null = null;

function getEl<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isDesktop(): boolean {
  return window.innerWidth > 768;
}

/* ── Service request form state ── */

function pickAppliance(type: string, _el?: HTMLElement | null): void {
  // Business: Tapping a service card jumps the customer to the request form with that appliance preselected.
  // Technical: Smooth-scroll to #request, then mark the matching appliance option selected.
  getEl("request")?.scrollIntoView({ behavior: "smooth" });
  window.setTimeout(() => {
    document.querySelectorAll("#appGrid .app-opt").forEach((option) => {
      const matches = (option.textContent ?? "").trim().includes(type);
      option.classList.toggle("is-sel", matches);
    });
    chosenAppliance = type;
  }, 650);
}

function chooseApp(el: HTMLElement, type: string): void {
  // Business: Customer picks which appliance needs help in step 1 of the form.
  // Technical: Single-select within #appGrid and store the choice for the summary.
  document
    .querySelectorAll("#appGrid .app-opt")
    .forEach((option) => option.classList.remove("is-sel"));
  el.classList.add("is-sel");
  chosenAppliance = type;
}

function pickTime(el: HTMLElement, time: string): void {
  // Business: Customer picks a flexible visit window; exact slot is confirmed by phone.
  // Technical: Single-select within .time-opt group and record the choice on the row for submission.
  document
    .querySelectorAll(".time-opt")
    .forEach((option) => option.classList.remove("is-sel"));
  el.classList.add("is-sel");
  document.querySelector(".time-row")?.setAttribute("data-chosen-time", time);
}

function updateProgress(): void {
  // Business: Show the customer where they are in the 3-step request flow.
  // Technical: Update the progress fill width and the numbered step circles.
  const widths: Record<number, string> = { 1: "0%", 2: "50%", 3: "100%" };
  const fill = getEl("fpFill");
  if (fill) fill.style.width = widths[currentStep] ?? "0%";
  // Business: Screen-reader users must hear the current step.
  // Technical: Keep aria-valuenow in sync with currentStep.
  const progress = document.querySelector('.fp[role="progressbar"]');
  if (progress) progress.setAttribute("aria-valuenow", String(currentStep));

  for (let i = 1; i <= 3; i++) {
    const circle = getEl(`fc${i}`);
    const label = getEl(`fl${i}`);
    if (!circle || !label) continue;
    circle.className = "fp-circle";
    label.className = "fp-label";
    if (i < currentStep) {
      circle.classList.add("is-done");
      circle.textContent = "✓";
    } else if (i === currentStep) {
      circle.classList.add("is-active");
      label.classList.add("is-active");
      circle.textContent = String(i);
    } else {
      circle.textContent = String(i);
    }
  }
}

function validateStepBeforeAdvance(): boolean {
  // Business: Stop the customer advancing with an empty problem or missing contact details.
  // Technical: Highlight invalid fields with .err and focus the first problem field.
  if (currentStep === 1) {
    const problem = getEl<HTMLTextAreaElement>("f-problem");
    if (!problem) return false;
    if (!problem.value.trim()) {
      problem.classList.add("err");
      problem.focus();
      problem.placeholder =
        "Please describe what is happening with your appliance.";
      return false;
    }
    problem.classList.remove("err");
  }
  if (currentStep === 2) {
    const required = ["f-name", "f-phone", "f-area"];
    let hasError = false;
    for (const id of required) {
      const field = getEl<HTMLInputElement>(id);
      if (!field) continue;
      if (!field.value.trim()) {
        field.classList.add("err");
        hasError = true;
      } else {
        field.classList.remove("err");
      }
    }
    if (hasError) {
      getEl<HTMLInputElement>(required[0])?.focus();
      return false;
    }
  }
  return true;
}

function populateSummary(): void {
  // Business: Let the customer review appliance + contact details before sending.
  // Technical: Copy form values into the step-3 summary rows.
  const brand = getEl<HTMLInputElement>("f-brand")?.value ?? "";
  const name = getEl<HTMLInputElement>("f-name")?.value ?? "";
  const phone = getEl<HTMLInputElement>("f-phone")?.value ?? "";
  const area = getEl<HTMLInputElement>("f-area")?.value ?? "";
  const set = (id: string, value: string): void => {
    const node = getEl(id);
    if (node) node.textContent = value;
  };
  set("sum-app", chosenAppliance || brand || "—");
  set("sum-name", name || "—");
  set("sum-phone", phone || "—");
  set("sum-area", area || "—");
}

function toStep(step: number): void {
  // Business: Move the customer forward/back through Appliance → Contact → Visit.
  // Technical: Validate on advance, swap .is-active panels, refresh progress.
  if (step > currentStep && !validateStepBeforeAdvance()) return;
  if (step === 3) populateSummary();

  getEl(`fs${currentStep}`)?.classList.remove("is-active");
  currentStep = step;
  getEl(`fs${currentStep}`)?.classList.add("is-active");
  updateProgress();
  document
    .querySelector(".form-card")
    ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function submitRequest(): void {
  // Business: Confirm receipt with a request number the customer can quote on the phone.
  // Technical: Generate a random SL- reference, hide the form, reveal the success panel.
  const ref = `SL-${100000 + Math.floor(Math.random() * 899999)}`;
  const refNode = getEl("successRef");
  if (refNode) refNode.textContent = ref;
  const form = getEl("srForm");
  if (form) form.style.display = "none";
  document.querySelectorAll(".fp").forEach((node) => {
    (node as HTMLElement).style.display = "none";
  });
  const success = getEl("formSuccess");
  if (success) {
    success.style.display = "block";
    success.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

/* ── FAQ ── */

function toggleFaq(btn: HTMLElement): void {
  // Business: Let customers expand one answer at a time without leaving the page.
  // Technical: Accordion — collapse all items, then expand the tapped one.
  const item = btn.closest(".faq-item");
  if (!item) return;
  const answer = item.querySelector<HTMLElement>(".faq-a");
  const isOpen = item.classList.contains("is-open");

  document.querySelectorAll(".faq-item.is-open").forEach((open) => {
    open.classList.remove("is-open");
    const body = open.querySelector<HTMLElement>(".faq-a");
    if (body) body.style.maxHeight = "0";
    open.querySelector(".faq-q")?.setAttribute("aria-expanded", "false");
    // Business: Keep the +/- symbol in sync so customers see open state.
    // Technical: Reset every collapsed toggle back to plus.
    const toggle = open.querySelector(".faq-toggle");
    if (toggle) toggle.textContent = "+";
  });

  if (!isOpen && answer) {
    item.classList.add("is-open");
    answer.style.maxHeight = `${answer.scrollHeight}px`;
    btn.setAttribute("aria-expanded", "true");
    const toggle = item.querySelector(".faq-toggle");
    if (toggle) toggle.textContent = "−";
  }
}

function switchFaqCat(cat: string, btn: HTMLElement): void {
  // Business: Filter FAQs by journey stage so answers stay scannable on mobile.
  // Technical: Toggle .faq-cat active state and show/hide items by data-cat on mobile only.
  document
    .querySelectorAll(".faq-cat")
    .forEach((tab) => tab.classList.remove("is-active"));
  btn.classList.add("is-active");

  // Business: Desktop shows all 3 columns at once; filtering is mobile-only.
  // Technical: On desktop reset display and keep existing open state untouched.
  const isMobile = window.innerWidth <= 768;
  if (!isMobile) {
    document.querySelectorAll<HTMLElement>(".faq-item").forEach((item) => {
      item.style.display = "";
    });
    return;
  }

  let firstVisible: HTMLElement | null = null;

  document.querySelectorAll<HTMLElement>(".faq-item").forEach((item) => {
    const show = item.dataset["cat"] === cat;
    // Business: Tapped category must actually appear on mobile.
    // Technical: Stylesheet hard-hides during/after, so "" is not enough — use block.
    item.style.display = show ? "block" : "none";
    const toggle = item.querySelector(".faq-toggle");
    if (!show) {
      item.classList.remove("is-open");
      const body = item.querySelector<HTMLElement>(".faq-a");
      if (body) body.style.maxHeight = "0";
      item.querySelector(".faq-q")?.setAttribute("aria-expanded", "false");
      if (toggle) toggle.textContent = "+";
    } else {
      if (toggle && !item.classList.contains("is-open")) toggle.textContent = "+";
      if (!firstVisible) firstVisible = item;
    }
  });

  // Open the first item in the newly selected category
  if (firstVisible) {
    const item = firstVisible as HTMLElement;
    const answer = item.querySelector<HTMLElement>(".faq-a");
    const toggle = item.querySelector(".faq-toggle");
    item.classList.add("is-open");
    if (answer) answer.style.maxHeight = `${answer.scrollHeight}px`;
    item.querySelector(".faq-q")?.setAttribute("aria-expanded", "true");
    if (toggle) toggle.textContent = "−";
  }
}

/* ── How-it-works storyboard ── */

function setHiwStep(idx: number, userInteracted = false): void {
  // Business: Show the matching step photo + caption as the customer explores the process.
  // Technical: Cross-fade slide images and mark the active step card.
  if (userInteracted && hiwTimer !== null) {
    window.clearInterval(hiwTimer);
    hiwTimer = null;
  }
  currentHiwStep = idx;

  for (let i = 0; i < HIW_TOTAL; i++) {
    // Business: Photo must follow the step the customer is reading.
    // Technical: Activate only the slide matching idx so cross-fade works.
    getEl(`hiwImg${i}`)?.classList.toggle("is-active", i === idx);
  }

  const pill = getEl("hiwStepPill");
  const tag = getEl("hiwCapTag");
  const title = getEl("hiwCapTitle");
  const slide = HIW_DATA[idx];
  if (pill) pill.textContent = `STEP 0${idx + 1} OF 06`;
  if (tag && slide) tag.textContent = slide.tag;
  if (title && slide) title.textContent = slide.title;

  document.querySelectorAll(".hiw-item").forEach((item, i) => {
    item.classList.toggle("is-active", i === idx);
    item.setAttribute("aria-expanded", String(i === idx));
  });
}

/* ── Motion One: scroll reveals + parallax (replaces hand-rolled observers) ── */

function initNavScroll(): void {
  // Business: Keep navigation readable once the customer scrolls past the hero.
  // Technical: Toggle .stuck on #nav after 55px using a passive scroll listener.
  const nav = getEl("nav");
  if (!nav) return;
  window.addEventListener(
    "scroll",
    () => {
      // Premium websites transition the navbar immediately after leaving the absolute top
      nav.classList.toggle("stuck", window.scrollY > 20);
    },
    { passive: true },
  );
}

function initReveals(): void {
  // Business: Content rises into view as the customer scrolls each section.
  // Technical: GSAP ScrollTrigger.batch() — groups elements entering the viewport
  // within 0.12s and fires one staggered animation, smoother than one-by-one observers.
  const mm = gsap.matchMedia();

  mm.add(
    {
      isDesktop: "(min-width: 768px)",
      reduceMotion: "(prefers-reduced-motion: reduce)",
    },
    (context) => {
      const { reduceMotion } = context.conditions as { reduceMotion: boolean; isDesktop: boolean };

      if (reduceMotion) {
        // Accessibility: instantly show all reveal elements without motion
        document.querySelectorAll<HTMLElement>(".reveal").forEach((el) => {
          el.classList.add("in");
        });
        return;
      }

      // ── Batch: all .reveal elements fast fade-in ──
      // Business: Sections rise softly so the page feels alive on scroll.
      // Technical: Set hidden first (JS-only so no-JS still shows content),
      // then fade to visible. Exclude .svc-card to avoid double animation.
      gsap.set(".reveal:not(.svc-card)", { autoAlpha: 0, y: 12 });
      ScrollTrigger.batch(".reveal:not(.svc-card)", {
        interval: 0.1,
        batchMax: 6,
        onEnter: (batch) => {
          gsap.to(batch, {
            autoAlpha: 1,
            y: 0,
            duration: 0.5,
            stagger: 0.06,
            ease: "power2.out",
            clearProps: "transform,visibility,opacity",
            onComplete: () => {
              batch.forEach((el) => el.classList.add("in"));
            },
          });
        },
        start: "top 90%",
      });
    }
  );
}

function initHiwConnector(): void {
  // Business: Draw the process connector line as the customer reads each step.
  // Technical: GSAP scrubbed ScrollTrigger — the line fills proportional to
  // scroll position, giving a satisfying 'reading progress' feel.
  const steps = getEl("hiwSteps");
  const fill = getEl("hiwFill");
  if (!steps || !fill) return;

  gsap.set(fill, { width: "0%" });

  gsap.to(fill, {
    width: "100%",
    ease: "none",
    scrollTrigger: {
      trigger: steps,
      start: "top 80%",
      end: "bottom 60%",
      scrub: true, // true (0 lag) so it feels instantly responsive, not sluggish
    },
  });
}

function initHeroParallax(): void {
  // ── WHY THE PREVIOUS VERSION BROKE ──
  // Moving the image at -scrollY exposed the bottom edge (dark gap).
  // CORRECT parallax: image moves DOWN relative to its container, appearing
  // to scroll SLOWER than the page — exactly how the human eye reads depth.
  //
  // Math guarantee: scale(1.35) = 35% extra image height.
  // At worst-case heroH=1000px, speed=0.15 → max travel = 150px.
  // Extra buffer = 1000 * 0.175 = 175px each side. ✓ Never exposes edges.
  if (prefersReducedMotion()) return;

  const bgImg = document.querySelector<HTMLElement>(".hero-bg img");
  const section = document.querySelector<HTMLElement>(".hero");
  const inner = document.querySelector<HTMLElement>(".hero-inner");
  if (!bgImg || !section) return;

  // ── ENTRY ANIMATION: cinematic zoom-out on load (used by Stripe, Linear, etc.)
  // The image starts zoomed in and slowly breathes out to resting scale.
  // This signals quality and draws the visitor into the scene before they scroll.
  bgImg.style.transform = `translateY(0px) scale(1.35) translateZ(0)`;
  bgImg.style.transition = `transform 1.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Let one frame pass so the initial scale is painted, then animate out
      bgImg.style.transform = `translateY(0px) scale(1.2) translateZ(0)`;
    });
  });

  // After entry animation completes, switch to JS-driven scroll parallax
  setTimeout(() => {
    bgImg.style.transition = 'none'; // Hand off to RAF loop
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

    // Stop computing once hero is fully off-screen — saves CPU
    if (scrollY > heroH * 1.2) {
      ticking = false;
      return;
    }

    // ── LAYER 1: Background (far layer)
    // Moves DOWN (+Y) relative to container = appears slower than page = depth illusion.
    // The hero section itself scrolls up with the page at 1.0x speed.
    // The image moves down at 0.15x, so net viewport movement = 0.85x (slower). ✓
    const bgY = scrollY * 0.15;
    bgImg.style.transform = `translateY(${bgY.toFixed(2)}px) scale(1.2) translateZ(0)`;

    // ── LAYER 2 & 3: Text (mid layer — closer than background)
    // Slight upward drift of text makes it feel like it floats between layers.
    // Fade starts at 45% hero height, ensuring CTA is visible through initial scroll.
    if (inner) {
      const textY = -(scrollY * 0.06); // subtle upward drift
      const fadeStart = heroH * 0.45;
      const fadeEnd   = heroH * 0.80;
      const t = Math.min(1, Math.max(0, (scrollY - fadeStart) / (fadeEnd - fadeStart)));
      const opacity = 1 - t;
      inner.style.transform = `translateY(${textY.toFixed(2)}px) translateZ(0)`;
      inner.style.opacity = opacity.toFixed(3);
    }

    ticking = false;
  };

  const onScroll = (): void => {
    lastScrollY = window.scrollY;
    if (!ticking) {
      requestAnimationFrame(applyParallax);
      ticking = true;
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  applyParallax(); // run once for current scroll position (refresh mid-scroll)
}

function initServiceStagger(): void {
  // Business: Service cards fade up with teal glow shadow so categories feel alive.
  // Technical: JS-only initial hidden state, then stagger to visible on scroll.
  const mm = gsap.matchMedia();
  mm.add("(prefers-reduced-motion: no-preference)", () => {
    gsap.set(".svc-card", { autoAlpha: 0, y: 18 });
    ScrollTrigger.batch(".svc-card", {
      interval: 0.1,
      batchMax: 4,
      onEnter: (batch) => {
        gsap.to(batch, {
          autoAlpha: 1,
          y: 0,
          duration: 0.55,
          stagger: 0.1,
          ease: "power2.out",
          clearProps: "transform,visibility,opacity",
        });
      },
      start: "top 88%",
      once: true,
    });
  });
  // Accessibility fallback
  gsap.matchMedia().add("(prefers-reduced-motion: reduce)", () => {
    gsap.set(".svc-card", { clearProps: "all" });
  });
}

function initTrustBlocks(): void {
  // Business: Trust promises appear cleanly with minimal delay.
  const section = document.querySelector<HTMLElement>(".trust-sec");
  const blocks = gsap.utils.toArray<HTMLElement>(".trust-block");
  if (!section || blocks.length === 0) return;

  const mm = gsap.matchMedia();
  mm.add("(prefers-reduced-motion: no-preference)", () => {
    gsap.set(blocks, { autoAlpha: 0, y: 14 });
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top 85%", // Trigger earlier
        toggleActions: "play none none none", // Only play once
      },
    });

    tl.to(blocks, {
      autoAlpha: 1,
      y: 0,
      duration: 0.45,
      stagger: 0.08,
      ease: "power2.out",
      clearProps: "transform,visibility,opacity",
    });
  });

  // Accessibility fallback
  mm.add("(prefers-reduced-motion: reduce)", () => {
    gsap.set(blocks, { clearProps: "all" });
    section.classList.add("mot-line-in");
  });
}


function initFooterClose(): void {
  // Business: Closing CTA subtly insets like a completed job file near the footer.
  // Technical: Scroll-linked clip-path driven by viewport progress through the section.
  const finalCta = document.querySelector<HTMLElement>(".final-cta");
  if (!finalCta || !isDesktop() || prefersReducedMotion()) return;
  const onScroll = (): void => {
    const rect = finalCta.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const progress = Math.max(0, Math.min(1, (vh - rect.top) / (rect.height || 1)));
    const bell = Math.sin(progress * Math.PI);
    if (bell < 0.02) {
      finalCta.style.clipPath = "";
      return;
    }
    const inset = (bell * 2.0).toFixed(2);
    const radius = Math.round(bell * 14);
    finalCta.style.clipPath = `inset(0 ${inset}% 0 ${inset}% round ${radius}px)`;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

function initWrench(): void {
  // Business: Tiny ambient signal that the service page is alive and responsive.
  // Technical: Scroll velocity spins #navWrench with friction decay via rAF.
  const wrench = getEl("navWrench");
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
    "scroll",
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

function initHiwScrollSpy(): void {
  // Business: Pinned image follows each step 1→6 as customer scrolls, starting at step 1.
  // Technical: Observe each .hiw-item crossing viewport center; old outer-progress
  // math jumped 1→5 because outer is shorter than viewport (scrollable clamped to 1).
  if (!isDesktop() || prefersReducedMotion()) return;
  const items = Array.from(document.querySelectorAll<HTMLElement>(".hiw-item"));
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
    { root: null, rootMargin: "-42% 0px -42% 0px", threshold: 0 },
  );
  items.forEach((item) => observer.observe(item));
}

/* ── Mobile drawer, date guard, error clearing, mobile carousel ── */

function initDrawer(): void {
  // Business: Mobile customers need a thumb-friendly menu that opens and closes reliably.
  // Technical: Toggle .open on hamburger + drawer; close on link, outside tap, Escape.
  const hamburger = getEl("navHamburger");
  const drawer = getEl("mobileDrawer");
  if (!hamburger || !drawer) return;
  const open = (): void => {
    hamburger.classList.add("open");
    drawer.classList.add("open");
    hamburger.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    drawer.style.transform = "";
    drawer.querySelector<HTMLElement>(".drawer-card")?.focus?.();
  };
  const close = (): void => {
    hamburger.classList.remove("open");
    drawer.classList.remove("open");
    hamburger.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    drawer.style.transform = "";
  };
  const toggleDrawer = () => {
    if (drawer.classList.contains("open")) close();
    else open();
  };
  hamburger.addEventListener("click", toggleDrawer);
  drawer.querySelectorAll(".drawer-link").forEach((link) => {
    link.addEventListener("click", close);
  });
  document.addEventListener("click", (event) => {
    const target = event.target as Node;
    if (
      drawer.classList.contains("open") &&
      !drawer.contains(target) &&
      !hamburger.contains(target) &&
      !hamburger.contains(target)
    ) {
      close();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  // Business: Story sheet dismisses with a downward thumb swipe like social apps.
  // Technical: Track handle touch, drag drawer, close past 110px else snap back.
  const handle = getEl("drawerHandle");
  const dragTarget = handle ?? drawer;
  let dragY: number | null = null;
  let dragDelta = 0;
  dragTarget.addEventListener("touchstart", (event) => {
    if (!drawer.classList.contains("open")) return;
    dragY = event.touches[0]?.clientY ?? null;
    dragDelta = 0;
    drawer.style.transition = "none";
  }, { passive: true });
  dragTarget.addEventListener("touchmove", (event) => {
    if (dragY === null || !drawer.classList.contains("open")) return;
    const y = event.touches[0]?.clientY ?? dragY;
    dragDelta = Math.max(0, y - dragY);
    drawer.style.transform = `translateY(${dragDelta}px)`;
  }, { passive: true });
  const endDrag = (): void => {
    if (dragY === null) return;
    drawer.style.transition = "";
    if (dragDelta > 110) close();
    else drawer.style.transform = "";
    dragY = null;
    dragDelta = 0;
  };
  dragTarget.addEventListener("touchend", endDrag);
  dragTarget.addEventListener("touchcancel", endDrag);
}

function initFormGuards(): void {
  // Business: Prevent past visit dates and clear errors as the customer types.
  // Technical: Set date min to today; remove .err on input.
  const dateInput = getEl<HTMLInputElement>("f-date");
  if (dateInput) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    dateInput.min = `${yyyy}-${mm}-${dd}`;
  }
  document
    .querySelectorAll(".field input, .field textarea")
    .forEach((field) => {
      field.addEventListener("input", () =>
        (field as HTMLElement).classList.remove("err"),
      );
    });
}

function initKeyboardActivation(): void {
  // Business: Keyboard users can activate appliance and time options with Enter/Space.
  // Technical: Replaces deprecated inline onkeydown=event handlers with typed listeners.
  document.querySelectorAll<HTMLElement>("#appGrid .app-opt").forEach((opt) => {
    opt.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const label =
          opt.querySelector(".app-opt-label")?.textContent?.trim() ?? "";
        if (label) chooseApp(opt, label);
      }
    });
  });
  document.querySelectorAll<HTMLElement>(".time-opt").forEach((opt) => {
    opt.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const label = opt.textContent?.trim() ?? "";
        if (label) pickTime(opt, label);
      }
    });
    opt.addEventListener("click", () => {
      const label = opt.textContent?.trim() ?? "";
      if (label) pickTime(opt, label);
    });
  });
  document.querySelectorAll<HTMLElement>(".svc-card").forEach((card) => {
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const title =
          card.querySelector(".svc-title")?.textContent?.trim() ?? "";
        if (title) {
          const mapped =
            title === "Washing Machine" ? "Washing Machine" : title;
          pickAppliance(mapped, card);
        }
      }
    });
  });
  document.querySelectorAll<HTMLElement>(".hiw-item").forEach((item, i) => {
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setHiwStep(i, true);
      }
    });
  });
}

function initMobileCarousel(): void {
  // Business: Mobile customers swipe through process steps as cards.
  // Technical: Track transform carousel with dots, arrows, touch swipe, autoplay.
  const track = getEl("hiwMobTrack");
  if (!track) return;
  const dots = Array.from(document.querySelectorAll(".hiw-mob-dot"));
  const prevBtn = getEl("hiwMobPrev");
  const nextBtn = getEl("hiwMobNext");
  const wrap = getEl("hiwMobTrackWrap");
  const total = HIW_TOTAL;
  let current = 0;
  let autoTimer: number | null = null;
  let touchStartX = 0;
  let touchEndX = 0;

  const goTo = (idx: number): void => {
    current = Math.max(0, Math.min(idx, total - 1));
    track.style.transform = `translateX(-${current * 100}%)`;
    dots.forEach((dot, i) =>
      dot.classList.toggle("is-active", i === current),
    );
    if (prevBtn) (prevBtn as HTMLButtonElement).disabled = current === 0;
    if (nextBtn)
      (nextBtn as HTMLButtonElement).disabled = current === total - 1;
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

  prevBtn?.addEventListener("click", () => {
    stopAuto();
    goTo(current - 1);
  });
  nextBtn?.addEventListener("click", () => {
    stopAuto();
    goTo(current + 1);
  });
  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      stopAuto();
      const idx = Number((dot as HTMLElement).dataset["idx"] ?? "0");
      goTo(idx);
    });
  });
  wrap?.addEventListener(
    "touchstart",
    (event) => {
      touchStartX = event.changedTouches[0]?.screenX ?? 0;
    },
    { passive: true },
  );
  wrap?.addEventListener(
    "touchend",
    (event) => {
      touchEndX = event.changedTouches[0]?.screenX ?? 0;
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

function initFaqMobile(): void {
  // Business: Mobile shows one category at a time with the first answer open, like PC.
  // Technical: On small screens force before-items visible and open the first one.
  if (window.innerWidth > 768) return;
  const items = Array.from(document.querySelectorAll<HTMLElement>(".faq-item"));
  if (items.length === 0) return;
  const beforeItems = items.filter((item) => item.dataset["cat"] === "before");
  const target = beforeItems.length > 0 ? beforeItems : items;
  target.forEach((item, i) => {
    item.style.display = "block";
    const answer = item.querySelector<HTMLElement>(".faq-a");
    const btn = item.querySelector<HTMLElement>(".faq-q");
    const toggle = item.querySelector(".faq-toggle");
    if (i === 0) {
      item.classList.add("is-open");
      if (answer) answer.style.maxHeight = `${answer.scrollHeight}px`;
      btn?.setAttribute("aria-expanded", "true");
      if (toggle) toggle.textContent = "−";
    } else if (item.dataset["cat"] === target[0]?.dataset["cat"]) {
      // Keep other items in same category closed but visible
      item.classList.remove("is-open");
      if (answer) answer.style.maxHeight = "0";
      btn?.setAttribute("aria-expanded", "false");
      if (toggle) toggle.textContent = "+";
    }
  });
  items.forEach((item) => {
    if (item.dataset["cat"] !== target[0]?.dataset["cat"]) {
      item.style.display = "none";
      item.classList.remove("is-open");
      const body = item.querySelector<HTMLElement>(".faq-a");
      if (body) body.style.maxHeight = "0";
    }
  });
  // Business: Rotating to desktop must restore all 3 columns.
  // Technical: Clear inline hiding once viewport grows past mobile.
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) {
      document.querySelectorAll<HTMLElement>(".faq-item").forEach((item) => {
        item.style.display = "";
      });
    }
  });
}

function init(): void {
  // Business: Boot every customer interaction after the DOM is ready.
  // Technical: Expose legacy global handlers, then start motion + guards.
  window.pickAppliance = pickAppliance;
  window.chooseApp = chooseApp;
  window.pickTime = pickTime;
  window.toStep = toStep;
  window.submitRequest = submitRequest;
  window.toggleFaq = toggleFaq;
  window.switchFaqCat = switchFaqCat;
  window.setHiwStep = setHiwStep;

  initNavScroll();
  initReveals();
  initHiwConnector();
  initHeroParallax();
  initServiceStagger();
  initTrustBlocks();
  initFooterClose();
  initWrench();
  initHiwScrollSpy();
  initDrawer();
  initFormGuards();
  initKeyboardActivation();
  initMobileCarousel();
  initFaqMobile();
  initContextPill();
}

function initContextPill(): void {
  // Business: One-thumb contextual CTA for Option 3 testing alongside Option 2 sheet.
  // Technical: Mobile-only pill; shows past hero, hides in form/contact, morphs per section.
  if (window.innerWidth > 768) return;
  const pill = getEl("ctxPill");
  const label = getEl("ctxLabel");
  if (!pill || !label) return;
  const setLabel = (text: string): void => {
    if (label.textContent !== text) label.textContent = text;
  };
  const onScroll = (): void => {
    const y = window.scrollY;
    // Business: Pill must be visible for testing — show whenever past hero.
    // Technical: Hide only when drawer open or form/contactcta in view.
    const drawerOpen = document.getElementById("mobileDrawer")?.classList.contains("open");
    const requestEl = getEl("request");
    const contactEl = document.querySelector(".final-cta");
    const inRect = (el: HTMLElement | null): boolean => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight * 0.6 && r.bottom > window.innerHeight * 0.4;
    };
    const pastHero = y > window.innerHeight * 0.35;
    const busy = drawerOpen || inRect(requestEl) || inRect(contactEl as HTMLElement | null);
    if (!pastHero || busy) {
      pill.classList.remove("show");
      pill.classList.remove("hide-down");
      return;
    }
    pill.classList.add("show");
    pill.classList.remove("hide-down");
  };
  const sections: Array<{ id: string; text: string }> = [
    { id: "services", text: "Choose your appliance →" },
    { id: "how-it-works", text: "60-sec request →" },
    { id: "faq", text: "Still unsure? Get Checked →" },
    { id: "contact", text: "Talk to us →" },
  ];
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const found = sections.find((s) => entry.target.id === s.id);
        if (found) setLabel(found.text);
      }
    },
    { rootMargin: "-40% 0px -40% 0px", threshold: 0 },
  );
  sections.forEach((s) => {
    const el = document.getElementById(s.id);
    if (el) observer.observe(el);
  });
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
}
