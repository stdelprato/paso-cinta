// Componentes de interfaz: íconos, formatos, hojas (bottom sheets), ruedas, segmentados y gráficos.
const UI = (() => {
  "use strict";

  const P = {
    logo: '<path d="m5 5.5 6.5 6.5L5 18.5"/><path d="m12.5 5.5 6.5 6.5-6.5 6.5" opacity=".55"/>',
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    chart: '<path d="M3 21h18"/><rect x="5" y="11" width="3" height="7" rx="1"/><rect x="10.5" y="6" width="3" height="12" rx="1"/><rect x="16" y="13" width="3" height="5" rx="1"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
    bt: '<path d="m7 7 10 10-5 5V2l5 5L7 17"/>',
    play: '<path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6" y="4" width="4.5" height="16" rx="1.5" fill="currentColor" stroke="none"/><rect x="13.5" y="4" width="4.5" height="16" rx="1.5" fill="currentColor" stroke="none"/>',
    stop: '<rect x="5" y="5" width="14" height="14" rx="3" fill="currentColor" stroke="none"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    flame: '<path d="M12 2c.5 3.5 5 5.5 5 11a5 5 0 0 1-10 0c0-2.5 1-4 2.5-5.5 0 2 1 3 2 3.5C11 8 11 5 12 2z"/>',
    route: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H17a3.5 3.5 0 0 0 0-7H7a3.5 3.5 0 0 1 0-7h8.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    gauge: '<path d="m12 14 4-4"/><path d="M3.3 19a10 10 0 1 1 17.4 0"/>',
    mountain: '<path d="m2 20 7-12 4.5 7L16 11l6 9z"/>',
    flat: '<path d="M3 16h18"/><path d="M3 20h18" opacity=".35"/>',
    chevR: '<path d="m9 18 6-6-6-6"/>',
    chevL: '<path d="m15 18-6-6 6-6"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a4 4 0 0 1-4 4M7 5H4v2a4 4 0 0 0 4 4"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    steps: '<path d="M7 3c1.7 0 2.5 2 2.5 4.5S8.7 12 7.5 12 5 10.5 5 8s.3-5 2-5zM5.5 14.5h4l-.5 3a2 2 0 0 1-4 0zM17 7c1.7 0 2.5 2 2.5 4.5S18.7 16 17.5 16 15 14.5 15 12s.3-5 2-5zM15.5 18h4l-.5 1.5a2 2 0 0 1-3.5 0z"/>',
    scale: '<path d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M8.5 10a5 5 0 0 1 7 0L12 13z"/>',
    ruler: '<rect x="8" y="2.5" width="8" height="19" rx="2"/><path d="M8 7h3M8 11h4.5M8 15h3M8 19h4.5"/>',
    cake: '<path d="M4 21h16V13a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z"/><path d="M4 16c2 1.5 4 1.5 5.3 0s4 1.5 5.4 0 4-1.5 5.3 0M12 11V8M12 4.5v.5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    download: '<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 20V9m-5 5 5-5 5 5M5 4h14"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20c0-3-2-5-4.5-5.7"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    palette: '<path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2 0-1.5-1-1.5-1-3 0-1 .8-2 2-2h2a4 4 0 0 0 4-4c0-4-4-7-9-7z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10" cy="7" r="1.2" fill="currentColor"/><circle cx="15" cy="7" r="1.2" fill="currentColor"/>'
  };

  const icon = (n, s = 22, cls = "") =>
    `<svg class="ic ${cls}" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ""}</svg>`;

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const haptic = (ms = 8) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

  // ---------- formatos ----------
  const nf = d => new Intl.NumberFormat("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const F0 = nf(0), F1 = nf(1), F2 = nf(2);
  const int = n => F0.format(Math.round(n || 0));
  const dec1 = n => F1.format(n || 0);
  const dec2 = n => F2.format(n || 0);
  function dur(sec) {
    sec = Math.round(sec || 0);
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
    return h ? `${h} h ${m} min` : `${m} min`;
  }
  function durParts(sec) { // para mostrar número grande + unidad chica
    sec = Math.round(sec || 0);
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
    return h ? `${h}<small>h</small> ${m}<small>m</small>` : `${m}<small>min</small>`;
  }

  // ---------- hojas ----------
  function sheet(content, opts = {}) {
    const root = document.getElementById("sheets");
    const bd = document.createElement("div");
    bd.className = "sheet-bd";
    const el = document.createElement("div");
    el.className = "sheet " + (opts.cls || "");
    el.innerHTML = '<div class="grab"><i></i></div>';
    if (typeof content === "string") el.insertAdjacentHTML("beforeend", content); else el.append(content);
    const z = 80 + root.children.length;   // cada hoja nueva queda encima de la anterior
    bd.style.zIndex = z; el.style.zIndex = z + 1;
    root.append(bd, el);
    requestAnimationFrame(() => requestAnimationFrame(() => { bd.classList.add("on"); el.classList.add("on"); }));
    let closed = false;
    const close = () => {
      if (closed) return; closed = true;
      bd.classList.remove("on"); el.classList.remove("on"); el.style.transform = "";
      setTimeout(() => { bd.remove(); el.remove(); }, 380);
      opts.onClose && opts.onClose();
    };
    bd.onclick = close;
    el.addEventListener("click", e => { if (e.target.closest("[data-close]")) close(); });
    // arrastrar hacia abajo para cerrar
    const grab = el.querySelector(".grab");
    let y0 = null, dy = 0;
    grab.addEventListener("pointerdown", e => { y0 = e.clientY; dy = 0; el.style.transition = "none"; grab.setPointerCapture(e.pointerId); });
    grab.addEventListener("pointermove", e => { if (y0 === null) return; dy = Math.max(0, e.clientY - y0); el.style.transform = `translateY(${dy}px)`; });
    const end = () => { if (y0 === null) return; y0 = null; el.style.transition = ""; if (dy > 90) close(); else el.style.transform = ""; };
    grab.addEventListener("pointerup", end);
    grab.addEventListener("pointercancel", end);
    return { el, close };
  }

  function confirm({ title, text = "", ok = "Confirmar", danger = false }) {
    return new Promise(res => {
      let answered = false;
      const s = sheet(`
        <div class="sheet-body center">
          <h3 class="sheet-title">${esc(title)}</h3>
          ${text ? `<p class="sheet-text">${esc(text)}</p>` : ""}
          <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-ok>${esc(ok)}</button>
          <button class="btn btn-ghost" data-close>Cancelar</button>
        </div>`, { onClose: () => { if (!answered) res(false); } });
      s.el.querySelector("[data-ok]").onclick = () => { answered = true; res(true); s.close(); };
    });
  }

  let toastTimer = null;
  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("on"), 2800);
  }

  // ---------- rueda (scroll picker) ----------
  const ITEM = 44;
  function wheel({ values, index = 0, format = v => v, width = "" }) {
    const el = document.createElement("div");
    el.className = "wheel";
    if (width) el.style.flex = `0 0 ${width}`;
    el.innerHTML = `<div class="wheel-sc">${values.map((v, i) => `<div class="wheel-it" data-i="${i}">${format(v)}</div>`).join("")}</div>`;
    const sc = el.firstChild;
    const items = sc.children;
    let cur = index, raf = 0;
    const paint = () => {
      raf = 0;
      const c = sc.scrollTop / ITEM;
      const from = Math.max(0, Math.floor(c) - 5), to = Math.min(items.length - 1, Math.ceil(c) + 5);
      for (let i = from; i <= to; i++) {
        const d = i - c, a = Math.min(Math.abs(d), 3);
        items[i].style.transform = `rotateX(${(-d * 20).toFixed(1)}deg) scale(${(1 - a * 0.07).toFixed(3)})`;
        items[i].style.opacity = (1 - a * 0.3).toFixed(2);
      }
      const ni = Math.max(0, Math.min(values.length - 1, Math.round(c)));
      if (ni !== cur) { items[cur] && items[cur].classList.remove("sel"); cur = ni; items[cur].classList.add("sel"); haptic(4); }
    };
    sc.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(paint); }, { passive: true });
    sc.addEventListener("click", e => {
      const it = e.target.closest(".wheel-it");
      if (it) sc.scrollTo({ top: +it.dataset.i * ITEM, behavior: "smooth" });
    });
    const mount = () => { sc.scrollTop = cur * ITEM; items[cur] && items[cur].classList.add("sel"); paint(); };
    // Lee la posición real al confirmar (por si todavía estaba girando).
    const sync = () => { cur = Math.max(0, Math.min(values.length - 1, Math.round(sc.scrollTop / ITEM))); };
    return { el, mount, get value() { sync(); return values[cur]; }, get index() { sync(); return cur; } };
  }

  const range = (a, b, step = 1) => { const out = []; for (let v = a; v <= b + 1e-9; v += step) out.push(Math.round(v * 100) / 100); return out; };

  // Hoja con una o más ruedas. columns: [{values, value, format, width}], sep entre columnas.
  function pick({ title, columns, sep = "", unit = "", onDone }) {
    const ws = columns.map(c => wheel({ values: c.values, index: Math.max(0, c.values.indexOf(c.value)), format: c.format, width: c.width }));
    const body = document.createElement("div");
    body.className = "sheet-body";
    body.innerHTML = `<h3 class="sheet-title">${esc(title)}</h3><div class="wheels"><div class="wheel-band"></div></div><button class="btn btn-primary" data-done>Listo</button>`;
    const box = body.querySelector(".wheels");
    ws.forEach((w, i) => {
      box.append(w.el);
      if (sep && i < ws.length - 1) box.insertAdjacentHTML("beforeend", `<div class="wheel-sep">${sep}</div>`);
    });
    if (unit) box.insertAdjacentHTML("beforeend", `<div class="wheel-unit">${esc(unit)}</div>`);
    const s = sheet(body);
    requestAnimationFrame(() => ws.forEach(w => w.mount()));
    body.querySelector("[data-done]").onclick = () => { haptic(10); onDone(ws.map(w => w.value)); s.close(); };
    return s;
  }

  // ---------- segmentado ----------
  function seg(name, options, value, cls = "") {
    const i = Math.max(0, options.findIndex(o => o.v === value));
    return `<div class="seg ${cls}" data-seg="${name}" data-i="${i}" style="--n:${options.length};--i:${i}">
      <i class="seg-thumb"></i>
      ${options.map((o, k) => `<button type="button" data-v="${o.v}" class="${k === i ? "on" : ""}">${o.icon ? icon(o.icon, 18) : ""}<span>${esc(o.label)}</span></button>`).join("")}
    </div>`;
  }
  function setSeg(el, value) {
    const btns = [...el.querySelectorAll("button")];
    const i = btns.findIndex(b => b.dataset.v === value);
    if (i < 0) return;
    el.style.setProperty("--i", i);
    el.dataset.i = i;
    btns.forEach((b, k) => b.classList.toggle("on", k === i));
  }

  // ---------- gráficos ----------
  let gid = 0;
  function ring({ pct = 0, size = 200, stroke = 16, from = "#FF9F43", to = "#FF3D71", cls = "" }) {
    const id = "rg" + (++gid);
    const r = (size - stroke) / 2, c = 2 * Math.PI * r;
    const p = Math.max(0, Math.min(1, pct));
    return `<svg class="ring ${cls}" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="${stroke}"/>
      <circle class="ring-p" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="url(#${id})" stroke-width="${stroke}" stroke-linecap="round"
        stroke-opacity="${p > 0.005 ? 1 : 0}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - p)).toFixed(1)}" data-c="${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg>`;
  }
  function setRing(svg, pct) {
    const p = svg.querySelector(".ring-p");
    const c = +p.dataset.c;
    const k = Math.max(0, Math.min(1, pct || 0));
    p.setAttribute("stroke-dashoffset", (c * (1 - k)).toFixed(1));
    p.setAttribute("stroke-opacity", k > 0.005 ? 1 : 0);
  }

  // Barras en HTML (nítidas a cualquier ancho). values[], labels[], active índice resaltado.
  function bars(values, labels, { active = -1, fmt = int, showEvery = 1, allValues = false } = {}) {
    const max = Math.max(...values, 0) || 1;
    return `<div class="bars ${allValues ? "all" : ""}" style="--n:${values.length}">
      ${values.map((v, i) => `
        <button type="button" class="bar ${i === active ? "on" : ""} ${v ? "" : "zero"}" data-i="${i}">
          <span class="bar-v">${v ? fmt(v) : ""}</span>
          <span class="bar-col"><span class="bar-fill" style="height:${Math.max(v ? 4 : 0, v / max * 100).toFixed(1)}%"></span></span>
          <span class="bar-l">${i % showEvery === 0 || i === active ? labels[i] : ""}</span>
        </button>`).join("")}
    </div>`;
  }

  // Área suave (velocidad o peso). points: números.
  function area(points, { w = 320, h = 110, color = "#C6FF3D", min = null, max = null } = {}) {
    if (points.length < 2) return "";
    const step = Math.max(1, Math.ceil(points.length / 120));
    const pts = points.filter((_, i) => i % step === 0);
    const lo = min != null ? min : Math.min(...pts), hi = max != null ? max : Math.max(...pts);
    const span = hi - lo || 1;
    const xy = pts.map((v, i) => [i / (pts.length - 1) * w, h - 6 - (v - lo) / span * (h - 18)]);
    let d = `M${xy[0][0].toFixed(1)},${xy[0][1].toFixed(1)}`;
    for (let i = 1; i < xy.length; i++) {
      const [x0, y0] = xy[i - 1], [x1, y1] = xy[i], mx = (x0 + x1) / 2;
      d += ` C${mx.toFixed(1)},${y0.toFixed(1)} ${mx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
    }
    const id = "ar" + (++gid);
    return `<svg class="area" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
      <path d="${d} L${w},${h} L0,${h} Z" fill="url(#${id})"/>
      <path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linecap="round"/>
    </svg>`;
  }

  // Mapa de constancia: weeks columnas × 7 filas. values: Map dayKey → número.
  function heatmap(values, weeks, endDate) {
    const C = CintaCore;
    const end = C.weekStart(endDate);
    const start = C.addDays(end, -(weeks - 1) * 7);
    const all = [...values.values()];
    const max = Math.max(...all, 0) || 1;
    const today = C.dayStart(new Date()).getTime();
    let cells = "";
    for (let i = 0; i < weeks * 7; i++) {
      const d = C.addDays(start, i);
      const v = values.get(C.dayKey(d)) || 0;
      const lvl = v ? Math.min(4, 1 + Math.floor(v / max * 3.999)) : 0;
      cells += `<i class="hm l${lvl} ${d.getTime() > today ? "fut" : ""} ${d.getTime() === today ? "today" : ""}"></i>`;
    }
    return `<div class="heat" style="--w:${weeks}">${cells}</div>`;
  }

  function countUp(el, to, fmt = int, ms = 900) {
    if (!el) return;
    const t0 = performance.now();
    const step = t => {
      const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(to * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  return { icon, esc, haptic, int, dec1, dec2, dur, durParts, sheet, confirm, toast, wheel, range, pick, seg, setSeg, ring, setRing, bars, area, heatmap, countUp };
})();
