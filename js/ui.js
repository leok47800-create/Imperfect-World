// ============================================================
// ui.js — telas, painéis (modais), HUD e registro de batalha.
// Menus e HUD em HTML/CSS por cima do canvas.
// ============================================================

const UI = {
  raiz: null,      // #ui
  camadaTela: null,
  camadaModal: null,
  tela: null,
  modais: [],      // pilha de { id, el, fechavel }
  submenu: null,   // 'habilidades' | 'itens' | null
  abaLoja: 'pocoes',
  classeEscolhida: 'guerreiro',

  iniciar() {
    this.raiz = document.getElementById('ui');
    this.raiz.innerHTML = '<div id="camada-tela"></div><div id="camada-modal"></div><div id="toasts" aria-live="polite"></div>';
    this.camadaTela = document.getElementById('camada-tela');
    this.camadaModal = document.getElementById('camada-modal');
    // Um único ouvinte para todos os botões (mouse, toque e Enter)
    this.raiz.addEventListener('click', (e) => {
      const el = e.target.closest('[data-acao]');
      if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
      Som.iniciar();
      Game.acao(el.dataset.acao, el.dataset);
    });
  },

  esc(t) { return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },

  // Ícone de uma grade 4×4 (usa a imagem se existir, senão um símbolo)
  icone(folha, indice, simbolo, extra) {
    const est = Assets.estiloIcone(folha, indice);
    if (est) return `<span class="ico" style='${est};${extra || ''}'></span>`;
    return `<span class="ico ico-alt" style="${extra || ''}">${simbolo}</span>`;
  },
  nomeItemHTML(item) {
    const r = Calc.raridade(item);
    return `<span class="nome-item r-${item.raridade || 'comum'}" style="color:${r.cor}">${this.esc(Calc.nomeItem(item))}</span>${item.raridade && item.raridade !== 'comum' ? ` <em class="tag rar" style="background:${r.cor}">${r.nome}</em>` : ''}`;
  },
  iconeItem(item) {
    const simb = { arma: { espada: '⚔', cajado: '✦', arco: '➶' }[item.tipoArma], armadura: '⛨', amuleto: '◈' }[item.slot];
    return this.icone('items', Calc.iconeItem(item), simb, `--tier:${['#B07A3A', '#2E8B6A', '#D4A23A'][item.tier]}`);
  },
  iconePocao(id) {
    const p = DATA.POCOES[id];
    const tam = `transform:scale(${p.escala})`;
    return this.icone('items', p.icone, p.hp ? '♥' : '◆', `${tam};--tier:${p.hp ? '#B8322E' : '#3E6FD8'}`);
  },
  iconeHab(id) {
    const h = DATA.HABILIDADES[id];
    if (h.icone == null) return `<span class="ico ico-alt ico-hab" style="--cor:${h.cor || '#D4A23A'}">${h.simbolo || '✦'}</span>`;
    const simb = { corte: '⟋', aura: '✺', pedra: '⛰', fogo: '✹', arcano: '◎', raio: 'ϟ', folha: '❦' }[h.particula] || '✦';
    return this.icone('ui_icons', h.icone, simb);
  },

  barra(v, max, cls, rotulo) {
    const pct = Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100));
    return `<div class="barra ${cls}" role="meter" aria-valuenow="${Math.round(v)}" aria-valuemax="${Math.round(max)}" aria-label="${rotulo || cls}">
      <div class="barra-fill" style="width:${pct}%"></div><span>${rotulo ? rotulo + ' ' : ''}${Math.round(v)}/${Math.round(max)}</span></div>`;
  },

  toast(msg, tipo) {
    const box = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + (tipo || '');
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.classList.add('sai'), 2200);
    setTimeout(() => el.remove(), 2700);
  },

  // ============================================================
  // TELAS
  // ============================================================
  mostrar(tela) {
    this.tela = tela;
    this.fecharTodos();
    this.submenu = null;
    const f = this['tela_' + tela];
    this.camadaTela.className = 'tela-' + tela;
    this.camadaTela.innerHTML = f ? f.call(this) : '';
    if (tela === 'criacao') this.desenharPrevias();
    if (tela === 'slots') this.desenharRetratosSlots();
    if (tela === 'batalha') { this.atualizarBatalha(); this.atualizarLog(); }
    this.focarPrimario(this.camadaTela);
  },

  focarPrimario(raiz) {
    // Só move o foco quando há teclado (evita teclado virtual no celular)
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;
    const el = raiz.querySelector('[data-primary]:not([disabled])') || raiz.querySelector('button:not([disabled])');
    if (el) el.focus({ preventScroll: true });
  },

  tela_carregando() {
    return `<div class="carregando"><div class="logo-texto">Imperfect World</div>
      <div class="barra carga"><div class="barra-fill" id="carga-fill" style="width:0%"></div><span>Carregando…</span></div></div>`;
  },
  progresso(p) {
    const el = document.getElementById('carga-fill');
    if (el) el.style.width = Math.round(p * 100) + '%';
  },

  tela_titulo() {
    const ultimo = Save.resumo(Save.slotAtual);
    const logo = Assets.tem('logo')
      ? `<img class="logo-img" src="${Assets.get('logo').url}" alt="Imperfect World">`
      : `<h1 class="logo-texto">Imperfect World</h1>`;
    return `<div class="titulo">
      ${logo}
      <p class="subtitulo">O Imperador Eclipse quer apagar o sol. Alguém da vila esquecida vai ter que impedir.</p>
      <div class="menu-vertical">
        ${ultimo ? `<button class="btn" data-acao="continuar" data-primary>Continuar<small>${this.esc(ultimo.nome)} · ${DATA.CLASSES[ultimo.classe].nome} Nv ${ultimo.nivel}</small></button>` : ''}
        <button class="btn ${ultimo ? 'sec' : ''}" data-acao="slots" ${ultimo ? '' : 'data-primary'}>${Save.existe() ? 'Personagens' : 'Novo Jogo'}</button>
        <button class="btn sec" data-acao="som">${Som.mudo ? 'Som: desligado' : 'Som: ligado'}</button>
      </div>
      ${location.protocol === 'file:' ? '<p class="dica">Dica: para as artes ficarem sem o fundo magenta, rode com um servidor local (ex.: <code>python -m http.server</code>).</p>' : ''}
    </div>`;
  },

  // ---------- Escolha de personagem (3 espaços de save) ----------
  formatarTempo(seg) {
    const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60);
    return h ? `${h}h ${m}min` : `${m}min`;
  },
  tela_slots() {
    const cards = [];
    for (let n = 1; n <= Save.SLOTS; n++) {
      const r = Save.resumo(n);
      if (!r) {
        cards.push(`<div class="slot vazio"><div class="slot-num">Espaço ${n}</div>
          <div class="slot-vazio-ico" aria-hidden="true">+</div><p>Espaço livre</p>
          <button class="btn" data-acao="novoSlot" data-slot="${n}" ${Save.existe() ? '' : (n === 1 ? 'data-primary' : '')}>Criar personagem</button></div>`);
        continue;
      }
      const ultimo = n === Save.slotAtual;
      cards.push(`<div class="slot ${ultimo ? 'ultimo' : ''}"><div class="slot-num">Espaço ${n}${ultimo ? ' · último jogado' : ''}</div>
        <canvas class="slot-retrato" width="200" height="200" data-classe="${r.classe}"></canvas>
        <strong class="slot-nome">${this.esc(r.nome)}</strong>
        <span class="slot-classe">${DATA.CLASSES[r.classe].nome} · Nível ${r.nivel}</span>
        <dl class="slot-info"><dt>Zona</dt><dd>${r.venceu ? 'Jogo zerado ★' : r.zona}</dd><dt>Chefes</dt><dd>${r.chefes}/3</dd>
          <dt>Ouro</dt><dd>${r.ouro}</dd><dt>Tempo</dt><dd>${this.formatarTempo(r.tempo)}</dd></dl>
        <div class="slot-botoes"><button class="btn" data-acao="jogarSlot" data-slot="${n}" ${ultimo ? 'data-primary' : ''}>Jogar</button>
        <button class="btn sec mini" data-acao="apagarSlot" data-slot="${n}" aria-label="Apagar o personagem do espaço ${n}">Apagar</button></div></div>`);
    }
    return `<div class="painel slots-painel"><h2>Escolha o personagem</h2>
      <p class="dica-slots">Cada espaço guarda um personagem com o próprio nível, itens, ouro e missões.</p>
      <div class="slots">${cards.join('')}</div>
      <div class="linha-botoes"><button class="btn sec" data-acao="voltarTitulo">Voltar</button></div></div>`;
  },
  desenharRetratosSlots() {
    this.camadaTela.querySelectorAll('canvas.slot-retrato').forEach(c => {
      const ctx = c.getContext('2d'), cls = c.dataset.classe, nome = 'hero_' + cls;
      ctx.clearRect(0, 0, 200, 200);
      if (Assets.tem(nome)) Assets.desenharRetrato(ctx, nome, 0, 4, 200, 'busto');
      else Arte.heroi(ctx, cls, 0, 100, 430, 440);
    });
  },

  tela_criacao() {
    const cards = Object.keys(DATA.CLASSES).map(id => {
      const cl = DATA.CLASSES[id];
      const j = Save.novoJogador('x', id);
      const sel = id === this.classeEscolhida;
      return `<button class="card-classe ${sel ? 'sel' : ''}" data-acao="classe" data-classe="${id}" aria-pressed="${sel}">
        <canvas class="previa" data-classe="${id}" width="160" height="190"></canvas>
        <strong>${cl.nome}</strong>
        <span class="desc">${cl.desc}</span>
        <span class="atrs">
          <span>FOR <b>${j.atr.FOR}</b></span><span>DES <b>${j.atr.DES}</b></span><span>INT <b>${j.atr.INT}</b></span><span>VIT <b>${j.atr.VIT}</b></span>
        </span>
        <span class="derivados">HP ${Calc.hpMax(j)} · MP ${Calc.mpMax(j)} · ATK ${Math.round(Calc.atk(j))}</span>
      </button>`;
    }).join('');
    return `<div class="painel criacao">
      <h2>Quem vai salvar o sol?</h2>
      <div class="campo-nome"><label for="nome-heroi">Nome do herói</label>
        <input id="nome-heroi" maxlength="14" autocomplete="off" value="${this.esc(this.nomeDigitado || 'Lian')}"></div>
      <div class="classes">${cards}</div>
      <div class="linha-botoes">
        <button class="btn sec" data-acao="voltarTitulo">Voltar</button>
        <button class="btn" data-acao="comecar" data-primary>Começar aventura</button>
      </div>
    </div>`;
  },

  desenharPrevias() {
    this.camadaTela.querySelectorAll('canvas.previa').forEach(c => {
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
      Arte.heroi(ctx, c.dataset.classe, 0, 70, 178, 150);
    });
    const inp = document.getElementById('nome-heroi');
    if (inp) inp.addEventListener('input', () => { this.nomeDigitado = inp.value; });
  },

  hudJogador() {
    const j = Game.jogador;
    if (!j) return '';
    const xpMax = j.nivel >= DATA.BAL.nivelMax ? 1 : Calc.xpProximo(j.nivel);
    return `<div class="hud-topo">
      <div class="hud-id"><strong>${this.esc(j.nome)}</strong><span>${DATA.CLASSES[j.classe].nome} · Nv ${j.nivel}</span></div>
      <div class="hud-barras">
        ${this.barra(j.hp, Calc.hpMax(j), 'hp', 'HP')}
        ${this.barra(j.mp, Calc.mpMax(j), 'mp', 'MP')}
        ${j.nivel >= DATA.BAL.nivelMax ? '<div class="barra xp"><div class="barra-fill" style="width:100%"></div><span>XP MÁX</span></div>' : this.barra(j.xp, xpMax, 'xp', 'XP')}
      </div>
      ${j.sequencia > 0 ? `<div class="hud-seq" title="Vitórias seguidas sem voltar à vila">🔥︎ ${j.sequencia} <small>+${Math.round(Game.bonusSequencia() * 100)}% XP</small></div>` : ''}
      <div class="hud-ouro">${this.icone('items', 15, '●')}<b>${j.ouro}</b></div>
      <button class="btn-icone" data-acao="pausa" aria-label="Pausa (Esc)">☰</button>
    </div>`;
  },
  atualizarHUD() {
    const el = this.camadaTela.querySelector('.hud-topo');
    if (el) el.outerHTML = this.hudJogador();
    const inv = this.camadaTela.querySelector('[data-acao="inventario"]');
    if (inv && Game.jogador) inv.classList.toggle('alerta', Game.jogador.pontos > 0);
  },

  tela_vila() {
    const j = Game.jogador;
    const npcs = [['ferreiro', 'Ferreiro', 'Aprimorar'], ['mercadora', 'Mercadora', 'Loja'], ['missoes', 'Mestre de Missões', 'Missões']];
    const temEntrega = j.missoes.some(m => m.progresso >= DATA.MISSOES[m.id].qtd);
    return `${this.hudJogador()}
      <div class="hotspots">
        ${npcs.map((n, i) => `<button class="hotspot npc" style="left:${Game.POS_NPC[i] / 12.8}%" data-acao="npc" data-npc="${n[0]}">
          <span class="placa">${n[1]}<small>${n[2]}</small>${n[0] === 'missoes' && temEntrega ? '<i class="pingo" aria-label="missão pronta">!</i>' : ''}</span></button>`).join('')}
      </div>
      <div class="barra-acoes">
        <button class="btn sec" data-acao="pousada">Pousada <small>${DATA.BAL.precoPousada} ouro</small></button>
        <button class="btn sec ${j.pontos > 0 ? 'alerta' : ''}" data-acao="inventario">Inventário <small>I</small></button>
        <button class="btn" data-acao="irMapa" data-primary>Portão → Mapa</button>
      </div>`;
  },

  tela_mapa() {
    const j = Game.jogador;
    const zonas = DATA.ORDEM_ZONAS.map(z => {
      const Z = DATA.ZONAS[z];
      const ok = Game.zonaLiberada(z);
      const motivo = j.nivel < Z.nivelMin ? `Nível ${Z.nivelMin}` : `Derrote o chefe anterior`;
      return `<button class="zona ${ok ? '' : 'bloqueada'} ${j.chefes[z] ? 'concluida' : ''}" style="left:${Z.pos.x * 100}%;top:${Z.pos.y * 100}%"
        data-acao="zona" data-zona="${z}" ${ok ? '' : 'aria-disabled="true"'}>
        <span class="marcador">${ok ? (j.chefes[z] ? '✓' : '●') : '🔒︎'}</span>
        <span class="placa">${Z.nome}<small>${ok ? Z.faixa : motivo}</small></span></button>`;
    }).join('');
    return `${this.hudJogador()}
      <div class="zonas">${zonas}</div>
      <div class="barra-acoes">
        <button class="btn sec" data-acao="irVila" data-primary>← Voltar à vila</button>
        <button class="btn sec ${j.pontos > 0 ? 'alerta' : ''}" data-acao="inventario">Inventário <small>I</small></button>
      </div>`;
  },

  tela_batalha() {
    const I = DATA.ICONES_UI;
    const acoes = [
      ['atacar', 'Atacar', '1', this.icone('ui_icons', I.atacar, '⚔')],
      ['menuHab', 'Habilidade', '2', this.icone('ui_icons', 4, '✦')],
      ['menuItem', 'Item', '3', this.icone('ui_icons', I.item, '♥')],
      ['defender', 'Defender', '4', this.icone('ui_icons', I.defender, '⛨')],
      ['fugir', 'Fugir', '5', this.icone('ui_icons', I.fugir, '➜')],
    ];
    return `<div class="hud-batalha">
        <div class="caixa heroi" id="caixa-heroi"></div>
        <div class="botoes-centro">
          <button class="btn-icone vel" data-acao="velocidade" aria-label="Velocidade da batalha (V)">${Game.vel}×</button>
          <button class="btn-icone" data-acao="pausa" aria-label="Pausa (Esc)">☰</button>
        </div>
        <div class="caixas-inimigos" id="caixas-inimigos"></div>
      </div>
      <div class="alvos" id="alvos"></div>
      <div class="rodape-batalha">
        <div class="submenu" id="submenu" hidden></div>
        <ol class="log" id="log"></ol>
        <div class="acoes">${acoes.map(a => `<button class="btn acao" data-acao="${a[0]}" ${a[0] === 'atacar' ? 'data-primary' : ''}>${a[3]}<span>${a[1]}</span><kbd>${a[2]}</kbd></button>`).join('')}</div>
      </div>`;
  },

  // Escudos de guarda (◆ cheio / ◇ vazio) ou aviso de guarda quebrada
  htmlGuarda(e) {
    if (e.quebrado > 0) return `<div class="guarda quebrada" title="Guarda quebrada: perde o turno e toma dano dobrado">✦ GUARDA QUEBRADA · dano ×2</div>`;
    let pips = '';
    for (let k = 0; k < e.guardaMax; k++) pips += `<i class="${k < e.guarda ? 'cheio' : ''}"></i>`;
    return `<div class="guarda" title="Guarda: acerte a fraqueza ou dê golpes perfeitos para quebrar">${pips}</div>`;
  },
  chipIntencao(e) {
    const it = e.intencao;
    if (!it) return null;
    const t = {
      atacar: `Vai atacar: ${it.valor}`, forte: `${it.nome}: ${it.valor}`, cuspe: `${it.nome}: ${it.valor} + veneno`,
      proteger: `Vai proteger ${(this.inimigosNome(it.alvo))}`, defender: 'Vai se defender', fugir: 'Vai fugir!', quebrado: 'Perde o turno',
    }[it.tipo];
    return t ? [t, it.tipo === 'fugir' || it.tipo === 'forte' || it.tipo === 'cuspe' ? 'deb' : 'intencao'] : null;
  },
  inimigosNome(i) { const b = Game.batalha, o = b && b.inimigos[i]; return o ? o.d.nome.split(' ')[0] : 'aliado'; },

  // Fraquezas/resistências que o jogador já descobriu contra esse inimigo
  chipsElemento(id) {
    const d = DATA.INIMIGOS[id], vistos = (Game.jogador.bestiario || {})[id] || {};
    if (!d.elem) return [];
    return Object.keys(d.elem).filter(e => vistos[e]).map(e => {
      const m = d.elem[e];
      return [`${m > 1 ? 'Fraco' : 'Resiste'}: ${DATA.ELEMENTOS[e].nome}`, m > 1 ? 'fraco' : 'info'];
    });
  },

  chips(lista) { return lista.filter(Boolean).map(c => `<span class="chip ${c[1]}">${c[0]}</span>`).join(''); },

  atualizarBatalha() {
    const b = Game.batalha, j = Game.jogador;
    if (!b || this.tela !== 'batalha') return;
    const h = b.h, d = b.d;
    const ch = document.getElementById('caixa-heroi'), ci = document.getElementById('caixas-inimigos');
    if (!ch || !ci) return;
    ch.innerHTML = `<div class="nome"><strong>${this.esc(j.nome)}</strong><span>Nv ${j.nivel}</span></div>
      ${this.barra(j.hp, Calc.hpMax(j), 'hp', 'HP')}${this.barra(j.mp, Calc.mpMax(j), 'mp', 'MP')}
      <div class="chips">${this.chips([
        h.grito > 0 && [`Grito ${h.grito}`, 'buff'], h.escudo > 0 && [`Escudo ${h.escudo}`, 'buff'], h.vento && ['Vento: esquiva total', 'buff'],
        h.critProximo && ['Próximo tiro: crítico', 'buff'],
        h.defendendo && ['Defesa', 'buff'], h.nevoa > 0 && [`Névoa ${h.nevoa}`, 'deb'], h.queimadura > 0 && [`Queimadura ${h.queimadura}`, 'deb'],
        h.veneno > 0 && [`Veneno ${h.veneno}`, 'deb']])}</div>`;
    // Uma caixa por inimigo; a do alvo escolhido fica destacada (toque/clique para escolher)
    const multi = b.horda;
    const podeEscolher = multi && b.vivos.length > 1 && !b.ocupado && !b.acabou;
    ci.className = 'caixas-inimigos' + (multi ? ' multi' : '');
    ci.innerHTML = b.inimigos.map(e => {
      const de = e.d, alvo = multi && e === b.alvoAtual && e.hp > 0;
      return `<button class="caixa inimigo ${alvo ? 'alvo' : ''} ${e.hp <= 0 ? 'morto' : ''}" data-acao="alvo" data-i="${e.i}"
          ${multi && e.hp > 0 ? '' : 'tabindex="-1"'} aria-pressed="${alvo}" aria-label="Alvo: ${de.nome}">
        <div class="nome"><strong>${de.chefe ? '<em>CHEFE</em> ' : ''}${alvo ? '▸ ' : ''}${de.nome}</strong><span>${e.hp <= 0 ? 'derrotado' : 'Nv ' + de.nivel}</span></div>
        ${this.barra(e.hp, e.hpMax, 'hp inimigo', 'HP')}
        ${e.hp > 0 ? this.htmlGuarda(e) : ''}
        <div class="chips">${this.chips([
          e.preparando && e.hp > 0 && [`⚠ ${de.especial.nome} no próximo turno`, 'aviso'],
          e.hp > 0 && !e.preparando && this.chipIntencao(e),
          e.protegido && e.hp > 0 && ['Protegido', 'info'], e.defendendo && e.hp > 0 && ['Defendendo', 'info'],
          de.comportamento && e.hp > 0 && !(de.comportamento === 'remonta' && e.remontou) && [DATA.COMPORTAMENTOS[de.comportamento].nome, 'comp'],
          e.atordoado > 0 && e.hp > 0 && ['Atordoado', 'deb'],
          e.dot && e.hp > 0 && [`${e.dot.tipo === 'veneno' ? 'Envenenado' : 'Queimando'} ${e.dot.turnos}`, 'buff'], e.fase === 2 && ['Fase 2 · ATK +30%', 'deb'],
          de.esquiva && ['Esquiva 25%', 'info'], de.regen && ['Regenera', 'info'], ...this.chipsElemento(e.id)])}</div>
      </button>`;
    }).join('');
    // Áreas de toque sobre os monstros (para escolher o alvo tocando nele)
    const alvos = document.getElementById('alvos');
    if (alvos) alvos.innerHTML = podeEscolher ? b.vivos.map(e => {
      const p = Game.posInimigo(e.i);
      return `<button class="alvo-hot" style="left:${(p.x - p.h * 0.45) / 12.8}%;top:${(p.y - p.h) / 7.2}%;width:${p.h * 0.9 / 12.8}%;height:${p.h / 7.2}%"
        data-acao="alvo" data-i="${e.i}" tabindex="-1" aria-label="Atacar ${e.d.nome}"></button>`;
    }).join('') : '';
    const ocup = b.ocupado || b.acabou;
    this.camadaTela.querySelectorAll('.acoes .btn').forEach(bt => {
      bt.disabled = ocup || (bt.dataset.acao === 'fugir' && b.chefe);
    });
    if (this.submenu) this.renderSubmenu();
  },

  atualizarLog() {
    const el = document.getElementById('log');
    if (!el || !Game.batalha) return;
    el.innerHTML = Game.batalha.log.map(l => `<li>${this.esc(l)}</li>`).join('');
  },

  abrirSubmenu(tipo) {
    this.submenu = this.submenu === tipo ? null : tipo;
    this.renderSubmenu();
  },
  renderSubmenu() {
    const el = document.getElementById('submenu');
    if (!el) return;
    if (!this.submenu) { el.hidden = true; el.innerHTML = ''; return; }
    const j = Game.jogador, b = Game.batalha;
    const ocup = b.ocupado || b.acabou;
    let html = '';
    if (this.submenu === 'habilidades') {
      html = Calc.habilidades(j).map((h, i) => {
        const travada = j.nivel < h.nivel, semMP = j.mp < h.mp;
        return `<button class="opcao" data-acao="habilidade" data-hab="${h.id}" ${travada || semMP || ocup ? 'disabled' : ''}>
          ${this.iconeHab(h.id)}<span class="txt"><b>${h.nome}</b><small>${travada ? `Libera no nível ${h.nivel}` : h.desc}</small></span>
          <span class="custo">${h.mp} MP</span><kbd>${'QWERTY'[i]}</kbd></button>`;
      }).join('');
    } else {
      const ids = Object.keys(DATA.POCOES);
      html = ids.map((id, i) => {
        const p = DATA.POCOES[id], n = j.pocoes[id] || 0;
        return `<button class="opcao" data-acao="item" data-item="${id}" ${n <= 0 || ocup ? 'disabled' : ''}>
          ${this.iconePocao(id)}<span class="txt"><b>${p.nome}</b><small>${p.hp ? '+' + p.hp + ' HP' : '+' + p.mp + ' MP'}</small></span>
          <span class="custo">×${n}</span><kbd>${i + 1}</kbd></button>`;
      }).join('');
    }
    el.innerHTML = `<div class="sub-topo"><b>${this.submenu === 'habilidades' ? 'Habilidades' : 'Itens'}</b><button class="btn-x" data-acao="fecharSubmenu" aria-label="Fechar (Esc)">×</button></div>${html}`;
    el.hidden = false;
  },

  // ============================================================
  // MODAIS
  // ============================================================
  abrirModal(id, html, fechavel = true, classe) {
    const fundo = document.createElement('div');
    fundo.className = 'modal-fundo';
    fundo.innerHTML = `<div class="painel modal ${classe || ''}" role="dialog" aria-modal="true">
      ${fechavel ? '<button class="btn-x fechar" data-acao="fecharModal" aria-label="Fechar (Esc)">×</button>' : ''}${html}</div>`;
    if (fechavel) fundo.addEventListener('click', (e) => { if (e.target === fundo) this.fecharModal(); });
    this.camadaModal.appendChild(fundo);
    this.modais.push({ id, el: fundo, fechavel });
    this.focarPrimario(fundo);
    return fundo;
  },
  // Recria o conteúdo do modal do topo (mantém a rolagem)
  refazerModal(id, html, classe) {
    const m = this.modais.find(x => x.id === id);
    if (!m) return;
    const painel = m.el.querySelector('.painel');
    const corpo = painel.querySelector('.rolagem');
    const scroll = corpo ? corpo.scrollTop : 0;
    painel.className = `painel modal ${classe || ''}`;
    painel.innerHTML = `${m.fechavel ? '<button class="btn-x fechar" data-acao="fecharModal" aria-label="Fechar (Esc)">×</button>' : ''}${html}`;
    const novo = painel.querySelector('.rolagem');
    if (novo) novo.scrollTop = scroll;
  },
  modalAberto(id) { return this.modais.some(m => m.id === id); },
  topo() { return this.modais[this.modais.length - 1]; },
  fecharModal() {
    const m = this.modais.pop();
    if (m) m.el.remove();
    if (this.tela === 'vila' || this.tela === 'mapa') this.atualizarHUD();
    const t = this.topo();
    this.focarPrimario(t ? t.el : this.camadaTela);
    return m;
  },
  fecharTodos() { while (this.modais.length) this.modais.pop().el.remove(); },

  cabecalho(titulo, sub) {
    const j = Game.jogador;
    return `<header class="cab"><div><h2>${titulo}</h2>${sub ? `<p>${sub}</p>` : ''}</div>
      ${j ? `<div class="ouro-cab">${this.icone('items', 15, '●')}<b>${j.ouro}</b></div>` : ''}</header>`;
  },

  // ---------- Mercadora ----------
  htmlLoja() {
    const j = Game.jogador;
    const abas = `<div class="abas" role="tablist">
      <button class="aba ${this.abaLoja === 'pocoes' ? 'ativa' : ''}" data-acao="abaLoja" data-aba="pocoes" role="tab">Poções</button>
      <button class="aba ${this.abaLoja === 'equip' ? 'ativa' : ''}" data-acao="abaLoja" data-aba="equip" role="tab">Equipamentos</button></div>`;
    let linhas = '';
    if (this.abaLoja === 'pocoes') {
      linhas = Object.keys(DATA.POCOES).map(id => {
        const p = DATA.POCOES[id];
        return `<div class="linha">${this.iconePocao(id)}
          <div class="info"><b>${p.nome}</b><small>${p.hp ? 'Cura ' + p.hp + ' HP' : 'Recupera ' + p.mp + ' MP'} · você tem ${j.pocoes[id]}</small></div>
          <button class="btn mini" data-acao="comprarPocao" data-id="${id}" ${j.ouro < p.preco ? 'disabled' : ''}>${p.preco} ouro</button></div>`;
      }).join('');
    } else {
      const cl = DATA.CLASSES[j.classe];
      ['arma', 'armadura', 'amuleto'].forEach(slot => {
        DATA.TIERS.forEach((t, ti) => {
          const item = { slot, tier: ti, plus: 0, tipoArma: cl.arma };
          const preco = DATA.EQUIP[slot].precos[ti];
          const nivelOk = j.nivel >= t.nivel;
          linhas += `<div class="linha ${nivelOk ? '' : 'travada'}">${this.iconeItem(item)}
            <div class="info"><b>${Calc.nomeItem(item)}</b><small>${Calc.descItem(item)} · requer nível ${t.nivel}</small></div>
            <button class="btn mini" data-acao="comprarEquip" data-slot="${slot}" data-tier="${ti}" ${!nivelOk || j.ouro < preco ? 'disabled' : ''}>${nivelOk ? preco + ' ouro' : 'Nv ' + t.nivel}</button></div>`;
        });
      });
    }
    return `${this.cabecalho('Mercadora', 'Poções frescas e equipamentos de qualidade duvidosamente garantida.')}${abas}<div class="rolagem lista">${linhas}</div>`;
  },
  abrirLoja() { this.abrirModal('loja', this.htmlLoja()); },

  // ---------- Ferreiro ----------
  htmlFerreiro() {
    const j = Game.jogador, B = DATA.BAL;
    const itens = [];
    ['arma', 'armadura', 'amuleto'].forEach(s => { if (j.equip[s]) itens.push([j.equip[s], true]); });
    j.mochila.forEach(it => itens.push([it, false]));
    const linhas = itens.length ? itens.map(([it, eq]) => {
      const max = it.plus >= B.aprimMax;
      const custo = Game.custoAprimorar(it);
      const prox = Object.assign({}, it, { plus: it.plus + 1 });
      return `<div class="linha">${this.iconeItem(it)}
        <div class="info"><b>${this.nomeItemHTML(it)}${eq ? ' <em class="tag">equipado</em>' : ''}</b>
        <small>${max ? Calc.descItem(it) + ' · aprimoramento máximo' : `${Calc.descItem(it)} → ${Calc.descItem(prox)} · chance ${Math.round(B.aprimChances[it.plus] * 100)}%`}</small></div>
        <button class="btn mini" data-acao="aprimorar" data-uid="${it.uid}" ${max || j.ouro < custo ? 'disabled' : ''}>${max ? 'Máx' : custo + ' ouro'}</button></div>`;
    }).join('') : '<p class="vazio">Você ainda não tem equipamentos. A Mercadora vende alguns.</p>';
    return `${this.cabecalho('Ferreiro', 'Cada nível dá +10% no atributo. Se falhar, só o ouro vai embora.')}<div class="rolagem lista">${linhas}</div>`;
  },
  abrirFerreiro() { this.abrirModal('ferreiro', this.htmlFerreiro()); },

  // ---------- Mestre de Missões ----------
  htmlMissoes() {
    const j = Game.jogador;
    const ativas = j.missoes.map(m => {
      const M = DATA.MISSOES[m.id];
      const pronta = m.progresso >= M.qtd;
      return `<div class="linha missao ${pronta ? 'pronta' : ''}">
        <div class="info"><b>${M.titulo}</b><small>${M.texto}</small>
        ${this.barra(Math.min(m.progresso, M.qtd), M.qtd, 'xp prog', '')}<small>Recompensa: ${M.xp} XP · ${M.ouro} ouro</small></div>
        <div class="col-botoes">${pronta ? `<button class="btn mini" data-acao="entregarMissao" data-id="${m.id}" data-primary>Entregar</button>`
          : `<button class="btn mini sec" data-acao="abandonarMissao" data-id="${m.id}">Abandonar</button>`}</div></div>`;
    }).join('') || '<p class="vazio">Nenhuma missão ativa.</p>';
    const cheio = j.missoes.length >= DATA.BAL.maxMissoes;
    const disp = Object.keys(DATA.MISSOES).filter(id => {
      const M = DATA.MISSOES[id];
      return Game.zonaLiberada(M.zona) && !j.missoes.some(m => m.id === id) && !(M.tipo === 'chefe' && j.missoesFeitas[id]);
    }).map(id => {
      const M = DATA.MISSOES[id];
      return `<div class="linha missao"><div class="info"><b>${M.titulo}${M.tipo === 'chefe' ? ' <em class="tag chefe">chefe</em>' : ''}</b>
        <small>${M.texto}</small><small>${DATA.ZONAS[M.zona].nome} · ${M.xp} XP · ${M.ouro} ouro</small></div>
        <div class="col-botoes"><button class="btn mini" data-acao="aceitarMissao" data-id="${id}" ${cheio ? 'disabled' : ''}>Aceitar</button></div></div>`;
    }).join('') || '<p class="vazio">Nada novo por enquanto. Libere outras zonas.</p>';
    return `${this.cabecalho('Mestre de Missões', `Missões ativas: ${j.missoes.length}/${DATA.BAL.maxMissoes}`)}
      <div class="rolagem"><h3>Ativas</h3><div class="lista">${ativas}</div><h3>Disponíveis</h3><div class="lista">${disp}</div></div>`;
  },
  abrirMissoes() { this.abrirModal('missoes', this.htmlMissoes()); },

  // ---------- Inventário / Status ----------
  htmlInventario() {
    const j = Game.jogador, emBatalha = this.tela === 'batalha';
    const atr = ['FOR', 'DES', 'INT', 'VIT'].map(a => `<div class="atr"><span>${a}</span><b>${j.atr[a]}</b>
      ${j.pontos > 0 && !emBatalha ? `<button class="btn mini mais" data-acao="ponto" data-atr="${a}" aria-label="Aumentar ${a}">+</button>` : ''}</div>`).join('');
    const nomesAtr = '<small class="legenda">FOR: força · DES: destreza (crítico, esquiva) · INT: magia e MP · VIT: HP e defesa</small>';
    const slots = ['arma', 'armadura', 'amuleto'].map(s => {
      const it = j.equip[s];
      return `<div class="linha slot">${it ? this.iconeItem(it) : '<span class="ico ico-alt vazio-ico">—</span>'}
        <div class="info"><small>${DATA.EQUIP[s].nome}</small><b>${it ? this.nomeItemHTML(it) : 'Vazio'}</b>${it ? `<small>${Calc.descItem(it)}</small>` : ''}</div>
        ${it && !emBatalha ? `<button class="btn mini sec" data-acao="desequipar" data-slot="${s}">Tirar</button>` : ''}</div>`;
    }).join('');
    const mochila = j.mochila.length ? j.mochila.map(it => {
      const nivelOk = j.nivel >= Calc.nivelItem(it);
      const atual = j.equip[it.slot];
      const comp = atual ? this.comparar(it, atual) : '';
      return `<div class="linha">${this.iconeItem(it)}<div class="info"><b>${this.nomeItemHTML(it)}</b><small>${Calc.descItem(it)}${nivelOk ? '' : ' · requer nível ' + Calc.nivelItem(it)}</small>${comp}</div>
        ${emBatalha ? '' : `<div class="col-botoes"><button class="btn mini" data-acao="equipar" data-uid="${it.uid}" ${nivelOk ? '' : 'disabled'}>Equipar</button>
        <button class="btn mini sec" data-acao="vender" data-uid="${it.uid}">Vender ${Calc.precoVenda(it)}</button></div>`}</div>`;
    }).join('') : '<p class="vazio">Mochila vazia.</p>';
    const pocoes = Object.keys(DATA.POCOES).filter(id => j.pocoes[id] > 0).map(id => {
      const p = DATA.POCOES[id];
      return `<div class="linha">${this.iconePocao(id)}<div class="info"><b>${p.nome} ×${j.pocoes[id]}</b><small>${p.hp ? '+' + p.hp + ' HP' : '+' + p.mp + ' MP'}</small></div>
        ${emBatalha ? '' : `<button class="btn mini sec" data-acao="usarPocao" data-id="${id}">Usar</button>`}</div>`;
    }).join('') || '<p class="vazio">Sem poções.</p>';
    const hab = Calc.habilidades(j).map(h => `<li class="${j.nivel < h.nivel ? 'travada' : ''}">${this.iconeHab(h.id)}<span><b>${h.nome}</b> · ${h.mp} MP<br><small>${j.nivel < h.nivel ? 'Nível ' + h.nivel : h.desc}</small></span></li>`).join('');
    return `${this.cabecalho(`${this.esc(j.nome)} · ${DATA.CLASSES[j.classe].nome} Nv ${j.nivel}`, emBatalha ? 'Durante a batalha só dá para consultar.' : '')}
      <div class="rolagem inv">
        <section class="col"><h3>Atributos ${j.pontos > 0 ? `<em class="tag ouro">${j.pontos} pontos</em>` : ''}</h3>
          <div class="atrs-grade">${atr}</div>${nomesAtr}
          <dl class="derivados-lista">
            <dt>HP</dt><dd>${j.hp}/${Calc.hpMax(j)}</dd><dt>MP</dt><dd>${j.mp}/${Calc.mpMax(j)}</dd>
            <dt>${DATA.CLASSES[j.classe].tipoDano === 'magico' ? 'Ataque mágico' : 'Ataque'}</dt><dd>${Math.round(Calc.atk(j))}</dd>
            <dt>Defesa</dt><dd>${Calc.def(j)}</dd>
            <dt>Crítico</dt><dd>${(Calc.crit(j) * 100).toFixed(1)}%</dd><dt>Esquiva</dt><dd>${(Calc.esquiva(j) * 100).toFixed(1)}%</dd>
            <dt>XP</dt><dd>${j.nivel >= DATA.BAL.nivelMax ? 'máximo' : j.xp + '/' + Calc.xpProximo(j.nivel)}</dd>
          </dl>
          <h3>Habilidades</h3><ul class="habs">${hab}</ul>
        </section>
        <section class="col"><h3>Equipados</h3><div class="lista">${slots}</div>
          <h3>Mochila</h3><div class="lista">${mochila}</div>
          <h3>Poções</h3><div class="lista">${pocoes}</div></section>
      </div>`;
  },
  // Mostra a diferença do valor principal em relação ao item equipado
  comparar(novo, atual) {
    const dv = Calc.valorItem(novo) - Calc.valorItem(atual);
    const rot = { arma: 'ATK', armadura: 'DEF', amuleto: 'HP' }[novo.slot];
    if (!dv) return '';
    return `<small class="${dv > 0 ? 'melhor' : 'pior'}">${dv > 0 ? '▲' : '▼'} ${rot} ${dv > 0 ? '+' : ''}${dv} vs. equipado</small>`;
  },
  abrirInventario() { this.abrirModal('inventario', this.htmlInventario(), true, 'largo'); },

  // ---------- Pausa ----------
  htmlPausa() {
    return `${this.cabecalho('Pausa')}<div class="menu-vertical">
      <button class="btn" data-acao="fecharModal" data-primary>Continuar</button>
      <button class="btn sec" data-acao="salvar">Salvar</button>
      <button class="btn sec" data-acao="som">${Som.mudo ? 'Som: desligado' : 'Som: ligado'}</button>
      <button class="btn sec" data-acao="velocidade">Batalha: ${Game.vel === 1 ? 'normal' : 'rápida (' + Game.vel + '×)'}</button>
      <button class="btn sec" data-acao="qte">Golpe no tempo: ${Game.qteLigado ? 'ligado' : 'desligado'}</button>
      <button class="btn sec" data-acao="confirmarTitulo">Trocar personagem / título</button></div>
      <p class="dica">Golpe no tempo: toque na tela ou aperte Espaço quando o anel fechar (no ataque e para aparar golpes).<br>Teclas: 1–5 ações · Q/W/E/R/T/Y habilidades · ←/→ ou Tab trocar alvo · V velocidade · I inventário · Esc pausa · Enter confirma</p>`;
  },
  abrirPausa() { if (!this.modalAberto('pausa')) this.abrirModal('pausa', this.htmlPausa(), true, 'estreito'); },

  confirmar(titulo, texto, acaoSim, rotuloSim) {
    this.abrirModal('confirmar', `${this.cabecalho(titulo)}<p>${texto}</p>
      <div class="linha-botoes"><button class="btn sec" data-acao="fecharModal">Cancelar</button>
      <button class="btn perigo" data-acao="${acaoSim}" data-primary>${rotuloSim}</button></div>`, true, 'estreito');
  },

  // ---------- Diálogo da história ----------
  nomeFalante(quem) {
    if (quem === 'heroi') return Game.jogador.nome;
    if (DATA.FALANTES[quem]) return DATA.FALANTES[quem].nome;
    return DATA.INIMIGOS[quem] ? DATA.INIMIGOS[quem].nome : quem;
  },
  htmlDialogo(fala, i, total) {
    const texto = fala.texto.replace(/\{nome\}/g, Game.jogador.nome);
    const vilao = DATA.INIMIGOS[fala.quem];
    return `<div class="dialogo ${vilao ? 'vilao' : ''} ${fala.quem === 'heroi' ? 'heroi' : ''}">
      <canvas class="retrato" width="220" height="220" data-quem="${fala.quem}"></canvas>
      <div class="fala"><strong>${this.esc(this.nomeFalante(fala.quem))}</strong><p>${this.esc(texto)}</p>
        <div class="linha-botoes"><small class="contador">${i + 1}/${total}</small>
        <button class="btn sec mini" data-acao="pularDialogo">Pular</button>
        <button class="btn" data-acao="proximaFala" data-primary>${i + 1 < total ? 'Continuar ▸' : 'Fechar'}</button></div></div></div>`;
  },
  // Desenha o rosto/busto de quem fala
  desenharRetrato() {
    const m = this.modais.find(x => x.id === 'dialogo');
    const c = m && m.el.querySelector('canvas.retrato');
    if (!c) return;
    const ctx = c.getContext('2d'), quem = c.dataset.quem;
    ctx.clearRect(0, 0, 220, 220);
    const W = 220;
    if (quem === 'heroi') {
      const nome = 'hero_' + Game.jogador.classe;
      if (Assets.tem(nome)) Assets.desenharRetrato(ctx, nome, 0, 4, W, 'busto');
      else Arte.heroi(ctx, Game.jogador.classe, 0, 110, 470, 480);
    } else if (DATA.FALANTES[quem]) {
      const i = DATA.FALANTES[quem].npc;
      if (Assets.tem('npcs')) Assets.desenharRetrato(ctx, 'npcs', i, 3, W, 'busto');
      else Arte.npc(ctx, i, 110, 560, 580);
    } else if (DATA.INIMIGOS[quem]) {
      const d = DATA.INIMIGOS[quem], z = DATA.ZONAS[d.zona];
      if (d.chefe && Assets.tem(z.chefeImg)) Assets.desenharRetrato(ctx, z.chefeImg, 0, 1, W, 'inteiro');
      else if (!d.chefe && Assets.tem(z.folha)) Assets.desenharRetrato(ctx, z.folha, d.lado, 2, W, 'inteiro');
      else Arte.inimigo(ctx, quem, 110, 215, 210, { t: Game.t, fase2: false });
    }
  },

  // ---------- Resultado / Level up / Game over / Final ----------
  abrirResultado(r) {
    const linhas = [
      `<li>${this.icone('ui_icons', 15, '★')} +${r.xp} XP${r.bonusSeq ? ` <small class="seq">(sequência +${Math.round(r.bonusSeq * 100)}%)</small>` : ''}</li>`,
      ...(r.itens || []).map(it => `<li class="drop r-${it.raridade || 'comum'}">${this.iconeItem(it)} <span>${this.nomeItemHTML(it)}<br><small>${Calc.descItem(it)}</small></span></li>`),
      `<li>${this.icone('items', 15, '●')} +${r.ouro} ouro</li>`,
      ...(r.drops || []).map(d => `<li>${this.iconePocao(d)} ${DATA.POCOES[d].nome}</li>`),
      ...(r.missoes || []).map(m => `<li class="missao-msg">${m}</li>`),
      ...(r.extras || []).map(m => `<li class="destaque">${m}</li>`),
    ].join('');
    this.abrirModal('resultado', `${this.cabecalho('Vitória!', r.inimigo)}
      <ul class="recompensas">${linhas}</ul>
      <div class="linha-botoes"><button class="btn" data-acao="posResultado" data-primary>Continuar</button></div>`, false, 'estreito');
  },

  htmlLevelUp(niveis) {
    const j = Game.jogador;
    const novas = Calc.habilidades(j).filter(h => niveis.includes(h.nivel));
    const atr = ['FOR', 'DES', 'INT', 'VIT'].map(a => `<div class="atr"><span>${a}</span><b>${j.atr[a]}</b>
      <button class="btn mini mais" data-acao="pontoLevel" data-atr="${a}" ${j.pontos > 0 ? '' : 'disabled'} aria-label="Aumentar ${a}">+</button></div>`).join('');
    return `<div class="levelup-topo"><span class="estrela">★</span><h2>Nível ${j.nivel}!</h2>
      <p>HP e MP restaurados. Distribua seus pontos (pode deixar para depois no Inventário).</p></div>
      ${novas.map(h => `<p class="nova-hab">${this.iconeHab(h.id)} Nova habilidade: <b>${h.nome}</b> · ${h.desc}</p>`).join('')}
      <p class="pontos-rest">Pontos: <b>${j.pontos}</b></p>
      <div class="atrs-grade">${atr}</div>
      <div class="linha-botoes"><button class="btn" data-acao="fecharLevelUp" data-primary>Continuar</button></div>`;
  },
  abrirLevelUp(niveis) { this.niveisLevelUp = niveis; this.abrirModal('levelup', this.htmlLevelUp(niveis), false, 'estreito levelup'); },

  abrirGameOver(perda) {
    this.abrirModal('gameover', `<div class="gameover"><h2>Você caiu…</h2>
      <p>Os aldeões te arrastaram de volta para a vila. Foi constrangedor, mas você está vivo.</p>
      <p>Perdeu <b>${perda} ouro</b> pelo caminho. HP e MP restaurados.</p></div>
      <div class="linha-botoes"><button class="btn" data-acao="posGameOver" data-primary>Voltar à vila</button></div>`, false, 'estreito escuro');
  },

  tela_final() {
    const j = Game.jogador, s = j.stats;
    const h = Math.floor(s.tempo / 3600), m = Math.floor((s.tempo % 3600) / 60), seg = Math.floor(s.tempo % 60);
    const tempo = `${h ? h + 'h ' : ''}${m}min ${seg}s`;
    return `<div class="painel final">
      <h1 class="logo-texto pequeno">O sol nasceu de novo</h1>
      <p>${this.esc(j.nome)} derrotou o Imperador Eclipse. A vila esquecida agora tem um herói, e ninguém mais esquece de pagar o ferreiro.</p>
      <dl class="stats-final"><dt>Tempo de jogo</dt><dd>${tempo}</dd><dt>Batalhas</dt><dd>${s.batalhas}</dd>
        <dt>Vitórias</dt><dd>${s.vitorias}</dd><dt>Quedas</dt><dd>${s.mortes}</dd><dt>Nível</dt><dd>${j.nivel}</dd><dt>Classe</dt><dd>${DATA.CLASSES[j.classe].nome}</dd></dl>
      <div class="linha-botoes"><button class="btn sec" data-acao="voltarTitulo">Título</button>
      <button class="btn" data-acao="continuarAposFinal" data-primary>Continuar jogando</button></div></div>`;
  },
};
