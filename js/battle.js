// ============================================================
// battle.js — fórmulas (Calc) e o combate por turnos (Batalha)
// ============================================================

// ---------- Fórmulas derivadas dos atributos ----------
const Calc = {
  aleatorio(a, b) { return a + Math.random() * (b - a); },
  inteiro(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },

  // Valor do item já com o bônus de aprimoramento (+10% por nível)
  valorItem(item) {
    if (!item) return 0;
    const base = DATA.EQUIP[item.slot].valores[item.tier];
    return Math.round(base * (1 + DATA.BAL.aprimBonus * item.plus));
  },
  nivelItem(item) { return DATA.TIERS[item.tier].nivel; },

  // Soma um bônus extra (crit, esquiva, atk, def, hp, mp) dos itens equipados
  bonus(j, chave) {
    let t = 0;
    ['arma', 'armadura', 'amuleto'].forEach(s => { const it = j.equip[s]; if (it && it.bonus && it.bonus[chave]) t += it.bonus[chave]; });
    return t;
  },
  raridade(item) { return DATA.RARIDADES[item.raridade || 'comum']; },
  precoVenda(item) {
    const base = DATA.EQUIP[item.slot].precos[item.tier];
    return Math.floor(base * DATA.BAL.precoVendaPct * this.raridade(item).venda * (1 + 0.15 * item.plus));
  },

  nomeItem(item) {
    if (item.nomeUnico) return `${item.nomeUnico}${item.plus ? ' +' + item.plus : ''}`;
    const tier = DATA.TIERS[item.tier].nome;
    const base = item.slot === 'arma' ? DATA.ARMAS[item.tipoArma].nome : DATA.EQUIP[item.slot].nomeItem;
    return `${base} de ${tier}${item.plus ? ' +' + item.plus : ''}`;
  },
  iconeItem(item) {
    return item.slot === 'arma' ? DATA.ARMAS[item.tipoArma].icones[item.tier] : DATA.EQUIP[item.slot].icones[item.tier];
  },
  descItem(item) {
    const v = this.valorItem(item);
    const base = { arma: `ATK +${v}`, armadura: `DEF +${v}`, amuleto: `HP +${v}` }[item.slot];
    return [base, ...this.descBonus(item)].join(' · ');
  },
  descBonus(item) {
    if (!item.bonus) return [];
    return Object.keys(item.bonus).map(k => {
      const A = DATA.AFIXOS[k], v = item.bonus[k];
      return `${A.nome} +${A.pct ? Math.round(v * 100) + '%' : v}`;
    });
  },

  atk(j) {
    const B = DATA.BAL, cl = DATA.CLASSES[j.classe];
    const arma = this.valorItem(j.equip.arma);
    const extra = this.bonus(j, 'atk');
    if (cl.tipoDano === 'magico') return arma + extra + j.atr.INT * B.atkMagPorInt;
    return arma + extra + j.atr[cl.atrAtaque] * B.atkFisPorAtr;
  },
  def(j) { return this.valorItem(j.equip.armadura) + this.bonus(j, 'def') + j.atr.VIT * DATA.BAL.defPorVit; },
  hpMax(j) { return DATA.BAL.hpBase + j.atr.VIT * DATA.BAL.hpPorVit + this.valorItem(j.equip.amuleto) + this.bonus(j, 'hp'); },
  mpMax(j) { return DATA.BAL.mpBase + j.atr.INT * DATA.BAL.mpPorInt + this.bonus(j, 'mp'); },
  crit(j) { return DATA.BAL.critBase + j.atr.DES * DATA.BAL.critPorDes + this.bonus(j, 'crit'); },
  esquiva(j) { return j.atr.DES * DATA.BAL.esquivaPorDes + this.bonus(j, 'esquiva'); },
  // Multiplicador de dano do elemento contra o inimigo (1 = neutro)
  elemento(d, elem) { return (d.elem && elem && d.elem[elem]) || 1; },
  xpProximo(nivel) { return Math.round(DATA.BAL.xpBase * Math.pow(nivel, DATA.BAL.xpExpoente)); },

  habilidades(j) {
    return DATA.CLASSES[j.classe].habilidades.map(id => Object.assign({ id }, DATA.HABILIDADES[id]));
  },

  // Dano = ataque × aleatório(0,9 a 1,1) − defesa × 0,5 (mínimo 1)
  dano(atk, defAlvo) {
    const B = DATA.BAL;
    return Math.max(B.danoMin, Math.round(atk * this.aleatorio(B.danoVarMin, B.danoVarMax) - defAlvo * B.defFator));
  },
};

