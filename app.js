"use strict";
const C = CintaCore;
const { icon, esc, haptic, int, dec1, dec2, dur, durParts } = UI;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ================= estado =================
const store = {
  get(k, d) { try { const v = localStorage.getItem("paso." + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("paso." + k, JSON.stringify(v)); } catch (e) {} }
};
const COLORS = ["#C6FF3D", "#FF6B9A", "#3DD9FF", "#A78BFA", "#FFB547", "#4DFFB8"];
const S = {
  profiles: store.get("profiles", []),
  activeId: store.get("active", null),
  sessions: store.get("sessions", []),
  settings: Object.assign({ pct: 6.3, lastMode: "flat", burn: "h", lastSpeed: 5, quickMin: 30 }, store.get("settings", {})),
  live: store.get("live", null),
  plans: store.get("plans", [])
};
const save = {
  profiles: () => store.set("profiles", S.profiles),
  active: () => store.set("active", S.activeId),
  sessions: () => store.set("sessions", S.sessions),
  settings: () => store.set("settings", S.settings),
  live: () => store.set("live", S.live),
  plans: () => store.set("plans", S.plans)
};
const view = { tab: "home", period: "week", offset: 0, metric: "kcal", sel: -1 };
const ble = new Treadmill();

// ================= helpers =================
const me = () => S.profiles.find(p => p.id === S.activeId) || S.profiles[0] || null;
const byId = id => S.profiles.find(p => p.id === id) || me();
const sessionsOf = p => p ? S.sessions.filter(s => s.profileId === p.id) : [];
const isNet = p => p && p.kcalMode === "net";
const kcalOf = (s, p = me()) => isNet(p) ? s.net : s.gross;
const kcalWord = p => isNet(p) ? "kcal netas" : "kcal";
const firstName = p => ((p && p.name) || "").trim().split(/\s+/)[0] || "";
const initial = p => (((p && p.name) || "?").trim()[0] || "?").toUpperCase();
const avatar = (p, cls = "") => `<span class="avatar ${cls}" style="--c:${p.color}">${esc(initial(p))}</span>`;
const incGrade = () => (S.settings.pct || 6.3) / 100;
const gradeOf = mode => mode === "inc" ? incGrade() : 0;
const weekFrom = () => C.weekStart(new Date()).getTime();
const weekKcal = p => sessionsOf(p).filter(s => s.start >= weekFrom()).reduce((a, s) => a + kcalOf(s, p), 0);
const fmtDay = (ts, o) => new Date(ts).toLocaleDateString("es-AR", o);
const fmtHour = ts => new Date(ts).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ================= navegación =================
function render() {
  const has = S.profiles.length > 0;
  document.body.classList.toggle("onboarding", !has);
  const id = has ? view.tab : "welcome";
  $$(".screen").forEach(s => s.classList.toggle("on", s.id === "s-" + id));
  $("#cta").hidden = !has || view.tab !== "home";
  renderTabs();
  if (!has) return renderWelcome();
  ({ home: renderHome, progress: renderProgress, profile: renderProfile })[view.tab]();
}
function renderTabs() {
  $("#tabs").innerHTML = [["home", "home", "Inicio"], ["progress", "chart", "Progreso"], ["profile", "user", "Perfil"]]
    .map(([t, ic, l]) => `<button data-tab="${t}" class="${view.tab === t ? "on" : ""}">${icon(ic, 23)}<span>${l}</span></button>`).join("");
}
function go(tab) { if (view.tab === tab) return; view.tab = tab; haptic(6); render(); const sc = $(".screen.on"); if (sc) sc.scrollTop = 0; }

// ================= bienvenida =================
function renderWelcome() {
  $("#s-welcome").innerHTML = `
    <div class="welcome">
      <div class="logo">${icon("logo", 40, "thick")}</div>
      <h1>Cada paso,<br><span class="grad">contado.</span></h1>
      <p>Tu cinta, tus calorías reales y tu progreso. Para cada uno.</p>
      <button class="btn btn-primary" data-act="new-profile">Crear perfil</button>
    </div>`;
}

// ================= inicio =================
function renderHome() {
  const p = me();
  const ss = sessionsOf(p);
  const ws = weekFrom();
  const week = ss.filter(s => s.start >= ws);
  const wk = week.reduce((a, s) => a + kcalOf(s, p), 0);
  const wkm = week.reduce((a, s) => a + s.km, 0);
  const wsec = week.reduce((a, s) => a + s.sec, 0);
  const goal = p.goal || 2000;
  const days = new Set(week.map(s => C.dayKey(s.start)));
  const today = C.dayKey(Date.now());
  const st = C.streak(ss);
  const last = ss[0];
  const hour = new Date().getHours();
  const hi = hour < 6 ? "Buenas noches" : hour < 13 ? "Buen día" : hour < 20 ? "Buenas tardes" : "Buenas noches";

  $("#s-home").innerHTML = `
    <header class="top">
      <div><div class="eyebrow">${fmtDay(Date.now(), { weekday: "long", day: "numeric", month: "long" })}</div><h1>${hi},<br>${esc(firstName(p))}</h1></div>
      <button data-act="switch" aria-label="Cambiar perfil">${avatar(p)}</button>
    </header>

    ${deviceCard()}

    ${daysSinceWeigh(p) >= 7 && Date.now() > (p.weightSnooze || 0) ? `
    <div class="card remind">
      <span class="bub kcal">${icon("scale", 20)}</span>
      <div class="grow"><b>¿Cuánto pesás hoy?</b><span>${daysSinceWeigh(p) >= 99 ? "Cargá tu peso" : `Hace ${daysSinceWeigh(p)} días que no lo cargás`} para que las calorías sean exactas.</span></div>
      <div class="remind-act"><button class="btn btn-primary sm" data-act="weigh">Cargar</button><button class="btn btn-ghost sm" data-act="weigh-later">Después</button></div>
    </div>` : ""}

    <div class="card week">
      <div class="card-h"><span class="card-t">Esta semana</span><span class="card-s">Meta ${int(goal)} ${kcalWord(p)}</span></div>
      <div class="week-main">
        <div class="ring-box">${UI.ring({ pct: 0, size: 148, stroke: 14 })}
          <div class="ring-in">${icon("flame", 18)}<b class="num" id="wk-k">0</b><span>${Math.round(wk / goal * 100)}%</span></div>
        </div>
        <div class="wk-stats">
          <div class="wk-stat"><span class="bub dist">${icon("route", 18)}</span><div><b class="num">${dec1(wkm)}</b><span>km</span></div></div>
          <div class="wk-stat"><span class="bub time">${icon("clock", 18)}</span><div><b class="num">${durParts(wsec)}</b><span>tiempo</span></div></div>
          <div class="wk-stat"><span class="bub acc">${icon("bolt", 18)}</span><div><b class="num">${week.length}</b><span>${week.length === 1 ? "caminata" : "caminatas"}</span></div></div>
        </div>
      </div>
      <div class="days">${"LMMJVSD".split("").map((l, i) => {
        const d = C.dayKey(C.addDays(new Date(ws), i));
        return `<div class="day ${days.has(d) ? "done" : ""} ${d === today ? "today" : ""}"><i>${days.has(d) ? icon("check", 15) : ""}</i>${l}</div>`;
      }).join("")}</div>
    </div>

    <div class="duo">
      <div class="mini streak"><div class="lbl">${icon("flame", 14)}Racha</div><b class="num">${st}</b><div class="s">${st === 1 ? "día" : "días"} seguidos</div></div>
      <button class="mini" ${last ? `data-act="session" data-id="${last.id}"` : ""}><div class="lbl">${icon("clock", 14)}Última</div>
        ${last ? `<b class="num">${dec2(last.km)}<small>km</small></b><div class="s">${relDay(last.start)} · ${int(kcalOf(last, p))} kcal</div>` : `<b>—</b><div class="s">Todavía nada</div>`}
      </button>
    </div>`;

  const q = quickPlan();
  $("#cta").innerHTML = S.live
    ? `<button class="cta-go" data-act="start"><span class="play">${icon("play", 16)}</span>Volver a la caminata</button>`
    : `<button class="cta-go" data-act="start"><span class="play">${icon("play", 16)}</span><span class="cta-t">Empezar<small>${fmtGoal(q.goal)} · ${dec1(q.base)} km/h</small></span></button>
       <button class="cta-plan" data-act="plan" aria-label="Caminata a medida">${icon("sliders", 24)}</button>`;

  requestAnimationFrame(() => {
    const r = $("#s-home .ring");
    if (r) UI.setRing(r, wk / goal);
    UI.countUp($("#wk-k"), wk);
  });
}
function relDay(ts) {
  const d = Math.round((C.dayStart(new Date()) - C.dayStart(new Date(ts))) / 864e5);
  return d === 0 ? "Hoy" : d === 1 ? "Ayer" : d < 7 ? `Hace ${d} días` : fmtDay(ts, { day: "numeric", month: "short" });
}
function deviceCard() {
  const st = ble.state;
  const txt = st === "on" ? "Conectada · lista" : st === "connecting" ? "Conectando…" : "Se conecta al empezar";
  return `<button class="device ${st}" data-act="device">
    <span class="dev-ic">${icon("bt", 20)}</span>
    <div class="grow"><b>${esc(st === "on" ? ble.name : "Cinta")}</b><span class="st">${txt}</span></div>
    <span class="dot"></span></button>`;
}
function refreshDevice() {
  const el = $("#s-home .device");
  if (el) el.outerHTML = deviceCard();
  updateLive();
}

// ================= progreso =================
function periodInfo() {
  const now = new Date();
  if (view.period === "week") {
    const from = C.addDays(C.weekStart(now), view.offset * 7);
    const to = C.addDays(from, 7);
    const l = C.addDays(to, -1);
    const sameM = from.getMonth() === l.getMonth();
    const title = view.offset === 0 ? "Esta semana" : view.offset === -1 ? "Semana pasada"
      : `${from.getDate()}${sameM ? "" : " " + fmtDay(from, { month: "short" })} – ${l.getDate()} ${fmtDay(l, { month: "short" })}`;
    return { from, to, n: 7, bucket: "day", labels: "LMMJVSD".split(""), title, prev: "la semana anterior", prevShort: "sem. anterior", every: 1 };
  }
  if (view.period === "month") {
    const from = new Date(now.getFullYear(), now.getMonth() + view.offset, 1);
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
    const n = Math.round((to - from) / 864e5);
    return { from, to, n, bucket: "day", labels: Array.from({ length: n }, (_, i) => String(i + 1)), title: fmtDay(from, { month: "long", year: "numeric" }), prev: "el mes anterior", prevShort: "mes anterior", every: 5 };
  }
  const from = new Date(now.getFullYear() + view.offset, 0, 1);
  const to = new Date(from.getFullYear() + 1, 0, 1);
  return { from, to, n: 12, bucket: "month", labels: "EFMAMJJASOND".split(""), title: String(from.getFullYear()), prev: "el año anterior", prevShort: "año anterior", every: 1 };
}
function shiftPeriod(info, k) { // mismo período desplazado k
  const o = view.offset; view.offset += k; const r = periodInfo(); view.offset = o; return r;
}
function renderProgress() {
  const p = me();
  const ss = sessionsOf(p);
  const info = periodInfo();
  const inP = (s, i) => s.start >= i.from.getTime() && s.start < i.to.getTime();
  const cur = ss.filter(s => inP(s, info));
  const prevInfo = shiftPeriod(info, -1);
  // período en curso: comparar contra el mismo tramo del anterior (ej. lunes a miércoles vs lunes a miércoles)
  const cut = view.offset === 0 ? prevInfo.from.getTime() + (Date.now() - info.from.getTime()) : Infinity;
  const prev = ss.filter(s => inP(s, prevInfo) && s.start < cut);
  const sum = (arr, f) => arr.reduce((a, s) => a + f(s), 0);
  const kc = sum(cur, s => kcalOf(s, p)), pk = sum(prev, s => kcalOf(s, p));
  const delta = pk > 0 ? Math.round((kc - pk) / pk * 100) : null;

  const metricFn = { kcal: s => kcalOf(s, p), km: s => s.km, min: s => s.sec / 60 }[view.metric];
  const vals = C.buckets(cur, info.from, info.n, info.bucket, metricFn);
  let active = view.sel;
  if (active < 0 || active >= info.n) {
    const now = new Date();
    active = info.bucket === "day" ? Math.round((C.dayStart(now) - info.from) / 864e5) : (now.getFullYear() - info.from.getFullYear()) * 12 + now.getMonth();
    if (active < 0 || active >= info.n || !vals[active]) active = vals.lastIndexOf(Math.max(...vals));
  }
  const fmtM = view.metric === "kcal" ? int : view.metric === "km" ? dec1 : int;

  // constancia: 18 semanas
  const heatVals = new Map();
  ss.forEach(s => { const k = C.dayKey(s.start); heatVals.set(k, (heatVals.get(k) || 0) + kcalOf(s, p)); });

  // récords
  const best = f => ss.reduce((b, s) => (!b || f(s) > f(b)) ? s : b, null);
  const weeks = new Map();
  ss.forEach(s => { const k = C.weekStart(new Date(s.start)).getTime(); weeks.set(k, (weeks.get(k) || 0) + kcalOf(s, p)); });
  const bestWeek = [...weeks.entries()].sort((a, b) => b[1] - a[1])[0];
  const bKm = best(s => s.km), bK = best(s => kcalOf(s, p)), bT = best(s => s.sec);
  const totalKm = sum(ss, s => s.km);

  // historial agrupado por mes
  let hist = "", lastM = "";
  ss.slice(0, 80).forEach(s => {
    const m = fmtDay(s.start, { month: "long", year: "numeric" });
    if (m !== lastM) { hist += `<div class="month-t">${m}</div>`; lastM = m; }
    const inc = s.incSec > s.sec / 2;
    hist += `<button class="sess" data-act="session" data-id="${s.id}">
      <div class="date"><b>${new Date(s.start).getDate()}</b><span>${fmtDay(s.start, { weekday: "short" }).replace(".", "")}</span></div>
      <div class="mid"><b class="num">${dec2(s.km)} km${inc ? '<i class="tag-inc"></i>' : ""}</b><span>${dur(s.sec)} · ${fmtHour(s.start)}</span></div>
      <div class="kc"><b class="num">${int(kcalOf(s, p))}</b><span>kcal</span></div>
    </button>`;
  });

  $("#s-progress").innerHTML = `
    <header class="top"><h1>Progreso</h1><button class="icon-btn" data-act="add-manual" aria-label="Cargar caminata">${icon("plus", 20)}</button></header>
    ${UI.seg("period", [{ v: "week", label: "Semana" }, { v: "month", label: "Mes" }, { v: "year", label: "Año" }], view.period)}
    <div class="period-nav">
      <button class="icon-btn" data-act="prev">${icon("chevL", 20)}</button>
      <b>${esc(info.title)}</b>
      <button class="icon-btn" data-act="next" ${view.offset >= 0 ? "disabled" : ""}>${icon("chevR", 20)}</button>
    </div>

    <div class="card">
      <div class="kpi-hero">
        <div><div class="big num"><span id="pk">0</span></div><div class="lbl">${kcalWord(p)}</div></div>
        ${delta !== null ? `<span class="delta ${delta >= 0 ? "up" : "down"}">${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}% vs ${info.prevShort}</span>` : ""}
      </div>
      <div class="kpis">
        <div class="kpi">${icon("route", 18, "c-dist")}<b class="num">${dec1(sum(cur, s => s.km))}</b><span>km</span></div>
        <div class="kpi">${icon("clock", 18, "c-time")}<b class="num">${durParts(sum(cur, s => s.sec))}</b><span>tiempo</span></div>
        <div class="kpi">${icon("bolt", 18, "c-acc")}<b class="num">${cur.length}</b><span>caminatas</span></div>
      </div>
    </div>

    <div class="card metric-${view.metric}">
      <div class="card-h"><span class="card-t">Actividad</span>
        <div class="chips">${[["kcal", "kcal"], ["km", "km"], ["min", "min"]].map(([v, l]) => `<button class="chip-btn ${view.metric === v ? "on" : ""}" data-act="metric" data-v="${v}">${l}</button>`).join("")}</div>
      </div>
      ${UI.bars(vals, info.labels, { active, fmt: fmtM, showEvery: info.every, allValues: info.n <= 12 })}
    </div>

    <div class="card">
      <div class="card-h"><span class="card-t">Constancia</span><span class="card-s">18 semanas</span></div>
      ${UI.heatmap(heatVals, 18, new Date())}
      <div class="heat-leg">Menos <i class="hm"></i><i class="hm l1"></i><i class="hm l2"></i><i class="hm l3"></i><i class="hm l4"></i> Más</div>
    </div>

    ${ss.length ? `
    <div class="h-sec"><h2>Récords</h2></div>
    <div class="recs">
      ${rec("Más calorías", bK && int(kcalOf(bK, p)), "kcal", bK, "flame")}
      ${rec("Más distancia", bKm && dec2(bKm.km), "km", bKm, "route")}
      ${rec("La más larga", bT && C.fmtTime(bT.sec), "", bT, "clock")}
      ${bestWeek ? `<div class="rec">${icon("trophy", 20)}<b class="num">${int(bestWeek[1])}<small>kcal</small></b><span>Mejor semana</span><em>Semana del ${fmtDay(bestWeek[0], { day: "numeric", month: "short" })}</em></div>` : ""}
      <div class="rec">${icon("steps", 20)}<b class="num">${dec1(totalKm)}<small>km</small></b><span>En total</span><em>${ss.length} caminatas</em></div>
    </div>` : ""}

    <div class="h-sec"><h2>Historial</h2></div>
    ${hist || `<div class="empty">${icon("steps", 40)}<b>Sin caminatas todavía</b>Tu primera aparece acá.</div>`}`;

  requestAnimationFrame(() => UI.countUp($("#pk"), kc));
}
function rec(label, val, unit, s, ic) {
  if (!s) return "";
  return `<button class="rec" data-act="session" data-id="${s.id}">${icon(ic, 20)}<b class="num">${val}${unit ? `<small>${unit}</small>` : ""}</b><span>${label}</span><em>${fmtDay(s.start, { day: "numeric", month: "short", year: "numeric" })}</em></button>`;
}

// ================= perfil =================
function renderProfile() {
  const p = me();
  const b = C.bmi(p.weight, p.height);
  const ws = (p.weights || []).slice(-30);
  const wDelta = ws.length > 1 ? ws[ws.length - 1].kg - ws[0].kg : 0;
  $("#s-profile").innerHTML = `
    <div class="p-hero">
      ${avatar(p, "lg")}
      <h1>${esc(p.name)}</h1>
      <div class="meta">${p.age} años · ${p.height} cm · ${dec1(p.weight)} kg</div>
      ${b ? `<div class="bmi">IMC <b>${dec1(b)}</b> · ${C.bmiLabel(b)}</div>` : ""}
    </div>

    <div class="group-t">Datos personales</div>
    <div class="group">
      ${row("edit", "Nombre", esc(p.name), "name")}
      ${row("cake", "Edad", `${p.age} años`, "age")}
      ${row("ruler", "Altura", `${p.height} cm`, "height")}
      ${row("scale", "Peso", `${dec1(p.weight)} kg`, "weight")}
      <div class="row row-col"><div style="display:flex;align-items:center;gap:14px"><span class="ri">${icon("palette", 18)}</span><span class="rl">Color</span></div>
        <div class="swatches">${COLORS.map(c => `<button class="sw ${c === p.color ? "on" : ""}" style="--c:${c}" data-act="color" data-v="${c}" aria-label="Color"></button>`).join("")}</div></div>
    </div>

    ${ws.length > 1 ? `
    <div class="card">
      <div class="card-h"><span class="card-t">Peso</span><span class="card-s">${wDelta > 0 ? "+" : ""}${dec1(wDelta)} kg desde ${fmtDay(ws[0].t, { day: "numeric", month: "short" })}</span></div>
      <div class="wchart">${UI.area(ws.map(w => w.kg), { color: "#3DD9FF", h: 90 })}</div>
    </div>` : ""}

    <div class="group-t">Calorías</div>
    <div class="group">
      <div class="row row-col">
        ${UI.seg("kcalmode", [{ v: "total", label: "Totales" }, { v: "net", label: "Netas" }], p.kcalMode || "total")}
        <div class="row-cap">${isNet(p) ? "Solo lo que suma la caminata, sin el gasto en reposo." : "Incluye lo que tu cuerpo gasta en reposo."}</div>
      </div>
      ${row("target", "Meta semanal", `${int(p.goal)} kcal`, "goal")}
    </div>

    <div class="group-t">Cinta</div>
    <div class="group">
      ${row("mountain", "Inclinada", `${dec1(S.settings.pct)} %`, "pct")}
      ${row("bolt", "Caminata rápida", `${S.settings.quickMin || 30} min`, "quick")}
      <button class="row" data-act="diag"><span class="ri">${icon("bolt", 18)}</span><span class="rl">Diagnóstico</span>${icon("chevR", 18, "chev")}</button>
      <button class="row" data-act="device"><span class="ri">${icon("bt", 18)}</span><span class="rl">Conexión</span><span class="rv">${ble.connected ? "Conectada" : "Desconectada"}</span>${icon("chevR", 18, "chev")}</button>
    </div>

    <div class="group-t">Perfiles y datos</div>
    <div class="group">
      <button class="row" data-act="switch"><span class="ri">${icon("users", 18)}</span><span class="rl">Cambiar de perfil</span>${icon("chevR", 18, "chev")}</button>
      <button class="row" data-act="export"><span class="ri">${icon("download", 18)}</span><span class="rl">Exportar copia</span>${icon("chevR", 18, "chev")}</button>
      <button class="row" data-act="import"><span class="ri">${icon("upload", 18)}</span><span class="rl">Importar copia</span>${icon("chevR", 18, "chev")}</button>
      <button class="row danger" data-act="delete-profile"><span class="ri">${icon("trash", 18)}</span><span class="rl">Eliminar perfil</span></button>
    </div>
    <p class="foot">Calorías estimadas con la fórmula ACSM para caminata,<br>según tu peso, la velocidad y la inclinación.</p>
    <div class="ver">Paso ${VERSION} · <button data-act="update">Buscar actualizaciones</button></div>`;
}
function row(ic, label, val, field) {
  return `<button class="row" data-act="field" data-f="${field}"><span class="ri">${icon(ic, 18)}</span><span class="rl">${label}</span><span class="rv">${val}</span>${icon("chevR", 18, "chev")}</button>`;
}

// ================= editores =================
const PICK = {
  age: (v, done) => UI.pick({ title: "Edad", columns: [{ values: UI.range(12, 99), value: v.age }], unit: "años", onDone: ([a]) => done({ age: a }) }),
  height: (v, done) => UI.pick({ title: "Altura", columns: [{ values: UI.range(120, 220), value: v.height }], unit: "cm", onDone: ([h]) => done({ height: h }) }),
  weight: (v, done) => UI.pick({
    title: "Peso", sep: ",", unit: "kg",
    columns: [{ values: UI.range(35, 200), value: Math.floor(v.weight) }, { values: UI.range(0, 9), value: Math.round((v.weight % 1) * 10) % 10, width: "64px" }],
    onDone: ([a, b]) => done({ weight: a + b / 10 })
  }),
  goal: (v, done) => UI.pick({ title: "Meta semanal", columns: [{ values: UI.range(500, 10000, 100), value: Math.round((v.goal || 2000) / 100) * 100, format: int, width: "130px" }], unit: "kcal", onDone: ([g]) => done({ goal: g }) }),
  pct: (_, done) => UI.pick({
    title: "Inclinación (INCLINADA)", sep: ",", unit: "%",
    columns: [{ values: UI.range(0, 15), value: Math.floor(S.settings.pct), width: "70px" }, { values: UI.range(0, 9), value: Math.round((S.settings.pct % 1) * 10) % 10, width: "64px" }],
    onDone: ([x, y]) => done({ pct: x + y / 10 })
  }),
  quick: (_, done) => UI.pick({ title: "Caminata rápida", unit: "min", columns: [{ values: UI.range(5, 180, 5), value: S.settings.quickMin || 30 }], onDone: ([m]) => done({ quick: m }) })
};

function editField(f) {
  const p = me();
  if (f === "name") return nameSheet(p.name, name => { p.name = name; save.profiles(); render(); });
  PICK[f](p, ch => {
    if (ch.pct !== undefined || ch.quick !== undefined) {
      if (ch.pct !== undefined) S.settings.pct = ch.pct;
      if (ch.quick !== undefined) S.settings.quickMin = ch.quick;
      save.settings();
    }
    else {
      if (ch.weight !== undefined) logWeight(p, ch.weight);
      Object.assign(p, ch); save.profiles();
    }
    render();
  });
}

// Registra una pesada (aunque sea el mismo peso: cuenta para el recordatorio semanal).
function logWeight(p, kg) {
  p.weights = p.weights || [];
  const last = p.weights[p.weights.length - 1];
  if (last && C.dayKey(last.t) === C.dayKey(Date.now())) { last.kg = kg; last.t = Date.now(); }
  else p.weights.push({ t: Date.now(), kg });
  p.weightSnooze = 0;
}
function daysSinceWeigh(p) {
  const w = p.weights || [];
  return w.length ? Math.floor((Date.now() - w[w.length - 1].t) / 864e5) : 99;
}

function nameSheet(cur, done, o = {}) {
  const s = UI.sheet(`<div class="sheet-body"><h3 class="sheet-title">${esc(o.title || "Nombre")}</h3>
    <input class="field" id="nm" maxlength="24" placeholder="${esc(o.ph || "¿Cómo te llamás?")}" value="${esc(cur || "")}" autocomplete="off">
    <button class="btn btn-primary" data-ok>Listo</button></div>`);
  const inp = s.el.querySelector("#nm");
  setTimeout(() => inp.focus(), 350);
  const ok = () => { const v = inp.value.trim(); if (!v) return inp.focus(); done(v); s.close(); };
  s.el.querySelector("[data-ok]").onclick = ok;
  inp.onkeydown = e => { if (e.key === "Enter") ok(); };
}

// Crear perfil: nombre → color → datos con ruedas
function newProfile() {
  const d = { name: "", color: COLORS[S.profiles.length % COLORS.length], age: 30, height: 170, weight: 70, goal: 2000 };
  const body = document.createElement("div");
  body.className = "sheet-body";
  const draw = () => {
    body.innerHTML = `
      <h3 class="sheet-title">${S.profiles.length ? "Nuevo perfil" : "Creá tu perfil"}</h3>
      <div style="display:flex;justify-content:center;margin:6px 0 4px"><span class="avatar lg" style="--c:${d.color}">${esc((d.name.trim()[0] || "?").toUpperCase())}</span></div>
      <input class="field" id="np-name" maxlength="24" placeholder="Nombre" value="${esc(d.name)}" autocomplete="off">
      <div class="swatches" style="justify-content:center;margin:6px 0">${COLORS.map(c => `<button class="sw ${c === d.color ? "on" : ""}" style="--c:${c}" data-c="${c}"></button>`).join("")}</div>
      <div class="group" style="margin:0">
        <button class="row" data-f="age"><span class="ri">${icon("cake", 18)}</span><span class="rl">Edad</span><span class="rv">${d.age} años</span>${icon("chevR", 18, "chev")}</button>
        <button class="row" data-f="height"><span class="ri">${icon("ruler", 18)}</span><span class="rl">Altura</span><span class="rv">${d.height} cm</span>${icon("chevR", 18, "chev")}</button>
        <button class="row" data-f="weight"><span class="ri">${icon("scale", 18)}</span><span class="rl">Peso</span><span class="rv">${dec1(d.weight)} kg</span>${icon("chevR", 18, "chev")}</button>
      </div>
      <button class="btn btn-primary" data-save style="margin-top:6px">Guardar</button>`;
    const nm = body.querySelector("#np-name");
    nm.oninput = () => { d.name = nm.value; body.querySelector(".avatar").textContent = (d.name.trim()[0] || "?").toUpperCase(); };
    body.querySelectorAll("[data-c]").forEach(b => b.onclick = () => { d.color = b.dataset.c; haptic(6); draw(); });
    body.querySelectorAll("[data-f]").forEach(b => b.onclick = () => PICK[b.dataset.f](d, ch => { Object.assign(d, ch); draw(); }));
    body.querySelector("[data-save]").onclick = () => {
      if (!d.name.trim()) { nm.focus(); UI.toast("Poné un nombre"); return; }
      const p = { id: uid(), name: d.name.trim(), color: d.color, age: d.age, height: d.height, weight: d.weight, goal: d.goal, kcalMode: "total", weights: [{ t: Date.now(), kg: d.weight }] };
      S.profiles.push(p); S.activeId = p.id;
      save.profiles(); save.active();
      s.close(); haptic(15); view.tab = "home"; render();
      UI.toast(`¡Listo, ${firstName(p)}!`);
    };
  };
  draw();
  const s = UI.sheet(body);
}

function switchSheet() {
  const s = UI.sheet(`<div class="sheet-body"><h3 class="sheet-title">¿Quién camina?</h3>
    <div class="group plist" style="margin:0">
      ${S.profiles.map(p => `<button class="row" data-pid="${p.id}">${avatar(p, "sm")}<span class="rl">${esc(p.name)}</span><span class="rv"><b>${int(weekKcal(p))}</b> kcal sem.</span>${p.id === me().id ? icon("check", 20, "check") : ""}</button>`).join("")}
      <button class="row" data-new><span class="ri">${icon("plus", 18)}</span><span class="rl">Agregar perfil</span></button>
    </div></div>`);
  s.el.querySelectorAll("[data-pid]").forEach(b => b.onclick = () => {
    if (S.live) { UI.toast("Terminá la caminata antes de cambiar"); return; }
    S.activeId = b.dataset.pid; save.active(); haptic(10); s.close(); render();
  });
  s.el.querySelector("[data-new]").onclick = () => { s.close(); setTimeout(newProfile, 250); };
}

function deviceSheet() {
  if (!ble.connected) { connectFlow(false); return; }
  const s = UI.sheet(`<div class="sheet-body center">
    <div class="conn-ic" style="margin:8px auto 10px">${icon("bt", 36)}</div>
    <h3 class="sheet-title">${esc(ble.name)}</h3><p class="sheet-text">Conectada</p>
    <button class="btn btn-soft" data-x>Desconectar</button><button class="btn btn-ghost" data-close>Cerrar</button></div>`);
  s.el.querySelector("[data-x]").onclick = () => { ble.disconnect(); s.close(); };
}

// ================= cargar caminata pasada =================
function manualSheet() {
  const p = me();
  const now = new Date(Date.now() - 3600e3);
  now.setMinutes(0, 0, 0);
  const pad = n => String(n).padStart(2, "0");
  const d = { when: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:00`, h: 0, m: 30, km: 2, kmd: 0, mode: S.settings.lastMode };
  const body = document.createElement("div");
  body.className = "sheet-body";
  const calc = () => {
    const sec = (d.h * 60 + d.m) * 60, km = d.km + d.kmd / 100;
    const spd = sec ? km / (sec / 3600) : 0;
    const k = C.kcalPerMin(spd, gradeOf(d.mode), p.weight);
    return { sec, km, spd, kcal: (isNet(p) ? k.net : k.gross) * sec / 60 };
  };
  const draw = () => {
    const c = calc();
    body.innerHTML = `
      <h3 class="sheet-title">Cargar caminata</h3>
      <input class="field" type="datetime-local" id="mw" value="${d.when}">
      <div class="group" style="margin:0">
        <button class="row" data-f="dur"><span class="ri">${icon("clock", 18)}</span><span class="rl">Duración</span><span class="rv">${d.h ? d.h + " h " : ""}${d.m} min</span>${icon("chevR", 18, "chev")}</button>
        <button class="row" data-f="km"><span class="ri">${icon("route", 18)}</span><span class="rl">Distancia</span><span class="rv">${dec2(c.km)} km</span>${icon("chevR", 18, "chev")}</button>
      </div>
      ${UI.seg("mmode", [{ v: "flat", label: "PLANO" }, { v: "inc", label: "INCLINADA" }], d.mode, "big mode")}
      <div class="tiles">
        <div class="tile">${icon("gauge", 18, "c-acc")}<b class="num">${dec1(c.spd)}</b><span>km/h</span></div>
        <div class="tile">${icon("flame", 18, "c-k")}<b class="num">${int(c.kcal)}</b><span>${kcalWord(p)}</span></div>
        <div class="tile">${icon("steps", 18, "c-dist")}<b class="num">${int(C.steps(c.km, p.height))}</b><span>pasos</span></div>
      </div>
      <button class="btn btn-primary" data-save>Guardar</button>`;
    body.querySelector("#mw").onchange = e => d.when = e.target.value;
    body.querySelector('[data-f="dur"]').onclick = () => UI.pick({ title: "Duración", sep: ":", columns: [{ values: UI.range(0, 5), value: d.h, format: v => v + " h", width: "90px" }, { values: UI.range(0, 59), value: d.m, format: v => pad(v) + " min", width: "110px" }], onDone: ([h, m]) => { d.h = h; d.m = m; draw(); } });
    body.querySelector('[data-f="km"]').onclick = () => UI.pick({ title: "Distancia", sep: ",", unit: "km", columns: [{ values: UI.range(0, 30), value: d.km, width: "80px" }, { values: UI.range(0, 99), value: d.kmd, format: v => pad(v), width: "80px" }], onDone: ([a, b]) => { d.km = a; d.kmd = b; draw(); } });
    body.querySelector('[data-seg="mmode"]').onclick = e => { const b = e.target.closest("button"); if (b) { d.mode = b.dataset.v; haptic(6); draw(); } };
    body.querySelector("[data-save]").onclick = () => {
      const c2 = calc();
      if (c2.sec < 60 || c2.km <= 0) { UI.toast("Completá duración y distancia"); return; }
      const start = new Date(d.when).getTime() || Date.now();
      const segs = [];
      C.addToSegments(segs, Math.round(c2.spd * 10) / 10, gradeOf(d.mode), c2.sec, p.weight);
      segs[0].km = c2.km;
      const sess = { id: uid(), profileId: p.id, start, end: start + c2.sec * 1000, source: "manual", kg: p.weight, segs, samples: [], ...C.totals(segs) };
      S.sessions.push(sess); S.sessions.sort((a, b) => b.start - a.start); save.sessions();
      s.close(); haptic(15); render(); UI.toast("Caminata guardada");
    };
  };
  draw();
  const s = UI.sheet(body);
}

// ================= detalle / resumen =================
function openSession(s, fresh = false) {
  const p = byId(s.profileId);
  const avg = s.sec ? s.km / (s.sec / 3600) : 0;
  const incPct = s.sec ? Math.round((s.incSec || 0) / s.sec * 100) : 0;
  const kc = kcalOf(s, p);
  const other = isNet(p) ? `${int(s.gross)} totales` : `${int(s.net)} netas + ${int(s.gross - s.net)} reposo`;
  const segs = (s.segs || []).filter(g => g.sec >= 20);
  const samples = s.samples || [];
  const maxS = samples.length ? Math.max(...samples) : 0;
  const hits = s.hits || [];
  const rd = relDay(s.start);
  const title = fresh ? `¡Buen trabajo, ${esc(firstName(p))}!` : rd === "Hoy" || rd === "Ayer" ? rd : fmtDay(s.start, { weekday: "long", day: "numeric", month: "short" });
  const body = `
    <div class="sum">
      <div class="sum-top">
        ${fresh ? `<div class="sum-badge">${icon("check", 24)}</div>` : ""}
        <div class="grow"><h2>${title}</h2><p>${fmtDay(s.start, { weekday: "short", day: "numeric", month: "short" })} · ${fmtHour(s.start)}${s.planName ? " · " + esc(s.planName) : ""}${s.source === "manual" ? " · a mano" : ""}</p></div>
      </div>
      ${hits.length ? `<div class="sum-goal">${icon("trophy", 16)}Meta cumplida · ${hits.map(h => fmtGoal(h.goal)).join(" + ")}</div>` : ""}
      <div class="sum-hero">
        <div class="sh-k">${icon("flame", 20)}<b class="num" id="sk">0</b><span>${kcalWord(p)}</span><em>${other}</em></div>
        <div class="sh-s">
          <div>${icon("clock", 15, "c-time")}<b class="num">${C.fmtTime(s.sec)}</b></div>
          <div>${icon("route", 15, "c-dist")}<b class="num">${dec2(s.km)}<small>km</small></b></div>
          <div>${icon("gauge", 15, "c-acc")}<b class="num">${dec1(avg)}<small>km/h</small></b></div>
        </div>
      </div>
      <div class="sum-chips">
        <span><b class="num">${C.fmtPace(avg)}</b>min/km</span>
        <span><b class="num">${int(C.steps(s.km, p.height))}</b>pasos</span>
        <span><b class="num">${incPct}%</b>inclinada</span>
      </div>
      ${samples.length > 3 || segs.length > 1 ? `<div class="sum-chart">
        <div class="sc-h"><span>${samples.length > 3 ? `Velocidad · máx ${dec1(maxS)}` : "Tramos"}</span>${segs.length > 1 ? `<button data-tramos>${segs.length} tramos${icon("chevR", 14)}</button>` : ""}</div>
        ${samples.length > 3 ? `<div class="spd-chart sm">${UI.area(samples, { min: 0, max: Math.max(maxS * 1.15, 1), h: 70 })}</div>` : ""}
        <div class="segs-list" hidden>${segs.map(g => `<div class="sg"><i class="m ${g.grade > 0 ? "inc" : ""}"></i><div class="a num">${dec1(g.speed)} km/h<span>${g.grade > 0 ? "Inclinada" : "Plano"}</span></div><div class="b num">${C.fmtTime(g.sec)}<span>${int(isNet(p) ? g.net : g.gross)} kcal</span></div></div>`).join("")}</div>
      </div>` : ""}
      <div class="sum-act"><button class="btn btn-primary" data-close>${fresh ? "Listo" : "Cerrar"}</button><button class="icon-btn del" data-del aria-label="Eliminar caminata">${icon("trash", 20)}</button></div>
    </div>`;
  const sh = UI.sheet(body);
  setTimeout(() => UI.countUp(sh.el.querySelector("#sk"), kc, int, 1100), fresh ? 300 : 150);
  const tb = sh.el.querySelector("[data-tramos]");
  if (tb) tb.onclick = () => { const l = sh.el.querySelector(".segs-list"); l.hidden = !l.hidden; tb.classList.toggle("on", !l.hidden); haptic(6); };
  sh.el.querySelector("[data-del]").onclick = async () => {
    if (!(await UI.confirm({ title: "¿Eliminar esta caminata?", text: "No se puede deshacer.", ok: "Eliminar", danger: true }))) return;
    S.sessions = S.sessions.filter(x => x.id !== s.id); save.sessions(); sh.close(); render();
  };
}

// ================= planes =================
// plan: { id?, name, goal: {type: time|kcal|km|free, value}, base (km/h), mode, warm, steps: [{at (min), speed, mode|null}] }
const GOALS = [{ v: "time", label: "Tiempo" }, { v: "kcal", label: "Kcal" }, { v: "km", label: "Km" }, { v: "free", label: "Libre" }];
const GOAL_DEF = { time: 30, kcal: 300, km: 3, free: 0 };
const quickPlan = () => ({ name: "Rápida", quick: true, goal: { type: "time", value: S.settings.quickMin || 30 }, base: S.settings.lastSpeed || 5, mode: S.settings.lastMode || "flat", warm: true, steps: [] });
const fmtGoal = g => !g || g.type === "free" ? "Libre" : g.type === "time" ? `${g.value} min` : g.type === "km" ? `${dec1(g.value)} km` : `${int(g.value)} kcal`;
const suggestName = d => `${d.goal.type === "free" ? "Libre" : fmtGoal(d.goal)} a ${dec1(d.base)}`;
const speedCols = v => [{ values: UI.range(1, 12), value: Math.min(12, Math.max(1, Math.floor(v + 1e-6))), width: "70px" }, { values: UI.range(0, 9), value: Math.round(v * 10) % 10, width: "60px" }];
const speedOf = ([x, y]) => Math.min(12, Math.round((x + y / 10) * 10) / 10);

// Velocidad que pide el plan a los pt segundos: 2 km/h 5 s, sube hasta la base a los 10 s, después los cambios.
function planTarget(pr, pt) {
  if (pr.warm && pt < 5) return { key: "w", speed: 2, mode: null };
  if (pr.warm && pt < 10) { const v = Math.round((2 + (pr.base - 2) * (pt - 5) / 5) * 10) / 10; return { key: "r" + v, speed: v, mode: null }; }
  let r = { key: "b", speed: pr.base, mode: null };
  (pr.steps || []).forEach((st, i) => { if (pt >= st.at * 60) r = { key: "s" + i, speed: st.speed, mode: st.mode || null }; });
  return r;
}
function planNext(pr, pt) {
  if (pr.warm && pt < 10) return { in: 10 - pt, speed: pr.base, mode: null };
  const st = (pr.steps || []).find(s => s.at * 60 > pt);
  return st ? { in: st.at * 60 - pt, speed: st.speed, mode: st.mode } : null;
}
function planProgress(L) {
  const pr = L.prog;
  if (!pr || !pr.goal || pr.goal.type === "free") return null;
  const t = C.totals(L.segs), p = byId(L.profileId), g = pr.goal;
  const cur = Math.max(0, g.type === "time" ? ((L.run || 0) - pr.t0) / 60 : g.type === "km" ? liveKm(L, t) - pr.km0 : isNet(p) ? t.net - pr.net0 : t.gross - pr.gross0);
  return { cur, pct: Math.min(1, cur / g.value) };
}
function attachPlan(L, plan, cont = false) {
  const t = C.totals(L.segs);
  L.prog = {
    name: plan.name, quick: !!plan.quick, goal: plan.goal, base: plan.base, warm: !cont && plan.warm !== false,
    steps: (plan.steps || []).slice().sort((x, y) => x.at - y.at),
    t0: L.run || 0, km0: liveKm(L, t), net0: t.net, gross0: t.gross, key: null, done: false
  };
  if (plan.mode) L.mode = plan.mode;
  L.planNames = [...(L.planNames || []), plan.name];
  save.live();
}

// Simula el plan (cada 5 s) para la vista previa: duración, km y kcal estimadas.
function simulate(d, kg, net) {
  const pr = { ...d, steps: (d.steps || []).slice().sort((x, y) => x.at - y.at) };
  const g = d.goal || { type: "free" };
  const lastAt = pr.steps.length ? pr.steps[pr.steps.length - 1].at : 0;
  const freeEnd = Math.max(30, lastAt + 10) * 60;
  let t = 0, km = 0, kc = 0, mode = d.mode || "flat";
  const pts = [];
  while (t < 240 * 60) {
    const tg = planTarget(pr, t);
    if (tg.mode) mode = tg.mode;
    const r = C.kcalPerMin(tg.speed, gradeOf(mode), kg);
    kc += (net ? r.net : r.gross) * 5 / 60; km += tg.speed * 5 / 3600; t += 5;
    pts.push([t, tg.speed, mode]);
    if (g.type === "time" ? t >= g.value * 60 : g.type === "km" ? km >= g.value : g.type === "kcal" ? kc >= g.value : t >= freeEnd) break;
  }
  return { sec: t, km, kc, pts };
}
function planSvg(sim) {
  const W = 320, H = 80, T = sim.sec || 1;
  const maxV = Math.max(3, ...sim.pts.map(q => q[1])) * 1.12;
  const X = t => (t / T * W).toFixed(1), Y = v => (H - v / maxV * H).toFixed(1);
  const runs = []; let cur = null, pt = 0;
  sim.pts.forEach(([t, v, m]) => {
    if (!cur || cur.m !== m) { cur = { m, p: cur ? [cur.p[cur.p.length - 1].slice()] : [] }; runs.push(cur); }
    const last = cur.p[cur.p.length - 1];
    if (last && cur.p.length > 1 && last[1] === v) last[0] = t; else cur.p.push([pt, v], [t, v]);
    pt = t;
  });
  const parts = runs.map(r => {
    const line = r.p.map(([t, v]) => `${X(t)},${Y(v)}`).join(" ");
    const inc = r.m === "inc";
    return `<polygon points="${X(r.p[0][0])},${H} ${line} ${X(r.p[r.p.length - 1][0])},${H}" fill="url(#${inc ? "pgI" : "pgF"})"/><polyline points="${line}" fill="none" stroke="${inc ? "#FF5A8A" : "#C6FF3D"}" stroke-width="2.4" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
  }).join("");
  const grad = (id, c) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".32"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient>`;
  return `<svg class="pl-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs>${grad("pgF", "#C6FF3D")}${grad("pgI", "#FF3D71")}</defs>${parts}</svg>`;
}

