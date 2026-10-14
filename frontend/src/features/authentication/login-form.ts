// Business: Admin and technician sign-in share one validation + loading behaviour.
// Business: Credentials are checked by the real Worker (POST /api/auth/login); a wrong secret or an
// Business: account for the other portal is explained inline — never a silent hop to a blank dashboard.
// Technical: Wires any present login form by ID; pages keep only an import line.
import { ApiError, staff } from '../../lib/api-client';
import { saveSession, type SessionRole } from '../../lib/session';

interface LoginFormConfig {
  formId: string;
  identityId: string;
  passwordId: string;
  errorId: string;
  submitId: string;
  redirectTo: string;
  identityLabel: string;
  // Business: Which portal this form belongs to — an admin login cannot open the technician portal.
  portal: SessionRole;
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

function showFormError(config: LoginFormConfig, message: string): void {
  const error = document.getElementById(config.errorId);
  if (error) {
    error.textContent = message;
    error.style.display = 'block';
  }
}

export function initLoginForm(config: LoginFormConfig): void {
  // Business: Guard double-submit and show inline errors on staff sign-in.
  // Technical: After local checks, POST the real credential and only redirect on a genuine success.
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
    const restore = (): void => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign in →';
      }
    };
    staff
      .login((identity?.value ?? '').trim(), password?.value ?? '')
      .then((result) => {
        // Business: A technician's credentials must not open the admin portal, or vice-versa.
        if (result.role !== config.portal) {
          restore();
          showFormError(
            config,
            result.role === 'customer'
              ? 'This is a staff-only portal. Use the website to track a request.'
              : `That account belongs to the ${result.role} portal. Please sign in there.`,
          );
          return;
        }
        saveSession(result.token, config.portal);
        window.location.href = config.redirectTo;
      })
      .catch((err: unknown) => {
        restore();
        if (err instanceof ApiError && err.status === 401) {
          showFormError(config, 'Wrong email/phone or password.');
          return;
        }
        // Business: Distinguish "server unreachable" so staff know it is not their mistake.
        showFormError(config, 'Cannot reach the server. Please try again.');
      });
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
    portal: 'admin',
  });
  initLoginForm({
    formId: 'techLoginForm',
    identityId: 'identity',
    passwordId: 'password',
    errorId: 'techLoginError',
    submitId: 'techSubmitBtn',
    redirectTo: '/tech/dashboard',
    identityLabel: 'phone number or email',
    portal: 'technician',
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
