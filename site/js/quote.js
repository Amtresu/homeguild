// The HomeGuild — quote flow: address → parcel → priced services → checkout.
import { measureAddress } from './measure.js?v=2';
import { SERVICES, GROUPS, MEMBERSHIP, deriveMeasurements, priceSelection, money } from './catalog.js?v=2';

const $ = id => document.getElementById(id);
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const KEY = 'hg.quote';

const state = { address: '', geo: null, parcel: null, lawnSqft: null, tier: null, selected: [] };
let map, parcelLayer;

// ---------- Step 1: address ----------
const form = $('addressForm');
form.addEventListener('submit', async e => {
  e.preventDefault();
  const address = $('address').value.trim();
  if (!address) return;
  setNote('Finding the parcel…', false);
  form.classList.add('busy');
  try {
    const { geo, parcel } = await measureAddress(address);
    Object.assign(state, { address, geo, parcel, lawnSqft: null, tier: null, selected: [] });
    for (const id of Object.values(TIER_PANELS)) $(id).hidden = true;
    $('step-tier').hidden = true;
    save();
    showLot();
    setNote('Street and city is enough. Owner-occupied single-family homes only.', false);
    reveal($('step-lot'));
  } catch (err) {
    setNote(err.message || 'Something went wrong. Try again.', true);
  } finally {
    form.classList.remove('busy');
  }
});

function setNote(text, isErr) {
  const n = $('addressNote');
  n.textContent = text;
  n.classList.toggle('err', isErr);
}

$('changeAddress').addEventListener('click', () => {
  $('step-lot').hidden = true; $('step-tier').hidden = true;
  for (const id of Object.values(TIER_PANELS)) $(id).hidden = true;
  $('address').focus(); $('address').select();
  $('step-address').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
});

// ---------- Step 2: the lot ----------
function measurements() {
  return deriveMeasurements(state.parcel, { lawnSqft: state.lawnSqft });
}

function showLot() {
  const { geo, parcel } = state;
  const m = measurements();
  $('step-lot').hidden = false; // Leaflet needs a laid-out container before it can fit bounds
  $('lotAddress').textContent = parcel.siteAddress || geo.address;
  $('lotMeta').textContent = [parcel.county + ' County', 'Parcel ' + parcel.parcelId, parcel.zoning && 'Zoned ' + parcel.zoning,
    parcel.match === 'nearest' && 'Matched by location — check the outline'].filter(Boolean).join(' · ');
  $('mapSource').textContent = 'Parcel: ' + parcel.source;
  const slider = $('lawnSlider');
  slider.max = m.lotSqft; slider.value = m.lawnSqft;
  renderStats(m);
  renderMap(parcel);
  renderServices(m);
  $('priceFor').textContent = (parcel.siteAddress || geo.address).split(',')[0];
}

function renderStats(m) {
  $('statLot').innerHTML = fmt(m.lotSqft) + '<small>sq ft · ' + (m.lotSqft / 43560).toFixed(2) + ' ac</small>';
  $('statLawn').innerHTML = fmt(m.lawnSqft) + '<small>sq ft</small>';
  $('statPerimeter').innerHTML = fmt(m.perimeterFt) + '<small>ft</small>';
  $('statZones').textContent = m.zones;
  $('lawnPct').textContent = m.lotSqft ? Math.round(100 * m.lawnSqft / m.lotSqft) + '%' : '—';
}

$('lawnSlider').addEventListener('input', e => {
  state.lawnSqft = +e.target.value;
  const m = measurements();
  renderStats(m); renderServices(m); save();
});
$('lawnReset').addEventListener('click', () => {
  state.lawnSqft = null;
  const m = measurements();
  $('lawnSlider').value = m.lawnSqft;
  renderStats(m); renderServices(m); save();
});

function renderMap(parcel) {
  if (!window.L) return;
  if (!map) {
    map = L.map('map', { zoomControl: true, attributionControl: true, scrollWheelZoom: false, maxZoom: 19 });
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    }).addTo(map);
  }
  if (parcelLayer) parcelLayer.remove();
  parcelLayer = L.polygon(parcel.polygon, { color: '#D9A441', weight: 2, fillColor: '#9BA88D', fillOpacity: .18 }).addTo(map);
  const bounds = parcelLayer.getBounds().pad(0.6);
  map.fitBounds(bounds);
  setTimeout(() => { map.invalidateSize(); map.fitBounds(bounds); }, 60);
}

$('toTier').addEventListener('click', e => {
  e.preventDefault();
  reveal($('step-tier'));
});

// ---------- Step 3: tier ----------
const TIER_PANELS = { free: 'step-free', monthly: 'step-services', managed: 'step-managed' };
document.querySelectorAll('[data-tier]').forEach(btn => btn.addEventListener('click', () => chooseTier(btn.dataset.tier)));
function chooseTier(tier) {
  state.tier = tier; save();
  for (const [t, id] of Object.entries(TIER_PANELS)) $(id).hidden = t !== tier;
  reveal($(TIER_PANELS[tier]));
}

