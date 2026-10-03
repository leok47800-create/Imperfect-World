// ============================================================
// main.js — estado do jogo, game loop (requestAnimationFrame +
// delta time), efeitos visuais, cenas no canvas, entrada e regras
// da vila (loja, ferreiro, missões, pousada, inventário).
// ============================================================

const Game = {
  canvas: null, ctx: null,
  jogador: null,
  cena: 'carregando',
  batalha: null,
  zonaAtual: null,
  t: 0, ultimo: 0,
  posVitoria: null,
  aposLevelUp: null,
  POS_NPC: [300, 640, 980],   // x dos NPCs na vila (canvas lógico)
  POS: { heroi: { x: 290, y: 565, h: 290 }, inimigo: { x: 960, y: 565, h: 260 }, chefe: { x: 950, y: 585, h: 400 } },

  // ---------------- Inicialização ----------------
  async iniciar() {
    this.canvas = document.getElementById('tela');
    this.ctx = this.canvas.getContext('2d');
    this.bufHeroi = this.criarBuffer(620, 620);
    this.bufInimigo = this.criarBuffer(820, 720);
    this.limparFx();
    Som.carregarPreferencia();
    Save.migrar();
    this.carregarVelocidade();
    this.carregarQte();
    UI.iniciar();
    this.ajustarTela();
    window.addEventListener('resize', () => this.ajustarTela());
    window.addEventListener('orientationchange', () => setTimeout(() => this.ajustarTela(), 200));
    window.addEventListener('keydown', (e) => this.teclado(e));
    window.addEventListener('pointerdown', () => Som.iniciar(), { passive: true });
    // Toque em qualquer lugar da tela durante o golpe no tempo
    document.getElementById('stage').addEventListener('pointerdown', (e) => {
      if (!this.qteAtual) return;
      e.preventDefault(); e.stopPropagation();
      this.resolverQte(performance.now());
    }, true);
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.jogador && !this.batalha) Save.salvar(this.jogador); });
    UI.mostrar('carregando');
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    await Assets.carregar(p => UI.progresso(p));
    this.irPara('titulo');
  },

  criarBuffer(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; },

  // Canvas lógico 1280×720 com letterbox; a UI acompanha o mesmo retângulo
  ajustarTela() {
    const W = window.innerWidth, H = window.innerHeight;
    const s = Math.min(W / 1280, H / 720);
    const w = Math.floor(1280 * s), h = Math.floor(720 * s);
    const st = document.getElementById('stage');
    st.style.width = w + 'px'; st.style.height = h + 'px';
    st.style.left = Math.floor((W - w) / 2) + 'px'; st.style.top = Math.floor((H - h) / 2) + 'px';
    st.style.fontSize = Math.max(12, Math.min(18, 18 * s)).toFixed(1) + 'px';
    st.classList.toggle('compacto', h < 520);
  },

  irPara(cena) {
    this.cena = cena;
    if (cena === 'vila' && this.jogador && this.jogador.sequencia) this.zerarSequencia();
    const temas = { titulo: 'titulo', slots: 'titulo', criacao: 'titulo', vila: 'vila', mapa: 'mapa', final: 'titulo' };
    if (temas[cena]) Som.setTema(temas[cena]);
    this.limparFx();
    UI.mostrar(cena);
  },

  // Pausas da batalha respeitam a velocidade escolhida (1× ou 2×)
  esperar(ms) { return new Promise(r => setTimeout(r, ms / this.vel)); },
  vel: 1,
  carregarVelocidade() {
    try { const v = +localStorage.getItem('imperfectWorld_vel'); if (DATA.BAL.velocidades.includes(v)) this.vel = v; } catch (e) { this.vel = 1; }
  },
  alternarVelocidade() {
    const vs = DATA.BAL.velocidades;
    this.vel = vs[(vs.indexOf(this.vel) + 1) % vs.length];
    try { localStorage.setItem('imperfectWorld_vel', String(this.vel)); } catch (e) { /* armazenamento indisponível */ }
    document.querySelectorAll('[data-acao="velocidade"]').forEach(b => {
      b.textContent = b.classList.contains('vel') ? this.vel + '×' : `Batalha: ${this.vel === 1 ? 'normal' : 'rápida (' + this.vel + '×)'}`;
    });
    UI.toast(this.vel === 1 ? 'Batalha em velocidade normal.' : `Batalha em velocidade ${this.vel}×.`);
  },

  // ---------------- Golpe no tempo certo (QTE) ----------------
  // Mostra um anel que se fecha; o jogador toca/aperta espaço quando ele encosta no círculo.
  // Resolve com 'perfeito', 'bom', 'falhou' ou 'neutro' (desligado).
  qteLigado: true,
  qteAtual: null,
  carregarQte() {
    try { this.qteLigado = localStorage.getItem('imperfectWorld_qte') !== '0'; } catch (e) { this.qteLigado = true; }
  },
  alternarQte() {
    this.qteLigado = !this.qteLigado;
    try { localStorage.setItem('imperfectWorld_qte', this.qteLigado ? '1' : '0'); } catch (e) { /* armazenamento indisponível */ }
    document.querySelectorAll('[data-acao="qte"]').forEach(b => b.textContent = `Golpe no tempo: ${this.qteLigado ? 'ligado' : 'desligado'}`);
    UI.toast(this.qteLigado ? 'Golpe no tempo ligado: toque quando o anel fechar.' : 'Golpe no tempo desligado.');
  },
  qte(tipo, lado) {
    if (!this.qteLigado || !this.batalha) return Promise.resolve('neutro');
    const B = DATA.BAL;
    return new Promise(res => {
      this.qteAtual = { tipo, lado, t0: performance.now(), dur: B.qteDuracao * 1000, res, fim: false };
      this.qteTimer = setTimeout(() => this.resolverQte(null), B.qteDuracao * 1000 + B.qteBom * 1000 + 40);
    });
  },
  resolverQte(agora) {
    const q = this.qteAtual, B = DATA.BAL;
    if (!q || q.fim) return;
    q.fim = true;
    clearTimeout(this.qteTimer);
    let r = 'falhou';
    if (agora != null) {
      const dt = Math.abs((agora - q.t0) - q.dur) / 1000;
      if (dt <= B.qtePerfeito) r = 'perfeito'; else if (dt <= B.qteBom) r = 'bom';
    }
    const lado = q.tipo === 'ataque' ? q.lado : 'heroi';
    if (r === 'perfeito') { this.fx.numero(lado, q.tipo === 'ataque' ? 'PERFEITO!' : 'APAROU!', 'perfeito'); Som.nivelCurto(); }
    else if (r === 'bom') this.fx.numero(lado, 'Bom', 'bom');
    else if (agora != null) this.fx.numero(lado, q.tipo === 'ataque' ? 'Cedo demais' : 'Errou o tempo', 'miss');
    this.qteFeito = { tipo: q.tipo, lado: q.lado, r, t: this.t };
    this.qteAtual = null;
    setTimeout(() => q.res(r), 90);
  },

  // Bônus de XP pela sequência de vitórias atual
  bonusSequencia() {
    const j = this.jogador, B = DATA.BAL;
    return j ? Math.min(B.sequenciaMax, (j.sequencia || 0) * B.sequenciaBonus) : 0;
  },
  zerarSequencia() { if (this.jogador) this.jogador.sequencia = 0; },

  // ---------------- Diálogos da história ----------------
  // Mostra uma cena (lista de falas) e resolve quando o jogador termina
  dialogo(cena) {
    const falas = DATA.HISTORIA[cena];
    if (!falas || !falas.length) return Promise.resolve();
    if (this.jogador) { this.jogador.vistos = this.jogador.vistos || {}; this.jogador.vistos[cena] = true; }
    return new Promise(resolve => {
      this.cenaDialogo = { falas, i: 0, fim: resolve };
      UI.abrirModal('dialogo', UI.htmlDialogo(falas[0], 0, falas.length), false, 'dialogo-modal');
      UI.desenharRetrato();
    });
  },
  avancarDialogo(pular) {
    const c = this.cenaDialogo;
    if (!c) return;
    c.i++;
    if (pular || c.i >= c.falas.length) {
      this.cenaDialogo = null;
      UI.fecharModal();
      c.fim();
      return;
    }
    Som.clique();
    UI.refazerModal('dialogo', UI.htmlDialogo(c.falas[c.i], c.i, c.falas.length), 'dialogo-modal');
    UI.desenharRetrato();
  },
  // Toca a cena só na primeira vez
  async dialogoUmaVez(cena) {
    const j = this.jogador;
    if (!j || (j.vistos && j.vistos[cena]) || !DATA.HISTORIA[cena]) return;
    await this.dialogo(cena);
  },

  // ---------------- Itens sorteados ----------------
  gerarItem(tier, raridade, slotFixo) {
    const j = this.jogador;
    const slots = ['arma', 'armadura', 'amuleto'];
    const slot = slotFixo || slots[Math.floor(Math.random() * slots.length)];
    const item = { uid: j.proxUid++, slot, tier, plus: 0, raridade };
    if (slot === 'arma') item.tipoArma = DATA.CLASSES[j.classe].arma;
    const n = DATA.RARIDADES[raridade].bonus;
    if (n) {
      const chaves = Object.keys(DATA.AFIXOS).sort(() => Math.random() - 0.5).slice(0, n);
      item.bonus = {};
      chaves.forEach(k => item.bonus[k] = DATA.AFIXOS[k].valores[tier]);
    }
    return item;
  },
  // Item exclusivo de chefe
  gerarLendario(idChefe) {
    const L = DATA.LENDARIOS[idChefe], j = this.jogador;
    const item = { uid: j.proxUid++, slot: L.slot, tier: L.tier, plus: 0, raridade: 'lendario', nomeUnico: L.nome, bonus: Object.assign({}, L.bonus) };
    if (L.slot === 'arma') item.tipoArma = DATA.CLASSES[j.classe].arma;
    return item;
  },
  // Guarda o item; se o espaço estiver vazio e o nível permitir, já equipa
  receberItem(item) {
    const j = this.jogador;
    if (!j.equip[item.slot] && j.nivel >= Calc.nivelItem(item)) { j.equip[item.slot] = item; return true; }
    j.mochila.push(item);
    return false;
  },

  // ---------------- Game loop ----------------
  loop(ts) {
    const dt = Math.min(0.05, ((ts - this.ultimo) / 1000) || 0);
    this.ultimo = ts;
    this.t += dt;
    this.atualizar(dt);
    this.renderizar();
    requestAnimationFrame(this.loop);
  },

  atualizar(dt) {
    if (this.jogador && ['vila', 'mapa', 'batalha'].includes(this.cena)) this.jogador.stats.tempo += dt;
    const fx = this.fx;
    fx.numeros.forEach(n => { n.t += dt; n.y -= 70 * dt; });
    fx.numeros = fx.numeros.filter(n => n.t < 1.2);
    fx.lista.forEach(p => {
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt; p.rot = (p.rot || 0) + (p.vr || 0) * dt;
    });
    fx.lista = fx.lista.filter(p => p.t < p.vida);
    fx.raios.forEach(r => r.t += dt);
    fx.raios = fx.raios.filter(r => r.t < r.vida);
    Object.keys(fx.flash).forEach(l => { fx.flash[l] = Math.max(0, fx.flash[l] - dt * 4); });
    // inimigos derrotados somem aos poucos
    if (this.batalha) this.batalha.inimigos.forEach(e => { if (e.hp <= 0 && e.morteT < 1) e.morteT = Math.min(1, e.morteT + dt * 1.6); });
    fx.tremorMag = Math.max(0, fx.tremorMag - dt * 40);
    fx.flashTela = Math.max(0, fx.flashTela - dt * 3);
    if (fx.escurecer > 0) fx.escurecer = Math.max(0, fx.escurecer - dt * 0.8);
    if (fx.desvio > 0) fx.desvio = Math.max(0, fx.desvio - dt * 3);
    if (fx.fuga > 0 && fx.fuga < 2) fx.fuga = Math.min(2, fx.fuga + dt * 1.5);
    if (fx.frameAte && this.t > fx.frameAte) { fx.frame = 0; fx.frameAte = 0; }
  },

  // ---------------- Efeitos visuais ----------------
  fx: null,
  limparFx() {
    this.fx = {
      numeros: [], lista: [], raios: [],
      flash: { heroi: 0 }, avanco: { heroi: 0 },   // chaves: 'heroi' ou o índice do inimigo
      tremorMag: 0, flashTela: 0, escurecer: 0, desvio: 0, fuga: 0, frame: 0, frameAte: 0,
    };
    // Funções expostas para a batalha
    const fx = this.fx;
    // lado: 'heroi', o índice de um inimigo, ou 'inimigo' (= alvo atual)
    const lado_ = (l) => (l === 'inimigo' ? (this.batalha ? this.batalha.alvoAtual.i : 0) : l);
    fx.numero = (lado, texto, tipo) => {
      lado = lado_(lado);
      const c = this.centro(lado);
      const desloc = fx.numeros.filter(n => n.lado === lado && n.t < 0.4).length * 34;
      fx.numeros.push({ lado, texto, tipo, x: c.x + (Math.random() * 40 - 20), y: c.y - 40 - desloc, t: 0 });
    };
    fx.investida = (lado) => new Promise(res => {
      lado = lado_(lado);
      const ini = performance.now(), dur = 320 / this.vel;
      const passo = () => {
        const p = Math.min(1, (performance.now() - ini) / dur);
        fx.avanco[lado] = Math.sin(p * Math.PI);
        if (p < 1) requestAnimationFrame(passo); else { fx.avanco[lado] = 0; res(); }
      };
      requestAnimationFrame(passo);
    });
    fx.impacto = (lado, mag) => {
      lado = lado_(lado);
      fx.flash[lado] = 1;
      fx.tremorMag = Math.max(fx.tremorMag, mag || 8);
      if (lado === 'heroi') fx.flashTela = Math.max(fx.flashTela, 0.35);
      this.emitir(lado, 'faisca', 10);
    };
    fx.tremor = (mag) => { fx.tremorMag = Math.max(fx.tremorMag, mag); };
    fx.frameHeroi = (f, ms) => { fx.frame = f; fx.frameAte = this.t + ms / 1000; };
    fx.particulas = (lado, tipo) => this.emitirHabilidade(lado_(lado), tipo);
  },

  centro(lado) {
    if (lado === 'heroi') { const p = this.POS.heroi; return { x: p.x + 20, y: p.y - p.h * 0.55 }; }
    const p = this.posInimigo(typeof lado === 'number' ? lado : 0);
    return { x: p.x, y: p.y - p.h * 0.5 };
  },

  // Posição de cada inimigo na tela (1 a 3; os de trás ficam mais acima e menores)
  LAYOUT_HORDA: {
    1: [{ x: 960, y: 565, h: 260 }],
    2: [{ x: 830, y: 585, h: 240 }, { x: 1110, y: 545, h: 225 }],
    3: [{ x: 780, y: 612, h: 215 }, { x: 1150, y: 612, h: 215 }, { x: 965, y: 565, h: 190 }],
  },
  posInimigo(i) {
    const b = this.batalha;
    if (!b) return this.POS.inimigo;
    if (b.chefe) return this.POS.chefe;
    const lista = this.LAYOUT_HORDA[Math.min(3, b.inimigos.length)];
    return lista[i] || lista[0];
  },

  // Emite partículas simples
  emitir(lado, tipo, qtd) {
    const c = this.centro(lado);
    const cores = {
      faisca: ['#FFFFFF', '#FFE08A'], fogo: ['#FF7A1A', '#FFC23A', '#B8322E'], folha: ['#2E8B6A', '#5FBF7A', '#A6D96A'],
      pedra: ['#8A6A4A', '#5A4630', '#C9A877'], aura: ['#D4A23A', '#FFE08A'], arcano: ['#9B7BD0', '#6A4C93', '#CDB8F0'],
      cura: ['#6EE7A0', '#C8FFD8'], defesa: ['#9FC3FF', '#FFFFFF'], veneno: ['#9BE15D', '#6A4C93'], nevoa: ['rgba(235,240,250,.55)'],
      eclipse: ['#2A1A4A', '#6A4C93', '#D4A23A'], corte: ['#FFFFFF', '#F2E6C9'], sangue: ['#B8322E', '#FF5A4E', '#7E1F1B'], raio: ['#FFFFFF', '#BFE3FF', '#FFE08A'],
    }[tipo] || ['#fff'];
    for (let i = 0; i < (qtd || 24); i++) {
      const a = Math.random() * TAU, v = 80 + Math.random() * 260;
      const p = {
        tipo, x: c.x + (Math.random() - 0.5) * 60, y: c.y + (Math.random() - 0.5) * 80,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0, t: 0, vida: 0.5 + Math.random() * 0.5,
        cor: cores[i % cores.length], tam: 4 + Math.random() * 7, vr: (Math.random() - 0.5) * 12,
      };
      if (tipo === 'fogo') { p.vy = -60 - Math.random() * 200; p.vx *= 0.4; p.tam = 8 + Math.random() * 12; }
      if (tipo === 'folha') { const ini = lado !== 'heroi'; p.vx = ini ? 200 + Math.random() * 300 : -200 - Math.random() * 300; p.vy = (Math.random() - 0.5) * 200; p.tam = 8 + Math.random() * 6; p.x = c.x + (ini ? -260 : 0) + Math.random() * 60; }
      if (tipo === 'pedra') { p.vy = -200 - Math.random() * 300; p.g = 900; p.y = c.y + 100; p.tam = 6 + Math.random() * 10; }
      if (tipo === 'aura' || tipo === 'cura' || tipo === 'defesa') { p.vx *= 0.3; p.vy = -80 - Math.random() * 160; p.x = c.x + (Math.random() - 0.5) * 140; p.y = c.y + 100; }
      if (tipo === 'nevoa') { p.vx *= 0.25; p.vy *= 0.2; p.tam = 40 + Math.random() * 50; p.vida = 1.2; }
      if (tipo === 'eclipse') { p.vx *= 0.6; p.vy *= 0.6; p.tam = 8 + Math.random() * 14; p.vida = 1; }
      if (tipo === 'corte') { p.vida = 0.35; }
      this.fx.lista.push(p);
    }
  },

  emitirHabilidade(lado, tipo) {
    if (tipo === 'raio') {
      const c = this.centro(lado);
      for (let k = 0; k < 3; k++) {
        const pts = []; let x = c.x + (Math.random() - 0.5) * 120;
        for (let y = 0; y <= c.y + 40; y += 40) { pts.push([x, y]); x += (Math.random() - 0.5) * 70; }
        this.fx.raios.push({ pts, t: -k * 0.08, vida: 0.4 });
      }
      this.fx.flashTela = 0.5;
    }
    if (tipo === 'corte') {
      const c = this.centro(lado);
      this.fx.raios.push({ corte: true, x: c.x, y: c.y, t: 0, vida: 0.3 });
    }
    this.emitir(lado, tipo, tipo === 'nevoa' ? 14 : 30);
  },

  // ---------------- Renderização ----------------
  renderizar() {
    const ctx = this.ctx, fx = this.fx;
    ctx.save();
    if (fx.tremorMag > 0.3) ctx.translate((Math.random() - 0.5) * fx.tremorMag * 2, (Math.random() - 0.5) * fx.tremorMag * 2);
    switch (this.cena) {
      case 'vila': this.cenaVila(ctx); break;
      case 'mapa': this.cenaMapa(ctx); break;
      case 'batalha': this.cenaBatalha(ctx); break;
      case 'final': this.cenaTitulo(ctx, true); break;
      default: this.cenaTitulo(ctx, false);
    }
    ctx.restore();
    if (fx.flashTela > 0) { ctx.fillStyle = `rgba(255,255,255,${fx.flashTela * 0.5})`; ctx.fillRect(0, 0, 1280, 720); }
  },

  cenaTitulo(ctx, final) {
    if (Assets.tem('title_screen')) Assets.desenharFundo(ctx, 'title_screen');
    else Assets.desenharFundo(ctx, 'bg_titulo');
    // brilhos dourados flutuando
    for (let i = 0; i < 40; i++) {
      const x = (i * 197 + this.t * (12 + i % 5 * 6)) % 1300 - 10;
      const y = 720 - ((i * 131 + this.t * (20 + i % 7 * 5)) % 760);
      ctx.fillStyle = `rgba(255,220,130,${0.25 + 0.25 * Math.sin(this.t * 2 + i)})`;
      ctx.beginPath(); ctx.arc(x, y, 2 + i % 3, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = final ? 'rgba(212,162,58,.25)' : 'rgba(27,31,59,.35)';
    ctx.fillRect(0, 0, 1280, 720);
  },

  cenaVila(ctx) {
    Assets.desenharFundo(ctx, 'bg_vila');
    this.POS_NPC.forEach((x, i) => {
      const b = 1 + 0.02 * Math.sin(this.t * 2 + i);
      ctx.save(); ctx.translate(x, 600); ctx.scale(b, b);
      Arte.npc(ctx, i, 0, 0, 250);
      ctx.restore();
    });
  },

  cenaMapa(ctx) {
    Assets.desenharFundo(ctx, 'bg_mapa');
    if (!this.jogador) return;
    DATA.ORDEM_ZONAS.forEach(z => {
      const Z = DATA.ZONAS[z];
      if (!this.zonaLiberada(z)) return;
      const x = Z.pos.x * 1280, y = Z.pos.y * 720, r = 46 + Math.sin(this.t * 3) * 8;
      const g = ctx.createRadialGradient(x, y, 4, x, y, r * 1.8);
      g.addColorStop(0, 'rgba(212,162,58,.55)'); g.addColorStop(1, 'rgba(212,162,58,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.8, 0, TAU); ctx.fill();
    });
  },

  cenaBatalha(ctx) {
    const b = this.batalha, fx = this.fx;
    if (!b) return;
    const zona = DATA.ZONAS[b.inimigos[0].d.zona];
    Assets.desenharFundo(ctx, zona.bg);
    // ---- herói ----
    const ph = this.POS.heroi;
    const bh = this.bufHeroi, cb = bh.getContext('2d');
    cb.clearRect(0, 0, bh.width, bh.height);
    Arte.heroi(cb, this.jogador.classe, fx.frame, 310, 600, ph.h);
    this.aplicarFlash(bh, fx.flash.heroi);
    let hx = ph.x + fx.avanco.heroi * 40 - fx.desvio * 50 - (fx.fuga > 0 ? fx.fuga * 500 : 0);
    const resp = 1 + 0.02 * Math.sin(this.t * 2.4);
    ctx.save(); ctx.translate(hx, ph.y); ctx.scale(resp, resp);
    if (b.h.defendendo) { ctx.fillStyle = 'rgba(159,195,255,.18)'; ctx.beginPath(); ctx.ellipse(10, -ph.h * 0.5, ph.h * 0.42, ph.h * 0.6, 0, 0, TAU); ctx.fill(); }
    if (b.h.escudo > 0) { ctx.strokeStyle = 'rgba(155,123,208,.8)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(10, -ph.h * 0.5, ph.h * 0.42, ph.h * 0.6, 0, 0, TAU); ctx.stroke(); }
    ctx.drawImage(bh, -310, -600);
    ctx.restore();
    // ---- inimigos (desenhados de trás para frente) ----
    const ordem = b.inimigos.slice().sort((p, q) => this.posInimigo(p.i).y - this.posInimigo(q.i).y);
    const mostrarAlvo = b.horda && b.vivos.length > 1 && !b.ocupado && !b.acabou;
    for (const e of ordem) {
      if (e.morteT >= 1) continue;
      const pi = this.posInimigo(e.i);
      const bi = this.bufInimigo, ci = bi.getContext('2d');
      ci.clearRect(0, 0, bi.width, bi.height);
      Arte.inimigo(ci, e.id, 410, 700, pi.h, { t: this.t + e.i * 0.7, fase2: e.fase === 2 });
      this.aplicarFlash(bi, fx.flash[e.i] || 0);
      const respI = 1 + 0.02 * Math.sin(this.t * 2 + 1 + e.i);
      const morte = e.morteT;
      ctx.save();
      ctx.globalAlpha = 1 - morte;
      ctx.translate(pi.x - (fx.avanco[e.i] || 0) * 40, pi.y + morte * 40);
      ctx.scale(respI, respI * (1 - morte * 0.2));
      if (e.atordoado > 0 && e.hp > 0) { // estrelinhas de atordoado
        for (let k = 0; k < 3; k++) { const a = this.t * 4 + k * TAU / 3; ctx.fillStyle = '#FFE08A'; ctx.font = '28px serif'; ctx.fillText('✦', Math.cos(a) * 50 - 10, -pi.h - 10 + Math.sin(a) * 12); }
      }
      ctx.drawImage(bi, -410, -700);
      ctx.restore();
      // seta dourada sobre o alvo escolhido
      if (mostrarAlvo && e === b.alvoAtual) {
        const y = pi.y - pi.h - (e.intencao ? 66 : 26) + Math.sin(this.t * 5) * 6;
        ctx.save(); ctx.fillStyle = DATA.PALETA.ouro; ctx.strokeStyle = '#121212'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(pi.x - 18, y - 22); ctx.lineTo(pi.x + 18, y - 22); ctx.lineTo(pi.x, y); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
      }
    }
    // ---- escurecimento do Eclipse ----
    if (fx.escurecer > 0) { ctx.fillStyle = `rgba(8,6,20,${Math.min(0.7, fx.escurecer)})`; ctx.fillRect(-20, -20, 1320, 760); }
    // névoa sobre o herói
    if (b.h.nevoa > 0) {
      ctx.fillStyle = 'rgba(230,236,245,.16)';
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(ph.x + Math.sin(this.t + i) * 60, ph.y - 60 - i * 50, 160, 30, 0, 0, TAU); ctx.fill(); }
    }
    this.desenharIntencoes(ctx, b);
    this.desenharParticulas(ctx);
    this.desenharNumeros(ctx);
    this.desenharQte(ctx);
  },

  // Balão acima de cada monstro com o que ele vai fazer no próximo turno
  desenharIntencoes(ctx, b) {
    const ICONES = {
      atacar: ['⚔', '#F2E6C9'], forte: ['⚔⚔', '#FFB65C'], cuspe: ['☠', '#9BE15D'], proteger: ['⛨', '#8DB8FF'],
      defender: ['⛨', '#8DB8FF'], fugir: ['➜', '#C9CED8'], especial: ['⚠', '#FF5A4E'], quebrado: ['✦', '#FFE08A'],
    };
    for (const e of b.inimigos) {
      if (e.hp <= 0 || !e.intencao || e.morteT > 0) continue;
      const it = e.intencao, p = this.posInimigo(e.i), ic = ICONES[it.tipo] || ICONES.atacar;
      const txt = ic[0] + (it.valor != null ? ' ' + it.valor : '');
      const y = p.y - p.h - 14 + Math.sin(this.t * 3 + e.i) * 3;
      ctx.save();
      ctx.font = '700 26px "Nunito Sans", system-ui, sans-serif';
      const w = ctx.measureText(txt).width + 26;
      ctx.fillStyle = it.tipo === 'especial' ? 'rgba(120,20,20,.92)' : 'rgba(18,20,40,.88)';
      ctx.strokeStyle = it.tipo === 'especial' ? '#FF5A4E' : DATA.PALETA.ouro; ctx.lineWidth = 3;
      const x0 = p.x - w / 2, h = 40;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0, y - h, w, h, 12) : ctx.rect(x0, y - h, w, h); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p.x - 8, y); ctx.lineTo(p.x + 8, y); ctx.lineTo(p.x, y + 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = ic[1]; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, p.x, y - h / 2 + 1);
      ctx.restore();
    }
  },

  // Anel do golpe no tempo certo
  desenharQte(ctx) {
    const q = this.qteAtual;
    if (!q) return;
    const ataque = q.tipo === 'ataque';
    const c = ataque ? this.centro(q.lado) : this.centro('heroi');
    const p = (performance.now() - q.t0) / q.dur;
    const r1 = 52, r0 = 190;
    const r = Math.max(r1 * 0.85, r0 + (r1 - r0) * Math.min(p, 1.15));
    const B = DATA.BAL;
    const naJanela = Math.abs(p - 1) * q.dur / 1000 <= B.qteBom;
    const cor = ataque ? '255,214,90' : '255,90,78';
    ctx.save();
    // círculo-alvo
    ctx.lineWidth = 6; ctx.strokeStyle = naJanela ? `rgba(${cor},1)` : 'rgba(255,255,255,.85)';
    ctx.shadowColor = `rgba(${cor},.9)`; ctx.shadowBlur = naJanela ? 24 : 6;
    ctx.beginPath(); ctx.arc(c.x, c.y, r1, 0, TAU); ctx.stroke();
    // anel que fecha
    ctx.lineWidth = 8; ctx.strokeStyle = `rgba(${cor},${Math.min(1, 0.4 + p)})`;
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = '800 30px "Nunito Sans", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = '#121212'; ctx.fillStyle = `rgb(${cor})`;
    const txt = ataque ? 'TOQUE!' : 'APARE!';
    ctx.strokeText(txt, c.x, c.y - r0 - 10); ctx.fillText(txt, c.x, c.y - r0 - 10);
    if (!ataque) { // "!" sobre o monstro que vai atacar
      const pe = this.posInimigo(q.lado);
      ctx.font = '900 64px "Nunito Sans", system-ui, sans-serif';
      ctx.strokeText('!', pe.x, pe.y - pe.h * 0.55); ctx.fillText('!', pe.x, pe.y - pe.h * 0.55);
    }
    ctx.restore();
  },

  aplicarFlash(buf, v) {
    if (v <= 0) return;
    const c = buf.getContext('2d');
    c.save(); c.globalCompositeOperation = 'source-atop';
    c.fillStyle = `rgba(255,255,255,${Math.min(0.9, v)})`; c.fillRect(0, 0, buf.width, buf.height);
    c.restore();
  },

  desenharParticulas(ctx) {
    const fx = this.fx;
    fx.raios.forEach(r => {
      if (r.t < 0) return;
      const a = 1 - r.t / r.vida;
      if (r.corte) {
        ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 10 * a + 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(r.x - 120, r.y - 110); ctx.quadraticCurveTo(r.x, r.y - 20, r.x + 110, r.y + 120); ctx.stroke(); ctx.restore();
        return;
      }
      ctx.save(); ctx.globalAlpha = a;
      ctx.strokeStyle = '#BFE3FF'; ctx.lineWidth = 12; ctx.shadowColor = '#9FD0FF'; ctx.shadowBlur = 24;
      ctx.beginPath(); r.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
    });
    fx.lista.forEach(p => {
      const a = Math.max(0, 1 - p.t / p.vida);
      ctx.save(); ctx.globalAlpha = a; ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
      ctx.fillStyle = p.cor;
      switch (p.tipo) {
        case 'folha': ctx.beginPath(); ctx.ellipse(0, 0, p.tam, p.tam * 0.4, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1.5; ctx.stroke(); break;
        case 'cura': ctx.fillRect(-p.tam / 2, -p.tam * 1.5, p.tam, p.tam * 3); ctx.fillRect(-p.tam * 1.5, -p.tam / 2, p.tam * 3, p.tam); break;
        case 'pedra': ctx.fillRect(-p.tam / 2, -p.tam / 2, p.tam, p.tam); ctx.strokeStyle = '#121212'; ctx.lineWidth = 2; ctx.strokeRect(-p.tam / 2, -p.tam / 2, p.tam, p.tam); break;
        case 'corte': case 'faisca': ctx.fillRect(-p.tam * 1.5, -1.5, p.tam * 3, 3); break;
        default: ctx.beginPath(); ctx.arc(0, 0, p.tam * (p.tipo === 'fogo' ? a : 1), 0, TAU); ctx.fill();
      }
      ctx.restore();
    });
  },

  desenharNumeros(ctx) {
    const cores = { perfeito: '#FFE08A', bom: '#BFE3FF', quebra: '#FF9A3A', eficaz: '#FF9A3A', aviso: '#FF5A4E', dano: '#FFFFFF', critico: '#FFD54A', cura: '#6EE7A0', mp: '#8DB8FF', miss: '#C9CED8', status: '#F2E6C9', veneno: '#9BE15D', queimadura: '#FF9A3A' };
    this.fx.numeros.forEach(n => {
      const a = n.t < 0.8 ? 1 : 1 - (n.t - 0.8) / 0.4;
      const pop = n.t < 0.12 ? 0.6 + n.t / 0.12 * 0.6 : 1.2 - Math.min(0.2, (n.t - 0.12));
      const tam = n.tipo === 'aviso' ? 84 : n.tipo === 'perfeito' || n.tipo === 'quebra' ? 54 : n.tipo === 'critico' ? 58 : (n.tipo === 'status' || n.tipo === 'miss' || n.tipo === 'mp') ? 30 : 44;
      ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(n.x, n.y); ctx.scale(pop, pop);
      ctx.font = `${tam}px Marcellus, "Palatino Linotype", Georgia, serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 7; ctx.strokeStyle = '#121212'; ctx.lineJoin = 'round';
      ctx.strokeText(n.texto, 0, 0);
      ctx.fillStyle = cores[n.tipo] || '#fff'; ctx.fillText(n.texto, 0, 0);
      ctx.restore();
    });
  },

  // ---------------- Teclado ----------------
  teclado(e) {
    Som.iniciar();
    const k = e.key;
    if (this.qteAtual) {
      if (k === ' ' || k === 'Enter' || k === 'Spacebar') { e.preventDefault(); if (!e.repeat) this.resolverQte(performance.now()); }
      return;
    }
    if (e.target && e.target.tagName === 'INPUT') {
      if (k === 'Enter') { e.preventDefault(); this.acao('comecar', {}); }
      return;
    }
    if (k === 'Escape') {
      e.preventDefault();
      if (UI.submenu) { UI.submenu = null; UI.renderSubmenu(); return; }
      const topo = UI.topo();
      if (topo && topo.id === 'dialogo') { this.avancarDialogo(true); return; }
      if (topo) { if (topo.fechavel) UI.fecharModal(); return; }
      if (['vila', 'mapa', 'batalha'].includes(UI.tela)) UI.abrirPausa();
      return;
    }
    if (k === 'Enter') {
      const a = document.activeElement;
      if (a && a.tagName === 'BUTTON' && UI.raiz.contains(a)) return; // o próprio botão em foco recebe o Enter
      const raiz = UI.topo() ? UI.topo().el : UI.camadaTela;
      const p = raiz.querySelector('[data-primary]:not([disabled])');
      if (p) { e.preventDefault(); p.click(); }
      return;
    }
    if ((k === 'v' || k === 'V') && !UI.topo()) { this.alternarVelocidade(); return; }
    if (k === 'i' || k === 'I') {
      if (UI.topo() && UI.topo().id === 'inventario') { UI.fecharModal(); return; }
      if (!UI.topo() && ['vila', 'mapa', 'batalha'].includes(UI.tela)) UI.abrirInventario();
      return;
    }
    if (UI.tela === 'batalha' && !UI.topo() && this.batalha) {
      if (UI.submenu === 'itens' && /^[1-5]$/.test(k)) { this.acao('item', { item: Object.keys(DATA.POCOES)[+k - 1] }); return; }
      const mapa = { '1': 'atacar', '2': 'menuHab', '3': 'menuItem', '4': 'defender', '5': 'fugir' };
      if (mapa[k]) { e.preventDefault(); this.acao(mapa[k], {}); return; }
      if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'Tab') { e.preventDefault(); this.batalha.trocarAlvo(e.shiftKey ? -1 : 1); return; }
      if (k === 'ArrowLeft' || k === 'ArrowUp') { e.preventDefault(); this.batalha.trocarAlvo(-1); return; }
      const idx = { q: 0, w: 1, e: 2, r: 3, t: 4, y: 5 }[k.toLowerCase()];
      if (idx !== undefined) { e.preventDefault(); this.acao('habilidade', { hab: DATA.CLASSES[this.jogador.classe].habilidades[idx] }); }
    }
  },

  // ---------------- Regras ----------------
  zonaLiberada(z) {
    const Z = DATA.ZONAS[z], j = this.jogador;
    return !!j && j.nivel >= Z.nivelMin && (!Z.requerChefe || !!j.chefes[Z.requerChefe]);
  },

  limitarVitais() {
    const j = this.jogador;
    j.hp = Math.max(0, Math.min(j.hp, Calc.hpMax(j)));
    j.mp = Math.max(0, Math.min(j.mp, Calc.mpMax(j)));
  },

  salvar() { Save.salvar(this.jogador); },

  // Ganha XP e sobe de nível; devolve a lista dos novos níveis
  ganharXP(xp) {
    const j = this.jogador, B = DATA.BAL, novos = [];
    if (j.nivel >= B.nivelMax) return novos;
    j.xp += xp;
    while (j.nivel < B.nivelMax && j.xp >= Calc.xpProximo(j.nivel)) {
      j.xp -= Calc.xpProximo(j.nivel);
      j.nivel++;
      j.pontos += B.pontosPorNivel;
      novos.push(j.nivel);
    }
    if (j.nivel >= B.nivelMax) j.xp = 0;
    if (novos.length) { j.hp = Calc.hpMax(j); j.mp = Calc.mpMax(j); }
    return novos;
  },

  custoAprimorar(it) { return DATA.BAL.aprimCustoBase * Calc.nivelItem(it) * (it.plus + 1); },

  acharItem(uid) {
    const j = this.jogador;
    for (const s of ['arma', 'armadura', 'amuleto']) if (j.equip[s] && j.equip[s].uid === uid) return j.equip[s];
    return j.mochila.find(i => i.uid === uid);
  },

  // id = um inimigo, ou uma lista de ids (horda)
  iniciarBatalha(id) {
    UI.fecharTodos();
    const ids = Array.isArray(id) ? id : [id];
    const d = DATA.INIMIGOS[ids[0]];
    this.batalha = new Batalha(ids);
    this.zonaAtual = d.zona;
    this.posVitoria = null;
    this.cena = 'batalha';
    this.limparFx();
    Som.setTema(d.chefe ? 'chefe' : DATA.ZONAS[d.zona].musica);
    UI.mostrar('batalha');
  },

  // Sorteia a horda de uma caça: 1 a 3 monstros comuns da zona
  sortearHorda(zona) {
    const Z = DATA.ZONAS[zona], B = DATA.BAL, j = this.jogador;
    let max = 3;
    if (j.nivel < B.hordaNivel3) max = 2;
    if (j.stats.batalhas < B.hordaBatalhasTutorial) max = 1;
    const pesos = B.hordaPesos.slice(0, max);
    let r = Math.random() * pesos.reduce((a, c) => a + c, 0), n = 1;
    for (let k = 0; k < pesos.length; k++) { r -= pesos[k]; if (r <= 0) { n = k + 1; break; } }
    return Array.from({ length: n }, () => Z.comuns[Math.floor(Math.random() * Z.comuns.length)]);
  },

  fimDeBatalha(res) {
    const j = this.jogador, b = this.batalha, d = b.d, B = DATA.BAL;
    j.stats.batalhas++;
    UI.submenu = null; UI.renderSubmenu();
    if (res === 'vitoria') {
      j.stats.vitorias++;
      const bonusSeq = this.bonusSequencia();
      j.sequencia = (j.sequencia || 0) + 1;
      const derrotados = b.inimigos.filter(e => !e.fugiu);
      const xp = Math.round(derrotados.reduce((t, e) => t + e.d.xp, 0) * B.multXP * (1 + bonusSeq));
      const ouro = Math.round(derrotados.reduce((t, e) => t + Calc.inteiro(e.d.ouro[0], e.d.ouro[1]), 0) * B.multOuro);
      j.ouro += ouro;
      Som.moeda();
      const drops = [], itens = [];
      const tierZona = DATA.ZONAS[d.zona].tierDrop;
      if (b.chefe) {
        // Chefe: item exclusivo na 1ª vitória (depois, 25% de chance); senão, um Épico da zona
        const L = DATA.LENDARIOS[b.id];
        if (L && (!j.lendarios[b.id] || Math.random() < L.chanceRepetir)) { j.lendarios[b.id] = true; itens.push(this.gerarLendario(b.id)); }
        else itens.push(this.gerarItem(tierZona, 'epico'));
      } else {
        // Cada monstro da horda tem sua chance de deixar algo
        derrotados.forEach(() => {
          if (Math.random() < B.chanceDropPocao) { j.pocoes.vidaP++; drops.push('vidaP'); }
          if (Math.random() < B.chanceDropEquip) itens.push(this.gerarItem(tierZona, Math.random() < B.chanceRaro ? 'raro' : 'comum'));
        });
      }
      itens.forEach(it => { it.equipou = this.receberItem(it); });
      const missoes = [];
      j.missoes.forEach(m => {
        const M = DATA.MISSOES[m.id];
        const mortos = derrotados.filter(e => e.id === M.alvo).length;
        if (mortos && m.progresso < M.qtd) {
          m.progresso = Math.min(M.qtd, m.progresso + mortos);
          missoes.push(`${M.titulo}: ${m.progresso}/${M.qtd}${m.progresso >= M.qtd ? ' (pronta para entregar)' : ''}`);
        }
      });
      const extras = [];
      if (d.chefe && !j.chefes[d.zona]) {
        j.chefes[d.zona] = true;
        const prox = DATA.ORDEM_ZONAS[DATA.ORDEM_ZONAS.indexOf(d.zona) + 1];
        if (prox) {
          const Z = DATA.ZONAS[prox];
          extras.push(j.nivel >= Z.nivelMin ? `Nova zona liberada: ${Z.nome}!` : `${Z.nome} libera no nível ${Z.nivelMin}.`);
        }
      }
      if (d.final) j.venceu = true;
      const niveis = this.ganharXP(xp);
      if (niveis.length) extras.push(`Você subiu para o nível ${j.nivel}!`);
      itens.filter(it => it.equipou).forEach(it => extras.push(`${Calc.nomeItem(it)} foi equipado.`));
      const cenaDepois = d.chefe && !j.vistos['depois_' + b.id] ? 'depois_' + b.id : null;
      this.posVitoria = { niveis, final: !!d.final, cena: cenaDepois };
      this.limitarVitais();
      this.salvar();
      const nomeVitoria = derrotados.length > 1 ? `A horda (${derrotados.length} monstros) foi derrotada.` : `${d.nome} foi derrotado.`;
      UI.abrirResultado({ inimigo: nomeVitoria, xp: j.nivel >= B.nivelMax && !niveis.length ? 0 : xp, bonusSeq, ouro, drops, itens, missoes, extras });
    } else if (res === 'derrota') {
      j.stats.mortes++;
      this.zerarSequencia();
      const perda = Math.floor(j.ouro * B.perdaOuroMorte);
      j.ouro -= perda;
      j.hp = Calc.hpMax(j); j.mp = Calc.mpMax(j);
      this.salvar();
      UI.abrirGameOver(perda);
    } else {
      this.zerarSequencia();
      this.salvar();
      this.batalha = null;
      this.irPara('mapa');
      UI.toast('Você escapou por pouco. A sequência de vitórias zerou.');
    }
  },

  sairDaBatalha() {
    const final = this.posVitoria && this.posVitoria.final;
    this.batalha = null;
    this.posVitoria = null;
    this.irPara(final ? 'final' : 'mapa');
  },

  abrirZona(z) {
    const Z = DATA.ZONAS[z], j = this.jogador;
    const chefe = DATA.INIMIGOS[Z.chefe];
    const nomes = Z.comuns.map(id => DATA.INIMIGOS[id].nome).join(' e ');
    const aviso = j.nivel < DATA.INIMIGOS[Z.comuns[0]].nivel - 1 ? '<p class="aviso">Os monstros daqui estão acima do seu nível. Cuidado.</p>' : '';
    UI.abrirModal('zona', `${UI.cabecalho(Z.nome, Z.faixa)}
      <p>Monstros comuns: ${nomes}.</p>
      <p>Chefe: <b>${chefe.nome}</b> ${j.chefes[z] ? '<em class="tag">derrotado</em>' : ''}</p>${aviso}
      <div class="linha-botoes">
        <button class="btn" data-acao="cacar" data-zona="${z}" data-primary>Caçar</button>
        <button class="btn perigo" data-acao="chefe" data-zona="${z}">Enfrentar Chefe</button></div>`, true, 'estreito');
  },

  // ---------------- Ações dos botões ----------------
  acao(nome, ds) {
    const j = this.jogador, B = DATA.BAL;
    switch (nome) {
      // --- título e criação ---
      case 'slots': Som.clique(); this.irPara('slots'); break;
      case 'continuar': {
        const sv = Save.carregar(Save.slotAtual);
        if (!sv) { UI.toast('Não encontrei esse save.'); Som.erro(); this.irPara('slots'); return; }
        this.jogador = sv; Som.clique(); this.irPara('vila');
        UI.toast(`Bem-vindo de volta, ${sv.nome}.`);
        break;
      }
      case 'jogarSlot': {
        const n = +ds.slot, sv = Save.carregar(n);
        if (!sv) { UI.toast('Esse espaço está vazio.'); Som.erro(); return; }
        Save.usarSlot(n);
        this.jogador = sv; Som.clique(); this.irPara('vila');
        UI.toast(`Bem-vindo de volta, ${sv.nome}.`);
        break;
      }
      case 'novoSlot':
        Save.usarSlot(+ds.slot); this.jogador = null; Som.clique(); this.irPara('criacao');
        break;
      case 'apagarSlot': {
        const r = Save.resumo(+ds.slot);
        if (!r) return;
        this.slotParaApagar = +ds.slot;
        UI.confirmar('Apagar personagem', `Apagar <b>${UI.esc(r.nome)}</b> (${DATA.CLASSES[r.classe].nome}, nível ${r.nivel}) do espaço ${ds.slot}? Isso não pode ser desfeito.`, 'confirmarApagar', 'Apagar');
        break;
      }
      case 'confirmarApagar':
        Save.apagar(this.slotParaApagar); this.slotParaApagar = null;
        Som.erro(); this.irPara('slots'); UI.toast('Personagem apagado.');
        break;
      case 'som':
        Som.setMudo(!Som.mudo);
        document.querySelectorAll('[data-acao="som"]').forEach(b => b.textContent = Som.mudo ? 'Som: desligado' : 'Som: ligado');
        Som.clique();
        break;
      case 'classe':
        UI.classeEscolhida = ds.classe; Som.clique();
        document.querySelectorAll('.card-classe').forEach(c => { const s = c.dataset.classe === ds.classe; c.classList.toggle('sel', s); c.setAttribute('aria-pressed', s); });
        break;
      case 'comecar': {
        const inp = document.getElementById('nome-heroi');
        if (!inp) return;
        const nome = (inp.value || '').trim().slice(0, 14) || 'Lian';
        this.jogador = Save.novoJogador(nome, UI.classeEscolhida);
        this.salvar();
        Som.nivel();
        this.irPara('vila');
        this.dialogo('intro').then(() => { this.salvar(); UI.toast('Dica: compre poções e uma arma com a Mercadora antes de sair.'); });
        break;
      }
      case 'voltarTitulo': if (j) this.salvar(); this.batalha = null; this.irPara(UI.tela === 'criacao' ? 'slots' : 'titulo'); break;
      case 'confirmarTitulo': UI.confirmar('Trocar personagem', 'Seu progresso será salvo (uma batalha em andamento é perdida).', 'sairTitulo', 'Salvar e sair'); break;
      case 'sairTitulo': this.limitarVitais(); if (j.hp <= 0) j.hp = 1; this.salvar(); this.batalha = null; this.jogador = null; this.irPara('slots'); break;

      // --- menus gerais ---
      case 'pausa': Som.clique(); UI.abrirPausa(); break;
      case 'fecharModal': Som.clique(); UI.fecharModal(); break;
      case 'salvar':
        if (this.batalha) { UI.toast('O jogo salva sozinho ao fim da batalha.'); return; }
        UI.toast(Save.salvar(j) ? 'Jogo salvo.' : 'Não foi possível salvar neste navegador.'); Som.moeda(); break;
      case 'inventario': Som.clique(); UI.abrirInventario(); break;

      // --- vila ---
      case 'npc':
        Som.clique();
        if (ds.npc === 'mercadora') UI.abrirLoja();
        else if (ds.npc === 'ferreiro') UI.abrirFerreiro();
        else UI.abrirMissoes();
        break;
      case 'pousada':
        if (j.hp >= Calc.hpMax(j) && j.mp >= Calc.mpMax(j)) { UI.toast('Você já está descansado.'); return; }
        if (j.ouro < B.precoPousada) { UI.toast(`A pousada custa ${B.precoPousada} ouro.`); Som.erro(); return; }
        j.ouro -= B.precoPousada; j.hp = Calc.hpMax(j); j.mp = Calc.mpMax(j);
        Som.cura(); this.salvar(); UI.atualizarHUD();
        UI.toast('Uma noite de sono e um chá de jasmim. HP e MP restaurados.');
        break;
      case 'irMapa': Som.clique(); this.irPara('mapa'); break;
      case 'irVila': Som.clique(); this.irPara('vila'); break;

      // --- mapa ---
      case 'zona':
        if (!this.zonaLiberada(ds.zona)) {
          const Z = DATA.ZONAS[ds.zona];
          UI.toast(j.nivel < Z.nivelMin ? `${Z.nome} libera no nível ${Z.nivelMin}.` : `Derrote o chefe de ${DATA.ZONAS[Z.requerChefe].nome} primeiro.`);
          Som.erro(); return;
        }
        Som.clique(); this.abrirZona(ds.zona);
        break;
      case 'cacar': {
        const Z = DATA.ZONAS[ds.zona];
        this.iniciarBatalha(this.sortearHorda(ds.zona));
        break;
      }
      case 'chefe': {
        const id = DATA.ZONAS[ds.zona].chefe;
        UI.fecharTodos();
        this.dialogoUmaVez('antes_' + id).then(() => this.iniciarBatalha(id));
        break;
      }

      // --- batalha ---
      case 'atacar': case 'defender': case 'fugir':
        if (this.batalha) { UI.submenu = null; UI.renderSubmenu(); this.batalha.acao(nome); }
        break;
      case 'menuHab': if (this.batalha) { Som.clique(); UI.abrirSubmenu('habilidades'); } break;
      case 'menuItem': if (this.batalha) { Som.clique(); UI.abrirSubmenu('itens'); } break;
      case 'fecharSubmenu': UI.submenu = null; UI.renderSubmenu(); break;
      case 'habilidade':
        if (!this.batalha) return;
        if (!this.batalha.problema('habilidade', ds.hab)) { UI.submenu = null; UI.renderSubmenu(); }
        this.batalha.acao('habilidade', ds.hab);
        break;
      case 'item':
        if (!this.batalha) return;
        if (!this.batalha.problema('item', ds.item)) { UI.submenu = null; UI.renderSubmenu(); }
        this.batalha.acao('item', ds.item);
        break;
      case 'posResultado': {
        UI.fecharModal();
        const pv = this.posVitoria || { niveis: [] };
        const seguir = () => {
          if (pv.niveis.length) {
            Som.nivel();
            this.aposLevelUp = () => this.sairDaBatalha();
            UI.abrirLevelUp(pv.niveis);
          } else this.sairDaBatalha();
        };
        if (pv.cena) this.dialogo(pv.cena).then(() => { this.salvar(); seguir(); });
        else seguir();
        break;
      }
      case 'proximaFala': this.avancarDialogo(false); break;
      case 'pularDialogo': this.avancarDialogo(true); break;
      case 'velocidade': Som.clique(); this.alternarVelocidade(); break;
      case 'qte': Som.clique(); this.alternarQte(); break;
      case 'alvo': if (this.batalha) { this.batalha.selecionarAlvo(+ds.i); Som.clique(); } break;
      case 'vender': {
        const idx = j.mochila.findIndex(i => i.uid === +ds.uid);
        if (idx < 0) return;
        const it = j.mochila[idx], preco = Calc.precoVenda(it);
        j.mochila.splice(idx, 1); j.ouro += preco;
        Som.moeda(); this.salvar();
        UI.refazerModal('inventario', UI.htmlInventario(), 'largo'); UI.atualizarHUD();
        UI.toast(`Vendeu ${Calc.nomeItem(it)} por ${preco} ouro.`);
        break;
      }
      case 'posGameOver': this.batalha = null; this.irPara('vila'); break;
      case 'continuarAposFinal': this.irPara('vila'); break;

      // --- level up e atributos ---
      case 'ponto': case 'pontoLevel':
        if (j.pontos <= 0) return;
        j.atr[ds.atr]++; j.pontos--;
        if (ds.atr === 'VIT') j.hp += B.hpPorVit;
        if (ds.atr === 'INT') j.mp += B.mpPorInt;
        this.limitarVitais(); this.salvar(); Som.clique();
        if (nome === 'ponto') UI.refazerModal('inventario', UI.htmlInventario(), 'largo');
        else UI.refazerModal('levelup', UI.htmlLevelUp(UI.niveisLevelUp), 'estreito levelup');
        break;
      case 'fecharLevelUp': {
        UI.fecharModal(); this.salvar();
        const f = this.aposLevelUp; this.aposLevelUp = null;
        if (f) f(); else UI.atualizarHUD();
        break;
      }

      // --- Mercadora ---
      case 'abaLoja': UI.abaLoja = ds.aba; Som.clique(); UI.refazerModal('loja', UI.htmlLoja()); break;
      case 'comprarPocao': {
        const p = DATA.POCOES[ds.id];
        if (j.ouro < p.preco) { UI.toast('Ouro insuficiente.'); Som.erro(); return; }
        j.ouro -= p.preco; j.pocoes[ds.id]++;
        Som.moeda(); this.salvar(); UI.refazerModal('loja', UI.htmlLoja()); UI.atualizarHUD();
        UI.toast(`Comprou ${p.nome}.`);
        break;
      }
      case 'comprarEquip': {
        const slot = ds.slot, tier = +ds.tier, preco = DATA.EQUIP[slot].precos[tier];
        if (j.nivel < DATA.TIERS[tier].nivel) { UI.toast(`Requer nível ${DATA.TIERS[tier].nivel}.`); Som.erro(); return; }
        if (j.ouro < preco) { UI.toast('Ouro insuficiente.'); Som.erro(); return; }
        j.ouro -= preco;
        const item = { uid: j.proxUid++, slot, tier, plus: 0 };
        if (slot === 'arma') item.tipoArma = DATA.CLASSES[j.classe].arma;
        let msg = `Comprou ${Calc.nomeItem(item)}`;
        if (!j.equip[slot]) { j.equip[slot] = item; msg += ' e já equipou.'; }
        else { j.mochila.push(item); msg += '. Está na mochila (Inventário).'; }
        this.limitarVitais(); Som.moeda(); this.salvar();
        UI.refazerModal('loja', UI.htmlLoja()); UI.atualizarHUD(); UI.toast(msg);
        break;
      }

      // --- Ferreiro ---
      case 'aprimorar': {
        const it = this.acharItem(+ds.uid);
        if (!it || it.plus >= B.aprimMax) return;
        const custo = this.custoAprimorar(it);
        if (j.ouro < custo) { UI.toast('Ouro insuficiente.'); Som.erro(); return; }
        j.ouro -= custo;
        if (Math.random() < B.aprimChances[it.plus]) {
          it.plus++; Som.nivel(); UI.toast(`Sucesso! ${Calc.nomeItem(it)}.`, 'bom');
        } else {
          Som.erro(); UI.toast('O metal rachou… o ferreiro jura que da próxima vai. Só o ouro foi perdido.', 'ruim');
        }
        this.limitarVitais(); this.salvar();
        UI.refazerModal('ferreiro', UI.htmlFerreiro()); UI.atualizarHUD();
        break;
      }

      // --- Missões ---
      case 'aceitarMissao':
        if (j.missoes.length >= B.maxMissoes) { UI.toast(`Máximo de ${B.maxMissoes} missões ativas.`); Som.erro(); return; }
        if (j.missoes.some(m => m.id === ds.id)) return;
        j.missoes.push({ id: ds.id, progresso: 0 });
        Som.clique(); this.salvar(); UI.refazerModal('missoes', UI.htmlMissoes());
        break;
      case 'abandonarMissao':
        j.missoes = j.missoes.filter(m => m.id !== ds.id);
        Som.clique(); this.salvar(); UI.refazerModal('missoes', UI.htmlMissoes());
        break;
      case 'entregarMissao': {
        const m = j.missoes.find(x => x.id === ds.id), M = DATA.MISSOES[ds.id];
        if (!m || m.progresso < M.qtd) return;
        j.missoes = j.missoes.filter(x => x.id !== ds.id);
        if (M.tipo === 'chefe') j.missoesFeitas[ds.id] = true;
        j.ouro += M.ouro;
        const niveis = this.ganharXP(Math.round(M.xp * B.multXP));
        Som.moeda(); this.salvar();
        UI.refazerModal('missoes', UI.htmlMissoes()); UI.atualizarHUD();
        UI.toast(`Missão entregue: +${M.xp} XP e +${M.ouro} ouro.`, 'bom');
        if (niveis.length) { Som.nivel(); this.aposLevelUp = null; UI.abrirLevelUp(niveis); }
        break;
      }

      // --- Inventário ---
      case 'equipar': {
        const idx = j.mochila.findIndex(i => i.uid === +ds.uid);
        if (idx < 0) return;
        const it = j.mochila[idx];
        if (j.nivel < Calc.nivelItem(it)) { UI.toast(`Requer nível ${Calc.nivelItem(it)}.`); Som.erro(); return; }
        j.mochila.splice(idx, 1);
        if (j.equip[it.slot]) j.mochila.push(j.equip[it.slot]);
        j.equip[it.slot] = it;
        this.limitarVitais(); Som.clique(); this.salvar();
        UI.refazerModal('inventario', UI.htmlInventario(), 'largo');
        break;
      }
      case 'desequipar': {
        const it = j.equip[ds.slot];
        if (!it) return;
        j.mochila.push(it); j.equip[ds.slot] = null;
        this.limitarVitais(); Som.clique(); this.salvar();
        UI.refazerModal('inventario', UI.htmlInventario(), 'largo');
        break;
      }
      case 'usarPocao': {
        const p = DATA.POCOES[ds.id];
        if (!j.pocoes[ds.id]) return;
        if (p.hp && j.hp >= Calc.hpMax(j)) { UI.toast('HP já está cheio.'); return; }
        if (p.mp && j.mp >= Calc.mpMax(j)) { UI.toast('MP já está cheio.'); return; }
        j.pocoes[ds.id]--;
        if (p.hp) j.hp = Math.min(Calc.hpMax(j), j.hp + p.hp); else j.mp = Math.min(Calc.mpMax(j), j.mp + p.mp);
        Som.cura(); this.salvar();
        UI.refazerModal('inventario', UI.htmlInventario(), 'largo');
        break;
      }
    }
  },
};

window.addEventListener('load', () => Game.iniciar());