// Hoja "Caminata a medida": meta, velocidad, arranque suave, cambios de ritmo, vista previa y planes guardados.
function planner({ cont = false, from = null } = {}) {
  const p = cont && S.live ? byId(S.live.profileId) : me();
  const fresh = () => ({ name: "", goal: { type: "time", value: S.settings.quickMin || 30 }, base: S.settings.lastSpeed || 5, mode: S.settings.lastMode || "flat", warm: true, steps: [] });
  let d = from ? JSON.parse(JSON.stringify(from)) : fresh();
  const gval = g => g.type === "time" ? `${g.value}` : g.type === "km" ? dec1(g.value) : int(g.value);
  const body = document.createElement("div");
  body.className = "sheet-body planner";
  const draw = () => {
    d.steps.sort((x, y) => x.at - y.at);
    const sim = simulate(d, p.weight, isNet(p));
    body.innerHTML = `
      <h3 class="sheet-title">${cont ? "Seguir con un plan" : "Caminata a medida"}</h3>
      ${S.plans.length ? `<div class="pl-saved">${d.id ? `<button class="pl-chip" data-load="">${icon("plus", 14)}Nuevo</button>` : ""}${S.plans.map(x => `<button class="pl-chip ${x.id === d.id ? "on" : ""}" data-load="${x.id}">${esc(x.name)}</button>`).join("")}</div>` : ""}
      <div class="pl-card">
        ${UI.seg("pgoal", GOALS, d.goal.type)}
        ${d.goal.type === "free" ? `<div class="pl-goal free"><span>Sin meta · frenás vos</span></div>` : `<button class="pl-goal" data-ed="goal"><b class="num">${gval(d.goal)}</b><span>${d.goal.type === "time" ? "min" : d.goal.type}</span></button>`}
      </div>
      <div class="group pl-group">
        <button class="row" data-ed="base"><span class="ri">${icon("gauge", 18)}</span><span class="rl">Velocidad</span><span class="rv">${dec1(d.base)} km/h</span>${icon("chevR", 18, "chev")}</button>
        ${cont ? "" : `<button class="row" data-ed="warm"><span class="ri">${icon("flame", 18)}</span><span class="rl">Arranque suave<small class="rs">2 km/h y sube en 10 s</small></span><span class="tog ${d.warm ? "on" : ""}"><i></i></span></button>`}
        <div class="row">${UI.seg("pmode", [{ v: "flat", label: "PLANO" }, { v: "inc", label: "INCLINADA" }], d.mode, "mode")}</div>
      </div>
      <div class="pl-sec">Cambios de ritmo</div>
      <div class="pl-steps">
        ${d.steps.map((st, i) => `<button class="pl-step" data-step="${i}"><span class="at num">${st.at}<small>min</small></span>${icon("chevR", 14, "arr")}<span class="sp num">${dec1(st.speed)}<small>km/h</small></span>${st.mode ? `<i class="md ${st.mode}">${st.mode === "inc" ? "INCLINADA" : "PLANO"}</i>` : ""}</button>`).join("")}
        <button class="pl-add" data-step="new">${icon("plus", 18)}${d.steps.length ? "Otro cambio" : "Agregar cambio"}</button>
      </div>
      <div class="pl-prev">
        ${planSvg(sim)}
        <div class="pl-est"><span>${icon("clock", 14, "c-time")}<b class="num">${C.fmtTime(sim.sec)}</b></span><span>${icon("route", 14, "c-dist")}<b class="num">${dec1(sim.km)}</b>km</span><span>${icon("flame", 14, "c-k")}<b class="num">${int(sim.kc)}</b>kcal</span></div>
      </div>
      <button class="btn btn-primary" data-go>${icon("play", 16)}${cont ? "Seguir" : "Empezar"}</button>
      <div class="pl-foot"><button class="btn btn-soft" data-save>${d.id ? "Guardar cambios" : "Guardar plan"}</button>${d.id ? `<button class="icon-btn del" data-del aria-label="Eliminar plan">${icon("trash", 18)}</button>` : ""}</div>`;
  };
  body.onclick = async e => {
    const sb = e.target.closest("[data-seg] button");
    if (sb) {
      const n = sb.parentElement.dataset.seg, v = sb.dataset.v;
      haptic(6);
      if (n === "pgoal" && v !== d.goal.type) d.goal = { type: v, value: GOAL_DEF[v] };
      if (n === "pmode") d.mode = v;
      UI.setSeg(sb.parentElement, v);
      setTimeout(draw, 200);
      return;
    }
    const ld = e.target.closest("[data-load]");
    if (ld) { const x = S.plans.find(q => q.id === ld.dataset.load); d = x ? JSON.parse(JSON.stringify(x)) : fresh(); haptic(6); return draw(); }
    const ed = e.target.closest("[data-ed]");
    if (ed) {
      const f = ed.dataset.ed, g = d.goal;
      if (f === "warm") { d.warm = !d.warm; haptic(6); return draw(); }
      if (f === "base") return UI.pick({ title: "Velocidad", sep: ",", unit: "km/h", columns: speedCols(d.base), onDone: v => { d.base = speedOf(v); draw(); } });
      if (g.type === "time") return UI.pick({ title: "Duración", unit: "min", columns: [{ values: UI.range(5, 180, 5), value: Math.round(g.value / 5) * 5 }], onDone: ([v]) => { g.value = v; draw(); } });
      if (g.type === "kcal") return UI.pick({ title: "Calorías", unit: "kcal", columns: [{ values: UI.range(50, 1500, 25), value: Math.round(g.value / 25) * 25, format: int, width: "120px" }], onDone: ([v]) => { g.value = v; draw(); } });
      return UI.pick({ title: "Distancia", sep: ",", unit: "km", columns: [{ values: UI.range(0, 20), value: Math.floor(g.value), width: "70px" }, { values: UI.range(0, 9), value: Math.round(g.value * 10) % 10, width: "60px" }], onDone: ([x, y]) => { g.value = Math.max(0.5, x + y / 10); draw(); } });
    }
    const sp = e.target.closest("[data-step]");
    if (sp) {
      const i = sp.dataset.step;
      if (i === "new") {
        const last = d.steps[d.steps.length - 1];
        return stepSheet({ at: last ? last.at + 5 : 5, speed: Math.min(12, (last ? last.speed : d.base) + 0.5), mode: null }, false, v => { d.steps.push(v); draw(); });
      }
      return stepSheet(d.steps[+i], true, v => { d.steps[+i] = v; draw(); }, () => { d.steps.splice(+i, 1); draw(); });
    }
    if (e.target.closest("[data-go]")) {
      haptic(15);
      const plan = { ...JSON.parse(JSON.stringify(d)), name: d.name || suggestName(d) };
      s.close();
      if (cont) continueWith(plan); else startFlow(plan);
      return;
    }
    if (e.target.closest("[data-save]")) return nameSheet(d.name || suggestName(d), name => {
      d.name = name;
      const k = d.id ? S.plans.findIndex(q => q.id === d.id) : -1;
      if (k >= 0) S.plans[k] = JSON.parse(JSON.stringify(d));
      else { d.id = uid(); S.plans.unshift(JSON.parse(JSON.stringify(d))); }
      save.plans(); haptic(12); UI.toast("Plan guardado"); draw();
    }, { title: "Nombre del plan", ph: "Ej: Quema 45" });
    if (e.target.closest("[data-del]")) {
      if (!(await UI.confirm({ title: `¿Eliminar "${d.name}"?`, ok: "Eliminar", danger: true }))) return;
      S.plans = S.plans.filter(q => q.id !== d.id); save.plans(); d = fresh(); draw();
    }
  };
  draw();
  const s = UI.sheet(body);
}

