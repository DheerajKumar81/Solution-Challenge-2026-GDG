/* ══════════════════════════════════════════
   FOOD LOOP — Shared Interactivity
   ══════════════════════════════════════════ */

// ─── Utility: escape HTML ─────────────────
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Toast notifications ──────────────────
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => { toast.classList.remove('show'); }, 3500);
}

document.addEventListener('DOMContentLoaded', () => {

  /* ─── Mobile menu toggle ─────────────── */
  const toggle = document.getElementById('mobileToggle');
  const links = document.getElementById('navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
    links.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => links.classList.remove('open'))
    );
  }

  /* ─── Smooth scroll for same-page anchors */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const href = anchor.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
    });
  });

  /* ─── Scroll fade-in ─────────────────── */
  const fadeEls = document.querySelectorAll(
    '.step-card, .stat-card, .section-title, .section-tag, .food-card'
  );
  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        fadeObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  fadeEls.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(28px)';
    el.style.transition = 'opacity .6s ease, transform .6s ease';
    fadeObserver.observe(el);
  });

  /* ════════════════════════════════════════
     HOMEPAGE-ONLY LOGIC
     ════════════════════════════════════════ */
  const isHome = !!document.getElementById('hero');
  if (!isHome) return;

  // ─── Animate live stats from localStorage DB
  initDB();
  const stats = getStats();

  function animateValue(id, target, suffix = '') {
    const el = document.getElementById(id);
    if (!el) return;
    const duration = 2000;
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target).toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  animateValue('statDeliveries', stats.totalDeliveries);
  animateValue('statFoodSaved', stats.foodSaved, ' kg');
  animateValue('statPollution', stats.pollutionReduced, ' kg');
  animateValue('statPeople', stats.peopleHelped);

  // ─── Leaflet Map ──────────────────────
  if (document.getElementById('foodMap') && typeof L !== 'undefined') {
    const map = L.map('foodMap', {
      center: [28.6139, 77.2090],
      zoom: 12, zoomControl: true, scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    const greenIcon = L.divIcon({
      className: 'custom-marker',
      html: '<div style="width:18px;height:18px;border-radius:50%;background:#34d399;box-shadow:0 0 12px #34d399;border:2px solid rgba(255,255,255,.6);"></div>',
      iconSize: [18, 18], iconAnchor: [9, 9],
    });
    const blueIcon = L.divIcon({
      className: 'custom-marker',
      html: '<div style="width:18px;height:18px;border-radius:50%;background:#3b82f6;box-shadow:0 0 12px #3b82f6;border:2px solid rgba(255,255,255,.6);"></div>',
      iconSize: [18, 18], iconAnchor: [9, 9],
    });

    // Static NGO markers
    const ngos = [
      { lat: 28.6200, lng: 77.2020, name: 'Hope Orphanage', need: 'Meals for 60 children' },
      { lat: 28.6050, lng: 77.2400, name: 'Sunrise Old Age Home', need: 'Dinner for 35 residents' },
      { lat: 28.6380, lng: 77.2100, name: 'Feeding India NGO Hub', need: 'Bulk cooked meals' },
    ];
    ngos.forEach(n => {
      L.marker([n.lat, n.lng], { icon: blueIcon }).addTo(map)
        .bindPopup(`<div style="font-family:Inter,sans-serif;font-size:13px;"><strong style="color:#3b82f6;">🔵 ${n.name}</strong><br/><span style="color:#ccc;">${n.need}</span></div>`);
    });

    // Dynamic available donor markers
    const foods = getFoodsByStatus('Available');
    const offsets = [
      { lat: 28.6329, lng: 77.2195 }, { lat: 28.5921, lng: 77.2307 },
      { lat: 28.6448, lng: 77.1880 }, { lat: 28.6100, lng: 77.2300 },
      { lat: 28.6260, lng: 77.2150 }, { lat: 28.6170, lng: 77.2050 },
    ];
    foods.forEach((f, i) => {
      const pos = offsets[i % offsets.length];
      L.marker([pos.lat, pos.lng], { icon: greenIcon }).addTo(map)
        .bindPopup(`<div style="font-family:Inter,sans-serif;font-size:13px;"><strong style="color:#34d399;">🟢 ${escapeHtml(f.foodType)}</strong><br/><span style="color:#ccc;">${escapeHtml(f.quantity)} · ${escapeHtml(f.location)}</span></div>`);
    });
  }

  // ─── Available food preview ───────────
  const grid = document.getElementById('availableFoodGrid');
  if (grid) {
    const available = getFoodsByStatus('Available');
    if (available.length === 0) {
      grid.innerHTML = '<p style="color:var(--text-dim);text-align:center;grid-column:1/-1;">No food available right now. <a href="donate.html" style="color:var(--accent);">Donate first!</a></p>';
    } else {
      grid.innerHTML = available.slice(0, 3).map(f => `
        <div class="food-card">
          <div class="food-card-header">
            <span class="food-type-icon">🍱</span>
            <span class="badge badge-available">Available</span>
          </div>
          <h3 class="food-card-title">${escapeHtml(f.foodType)}</h3>
          <div class="food-card-details">
            <div class="food-detail"><span class="detail-icon">📦</span> ${escapeHtml(f.quantity)}</div>
            <div class="food-detail"><span class="detail-icon">📍</span> ${escapeHtml(f.location)}</div>
            <div class="food-detail"><span class="detail-icon">🕐</span> ${escapeHtml(f.time)}</div>
          </div>
        </div>
      `).join('');
    }
  }
});
