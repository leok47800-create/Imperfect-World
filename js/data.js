// ============================================================
// data.js — TODOS os números de balanceamento e dados do jogo
// Classes, habilidades, inimigos, zonas, itens, missões.
// ============================================================

const DATA = {
  // ---------- Regras gerais de balanceamento ----------
  BAL: {
    atributoBase: 5,          // FOR, DES, INT e VIT começam em 5
    hpBase: 50, hpPorVit: 10, // HP máx = 50 + VIT×10
    mpBase: 20, mpPorInt: 5,  // MP máx = 20 + INT×5
    atkFisPorAtr: 2,          // Ataque físico = arma + FOR×2 (Arqueiro: DES×2)
    atkMagPorInt: 2.5,        // Ataque mágico = arma + INT×2,5
    defPorVit: 1,             // Defesa = armadura + VIT×1
    critBase: 0.05, critPorDes: 0.005, critMult: 1.5,
    esquivaPorDes: 0.004,
    danoVarMin: 0.9, danoVarMax: 1.1, defFator: 0.5, danoMin: 1,
    defenderReducao: 0.5, defenderRecMP: 0.05,
    fugaChance: 0.6,
    xpBase: 50, xpExpoente: 1.5, nivelMax: 20, pontosPorNivel: 5,
    multXP: 2,      // multiplicador de XP (1 = valores originais do documento; 2 = campanha mais curta)
    multOuro: 1,    // multiplicador de ouro
    // Sequência de vitórias: +10% de XP por vitória seguida, até +50%.
    // Zera ao voltar à vila, fugir ou cair.
    sequenciaBonus: 0.10, sequenciaMax: 0.50,
    // Hordas na caça: chance de vir 1, 2 ou 3 monstros.
    // Nas primeiras batalhas e antes do nível 3, no máximo 2.
    hordaPesos: [0.30, 0.45, 0.25],
    hordaNivel3: 3, hordaBatalhasTutorial: 2,
    // Velocidade da batalha: 1 = normal, 2 = rápida (o jogador alterna)
    velocidades: [1, 2],
    // Elementos: multiplicador de dano quando o inimigo é fraco/resistente
    elementoFraco: 1.5,
    // Golpe no tempo certo (toque/espaço quando o anel fecha)
    qteDuracao: 0.85,          // segundos até o anel fechar
    qtePerfeito: 0.11,         // janela (s) para "Perfeito"
    qteBom: 0.24,              // janela (s) para "Bom"
    qteAtaque: { perfeito: 1.5, bom: 1.15 },   // multiplicador de dano
    qteCritPerfeito: 0.25,                     // +25% de chance de crítico no perfeito
    qteDefesa: { perfeito: 0.5, bom: 0.75 },   // multiplicador do dano recebido (aparar)
    // Quebra de guarda
    quebraMultDano: 2,         // dano recebido com a guarda quebrada
    // Comportamentos
    defesaInimigo: 0.5,        // dano recebido por um monstro que está se defendendo/protegido
    // Drops de equipamento
    chanceDropEquip: 0.07,      // inimigos comuns
    chanceRaro: 0.35,           // de um drop comum vir "Raro" (1 bônus extra)
    precoVendaPct: 0.4,         // vender devolve 40% do preço da loja (+ bônus de raridade)
    chanceDropPocao: 0.15, // chance de um inimigo comum deixar uma Poção de Vida P
    perdaOuroMorte: 0.10,
    precoPousada: 10,
    aprimMax: 5, aprimBonus: 0.10, aprimCustoBase: 50,
    aprimChances: [1.00, 0.90, 0.75, 0.60, 0.45], // de +0→+1 até +4→+5
    maxMissoes: 3,
    queimadura: { pct: 0.03, turnos: 3 },
    veneno: { pct: 0.04, turnos: 4 },
    nevoaPenalidade: 0.30, nevoaTurnos: 2,
    chefeVidaBaixa: 0.25,     // abaixo disso o chefe usa o especial 2× mais
    ouroInicial: 60,
    pocoesIniciais: { vidaP: 2, manaP: 1 },
  },

  // ---------- Classes ----------
  CLASSES: {
    guerreiro: {
      nome: 'Guerreiro', bonus: { FOR: 3, VIT: 2 }, atrAtaque: 'FOR', tipoDano: 'fisico', arma: 'espada', elemento: 'corte',
      habilidades: ['golpe', 'giratoria', 'grito', 'sanguinaria', 'sismico', 'execucao'],
      desc: 'Armadura lamelar vermelha e dourada e uma espada dao. Aguenta pancada e devolve em dobro.',
      cores: { roupa: '#B8322E', detalhe: '#D4A23A', cabelo: '#1B1F3B' },
    },
    mago: {
      nome: 'Maga', bonus: { INT: 5 }, atrAtaque: 'INT', tipoDano: 'magico', arma: 'cajado', elemento: 'arcano',
      habilidades: ['bola', 'correntes', 'escudo', 'lotus', 'tempestade', 'fenix'],
      desc: 'Túnica roxa e cajado com orbe de jade. Frágil, mas transforma MP em trovão.',
      cores: { roupa: '#6A4C93', detalhe: '#D4A23A', cabelo: '#F2E6C9' },
    },
    arqueiro: {
      nome: 'Arqueiro', bonus: { DES: 4, FOR: 1 }, atrAtaque: 'DES', tipoDano: 'fisico', arma: 'arco', elemento: 'flecha',
      habilidades: ['dupla', 'venenosa', 'vento', 'perfurante', 'chuva', 'ceuPartido'],
      desc: 'Couro leve, capuz jade e arco longo de bambu. Acerta crítico e some no vento.',
      cores: { roupa: '#8A5A3B', detalhe: '#2E8B6A', cabelo: '#1B1F3B' },
    },
  },

  // ---------- Habilidades (liberadas nos níveis 1, 5 e 10) ----------
  // tipo: 'dano' | 'buff' | 'escudo' | 'vento'
  HABILIDADES: {
    // tipo: 'dano' | 'buff' | 'escudo' | 'vento' | 'cura'
    // Opções de 'dano': area (todos), golpes, bonusCrit, critGarantido, chanceAtordoar,
    //   rouboVida (cura % do dano), ignoraDef (ignora defesa e resistências),
    //   execucao { limiar, mult } (mais dano em alvo ferido), dot { tipo, turnos, mult } (dano por turno no inimigo)
    // icone: índice em ui_icons.png; null = símbolo desenhado (simbolo/cor)
    // ----- Guerreiro -----
    golpe:       { nome: 'Golpe Rasgador',      nivel: 1,  mp: 8,  tipo: 'dano', mult: 1.6, golpes: 1, elemento: 'corte', particula: 'corte', icone: 4,  desc: '1,6× dano' },
    giratoria:   { nome: 'Lâmina Giratória',    nivel: 3,  mp: 12, tipo: 'dano', mult: 1.0, golpes: 1, elemento: 'corte', area: true, particula: 'corte', icone: null, simbolo: '⟳', cor: '#C9CED8', desc: '1× dano em todos' },
    grito:       { nome: 'Grito de Guerra',     nivel: 5,  mp: 10, tipo: 'buff', bonusAtk: 0.30, turnos: 3, particula: 'aura', icone: 5, desc: '+30% de ataque por 3 turnos' },
    sanguinaria: { nome: 'Lâmina Sanguinária',  nivel: 8,  mp: 15, tipo: 'dano', mult: 2.0, golpes: 1, elemento: 'corte', rouboVida: 0.5, particula: 'sangue', icone: null, simbolo: '♥', cor: '#B8322E', desc: '2× dano e cura 50% do dano causado' },
    sismico:     { nome: 'Corte Sísmico',       nivel: 10, mp: 20, tipo: 'dano', mult: 2.5, golpes: 1, elemento: 'corte', area: true, chanceAtordoar: 0.30, particula: 'pedra', icone: 6, desc: '2,5× dano em todos, 30% de atordoar' },
    execucao:    { nome: 'Execução do General', nivel: 14, mp: 30, tipo: 'dano', mult: 3.5, golpes: 1, elemento: 'corte', execucao: { limiar: 0.35, mult: 2 }, particula: 'corte', icone: null, simbolo: '⚔', cor: '#D4A23A', desc: '3,5× dano; dano dobrado se o alvo tiver menos de 35% de HP' },
    // ----- Maga -----
    bola:        { nome: 'Bola de Fogo',        nivel: 1,  mp: 8,  tipo: 'dano', mult: 1.8, golpes: 1, elemento: 'fogo', particula: 'fogo', icone: 7, desc: '1,8× dano mágico de fogo' },
    correntes:   { nome: 'Correntes Elétricas', nivel: 3,  mp: 12, tipo: 'dano', mult: 1.2, golpes: 1, elemento: 'raio', area: true, particula: 'raio', icone: null, simbolo: 'ϟ', cor: '#8FD0FF', desc: '1,2× dano de raio em todos' },
    escudo:      { nome: 'Escudo Arcano',       nivel: 5,  mp: 12, tipo: 'escudo', porInt: 3, particula: 'arcano', icone: 8, desc: 'Absorve dano = INT×3' },
    lotus:       { nome: 'Lótus Curativa',      nivel: 8,  mp: 14, tipo: 'cura', pctHp: 0.35, particula: 'cura', icone: null, simbolo: '✿', cor: '#6EE7A0', desc: 'Cura 35% do HP e remove veneno e queimadura' },
    tempestade:  { nome: 'Tempestade de Raios', nivel: 10, mp: 25, tipo: 'dano', mult: 3.0, golpes: 1, elemento: 'raio', area: true, particula: 'raio', icone: 9, desc: '3× dano mágico de raio em todos' },
    fenix:       { nome: 'Chama da Fênix',      nivel: 14, mp: 32, tipo: 'dano', mult: 4.0, golpes: 1, elemento: 'fogo', dot: { tipo: 'queimadura', turnos: 3, mult: 0.6 }, particula: 'fogo', icone: null, simbolo: '🔥︎', cor: '#FF7A1A', desc: '4× dano de fogo e queima o alvo por 3 turnos' },
    // ----- Arqueiro -----
    dupla:       { nome: 'Flecha Dupla',        nivel: 1,  mp: 8,  tipo: 'dano', mult: 0.9, golpes: 2, elemento: 'flecha', particula: 'folha', icone: 10, desc: '2 acertos de 0,9×' },
    venenosa:    { nome: 'Flecha Venenosa',     nivel: 3,  mp: 10, tipo: 'dano', mult: 1.2, golpes: 1, elemento: 'flecha', dot: { tipo: 'veneno', turnos: 4, mult: 0.45 }, particula: 'veneno', icone: null, simbolo: '☠', cor: '#9BE15D', desc: '1,2× dano e envenena o alvo por 4 turnos' },
    vento:       { nome: 'Passo do Vento',      nivel: 5,  mp: 10, tipo: 'vento', particula: 'folha', icone: 11, desc: 'Esquiva de TODOS os ataques até o seu próximo turno, e o próximo tiro é crítico' },
    perfurante:  { nome: 'Flecha Perfurante',   nivel: 8,  mp: 16, tipo: 'dano', mult: 2.2, golpes: 1, elemento: 'flecha', ignoraDef: true, particula: 'corte', icone: null, simbolo: '➹', cor: '#D9DEE6', desc: '2,2× dano que ignora defesa, esquiva e resistências' },
    chuva:       { nome: 'Chuva de Flechas',    nivel: 10, mp: 22, tipo: 'dano', mult: 2.4, golpes: 1, elemento: 'flecha', bonusCrit: 0.50, area: true, particula: 'folha', icone: 12, desc: '2,4× dano em todos, +50% de crítico' },
    ceuPartido:  { nome: 'Flecha do Céu Partido', nivel: 14, mp: 30, tipo: 'dano', mult: 4.0, golpes: 1, elemento: 'flecha', critGarantido: true, particula: 'raio', icone: null, simbolo: '✦', cor: '#FFE08A', desc: '4× dano com crítico garantido' },
  },

  // ---------- Equipamentos ----------
  TIERS: [
    { id: 'bronze',    nome: 'Bronze',    nivel: 1 },
    { id: 'jade',      nome: 'Jade',      nivel: 7 },
    { id: 'celestial', nome: 'Celestial', nivel: 14 },
  ],
  EQUIP: {
    arma:     { nome: 'Arma',     atributo: 'atk', valores: [5, 18, 40],  precos: [50, 400, 1500] },
    armadura: { nome: 'Armadura', atributo: 'def', valores: [3, 12, 28],  precos: [40, 350, 1300], nomeItem: 'Armadura', icones: [9, 10, 11] },
    amuleto:  { nome: 'Amuleto',  atributo: 'hp',  valores: [30, 120, 300], precos: [60, 450, 1600], nomeItem: 'Amuleto', icones: [12, 12, 12] },
  },
  ARMAS: {
    espada: { nome: 'Espada Dao', icones: [0, 1, 2] },
    cajado: { nome: 'Cajado',     icones: [3, 4, 5] },
    arco:   { nome: 'Arco Longo', icones: [6, 7, 8] },
  },


  // ---------- Comportamentos dos monstros comuns ----------
  COMPORTAMENTOS: {
    investida: { nome: 'Investida', desc: 'A cada 3 turnos dá uma investida de 1,6× dano', a_cada: 3, mult: 1.6 },
    explode:   { nome: 'Explode ao morrer', desc: 'Ao morrer, explode e causa dano de fogo', mult: 0.9 },
    cuspe:     { nome: 'Cuspe ácido', desc: 'A cada 3 turnos cospe ácido que sempre envenena', a_cada: 3, mult: 0.8 },
    remonta:   { nome: 'Remonta-se', desc: 'Volta com metade da vida uma vez, a menos que caia com Arcano ou Fogo', fracos: ['arcano', 'fogo'] },
    protetor:  { nome: 'Protetor', desc: 'Protege um aliado ferido (ele toma metade do dano)' },
    fugitiva:  { nome: 'Foge sozinha', desc: 'Foge (sem recompensa) se ficar sozinha na horda' },
  },

  // ---------- Elementos ----------
  ELEMENTOS: {
    corte:  { nome: 'Corte',  cor: '#D9DEE6' },
    flecha: { nome: 'Flecha', cor: '#A6D96A' },
    arcano: { nome: 'Arcano', cor: '#B79CE8' },
    fogo:   { nome: 'Fogo',   cor: '#FF9A3A' },
    raio:   { nome: 'Raio',   cor: '#8FD0FF' },
  },

  // ---------- Raridade e bônus extras dos equipamentos ----------
  RARIDADES: {
    comum:    { nome: 'Comum',    cor: '#6B5638', bonus: 0, venda: 1 },
    raro:     { nome: 'Raro',     cor: '#2F6FD0', bonus: 1, venda: 1.6 },
    epico:    { nome: 'Épico',    cor: '#7B3FB0', bonus: 2, venda: 2.4 },
    lendario: { nome: 'Lendário', cor: '#C8641A', bonus: 3, venda: 3.5 },
  },
  // Bônus sorteados. valor[tier] = valor por nível de equipamento (Bronze/Jade/Celestial)
  AFIXOS: {
    crit:    { nome: 'Crítico', valores: [0.03, 0.05, 0.08], pct: true },
    esquiva: { nome: 'Esquiva', valores: [0.02, 0.04, 0.06], pct: true },
    atk:     { nome: 'ATK',     valores: [3, 8, 18] },
    def:     { nome: 'DEF',     valores: [2, 6, 12] },
    hp:      { nome: 'HP',      valores: [20, 60, 140] },
    mp:      { nome: 'MP',      valores: [10, 25, 50] },
  },
  // Itens exclusivos dos chefes (sempre caem na 1ª vitória; depois têm 25% de chance)
  LENDARIOS: {
    tigre:     { slot: 'amuleto',  tier: 0, nome: 'Presa do Tigre Ancestral', bonus: { crit: 0.08, atk: 6 }, chanceRepetir: 0.25 },
    serpente:  { slot: 'armadura', tier: 1, nome: 'Escamas da Serpente das Brumas', bonus: { esquiva: 0.06, hp: 120 }, chanceRepetir: 0.25 },
    imperador: { slot: 'arma',     tier: 2, nome: 'Fragmento do Sol Apagado', bonus: { atk: 30, crit: 0.10, mp: 60 }, chanceRepetir: 0.25 },
  },

  // ---------- Poções ----------
  POCOES: {
    vidaP: { nome: 'Poção de Vida P', preco: 25,  hp: 60,  icone: 13, escala: 0.62 },
    vidaM: { nome: 'Poção de Vida M', preco: 80,  hp: 200, icone: 13, escala: 0.8 },
    vidaG: { nome: 'Poção de Vida G', preco: 200, hp: 600, icone: 13, escala: 1.0 },
    manaP: { nome: 'Poção de Mana P', preco: 30,  mp: 30,  icone: 14, escala: 0.62 },
    manaM: { nome: 'Poção de Mana M', preco: 90,  mp: 100, icone: 14, escala: 0.85 },
  },

  // ---------- Inimigos ----------
  // forma = desenho substituto usado quando não há imagem
  INIMIGOS: {
    javali:    { nome: 'Javali de Musgo', hp: 40, atk: 8, def: 2, xp: 15, ouro: [5, 10], nivel: 2, zona: 'floresta', lado: 0, forma: 'javali',
                 elem: { fogo: 1.5 }, guarda: 2, comportamento: 'investida' },
    lanterna:  { nome: 'Espírito-Lanterna', hp: 30, atk: 11, def: 1, xp: 18, ouro: [6, 12], nivel: 4, zona: 'floresta', lado: 1, forma: 'lanterna',
                 efeito: { tipo: 'queimadura', chance: 0.20 }, elem: { corte: 1.5, fogo: 0.5 }, guarda: 2, comportamento: 'explode' },
    tigre:     { nome: 'Tigre de Bambu Ancestral', hp: 260, atk: 20, def: 8, xp: 200, ouro: [150, 150], nivel: 6, zona: 'floresta', chefe: true, forma: 'tigre',
                 especial: { id: 'garras', nome: 'Garras Duplas', intervalo: 3, aviso: 'se agacha e arranha o chão…' },
                 elem: { fogo: 1.5, flecha: 0.8 }, guarda: 5 },
    sapo:      { nome: 'Sapo Venenoso Gigante', hp: 120, atk: 22, def: 8, xp: 60, ouro: [20, 35], nivel: 9, zona: 'pantano', lado: 0, forma: 'sapo',
                 efeito: { tipo: 'veneno', chance: 0.35 }, elem: { raio: 1.5, corte: 0.8 }, guarda: 3, comportamento: 'cuspe' },
    esqueleto: { nome: 'Esqueleto Afogado', hp: 100, atk: 28, def: 12, xp: 70, ouro: [25, 40], nivel: 11, zona: 'pantano', lado: 1, forma: 'esqueleto',
                 elem: { arcano: 1.5, fogo: 1.3, flecha: 0.6 }, guarda: 3, comportamento: 'remonta' },
    serpente:  { nome: 'Serpente das Brumas', hp: 900, atk: 45, def: 20, xp: 800, ouro: [500, 500], nivel: 13, zona: 'pantano', chefe: true, forma: 'serpente',
                 regen: 0.05, especial: { id: 'nevoa', nome: 'Névoa', intervalo: 4, aviso: 'enche o peito de bruma…' },
                 elem: { raio: 1.5, fogo: 0.7 }, guarda: 6 },
    guardiao:  { nome: 'Guardião de Terracota', hp: 300, atk: 50, def: 35, xp: 180, ouro: [60, 90], nivel: 16, zona: 'templo', lado: 0, forma: 'guardiao',
                 // resiste 30% a dano físico (corte e flecha), racha com raio
                 elem: { corte: 0.7, flecha: 0.7, raio: 1.3 }, guarda: 4, comportamento: 'protetor' },
    garca:     { nome: 'Garça Espectral', hp: 220, atk: 65, def: 15, xp: 200, ouro: [60, 90], nivel: 18, zona: 'templo', lado: 1, forma: 'garca',
                 esquiva: 0.25, elem: { flecha: 1.5, corte: 0.8 }, guarda: 3, comportamento: 'fugitiva' },
    imperador: { nome: 'Imperador Eclipse', hp: 3000, atk: 90, def: 40, xp: 3000, ouro: [2000, 2000], nivel: 20, zona: 'templo', chefe: true, final: true, forma: 'imperador',
                 fase2: { limiar: 0.5, bonusAtk: 0.30 },
                 especial: { id: 'eclipse', nome: 'Eclipse', intervalo: 4, mult: 2, soFase2: true, ignoraDef: true, aviso: 'ergue a glaive e o sol começa a sumir…' },
                 elem: { fogo: 1.3 }, guarda: 8 },
  },

  // ---------- Zonas do mapa ----------
  ZONAS: {
    floresta: { nome: 'Floresta de Bambu', faixa: 'nv 1–6',  nivelMin: 1,  requerChefe: null,       comuns: ['javali', 'lanterna'],   chefe: 'tigre',     bg: 'bg_floresta', folha: 'enemies_floresta', chefeImg: 'boss_floresta', tierDrop: 0, pos: { x: 0.28, y: 0.60 }, musica: 'floresta' },
    pantano:  { nome: 'Pântano das Brumas', faixa: 'nv 7–13', nivelMin: 7,  requerChefe: 'floresta', comuns: ['sapo', 'esqueleto'],    chefe: 'serpente',  bg: 'bg_pantano',  folha: 'enemies_pantano',  chefeImg: 'boss_pantano', tierDrop: 1,  pos: { x: 0.57, y: 0.52 }, musica: 'pantano' },
    templo:   { nome: 'Templo Celeste',     faixa: 'nv 14–20', nivelMin: 14, requerChefe: 'pantano',  comuns: ['guardiao', 'garca'],    chefe: 'imperador', bg: 'bg_templo',   folha: 'enemies_templo',   chefeImg: 'boss_templo', tierDrop: 2,   pos: { x: 0.86, y: 0.24 }, musica: 'templo' },
  },
  ORDEM_ZONAS: ['floresta', 'pantano', 'templo'],


  // ---------- História ----------
  // Falantes: 'heroi', 'ferreiro', 'mercadora', 'mestre' ou o id de um inimigo.
  // {nome} é trocado pelo nome do herói.
  FALANTES: {
    ferreiro: { nome: 'Ferreiro Bao', npc: 0 },
    mercadora: { nome: 'Mercadora Lin', npc: 1 },
    mestre: { nome: 'Mestre Wen', npc: 2 },
  },
  HISTORIA: {
    intro: [
      { quem: 'mestre', texto: 'Você chegou, {nome}. Olhe para o céu: o sol está menor a cada manhã.' },
      { quem: 'mestre', texto: 'O Imperador Eclipse despertou no Templo Celeste. Ele quer engolir a última luz do mundo.' },
      { quem: 'heroi', texto: 'E por que logo eu?' },
      { quem: 'mestre', texto: 'Porque a nossa vila é tão esquecida que até ele esqueceu de nós. É a nossa vantagem.' },
      { quem: 'mercadora', texto: 'Passa na minha barraca antes de sair! Herói sem poção é herói em apuros.' },
      { quem: 'ferreiro', texto: 'E se a lâmina rachar, eu conserto. Quase sempre.' },
    ],
    antes_tigre: [
      { quem: 'tigre', texto: 'GRRRAAAH! Ninguém atravessa o meu bambuzal desde a última dinastia!' },
      { quem: 'heroi', texto: 'Nem um gatinho educado deixaria eu passar?' },
      { quem: 'tigre', texto: 'Gatinho?! Prepare-se para as minhas garras, mortal!' },
    ],
    depois_tigre: [
      { quem: 'tigre', texto: 'Hmpf… Você luta com honra. O Eclipse prometeu que eu seria eterno… mentiu.' },
      { quem: 'mestre', texto: 'O guardião da floresta caiu. A trilha para o Pântano das Brumas está aberta, {nome}.' },
      { quem: 'mestre', texto: 'Cuidado com a névoa de lá. Ela engana os olhos e a mira.' },
    ],
    antes_serpente: [
      { quem: 'serpente', texto: 'Sssshhh… Um pequeno raio de sol perdido na minha bruma.' },
      { quem: 'serpente', texto: 'Quanto mais você me fere, mais eu me refaço. A névoa é eterna.' },
      { quem: 'heroi', texto: 'Então vou ter que bater mais rápido do que você se cura.' },
    ],
    depois_serpente: [
      { quem: 'serpente', texto: 'A bruma… se dissipa… O Imperador… vai te devorar…' },
      { quem: 'mestre', texto: 'A névoa baixou e o Templo Celeste apareceu acima das nuvens.' },
      { quem: 'mestre', texto: 'Ele vai ficar mais forte quando estiver perto do fim. Quando o sol sumir, defenda-se.' },
    ],
    antes_imperador: [
      { quem: 'imperador', texto: 'Então você é o herói da vila que eu esqueci de apagar do mapa.' },
      { quem: 'imperador', texto: 'Mil anos à sombra do sol. Hoje a sombra vence.' },
      { quem: 'heroi', texto: 'A vila esquecida mandou um recado: devolve o sol.' },
    ],
    fase2_imperador: [
      { quem: 'imperador', texto: 'Chega de brincadeira! Contemple o verdadeiro Eclipse!' },
    ],
    depois_imperador: [
      { quem: 'imperador', texto: 'Impossível… uma vila… que nem aparece nos mapas…' },
      { quem: 'heroi', texto: 'Agora aparece.' },
      { quem: 'mestre', texto: 'O sol voltou, {nome}. E pela primeira vez em mil anos, todos sabem o nome da nossa vila.' },
    ],
  },

  // ---------- Missões ----------
  // tipo 'caca' pode ser repetida após entregar; 'chefe' só uma vez
  MISSOES: {
    f_javali:    { zona: 'floresta', tipo: 'caca',  alvo: 'javali',    qtd: 5, xp: 60,   ouro: 40,  titulo: 'Javalis no arrozal', texto: 'Derrote 5 Javalis de Musgo. Eles estão comendo o arroz da vovó Lin.' },
    f_lanterna:  { zona: 'floresta', tipo: 'caca',  alvo: 'lanterna',  qtd: 4, xp: 70,   ouro: 45,  titulo: 'Luzes teimosas', texto: 'Apague 4 Espíritos-Lanterna. Ninguém consegue dormir com tanto brilho.' },
    f_chefe:     { zona: 'floresta', tipo: 'chefe', alvo: 'tigre',     qtd: 1, xp: 150,  ouro: 120, titulo: 'O rugido entre os bambus', texto: 'Derrote o Tigre de Bambu Ancestral e libere a trilha para o pântano.' },
    p_sapo:      { zona: 'pantano',  tipo: 'caca',  alvo: 'sapo',      qtd: 5, xp: 250,  ouro: 150, titulo: 'Coaxar tóxico', texto: 'Derrote 5 Sapos Venenosos Gigantes antes que contaminem o poço.' },
    p_esqueleto: { zona: 'pantano',  tipo: 'caca',  alvo: 'esqueleto', qtd: 5, xp: 280,  ouro: 170, titulo: 'Ossos molhados', texto: 'Mande 5 Esqueletos Afogados de volta para o fundo. Com educação.' },
    p_chefe:     { zona: 'pantano',  tipo: 'chefe', alvo: 'serpente',  qtd: 1, xp: 600,  ouro: 400, titulo: 'A dona da névoa', texto: 'Derrote a Serpente das Brumas e abra o caminho para o Templo Celeste.' },
    t_guardiao:  { zona: 'templo',   tipo: 'caca',  alvo: 'guardiao',  qtd: 4, xp: 700,  ouro: 350, titulo: 'Barro que anda', texto: 'Derrube 4 Guardiões de Terracota. Magia funciona melhor neles.' },
    t_garca:     { zona: 'templo',   tipo: 'caca',  alvo: 'garca',     qtd: 4, xp: 750,  ouro: 380, titulo: 'Asas de fumaça', texto: 'Derrote 4 Garças Espectrais. Elas desviam muito, tenha paciência.' },
    t_chefe:     { zona: 'templo',   tipo: 'chefe', alvo: 'imperador', qtd: 1, xp: 1000, ouro: 500, titulo: 'Que o sol nasça', texto: 'Derrote o Imperador Eclipse antes que ele apague o sol.' },
  },

  // ---------- Assets ----------
  ASSETS: [
    'hero_guerreiro', 'hero_mago', 'hero_arqueiro', 'npcs',
    'enemies_floresta', 'enemies_pantano', 'enemies_templo',
    'boss_floresta', 'boss_pantano', 'boss_templo',
    'bg_vila', 'bg_mapa', 'bg_floresta', 'bg_pantano', 'bg_templo',
    'items', 'ui_icons', 'logo', 'title_screen', 'icon',
  ],
  // Sprites com fundo magenta (os fundos 16:9 não passam pela remoção)
  ASSETS_COM_MAGENTA: ['hero_guerreiro', 'hero_mago', 'hero_arqueiro', 'npcs', 'enemies_floresta', 'enemies_pantano', 'enemies_templo',
    'boss_floresta', 'boss_pantano', 'boss_templo', 'items', 'ui_icons', 'logo', 'icon'],
  TOLERANCIA_MAGENTA: 60,

  // Ícones da interface (índice na grade 4×4 de ui_icons.png)
  ICONES_UI: { atacar: 0, defender: 1, fugir: 2, item: 3, hp: 13, mp: 14, xp: 15 },

  PALETA: { noite: '#1B1F3B', ouro: '#D4A23A', vermelho: '#B8322E', jade: '#2E8B6A', pergaminho: '#F2E6C9', roxo: '#6A4C93' },
};
