/* ==========================================================
   OCEAN LUX — motor de áudio procedural (Web Audio API)
   Tudo sintetizado em tempo real: nenhum arquivo de som externo.
   API global: window.BoatAudio
   ========================================================== */
(() => {
  "use strict";

  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) {
    window.BoatAudio = new Proxy({}, { get: () => () => {} });
    return;
  }

  // ---------------------------------------------------------
  // Estado geral
  // ---------------------------------------------------------
  const VOL = 0.85;
  let ctx = null;
  let master, comp, bus, revIn, musicIn, musicBus;
  let muted = false;
  try { muted = localStorage.getItem("oceanlux-muted") === "1"; } catch (e) {}

  const nb = {};                 // buffers de ruído
  const engines = [];            // motores (0 = jogador)
  let amb = null;                // sons de ambiente contínuos
  let crowdBoost = 0;
  let gullTimer = 8;
  let slapAcc = 0, bubAcc = 0;
  let musicOn = false, musicNext = 0, musicStep = 0, musicChord = 0;
  const lastT = {};              // limitador de eventos repetidos

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function limited(key, gap) {
    const t = performance.now();
    if (lastT[key] && t - lastT[key] < gap) return false;
    lastT[key] = t;
    return true;
  }

  function ready() {
    return ctx && ctx.state === "running";
  }

  // ---------------------------------------------------------
  // Inicialização (precisa de um gesto do usuário)
  // ---------------------------------------------------------
  function mkNoise(kind, secs) {
    const len = Math.floor(ctx.sampleRate * secs);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);

    if (kind === "white") {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } else if (kind === "pink") {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else {
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    return buf;
  }

  // Resposta ao impulso: salão de piscina (reverb longo e brilhante)
  function makeIR(dur, decay) {
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * dur);
    const b = ctx.createBuffer(2, len, sr);
    const pre = Math.floor(sr * 0.012);

    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const w = Math.random() * 2 - 1;
        lp += (w - lp) * (0.85 - 0.72 * t);
        d[i] = i < pre ? 0 : lp * Math.pow(1 - t, decay) * 0.9;
      }
    }
    return b;
  }

  function init() {
    if (ctx) return;

    ctx = new AC({ latencyHint: "interactive" });

    master = ctx.createGain();
    master.gain.value = muted ? 0 : VOL;

    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 22;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;

    master.connect(comp);
    comp.connect(ctx.destination);

    bus = ctx.createGain();
    bus.connect(master);

    // reverb
    revIn = ctx.createGain();
    const conv = ctx.createConvolver();
    conv.buffer = makeIR(2.2, 2.4);
    const revOut = ctx.createGain();
    revOut.gain.value = 0.55;
    revIn.connect(conv);
    conv.connect(revOut);
    revOut.connect(master);

    // música
    musicIn = ctx.createGain();
    musicBus = ctx.createGain();
    musicBus.gain.value = 0;
    musicIn.connect(musicBus);
    musicBus.connect(master);
    const ms = ctx.createGain();
    ms.gain.value = 0.35;
    musicBus.connect(ms);
    ms.connect(revIn);

    nb.white = mkNoise("white", 4);
    nb.pink = mkNoise("pink", 4);
    nb.brown = mkNoise("brown", 4);

    buildAmbience();
    updateMuteButton();
  }

  function unlock() {
    init();
    if (ctx && ctx.state === "suspended") ctx.resume();
  }

  // ---------------------------------------------------------
  // Utilitários de nós
  // ---------------------------------------------------------
  function F(type, f, q) {
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q === undefined ? 0.7 : q;
    return b;
  }

  function G(v) {
    const g = ctx.createGain();
    g.gain.value = v === undefined ? 1 : v;
    return g;
  }

  function noiseSrc(kind, loop) {
    const s = ctx.createBufferSource();
    s.buffer = nb[kind];
    s.loop = !!loop;
    return s;
  }

  function toBus(node, rev) {
    node.connect(bus);
    if (rev > 0) {
      const s = G(rev);
      node.connect(s);
      s.connect(revIn);
    }
  }

  function makeSpatial(rev) {
    const p = ctx.createPanner();
    p.panningModel = "equalpower";
    p.distanceModel = "inverse";
    p.refDistance = 10;
    p.rolloffFactor = 1.1;
    p.maxDistance = 500;
    toBus(p, rev);
    return p;
  }

  function setPos(p, x, y, z) {
    if (p.positionX) {
      p.positionX.value = x;
      p.positionY.value = y;
      p.positionZ.value = z;
    } else {
      p.setPosition(x, y, z);
    }
  }

  // destino: posicional (x,z), estéreo (pan) ou ambiente geral
  function dst(x, z, rev) {
    const r = rev === undefined ? 0.3 : rev;
    if (x === undefined) {
      const g = G(1);
      toBus(g, r);
      return g;
    }
    const p = makeSpatial(r);
    setPos(p, x, 0.5, z);
    return p;
  }

  function dstPan(pan, rev) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    toBus(p, rev === undefined ? 0.2 : rev);
    return p;
  }

  function tone(o) {
    const t = ctx.currentTime + (o.t || 0);
    const a = o.a === undefined ? 0.004 : o.a;
    const d = o.d === undefined ? 0.2 : o.d;
    const v = o.v === undefined ? 0.2 : o.v;

    const osc = ctx.createOscillator();
    const g = G(0.0001);
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + a + d);
    if (o.det) osc.detune.value = o.det;

    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);

    if (o.lp) {
      const f = F("lowpass", o.lp, 0.7);
      osc.connect(f);
      f.connect(g);
    } else {
      osc.connect(g);
    }

    g.connect(o.dest);
    osc.start(t);
    osc.stop(t + a + d + 0.05);
    return g;
  }

  function burst(o) {
    const t = ctx.currentTime + (o.t || 0);
    const a = o.a === undefined ? 0.002 : o.a;
    const d = o.d === undefined ? 0.15 : o.d;
    const v = o.v === undefined ? 0.2 : o.v;

    const s = noiseSrc(o.kind || "white", !!o.loop);
    const f = F(o.ft || "bandpass", o.f || 1000, o.q === undefined ? 0.8 : o.q);
    if (o.f2) {
      f.frequency.setValueAtTime(o.f, t);
      f.frequency.exponentialRampToValueAtTime(o.f2, t + a + d);
    }

    const g = G(0.0001);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);

    s.connect(f);
    f.connect(g);
    g.connect(o.dest);
    s.start(t, rnd(0, 2));
    s.stop(t + a + d + 0.05);
  }

  // ---------------------------------------------------------
  // MOTOR DE POPA (4 tempos, com cavitação da hélice)
  // ---------------------------------------------------------
  function makeEngine(pitchMul) {
    const pan = makeSpatial(0.12);
    const out = G(0);
    out.connect(pan);

    const mkOsc = (type, g) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = 60;
      const gg = G(g);
      o.connect(gg);
      o.start();
      return { o, g: gg };
    };

    const s1 = mkOsc("sawtooth", 0.5);
    const s2 = mkOsc("square", 0.22);
    const s3 = mkOsc("triangle", 0.5);

    const mix = G(1);
    s1.g.connect(mix);
    s2.g.connect(mix);
    s3.g.connect(mix);

    // pulsação dos cilindros
    const pulse = G(0.75);
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 20;
    const lfoG = G(0.25);
    lfo.connect(lfoG);
    lfoG.connect(pulse.gain);
    lfo.start();
    mix.connect(pulse);

    // saturação (calor do escapamento)
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = i / 512 - 1;
      curve[i] = Math.tanh(x * 2.4) * 0.85;
    }
    shaper.curve = curve;
    shaper.oversample = "2x";

    const lp = F("lowpass", 600, 1.1);
    const res = F("peaking", 190, 0.9);
    res.gain.value = 6;
    pulse.connect(shaper);
    shaper.connect(lp);
    lp.connect(res);
    res.connect(out);

    // zumbido agudo da transmissão
    const whine = ctx.createOscillator();
    whine.type = "sine";
    whine.frequency.value = 400;
    const whineG = G(0);
    whine.connect(whineG);
    whineG.connect(out);
    whine.start();

    // admissão (ar)
    const nIn = noiseSrc("pink", true);
    const nInF = F("bandpass", 450, 0.8);
    const nInG = G(0.02);
    nIn.connect(nInF);
    nInF.connect(nInG);
    nInG.connect(out);
    nIn.start(0, rnd(0, 2));

    // borbulhar do escape na água (marcha lenta)
    const nBu = noiseSrc("brown", true);
    const nBuF = F("lowpass", 170, 0.9);
    const nBuG = G(0.1);
    const buLfo = ctx.createOscillator();
    buLfo.frequency.value = 5;
    const buLfoG = G(0.07);
    buLfo.connect(buLfoG);
    buLfoG.connect(nBuG.gain);
    buLfo.start();
    nBu.connect(nBuF);
    nBuF.connect(nBuG);
    nBuG.connect(out);
    nBu.start(0, rnd(0, 2));

    // esteira da hélice (cavitação)
    const nWa = noiseSrc("white", true);
    const nWaF = F("bandpass", 1000, 0.7);
    const nWaG = G(0);
    nWa.connect(nWaF);
    nWaF.connect(nWaG);
    nWaG.connect(out);
    nWa.start(0, rnd(0, 2));

    const nTh = noiseSrc("pink", true);
    const nThF = F("lowpass", 260, 0.8);
    const nThG = G(0);
    nTh.connect(nThF);
    nThF.connect(nThG);
    nThG.connect(out);
    nTh.start(0, rnd(0, 2));

    const e = {
      pan, out, rpm: 0.1, on: false,
      set(rpm, load, speed, on, vol) {
        const now = ctx.currentTime;
        const f = (52 + rpm * 172) * pitchMul * (1 + (Math.random() - 0.5) * 0.004 * (1.2 - rpm));
        const k = 0.045;

        s1.o.frequency.setTargetAtTime(f, now, k);
        s2.o.frequency.setTargetAtTime(f * 2.003, now, k);
        s3.o.frequency.setTargetAtTime(f * 0.5, now, k);
        whine.frequency.setTargetAtTime(f * 7.1, now, k);
        whineG.gain.setTargetAtTime(rpm * rpm * 0.018, now, 0.1);

        lfo.frequency.setTargetAtTime(f * 0.5, now, k);
        lfoG.gain.setTargetAtTime(0.18 + (1 - rpm) * 0.3, now, 0.1);

        lp.frequency.setTargetAtTime(380 + rpm * 2600 + load * 900, now, 0.08);
        res.frequency.setTargetAtTime(150 + rpm * 120, now, 0.1);

        nInG.gain.setTargetAtTime(0.015 + rpm * load * 0.11, now, 0.1);
        nInF.frequency.setTargetAtTime(350 + rpm * 900, now, 0.1);

        nBuG.gain.setTargetAtTime(0.02 + 0.22 * Math.pow(1 - rpm, 2), now, 0.15);
        buLfo.frequency.setTargetAtTime(3 + rpm * 8, now, 0.2);

        nWaG.gain.setTargetAtTime(0.02 + 0.16 * load * rpm + speed * 0.05, now, 0.1);
        nWaF.frequency.setTargetAtTime(700 + rpm * 1400, now, 0.1);
        nThG.gain.setTargetAtTime(0.05 + 0.2 * load * rpm, now, 0.12);

        const gv = on ? (0.1 + rpm * 0.32) * vol * 0.12 : 0;
        out.gain.setTargetAtTime(gv, now, on ? 0.08 : 0.25);
      },
      mute() {
        out.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
      }
    };

    return e;
  }

  // ---------------------------------------------------------
  // AMBIENTE CONTÍNUO (água, vento, plateia, bola)
  // ---------------------------------------------------------
  function loopNoise(kind, ftype, f, q, g) {
    const s = noiseSrc(kind, true);
    const fl = F(ftype, f, q);
    const gn = G(g);
    s.connect(fl);
    fl.connect(gn);
    s.start(0, rnd(0, 2));
    return { s, f: fl, g: gn };
  }

  function buildAmbience() {
    const a = {};

    // marolinha da piscina
    a.lap = loopNoise("pink", "bandpass", 700, 0.6, 0.05);
    a.lapLo = loopNoise("brown", "lowpass", 320, 0.7, 0.07);
    const lapLfo = ctx.createOscillator();
    lapLfo.frequency.value = 0.13;
    const lapLfoG = G(0.025);
    lapLfo.connect(lapLfoG);
    lapLfoG.connect(a.lap.g.gain);
    lapLfo.start();
    toBus(a.lap.g, 0.25);
    toBus(a.lapLo.g, 0.1);

    // casco cortando a água
    a.rush = loopNoise("pink", "bandpass", 1200, 0.5, 0);
    toBus(a.rush.g, 0.1);

    // rastro de espuma / chiado agudo
    a.hiss = loopNoise("white", "highpass", 3500, 0.7, 0);
    toBus(a.hiss.g, 0.1);

    // vento no rosto
    a.wind = loopNoise("pink", "bandpass", 520, 0.4, 0);
    toBus(a.wind.g, 0.05);

    // freio na água
    a.skid = loopNoise("white", "bandpass", 2200, 1.0, 0);
    toBus(a.skid.g, 0.15);

    // plateia ao fundo
    a.crowd = loopNoise("pink", "bandpass", 1000, 0.5, 0);
    toBus(a.crowd.g, 0.4);

    // bola deslizando na água (posicional)
    a.ballPan = makeSpatial(0.15);
    a.ball = loopNoise("white", "bandpass", 1600, 0.9, 0);
    a.ball.g.connect(a.ballPan);

    amb = a;
  }

  // ---------------------------------------------------------
  // EFEITOS PONTUAIS
  // ---------------------------------------------------------
  function bubble(d, v) {
    const f0 = rnd(260, 1300);
    const dur = rnd(0.03, 0.09);
    tone({ f: f0, f2: f0 * rnd(1.7, 2.6), a: 0.002, d: dur, v: v, dest: d });
  }

  function splash(p, x, z) {
    if (!ready()) return;
    const d = dst(x, z, 0.3);
    burst({ kind: "pink", f: 2600, f2: 550, q: 0.7, a: 0.01, d: 0.28 + 0.4 * p, v: 0.32 * p, dest: d });
    burst({ ft: "highpass", f: 4500, q: 0.5, a: 0.005, d: 0.14, v: 0.12 * p, dest: d });
    for (let i = 0; i < 4 + Math.floor(p * 6); i++) {
      const t = rnd(0.02, 0.5);
      tone({ f: rnd(500, 1800), f2: rnd(900, 3000), a: 0.002, d: rnd(0.02, 0.06), v: 0.05 * p, t: t, dest: d });
    }
  }

  function clang(p, d) {
    const base = 560;
    const parts = [[1, 1, 0.9], [2.32, 0.7, 0.55], [4.25, 0.45, 0.38], [6.63, 0.3, 0.22], [9.38, 0.18, 0.14]];
    for (const [r, g, dec] of parts) {
      tone({ f: base * r, a: 0.001, d: dec * (0.6 + p * 0.8), v: 0.22 * g * p, dest: d });
    }
    burst({ ft: "highpass", f: 4000, a: 0.001, d: 0.03, v: 0.25 * p, dest: d });
    // tubo oco
    tone({ f: 190, f2: 150, type: "triangle", a: 0.002, d: 0.25, v: 0.18 * p, dest: d });
  }

  function ballHit(p, x, z) {
    if (!ready() || !limited("ballHit", 70)) return;
    p = clamp(p, 0.08, 1);
    const d = dst(x, z, 0.3);
    tone({ f: 200, f2: 62, a: 0.002, d: 0.13, v: 0.5 * p + 0.12, dest: d });
    burst({ f: 1800, q: 0.8, a: 0.001, d: 0.06, v: 0.35 * p, dest: d });
    tone({ type: "triangle", f: 430, f2: 300, a: 0.001, d: 0.09, v: 0.15 * p, dest: d });
    burst({ kind: "pink", ft: "lowpass", f: 900, d: 0.1, v: 0.2 * p, dest: d });
    if (p > 0.25) splash(p * 0.55, x, z);
  }

  function ballBounce(kind, p, x, z) {
    if (!ready() || !limited("bb" + kind, 90)) return;
    p = clamp(p, 0.08, 1);
    const d = dst(x, z, 0.35);

    if (kind === "post") {
      clang(p, d);
    } else if (kind === "net") {
      burst({ ft: "highpass", f: 3000, a: 0.005, d: 0.28, v: 0.22 * p, dest: d });
      burst({ kind: "pink", f: 1800, d: 0.18, v: 0.1 * p, dest: d });
      tone({ f: 120, f2: 60, d: 0.14, v: 0.12 * p, dest: d });
    } else {
      tone({ f: 130, f2: 48, a: 0.002, d: 0.26, v: 0.42 * p, dest: d });
      burst({ ft: "lowpass", f: 900, d: 0.12, v: 0.2 * p, dest: d });
      tone({ f: 260, f2: 170, d: 0.08, v: 0.14 * p, dest: d });
    }
  }

  function hullHit(p, x, z) {
    if (!ready() || !limited("hull", 110)) return;
    p = clamp(p, 0.08, 1);
    const d = dst(x, z, 0.35);
    tone({ f: 92, f2: 38, a: 0.002, d: 0.38, v: 0.6 * p, dest: d });
    burst({ ft: "lowpass", f: 1200, d: 0.16, v: 0.26 * p, dest: d });
    burst({ f: 2500, q: 1.2, a: 0.001, d: 0.04, v: 0.22 * p, dest: d });
    tone({ type: "triangle", f: 150, f2: 110, d: 0.2, v: 0.14 * p, dest: d });
    splash(p * 0.7, x, z);
  }

  function boatBump(p, x, z) {
    if (!ready() || !limited("bump", 140)) return;
    p = clamp(p, 0.08, 1);
    const d = dst(x, z, 0.3);
    tone({ f: 110, f2: 55, a: 0.002, d: 0.28, v: 0.45 * p, dest: d });
    burst({ ft: "lowpass", f: 1000, d: 0.14, v: 0.24 * p, dest: d });
    burst({ f: 3000, q: 1.5, a: 0.001, d: 0.03, v: 0.18 * p, dest: d });
    tone({ type: "triangle", f: 170, f2: 120, d: 0.16, v: 0.12 * p, dest: d });
    splash(p * 0.6, x, z);
  }

  // ---------- plateia / buzina / sinos / apito ----------
  function cheer(p, dur) {
    const t = ctx.currentTime;
    const d = dst(undefined, undefined, 0.45);

    const s = noiseSrc("pink", true);
    const bp = F("bandpass", 1100, 0.45);
    const g = G(0.0001);
    s.connect(bp);
    bp.connect(g);
    g.connect(d);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.55 * p, t + 0.4);
    g.gain.setValueAtTime(0.55 * p, t + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1);

    bp.frequency.setValueAtTime(900, t);
    bp.frequency.linearRampToValueAtTime(1500, t + 0.5);
    bp.frequency.linearRampToValueAtTime(1000, t + dur + 1);

    s.start(t, rnd(0, 2));
    s.stop(t + dur + 1.1);

    // vozes gritando "aaah"
    for (let i = 0; i < 16; i++) {
      const ts = t + rnd(0, dur * 0.7);
      const f0 = rnd(150, 320);
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(f0, ts);
      o.frequency.exponentialRampToValueAtTime(f0 * 1.25, ts + 0.35);

      const f1 = F("bandpass", 750, 4);
      const f2 = F("bandpass", 1250, 5);
      const vg = G(0.0001);
      vg.gain.setValueAtTime(0.0001, ts);
      vg.gain.linearRampToValueAtTime(0.05 * p, ts + 0.08);
      vg.gain.exponentialRampToValueAtTime(0.0001, ts + 0.7);

      o.connect(f1);
      o.connect(f2);
      f1.connect(vg);
      f2.connect(vg);
      vg.connect(d);
      o.start(ts);
      o.stop(ts + 0.75);
    }

    // palmas
    for (let i = 0; i < 45; i++) {
      burst({ f: rnd(1800, 3600), q: 1.5, a: 0.001, d: 0.02, v: 0.035 * p, t: rnd(0.3, dur), dest: d });
    }
  }

  function horn(t0, v, dur) {
    const t = ctx.currentTime + t0;
    const d = dst(undefined, undefined, 0.5);
    const g = G(0.0001);
    const lp = F("lowpass", 2400, 0.8);
    lp.connect(g);
    g.connect(d);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.03);
    g.gain.setValueAtTime(v, t + dur - 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    [[370, "sawtooth"], [466, "sawtooth"], [554, "square"]].forEach(([f, type]) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      o.frequency.setValueAtTime(f, t + dur - 0.14);
      o.frequency.exponentialRampToValueAtTime(f * 0.92, t + dur);
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
  }

  function bell(f, t0, v, d) {
    const dd = dst(undefined, undefined, 0.5);
    tone({ f: f, a: 0.002, d: d, v: v, t: t0, dest: dd });
    tone({ f: f * 2.76, a: 0.002, d: d * 0.4, v: v * 0.4, t: t0, dest: dd });
    tone({ f: f * 5.4, a: 0.002, d: d * 0.2, v: v * 0.15, t: t0, dest: dd });
  }

  function whistle(len, t0, v) {
    const t = ctx.currentTime + t0;
    const d = dst(undefined, undefined, 0.55);
    const g = G(0.0001);
    g.connect(d);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.02);
    g.gain.setValueAtTime(v, t + len - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);

    const trem = G(0.7);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 28;
    const lfoG = G(0.3);
    lfo.connect(lfoG);
    lfoG.connect(trem.gain);
    trem.connect(g);

    [2900, 3120].forEach(f => {
      const o = ctx.createOscillator();
      const og = G(0.5);
      o.type = "sine";
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 1.04, t + len);
      o.connect(og);
      og.connect(trem);
      o.start(t);
      o.stop(t + len + 0.05);
    });

    const n = noiseSrc("white", true);
    const nf = F("bandpass", 3400, 5);
    const ng = G(0.35);
    n.connect(nf);
    nf.connect(ng);
    ng.connect(g);

    lfo.start(t);
    lfo.stop(t + len + 0.05);
    n.start(t, rnd(0, 2));
    n.stop(t + len + 0.05);
  }

  function gull() {
    if (!ready()) return;
    const d = dst(rnd(-60, 60), rnd(-150, 150), 0.4);
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const t = ctx.currentTime + i * 0.27;
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(1700, t);
      o.frequency.exponentialRampToValueAtTime(1050, t + 0.22);

      const vib = ctx.createOscillator();
      vib.frequency.value = 38;
      const vibG = G(60);
      vib.connect(vibG);
      vibG.connect(o.frequency);

      const bp = F("bandpass", 1700, 2.5);
      const g = G(0.0001);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);

      o.connect(bp);
      bp.connect(g);
      g.connect(d);
      o.start(t);
      vib.start(t);
      o.stop(t + 0.3);
      vib.stop(t + 0.3);
    }
  }

  // ---------- eventos de partida ----------
  function goal(mine, x, z) {
    if (!ready()) return;
    const p = mine ? 1 : 0.55;
    crowdBoost = 1;

    // rede balançando + bola no fundo
    const d = dst(x, z, 0.35);
    burst({ ft: "highpass", f: 3200, a: 0.005, d: 0.5, v: 0.25, dest: d });
    burst({ kind: "pink", f: 1500, d: 0.35, v: 0.12, dest: d });
    tone({ f: 120, f2: 55, d: 0.2, v: 0.3, dest: d });

    horn(0.2, mine ? 0.15 : 0.08, mine ? 1.2 : 0.7);
    cheer(p, mine ? 3.2 : 2.2);

    if (mine) {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(f, 0.3 + i * 0.12, 0.13, 1.4));
    } else {
      const dd = dst(undefined, undefined, 0.4);
      tone({ type: "sawtooth", f: 220, f2: 165, a: 0.05, d: 0.9, v: 0.06, lp: 900, t: 0.5, dest: dd });
    }
  }

  function countdown(n) {
    if (!ready()) return;
    const d = dst(undefined, undefined, 0.3);
    if (n >= 1) {
      tone({ f: 660, a: 0.003, d: 0.16, v: 0.24, dest: d });
      tone({ f: 1320, a: 0.003, d: 0.08, v: 0.06, dest: d });
    } else {
      tone({ f: 990, a: 0.004, d: 0.5, v: 0.26, dest: d });
      tone({ f: 1980, a: 0.004, d: 0.25, v: 0.07, dest: d });
      whistle(0.5, 0, 0.2);
    }
  }

  function endMatch(res) {
    if (!ready()) return;
    whistle(0.3, 0, 0.22);
    whistle(0.3, 0.38, 0.22);
    whistle(0.9, 0.76, 0.24);

    const d = dst(undefined, undefined, 0.45);

    if (res === "win") {
      cheer(1, 3.5);
      horn(1.0, 0.12, 0.9);
      [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5].forEach((f, i) => {
        bell(f, 1.0 + i * 0.14, 0.12, 1.6);
      });
      [261.63, 329.63, 392].forEach(f => {
        tone({ type: "triangle", f: f, a: 0.1, d: 2.2, v: 0.06, t: 2.0, lp: 1500, dest: d });
      });
    } else if (res === "lose") {
      cheer(0.35, 1.8);
      // trombone triste
      tone({ type: "sawtooth", f: 233, f2: 196, a: 0.06, d: 0.45, v: 0.08, lp: 800, t: 1.1, dest: d });
      tone({ type: "sawtooth", f: 220, f2: 185, a: 0.03, d: 0.45, v: 0.08, lp: 800, t: 1.6, dest: d });
      tone({ type: "sawtooth", f: 208, f2: 175, a: 0.03, d: 0.5, v: 0.08, lp: 800, t: 2.1, dest: d });
      tone({ type: "sawtooth", f: 196, f2: 110, a: 0.03, d: 1.3, v: 0.09, lp: 800, t: 2.6, dest: d });
    } else {
      cheer(0.5, 1.8);
      bell(440, 1.1, 0.1, 1.2);
      bell(392, 1.5, 0.1, 1.4);
    }
  }

  // ---------------------------------------------------------
  // SONS DE INTERFACE (botões)
  // ---------------------------------------------------------
  const SWATCH_SEMI = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

  function ui(kind, idx) {
    if (!ready()) return;
    const d = dst(undefined, undefined, 0.22);

    switch (kind) {
      case "hover":
        tone({ f: 1500, a: 0.002, d: 0.03, v: 0.03, dest: d });
        break;

      case "pad":
        tone({ type: "square", f: 900, f2: 600, a: 0.001, d: 0.025, v: 0.04, dest: d });
        break;

      case "swatch": {
        const f = 392 * Math.pow(2, SWATCH_SEMI[idx % SWATCH_SEMI.length] / 12);
        tone({ type: "triangle", f: f, a: 0.002, d: 0.38, v: 0.16, dest: d });
        tone({ f: f * 2.756, a: 0.001, d: 0.14, v: 0.05, dest: d });
        burst({ ft: "highpass", f: 5000, d: 0.01, v: 0.04, dest: d });
        break;
      }

      case "confirm":
        tone({ f: 523.25, a: 0.003, d: 0.14, v: 0.15, dest: d });
        tone({ f: 783.99, a: 0.003, d: 0.22, v: 0.15, t: 0.07, dest: d });
        tone({ f: 1567.98, a: 0.002, d: 0.12, v: 0.04, t: 0.07, dest: d });
        burst({ ft: "highpass", f: 5000, d: 0.012, v: 0.05, dest: d });
        break;

      case "back":
        tone({ f: 470, f2: 320, a: 0.003, d: 0.15, v: 0.14, dest: d });
        burst({ ft: "highpass", f: 4000, d: 0.01, v: 0.04, dest: d });
        break;

      case "play": {
        burst({ kind: "pink", f: 300, f2: 3200, q: 0.8, a: 0.15, d: 0.5, v: 0.22, dest: d });
        [261.63, 329.63, 392, 523.25].forEach((f, i) => {
          tone({ type: "triangle", f: f, a: 0.02, d: 1.3, v: 0.07, t: 0.05 + i * 0.05, lp: 2000, dest: d });
        });
        bell(1046.5, 0.25, 0.08, 1.2);
        break;
      }

      default: // tick mecânico
        tone({ type: "square", f: 1800, f2: 1100, a: 0.001, d: 0.025, v: 0.08, dest: d });
        burst({ ft: "highpass", f: 5000, d: 0.01, v: 0.05, dest: d });
        tone({ f: 300, f2: 200, d: 0.04, v: 0.06, dest: d });
    }
  }

  // ---------------------------------------------------------
  // MÚSICA DE MENU (gerativa, chill)
  // ---------------------------------------------------------
  const CHORDS = [
    [57, 60, 64, 67],   // Am7
    [53, 57, 60, 64],   // Fmaj7
    [48, 52, 55, 59],   // Cmaj7
    [55, 59, 62, 66]    // Gmaj7
  ];
  const STEP_DUR = 60 / 84 / 2;

  function scheduleMusic() {
    const t = Math.max(0, musicNext - ctx.currentTime);
    const chord = CHORDS[musicChord];
    const step = musicStep;

    if (step === 0) {
      chord.forEach(m => {
        tone({ type: "triangle", f: mtof(m + 12), a: 1.6, d: 4.4, v: 0.03, det: -6, t: t, lp: 1100, dest: musicIn });
        tone({ type: "triangle", f: mtof(m + 12), a: 1.6, d: 4.4, v: 0.03, det: 6, t: t, lp: 1100, dest: musicIn });
      });
      tone({ f: mtof(chord[0] - 12), a: 0.02, d: 2.6, v: 0.16, t: t, dest: musicIn });
    }

    if (step === 8) {
      tone({ f: mtof(chord[0] - 12), a: 0.02, d: 1.4, v: 0.12, t: t, dest: musicIn });
    }

    if (step === 0 || step === 8) {
      tone({ f: 110, f2: 45, a: 0.002, d: 0.22, v: 0.14, t: t, dest: musicIn });
    }

    if ([0, 3, 6, 8, 11, 14].includes(step) && Math.random() > 0.2) {
      const m = chord[Math.floor(Math.random() * 4)] + 12 + (Math.random() > 0.7 ? 12 : 0);
      tone({ type: "triangle", f: mtof(m), a: 0.003, d: 0.7, v: 0.05, t: t, lp: 2600, dest: musicIn });
      tone({ f: mtof(m) * 2, a: 0.002, d: 0.2, v: 0.012, t: t, dest: musicIn });
    }

    if (step % 2 === 1) {
      burst({ ft: "highpass", f: 7000, a: 0.001, d: 0.03, v: 0.012, t: t, dest: musicIn });
    }

    musicNext += STEP_DUR;
    musicStep = (musicStep + 1) % 16;
    if (musicStep === 0) musicChord = (musicChord + 1) % CHORDS.length;
  }

  // ---------------------------------------------------------
  // ATUALIZAÇÃO POR FRAME
  // ---------------------------------------------------------
  function update(dt, s) {
    if (!ready() || !amb) return;

    const now = ctx.currentTime;
    dt = Math.min(dt, 0.1);
    const play = s.mode === "play";

    // ouvinte = câmera
    const L = ctx.listener;
    const c = s.cam, f = s.fwd;
    if (L.positionX) {
      L.positionX.value = c.x;
      L.positionY.value = c.y;
      L.positionZ.value = c.z;
      L.forwardX.value = f.x;
      L.forwardY.value = f.y;
      L.forwardZ.value = f.z;
      L.upX.value = 0;
      L.upY.value = 1;
      L.upZ.value = 0;
    } else {
      L.setPosition(c.x, c.y, c.z);
      L.setOrientation(f.x, f.y, f.z, 0, 1, 0);
    }

    // ----- motores -----
    const list = s.boats || [];
    for (let i = 0; i < 6; i++) {
      let e = engines[i];

      if (i < list.length && play) {
        if (!e) e = engines[i] = makeEngine(i === 0 ? 1 : 0.92 + i * 0.045);
        const b = list[i];
        const n = clamp(b.sp / 11, 0, 1);
        const thr = Math.abs(b.thr);
        const target = 0.12 + 0.88 * clamp(thr * 0.65 + n * 0.55, 0, 1);
        e.rpm += (target - e.rpm) * Math.min(1, dt * (target > e.rpm ? 2.4 : 1.2));
        setPos(e.pan, b.x, 0.6, b.z);
        e.set(e.rpm, thr, n, true, i === 0 ? 1 : 0.8);
      } else if (e) {
        e.mute();
        e.rpm += (0.1 - e.rpm) * Math.min(1, dt * 2);
      }
    }

    // ----- água / vento / freio -----
    const n = clamp(s.sp / 11, 0, 1);
    const thr = Math.abs(s.throttle || 0);
    const T = 0.08;

    amb.lap.g.gain.setTargetAtTime(play ? 0.04 : 0.05, now, 0.3);
    amb.rush.g.gain.setTargetAtTime(play ? Math.pow(n, 1.3) * 0.38 : 0, now, T);
    amb.rush.f.frequency.setTargetAtTime(900 + n * 1900, now, T);
    amb.hiss.g.gain.setTargetAtTime(play ? n * n * 0.1 : 0, now, T);
    amb.wind.g.gain.setTargetAtTime(play ? n * n * 0.12 : 0, now, 0.15);
    amb.wind.f.frequency.setTargetAtTime(400 + n * 500, now, 0.15);

    const braking = play && s.brake && s.sp > 2;
    amb.skid.g.gain.setTargetAtTime(braking ? 0.1 * clamp(s.sp / 8, 0, 1) : 0, now, 0.05);

    // plateia ao fundo + reação aos gols
    crowdBoost *= Math.exp(-dt * 0.45);
    amb.crowd.g.gain.setTargetAtTime(
      play ? 0.02 + 0.06 * crowdBoost + 0.008 * Math.sin(now * 0.4) : 0, now, 0.4
    );

    // bola deslizando
    const bsp = s.ball ? clamp(s.ball.sp / 10, 0, 1) : 0;
    amb.ball.g.gain.setTargetAtTime(play ? Math.pow(bsp, 1.2) * 0.11 : 0, now, 0.08);
    if (s.ball) setPos(amb.ballPan, s.ball.x, 0.3, s.ball.z);

    // ondinhas batendo no casco
    if (play) {
      slapAcc += dt * (n * 8 + thr * 2);
      while (slapAcc >= 1) {
        slapAcc -= 1;
        burst({
          kind: "pink", f: rnd(500, 1000), f2: rnd(250, 450), q: 0.9,
          a: 0.015, d: rnd(0.12, 0.25), v: 0.05 + 0.09 * n,
          dest: dstPan(rnd(-0.6, 0.6), 0.2)
        });
      }

      // bolhas estourando atrás da hélice
      bubAcc += dt * (thr * 28 + n * 40);
      let guard = 0;
      while (bubAcc >= 1 && guard++ < 4) {
        bubAcc -= 1;
        bubble(dstPan(rnd(-0.3, 0.3), 0.15), 0.018 + 0.02 * thr);
      }
      if (bubAcc > 4) bubAcc = 0;
    }

    // gaivota ao longe
    gullTimer -= dt;
    if (gullTimer <= 0) {
      gullTimer = rnd(14, 32);
      if (Math.random() > 0.3) gull();
    }

    // música
    const wantMusic = s.mode === "start" || s.mode === "pick" || s.mode === "modes";
    if (wantMusic !== musicOn) {
      musicOn = wantMusic;
      musicBus.gain.setTargetAtTime(musicOn ? 0.55 : 0, now, musicOn ? 1.2 : 0.4);
      if (musicOn) musicNext = now + 0.1;
    }
    if (musicOn) {
      while (musicNext < now + 0.4) scheduleMusic();
    }
  }

  // ---------------------------------------------------------
  // MUTE
  // ---------------------------------------------------------
  function updateMuteButton() {
    const b = document.getElementById("mute");
    if (b) b.textContent = muted ? "🔇" : "🔊";
  }

  function toggleMute() {
    init();
    muted = !muted;
    try { localStorage.setItem("oceanlux-muted", muted ? "1" : "0"); } catch (e) {}
    master.gain.setTargetAtTime(muted ? 0 : VOL, ctx.currentTime, 0.05);
    updateMuteButton();
  }

  // ---------------------------------------------------------
  // Ligações automáticas na interface
  // ---------------------------------------------------------
  function uiKindFor(btn) {
    if (btn.id === "mute") return "tick";
    if (btn.id === "play") return "play";
    if (btn.classList.contains("sw")) return "swatch";
    if (btn.closest(".pad")) return "pad";
    if (btn.id === "quit" || btn.classList.contains("ghost")) return "back";
    if (btn.classList.contains("big") || btn.closest("#sizes")) return "confirm";
    return "tick";
  }

  let lastHover = null;

  window.addEventListener("pointerdown", e => {
    unlock();
    const btn = e.target.closest && e.target.closest("button");
    if (!btn) return;

    if (btn.id === "mute") {
      toggleMute();
      ui("tick");
      return;
    }

    const kind = uiKindFor(btn);
    let idx = 0;
    if (kind === "swatch") idx = Array.prototype.indexOf.call(btn.parentNode.children, btn);
    ui(kind, idx);
  }, true);

  window.addEventListener("pointerover", e => {
    if (e.pointerType !== "mouse") return;
    const btn = e.target.closest && e.target.closest("button");
    if (!btn || btn === lastHover || btn.closest(".pad")) {
      if (!btn) lastHover = null;
      return;
    }
    lastHover = btn;
    ui("hover");
  });

  window.addEventListener("keydown", e => {
    unlock();
    if (e.code === "KeyM" && !e.repeat) toggleMute();
  });

  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else ctx.resume();
  });

  document.addEventListener("DOMContentLoaded", updateMuteButton);
  updateMuteButton();

  // ---------------------------------------------------------
  // API pública
  // ---------------------------------------------------------
  window.BoatAudio = {
    unlock,
    update,
    ballHit,
    ballBounce,
    hullHit,
    boatBump,
    goal,
    countdown,
    endMatch,
    whistle: kind => {
      if (!ready()) return;
      if (kind === "short") {
        whistle(0.25, 0, 0.22);
        whistle(0.25, 0.32, 0.22);
      } else {
        whistle(0.8, 0, 0.24);
      }
    },
    toggleMute
  };
})();