// Un cambio de ritmo: minuto + velocidad (ruedas) + PLANO / INCLINADA opcional.
function stepSheet(st, editing, done, del) {
  const [c1, c2] = speedCols(st.speed);
  const wm = UI.wheel({ values: UI.range(1, 180), index: Math.max(0, Math.min(179, st.at - 1)), width: "64px" });
  const wa = UI.wheel({ values: c1.values, index: c1.values.indexOf(c1.value), width: "56px" });
  const wb = UI.wheel({ values: c2.values, index: c2.values.indexOf(c2.value), width: "48px" });
  let mode = st.mode || "same";
  const body = document.createElement("div");
  body.className = "sheet-body";
  body.innerHTML = `<h3 class="sheet-title">${editing ? "Editar cambio" : "Nuevo cambio"}</h3>
    <div class="wheels st-wheels"><div class="wheel-band"></div><i class="slot"></i><div class="wheel-unit">min</div><i class="slot"></i><div class="wheel-sep">,</div><i class="slot"></i><div class="wheel-unit">km/h</div></div>
    ${UI.seg("smode", [{ v: "same", label: "Igual" }, { v: "flat", label: "PLANO" }, { v: "inc", label: "INCLINADA" }], mode, "mode3")}
    <button class="btn btn-primary" data-ok>Listo</button>
    ${editing ? `<button class="btn btn-ghost" data-rm style="color:var(--danger)">${icon("trash", 18)}Eliminar cambio</button>` : ""}`;
  const slots = body.querySelectorAll(".slot");
  [wm, wa, wb].forEach((w, i) => slots[i].replaceWith(w.el));
  body.querySelector('[data-seg="smode"]').onclick = e => { const b = e.target.closest("button"); if (!b) return; mode = b.dataset.v; haptic(6); UI.setSeg(b.parentElement, mode); };
  const s = UI.sheet(body);
  requestAnimationFrame(() => [wm, wa, wb].forEach(w => w.mount()));
  body.querySelector("[data-ok]").onclick = () => { haptic(10); done({ at: wm.value, speed: speedOf([wa.value, wb.value]), mode: mode === "same" ? null : mode }); s.close(); };
  if (editing) body.querySelector("[data-rm]").onclick = () => { del(); s.close(); };
}

