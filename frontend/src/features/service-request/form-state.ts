// Business: 3-step request wizard (Appliance → Contact → Visit) with review + receipt.
// Technical: Owns currentStep/chosenAppliance state; talks to backend via api-client
// when configured, otherwise falls back to explicit demo ref. No GSAP here.
import { getEl } from '../shared/dom';
import { api, BackendNotConfigured } from '../../lib/api-client';
import { requestRef, isValidNepalPhone } from '../../lib/format';

let currentStep = 1;
let chosenAppliance = '';

export function getChosenAppliance(): string {
  return chosenAppliance;
}

export function pickAppliance(type: string, _el?: HTMLElement | null): void {
  // Business: Tapping a service card jumps the customer to the request form preselected.
  // Technical: Smooth-scroll to #request, then mark the matching appliance option selected.
  getEl('request')?.scrollIntoView({ behavior: 'smooth' });
  window.setTimeout(() => {
    document.querySelectorAll('#appGrid .app-opt').forEach((option) => {
      const matches = (option.textContent ?? '').trim().includes(type);
      option.classList.toggle('is-sel', matches);
    });
    chosenAppliance = type;
  }, 650);
}

export function chooseApp(el: HTMLElement, type: string): void {
  // Business: Customer picks which appliance needs help in step 1 of the form.
  // Technical: Single-select within #appGrid and store the choice for the summary.
  document.querySelectorAll('#appGrid .app-opt').forEach((o) => o.classList.remove('is-sel'));
  el.classList.add('is-sel');
  chosenAppliance = type;
}

export function pickTime(el: HTMLElement, time: string): void {
  // Business: Customer picks a flexible visit window; exact slot is confirmed by phone.
  // Technical: Single-select within .time-opt group and record the choice on the row.
  document.querySelectorAll('.time-opt').forEach((o) => o.classList.remove('is-sel'));
  el.classList.add('is-sel');
  document.querySelector('.time-row')?.setAttribute('data-chosen-time', time);
}

function updateProgress(): void {
  // Business: Show the customer where they are in the 3-step request flow.
  // Technical: Update the progress fill width and the numbered step circles.
  const widths: Record<number, string> = { 1: '0%', 2: '50%', 3: '100%' };
  const fill = getEl('fpFill');
  if (fill) fill.style.width = widths[currentStep] ?? '0%';
  // Business: Screen-reader users must hear the current step.
  // Technical: Keep aria-valuenow in sync with currentStep.
  const progress = document.querySelector('.fp[role="progressbar"]');
  if (progress) progress.setAttribute('aria-valuenow', String(currentStep));
  for (let i = 1; i <= 3; i++) {
    const circle = getEl(`fc${i}`);
    const label = getEl(`fl${i}`);
    if (!circle || !label) continue;
    circle.className = 'fp-circle';
    label.className = 'fp-label';
    if (i < currentStep) {
      circle.classList.add('is-done');
      circle.textContent = '✓';
    } else if (i === currentStep) {
      circle.classList.add('is-active');
      label.classList.add('is-active');
      circle.textContent = String(i);
    } else {
      circle.textContent = String(i);
    }
  }
}

function showFieldError(id: string, message?: string): void {
  const field = getEl<HTMLInputElement | HTMLTextAreaElement>(id);
  if (!field) return;
  field.classList.add('err');
  if (message && 'placeholder' in field) {
    (field as HTMLTextAreaElement).placeholder = message;
  }
}

