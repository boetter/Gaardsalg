/* Gårdsalg – find friske afgrøder nær sommerhuset.
 * Vanilla JS, ingen build. Data ligger i /data/*.json.
 * Se data/README.md for hvordan man tilføjer nye steder. */

(() => {
  "use strict";

  const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const state = {
    config: null,
    places: [],
    catById: {},
    activeCats: new Set(),
    query: "",
    openNow: false,
    origin: null,        // { lat, lng, label } – sommerhus eller brugerens position
    usingMyLocation: false,
    activeId: null,
  };

  // Leaflet
  let map = null;
  const markers = {};       // id -> marker
  let homeMarker = null;
  let userMarker = null;

  /* ---------- Hjælpefunktioner ---------- */

  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function haversineKm(a, b) {
    const R = 6371, toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }
  function fmtDist(km) {
    if (km == null) return "";
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`.replace(".", ",");
  }
  function fmtPhone(p) {
    const d = String(p).replace(/\D/g, "");
    return d.length === 8 ? `${d.slice(0,2)} ${d.slice(2,4)} ${d.slice(4,6)} ${d.slice(6)}` : p;
  }

  /* Beregn åbningsstatus → { state, label, kind } */
  function openStatus(place) {
    const h = place.hours || {};
    if (h.alwaysOpen) {
      return place.selfService
        ? { kind: "self", label: "Selvbetjening · døgnåben" }
        : { kind: "open", label: "Døgnåben" };
    }
    if (h.weekly) {
      const now = new Date();
      const today = h.weekly[DAYS[now.getDay()]];
      if (today && today.length === 2) {
        const [oH, oM] = today[0].split(":").map(Number);
        const [cH, cM] = today[1].split(":").map(Number);
        const mins = now.getHours() * 60 + now.getMinutes();
        const open = oH * 60 + oM, close = cH * 60 + cM;
        if (mins >= open && mins < close) {
          return { kind: "open", label: `Åben nu · til ${today[1]}` };
        }
        return { kind: "closed", label: `Lukket · åbner ${today[0]}` };
      }
    }
    if (h.season) return { kind: "season", label: h.season };
    if (place.phone || place.phone2) return { kind: "call", label: "Ring i forvejen" };
    return { kind: "unknown", label: "Tjek ved vejen" };
  }
  const isOpenLike = (st) => st.kind === "open" || st.kind === "self";

  /* ---------- Data ---------- */

  async function loadData() {
    const [config, places] = await Promise.all([
      fetch("data/config.json").then((r) => r.json()),
      fetch("data/places.json").then((r) => r.json()),
    ]);
    state.config = config;
    state.places = places;
    config.categories.forEach((c) => (state.catById[c.id] = c));
    state.origin = { ...config.home };
    recomputeDistances();
  }

  function recomputeDistances() {
    const o = state.origin;
    state.places.forEach((p) => {
      p._dist = (o && p.lat != null) ? haversineKm(o, p) : null;
    });
  }

  /* ---------- Filtrering & sortering ---------- */

  function visiblePlaces() {
    const q = state.query.trim().toLowerCase();
    return state.places
      .filter((p) => {
        if (state.activeCats.size &&
            !p.categories.some((c) => state.activeCats.has(c))) return false;
        if (state.openNow && !isOpenLike(openStatus(p))) return false;
        if (q) {
          const hay = [p.name, p.tagline, p.description, p.address,
            ...(p.products || []), ...(p.categories || []).map((c) => state.catById[c]?.label)]
            .join(" ").toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return (a._dist ?? 1e9) - (b._dist ?? 1e9);
      });
  }

  /* ---------- Render: chips ---------- */

  function renderChips() {
    const wrap = $("#catChips");
    wrap.innerHTML = "";
    state.config.categories.forEach((c) => {
      const b = el("button", "chip");
      b.type = "button";
      b.innerHTML = `<span class="chip__emoji">${c.emoji}</span>${esc(c.label)}`;
      b.addEventListener("click", () => {
        b.classList.toggle("is-on");
        state.activeCats.has(c.id) ? state.activeCats.delete(c.id) : state.activeCats.add(c.id);
        render();
      });
      wrap.appendChild(b);
    });
  }

  /* ---------- Render: kort ---------- */

  function pinIcon(emoji, isHome) {
    return L.divIcon({
      className: "",
      html: `<div class="pin ${isHome ? "pin--home" : ""}"><span>${emoji}</span></div>`,
      iconSize: [34, 34], iconAnchor: [17, 32], popupAnchor: [0, -30],
    });
  }

  function initMap() {
    map = L.map("map", { zoomControl: true, scrollWheelZoom: false })
      .setView([state.origin.lat, state.origin.lng], 11);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: "© OpenStreetMap",
    }).addTo(map);

    homeMarker = L.marker([state.config.home.lat, state.config.home.lng],
      { icon: pinIcon("🏠", true), zIndexOffset: 1000 })
      .addTo(map).bindPopup(`<b>${esc(state.config.home.label)}</b><br>${esc(state.config.home.address)}`);

    state.places.forEach((p) => {
      if (p.lat == null) return;
      const emoji = state.catById[p.categories[0]]?.emoji || "🧺";
      const m = L.marker([p.lat, p.lng], { icon: pinIcon(emoji, false) })
        .addTo(map)
        .bindPopup(`<b>${esc(p.name)}</b><br>${esc(p.tagline || "")}`);
      m.on("click", () => openSheet(p.id));
      markers[p.id] = m;
    });

    fitMap();
  }

  function fitMap(list) {
    if (!map) return;
    const pts = (list || state.places).filter((p) => p.lat != null)
      .map((p) => [p.lat, p.lng]);
    pts.push([state.origin.lat, state.origin.lng]);
    if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40], maxZoom: 13 });
  }

  function highlightMarker(id) {
    Object.entries(markers).forEach(([mid, m]) => {
      const node = m.getElement()?.querySelector(".pin");
      if (node) node.classList.toggle("is-active", mid === id);
    });
  }

  /* ---------- Render: kort-liste ---------- */

  function catTag(id) {
    const c = state.catById[id];
    return c ? `<span class="tag">${c.emoji} ${esc(c.label)}</span>` : "";
  }

  function badgeFor(st) {
    const cls = { open: "open", self: "self", season: "season", call: "call", closed: "closed", unknown: "unknown" }[st.kind];
    const dot = st.kind === "open" ? "🟢 " : st.kind === "self" ? "🔓 " :
                st.kind === "season" ? "🗓️ " : st.kind === "closed" ? "🔴 " :
                st.kind === "unknown" ? "ℹ️ " : "📞 ";
    return `<span class="badge badge--${cls}">${dot}${esc(st.label)}</span>`;
  }

  function renderList() {
    const list = $("#list");
    const items = visiblePlaces();
    list.innerHTML = "";

    $("#resultCount").textContent =
      items.length ? `${items.length} ${items.length === 1 ? "sted" : "steder"}` : "";
    $("#footerCount").textContent =
      `🧺 ${state.places.length} steder i alt · ${state.usingMyLocation ? "afstande fra din position" : "afstande fra " + state.config.home.label.toLowerCase()}`;

    if (!items.length) {
      list.appendChild(el("div", "empty",
        `<div class="empty__emoji">🥕</div><h2>Ingen steder her</h2>
         <p>Prøv at fjerne et filter eller rydde søgningen.</p>`));
      fitMap();
      return;
    }

    items.forEach((p) => {
      const st = openStatus(p);
      const emoji = state.catById[p.categories[0]]?.emoji || "🧺";
      const shownCats = p.categories.slice(0, 3).map(catTag).join("");
      const moreCats = p.categories.length > 3 ? `<span class="tag tag--more">+${p.categories.length - 3}</span>` : "";

      const card = el("article", "card" + (p.featured ? " card--featured" : ""));
      card.dataset.id = p.id;
      card.innerHTML = `
        <div class="card__top">
          <div class="card__avatar">${emoji}</div>
          <div class="card__main">
            <div class="card__namerow">
              <h2 class="card__name">${esc(p.name)}</h2>
              ${p._dist != null ? `<span class="card__dist">${fmtDist(p._dist)}</span>` : ""}
            </div>
            <p class="card__tagline">${esc(p.tagline || "")}</p>
          </div>
        </div>
        <div class="card__badges">${badgeFor(st)}</div>
        <div class="tags">${shownCats}${moreCats}</div>`;
      card.addEventListener("click", () => openSheet(p.id));
      card.addEventListener("mouseenter", () => highlightMarker(p.id));
      list.appendChild(card);
    });

    fitMap(items);
  }

  /* ---------- Detalje-ark ---------- */

  function mapsUrl(p) {
    const q = encodeURIComponent(`${p.name}, ${p.address}`);
    return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  }

  function openSheet(id) {
    const p = state.places.find((x) => x.id === id);
    if (!p) return;
    state.activeId = id;
    highlightMarker(id);

    const st = openStatus(p);
    const emoji = state.catById[p.categories[0]]?.emoji || "🧺";
    const payLabels = { kort: "💳 Kort", mobilepay: "📱 MobilePay", kontant: "💵 Kontant" };

    const phones = [p.phone, p.phone2].filter(Boolean);
    const rows = [];
    rows.push(`<div class="kv"><span class="kv__icon">📍</span><span>${esc(p.address)}${p._dist != null ? ` · <b>${fmtDist(p._dist)}</b> fra ${esc(state.usingMyLocation ? "dig" : state.config.home.label.toLowerCase())}` : ""}</span></div>`);
    if (p.hours?.note) rows.push(`<div class="kv"><span class="kv__icon">🕒</span><span>${esc(p.hours.note)}</span></div>`);
    phones.forEach((ph) => rows.push(`<div class="kv"><span class="kv__icon">📞</span><a href="tel:${esc(String(ph).replace(/\s/g,""))}">${esc(fmtPhone(ph))}</a></div>`));
    if (p.email) rows.push(`<div class="kv"><span class="kv__icon">✉️</span><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></div>`);
    if (p.website) rows.push(`<div class="kv"><span class="kv__icon">🌐</span><a href="${esc(p.website)}" target="_blank" rel="noopener">${esc(p.website.replace(/^https?:\/\/(www\.)?/, ""))}</a></div>`);
    if (p.contactPerson) rows.push(`<div class="kv"><span class="kv__icon">👤</span><span>${esc(p.contactPerson)}</span></div>`);

    const productsHtml = (p.products || []).map((x) => `<span class="product">${esc(x)}</span>`).join("");
    const payHtml = (p.payment || []).map((x) => `<span class="pay__item">${payLabels[x] || esc(x)}</span>`).join("");

    $("#sheetBody").innerHTML = `
      <div class="sheet__hero">
        <div class="sheet__avatar">${emoji}</div>
        <div>
          <h2 class="sheet__title">${esc(p.name)}</h2>
          <p class="sheet__tagline">${esc(p.tagline || "")}</p>
        </div>
      </div>
      <div class="sheet__badges">${badgeFor(st)}</div>
      ${p.description ? `<p class="sheet__desc">${esc(p.description)}</p>` : ""}

      <div class="actions">
        <a class="action action--primary" href="${mapsUrl(p)}" target="_blank" rel="noopener">🧭 Kør mig dertil</a>
        ${phones[0] ? `<a class="action action--secondary" href="tel:${esc(String(phones[0]).replace(/\s/g,""))}">📞 Ring</a>` : ""}
        ${p.email ? `<a class="action action--secondary" href="mailto:${esc(p.email)}">✉️ Skriv</a>` : ""}
      </div>

      ${productsHtml ? `<div class="sheet__section"><h3>Det kan du købe</h3><div class="products">${productsHtml}</div></div>` : ""}

      <div class="sheet__section"><h3>Info</h3>${rows.join("")}</div>

      ${payHtml ? `<div class="sheet__section"><h3>Betaling</h3><div class="pay">${payHtml}</div></div>` : ""}

      ${p.source ? `<div class="sheet__section"><h3>Kilde</h3><div class="kv"><span class="kv__icon">ℹ️</span><span>${esc(p.source)}${p.verified ? ` · opdateret ${esc(p.verified)}` : ""}</span></div></div>` : ""}
    `;

    $("#sheet").hidden = false;
    $("#sheetOverlay").hidden = false;
    document.body.style.overflow = "hidden";

    if (map && p.lat != null) {
      map.setView([p.lat, p.lng], 13, { animate: true });
      markers[p.id]?.openPopup();
    }
  }

  function closeSheet() {
    $("#sheet").hidden = true;
    $("#sheetOverlay").hidden = true;
    document.body.style.overflow = "";
    state.activeId = null;
    highlightMarker(null);
  }

  /* ---------- Geolokation ---------- */

  function useMyLocation() {
    const btn = $("#locBtn");
    if (state.usingMyLocation) {
      // skift tilbage til sommerhuset
      state.usingMyLocation = false;
      state.origin = { ...state.config.home };
      if (userMarker) {
        userMarker.remove();
        userMarker = null;
      }
      btn.classList.remove("is-active");
      btn.querySelector(".loc-btn__label").textContent = "Min position";
      recomputeDistances(); render();
      toast(`Afstande beregnes fra ${state.config.home.label.toLowerCase()} 🏠`);
      return;
    }
    if (!navigator.geolocation) { toast("Din enhed understøtter ikke positionering"); return; }
    btn.classList.add("is-loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.origin = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: "Min position" };
        state.usingMyLocation = true;
        btn.classList.remove("is-loading");
        btn.classList.add("is-active");
        btn.querySelector(".loc-btn__label").textContent = "Sommerhus";
        if (map) {
          if (userMarker) userMarker.remove();
          userMarker = L.marker([state.origin.lat, state.origin.lng],
            { icon: pinIcon("🧍", true), zIndexOffset: 1100 }).addTo(map).bindPopup("<b>Du er her</b>");
        }
        recomputeDistances(); render();
        toast("Afstande beregnes fra din position 📍");
      },
      () => { btn.classList.remove("is-loading"); toast("Kunne ikke hente din position"); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2600);
  }

  /* ---------- Master render ---------- */
  function render() { renderList(); }

  /* ---------- Event wiring ---------- */
  function wireEvents() {
    const search = $("#search"), clear = $("#searchClear");
    search.addEventListener("input", () => {
      state.query = search.value;
      clear.hidden = !search.value;
      render();
    });
    clear.addEventListener("click", () => {
      search.value = ""; state.query = ""; clear.hidden = true; search.focus(); render();
    });

    $("#openNowToggle").addEventListener("change", (e) => { state.openNow = e.target.checked; render(); });
    $("#locBtn").addEventListener("click", useMyLocation);

    const mapWrap = $("#mapWrap"), mapToggle = $("#mapToggle");
    mapToggle.addEventListener("click", () => {
      const hidden = mapWrap.classList.toggle("is-hidden");
      mapToggle.textContent = hidden ? "Vis kort" : "Skjul kort";
      mapToggle.setAttribute("aria-expanded", String(!hidden));
      if (!hidden && map) setTimeout(() => map.invalidateSize(), 320);
    });

    $("#sheetClose").addEventListener("click", closeSheet);
    $("#sheetOverlay").addEventListener("click", closeSheet);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });
  }

  /* ---------- Start ---------- */
  async function init() {
    try {
      await loadData();
    } catch (err) {
      $("#list").innerHTML = `<div class="empty"><div class="empty__emoji">😕</div>
        <h2>Kunne ikke hente data</h2><p>Tjek at <code>data/places.json</code> findes.</p></div>`;
      console.error(err);
      return;
    }

    const tags = state.config.app.taglines;
    $("#tagline").textContent = tags[Math.floor(Math.random() * tags.length)];
    $("#homeNote").textContent = state.config.home.note || "";

    renderChips();
    render();

    const startMap = () => { if (window.L && !map) { initMap(); } };
    if (window.L) startMap(); else window.addEventListener("load", startMap);

    wireEvents();

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () =>
        navigator.serviceWorker.register("sw.js").catch(() => {}));
    }
  }

  init();
})();
