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
    this.set("on");
  }

  onData(dv) {
    const r = CintaCore.parseTreadmillData(dv);
    if (!r || r.speed === undefined) return;
    this.speed = Math.round(r.speed * 10) / 10;
    if (r.dist !== undefined) this.dist = r.dist;
    this.lastAt = Date.now();
    this.dispatchEvent(new CustomEvent("data", { detail: { speed: this.speed, dist: this.dist } }));
  }

  // Respuesta del Control Point: 0x80, opcode, resultado (1 = OK)
  onControl(dv) {
    if (dv.byteLength < 3 || dv.getUint8(0) !== 0x80 || !this.pending) return;
    if (dv.getUint8(1) !== this.pending.op) return;
    const p = this.pending; this.pending = null;
    dv.getUint8(2) === 1 ? p.ok() : p.fail(new Error("La cinta rechazó el comando"));
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
      const w = this.cp.writeValueWithResponse ? this.cp.writeValueWithResponse(data) : this.cp.writeValue(data);
      w.catch(e => { clearTimeout(timer); this.pending = null; fail(e); });
    });
  }

  async ensureControl() { if (!this.control) { await this.command(CintaCore.CMD.requestControl()); this.control = true; } }
  async start() { await this.ensureControl(); await this.command(CintaCore.CMD.start()); }
  async pause() { await this.ensureControl(); await this.command(CintaCore.CMD.pause()); }
  async stop() { await this.ensureControl(); await this.command(CintaCore.CMD.stop()); }
  async setSpeed(kmh) { await this.ensureControl(); await this.command(CintaCore.CMD.speed(kmh)); }

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
