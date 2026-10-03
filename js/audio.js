// ============================================================
// audio.js — efeitos sonoros e música gerados com Web Audio API
// (nenhum arquivo de som; tudo sintetizado no código)
// ============================================================

const Som = {
  ctx: null, mestre: null, busMusica: null, busEfeitos: null,
  mudo: false,
  tema: 'titulo', proxNota: 0, passo: 0, timer: null,

  // Pentatônica (graus em semitons) para soar oriental
  PENTA: [0, 2, 4, 7, 9],
  TEMAS: {
    titulo:   { raiz: 57, bpm: 76,  brilho: 0.7 },
    vila:     { raiz: 60, bpm: 92,  brilho: 1.0 },
    mapa:     { raiz: 62, bpm: 84,  brilho: 0.9 },
    floresta: { raiz: 64, bpm: 104, brilho: 1.0 },
    pantano:  { raiz: 55, bpm: 88,  brilho: 0.6 },
    templo:   { raiz: 59, bpm: 96,  brilho: 0.8 },
    chefe:    { raiz: 52, bpm: 128, brilho: 1.1 },
  },

  carregarPreferencia() {
    try { this.mudo = localStorage.getItem('imperfectWorld_mudo') === '1'; } catch (e) { this.mudo = false; }
  },

  // O áudio só pode começar depois de uma interação do jogador
  iniciar() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.mestre = this.ctx.createGain();
      this.mestre.gain.value = this.mudo ? 0 : 0.8;
      this.mestre.connect(this.ctx.destination);
      this.busMusica = this.ctx.createGain(); this.busMusica.gain.value = 0.22; this.busMusica.connect(this.mestre);
      this.busEfeitos = this.ctx.createGain(); this.busEfeitos.gain.value = 0.6; this.busEfeitos.connect(this.mestre);
      this.proxNota = this.ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.agendarMusica(), 60);
    } catch (e) { this.ctx = null; }
  },

  setMudo(m) {
    this.mudo = m;
    try { localStorage.setItem('imperfectWorld_mudo', m ? '1' : '0'); } catch (e) { /* armazenamento indisponível */ }
    if (this.mestre) this.mestre.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  },

  setTema(t) { if (this.TEMAS[t] && t !== this.tema) { this.tema = t; this.passo = 0; } },

  midi(n) { return 440 * Math.pow(2, (n - 69) / 12); },

  // Um tom simples com envelope
  tom(freq, dur, tipo, vol, ate, atraso, bus) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + (atraso || 0);
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = tipo || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (ate) o.frequency.exponentialRampToValueAtTime(Math.max(20, ate), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(bus || this.busEfeitos);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },

  // Ruído filtrado (golpes, impacto)
  ruido(dur, vol, freqFiltro, atraso) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + (atraso || 0);
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freqFiltro || 1800;
    const g = this.ctx.createGain(); g.gain.value = vol || 0.4;
    s.connect(f); f.connect(g); g.connect(this.busEfeitos);
    s.start(t0);
  },

  // ---------- Efeitos ----------
  golpe() { this.ruido(0.14, 0.5, 2200); this.tom(170, 0.14, 'square', 0.18, 60); },
  critico() { this.golpe(); this.tom(880, 0.18, 'triangle', 0.2, 1760, 0.03); },
  magia() { this.tom(500, 0.35, 'sine', 0.25, 1400); this.tom(750, 0.3, 'triangle', 0.15, 2000, 0.05); },
  raio() { this.ruido(0.35, 0.55, 5000); this.tom(1200, 0.25, 'sawtooth', 0.12, 200); },
  cura() { [0, 4, 7, 12].forEach((s, i) => this.tom(this.midi(72 + s), 0.25, 'sine', 0.2, null, i * 0.07)); },
  nivel() { [0, 2, 4, 7, 9, 12].forEach((s, i) => this.tom(this.midi(67 + s), 0.3, 'triangle', 0.22, null, i * 0.08)); },
  moeda() { this.tom(988, 0.08, 'square', 0.12); this.tom(1319, 0.2, 'square', 0.12, null, 0.08); },
  vitoria() { [0, 4, 7, 12, 7, 12].forEach((s, i) => this.tom(this.midi(64 + s), 0.32, 'triangle', 0.22, null, i * 0.12)); },
  derrota() { [7, 4, 2, 0].forEach((s, i) => this.tom(this.midi(55 + s), 0.45, 'sine', 0.22, null, i * 0.22)); },
  nivelCurto() { [0, 7, 12].forEach((s, i) => this.tom(this.midi(76 + s), 0.16, 'triangle', 0.18, null, i * 0.045)); },
  clique() { this.tom(660, 0.05, 'triangle', 0.08); },
  erro() { this.tom(180, 0.18, 'square', 0.12, 120); },
  esquiva() { this.ruido(0.18, 0.2, 900); },
  defesa() { this.tom(300, 0.2, 'triangle', 0.2, 500); },

  // ---------- Música ambiente em loop (agendador com antecedência) ----------
  agendarMusica() {
    if (!this.ctx) return;
    const tema = this.TEMAS[this.tema];
    const dur = 60 / tema.bpm / 2; // colcheias
    while (this.proxNota < this.ctx.currentTime + 0.25) {
      const p = this.passo;
      // baixo (bordão) a cada 8 colcheias
      if (p % 8 === 0) this.tomMusica(this.midi(tema.raiz - 24), dur * 7, 'triangle', 0.35, this.proxNota);
      if (p % 8 === 4) this.tomMusica(this.midi(tema.raiz - 17), dur * 3, 'triangle', 0.22, this.proxNota);
      // melodia: caminhada aleatória determinística na pentatônica
      const padrao = [0, 2, 1, 3, 4, 3, 2, -1, 1, 3, 2, 4, 5, 4, 2, -1];
      const grau = padrao[(p + Math.floor(p / 16) * 3) % 16];
      if (grau >= 0) {
        const oit = Math.floor(grau / 5), g = grau % 5;
        const nota = tema.raiz + this.PENTA[g] + oit * 12;
        this.tomMusica(this.midi(nota), dur * 1.6, 'sine', 0.3 * tema.brilho, this.proxNota);
        if (p % 4 === 2) this.tomMusica(this.midi(nota + 12), dur * 0.6, 'triangle', 0.08, this.proxNota);
      }
      this.proxNota += dur;
      this.passo = (this.passo + 1) % 64;
    }
  },

  tomMusica(freq, dur, tipo, vol, t0) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = tipo; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.busMusica);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },
};
