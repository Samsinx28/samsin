/**
 * contact.js
 * ─────────────────────────────────────────────
 * Contact form handler.
 *
 * Submits via Formspree (free tier, no backend
 * needed). To activate:
 *   1. Create a free account at formspree.io
 *   2. Create a new form and copy the form ID
 *   3. Replace YOUR_FORM_ID below with your ID
 *      e.g. "xpwzgqkv"
 *
 * On success: hides the form, shows a ✓ message.
 * On error:   shows an inline error notice.
 * ─────────────────────────────────────────────
 */

async function handleFormSubmit(e) {
    e.preventDefault();

    const form   = document.getElementById('contact-form');
    const btn    = document.getElementById('form-submit-btn');
    const errEl  = document.getElementById('form-error');
    const succEl = document.getElementById('form-success');

    // Loading state
    btn.textContent = 'Sending…';
    btn.disabled    = true;
    errEl.style.display = 'none';

    try {
        // ── Replace YOUR_FORM_ID with your Formspree form ID ──
        const response = await fetch('https://formspree.io/f/mrejjndj', {
            method: 'POST',
            body:   new FormData(form),
            headers: { Accept: 'application/json' },
        });

        if (response.ok) {
            // Success: show the thank-you state
            form.style.display   = 'none';
            succEl.style.display = 'block';
        } else {
            throw new Error('Server responded with ' + response.status);
        }
    } catch (err) {
        // Error: show inline notice, re-enable button
        errEl.style.display = 'block';
        btn.textContent     = 'Send Message';
        btn.disabled        = false;
        console.error('Form error:', err);
    }
}

/** resetForm — returns the form to its initial state */
function resetForm() {
    const form   = document.getElementById('contact-form');
    const succEl = document.getElementById('form-success');
    const btn    = document.getElementById('form-submit-btn');

    form.reset();
    form.style.display   = 'block';
    succEl.style.display = 'none';
    btn.textContent      = 'Send Message';
    btn.disabled         = false;
}