// ---------- Combate (1 a 3 inimigos ao mesmo tempo) ----------
// Cada inimigo da batalha é um objeto:
// { i, id, d (dados), hp, hpMax, atordoado, turno, turnoFase2, fase, preparando, morteT,
//   guarda, guardaMax, quebrado, intencao, defendendo, protegido, remontou, fugiu, dot }
class Batalha {
  constructor(ids) {
    if (!Array.isArray(ids)) ids = [ids];
    this.inimigos = ids.map((id, i) => {
      const d = DATA.INIMIGOS[id];
      const g = d.guarda || 2;
      return { i, id, d, hp: d.hp, hpMax: d.hp, atordoado: 0, turno: 0, turnoFase2: 0, fase: 1, preparando: false, morteT: 0,
        guarda: g, guardaMax: g, quebrado: 0, intencao: null, defendendo: false, protegido: false, remontou: false, fugiu: false, dot: null };
    });
    this.alvo = 0;
    // estado temporário do herói nesta batalha
    this.h = { grito: 0, escudo: 0, vento: false, critProximo: false, defendendo: false, nevoa: 0, queimadura: 0, veneno: 0 };
    this.log = [];
    this.ocupado = false;
    this.acabou = false;
    const primeiro = this.inimigos[0].d;
    if (this.inimigos.length === 1) this.registrar(`${primeiro.chefe ? 'CHEFE! ' : ''}${primeiro.nome} aparece!`);
    else this.registrar(`Uma horda de ${this.inimigos.length} monstros aparece! ${this.inimigos.map(e => e.d.nome).join(', ')}.`);
    this.inimigos.forEach(e => this.decidirIntencao(e));
  }

  get j() { return Game.jogador; }
  get vivos() { return this.inimigos.filter(e => e.hp > 0); }
  get chefe() { return !!this.inimigos[0].d.chefe; }
  get horda() { return this.inimigos.length > 1; }
  // Alvo selecionado (se morreu, pula para o próximo vivo)
  get alvoAtual() {
    const a = this.inimigos[this.alvo];
    if (a && a.hp > 0) return a;
    const v = this.vivos[0];
    if (v) this.alvo = v.i;
    return v || this.inimigos[0];
  }
  // Atalhos usados pela interface e pelos chefes (batalha de chefe tem 1 inimigo só)
  get d() { return this.alvoAtual.d; }
  get id() { return this.alvoAtual.id; }

  selecionarAlvo(i) {
    const e = this.inimigos[i];
    if (!e || e.hp <= 0) return;
    this.alvo = i;
    UI.atualizarBatalha();
  }
  trocarAlvo(dir) {
    const v = this.vivos;
    if (v.length < 2) return;
    const pos = v.indexOf(this.alvoAtual);
    this.selecionarAlvo(v[(pos + dir + v.length) % v.length].i);
    Som.clique();
  }

  // Marca que o jogador descobriu como esse inimigo reage a um elemento
  descobrir(id, elem) {
    const j = this.j;
    if (!j.bestiario) j.bestiario = {};
    if (!j.bestiario[id]) j.bestiario[id] = {};
    j.bestiario[id][elem] = true;
  }

  // Intervalo do especial (chefe com pouca vida usa 2× mais)
  intervaloEspecial(e) {
    let n = e.d.especial.intervalo;
    if (e.d.chefe && e.hp < e.hpMax * DATA.BAL.chefeVidaBaixa) n = Math.max(1, Math.round(n / 2));
    return n;
  }
  // O especial cai no próximo turno desse inimigo?
  especialNoProximo(e) {
    const esp = e.d.especial;
    if (!esp || (esp.soFase2 && e.fase !== 2)) return false;
    const cont = (esp.soFase2 ? e.turnoFase2 : e.turno) + 1;
    return cont % this.intervaloEspecial(e) === 0;
  }

  atkInimigo(e) { return e.d.atk * (e.fase === 2 ? 1 + e.d.fase2.bonusAtk : 1); }

  // Dano estimado que um ataque do monstro causaria (para a intenção na tela)
  danoEstimado(e, mult, ignoraDef) {
    const atk = this.atkInimigo(e) * (mult || 1);
    return ignoraDef ? Math.round(atk) : Calc.dano(atk, Calc.def(this.j)) ;
  }