// Motor del plan: corre en cada tick. Manda velocidad solo cuando cambia de fase (lo manual se respeta hasta el próximo cambio).
let planBusy = false;
function runPlan(L) {
  const pr = L.prog;
  if (!pr || pr.done || L.state !== "running" || !ble.connected) return;
  const pg = planProgress(L);
  if (pg && pg.pct >= 1) { pr.done = true; return goalReached(); }
  const tg = planTarget(pr, (L.run || 0) - pr.t0);
  if (tg.key === pr.key || planBusy) return;
  const prev = pr.key;
  pr.key = tg.key;
  planBusy = true;
  ble.setSpeed(tg.speed).catch(controlFailed).finally(() => { planBusy = false; });
  targetSpeed = tg.speed; targetAt = Date.now();
  const modeCh = tg.mode && tg.mode !== L.mode;
  if (modeCh) { L.mode = tg.mode; UI.setSeg($('[data-seg="lmode"]'), L.mode); }
  save.live();
  if (prev == null) return;
  let msg = tg.key[0] === "s" ? `${tg.speed >= (ble.liveSpeed() || 0) ? "▲" : "▼"} ${dec1(tg.speed)} km/h` : tg.key === "b" && prev[0] === "r" ? `A ritmo · ${dec1(tg.speed)} km/h` : "";
  if (modeCh) msg = `${icon(L.mode === "inc" ? "mountain" : "flat", 20)}${L.mode === "inc" ? "Subí las patitas" : "Bajá las patitas"}<small>${msg}</small>`;
  if (msg) cue(msg, modeCh);
}
function cue(html, hot) {
  const c = $("#L-cue");
  c.innerHTML = html;
  c.className = "cue on" + (hot ? " hot" : "");
  haptic(hot ? [40, 60, 40, 60, 40] : [30, 50, 30]);
  clearTimeout(cue.t);
  cue.t = setTimeout(() => { c.className = "cue" + (hot ? " hot" : ""); }, 3800);
}

