// Conexión con la cinta por Web Bluetooth (FTMS).
// Eventos: "state" (off | connecting | on), "data" ({speed, dist}).
class Treadmill extends EventTarget {
  constructor() {
    super();
    this.state = "off";
    this.device = null;
    this.cp = null;          // Control Point
    this.control = false;    // ya pedimos control
    this.speed = 0;
    this.dist = 0;
    this.lastAt = 0;
    this.want = false;       // queremos seguir conectados (reconexión automática)
    this.pending = null;
    this.retry = null;
    this.logs = [];          // diagnóstico: últimos comandos y respuestas
  }

  log(msg) {
    const t = new Date().toLocaleTimeString("es-AR", { hour12: false });
    this.logs.push(`${t}  ${msg}`);
    if (this.logs.length > 80) this.logs.shift();
  }

  get supported() { return !!navigator.bluetooth; }
  get connected() { return this.state === "on"; }
  get name() { return this.device ? this.device.name || "Cinta" : "Cinta"; }

  // Velocidad actual; 0 si hace más de 4 s que no llega nada.
  liveSpeed() { return this.connected && Date.now() - this.lastAt < 4000 ? this.speed : 0; }

  async pick() {
    if (!this.supported) throw new Error("Este navegador no tiene Bluetooth. Abrí la app en Chrome para Android.");
    const d = await navigator.bluetooth.requestDevice({
      filters: [{ services: [0x1826] }, { namePrefix: "FS-" }],
      optionalServices: [0x1826]
    });
    this.use(d);
    await this.connect();
  }

