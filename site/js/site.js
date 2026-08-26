// The HomeGuild — shared behaviour: nav, scroll reveal, forms, register filter.
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- Mobile nav
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  // --- Scroll reveal
  var els = document.querySelectorAll('.reveal');
  if (reduce || !('IntersectionObserver' in window)) {
    els.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    els.forEach(function (el) { io.observe(el); });
  }

  // --- Application form (front-end only; wire to a backend or form service)
  var form = document.getElementById('applyForm');
  if (form) {
    var radios = form.querySelectorAll('input[name="track"]');
    function syncTrack() {
      var v = form.querySelector('input[name="track"]:checked');
      form.classList.toggle('business', !!v && v.value === 'business');
    }
    radios.forEach(function (r) { r.addEventListener('change', syncTrack); });
    syncTrack();
    if (location.hash === '#business') {
      var b = form.querySelector('input[value="business"]');
      if (b) { b.checked = true; syncTrack(); }
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      form.hidden = true;
      var ok = document.getElementById('formSuccess');
      ok.classList.add('show');
      ok.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    });
  }

  // --- Register filter (register.html)
  var list = document.getElementById('registerList');
  if (list && window.HG_FIRMS) {
    var q = document.getElementById('q');
    var trade = document.getElementById('trade');
    var town = document.getElementById('town');
    var out = document.getElementById('countOut');
    var firms = window.HG_FIRMS;

    function render() {
      var qs = (q.value || '').trim().toLowerCase();
      var t = trade.value, tw = town.value;
      var rows = firms.filter(function (f) {
        if (t && f.trade !== t) return false;
        if (tw && f.towns.indexOf(tw) === -1) return false;
        if (qs && (f.name + ' ' + f.trade + ' ' + f.towns.join(' ')).toLowerCase().indexOf(qs) === -1) return false;
        return true;
      });
      list.innerHTML = rows.map(function (f) {
        var status = f.status === 'review'
          ? '<span class="pill review">Under review</span>'
          : '<span class="pill">Vetted</span>';
        var since = 'Admitted ' + f.admitted + (f.repassed ? ' · Re-passed ' + f.repassed : '');
        return '<a class="member" href="firm.html?no=' + f.no + '">' +
          '<span class="id">No. ' + f.no + '</span>' +
          '<span class="name">' + f.name + '</span>' +
          '<span class="trade-name">' + f.trade + ' · ' + f.towns.join(', ') + '</span>' +
          '<span class="since">' + since + '</span>' + status + '</a>';
      }).join('');
      out.textContent = rows.length + ' of ' + firms.length + ' firms';
    }
    [q, trade, town].forEach(function (el) { el.addEventListener('input', render); });
    render();
  }
})();
