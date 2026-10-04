// Business: Homepage loads one typed interaction module for nav, form, FAQ, storyboard, motion.
// Business: This file is now a thin orchestrator — real logic lives in feature folders.
// Technical: Re-exports stable window.* handlers so existing onclick attributes keep working.

import {
  pickAppliance,
  chooseApp,
  pickTime,
  toStep,
  submitRequest,
  initFormGuards,
} from './service-request/form-state';
import { toggleFaq, switchFaqCat, initFaqMobile } from './faq/faq';
import {
  setHiwStep,
  initHiwScrollSpy,
  initMobileCarousel,
  initHiwConnector,
} from './how-it-works/storyboard';
import {
  initNavScroll,
  initDrawer,
  initWrench,
  initContextPill,
  initKeyboardActivation,
} from './navigation/nav';
import {
  initMotionDefaults,
  initReveals,
  initHeroParallax,
  initServiceStagger,
  initTrustBlocks,
  initTrustIcons,
  initFooterClose,
} from './motion/scroll';

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

function init(): void {
  // Business: Boot every customer interaction after the DOM is ready.
  // Technical: Expose legacy global handlers, then start motion + guards in stable order.
  window.pickAppliance = pickAppliance;
  window.chooseApp = chooseApp;
  window.pickTime = pickTime;
  window.toStep = toStep;
  window.submitRequest = submitRequest;
  window.toggleFaq = toggleFaq;
  window.switchFaqCat = switchFaqCat;
  window.setHiwStep = setHiwStep;

  initMotionDefaults();
  initNavScroll();
  initReveals();
  initHiwConnector();
  initHeroParallax();
  initServiceStagger();
  initTrustBlocks();
  initTrustIcons();
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

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}
