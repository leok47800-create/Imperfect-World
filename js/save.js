// ============================================================
// save.js — criação do jogador e salvamento em localStorage (1 slot)
// ============================================================

const Save = {
  CHAVE: 'imperfectWorld_save',

  // Cria um personagem novo com os atributos base + bônus da classe
  novoJogador(nome, classe) {
    const B = DATA.BAL, cl = DATA.CLASSES[classe];
    const atr = { FOR: B.atributoBase, DES: B.atributoBase, INT: B.atributoBase, VIT: B.atributoBase };
    Object.keys(cl.bonus).forEach(k => atr[k] += cl.bonus[k]);
    const j = {
      versao: 1,
      nome: nome || 'Herói', classe,
      nivel: 1, xp: 0, pontos: 0,
      atr,
      ouro: B.ouroInicial,
      equip: { arma: null, armadura: null, amuleto: null },
      mochila: [],                       // equipamentos guardados
      pocoes: { vidaP: 0, vidaM: 0, vidaG: 0, manaP: 0, manaM: 0 },
      missoes: [],                       // [{ id, progresso }]
      missoesFeitas: {},                 // missões de chefe concluídas
      chefes: {},                        // zona -> true quando o chefe foi derrotado
      stats: { tempo: 0, batalhas: 0, vitorias: 0, mortes: 0 },
      proxUid: 1,
      venceu: false,
      sequencia: 0,      // vitórias seguidas sem voltar à vila
      bestiario: {},     // fraquezas descobertas: inimigo -> { elemento: true }
      vistos: {},        // cenas da história já vistas
      lendarios: {},     // itens exclusivos de chefe já obtidos
      hp: 0, mp: 0,
    };
    Object.keys(B.pocoesIniciais).forEach(k => j.pocoes[k] = B.pocoesIniciais[k]);
    j.hp = Calc.hpMax(j); j.mp = Calc.mpMax(j);
    return j;
  },

  // ---------- 3 espaços de save (um personagem em cada) ----------
  SLOTS: 3,
  slotAtual: 1,
  chaveSlot(n) { return 'imperfectWorld_slot' + n; },

  // Ler/gravar no localStorage sem quebrar quando ele não existe
  ler(chave) { try { return localStorage.getItem(chave); } catch (e) { return null; } },
  gravar(chave, valor) { try { localStorage.setItem(chave, valor); return true; } catch (e) { return false; } },

  // Na primeira vez, move o save antigo (1 slot só) para o espaço 1
  migrar() {
    const antigo = this.ler(this.CHAVE);
    if (antigo && !this.ler(this.chaveSlot(1))) this.gravar(this.chaveSlot(1), antigo);
    if (antigo) { try { localStorage.removeItem(this.CHAVE); } catch (e) { /* armazenamento indisponível */ } }
    const ult = +this.ler('imperfectWorld_ultimoSlot');
    if (ult >= 1 && ult <= this.SLOTS) this.slotAtual = ult;
  },

  usarSlot(n) { this.slotAtual = n; this.gravar('imperfectWorld_ultimoSlot', String(n)); },

  existe(n) {
    if (n) return !!this.ler(this.chaveSlot(n));
    for (let k = 1; k <= this.SLOTS; k++) if (this.ler(this.chaveSlot(k))) return true;
    return false;
  },

  salvar(j) {
    if (!j) return false;
    j.salvoEm = Date.now();
    return this.gravar(this.chaveSlot(this.slotAtual), JSON.stringify(j));
  },

  carregar(n) {
    try {
      const txt = this.ler(this.chaveSlot(n || this.slotAtual));
      if (!txt) return null;
      const j = JSON.parse(txt);
      if (!j || !DATA.CLASSES[j.classe]) return null;
      // Completa campos que possam faltar em saves antigos
      const base = this.novoJogador(j.nome, j.classe);
      Object.keys(base).forEach(k => { if (j[k] === undefined) j[k] = base[k]; });
      ['pocoes', 'stats', 'equip'].forEach(k => Object.keys(base[k]).forEach(s => { if (j[k][s] === undefined) j[k][s] = base[k][s]; }));
      j.hp = Math.min(j.hp, Calc.hpMax(j)); j.mp = Math.min(j.mp, Calc.mpMax(j));
      return j;
    } catch (e) { return null; }
  },

  apagar(n) {
    try { localStorage.removeItem(this.chaveSlot(n || this.slotAtual)); } catch (e) { /* armazenamento indisponível */ }
  },

  // Resumo para a tela de escolha de personagem
  resumo(n) {
    const j = this.carregar(n);
    if (!j) return null;
    const zonas = DATA.ORDEM_ZONAS.filter(z => j.nivel >= DATA.ZONAS[z].nivelMin && (!DATA.ZONAS[z].requerChefe || j.chefes[DATA.ZONAS[z].requerChefe]));
    const zona = DATA.ZONAS[zonas[zonas.length - 1] || 'floresta'].nome;
    return { j, nome: j.nome, classe: j.classe, nivel: j.nivel, ouro: j.ouro, tempo: j.stats.tempo, zona,
      chefes: Object.keys(j.chefes).length, venceu: j.venceu, salvoEm: j.salvoEm || 0 };
  },
};