  // Reconecta sin pedir permiso de nuevo si Chrome ya recuerda la cinta.
  async reconnectKnown() {
    try {
      if (!navigator.bluetooth || !navigator.bluetooth.getDevices) return false;
      const list = await navigator.bluetooth.getDevices();
      const d = list.find(x => (x.name || "").startsWith("FS-")) || list[0];
      if (!d) return false;
      this.use(d);
      await Promise.race([
        this.connect(),
        new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 7000))
      ]);
      return true;
    } catch (e) {
      this.want = false;
      this.set("off");
      return false;
    }
  }

  // true si Chrome ya recuerda una cinta (para no pedir permiso otra vez)
  async hasKnown() {
    try { return !!(navigator.bluetooth && navigator.bluetooth.getDevices && (await navigator.bluetooth.getDevices()).length); }
    catch (e) { return false; }
  }

  use(d) {
    if (this.device === d) return;
    this.device = d;
    d.addEventListener("gattserverdisconnected", () => this.drop());
  }

  async connect() {
    this.want = true;
    this.set("connecting");
    const server = await this.device.gatt.connect();
    const svc = await server.getPrimaryService(0x1826);
    const td = await svc.getCharacteristic(0x2acd);
    td.addEventListener("characteristicvaluechanged", e => this.onData(e.target.value));
    await td.startNotifications();
    try {
      this.cp = await svc.getCharacteristic(0x2ad9);
      this.cp.addEventListener("characteristicvaluechanged", e => this.onControl(e.target.value));
      await this.cp.startNotifications();
    } catch (e) { this.cp = null; }
    this.control = false;
    this.speed = 0;
    this.lastAt = Date.now();
    this.log(`Conectada a ${this.name}${this.cp ? "" : " (sin control de comandos)"}`);
    this.set("on");
  }

  onData(dv) {
    const r = CintaCore.parseTreadmillData(dv);
    if (!r || r.speed === undefined) return;
    this.speed = Math.round(r.speed * 10) / 10;
    if (r.dist !== undefined) this.dist = r.dist;
    if (!this._lastLogged || Date.now() - this._lastLogged > 15000) { this._lastLogged = Date.now(); this.log(`Datos: ${this.speed} km/h · ${this.dist} m`); }
    this.lastAt = Date.now();
    this.dispatchEvent(new CustomEvent("data", { detail: { speed: this.speed, dist: this.dist } }));
  }

  // Respuesta del Control Point: 0x80, opcode, resultado (1 = OK)
  onControl(dv) {
    if (dv.byteLength < 3 || dv.getUint8(0) !== 0x80 || !this.pending) return;
    if (dv.getUint8(1) !== this.pending.op) return;
    const p = this.pending; this.pending = null;
    const code = dv.getUint8(2);
    const names = { 1: "OK", 2: "no soportado", 3: "valor inválido", 4: "falló", 5: "sin control" };
    this.log(`← respuesta ${hex(dv)} (${names[code] || code})`);
    if (code === 1) p.ok();
    else { const e = new Error("La cinta rechazó el comando"); e.code = code; p.fail(e); }
  }

  command(bytes) {
    if (!this.cp) return Promise.reject(new Error("La cinta no acepta comandos"));
    return new Promise((ok, fail) => {
      const timer = setTimeout(() => { this.pending = null; fail(new Error("La cinta no respondió")); }, 2500);
      this.pending = {
        op: bytes[0],
        ok: () => { clearTimeout(timer); ok(); },
        fail: e => { clearTimeout(timer); fail(e); }
      };
      const data = new Uint8Array(bytes);
      this.log(`→ comando ${hex(data)}`);
      const w = this.cp.writeValueWithResponse ? this.cp.writeValueWithResponse(data) : this.cp.writeValue(data);
      w.catch(e => { clearTimeout(timer); this.pending = null; this.log(`✗ error al escribir: ${e.message}`); fail(e); });
    });
  }

  async ensureControl() { if (!this.control) { await this.command(CintaCore.CMD.requestControl()); this.control = true; } }

  // Manda un comando; si la cinta dice "sin control" (o no responde), pide control de nuevo y reintenta una vez.
  async send(bytes) {
    await this.ensureControl();
    try { await this.command(bytes); }
    catch (e) {
      this.control = false;
      await this.ensureControl();
      await this.command(bytes);
    }
  }
  start() { return this.send(CintaCore.CMD.start()); }
  pause() { return this.send(CintaCore.CMD.pause()); }
  setSpeed(kmh) { return this.send(CintaCore.CMD.speed(kmh)); }

  // Frenar: stop. La cinta desacelera despacio, así que se considera "frenando" si la velocidad baja.
  // Si a los 5 s no bajó nada, prueba pausa y después velocidad 0.
  async stop() {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const v0 = this.liveSpeed();
    const braking = () => this.liveSpeed() === 0 || this.liveSpeed() < v0 - 0.3;
    try { await this.send(CintaCore.CMD.stop()); } catch (e) {}
    if (v0 === 0) return true;
    await wait(5000);
    if (braking()) return true;
    this.log("No frena: pruebo pausa");
    try { await this.send(CintaCore.CMD.pause()); } catch (e) {}
    await wait(5000);
    if (braking()) return true;
    this.log("No frena: pruebo velocidad 0");
    try { await this.send(CintaCore.CMD.speed(0)); } catch (e) {}
    await wait(5000);
    if (!braking()) { this.log("✗ La cinta no frenó con ningún comando"); throw new Error("no frenó"); }
    return true;
  }

  drop() {
    this.cp = null; this.control = false; this.speed = 0;
    clearTimeout(this.retry);
    if (!this.want || !this.device) return this.set("off");
    this.set("connecting");
    this.retry = setTimeout(() => this.connect().catch(() => this.drop()), 3000);
  }

  disconnect() {
    this.want = false;
    clearTimeout(this.retry);
    if (this.device && this.device.gatt.connected) this.device.gatt.disconnect();
    this.set("off");
  }

  set(s) { if (this.state !== s) { this.state = s; this.dispatchEvent(new Event("state")); } }
}

function hex(data) {
  const a = data instanceof DataView ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : data;
  return [...a].map(x => x.toString(16).padStart(2, "0").toUpperCase()).join("-");
}
