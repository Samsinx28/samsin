/**
 * utils.js
 * ─────────────────────────────────────────────
 * Site-wide utilities loaded first:
 *   - Custom cursor tracking
 *   - Hero typing animation
 *   - Scroll-reveal (IntersectionObserver)
 *   - Mobile nav open / close
 *   - Smooth scroll for anchor links
 *   - Scroll-spy nav highlight
 * ─────────────────────────────────────────────
 */

/* ── CUSTOM CURSOR ── */
const dot  = document.getElementById('cursor-dot');
const ring = document.getElementById('cursor-ring');

document.addEventListener('mousemove', e => {
    dot.style.left  = e.clientX + 'px';
    dot.style.top   = e.clientY + 'px';
    ring.style.left = e.clientX + 'px';
    ring.style.top  = e.clientY + 'px';
});

/* ── HERO TYPING ANIMATION ──
   Cycles through `phrases`, types each one out
   character-by-character, then deletes it.
*/
const phrases = [
    'Web Developer',
    'Python Automation',
    'Machine Learning',
    'Full-Stack Developer',
    'Problem Solver'
];
let pi = 0, ci = 0, del = false;

function type() {
    const cur = phrases[pi];
    const out = document.getElementById('typing-output');
    if (!del) {
        out.textContent = cur.substring(0, ci++);
        if (ci > cur.length) { del = true; setTimeout(type, 2000); return; }
    } else {
        out.textContent = cur.substring(0, ci--);
        if (ci < 0) {
            del = false;
            pi = (pi + 1) % phrases.length;
            setTimeout(type, 400);
            return;
        }
    }
    setTimeout(type, del ? 45 : 90);
}
setTimeout(type, 800);

/* ── SCROLL REVEAL ──
   Any element with class="reveal" fades + slides up
   when it enters the viewport. Delay classes:
   reveal-delay-1 / -2 / -3 stagger children.
*/
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('visible');
    });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

/* ── MOBILE NAV ── */
function toggleMobileNav() {
    const nav = document.getElementById('mobile-nav');
    const btn = document.getElementById('hamburger');
    nav.classList.toggle('open');
    btn.classList.toggle('open');
}

function closeMobileNav() {
    document.getElementById('mobile-nav').classList.remove('open');
    document.getElementById('hamburger').classList.remove('open');
}

/* ── SMOOTH SCROLL ──
   Intercepts all in-page anchor clicks and scrolls
   smoothly instead of jumping.
*/
document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
        e.preventDefault();
        document.querySelector(a.getAttribute('href'))
            ?.scrollIntoView({ behavior: 'smooth' });
    });
});

/* ── SCROLL-SPY NAV HIGHLIGHT ──
   Uses IntersectionObserver on each section to add
   an "active" class to the corresponding nav link.
*/
(function () {
    const sectionIds = ['services', 'demos', 'tech', 'game', 'contact'];
    const navLinks   = document.querySelectorAll('.nav-links a[href^="#"]');

    const spyObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const id = entry.target.id;
            navLinks.forEach(a => {
                a.classList.toggle('active', a.getAttribute('href') === '#' + id);
            });
        });
    }, { threshold: 0.25, rootMargin: '-60px 0px -40% 0px' });

    sectionIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) spyObserver.observe(el);
    });
})();