// Meta cumplida: frena la cinta y ofrece terminar, seguir libre u otro plan.
function goalReached() {
  const L = S.live; if (!L) return;
  L.resumeSpd = ble.liveSpeed() || L.lastSpd || L.prog.base;
  L.state = "paused"; L.pauseZero = false;
  (L.hits = L.hits || []).push({ name: L.prog.name, goal: L.prog.goal });
  stopBelt();
  save.live(); updateLive();
  haptic([60, 80, 60, 80, 160]);
  goalSheet();
}
function goalSheet() {
  const L = S.live; if (!L) return;
  const p = byId(L.profileId), t = C.totals(L.segs);
  const s = UI.sheet(`<div class="sheet-body goal-hit">
    <div class="gh-badge">${icon("trophy", 34)}</div>
    <h3 class="sheet-title">¡Meta cumplida!</h3>
    <p class="gh-sub">${esc(L.prog.name)} · ${fmtGoal(L.prog.goal)}</p>
    <div class="gh-stats"><div><b class="num">${C.fmtTime(t.sec)}</b><span>tiempo</span></div><div><b class="num">${dec2(liveKm(L, t))}</b><span>km</span></div><div><b class="num">${int(isNet(p) ? t.net : t.gross)}</b><span>${kcalWord(p)}</span></div></div>
    <button class="btn btn-primary" data-a="end">${icon("check", 20)}Terminar y guardar</button>
    <div class="gh-more"><button class="btn btn-soft" data-a="free">${icon("play", 14)}Seguir libre</button><button class="btn btn-soft" data-a="plan">${icon("sliders", 18)}Otro plan</button></div>
  </div>`);
  s.el.addEventListener("click", e => {
    const b = e.target.closest("[data-a]"); if (!b) return;
    haptic(12); s.close();
    const a = b.dataset.a;
    if (a === "end") finishLive();
    if (a === "free") continueWith(null);
    if (a === "plan") setTimeout(() => planner({ cont: true }), 250);
  });
}
async function continueWith(plan) {
  const L = S.live; if (!L) return;
  const spd = L.resumeSpd;
  if (plan) { attachPlan(L, plan, true); UI.setSeg($('[data-seg="lmode"]'), L.mode); }
  else L.prog = null;
  await resumeWithCountdown();
  if (!plan && S.live && spd && ble.connected) ble.setSpeed(spd).catch(controlFailed);
}