// ---------- Step 4 (free / managed): lead forms ----------
const TRADES = ['Landscape & irrigation', 'Pest control', 'Roofing', 'Plumbing', 'Electrical', 'HVAC', 'Painting', 'Windows & doors', 'Concrete & hardscape', 'Remodel & carpentry', 'Cleaning', 'Smart home & security'];
const SCOPE = ['Lawn & beds', 'Irrigation', 'Pest', 'Gutters & exterior', 'Snow', 'Trees', 'Pool or spa', 'Interior upkeep', 'Everything'];
const chips = (list, name) => list.map(t => `<label class="chip"><input type="checkbox" name="${name}" value="${t}"><span>${t}</span></label>`).join('');
$('freeTrades').innerHTML = chips(TRADES, 'trades');
$('managedScope').innerHTML = chips(SCOPE, 'scope');

for (const form of [$('freeForm'), $('managedForm')]) {
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const err = form.querySelector('[data-err]');
    err.hidden = true;
    const picked = [...form.querySelectorAll('input[type=checkbox][name]:not([name=consent]):checked')].map(i => i.value);
    if (!picked.length && form.id === 'managedForm') { err.textContent = 'Pick at least one.'; err.hidden = false; return; }
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const fd = Object.fromEntries(new FormData(form));
    const body = { ...fd, picked, address: state.address, parcel: state.parcel && { id: state.parcel.parcelId, county: state.parcel.county, lotSqft: state.parcel.lotSqft, siteAddress: state.parcel.siteAddress }, measurements: measurements() };
    form.classList.add('busy');
    try {
      const r = await fetch('/.netlify/functions/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const isJSON = /json/.test(r.headers.get('content-type') || '');
      if (!isJSON) throw new Error('This preview is static — on the deployed site this goes to the dispatch inbox.');
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Something went wrong. Try again.');
      form.hidden = true;
      const ok = form.parentElement.querySelector('[data-ok]');
      ok.classList.add('show');
      ok.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    } catch (e2) {
      err.textContent = e2.message; err.hidden = false;
    } finally {
      form.classList.remove('busy');
    }
  });
}

// ---------- Step 3: services ----------
function renderServices(m) {
  const host = $('serviceGroups');
  if (!host.childElementCount) {
    host.innerHTML = GROUPS.map(g => `
      <div class="service-group">
        <span class="label">${g}</span>
        <div class="service-list">
          ${SERVICES.filter(s => s.group === g).map(s => `
            <button class="service" type="button" data-id="${s.id}" aria-pressed="false">
              <span class="box"><svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3.2L13 5"/></svg></span>
              <span class="body"><h3>${s.name}</h3><p>${s.blurb}</p><span class="basis" data-basis></span></span>
              <span class="price"><b data-price></b><small>${s.cadence.label}</small></span>
            </button>`).join('')}
        </div>
      </div>`).join('');
    host.addEventListener('click', e => {
      const btn = e.target.closest('.service');
      if (!btn) return;
      toggle(btn.dataset.id);
    });
  }
  for (const s of SERVICES) {
    const el = host.querySelector(`[data-id="${s.id}"]`);
    el.querySelector('[data-price]').textContent = money(s.price(m));
    el.querySelector('[data-basis]').textContent = s.basis(m);
    el.setAttribute('aria-pressed', String(state.selected.includes(s.id)));
  }
  renderCart(m);
}

function toggle(id) {
  const i = state.selected.indexOf(id);
  if (i === -1) state.selected.push(id); else state.selected.splice(i, 1);
  save();
  renderServices(measurements());
}

function renderCart(m) {
  const q = priceSelection(m, state.selected);
  // The membership is always in a Monthly cart; services ride on top of it.
  const lines = [MEMBERSHIP, ...q.lines];
  $('cart').classList.add('has-items');
  $('cartEmpty').hidden = q.lines.length > 0;
  $('cartLines').innerHTML = lines.map(l => `<li><span>${l.name}<small>${l.cadence}</small></span><b>${money(l.unitCents)}</b></li>`).join('');
  $('cartFirst').textContent = money(MEMBERSHIP.unitCents + q.firstVisitCents);
  $('cartAnnual').textContent = money(MEMBERSHIP.annualCents + q.annualCents);
  $('checkoutBtn').disabled = false;
}

// ---------- Checkout ----------
$('checkoutBtn').addEventListener('click', async () => {
  const btn = $('checkoutBtn'), err = $('checkoutErr');
  btn.disabled = true; err.hidden = true;
  try {
    const r = await fetch('/.netlify/functions/checkout', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address: state.address, lawnSqft: state.lawnSqft, services: state.selected }),
    });
    if (!/json/.test(r.headers.get('content-type') || '')) throw new Error('Checkout runs on the deployed site; this preview is static. The quote above is exactly what Stripe would charge.');
    const d = await r.json();
    if (!r.ok || !d.url) throw new Error(d.error || 'Checkout is unavailable right now.');
    location.href = d.url;
  } catch (e) {
    err.textContent = e.message; err.hidden = false; btn.disabled = false;
  }
});

// ---------- persistence ----------
function save() { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch {} }
function restore() {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY));
    if (!s?.parcel) return;
    Object.assign(state, s);
    $('address').value = state.address;
    showLot();
    if (state.tier) { $('step-tier').hidden = false; $(TIER_PANELS[state.tier]).hidden = false; }
  } catch {}
}
function reveal(el) {
  el.hidden = false;
  requestAnimationFrame(() => el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }));
}
const fmt = n => n.toLocaleString('en-US');

// Arriving from the home-page hero form: ?address=… runs the measurement straight away.
const incoming = new URLSearchParams(location.search).get('address');
if (incoming && incoming.trim()) {
  history.replaceState(null, '', location.pathname);
  $('address').value = incoming.trim();
  form.requestSubmit();
} else {
  restore();
}
