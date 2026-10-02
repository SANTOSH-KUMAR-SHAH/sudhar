// Business: Technician records findings on-site; Sudhar Lab reviews before pricing.
// Technical: Validates required findings, reveals inline notice. API wiring lands
// here when POST /api/requests/:id/diagnosis exists. Guards missing DOM for reuse.
export function initDiagnosisForm(): void {
  // Business: Technician must see confirmation without a blocking alert popup.
  // Technical: Validate required field, then reveal inline FormNotice.
  const form = document.getElementById('diagnosisForm');
  if (!form) return;
  form.addEventListener('submit', (submitEvent: SubmitEvent) => {
    submitEvent.preventDefault();
    const findings = document.getElementById(
      'diag-findings',
    ) as HTMLTextAreaElement | null;
    if (!findings || !findings.value.trim()) {
      findings?.focus();
      findings?.classList.add('err');
      return;
    }
    findings.classList.remove('err');
    document
      .getElementById('diagnosisNotice')
      ?.setAttribute('data-visible', 'true');
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDiagnosisForm, {
      once: true,
    });
  } else {
    initDiagnosisForm();
  }
}
