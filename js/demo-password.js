/**
 * demo-password.js
 * ─────────────────────────────────────────────
 * Demo 1: Password Strength Analyzer
 *
 * Analyzes passwords on every keystroke using:
 *   - Shannon entropy (character pool × length)
 *   - Length scoring
 *   - Character variety (lower/upper/digit/symbol)
 *   - Common pattern penalty (sequential, repeating)
 *   - Estimated GPU crack time
 *   - Inline checklist tips
 * ─────────────────────────────────────────────
 */

/* ── Helpers: update meter bar width + colour class ── */
function setMeter(id, pct, cls) {
    const el = document.getElementById('mf-' + id);
    el.style.width  = Math.min(pct, 100) + '%';
    el.className    = 'meter-fill' + (cls ? ' ' + cls : '');
}
function setVal(id, v) {
    document.getElementById('m-' + id).textContent = v;
}

/**
 * calcEntropy(pw)
 * Returns Shannon entropy in bits based on character pool size.
 * Pool: lowercase (26) + uppercase (26) + digits (10) + symbols (32)
 */
function calcEntropy(pw) {
    let pool = 0;
    if (/[a-z]/.test(pw))        pool += 26;
    if (/[A-Z]/.test(pw))        pool += 26;
    if (/[0-9]/.test(pw))        pool += 10;
    if (/[^a-zA-Z0-9]/.test(pw)) pool += 32;
    return pool > 0 ? +(pw.length * Math.log2(pool)).toFixed(1) : 0;
}

/**
 * crackTime(entropy)
 * Estimates time to brute-force at 10 billion guesses/second
 * (a modern GPU cluster). Returns { text, cls }.
 */
function crackTime(entropy) {
    const guessesPerSec = 1e10;
    const seconds       = Math.pow(2, entropy) / guessesPerSec;

    if (seconds < 1)             return { text: 'instantly',                        cls: 'weak' };
    if (seconds < 60)            return { text: Math.round(seconds) + ' seconds',   cls: 'weak' };
    if (seconds < 3600)          return { text: Math.round(seconds / 60) + ' minutes',   cls: 'weak' };
    if (seconds < 86400)         return { text: Math.round(seconds / 3600) + ' hours',   cls: 'ok' };
    if (seconds < 31536000)      return { text: Math.round(seconds / 86400) + ' days',   cls: 'ok' };
    if (seconds < 31536000*1000) return { text: Math.round(seconds / 31536000) + ' years', cls: 'strong' };

    const thou = seconds / 31536000 / 1000;
    return {
        text: thou > 1e9 ? 'longer than universe' : Math.round(thou).toLocaleString() + ' thousand years',
        cls: 'strong'
    };
}

/**
 * analyzePw(pw)
 * Main function — called on every input event.
 * Updates all five meter bars and the crack-time display.
 */
function analyzePw(pw) {
    const entropy  = calcEntropy(pw);
    const lenScore = Math.min(pw.length / 20 * 100, 100);

    // Variety: +25% per character class present
    let variety = 0;
    if (/[a-z]/.test(pw))        variety += 25;
    if (/[A-Z]/.test(pw))        variety += 25;
    if (/[0-9]/.test(pw))        variety += 25;
    if (/[^a-zA-Z0-9]/.test(pw)) variety += 25;

    // Penalty: sequential runs, alphabet runs, character repetition
    let penalty = 0;
    if (/012|123|234|345|456|567|678|789|890/.test(pw)) penalty += 40;
    if (/abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i.test(pw)) penalty += 30;
    if (/(.)\\1{2,}/.test(pw)) penalty += 30;
    penalty = Math.min(penalty, 100);

    const overall = Math.max(0, Math.min(100, (entropy / 1.28) - penalty * 0.5));

    // Update meters
    setVal('entropy', entropy);
    setMeter('entropy', entropy / 128 * 100, overall < 40 ? 'danger' : overall < 70 ? 'warn' : '');

    setVal('length', pw.length);
    setMeter('length', lenScore, pw.length < 8 ? 'danger' : pw.length < 12 ? 'warn' : '');

    setVal('variety', variety + '%');
    setMeter('variety', variety, variety < 50 ? 'danger' : variety < 75 ? 'warn' : '');

    setVal('penalty', penalty + '%');
    setMeter('penalty', penalty); // always red by CSS (.danger)

    setVal('overall', Math.round(overall) + '%');
    setMeter('overall', overall, overall < 40 ? 'danger' : overall < 70 ? 'warn' : '');

    // Crack time
    const ct      = crackTime(entropy);
    const crackEl = document.getElementById('crack-val');
    crackEl.textContent = ct.text;
    crackEl.className   = 'crack-value ' + ct.cls;

    // Checklist tips
    const tips = [
        { text: '12+ chars',    done: pw.length >= 12 },
        { text: 'uppercase',    done: /[A-Z]/.test(pw) },
        { text: 'number',       done: /[0-9]/.test(pw) },
        { text: 'symbol',       done: /[^a-zA-Z0-9]/.test(pw) },
        { text: 'no sequences', done: !/012|123|abc/i.test(pw) },
        { text: 'no repeats',   done: !/(.)(.)\2{2}/.test(pw) },
    ];
    document.getElementById('pw-tips').innerHTML = tips.map(t =>
        `<span class="pw-tip${t.done ? ' done' : ''}">${t.done ? '✓ ' : ''}${t.text}</span>`
    ).join('');
}

/** togglePwVis() — toggle password field visibility */
function togglePwVis() {
    const inp = document.getElementById('pw-input');
    const btn = document.getElementById('pw-toggle');
    if (inp.type === 'password') { inp.type = 'text';     btn.textContent = 'HIDE'; }
    else                         { inp.type = 'password'; btn.textContent = 'SHOW'; }
}

// Initialise meters at zero on page load
analyzePw('');