export function validateStepBeforeAdvance(): boolean {
  // Business: Stop the customer advancing with an empty problem or missing contact.
  // Technical: Highlight invalid fields with .err and focus the first problem field.
  if (currentStep === 1) {
    const problem = getEl<HTMLTextAreaElement>('f-problem');
    if (!problem) return false;
    if (!problem.value.trim()) {
      problem.classList.add('err');
      problem.focus();
      problem.placeholder = 'Please describe what is happening with your appliance.';
      return false;
    }
    problem.classList.remove('err');
  }
  if (currentStep === 2) {
    const required = ['f-name', 'f-phone', 'f-area'];
    let hasError = false;
    for (const id of required) {
      const field = getEl<HTMLInputElement>(id);
      if (!field) continue;
      const empty = !field.value.trim();
      const badPhone = id === 'f-phone' && !empty && !isValidNepalPhone(field.value);
      if (empty || badPhone) {
        field.classList.add('err');
        hasError = true;
      } else {
        field.classList.remove('err');
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
  const brand = getEl<HTMLInputElement>('f-brand')?.value ?? '';
  const name = getEl<HTMLInputElement>('f-name')?.value ?? '';
  const phone = getEl<HTMLInputElement>('f-phone')?.value ?? '';
  const area = getEl<HTMLInputElement>('f-area')?.value ?? '';
  const set = (id: string, value: string): void => {
    const node = getEl(id);
    if (node) node.textContent = value;
  };
  set('sum-app', chosenAppliance || brand || '—');
  set('sum-name', name || '—');
  set('sum-phone', phone || '—');
  set('sum-area', area || '—');
}

export function toStep(step: number): void {
  // Business: Move the customer forward/back through Appliance → Contact → Visit.
  // Technical: Validate on advance, swap .is-active panels, refresh progress.
  if (step > currentStep && !validateStepBeforeAdvance()) return;
  if (step === 3) populateSummary();
  getEl(`fs${currentStep}`)?.classList.remove('is-active');
  currentStep = step;
  getEl(`fs${currentStep}`)?.classList.add('is-active');
  updateProgress();
  document.querySelector('.form-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showSuccess(ref: string): void {
  const refNode = getEl('successRef');
  if (refNode) refNode.textContent = ref;
  const form = getEl('srForm');
  if (form) form.style.display = 'none';
  document.querySelectorAll('.fp').forEach((n) => {
    (n as HTMLElement).style.display = 'none';
  });
  const success = getEl('formSuccess');
  if (success) {
    success.style.display = 'block';
    success.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  const notice = getEl('requestNotice');
  if (notice) notice.setAttribute('data-visible', 'false');
}

function showError(message: string): void {
  // Business: Never silently fail; tell the customer what happened in plain words.
  // Technical: Inline notice replaces window.alert so layout never jumps.
  const notice = getEl('requestNotice');
  if (notice) {
    notice.textContent = message;
    notice.setAttribute('data-visible', 'true');
  }
}

export function submitRequest(): void {
  // Business: Confirm receipt with a request number the customer can quote on the phone.
  // Technical: Try the real API first; fall back to an explicit demo ref while backend is absent.
  // Business: Photos help admin assign the right technician before the visit.
  // Technical: Only file metadata travels with the demo payload; binary upload
  // waits for private Storage + signed URLs on the backend.
  const files = getEl<HTMLInputElement>('f-files')?.files;
  const payload = {
    appliance: chosenAppliance || getEl<HTMLInputElement>('f-brand')?.value || '',
    brand: getEl<HTMLInputElement>('f-brand')?.value || '',
    model: getEl<HTMLInputElement>('f-model')?.value || '',
    problem: getEl<HTMLTextAreaElement>('f-problem')?.value || '',
    name: getEl<HTMLInputElement>('f-name')?.value || '',
    phone: getEl<HTMLInputElement>('f-phone')?.value || '',
    area: getEl<HTMLInputElement>('f-area')?.value || '',
    visitDate: getEl<HTMLInputElement>('f-date')?.value || '',
    visitWindow: document.querySelector('.time-row')?.getAttribute('data-chosen-time') || '',
    notes: getEl<HTMLTextAreaElement>('f-notes')?.value || '',
    attachments: files
      ? Array.from(files).map((f) => ({ name: f.name, size: f.size, type: f.type }))
      : [],
  };
  api
    .createServiceRequest(payload)
    .then((res) => showSuccess(res.data.id))
    .catch((err: unknown) => {
      if (err instanceof BackendNotConfigured) {
        showSuccess(requestRef());
        return;
      }
      showError('Could not send your request. Please try again or call us.');
    });
}

export function initFormGuards(): void {
  // Business: Prevent past visit dates and clear errors as the customer types.
  // Technical: Set date min to today; remove .err on input.
  const dateInput = getEl<HTMLInputElement>('f-date');
  if (dateInput) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateInput.min = `${yyyy}-${mm}-${dd}`;
  }
  document.querySelectorAll('.field input, .field textarea').forEach((f) => {
    f.addEventListener('input', () => (f as HTMLElement).classList.remove('err'));
  });
  // Business: Confirm the customer's photos were actually picked.
  // Technical: Replace the upload hint with the selected file count.
  const fileInput = getEl<HTMLInputElement>('f-files');
  fileInput?.addEventListener('change', () => {
    const label = getEl('fileLabel');
    const count = fileInput.files?.length ?? 0;
    if (label) {
      label.textContent =
        count === 0 ? 'Add a photo or video (optional)' : `${count} file${count === 1 ? '' : 's'} selected`;
    }
  });
}

// exported for tests / debugging without touching window
export const __formTest = { showFieldError };
