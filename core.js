// Lógica pura (sin DOM): protocolo FTMS, fórmula ACSM, tramos y estadísticas.
// Se usa en el navegador (window.CintaCore) y en los tests de Node (require).
(function (root) {
  "use strict";

  // ---------- FTMS ----------
  // Treadmill Data (0x2ACD), little-endian. Bit 0 en 1 = NO viene velocidad.
  // La cinta FS-xxxx manda dos paquetes por segundo: 8C-05-... (con datos) y 01-20-... (vacío, se ignora).
  // Después de la inclinación esta cinta corre 1 byte los campos (energía/pulso/tiempo): no se usan.
  function parseTreadmillData(dv) {
    try {
      const f = dv.getUint16(0, true);
      let o = 2;
      const r = { flags: f };
      if (!(f & 0x0001)) { r.speed = dv.getUint16(o, true) / 100; o += 2; }
      if (f & 0x0002) o += 2;
      if (f & 0x0004) { r.dist = dv.getUint16(o, true) | (dv.getUint8(o + 2) << 16); o += 3; }
      if (f & 0x0008) { r.incl = dv.getInt16(o, true) / 10; o += 4; }
      return r;
    } catch (e) { return null; }
  }

  // Fitness Machine Control Point (0x2AD9)
  const CMD = {
    requestControl: () => [0x00],
    start: () => [0x07],
    stop: () => [0x08, 0x01],
    pause: () => [0x08, 0x02],
    speed: kmh => { const v = Math.round(kmh * 100); return [0x02, v & 0xff, (v >> 8) & 0xff]; }
  };

  // ---------- energía ----------
  const gradeFromDeg = deg => Math.tan(deg * Math.PI / 180);

  // ACSM caminata. speed km/h, grade decimal → kcal/min netas y totales (con reposo).
  function kcalPerMin(speed, grade, kg) {
    if (!(speed > 0)) return { net: 0, gross: 0 };
    const v = speed * 1000 / 60;
    const net = (0.1 * v + 1.8 * v * grade) * kg / 1000 * 5;
    return { net, gross: net + 3.5 * kg / 1000 * 5 };
  }

  // Suma dt segundos. Cambio de velocidad o pendiente = tramo nuevo.
  function addToSegments(segs, speed, grade, dt, kg) {
    let s = segs[segs.length - 1];
    if (!s || s.speed !== speed || Math.abs(s.grade - grade) > 1e-9) {
      s = { speed, grade, sec: 0, km: 0, net: 0, gross: 0 };
      segs.push(s);
    }
    const k = kcalPerMin(speed, grade, kg);
    s.sec += dt;
    s.km += speed * dt / 3600;
    s.net += k.net * dt / 60;
    s.gross += k.gross * dt / 60;
    return s;
  }

  function totals(segs) {
    const t = { sec: 0, km: 0, net: 0, gross: 0, incSec: 0 };
    for (const s of segs) {
      t.sec += s.sec; t.km += s.km; t.net += s.net; t.gross += s.gross;
      if (s.grade > 0) t.incSec += s.sec;
    }
    return t;
  }

  // ---------- cuerpo ----------
  const strideM = heightCm => (heightCm || 170) * 0.415 / 100;
  const steps = (km, heightCm) => km * 1000 / strideM(heightCm);
  const bmi = (kg, cm) => cm ? kg / Math.pow(cm / 100, 2) : 0;
  function bmiLabel(b) {
    if (!b) return "";
    if (b < 18.5) return "Bajo peso";
    if (b < 25) return "Saludable";
    if (b < 30) return "Sobrepeso";
    return "Obesidad";
  }

  // ---------- tiempo ----------
  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  }
  function fmtPace(kmh) {
    if (!(kmh > 0.5)) return "--:--";
    const sec = Math.round(3600 / kmh);
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  }
  const dayStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  function weekStart(d) { const x = dayStart(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const dayKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

  // Días seguidos con actividad, terminando hoy (o ayer si hoy todavía no caminó).
  function streak(sessions, now = new Date()) {
    const days = new Set(sessions.map(s => dayKey(s.start)));
    let d = dayStart(now);
    if (!days.has(dayKey(d))) d = addDays(d, -1);
    let n = 0;
    while (days.has(dayKey(d))) { n++; d = addDays(d, -1); }
    return n;
  }

  // Valores por bucket. bucket: "day" | "month". valueOf(session) → número.
  function buckets(sessions, from, n, bucket, valueOf) {
    const out = new Array(n).fill(0);
    for (const s of sessions) {
      const d = new Date(s.start);
      let i;
      if (bucket === "day") i = Math.round((dayStart(d) - from) / 864e5);
      else i = (d.getFullYear() - from.getFullYear()) * 12 + d.getMonth() - from.getMonth();
      if (i >= 0 && i < n) out[i] += valueOf(s);
    }
    return out;
  }

  const api = {
    parseTreadmillData, CMD, gradeFromDeg, kcalPerMin, addToSegments, totals,
    strideM, steps, bmi, bmiLabel, fmtTime, fmtPace, dayStart, weekStart, addDays, dayKey, streak, buckets
  };
  if (typeof module !== "undefined") module.exports = api; else root.CintaCore = api;
})(this);