// ================= sesión en vivo =================
let controlWarned = false;
let targetSpeed = null, targetAt = 0;

function buildLive() {
  $("#live").innerHTML = `
    <div class="live-in">
      <div class="cue" id="L-cue"></div>
      <div class="live-top">
        <button class="icon-btn" data-act="live-min" aria-label="Minimizar">${icon("chevL", 20)}</button>
        <span class="chip" id="L-chip"><i class="dot"></i><span>Conectada</span></span>
        <button class="icon-btn" data-act="live-discard" aria-label="Descartar">${icon("x", 20)}</button>
      </div>

      <div class="live-time"><div class="lbl">TIEMPO</div><b class="num" id="L-time">0:00</b><span class="state-tag" id="L-state">Listo</span></div>

      <div class="lplan" id="L-plan" hidden>
        <div class="lp-row"><span class="lp-name" id="L-pname"></span><span class="lp-val num" id="L-pval"></span></div>
        <div class="lp-bar"><i id="L-pfill"></i><span id="L-pmarks"></span></div>
        <div class="lp-next" id="L-pnext"></div>
      </div>

      <div class="live-mid">
        <div class="ring-box live-ring">${UI.ring({ pct: 0, size: 150, stroke: 13 })}
          <div class="ring-in">${icon("flame", 18)}<b class="num" id="L-kcal">0</b><span id="L-kw">kcal</span></div>
        </div>
        <div class="burn" id="L-burn">
          <span class="flame">${icon("flame", 22)}</span>
          <div class="lbl">Ritmo de quema</div>
          <div class="val"><b class="num" id="L-rate">0</b><span id="L-ru">kcal/h</span></div>
          <div class="units" id="L-units">${[["h", "/h"], ["min", "/min"], ["km", "/km"]].map(([v, l]) => `<button data-u="${v}">${l}</button>`).join("")}</div>
          <div class="meter"><div class="meter-fill" id="L-mfill"></div><div class="meter-knob" id="L-mknob"></div></div>
          <div class="tag" id="L-int">—</div>
        </div>
      </div>

      <div class="live-stats">
        <div><span class="lbl">Distancia</span><b class="num" id="L-km">0,00</b><span class="u">km</span></div>
        <div><span class="lbl">Velocidad</span><b class="num" id="L-spd">0,0</b><span class="u">km/h</span></div>
        <div><span class="lbl">Ritmo</span><b class="num" id="L-pace">--:--</b><span class="u">min/km</span></div>
      </div>

      ${UI.seg("lmode", [{ v: "flat", label: "PLANO" }, { v: "inc", label: "INCLINADA" }], "flat", "big mode")}

      <div class="speed-ctl" id="L-ctl">
        <button class="big" data-d="-0.5">−0.5</button>
        <button data-d="-0.1">−0.1</button>
        <div class="sv" id="L-target"><b class="num">0,0</b><span>KM/H</span></div>
        <button data-d="0.1">+0.1</button>
        <button class="big" data-d="0.5">+0.5</button>
      </div>

      <div class="live-actions">
        <div><button class="round pause" id="L-pause">${icon("pause", 28)}</button><div class="act-lbl" id="L-plbl">Pausa</div></div>
        <div><button class="round stop" id="L-stop">${icon("stop", 26)}<svg class="hold" viewBox="0 0 92 92"><circle cx="46" cy="46" r="44"/></svg></button><div class="act-lbl">Mantené</div></div>
      </div>
    </div>`;

  $('[data-seg="lmode"]').onclick = e => {
    const b = e.target.closest("button");
    if (!b || !S.live) return;
    S.live.mode = b.dataset.v; S.settings.lastMode = b.dataset.v;
    save.live(); save.settings(); haptic(12);
    UI.setSeg($('[data-seg="lmode"]'), b.dataset.v);
    updateLive();
  };
  $("#L-units").onclick = e => {
    const b = e.target.closest("button[data-u]");
    if (!b) return;
    S.settings.burn = b.dataset.u; save.settings(); haptic(6); updateLive();
  };
  $("#L-ctl").onclick = e => {
    const b = e.target.closest("button[data-d]");
    if (!b || !S.live) return;
    haptic(8);
    const base = targetSpeed != null && Date.now() - targetAt < 3000 ? targetSpeed : ble.liveSpeed() || 1;
    const t = Math.max(1, Math.min(12, Math.round((base + +b.dataset.d) * 10) / 10));
    targetSpeed = t; targetAt = Date.now();
    const L = S.live, pr = L.prog;
    if (pr && pr.warm && (L.run || 0) - pr.t0 < 10) { pr.warm = false; pr.key = planTarget(pr, (L.run || 0) - pr.t0).key; } // tocó durante el arranque suave
    S.settings.lastSpeed = t; save.settings();
    updateLive();
    ble.setSpeed(t).catch(controlFailed);
  };
  $("#L-pause").onclick = () => {
    const L = S.live; if (!L) return;
    haptic(15);
    if (L.state === "countdown") return;               // ya está arrancando
    if (L.state === "running") { L.state = "paused"; L.pauseZero = false; ble.pause().catch(controlFailed); save.live(); updateLive(); return; }
    resumeWithCountdown();
  };
  // mantener apretado para terminar
  const stop = $("#L-stop");
  let holdT = null;
  const cancel = () => { clearTimeout(holdT); stop.classList.remove("holding"); };
  stop.addEventListener("pointerdown", () => { stop.classList.add("holding"); haptic(10); holdT = setTimeout(() => { cancel(); haptic([20, 40, 30]); finishLive(); }, 900); });
  ["pointerup", "pointerleave", "pointercancel"].forEach(ev => stop.addEventListener(ev, cancel));
  stop.addEventListener("contextmenu", e => e.preventDefault());
}

