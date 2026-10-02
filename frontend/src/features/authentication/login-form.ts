// Business: Admin and technician sign-in share one validation + loading behaviour.
// Business: Real credential checking lands here when POST /api/auth/login exists.
// Technical: Wires any present login form by ID; pages keep only an import line.
interface LoginFormConfig {
  formId: string;
  identityId: string;
  passwordId: string;
  errorId: string;
  submitId: string;
  redirectTo: string;
  identityLabel: string;
}

export function validateLogin(
  identity: string,
  password: string,
): string | null {
  // Business: Tell staff exactly what is wrong instead of silently jumping pages.
  // Technical: Pure function so it is unit-testable without a DOM.
  if (!identity.trim()) return 'identity-missing';
  if (password.length < 8) return 'password-short';
  return null;
}

export function loginErrorMessage(code: string, identityLabel: string): string {
  if (code === 'identity-missing') return `Enter your ${identityLabel}.`;
  return 'Password must be at least 8 characters.';
}

export function initLoginForm(config: LoginFormConfig): void {
  // Business: Guard double-submit and show inline errors on staff sign-in.
  // Technical: Frontend-only validation; demo redirect until the auth API exists.
  const form = document.getElementById(config.formId);
  if (!form) return;
  form.addEventListener('submit', (submitEvent: SubmitEvent) => {
    submitEvent.preventDefault();
    const identity = document.getElementById(
      config.identityId,
    ) as HTMLInputElement | null;
    const password = document.getElementById(
      config.passwordId,
    ) as HTMLInputElement | null;
    const error = document.getElementById(config.errorId);
    const submitBtn = document.getElementById(
      config.submitId,
    ) as HTMLButtonElement | null;
    if (error) error.style.display = 'none';
    const code = validateLogin(
      identity?.value ?? '',
      password?.value ?? '',
    );
    if (code) {
      if (error) {
        error.textContent = loginErrorMessage(code, config.identityLabel);
        error.style.display = 'block';
      }
      (code === 'identity-missing' ? identity : password)?.focus();
      return;
    }
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in…';
    }
    // Demo only: no credential check until POST /api/auth/login exists.
    window.setTimeout(() => {
      window.location.href = config.redirectTo;
    }, 350);
  });
}

function initAdminToggle(): void {
  // Business: Let admin verify password entry without retyping on mobile.
  // Technical: Toggle password type and pressed state for assistive tech.
  const toggle = document.getElementById('adminTogglePassword');
  const password = document.getElementById(
    'admin-password',
  ) as HTMLInputElement | null;
  if (!toggle || !password) return;
  toggle.addEventListener('click', () => {
    const showing = password.type === 'password';
    password.type = showing ? 'text' : 'password';
    toggle.setAttribute('aria-label', showing ? 'Hide password' : 'Show password');
  });
}

const EYE_OPEN =
  '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
const EYE_CLOSED =
  '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';

function initTechToggle(): void {
  // Business: Allow technician to toggle password visibility to avoid typos on mobile.
  // Technical: Swap input type and SVG path for eye open/closed states.
  const toggle = document.querySelector('#togglePassword');
  const password = document.querySelector('#password');
  const eyeIcon = document.querySelector('#eyeIcon');
  if (!toggle || !password || !eyeIcon) return;
  toggle.addEventListener('click', () => {
    const type =
      password.getAttribute('type') === 'password' ? 'text' : 'password';
    password.setAttribute('type', type);
    eyeIcon.innerHTML = type === 'text' ? EYE_CLOSED : EYE_OPEN;
  });
}

function boot(): void {
  initLoginForm({
    formId: 'adminLoginForm',
    identityId: 'admin-identity',
    passwordId: 'admin-password',
    errorId: 'adminLoginError',
    submitId: 'adminSubmitBtn',
    redirectTo: '/admin/dashboard',
    identityLabel: 'email or phone number',
  });
  initLoginForm({
    formId: 'techLoginForm',
    identityId: 'identity',
    passwordId: 'password',
    errorId: 'techLoginError',
    submitId: 'techSubmitBtn',
    redirectTo: '/tech/dashboard',
    identityLabel: 'phone number or email',
  });
  initAdminToggle();
  initTechToggle();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
  document.addEventListener('astro:page-load', () => {
    initTechToggle();
  });
}