  // ---------- Intenção: o que cada monstro fará no próximo turno ----------
  // tipo: 'atacar' | 'forte' | 'cuspe' | 'proteger' | 'defender' | 'fugir' | 'especial'
  decidirIntencao(e) {
    if (e.hp <= 0) { e.intencao = null; return; }
    const d = e.d, C = DATA.COMPORTAMENTOS, prox = e.turno + 1;
    let it = { tipo: 'atacar' };
    if (d.especial && this.especialNoProximo(e)) {
      it = { tipo: 'especial', nome: d.especial.nome };
    } else if (d.comportamento === 'investida' && prox % C.investida.a_cada === 0) {
      it = { tipo: 'forte', nome: 'Investida', mult: C.investida.mult };
    } else if (d.comportamento === 'cuspe' && prox % C.cuspe.a_cada === 0) {
      it = { tipo: 'cuspe', nome: 'Cuspe ácido', mult: C.cuspe.mult };
    } else if (d.comportamento === 'protetor') {
      const ferido = this.vivos.filter(o => o !== e && !o.protegido && o.hp < o.hpMax * 0.6).sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0];
      if (ferido) it = { tipo: 'proteger', alvo: ferido.i, nome: 'Proteger' };
      else if (e.hp < e.hpMax * 0.5 && Math.random() < 0.35) it = { tipo: 'defender', nome: 'Defender' };
    } else if (d.comportamento === 'fugitiva' && this.horda && this.vivos.length === 1) {
      it = { tipo: 'fugir', nome: 'Fugir' };
    }
    // valor mostrado na tela
    if (it.tipo === 'atacar') it.valor = this.danoEstimado(e, 1);
    if (it.tipo === 'forte' || it.tipo === 'cuspe') it.valor = this.danoEstimado(e, it.mult);
    if (it.tipo === 'especial') {
      const esp = d.especial;
      it.valor = esp.id === 'garras' ? this.danoEstimado(e, 1) * 2 : esp.id === 'eclipse' ? this.danoEstimado(e, esp.mult, true) : this.danoEstimado(e, 1);
    }
    e.intencao = it;
    e.preparando = it.tipo === 'especial';
  }

  registrar(msg) {
    this.log.push(msg);
    while (this.log.length > 3) this.log.shift();
    UI.atualizarLog();
  }

  // Verifica se uma ação pode ser feita agora (devolve texto do problema ou null)
  problema(tipo, arg) {
    if (this.ocupado || this.acabou) return 'Aguarde…';
    if (tipo === 'habilidade') {
      const hab = DATA.HABILIDADES[arg];
      if (!hab || !DATA.CLASSES[this.j.classe].habilidades.includes(arg)) return 'Habilidade indisponível.';
      if (this.j.nivel < hab.nivel) return `${hab.nome} libera no nível ${hab.nivel}.`;
      if (this.j.mp < hab.mp) return `MP insuficiente para ${hab.nome} (${hab.mp} MP).`;
    }
    if (tipo === 'item') {
      if (!DATA.POCOES[arg] || !this.j.pocoes[arg]) return 'Você não tem essa poção.';
    }
    if (tipo === 'fugir' && this.chefe) return 'Não dá para fugir de um chefe!';
    return null;
  }

  // Executa a ação do jogador e, em seguida, o turno de cada inimigo vivo
  async acao(tipo, arg) {
    const prob = this.problema(tipo, arg);
    if (prob) { if (!this.ocupado) { UI.toast(prob); Som.erro(); } return false; }
    this.ocupado = true;
    UI.atualizarBatalha();
    try {
      if (tipo === 'atacar') await this.atacar();
      else if (tipo === 'habilidade') await this.usarHabilidade(arg);
      else if (tipo === 'item') await this.usarItem(arg);
      else if (tipo === 'defender') await this.defender();
      else if (tipo === 'fugir') {
        if (await this.fugir()) { this.acabou = true; Game.fimDeBatalha('fuga'); return true; }
      }
      if (this.j.hp <= 0) { await this.derrota(); return true; }   // explosão da Lanterna pode derrubar
      if (!this.vivos.length) { await this.vitoria(); return true; }
      await Game.esperar(280);
      for (const e of this.vivos) {
        if (e.hp <= 0) continue;
        await this.turnoInimigo(e);
        if (this.j.hp <= 0) break;
        if (this.vivos.length > 1) await Game.esperar(150);
      }
      if (this.j.hp <= 0) { await this.derrota(); return true; }
      await this.fimDaRodada();
      if (this.j.hp <= 0) { await this.derrota(); return true; }
      if (!this.vivos.length) { await this.vitoria(); return true; }
    } finally {
      this.ocupado = false;
      UI.atualizarBatalha();
    }
    return true;
  }

  // ---------- Golpe no tempo certo ----------
  // Devolve o multiplicador e o bônus de crítico do QTE de ataque
  bonusTempo(res) {
    const B = DATA.BAL;
    if (res === 'perfeito') return { mult: B.qteAtaque.perfeito, crit: B.qteCritPerfeito, perfeito: true };
    if (res === 'bom') return { mult: B.qteAtaque.bom, crit: 0, perfeito: false };
    return { mult: 1, crit: 0, perfeito: false };
  }

  // Tira guarda do inimigo; quebra quando chega a zero
  tirarGuarda(e, n) {
    if (e.hp <= 0 || e.quebrado > 0 || n <= 0) return;
    e.guarda = Math.max(0, e.guarda - n);
    if (e.guarda === 0) {
      e.quebrado = 2; // perde o próximo turno e toma dano dobrado até se recuperar
      Game.fx.numero(e.i, 'QUEBROU!', 'quebra');
      Game.fx.tremor(10); Som.critico();
      let msg = `A guarda de ${e.d.nome} QUEBROU! Ele perde o próximo turno e toma dano dobrado.`;
      if (e.preparando) { msg += ` ${e.d.especial.nome} foi cancelado!`; e.preparando = false; }
      e.intencao = { tipo: 'quebrado', nome: 'Atordoado' };
      this.registrar(msg);
    }
  }

  // Quando um monstro chega a 0 de HP (remonta, explode etc.)
  aoMorrer(e, elemento) {
    const d = e.d, B = DATA.BAL, C = DATA.COMPORTAMENTOS, j = this.j;
    if (d.comportamento === 'remonta' && !e.remontou && !C.remonta.fracos.includes(elemento)) {
      e.remontou = true;
      e.hp = Math.round(e.hpMax * 0.5);
      e.guarda = e.guardaMax; e.quebrado = 0;
      Game.fx.numero(e.i, 'Remontou!', 'aviso');
      this.registrar(`${d.nome} junta os ossos e se levanta de novo! (Arcano ou Fogo impedem isso)`);
      this.decidirIntencao(e);
      return;
    }
    e.intencao = null;
    if (this.horda) this.registrar(`${d.nome} foi derrotado!`);
    if (d.comportamento === 'explode') {
      let dano = Math.max(B.danoMin, Math.round(this.atkInimigo(e) * C.explode.mult * Calc.aleatorio(B.danoVarMin, B.danoVarMax)));
      if (this.h.defendendo) dano = Math.round(dano * (1 - B.defenderReducao));
      if (this.h.vento) dano = 0;
      j.hp = Math.max(0, j.hp - dano);
      Game.fx.particulas(e.i, 'fogo'); Som.raio();
      Game.fx.numero('heroi', dano ? String(dano) : 'Esquiva', dano ? 'queimadura' : 'miss');
      if (dano) Game.fx.impacto('heroi', 8);
      this.registrar(`${d.nome} explode! ${dano ? dano + ' de dano de fogo.' : 'Você desvia.'}`);
    }
  }

  // Um golpe do herói num inimigo. Devolve { dano, crit, errou, eficaz, resistiu }
  // opts: { ignoraDef, critGarantido, execucao, tempo: {mult, crit, perfeito} }
  golpear(e, mult, bonusCrit, elemento, opts) {
    opts = opts || {};
    const B = DATA.BAL, j = this.j, d = e.d, tempo = opts.tempo || { mult: 1, crit: 0 };
    if (this.h.nevoa > 0 && !tempo.perfeito && Math.random() < B.nevoaPenalidade) {
      Game.fx.numero(e.i, 'Errou', 'miss'); Som.esquiva();
      return { dano: 0, crit: false, errou: 'A névoa atrapalha a mira' };
    }
    if (d.esquiva && !opts.ignoraDef && !tempo.perfeito && Math.random() < d.esquiva) {
      Game.fx.numero(e.i, 'Esquiva', 'miss'); Som.esquiva();
      return { dano: 0, crit: false, errou: `${d.nome} se esquiva` };
    }
    const buff = this.h.grito > 0 ? 1 + DATA.HABILIDADES.grito.bonusAtk : 1;
    let dano = Calc.dano(Calc.atk(j) * mult * buff * tempo.mult, opts.ignoraDef ? 0 : d.def);
    // Passo do Vento deixa o próximo golpe crítico
    const critVento = this.h.critProximo;
    this.h.critProximo = false;
    const crit = opts.critGarantido || critVento || Math.random() < Calc.crit(j) + (bonusCrit || 0) + tempo.crit;
    if (crit) dano = Math.round(dano * B.critMult);
    if (opts.execucao && e.hp < e.hpMax * opts.execucao.limiar) {
      dano = Math.round(dano * opts.execucao.mult);
      Game.fx.numero(e.i, 'Execução!', 'eficaz');
    }
    let me = Calc.elemento(d, elemento);
    if (opts.ignoraDef && me < 1) me = 1; // perfurante ignora resistências
    if (me !== 1) {
      dano = Math.max(B.danoMin, Math.round(dano * me));
      this.descobrir(e.id, elemento);
      Game.fx.numero(e.i, me > 1 ? 'Eficaz!' : 'Resistiu', me > 1 ? 'eficaz' : 'miss');
    }
    // Guarda quebrada, defesa e proteção
    if (e.quebrado > 0) dano = Math.round(dano * B.quebraMultDano);
    if (e.defendendo || e.protegido) dano = Math.max(B.danoMin, Math.round(dano * B.defesaInimigo));
    e.hp = Math.max(0, e.hp - dano);
    Game.fx.impacto(e.i, crit ? 12 : 6);
    Game.fx.numero(e.i, String(dano), crit ? 'critico' : 'dano');
    crit ? Som.critico() : Som.golpe();
    // Fraqueza e golpe perfeito tiram guarda (os dois juntos tiram 2)
    if (e.hp > 0) this.tirarGuarda(e, (me > 1 ? 1 : 0) + (tempo.perfeito ? 1 : 0));
    if (e.hp <= 0) this.aoMorrer(e, elemento);
    UI.atualizarBatalha();
    return { dano, crit, errou: null, eficaz: me > 1, resistiu: me < 1 };
  }

  descreverGolpe(r) {
    if (r.errou) return `${r.errou}!`;
    return `${r.dano} de dano${r.crit ? ' (CRÍTICO!)' : ''}${r.eficaz ? ' (eficaz!)' : ''}${r.resistiu ? ' (resistiu)' : ''}`;
  }

  async atacar() {
    const e = this.alvoAtual;
    Game.fx.frameHeroi(1, 450);
    const res = await Game.qte('ataque', e.i);
    const tempo = this.bonusTempo(res);
    await Game.fx.investida('heroi');
    const r = this.golpear(e, 1, 0, DATA.CLASSES[this.j.classe].elemento, { tempo });
    this.registrar(`${this.j.nome} ataca${this.horda ? ' ' + e.d.nome : ''}${tempo.perfeito ? ' (golpe perfeito)' : ''}: ${this.descreverGolpe(r)}`);
    await Game.esperar(200);
  }

  async usarHabilidade(id) {
    const hab = DATA.HABILIDADES[id], j = this.j;
    const cl = DATA.CLASSES[j.classe];
    j.mp -= hab.mp;
    Game.fx.frameHeroi(2, 700);
    if (hab.tipo === 'dano') {
      const res = await Game.qte('ataque', this.alvoAtual.i);
      const tempo = this.bonusTempo(res);
      if (cl.tipoDano === 'fisico') await Game.fx.investida('heroi');
      else await Game.esperar(220);
      if (hab.particula === 'raio') Som.raio(); else if (cl.tipoDano === 'magico') Som.magia();
      // Habilidade em área acerta todos os vivos; as outras, só o alvo
      const alvos = hab.area ? this.vivos : [this.alvoAtual];
      alvos.forEach(e => Game.fx.particulas(e.i, hab.particula));
      const partes = [];
      this.ultimoTotal = 0;
      for (const e of alvos) {
        let total = 0, alvo = e;
        const sub = [];
        for (let g = 0; g < hab.golpes; g++) {
          if (alvo.hp <= 0) { alvo = this.alvoAtual; if (alvo.hp <= 0) break; } // 2º golpe vai para outro se o 1º matou
          const r = this.golpear(alvo, hab.mult, hab.bonusCrit || 0, hab.elemento,
            { ignoraDef: hab.ignoraDef, critGarantido: hab.critGarantido, execucao: hab.execucao, tempo: g === 0 ? tempo : { mult: tempo.mult, crit: tempo.crit } });
          total += r.dano;
          // Veneno/queimadura no inimigo
          if (hab.dot && r.dano > 0 && alvo.hp > 0) {
            alvo.dot = { tipo: hab.dot.tipo, turnos: hab.dot.turnos, dano: Math.max(1, Math.round(Calc.atk(j) * hab.dot.mult)) };
            Game.fx.numero(alvo.i, hab.dot.tipo === 'veneno' ? 'Envenenado!' : 'Queimando!', 'status');
          }
          sub.push(this.descreverGolpe(r));
          if (g < hab.golpes - 1) await Game.esperar(220);
        }
        this.ultimoTotal += total;
        partes.push((alvos.length > 1 ? e.d.nome + ' ' : '') + sub.join(' + '));
        if (hab.chanceAtordoar && total > 0 && e.hp > 0 && Math.random() < hab.chanceAtordoar) {
          e.atordoado = 1;
          Game.fx.numero(e.i, 'Atordoado!', 'status');
        }
      }
      this.registrar(`${j.nome} usa ${hab.nome}${tempo.perfeito ? ' (perfeito)' : ''}: ${partes.join(' · ')}`);
      if (hab.rouboVida) {
        const c = Math.min(Math.round(this.ultimoTotal * hab.rouboVida), Calc.hpMax(j) - j.hp);
        if (c > 0) {
          j.hp += c;
          Game.fx.numero('heroi', '+' + c, 'cura');
          Game.fx.particulas('heroi', 'sangue');
          this.registrar(`${j.nome} absorve ${c} HP.`);
        }
      }
      const atord = alvos.filter(e => e.atordoado > 0 && e.hp > 0);
      if (hab.chanceAtordoar && atord.length) this.registrar(`${atord.map(e => e.d.nome).join(' e ')} ficou atordoado!`);
    } else if (hab.tipo === 'buff') {
      this.h.grito = hab.turnos + 1; // +1 porque a rodada atual também desconta
      Game.fx.particulas('heroi', 'aura'); Som.magia();
      Game.fx.numero('heroi', 'ATK +30%', 'status');
      this.registrar(`${j.nome} solta o Grito de Guerra! Ataque +30% por ${hab.turnos} turnos.`);
    } else if (hab.tipo === 'escudo') {
      this.h.escudo = Math.round(j.atr.INT * hab.porInt);
      Game.fx.particulas('heroi', 'arcano'); Som.magia();
      Game.fx.numero('heroi', `Escudo ${this.h.escudo}`, 'status');
      this.registrar(`${j.nome} conjura o Escudo Arcano (absorve ${this.h.escudo}).`);
    } else if (hab.tipo === 'vento') {
      this.h.vento = true;          // desvia de todos os ataques desta rodada
      this.h.critProximo = true;    // e o próximo golpe é crítico
      Game.fx.particulas('heroi', 'folha'); Som.esquiva();
      Game.fx.numero('heroi', 'Passo do Vento', 'status');
      this.registrar(`${j.nome} usa Passo do Vento: desvia de tudo nesta rodada, e o próximo tiro é crítico.`);
    } else if (hab.tipo === 'cura') {
      const c = Math.min(Math.round(Calc.hpMax(j) * hab.pctHp), Calc.hpMax(j) - j.hp);
      j.hp += c;
      const limpou = this.h.veneno > 0 || this.h.queimadura > 0;
      this.h.veneno = 0; this.h.queimadura = 0;
      Game.fx.particulas('heroi', 'cura'); Som.cura();
      Game.fx.numero('heroi', '+' + c, 'cura');
      this.registrar(`${j.nome} usa ${hab.nome}: +${c} HP${limpou ? ' e se livra dos efeitos' : ''}.`);
    }
    await Game.esperar(250);
  }

  async usarItem(id) {
    const p = DATA.POCOES[id], j = this.j;
    j.pocoes[id]--;
    Game.fx.particulas('heroi', 'cura'); Som.cura();
    if (p.hp) {
      const c = Math.min(p.hp, Calc.hpMax(j) - j.hp);
      j.hp += c;
      Game.fx.numero('heroi', '+' + c, 'cura');
      this.registrar(`${j.nome} bebe ${p.nome}: +${c} HP.`);
    } else {
      const c = Math.min(p.mp, Calc.mpMax(j) - j.mp);
      j.mp += c;
      Game.fx.numero('heroi', '+' + c + ' MP', 'mp');
      this.registrar(`${j.nome} bebe ${p.nome}: +${c} MP.`);
    }
    await Game.esperar(350);
  }

  async defender() {
    const j = this.j;
    this.h.defendendo = true;
    const rec = Math.min(Math.round(Calc.mpMax(j) * DATA.BAL.defenderRecMP), Calc.mpMax(j) - j.mp);
    j.mp += rec;
    Som.defesa();
    Game.fx.particulas('heroi', 'defesa');
    Game.fx.numero('heroi', `Defesa${rec > 0 ? ' +' + rec + ' MP' : ''}`, 'mp');
    this.registrar(`${j.nome} se defende (dano −50%, +${rec} MP).`);
    await Game.esperar(300);
  }

  async fugir() {
    if (Math.random() < DATA.BAL.fugaChance) {
      Som.esquiva();
      this.registrar(`${this.j.nome} fugiu da batalha!`);
      Game.fx.fuga = 1;
      await Game.esperar(600);
      return true;
    }
    this.registrar('A fuga falhou!');
    Som.erro();
    await Game.esperar(300);
    return false;
  }

  // ---------- Turno de um inimigo (IA) ----------
  async turnoInimigo(e) {
    const d = e.d;
    // O que este monstro protegeu/defendeu vale até o turno dele
    e.defendendo = false;
    this.inimigos.forEach(o => { if (o.protegidoPor === e.i) { o.protegido = false; o.protegidoPor = null; } });
    // Guarda quebrada: perde o turno e depois se recupera
    if (e.quebrado > 0) {
      e.quebrado--;
      if (e.quebrado > 0) {
        Game.fx.numero(e.i, 'Guarda quebrada', 'status');
        this.registrar(`${d.nome} está com a guarda quebrada e perde o turno.`);
        await Game.esperar(450);
        e.turno++; if (e.fase === 2) e.turnoFase2++;
        this.decidirIntencao(e);
        if (e.intencao && e.intencao.tipo === 'especial') this.anunciarEspecial(e);
        return;
      }
      e.guarda = e.guardaMax;
      this.registrar(`${d.nome} recupera a guarda.`);
    }
    if (e.atordoado > 0) {
      e.atordoado--;
      Game.fx.numero(e.i, 'Atordoado', 'status');
      this.registrar(`${d.nome} está atordoado e perde o turno.`);
      await Game.esperar(500);
      return;
    }
    // Regeneração (Serpente das Brumas)
    if (d.regen && e.hp < e.hpMax) {
      const c = Math.min(Math.round(e.hpMax * d.regen), e.hpMax - e.hp);
      e.hp += c;
      Game.fx.numero(e.i, '+' + c, 'cura');
      this.registrar(`${d.nome} regenera ${c} HP.`);
      UI.atualizarBatalha();
      await Game.esperar(350);
    }
    // Fase 2 (Imperador Eclipse)
    if (d.fase2 && e.fase === 1 && e.hp <= e.hpMax * d.fase2.limiar) {
      e.fase = 2;
      Game.fx.particulas(e.i, 'eclipse'); Game.fx.tremor(16); Som.raio();
      Game.fx.numero(e.i, 'FASE 2', 'critico');
      this.registrar(`${d.nome} entra na FASE 2! Ataque +30%.`);
      UI.atualizarBatalha();
      await Game.esperar(800);
      if (DATA.HISTORIA['fase2_' + e.id]) await Game.dialogo('fase2_' + e.id);
    }
    e.turno++;
    if (e.fase === 2) e.turnoFase2++;
    const it = e.intencao || { tipo: 'atacar' };
    e.preparando = false;
    switch (it.tipo) {
      case 'especial': await this.especial(e, d.especial); break;
      case 'forte': {
        this.registrar(`${d.nome} dá uma ${it.nome}!`);
        await this.golpeInimigo(e, it.mult, false, 'investe');
        break;
      }
      case 'cuspe': {
        this.registrar(`${d.nome} cospe ácido!`);
        await this.golpeInimigo(e, it.mult, false, 'cospe ácido', { venenoGarantido: true });
        break;
      }
      case 'proteger': {
        const o = this.inimigos[it.alvo];
        if (o && o.hp > 0) {
          o.protegido = true; o.protegidoPor = e.i;
          Game.fx.numero(o.i, 'Protegido', 'status'); Som.defesa();
          this.registrar(`${d.nome} protege ${o.d.nome}: ele toma metade do dano até o próximo turno do ${d.nome}.`);
          await Game.esperar(400);
        } else await this.golpeInimigo(e, 1, false, 'ataca');
        break;
      }
      case 'defender': {
        e.defendendo = true;
        e.guarda = Math.min(e.guardaMax, e.guarda + 1);
        Game.fx.numero(e.i, 'Defende', 'status'); Som.defesa();
        this.registrar(`${d.nome} se defende e recupera 1 de guarda.`);
        await Game.esperar(400);
        break;
      }
      case 'fugir': {
        e.fugiu = true; e.hp = 0; e.intencao = null;
        Game.fx.numero(e.i, 'Fugiu!', 'miss'); Som.esquiva();
        this.registrar(`${d.nome} bate as asas e foge! (sem recompensa por ela)`);
        await Game.esperar(400);
        break;
      }
      default: await this.golpeInimigo(e, 1, false, 'ataca');
    }
    if (e.hp > 0) {
      this.decidirIntencao(e);
      if (e.intencao && e.intencao.tipo === 'especial') this.anunciarEspecial(e);
    }
    UI.atualizarBatalha();
  }

  // Aviso de golpe: anuncia o especial um turno antes
  anunciarEspecial(e) {
    const esp = e.d.especial;
    if (!esp || e.hp <= 0 || this.j.hp <= 0) return;
    Game.fx.numero(e.i, '!', 'aviso');
    this.registrar(`⚠ ${e.d.nome} ${esp.aviso} (${esp.nome} no próximo turno)`);
    UI.atualizarBatalha();
  }

  // Um golpe do monstro com o QTE de aparar antes
  async golpeInimigo(e, mult, ignoraDef, verbo, opts) {
    const aparo = this.h.vento ? 'neutro' : await Game.qte('defesa', e.i);
    await Game.fx.investida(e.i);
    this.ataqueInimigo(e, mult, ignoraDef, verbo, aparo, opts);
    await Game.esperar(250);
  }

  async especial(e, esp) {
    const d = e.d;
    if (esp.id === 'garras') {
      this.registrar(`${d.nome} usa Garras Duplas!`);
      Game.fx.numero(e.i, esp.nome, 'status');
      for (let k = 0; k < 2; k++) {
        await this.golpeInimigo(e, 1, false, k === 0 ? 'arranha' : 'arranha de novo');
        if (this.j.hp <= 0) break;
      }
    } else if (esp.id === 'nevoa') {
      this.h.nevoa = DATA.BAL.nevoaTurnos;
      Game.fx.particulas('heroi', 'nevoa'); Som.magia();
      Game.fx.numero('heroi', 'Névoa: precisão −30%', 'status');
      this.registrar(`${d.nome} sopra a Névoa! Sua precisão cai 30% por 2 turnos (golpes perfeitos não erram).`);
      await Game.esperar(500);
      await this.golpeInimigo(e, 1, false, 'morde');
    } else if (esp.id === 'eclipse') {
      Game.fx.numero(e.i, 'ECLIPSE', 'critico');
      Game.fx.particulas('heroi', 'eclipse'); Game.fx.escurecer = 1; Som.raio();
      this.registrar(`${d.nome} invoca o ECLIPSE!`);
      await Game.esperar(500);
      await this.golpeInimigo(e, esp.mult, esp.ignoraDef, 'apaga a luz');
    }
  }

  // Ataque de um inimigo no herói. aparo = resultado do QTE de defesa
  ataqueInimigo(e, mult, ignoraDef, verbo, aparo, opts) {
    opts = opts || {};
    const B = DATA.BAL, j = this.j, d = e.d;
    if (this.h.vento) {
      Game.fx.numero('heroi', 'Esquiva', 'miss'); Som.esquiva(); Game.fx.desvio = 1;
      this.registrar(`Passo do Vento! ${j.nome} desvia de ${d.nome}.`);
      return 0;
    }
    if (aparo !== 'perfeito' && Math.random() < Calc.esquiva(j)) {
      Game.fx.numero('heroi', 'Esquiva', 'miss'); Som.esquiva(); Game.fx.desvio = 1;
      this.registrar(`${j.nome} se esquiva de ${d.nome}!`);
      return 0;
    }
    const atk = this.atkInimigo(e) * mult;
    let dano = ignoraDef
      ? Math.max(B.danoMin, Math.round(atk * Calc.aleatorio(B.danoVarMin, B.danoVarMax)))
      : Calc.dano(atk, Calc.def(j));
    if (this.h.defendendo) dano = Math.max(B.danoMin, Math.round(dano * (1 - B.defenderReducao)));
    // Aparar no tempo certo
    if (aparo === 'perfeito' || aparo === 'bom') {
      dano = Math.max(B.danoMin, Math.round(dano * B.qteDefesa[aparo]));
      Som.defesa();
    }
    let absorvido = 0;
    if (this.h.escudo > 0) {
      absorvido = Math.min(this.h.escudo, dano);
      this.h.escudo -= absorvido; dano -= absorvido;
      Game.fx.numero('heroi', `Escudo −${absorvido}`, 'mp');
    }
    j.hp = Math.max(0, j.hp - dano);
    if (dano > 0) {
      Game.fx.impacto('heroi', mult > 1 ? 16 : 8);
      Game.fx.frameHeroi(3, 420);
      Game.fx.numero('heroi', String(dano), mult > 1 ? 'critico' : 'dano');
      Som.golpe();
    }
    const extra = [absorvido ? `${absorvido} absorvido` : '', this.h.defendendo ? 'defendido' : '',
      aparo === 'perfeito' ? 'APARADO' : aparo === 'bom' ? 'aparado em parte' : ''].filter(Boolean).join(', ');
    let msg = `${d.nome} ${verbo}: ${dano} de dano${extra ? ` (${extra})` : ''}.`;
    // Efeitos de status ao acertar (aparo perfeito evita)
    const efeito = opts.venenoGarantido ? { tipo: 'veneno', chance: 1 } : d.efeito;
    if (efeito && dano > 0 && aparo !== 'perfeito' && Math.random() < efeito.chance) {
      const tipo = efeito.tipo;
      this.h[tipo] = B[tipo].turnos;
      Game.fx.numero('heroi', tipo === 'veneno' ? 'Envenenado!' : 'Queimando!', 'status');
      msg += tipo === 'veneno' ? ' Você foi envenenado!' : ' Você está queimando!';
    }
    this.registrar(msg);
    UI.atualizarBatalha();
    return dano;
  }

  // ---------- Fim da rodada: efeitos contínuos e durações ----------
  async fimDaRodada() {
    const B = DATA.BAL, j = this.j, h = this.h;
    for (const tipo of ['queimadura', 'veneno']) {
      if (h[tipo] > 0 && j.hp > 0) {
        const d = Math.max(1, Math.round(Calc.hpMax(j) * B[tipo].pct));
        j.hp = Math.max(0, j.hp - d);
        h[tipo]--;
        Game.fx.numero('heroi', String(d), tipo === 'veneno' ? 'veneno' : 'queimadura');
        Game.fx.particulas('heroi', tipo === 'veneno' ? 'veneno' : 'fogo');
        this.registrar(`${tipo === 'veneno' ? 'Veneno' : 'Queimadura'}: −${d} HP.`);
        UI.atualizarBatalha();
        await Game.esperar(350);
      }
    }
    // Veneno/queimadura nos inimigos
    for (const e of this.vivos) {
      if (!e.dot || e.dot.turnos <= 0) continue;
      const dano = Math.min(e.hp, e.dot.dano);
      const elem = e.dot.tipo === 'veneno' ? 'flecha' : 'fogo';
      e.hp -= dano; e.dot.turnos--;
      Game.fx.numero(e.i, String(dano), e.dot.tipo === 'veneno' ? 'veneno' : 'queimadura');
      Game.fx.particulas(e.i, e.dot.tipo === 'veneno' ? 'veneno' : 'fogo');
      this.registrar(`${e.d.nome} sofre ${dano} de ${e.dot.tipo === 'veneno' ? 'veneno' : 'queimadura'}.`);
      if (e.dot.turnos <= 0) e.dot = null;
      if (e.hp <= 0) this.aoMorrer(e, elem);
      UI.atualizarBatalha();
      await Game.esperar(300);
    }
    if (h.grito > 0) h.grito--;
    if (h.nevoa > 0) h.nevoa--;
    h.defendendo = false;
    h.vento = false;
  }

  async vitoria() {
    this.acabou = true;
    Som.vitoria();
    await Game.esperar(700);
    Game.fimDeBatalha('vitoria');
  }

  async derrota() {
    this.acabou = true;
    Som.derrota();
    await Game.esperar(700);
    Game.fimDeBatalha('derrota');
  }
}