function showLive() {
  const L = S.live; if (!L) return;
  UI.setSeg($('[data-seg="lmode"]'), L.mode);
  $("#live").classList.add("on");
  document.body.style.overflow = "hidden";
  keepAwake();
  updateLive();
}
function hideLive() { $("#live").classList.remove("on"); document.body.style.overflow = ""; render(); }

function updateLive() {
  const L = S.live;
  if (!L || !$("#live").classList.contains("on")) return;
  const p = byId(L.profileId);
  const t = C.totals(L.segs);
  const spd = ble.liveSpeed();
  const moving = L.state === "running" && spd > 0;
  const kc = isNet(p) ? t.net : t.gross;
  const rateK = C.kcalPerMin(spd, gradeOf(L.mode), L.kg);
  const rate = (isNet(p) ? rateK.net : rateK.gross) * 60;
  const maxRate = (isNet(p) ? C.kcalPerMin(6, incGrade(), L.kg).net : C.kcalPerMin(6, incGrade(), L.kg).gross) * 60;
  const pct = Math.min(1, rate / maxRate);

  const live = $("#live");
  live.classList.toggle("running", L.state === "running");
  live.classList.toggle("paused", L.state === "paused");
  live.classList.toggle("moving", moving);

  $("#L-time").textContent = C.fmtTime(t.sec);
  $("#L-kcal").textContent = int(kc);
  $("#L-kw").textContent = isNet(p) ? "kcal netas" : "kcal";
  $("#L-km").textContent = dec2(liveKm(L, t));
  $("#L-spd").textContent = dec1(spd);
  $("#L-pace").textContent = C.fmtPace(spd);
  const u = S.settings.burn || "h";
  const shown = !moving ? 0 : u === "min" ? rate / 60 : u === "km" ? rate / spd : rate;
  $("#L-rate").textContent = u === "min" ? dec1(shown) : int(shown);
  $("#L-ru").textContent = u === "min" ? "kcal/min" : u === "km" ? "kcal/km" : "kcal/h";
  $$("#L-units button").forEach(b => b.classList.toggle("on", b.dataset.u === u));
  $("#L-mfill").style.width = (moving ? pct * 100 : 0) + "%";
  $("#L-mknob").style.left = (moving ? pct * 100 : 0) + "%";
  $("#L-int").textContent = !moving ? "En espera" : pct < .35 ? "Suave" : pct < .65 ? "Moderado" : pct < .85 ? "Intenso" : "Máximo";
  $("#L-rate").style.color = moving && pct >= .65 ? "#FF7A5C" : "";
  UI.setRing($("#live .ring"), (weekKcal(p) + kc) / (p.goal || 2000));

  const stateTxt = L.state === "paused" ? "En pausa" : L.state === "countdown" ? "Arrancando" : !ble.connected ? "Reconectando" : spd > 0 ? "En marcha" : "Esperando la cinta";
  $("#L-state").textContent = stateTxt;
  const chip = $("#L-chip");
  chip.className = "chip " + (ble.connected ? "ok" : "warn");
  chip.lastElementChild.textContent = ble.connected ? ble.name : "Reconectando…";

  const pr = L.prog, pl = $("#L-plan");
  pl.hidden = !pr;
  live.classList.toggle("has-plan", !!pr);
  if (pr) {
    const pg = planProgress(L), pt = Math.max(0, (L.run || 0) - pr.t0), g = pr.goal;
    $("#L-pname").innerHTML = `${icon(pr.quick ? "bolt" : "sliders", 14)}<span>${esc(pr.name)}</span>`;
    $("#L-pval").textContent = pr.done ? "¡Meta cumplida!" : !pg ? C.fmtTime(pt)
      : g.type === "time" ? `${C.fmtTime(pt)} / ${C.fmtTime(g.value * 60)}` : g.type === "km" ? `${dec2(pg.cur)} / ${dec1(g.value)} km` : `${int(pg.cur)} / ${int(g.value)} kcal`;
    $("#L-pfill").style.width = (pr.done ? 100 : pg ? pg.pct * 100 : 0) + "%";
    pl.classList.toggle("done", !!pr.done);
    pl.classList.toggle("nogoal", !pg && !pr.done);
    const marks = g && g.type === "time" ? pr.steps.filter(s => s.at < g.value).map(s => `<b style="left:${(s.at / g.value * 100).toFixed(2)}%"></b>`).join("") : "";
    if (pl.dataset.m !== marks) { pl.dataset.m = marks; $("#L-pmarks").innerHTML = marks; }
    const nx = pr.done ? null : planNext(pr, pt);
    $("#L-pnext").innerHTML = nx ? `<span>${pr.warm && pt < 10 ? "Calentando" : "Próximo"}</span><b class="num">${dec1(nx.speed)} km/h</b>${nx.mode ? `<i class="md ${nx.mode}">${nx.mode === "inc" ? "INCLINADA" : "PLANO"}</i>` : ""}<em class="num">en ${C.fmtTime(nx.in)}</em>` : "";
  }

  const showTarget = targetSpeed != null && Date.now() - targetAt < 3000;
  const tg = $("#L-target");
  tg.classList.toggle("pending", showTarget);
  tg.firstElementChild.textContent = dec1(showTarget ? targetSpeed : spd);
  $$("#L-ctl button").forEach(b => b.disabled = L.state !== "running" || !ble.connected);

  const act = L.state !== "paused";               // corriendo o arrancando → muestra "Pausa"
  $("#L-pause").className = "round " + (act ? "pause" : "resume");
  $("#L-pause").innerHTML = icon(act ? "pause" : "play", 28);
  $("#L-plbl").textContent = act ? "Pausa" : "Seguir";
}

// Distancia: se usa el contador de la propia cinta (así coincide con su pantalla).
// Si la cinta no la manda, se calcula con velocidad × tiempo.
const liveKm = (L, t) => L.prevDist != null ? (L.cKm || 0) : t.km;

// Seguir: la cinta hace su propia cuenta 3-2-1, así que la app la acompaña.
async function resumeWithCountdown() {
  const L = S.live; if (!L) return;
  L.state = "countdown"; save.live(); updateLive();
  ble.start().catch(controlFailed);
  await countdown();
  if (S.live && S.live.state === "countdown") { S.live.state = "running"; save.live(); }
  if (S.live && S.live.prog) S.live.prog.key = null;   // al seguir, el plan vuelve a mandar su velocidad
  updateLive();
}

function controlFailed() {
  if (controlWarned) return;
  controlWarned = true;
  UI.toast("La cinta no tomó el comando. Usá el control remoto.");
}

// Empezar: conecta (si hace falta), arranca la cinta y cuenta 3-2-1 junto con ella.
async function startFlow(plan) {
  const p = me();
  if (!p) return;
  if (S.live) return showLive();
  if (!ble.connected) {
    const ok = await connectFlow(true);
    if (!ok) return;
  }
  createLive(p, "countdown");
  if (plan) attachPlan(S.live, plan);
  ble.start().catch(controlFailed);   // sin demoras: la cinta empieza su cuenta ya
  showLive();
  await countdown();
  if (S.live && S.live.state === "countdown") { S.live.state = "running"; save.live(); }
  updateLive();
}
function createLive(p, state) {
  controlWarned = false;
  S.live = { id: uid(), profileId: p.id, start: Date.now(), mode: S.settings.lastMode || "flat", state, kg: p.weight, segs: [], samples: [], acc: 0, run: 0 };
  save.live();
}

async function connectFlow(forStart) {
  const ov = $("#overlay");
  ov.innerHTML = `<div class="conn"><div class="conn-ic">${icon("bt", 40)}</div><b>Conectando con la cinta</b><span>Prendela y dejala cerca</span></div>`;
  ov.classList.add("on");
  try {
    let ok = false;
    if (await ble.hasKnown()) ok = await ble.reconnectKnown();
    if (!ok) await ble.pick();
    haptic(20);
    return true;
  } catch (e) {
    if (e && e.name === "NotFoundError") return false; // canceló el selector
    UI.toast(e && e.name === "SecurityError" ? "Tocá de nuevo para conectar" : (e && e.message) || "No se pudo conectar");
    return false;
  } finally {
    ov.classList.remove("on");
  }
}

function countdown() {
  const ov = $("#overlay");
  ov.classList.add("on");
  return new Promise(res => {
    let n = 3;
    const step = () => {
      if (n === 0) {
        ov.innerHTML = `<div class="cd-num go pop">¡Vamos!</div>`;
        haptic(60);
        setTimeout(() => { ov.classList.remove("on"); res(); }, 650);
        return;
      }
      ov.innerHTML = `<div class="cd-ring"></div><div class="cd-num pop num">${n}</div>`;
      haptic(25);
      n--;
      setTimeout(step, 1000);
    };
    step();
  });
}

