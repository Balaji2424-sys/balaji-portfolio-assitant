/* ============================================================
   BALAJI PARASURAMAN — PORTFOLIO  |  script.js
   ============================================================ */

// ── THEME TOGGLE ──────────────────────────────────────────────
const html        = document.documentElement;
const themeToggle = document.getElementById('themeToggle');

// Load saved preference; default dark
const savedTheme = localStorage.getItem('bp-theme') || 'dark';
html.setAttribute('data-theme', savedTheme);

themeToggle.addEventListener('click', () => {
  const current = html.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('bp-theme', next);
  initParticles(next);
});

function initParticles(theme = document.documentElement.getAttribute("data-theme")) {
  if (!window.particlesJS) return;

  if (window.pJSDom && window.pJSDom.length) {
    window.pJSDom.forEach(instance => instance.pJS.fn.vendors.destroypJS());
    window.pJSDom = [];
  }

  const isDark = theme === "dark";

  // Violet / cyan-teal particle palette matching the new theme
  particlesJS("particles-js", {
    particles: {
      number: {
        value: 70
      },

      color: {
        value: isDark ? "#7C3AED" : "#6D28D9"
      },

      shape: {
        type: "circle"
      },

      opacity: {
        value: isDark ? 0.35 : 0.45
      },

      size: {
        value: 2
      },

      move: {
        enable: true,
        speed: 1
      },

      line_linked: {
        enable: true,
        distance: 120,
        color: isDark ? "#06B6D4" : "#0891A8",
        opacity: isDark ? 0.18 : 0.22,
        width: 1
      }
    }
  });
}

initParticles(savedTheme);

// ── NAVBAR SCROLL STYLE ───────────────────────────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 24);
}, { passive: true });

// ── HAMBURGER MENU ────────────────────────────────────────────
const hamburger = document.getElementById('hamburger');
const navMobile = document.getElementById('navMobile');

hamburger.addEventListener('click', () => {
  const isOpen = hamburger.classList.toggle('open');
  navMobile.classList.toggle('open', isOpen);
  hamburger.setAttribute('aria-expanded', String(isOpen));
});

navMobile.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('open');
    navMobile.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  });
});

// ── REVEAL ON SCROLL ──────────────────────────────────────────
// rootMargin is intentionally "0px" on all sides so elements
// already in the viewport are immediately marked visible.
const revealEls = document.querySelectorAll('.reveal');

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.08, rootMargin: '0px 0px 0px 0px' }
);

// Stagger cards/skill-groups/timeline-items inside a shared parent with a short delay
revealEls.forEach((el, idx) => {
  // find sibling .reveal elements in same parent
  const siblings = Array.from(el.parentElement.querySelectorAll('.reveal'));
  const sibIdx   = siblings.indexOf(el);
  el.style.transitionDelay = (sibIdx * 0.07) + 's';
  revealObserver.observe(el);
});

// ── SKILL BAR ANIMATION ───────────────────────────────────────
const skillFills = document.querySelectorAll('.skill-fill');

const skillObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el  = entry.target;
        const pct = el.getAttribute('data-pct');
        setTimeout(() => { el.style.width = pct + '%'; }, 150);
        skillObserver.unobserve(el);
      }
    });
  },
  { threshold: 0.1 }
);

skillFills.forEach(el => skillObserver.observe(el));

// ── ACTIVE NAV LINK ON SCROLL ─────────────────────────────────
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a, .nav-mobile a');

const setActiveNavLink = (id) => {
  navLinks.forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === '#' + id);
  });
};

const activeObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        setActiveNavLink(entry.target.id);
      }
    });
  },
  { rootMargin: '-40% 0px -55% 0px' }
);

sections.forEach(s => activeObserver.observe(s));

setActiveNavLink(location.hash ? location.hash.slice(1) : 'hero');
