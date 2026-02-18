/* ══════════════════════════════════════════════════
   Muskaan & Sunny — Wedding Website Scripts
   ══════════════════════════════════════════════════ */

// ── Countdown Timer ──────────────────────────────
(function initCountdown() {
  // Wedding date: 14 March 2026, 9:00 AM IST (UTC+5:30)
  const weddingDate = new Date('2026-03-14T09:00:00+05:30');

  const elDays  = document.getElementById('cd-days');
  const elHours = document.getElementById('cd-hours');
  const elMins  = document.getElementById('cd-mins');
  const elSecs  = document.getElementById('cd-secs');

  function pad(n) { return String(n).padStart(2, '0'); }

  function tick() {
    const now  = new Date();
    const diff = weddingDate - now;

    if (diff <= 0) {
      elDays.textContent  = '00';
      elHours.textContent = '00';
      elMins.textContent  = '00';
      elSecs.textContent  = '00';
      return;
    }

    const days  = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins  = Math.floor((diff / (1000 * 60)) % 60);
    const secs  = Math.floor((diff / 1000) % 60);

    elDays.textContent  = pad(days);
    elHours.textContent = pad(hours);
    elMins.textContent  = pad(mins);
    elSecs.textContent  = pad(secs);
  }

  tick();
  setInterval(tick, 1000);
})();


// ── Scroll-based Fade In ─────────────────────────
(function initFadeIn() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          // Stagger children inside a grid
          setTimeout(() => {
            entry.target.classList.add('visible');
          }, entry.target.dataset.delay || 0);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  document.querySelectorAll('.fade-in').forEach((el, i) => {
    el.dataset.delay = (i % 3) * 120; // stagger per row
    observer.observe(el);
  });
})();


// ── Navbar Scroll Effect ─────────────────────────
(function initNavbar() {
  const nav = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 60) {
      nav.style.background = 'rgba(92,15,15,.97)';
    } else {
      nav.style.background = 'rgba(139,26,26,.92)';
    }
  }, { passive: true });
})();


// ── Smooth Scroll for Nav Links ──────────────────
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = document.getElementById('navbar').offsetHeight + 8;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});


// ── RSVP Form ───────────────────────────────────
(function initRSVP() {
  const form    = document.getElementById('rsvp-form');
  const success = document.getElementById('rsvp-success');

  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Basic validation
    const name  = form.querySelector('#name').value.trim();
    const email = form.querySelector('#email').value.trim();

    if (!name) {
      showError(form.querySelector('#name'), 'Please enter your name.');
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError(form.querySelector('#email'), 'Please enter a valid email.');
      return;
    }

    // Gather data
    const data = {
      name,
      email,
      guests:    form.querySelector('#guests').value,
      attending: form.querySelector('#attending').value,
      events:    Array.from(form.querySelectorAll('input[name="events"]:checked'))
                      .map(cb => cb.value),
      dietary:   form.querySelector('#dietary').value.trim(),
      message:   form.querySelector('#message').value.trim(),
    };

    // In a real deployment, POST `data` to a backend / Formspree / Netlify Forms.
    console.info('RSVP submitted:', data);

    // Show success
    form.classList.add('hidden');
    success.classList.remove('hidden');
    success.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  function showError(input, msg) {
    input.style.borderColor = '#C0392B';
    input.focus();
    // Remove red border after user starts typing
    input.addEventListener('input', () => {
      input.style.borderColor = '';
    }, { once: true });
  }
})();