function stopBelt() {
  if (!ble.connected) return;
  ble.stop().catch(() => UI.toast("La cinta no frenó desde la app. Frenala con el control."));
}
async function finishLive() {
  const L = S.live; if (!L) return;
  const t = C.totals(L.segs);
  t.km = liveKm(L, t);
  autoArmed = false;                      // la cinta sigue frenando: no arrancar otra caminata sola
  stopBelt();
  S.live = null; save.live();
  releaseAwake();
  hideLive();
  if (t.sec < 20) { UI.toast("Fue muy corta, no se guardó"); return; }
  const s = { id: L.id, profileId: L.profileId, start: L.start, end: Date.now(), source: "ble", kg: L.kg, pct: S.settings.pct, segs: L.segs, samples: L.samples, ...t };
  const names = [...new Set(L.planNames || [])];
  if (names.length) s.planName = names.join(" + ");
  if (L.hits && L.hits.length) s.hits = L.hits;
  S.sessions.unshift(s); save.sessions();
  render();
  setTimeout(() => openSession(s, true), 350);
}
async function discardLive() {
  if (!(await UI.confirm({ title: "¿Descartar la caminata?", text: "No se va a guardar nada.", ok: "Descartar", danger: true }))) return;
  autoArmed = false; stopBelt();
  S.live = null; save.live(); releaseAwake(); hideLive();
}

// Motor: cada segundo suma lo recorrido a la velocidad real de la cinta.
let lastTick = Date.now(), lastSave = 0;
function tick() {
  const now = Date.now();
  let dt = (now - lastTick) / 1000;
  lastTick = now;
  if (dt > 3) dt = 0;   // la página estuvo congelada: el hueco lo recupera el contador de la cinta
  const L = S.live;
  if (!L) return;
  const spd = ble.liveSpeed();
  if (L.state === "running" && spd > 0) {
    C.addToSegments(L.segs, spd, gradeOf(L.mode), dt, L.kg);
    L.acc += dt;
    while (L.acc >= 5) { L.acc -= 5; L.samples.push(spd); }
    L.run = (L.run || 0) + dt;
  }
  runPlan(L);
  if (now - lastSave > 4000) { save.live(); lastSave = now; }
  updateLive();
}

// Si la cinta arranca con el control remoto, la sesión empieza sola.
// Solo si antes estuvo quieta 4 s (después de terminar, la cinta tarda en frenar).
let autoArmed = true, zeroSince = 0;
ble.addEventListener("data", e => {
  const { speed, dist } = e.detail;
  if (speed > 0) zeroSince = 0;
  else { zeroSince = zeroSince || Date.now(); if (Date.now() - zeroSince > 4000) autoArmed = true; }

  const L = S.live;
  if (L && dist != null) {
    const now = Date.now();
    const gap = L.lastDataAt ? (now - L.lastDataAt) / 1000 : 0;
    if (L.prevDist != null) {
      let d = dist - L.prevDist;
      if (d < 0) d = dist;                          // la cinta reinició su contador
      if (L.state !== "paused" && d > 0 && d < 300) L.cKm = (L.cKm || 0) + d / 1000;
      // Celu bloqueado: la página se congeló pero la cinta siguió contando.
      // Se recupera el hueco con la distancia que hizo y la última velocidad conocida.
      else if (L.state === "running" && gap > 8 && d >= 300 && d < 50000) {
        const km = d / 1000;
        const v = L.lastSpd > 0.5 ? L.lastSpd : speed > 0.5 ? speed : 4;
        const sec = Math.min(gap, km / v * 3600);
        C.addToSegments(L.segs, v, gradeOf(L.mode), sec, L.kg);
        L.cKm = (L.cKm || 0) + km;
        L.run = (L.run || 0) + sec;
        for (let a = (L.acc || 0) + sec; a >= 5; a -= 5) L.samples.push(v);
        save.live();
        setTimeout(() => UI.toast(`Recuperado: ${C.fmtTime(sec)} con el celu bloqueado`), 400);
      }
    }
    L.prevDist = dist;
    L.lastDataAt = now;
    if (speed > 0) L.lastSpd = speed;
  }

  if (!S.live && speed > 0 && autoArmed && me()) {
    createLive(me(), "running");
    showLive();
    UI.toast("Caminata iniciada desde la cinta");
  } else if (S.live && S.live.state === "countdown" && speed > 0) {
    S.live.state = "running";
  } else if (S.live && S.live.state === "paused") {
    // tras pausar, la cinta frena despacio: recién cuando estuvo quieta 2 s, un arranque cuenta como "seguir"
    if (speed === 0 && zeroSince && Date.now() - zeroSince > 2000) S.live.pauseZero = true;
    if (speed > 0 && S.live.pauseZero) { S.live.state = "running"; save.live(); UI.toast("Seguimos"); updateLive(); }
  }
});
ble.addEventListener("state", refreshDevice);

// ================= pantalla encendida =================
let wake = null;
async function keepAwake() { try { if ("wakeLock" in navigator && !wake) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => wake = null); } } catch (e) {} }
function releaseAwake() { try { wake && wake.release(); } catch (e) {} wake = null; }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && S.live) keepAwake(); });

// ================= backup =================
function exportData() {
  const blob = new Blob([JSON.stringify({ app: "paso", v: 2, profiles: S.profiles, sessions: S.sessions, settings: S.settings }, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `paso-copia-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  UI.toast("Copia exportada");
}
function importData() {
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = "application/json,.json";
  inp.onchange = async () => {
    try {
      const d = JSON.parse(await inp.files[0].text());
      const pids = new Set(S.profiles.map(p => p.id)), sids = new Set(S.sessions.map(s => s.id));
      const np = (d.profiles || []).filter(p => !pids.has(p.id));
      const ns = (d.sessions || []).filter(s => !sids.has(s.id));
      S.profiles.push(...np); S.sessions.push(...ns);
      S.sessions.sort((a, b) => b.start - a.start);
      if (!S.activeId && S.profiles[0]) S.activeId = S.profiles[0].id;
      save.profiles(); save.sessions(); save.active(); render();
      UI.toast(`Importado: ${np.length} perfiles, ${ns.length} caminatas`);
    } catch (e) { UI.toast("El archivo no es válido"); }
  };
  inp.click();
}
async function deleteProfile() {
  const p = me();
  const n = sessionsOf(p).length;
  if (!(await UI.confirm({ title: `¿Eliminar a ${p.name}?`, text: n ? `También se borran sus ${n} caminatas.` : "", ok: "Eliminar", danger: true }))) return;
  S.profiles = S.profiles.filter(x => x.id !== p.id);
  S.sessions = S.sessions.filter(s => s.profileId !== p.id);
  S.activeId = S.profiles[0] ? S.profiles[0].id : null;
  save.profiles(); save.sessions(); save.active();
  view.tab = "home"; render();
}

// ================= eventos =================
document.addEventListener("click", e => {
  const tab = e.target.closest("[data-tab]");
  if (tab) return go(tab.dataset.tab);
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const a = el.dataset.act;
  const acts = {
    "start": () => startFlow(S.live ? null : quickPlan()),
    "plan": () => planner(),
    "new-profile": newProfile,
    "switch": switchSheet,
    "device": deviceSheet,
    "field": () => editField(el.dataset.f),
    "color": () => { me().color = el.dataset.v; save.profiles(); haptic(6); render(); },
    "session": () => { const s = S.sessions.find(x => x.id == el.dataset.id); if (s) openSession(s); },
    "add-manual": manualSheet,
    "prev": () => { view.offset--; view.sel = -1; render(); },
    "next": () => { if (view.offset < 0) { view.offset++; view.sel = -1; render(); } },
    "metric": () => { view.metric = el.dataset.v; haptic(5); render(); },
    "export": exportData,
    "import": importData,
    "delete-profile": deleteProfile,
    "update": () => checkUpdate(true),
    "diag": diagSheet,
    "weigh": () => PICK.weight(me(), ch => { logWeight(me(), ch.weight); me().weight = ch.weight; save.profiles(); render(); UI.toast("Peso guardado"); }),
    "weigh-later": () => { me().weightSnooze = Date.now() + 864e5; save.profiles(); render(); },
    "live-min": hideLive,
    "live-discard": discardLive
  };
  acts[a] && acts[a]();
});
// segmentados y barras de progreso/perfil
document.addEventListener("click", e => {
  const segBtn = e.target.closest(".screen [data-seg] button");
  if (segBtn) {
    const name = segBtn.parentElement.dataset.seg, v = segBtn.dataset.v;
    haptic(6);
    if (name === "period") { view.period = v; view.offset = 0; view.sel = -1; UI.setSeg(segBtn.parentElement, v); setTimeout(render, 180); }
    if (name === "kcalmode") { me().kcalMode = v; save.profiles(); UI.setSeg(segBtn.parentElement, v); setTimeout(render, 200); }
  }
  const bar = e.target.closest(".screen .bar");
  if (bar) { view.sel = +bar.dataset.i; haptic(4); $$(".screen .bar").forEach(b => b.classList.toggle("on", b === bar)); }
});

// ================= versión =================
const VERSION = "1.5";
(() => {
  const prev = store.get("version", null);
  store.set("version", VERSION);
  if (prev && prev !== VERSION) setTimeout(() => UI.toast(`App actualizada a la versión ${VERSION}`), 900);
})();

async function checkUpdate(manual) {
  try {
    if (manual) UI.toast("Buscando actualizaciones…");
    const r = await fetch("version.json?t=" + Date.now(), { cache: "no-store" });
    const { version } = await r.json();
    if (version && version !== VERSION) {
      if (!manual && sessionStorage.getItem("paso.reloaded") === version) return; // evita recargar en bucle
      sessionStorage.setItem("paso.reloaded", version);
      if (S.live) { if (manual) UI.toast("Terminá la caminata para actualizar"); return; }
      UI.toast(`Actualizando a la versión ${version}…`);
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      if (reg) await reg.update().catch(() => {});
      setTimeout(() => location.reload(), 900);
    } else if (manual) UI.toast("Ya tenés la última versión");
  } catch (e) { if (manual) UI.toast("Sin conexión"); }
}

function diagSheet() {
  const logs = ble.logs.length ? ble.logs.slice().reverse().join("\n") : "Todavía no hay registros. Conectate a la cinta y usá los botones.";
  const s = UI.sheet(`<div class="sheet-body"><h3 class="sheet-title">Diagnóstico de la cinta</h3>
    <pre class="diag">${esc(logs)}</pre>
    <button class="btn btn-primary" data-copy>Copiar</button><button class="btn btn-ghost" data-close>Cerrar</button></div>`);
  s.el.querySelector("[data-copy]").onclick = async () => {
    try { await navigator.clipboard.writeText(ble.logs.join("\n")); UI.toast("Copiado"); } catch (e) { UI.toast("No se pudo copiar"); }
  };
}

// ================= arranque =================
buildLive();
render();
if (S.live) {
  if (S.live.state !== "paused") S.live.state = "paused"; // tras recargar queda en pausa
  showLive();
}
setInterval(tick, 1000);
setTimeout(() => checkUpdate(false), 1500);
// Si Chrome ya conoce la cinta, conectarse en silencio
ble.hasKnown().then(k => { if (k) ble.reconnectKnown(); });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
