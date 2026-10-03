// ============================================================
// assets.js — carregamento das imagens da pasta assets/,
// remoção do fundo magenta e desenhos substitutos (fallback)
// feitos com formas simples nas cores da paleta.
// ============================================================

const TAU = Math.PI * 2;

// Gerador pseudoaleatório com semente (para fundos sempre iguais)
function rngSemente(seed) {
  let s = seed % 2147483647; if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// ---------------- Carregador ----------------
const Assets = {
  imgs: {},        // nome -> { src (canvas ou img), w, h, url }
  cacheFundos: {}, // fundos procedurais já desenhados

  // Carrega todas as imagens. Imagem ausente não quebra o jogo.
  carregar(aoProgredir) {
    const nomes = DATA.ASSETS;
    let prontos = 0;
    const umPronto = () => { prontos++; aoProgredir && aoProgredir(prontos / nomes.length); };
    return Promise.all(nomes.map(nome => new Promise(resolve => {
      const img = new Image();
      let fim = false;
      const terminar = () => { if (!fim) { fim = true; umPronto(); resolve(); } };
      img.onload = () => { this.processar(nome, img); terminar(); };
      img.onerror = terminar;
      setTimeout(terminar, 8000); // nunca trava o carregamento
      // window.IW_ASSETS permite embutir as imagens (versão de arquivo único)
      img.src = (window.IW_ASSETS && window.IW_ASSETS[nome]) || ('assets/' + nome + '.png');
    })));
  },

  // Remove pixels próximos de magenta (#FF00FF). Se o navegador bloquear
  // (ex.: aberto via file://), usa a imagem como está.
  processar(nome, img) {
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return;
    let src = img, url = img.src;
    if (DATA.ASSETS_COM_MAGENTA.includes(nome)) {
      try {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const cx = c.getContext('2d');
        cx.drawImage(img, 0, 0);
        const dados = cx.getImageData(0, 0, w, h);
        const p = dados.data, tol = DATA.TOLERANCIA_MAGENTA;
        // Se a imagem já tem transparência (cantos vazios), não mexe nela:
        // assim brilhos roxos/rosados da arte não são apagados por engano.
        const jaTransparente = p[3] < 250 && p[(w - 1) * 4 + 3] < 250 && p[p.length - 1] < 250;
        if (!jaTransparente) for (let i = 0; i < p.length; i += 4) {
          const dr = 255 - p[i], dg = p[i + 1], db = 255 - p[i + 2];
          if (Math.sqrt(dr * dr + dg * dg + db * db) < tol) p[i + 3] = 0;
        }
        cx.putImageData(dados, 0, 0);
        src = c;
        url = c.toDataURL('image/png');
      } catch (e) {
        src = img; url = img.src; // canvas "contaminado": segue com a imagem original
      }
    }
    this.imgs[nome] = { src, w, h, url };
  },

  tem(nome) { return !!this.imgs[nome]; },
  get(nome) { return this.imgs[nome]; },

  // Estilo CSS para um ícone de uma grade 4×4 (items.png / ui_icons.png)
  estiloIcone(folha, indice) {
    const a = this.imgs[folha];
    if (!a) return null;
    const col = indice % 4, lin = Math.floor(indice / 4);
    return `background-image:url("${a.url}");background-size:400% 400%;background-position:${col * 100 / 3}% ${lin * 100 / 3}%`;
  },

  // Desenha um recorte da imagem com altura fixa (mantém proporção), base no ponto (x, y)
  desenharRecorte(ctx, nome, sx, sw, x, y, alturaAlvo, espelhar) {
    const a = this.imgs[nome];
    const sh = a.h;
    const escala = alturaAlvo / sh;
    const dw = sw * escala;
    ctx.save();
    ctx.translate(x, y);
    if (espelhar) ctx.scale(-1, 1);
    ctx.drawImage(a.src, sx, 0, sw, sh, -dw / 2, -alturaAlvo, dw, alturaAlvo);
    ctx.restore();
  },

  // ---------- Retratos (diálogos) ----------
  // Descobre onde está a figura dentro da célula da folha olhando a transparência,
  // e devolve o recorte a desenhar: cabeça e ombros (modo 'busto') ou o corpo todo ('inteiro').
  cacheRetrato: {},
  enquadrar(nome, idx, n, modo) {
    const chave = nome + ':' + idx + ':' + n + ':' + modo;
    if (this.cacheRetrato[chave] !== undefined) return this.cacheRetrato[chave];
    const a = this.imgs[nome];
    let r = null;
    try {
      const sw = Math.floor(a.w / n), sx = sw * idx, sh = a.h;
      const c = document.createElement('canvas'); c.width = sw; c.height = sh;
      const cx = c.getContext('2d'); cx.drawImage(a.src, sx, 0, sw, sh, 0, 0, sw, sh);
      const px = cx.getImageData(0, 0, sw, sh).data;
      const op = (x, y) => px[(y * sw + x) * 4 + 3] > 60;
      // caixa da figura
      let top = -1, bot = -1, esq = sw, dir = -1;
      for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) if (op(x, y)) {
        if (top < 0) top = y; bot = y; if (x < esq) esq = x; if (x > dir) dir = x;
      }
      if (top < 0) throw new Error('vazio');
      const fh = bot - top + 1, fw = dir - esq + 1;
      // mediana dos x opacos numa faixa de linhas
      const mediana = (y0, y1, perto, raio) => {
        const xs = [];
        for (let y = Math.max(0, y0); y < Math.min(sh, y1); y += 2) for (let x = esq; x <= dir; x += 2)
          if (op(x, y) && (perto == null || Math.abs(x - perto) <= raio)) xs.push(x);
        xs.sort((p, q) => p - q);
        return xs.length ? xs[xs.length >> 1] : null;
      };
      if (modo === 'busto') {
        // centro do peito, e a cabeça é o que está no topo perto dele
        const peito = mediana(top + fh * 0.22, top + fh * 0.42, null, 0) ?? (esq + dir) / 2;
        const cabeca = mediana(top, top + fh * 0.14, peito, fh * 0.16) ?? peito;
        const lado = fh * 0.46;
        r = { sx: sx + cabeca - lado / 2, sy: top - fh * 0.03, sw: lado, sh: lado };
      } else {
        const lado = Math.max(fw, fh) * 1.06;
        r = { sx: sx + esq + fw / 2 - lado / 2, sy: top + fh / 2 - lado / 2, sw: lado, sh: lado };
      }
    } catch (e) { r = null; } // sem acesso aos pixels (file://): usa a célula inteira
    this.cacheRetrato[chave] = r;
    return r;
  },
  // Desenha o retrato num quadrado W×W
  desenharRetrato(ctx, nome, idx, n, W, modo) {
    const a = this.imgs[nome];
    const r = this.enquadrar(nome, idx, n, modo);
    if (r) { ctx.drawImage(a.src, r.sx, r.sy, r.sw, r.sh, 0, 0, W, W); return; }
    const sw = a.w / n, esc = Math.min(W / sw, W / a.h);
    ctx.drawImage(a.src, sw * idx, 0, sw, a.h, (W - sw * esc) / 2, W - a.h * esc, sw * esc, a.h * esc);
  },

  // Fundo: imagem (preenchendo 1280×720) ou fundo procedural em cache
  desenharFundo(ctx, nome) {
    const a = this.imgs[nome];
    if (a) {
      // "cover": preenche a tela sem distorcer
      const esc = Math.max(1280 / a.w, 720 / a.h);
      const w = a.w * esc, h = a.h * esc;
      ctx.drawImage(a.src, (1280 - w) / 2, (720 - h) / 2, w, h);
      return;
    }
    if (!this.cacheFundos[nome]) {
      const c = document.createElement('canvas');
      c.width = 1280; c.height = 720;
      Arte.fundo(c.getContext('2d'), nome);
      this.cacheFundos[nome] = c;
    }
    ctx.drawImage(this.cacheFundos[nome], 0, 0);
  },
};

// ============================================================
// Arte substituta: personagens, monstros e cenários
// Estilo: contorno preto grosso + sombreamento chapado.
// ============================================================
const Arte = {
  // ---------- utilidades de desenho ----------
  traco(ctx, w) { ctx.lineWidth = w || 6; ctx.strokeStyle = '#121212'; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; },
  poli(ctx, pts, cor) {
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath(); ctx.fillStyle = cor; ctx.fill(); ctx.stroke();
  },
  circ(ctx, x, y, r, cor) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = cor; ctx.fill(); ctx.stroke(); },
  elip(ctx, x, y, rx, ry, cor, rot) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU); ctx.fillStyle = cor; ctx.fill(); ctx.stroke(); },
  // "Membro": linha grossa com contorno (braços, ossos, pescoços)
  membro(ctx, x1, y1, x2, y2, w, cor) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = '#121212'; ctx.lineWidth = w + 10; ctx.stroke();
    ctx.strokeStyle = cor; ctx.lineWidth = w; ctx.stroke();
    this.traco(ctx);
  },
  curva(ctx, pts, w, cor) {
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    ctx.bezierCurveTo(pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]);
    ctx.strokeStyle = '#121212'; ctx.lineWidth = w + 10; ctx.stroke();
    ctx.strokeStyle = cor; ctx.lineWidth = w; ctx.stroke();
    this.traco(ctx);
  },
  sombra(ctx, rx) {
    ctx.save(); ctx.fillStyle = 'rgba(10,10,25,.28)';
    ctx.beginPath(); ctx.ellipse(0, 0, rx, rx * 0.18, 0, 0, TAU); ctx.fill(); ctx.restore();
  },

  // ---------- figura humana genérica (herói e NPCs), olhando para a direita ----------
  // Unidade: 300 de altura. o = { roupa, detalhe, cabelo, pele, chapeu, arma, barba, frame, avental }
  figura(ctx, o) {
    const C = DATA.PALETA, pele = o.pele || '#F0CFA0';
    const f = o.frame || 0;
    this.traco(ctx, 6);
    this.sombra(ctx, 75);
    ctx.save();
    if (f === 3) { ctx.translate(-8, 0); ctx.rotate(-0.12); }
    // braço de trás
    const ombroT = [-28, -168];
    if (o.arma === 'arco') this.membro(ctx, ombroT[0], ombroT[1], f === 1 ? 60 : 40, -150, 20, o.roupa);
    else this.membro(ctx, ombroT[0], ombroT[1], -52, f === 2 ? -230 : -110, 20, o.roupa);
    // pernas
    this.poli(ctx, [-32, -72, -10, -72, -12, -4, -36, -4], C.noite);
    this.poli(ctx, [10, -72, 32, -72, 36, -4, 12, -4], C.noite);
    this.poli(ctx, [-40, -6, -8, -6, -8, 4, -44, 4], '#2a2a2a');
    this.poli(ctx, [8, -6, 44, -6, 46, 4, 8, 4], '#2a2a2a');
    // túnica / armadura
    this.poli(ctx, [-56, -50, 56, -50, 40, -182, -40, -182], o.roupa);
    ctx.save(); ctx.globalAlpha = 0.22; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.moveTo(18, -50); ctx.lineTo(56, -50); ctx.lineTo(40, -182); ctx.lineTo(26, -182); ctx.closePath(); ctx.fill(); ctx.restore();
    this.poli(ctx, [-56, -50, 56, -50, 53, -64, -53, -64], o.detalhe); // barra
    if (o.avental) this.poli(ctx, [-30, -60, 30, -60, 26, -150, -26, -150], o.avental);
    if (o.lamelar) { // placas da armadura lamelar
      ctx.save(); ctx.strokeStyle = o.detalhe; ctx.lineWidth = 3;
      for (let yy = -80; yy > -170; yy -= 16) { ctx.beginPath(); ctx.moveTo(-44 + (yy + 80) * -0.09, yy); ctx.lineTo(44 - (yy + 80) * -0.09, yy); ctx.stroke(); }
      ctx.restore(); this.traco(ctx, 6);
    }
    this.poli(ctx, [-46, -118, 46, -118, 45, -134, -45, -134], o.detalhe); // cinto
    this.poli(ctx, [-16, -182, 16, -182, 0, -150], o.detalhe);             // gola
    // cabeça
    this.circ(ctx, 2, -218, 36, pele);
    // rosto
    ctx.fillStyle = '#121212';
    if (f === 3) {
      ctx.lineWidth = 4;
      [[8, -222], [26, -222]].forEach(([x, y]) => { ctx.beginPath(); ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y + 5); ctx.moveTo(x + 5, y - 5); ctx.lineTo(x - 5, y + 5); ctx.stroke(); });
      this.traco(ctx, 6);
    } else {
      ctx.beginPath(); ctx.ellipse(10, -220, 4, 6, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(27, -220, 4, 6, 0, 0, TAU); ctx.fill();
    }
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(4, -232); ctx.lineTo(16, -230); ctx.moveTo(22, -230); ctx.lineTo(32, -233); ctx.stroke();
    ctx.beginPath(); if (f === 1 || f === 2) ctx.ellipse(20, -202, 6, 4, 0, 0, TAU); else { ctx.moveTo(13, -203); ctx.lineTo(25, -201); } ctx.stroke();
    this.traco(ctx, 6);
    if (o.barba) this.poli(ctx, [-14, -200, 34, -200, 22, o.barba === 'longa' ? -150 : -186, 4, o.barba === 'longa' ? -146 : -184], '#ECECEC');
    // cabelo / chapéu
    switch (o.chapeu) {
      case 'coque':
        ctx.beginPath(); ctx.arc(2, -222, 38, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fillStyle = o.cabelo; ctx.fill(); ctx.stroke();
        this.circ(ctx, -6, -262, 14, o.cabelo);
        this.poli(ctx, [-36, -236, 40, -236, 40, -244, -36, -244], o.detalhe);
        break;
      case 'capuz':
        ctx.beginPath(); ctx.arc(0, -222, 44, Math.PI * 0.75, Math.PI * 2.05); ctx.lineTo(-20, -180); ctx.closePath(); ctx.fillStyle = o.detalhe; ctx.fill(); ctx.stroke();
        break;
      case 'chapeuMago':
        this.poli(ctx, [-50, -238, 54, -238, 8, -330], o.roupa);
        this.poli(ctx, [-56, -232, 60, -232, 50, -246, -46, -246], o.detalhe);
        this.circ(ctx, 8, -330, 9, C.ouro);
        break;
      case 'palha':
        this.poli(ctx, [-70, -236, 74, -236, 2, -290], '#D9B76A');
        ctx.save(); ctx.strokeStyle = '#a07f3a'; ctx.lineWidth = 2;
        for (let i = -50; i < 60; i += 18) { ctx.beginPath(); ctx.moveTo(2, -286); ctx.lineTo(i, -238); ctx.stroke(); }
        ctx.restore(); this.traco(ctx, 6);
        break;
      case 'bandana':
        this.poli(ctx, [-36, -232, 40, -232, 38, -246, -34, -246], C.vermelho);
        this.poli(ctx, [-36, -238, -60, -226, -56, -216, -34, -230], C.vermelho);
        break;
      case 'sabio':
        this.circ(ctx, 0, -262, 14, '#ECECEC');
        this.poli(ctx, [-8, -276, 8, -276, 0, -296], o.detalhe);
        break;
    }
    // braço da frente + arma
    const ombro = [30, -168];
    let mao;
    if (f === 1) mao = [96, -160]; else if (f === 2) mao = [54, -248]; else mao = [56, -112];
    if (o.arma === 'arco') mao = f === 1 ? [92, -165] : [70, -150];
    this.membro(ctx, ombro[0], ombro[1], mao[0], mao[1], 22, o.roupa);
    this.desenharArma(ctx, o.arma, mao, f);
    this.circ(ctx, mao[0], mao[1], 11, pele);
    if (f === 2) { // brilho de habilidade
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(mao[0], mao[1], 4, mao[0], mao[1], 70);
      g.addColorStop(0, 'rgba(255,230,140,.9)'); g.addColorStop(1, 'rgba(255,200,80,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mao[0], mao[1], 70, 0, TAU); ctx.fill(); ctx.restore();
    }
    ctx.restore();
  },

  desenharArma(ctx, tipo, mao, f) {
    const C = DATA.PALETA;
    ctx.save(); ctx.translate(mao[0], mao[1]);
    this.traco(ctx, 5);
    switch (tipo) {
      case 'espada': {
        ctx.rotate(f === 1 ? 0.9 : f === 2 ? -0.2 : -0.5);
        this.poli(ctx, [-6, 0, 6, 0, 6, 14, -6, 14], C.noite);              // cabo
        this.poli(ctx, [-16, -4, 16, -4, 16, 4, -16, 4], C.ouro);           // guarda
        ctx.beginPath(); ctx.moveTo(-8, -4); ctx.quadraticCurveTo(-14, -70, 10, -128); ctx.quadraticCurveTo(22, -70, 9, -4); ctx.closePath();
        ctx.fillStyle = '#DCE3EA'; ctx.fill(); ctx.stroke();
        break;
      }
      case 'cajado': {
        ctx.rotate(f === 1 ? 0.6 : 0.05);
        this.poli(ctx, [-6, 70, 6, 70, 6, -120, -6, -120], '#7A5230');
        this.poli(ctx, [-18, -118, 18, -118, 10, -130, -10, -130], C.ouro);
        this.circ(ctx, 0, -146, 20, C.jade);
        ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(-6, -152, 6, 0, TAU); ctx.fill();
        break;
      }
      case 'arco': {
        ctx.lineWidth = 16; ctx.strokeStyle = '#121212';
        ctx.beginPath(); ctx.arc(-10, 0, 110, -1.15, 1.15); ctx.stroke();
        ctx.lineWidth = 8; ctx.strokeStyle = '#B98A3E'; ctx.stroke();
        ctx.lineWidth = 2; ctx.strokeStyle = '#f5f0e0';
        ctx.beginPath(); ctx.moveTo(-10 + 110 * Math.cos(-1.15), 110 * Math.sin(-1.15));
        ctx.lineTo(f === 1 ? -60 : -20, 0); ctx.lineTo(-10 + 110 * Math.cos(1.15), 110 * Math.sin(1.15)); ctx.stroke();
        if (f === 1) { ctx.strokeStyle = '#121212'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-60, 0); ctx.lineTo(120, 0); ctx.stroke(); }
        break;
      }
      case 'martelo':
        ctx.rotate(-0.4);
        this.poli(ctx, [-5, 10, 5, 10, 5, -80, -5, -80], '#7A5230');
        this.poli(ctx, [-26, -78, 26, -78, 26, -110, -26, -110], '#5d6670');
        break;
      case 'cesto':
        this.poli(ctx, [-30, -8, 30, -8, 22, 34, -22, 34], '#C08A45');
        this.circ(ctx, -10, -12, 10, C.vermelho); this.circ(ctx, 10, -14, 10, C.ouro);
        break;
      case 'pergaminho':
        this.poli(ctx, [-12, -40, 12, -40, 12, 40, -12, 40], C.pergaminho);
        this.poli(ctx, [-16, -46, 16, -46, 16, -36, -16, -36], C.vermelho);
        this.poli(ctx, [-16, 36, 16, 36, 16, 46, -16, 46], C.vermelho);
        break;
    }
    ctx.restore(); this.traco(ctx, 6);
  },

  // ---------- Herói ----------
  heroi(ctx, classe, frame, x, y, H) {
    const nome = 'hero_' + classe;
    const a = Assets.get(nome);
    if (a) { Assets.desenharRecorte(ctx, nome, (a.w / 4) * frame, a.w / 4, x, y, H, false); return; }
    const cl = DATA.CLASSES[classe];
    const opc = {
      guerreiro: { chapeu: 'coque', arma: 'espada', lamelar: true },
      mago: { chapeu: 'chapeuMago', arma: 'cajado' },
      arqueiro: { chapeu: 'capuz', arma: 'arco' },
    }[classe];
    ctx.save(); ctx.translate(x, y); ctx.scale(H / 300, H / 300);
    this.figura(ctx, Object.assign({ roupa: cl.cores.roupa, detalhe: cl.cores.detalhe, cabelo: cl.cores.cabelo, frame }, opc));
    ctx.restore();
  },

  // ---------- NPCs (0 Ferreiro, 1 Mercadora, 2 Mestre de Missões) ----------
  npc(ctx, i, x, y, H) {
    const a = Assets.get('npcs');
    if (a) { Assets.desenharRecorte(ctx, 'npcs', (a.w / 3) * i, a.w / 3, x, y, H, false); return; }
    const C = DATA.PALETA;
    const opc = [
      { roupa: '#5A4636', detalhe: C.ouro, cabelo: '#222', chapeu: 'bandana', arma: 'martelo', avental: '#8E6B4A', barba: 'curta', pele: '#E2B07E' },
      { roupa: C.jade, detalhe: C.ouro, cabelo: '#222', chapeu: 'palha', arma: 'cesto' },
      { roupa: '#3B4A7A', detalhe: C.ouro, cabelo: '#ECECEC', chapeu: 'sabio', arma: 'pergaminho', barba: 'longa' },
    ][i];
    ctx.save(); ctx.translate(x, y); ctx.scale(H / 300, H / 300);
    this.figura(ctx, opc);
    ctx.restore();
  },

  // ---------- Inimigos ----------
  // estado = { t (tempo), fase2 (bool), frame }
  inimigo(ctx, id, x, y, H, estado) {
    const def = DATA.INIMIGOS[id];
    const zona = DATA.ZONAS[def.zona];
    if (def.chefe && Assets.tem(zona.chefeImg)) {
      const a = Assets.get(zona.chefeImg);
      Assets.desenharRecorte(ctx, zona.chefeImg, 0, a.w, x, y, H, false);
      if (estado.fase2) this.auraFase2(ctx, x, y, H, estado.t);
      return;
    }
    if (!def.chefe && Assets.tem(zona.folha)) {
      const a = Assets.get(zona.folha);
      Assets.desenharRecorte(ctx, zona.folha, (a.w / 2) * def.lado, a.w / 2, x, y, H, false);
      return;
    }
    const U = def.chefe ? 420 : 260;
    ctx.save(); ctx.translate(x, y); ctx.scale(H / U, H / U);
    this.traco(ctx, 6);
    (this.monstros[def.forma] || this.monstros.javali).call(this, ctx, estado.t || 0, estado);
    ctx.restore();
  },

  auraFase2(ctx, x, y, H, t) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const a = t * 2 + i * TAU / 6;
      const g = ctx.createRadialGradient(x + Math.cos(a) * H * 0.3, y - H * 0.5 + Math.sin(a) * H * 0.3, 2, x + Math.cos(a) * H * 0.3, y - H * 0.5 + Math.sin(a) * H * 0.3, H * 0.25);
      g.addColorStop(0, 'rgba(140,80,220,.35)'); g.addColorStop(1, 'rgba(140,80,220,0)');
      ctx.fillStyle = g; ctx.fillRect(x - H, y - H * 1.2, H * 2, H * 1.4);
    }
    ctx.restore();
  },

  monstros: {
    // Javali de Musgo — unidade 260, olhando para a esquerda
    javali(ctx) {
      const C = DATA.PALETA;
      this.sombra(ctx, 130);
      [-70, -30, 40, 80].forEach(lx => this.poli(ctx, [lx - 12, -40, lx + 12, -40, lx + 12, 0, lx - 12, 0], '#3E3424'));
      this.elip(ctx, 10, -90, 120, 66, '#6E5B3A');
      ctx.save(); ctx.globalAlpha = .25; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(30, -62, 100, 34, 0, 0, TAU); ctx.fill(); ctx.restore();
      this.elip(ctx, 0, -146, 70, 24, C.jade, -0.08);
      this.elip(ctx, 70, -138, 40, 18, '#3FA37C', 0.1);
      this.poli(ctx, [-20, -168, -6, -196, 8, -166], '#3FA37C');
      this.poli(ctx, [110, -100, 136, -120, 126, -88], '#6E5B3A'); // rabo
      this.elip(ctx, -100, -92, 58, 48, '#7C6843');
      this.poli(ctx, [-90, -132, -70, -166, -60, -128], '#7C6843');   // orelha
      this.elip(ctx, -150, -80, 24, 20, '#C98C7A');
      ctx.fillStyle = '#121212'; ctx.beginPath(); ctx.arc(-158, -84, 4, 0, TAU); ctx.arc(-146, -76, 4, 0, TAU); ctx.fill();
      this.poli(ctx, [-128, -62, -138, -66, -160, -110, -146, -104], '#F2E6C9'); // presa
      this.circ(ctx, -108, -104, 9, '#fff');
      ctx.fillStyle = C.vermelho; ctx.beginPath(); ctx.arc(-111, -104, 5, 0, TAU); ctx.fill();
      ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-126, -122); ctx.lineTo(-96, -114); ctx.stroke();
    },
    // Espírito-Lanterna — flutua
    lanterna(ctx, t) {
      const C = DATA.PALETA;
      this.sombra(ctx, 60);
      ctx.translate(0, Math.sin(t * 3) * 10 - 20);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, -150, 20, 0, -150, 170);
      g.addColorStop(0, 'rgba(255,200,90,.5)'); g.addColorStop(1, 'rgba(255,160,60,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -150, 170, 0, TAU); ctx.fill(); ctx.restore();
      this.traco(ctx, 6);
      this.membro(ctx, 0, -60, 0, -10, 4, C.ouro);
      this.poli(ctx, [-10, -20, 10, -20, 14, 20, -14, 20], C.ouro);
      this.elip(ctx, 0, -150, 76, 92, C.vermelho);
      ctx.save(); ctx.strokeStyle = '#7E1F1B'; ctx.lineWidth = 4;
      [-46, -20, 20, 46].forEach(dx => { ctx.beginPath(); ctx.ellipse(0, -150, Math.abs(dx), 90, 0, -Math.PI / 2, Math.PI / 2, dx < 0); ctx.stroke(); });
      ctx.restore(); this.traco(ctx, 6);
      this.poli(ctx, [-40, -250, 40, -250, 40, -232, -40, -232], C.ouro);
      this.poli(ctx, [-34, -68, 34, -68, 34, -52, -34, -52], C.ouro);
      // olhos de chama
      const chama = (x, y, s) => { ctx.beginPath(); ctx.moveTo(x, y - 18 * s); ctx.quadraticCurveTo(x + 12 * s, y, x, y + 10 * s); ctx.quadraticCurveTo(x - 12 * s, y, x, y - 18 * s); ctx.fillStyle = '#FFD86A'; ctx.fill(); ctx.stroke(); };
      chama(-26, -160, 1.1); chama(26, -160, 1.1);
      ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-26, -120); ctx.lineTo(-13, -110); ctx.lineTo(0, -120); ctx.lineTo(13, -110); ctx.lineTo(26, -120); ctx.stroke();
      const fl = Math.sin(t * 12) * 4;
      chama(-14, -262 + fl, 1); chama(12, -270 - fl, 1.3);
    },
    // Tigre de Bambu Ancestral — unidade 420
    tigre(ctx, t) {
      const C = DATA.PALETA, laranja = '#D88A2E';
      this.sombra(ctx, 220);
      this.curva(ctx, [170, -150, 260, -200, 250, -330, 200, -330], 26, laranja); // rabo
      [80, 150].forEach(lx => this.poli(ctx, [lx - 28, -120, lx + 28, -120, lx + 34, 0, lx - 30, 0], laranja));
      this.elip(ctx, 50, -170, 170, 100, laranja);
      ctx.save(); ctx.globalAlpha = .22; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(70, -120, 150, 46, 0, 0, TAU); ctx.fill(); ctx.restore();
      ctx.save(); ctx.strokeStyle = C.noite; ctx.lineWidth = 12;
      [-40, 10, 60, 110, 160].forEach(sx => { ctx.beginPath(); ctx.moveTo(sx, -262); ctx.quadraticCurveTo(sx + 20, -210, sx - 6, -170); ctx.stroke(); });
      ctx.restore(); this.traco(ctx, 6);
      // folhas de bambu nas costas
      for (let i = 0; i < 5; i++) this.elip(ctx, -40 + i * 50, -268 - (i % 2) * 10, 30, 10, i % 2 ? '#3FA37C' : C.jade, -0.5 + i * 0.25);
      [-90, -30].forEach(lx => this.poli(ctx, [lx - 28, -150, lx + 26, -150, lx + 30, 0, lx - 34, 0], laranja));
      [-96, -38].forEach(lx => this.elip(ctx, lx, -4, 34, 14, '#F2E6C9'));
      // cabeça
      const hy = -250 + Math.sin(t * 2) * 3;
      this.poli(ctx, [-200, hy - 70, -186, hy - 120, -150, hy - 80], laranja);
      this.poli(ctx, [-110, hy - 80, -84, hy - 122, -72, hy - 70], laranja);
      this.circ(ctx, -140, hy, 88, laranja);
      this.elip(ctx, -176, hy + 36, 44, 30, '#F2E6C9');
      this.elip(ctx, -110, hy + 36, 44, 30, '#F2E6C9');
      ctx.save(); ctx.strokeStyle = C.noite; ctx.lineWidth = 10;
      [-170, -140, -110].forEach(sx => { ctx.beginPath(); ctx.moveTo(sx, hy - 86); ctx.lineTo(sx + 4, hy - 48); ctx.stroke(); });
      ctx.restore(); this.traco(ctx, 6);
      [[-178, hy - 14], [-104, hy - 14]].forEach(([ex, ey]) => {
        this.elip(ctx, ex, ey, 20, 14, '#5EE0A6');
        ctx.fillStyle = '#121212'; ctx.beginPath(); ctx.ellipse(ex, ey, 4, 12, 0, 0, TAU); ctx.fill();
      });
      this.poli(ctx, [-154, hy + 16, -126, hy + 16, -140, hy + 32], '#7E1F1B');
      this.poli(ctx, [-170, hy + 52, -162, hy + 80, -154, hy + 52], '#fff');
      this.poli(ctx, [-126, hy + 52, -118, hy + 80, -110, hy + 52], '#fff');
    },
    // Sapo Venenoso Gigante
    sapo(ctx, t) {
      const C = DATA.PALETA;
      this.sombra(ctx, 130);
      const p = Math.sin(t * 2.4) * 4;
      this.elip(ctx, 70, -40, 50, 34, '#3F7A3A');
      this.elip(ctx, 0, -100 - p, 124, 92 + p, '#3F7A3A');
      this.elip(ctx, -20, -70, 82, 50, '#CFD88A');
      [[-40, -150], [40, -130], [80, -90], [10, -170], [-80, -130]].forEach(([sx, sy], i) => this.elip(ctx, sx, sy - p, 14 + i % 2 * 6, 10, C.roxo));
      [[-70, -186], [20, -192]].forEach(([ex, ey]) => {
        this.circ(ctx, ex, ey - p, 32, '#3F7A3A');
        this.circ(ctx, ex, ey - 4 - p, 22, '#F3E35A');
        ctx.fillStyle = '#121212'; ctx.fillRect(ex - 16, ey - 8 - p, 32, 8);
      });
      ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-120, -112); ctx.quadraticCurveTo(-40, -86, 50, -118); ctx.stroke();
      this.traco(ctx, 6);
      this.poli(ctx, [-110, -30, -60, -30, -54, 0, -130, 0], '#3F7A3A');
      // gotas de veneno
      ctx.fillStyle = '#9BE15D';
      for (let i = 0; i < 3; i++) { const yy = -100 + ((t * 60 + i * 30) % 90); ctx.beginPath(); ctx.arc(-110 + i * 6, yy, 6, 0, TAU); ctx.fill(); ctx.stroke(); }
    },
    // Esqueleto Afogado
    esqueleto(ctx, t) {
      const osso = '#F2E6C9', C = DATA.PALETA;
      this.sombra(ctx, 80);
      this.membro(ctx, -20, -110, -34, 0, 12, osso);
      this.membro(ctx, 20, -110, 34, 0, 12, osso);
      this.elip(ctx, 0, -110, 34, 16, osso);
      this.membro(ctx, 0, -110, 0, -190, 10, osso);
      for (let i = 0; i < 4; i++) { ctx.lineWidth = 16; ctx.strokeStyle = '#121212'; ctx.beginPath(); ctx.ellipse(0, -136 - i * 14, 40 - i * 3, 9, 0, Math.PI, TAU); ctx.stroke(); ctx.lineWidth = 7; ctx.strokeStyle = osso; ctx.stroke(); }
      this.traco(ctx, 6);
      // trapos e algas
      this.poli(ctx, [-38, -120, 38, -120, 30, -70, 10, -86, -6, -64, -26, -84], '#3C5B57');
      ctx.save(); ctx.strokeStyle = C.jade; ctx.lineWidth = 6;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-30 + i * 26, -196); ctx.quadraticCurveTo(-40 + i * 26 + Math.sin(t * 3 + i) * 10, -160, -30 + i * 26, -130); ctx.stroke(); }
      ctx.restore(); this.traco(ctx, 6);
      this.membro(ctx, 30, -186, 40, -120, 9, osso);
      this.membro(ctx, -30, -186, -86, -150, 9, osso);
      // espada enferrujada
      ctx.save(); ctx.translate(-86, -150); ctx.rotate(-1.3);
      this.poli(ctx, [-6, 0, 6, 0, 8, -120, 0, -136, -8, -120], '#9A6A4A');
      this.poli(ctx, [-16, 2, 16, 2, 16, 10, -16, 10], '#5d6670');
      ctx.restore(); this.traco(ctx, 6);
      this.circ(ctx, 0, -222, 36, osso);
      this.poli(ctx, [-20, -196, 20, -196, 16, -180, -16, -180], osso);
      ctx.fillStyle = '#121212';
      ctx.beginPath(); ctx.ellipse(-14, -226, 10, 12, 0, 0, TAU); ctx.ellipse(14, -226, 10, 12, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#6FF0D0'; ctx.beginPath(); ctx.arc(-14, -226, 4, 0, TAU); ctx.arc(14, -226, 4, 0, TAU); ctx.fill();
    },
    // Serpente das Brumas — unidade 420
    serpente(ctx, t) {
      const C = DATA.PALETA, cor = C.roxo;
      this.sombra(ctx, 200);
      // anéis do corpo
      this.elip(ctx, 60, -60, 170, 60, cor);
      this.elip(ctx, 30, -120, 130, 48, '#7B5BA8');
      const sw = Math.sin(t * 1.6) * 16;
      this.curva(ctx, [60, -150, 140, -260, -40 + sw, -260, -100 + sw, -340], 56, cor);
      ctx.save(); ctx.strokeStyle = '#B9A3DA'; ctx.lineWidth = 6; ctx.setLineDash([10, 18]);
      ctx.beginPath(); ctx.moveTo(60, -150); ctx.bezierCurveTo(140, -260, -40 + sw, -260, -100 + sw, -340); ctx.stroke(); ctx.restore();
      this.traco(ctx, 6);
      // barbatanas
      this.poli(ctx, [40, -200, 90, -240, 70, -190], C.jade);
      this.poli(ctx, [-20, -260 + sw * 0.3, 10, -310, 6, -250], C.jade);
      // cabeça
      const hx = -120 + sw, hy = -350;
      this.elip(ctx, hx, hy, 78, 46, cor, -0.25);
      this.poli(ctx, [hx - 40, hy + 26, hx - 34, hy + 56, hx - 26, hy + 26], '#fff');
      this.poli(ctx, [hx - 14, hy + 22, hx - 8, hy + 50, hx - 2, hy + 22], '#fff');
      this.elip(ctx, hx - 20, hy - 16, 14, 10, '#F3E35A');
      ctx.fillStyle = '#121212'; ctx.beginPath(); ctx.ellipse(hx - 20, hy - 16, 3, 9, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = C.vermelho; ctx.lineWidth = 5; ctx.beginPath();
      const lg = Math.sin(t * 8) * 6;
      ctx.moveTo(hx - 76, hy + 10); ctx.lineTo(hx - 110, hy + 14 + lg); ctx.lineTo(hx - 124, hy + 4 + lg); ctx.moveTo(hx - 110, hy + 14 + lg); ctx.lineTo(hx - 124, hy + 24 + lg); ctx.stroke();
      this.traco(ctx, 6);
      // névoa
      ctx.save(); ctx.fillStyle = 'rgba(235,240,250,.18)';
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(-160 + i * 70 + Math.sin(t + i) * 20, -30 - (i % 3) * 30, 90, 26, 0, 0, TAU); ctx.fill(); }
      ctx.restore();
    },
    // Guardião de Terracota
    guardiao(ctx, t) {
      const barro = '#B5643C', esc = '#8C4A2B', C = DATA.PALETA;
      this.sombra(ctx, 90);
      // lança
      this.poli(ctx, [-82, 0, -72, 0, -72, -250, -82, -250], '#6B4A2E');
      this.poli(ctx, [-90, -250, -64, -250, -77, -300], '#9AA4AE');
      this.poli(ctx, [-90, -246, -64, -246, -66, -238, -88, -238], C.vermelho);
      this.poli(ctx, [-36, -80, -8, -80, -10, 0, -40, 0], esc);
      this.poli(ctx, [8, -80, 36, -80, 40, 0, 10, 0], esc);
      this.poli(ctx, [-60, -70, 60, -70, 46, -190, -46, -190], barro);
      ctx.save(); ctx.strokeStyle = esc; ctx.lineWidth = 3;
      for (let yy = -84; yy > -186; yy -= 14) { ctx.beginPath(); ctx.moveTo(-52, yy); ctx.lineTo(52, yy); ctx.stroke(); }
      for (let xx = -40; xx <= 40; xx += 20) { ctx.beginPath(); ctx.moveTo(xx, -84); ctx.lineTo(xx, -186); ctx.stroke(); }
      ctx.strokeStyle = '#5a2a16'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(20, -180); ctx.lineTo(8, -150); ctx.lineTo(22, -130); ctx.stroke();
      ctx.restore(); this.traco(ctx, 6);
      this.membro(ctx, -40, -176, -76, -140, 22, barro);
      this.membro(ctx, 40, -176, 50, -110, 22, barro);
      this.circ(ctx, -76, -140, 12, barro);
      this.circ(ctx, 0, -222, 34, barro);
      this.poli(ctx, [-38, -232, 38, -232, 30, -258, -30, -258], esc);
      this.circ(ctx, 0, -266, 12, esc);
      const brilho = 0.6 + Math.sin(t * 3) * 0.4;
      ctx.fillStyle = `rgba(110,240,200,${brilho})`;
      ctx.fillRect(-20, -224, 12, 5); ctx.fillRect(6, -224, 12, 5);
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-10, -204); ctx.lineTo(10, -204); ctx.stroke();
    },
    // Garça Espectral
    garca(ctx, t) {
      const C = DATA.PALETA;
      ctx.save(); ctx.globalAlpha = 0.88;
      ctx.translate(0, Math.sin(t * 2) * 6);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(10, -150, 10, 10, -150, 160);
      g.addColorStop(0, 'rgba(140,200,255,.35)'); g.addColorStop(1, 'rgba(140,200,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(10, -150, 160, 0, TAU); ctx.fill(); ctx.restore();
      this.traco(ctx, 5);
      this.membro(ctx, 0, -110, -6, 0, 5, '#2a2f45');
      this.membro(ctx, 30, -110, 40, 0, 5, '#2a2f45');
      const asa = Math.sin(t * 3) * 0.15;
      ctx.save(); ctx.translate(40, -160); ctx.rotate(-0.6 + asa);
      this.poli(ctx, [0, 0, 120, -40, 150, -10, 110, 20, 40, 30], '#DDE6F3');
      this.poli(ctx, [110, -36, 150, -10, 130, 4], C.noite);
      ctx.restore(); this.traco(ctx, 5);
      this.elip(ctx, 20, -140, 74, 40, '#EEF3FA', -0.15);
      this.curva(ctx, [-30, -150, -70, -200, -10, -230, -40, -270], 16, '#EEF3FA');
      this.elip(ctx, -46, -276, 22, 16, '#EEF3FA');
      this.circ(ctx, -46, -290, 8, C.vermelho);
      this.poli(ctx, [-62, -280, -130, -272, -62, -268], C.ouro);
      ctx.fillStyle = '#121212'; ctx.beginPath(); ctx.arc(-50, -278, 3, 0, TAU); ctx.fill();
      ctx.restore();
    },
    // Imperador Eclipse — unidade 420
    imperador(ctx, t, estado) {
      const C = DATA.PALETA;
      this.sombra(ctx, 160);
      // sol eclipsado atrás
      ctx.save(); ctx.translate(0, -300); ctx.rotate(t * 0.2);
      ctx.strokeStyle = C.ouro; ctx.lineWidth = 6;
      for (let i = 0; i < 16; i++) { ctx.rotate(TAU / 16); ctx.beginPath(); ctx.moveTo(122, 0); ctx.lineTo(150 + (i % 2) * 18, 0); ctx.stroke(); }
      ctx.restore();
      this.traco(ctx, 6);
      ctx.save(); ctx.shadowColor = C.ouro; ctx.shadowBlur = 30;
      this.circ(ctx, 0, -300, 116, '#0D0F1E'); ctx.restore();
      ctx.lineWidth = 6; ctx.strokeStyle = C.ouro; ctx.beginPath(); ctx.arc(0, -300, 116, 0, TAU); ctx.stroke();
      this.traco(ctx, 6);
      if (estado && estado.fase2) this.auraFase2(ctx, 0, 0, 420, t);
      this.traco(ctx, 6);
      // manto
      this.poli(ctx, [-130, 0, 130, 0, 70, -250, -70, -250], C.noite);
      this.poli(ctx, [-30, 0, 30, 0, 22, -240, -22, -240], C.vermelho);
      ctx.save(); ctx.strokeStyle = C.ouro; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-100, -30); ctx.bezierCurveTo(-60, -90, -110, -140, -60, -200); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(100, -30); ctx.bezierCurveTo(60, -90, 110, -140, 60, -200); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-130, -6); ctx.lineTo(130, -6); ctx.stroke();
      ctx.restore(); this.traco(ctx, 6);
      // mangas
      this.poli(ctx, [-70, -240, -150, -150, -120, -120, -60, -190], C.noite);
      this.poli(ctx, [70, -240, 150, -150, 120, -120, 60, -190], C.noite);
      this.circ(ctx, -136, -132, 14, '#DCD6E8');
      this.circ(ctx, 136, -132, 14, '#DCD6E8');
      // cabeça
      this.poli(ctx, [-50, -280, 50, -280, 40, -160, -40, -160], '#121212'); // cabelo longo
      this.circ(ctx, 0, -290, 40, '#DCD6E8');
      const brilho = estado && estado.fase2 ? '#FF4040' : '#E04A3A';
      ctx.fillStyle = brilho; ctx.shadowColor = brilho; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.ellipse(-15, -292, 9, 4, 0.2, 0, TAU); ctx.ellipse(15, -292, 9, 4, -0.2, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-10, -270); ctx.lineTo(10, -270); ctx.stroke();
      this.traco(ctx, 6);
      this.poli(ctx, [-40, -322, -28, -360, -14, -330, 0, -372, 14, -330, 28, -360, 40, -322], C.ouro);
      this.circ(ctx, 0, -340, 7, '#0D0F1E');
    },
  },

  // ---------- Fundos procedurais (1280×720) ----------
  fundo(ctx, nome) {
    const C = DATA.PALETA;
    const r = rngSemente(nome.length * 977 + 13);
    const grad = (cores) => { const g = ctx.createLinearGradient(0, 0, 0, 720); cores.forEach((c, i) => g.addColorStop(i / (cores.length - 1), c)); ctx.fillStyle = g; ctx.fillRect(0, 0, 1280, 720); };
    const montanhas = (base, alt, cor, seed) => {
      const rr = rngSemente(seed); ctx.fillStyle = cor; ctx.beginPath(); ctx.moveTo(0, 720); ctx.lineTo(0, base);
      for (let x = 0; x <= 1280; x += 80) ctx.lineTo(x, base - rr() * alt);
      ctx.lineTo(1280, 720); ctx.closePath(); ctx.fill();
    };
    Arte.traco(ctx, 5);
    switch (nome) {
      case 'bg_vila': {
        grad(['#F6D9A0', '#E9B872', '#C98F5A']);
        ctx.fillStyle = 'rgba(255,240,200,.8)'; ctx.beginPath(); ctx.arc(980, 170, 70, 0, TAU); ctx.fill();
        montanhas(380, 160, 'rgba(106,76,147,.45)', 3);
        montanhas(430, 90, 'rgba(46,139,106,.55)', 7);
        ctx.fillStyle = '#C9A877'; ctx.fillRect(0, 520, 1280, 200);
        ctx.fillStyle = '#B8935E'; for (let i = 0; i < 40; i++) ctx.fillRect(r() * 1280, 530 + r() * 180, 30 + r() * 60, 4);
        // casas com telhados curvos
        const casa = (x, w, h, cTelhado) => {
          Arte.traco(ctx, 5);
          Arte.poli(ctx, [x, 520, x + w, 520, x + w, 520 - h, x, 520 - h], '#E8D3AA');
          Arte.poli(ctx, [x + w * 0.4, 520, x + w * 0.6, 520, x + w * 0.6, 520 - h * 0.55, x + w * 0.4, 520 - h * 0.55], '#6A3B26');
          ctx.beginPath(); ctx.moveTo(x - 40, 520 - h + 10); ctx.quadraticCurveTo(x + w / 2, 520 - h - 30, x + w + 40, 520 - h + 10);
          ctx.lineTo(x + w + 10, 520 - h - 50); ctx.quadraticCurveTo(x + w / 2, 520 - h - 80, x - 10, 520 - h - 50); ctx.closePath();
          ctx.fillStyle = cTelhado; ctx.fill(); ctx.stroke();
        };
        casa(60, 220, 150, C.vermelho); casa(500, 260, 190, C.jade); casa(1000, 220, 150, C.vermelho);
        // lanternas no varal
        ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(280, 330); ctx.quadraticCurveTo(390, 380, 500, 330); ctx.moveTo(760, 330); ctx.quadraticCurveTo(880, 380, 1000, 330); ctx.stroke();
        [[330, 352], [390, 362], [450, 352], [820, 352], [880, 362], [940, 352]].forEach(([x, y]) => { Arte.traco(ctx, 3); Arte.elip(ctx, x, y + 16, 12, 16, C.vermelho); });
        break;
      }
      case 'bg_mapa': {
        grad(['#F2E6C9', '#E8D6AE']);
        for (let i = 0; i < 400; i++) { ctx.fillStyle = `rgba(120,90,40,${r() * 0.08})`; ctx.fillRect(r() * 1280, r() * 720, 2 + r() * 6, 2 + r() * 6); }
        // rio
        ctx.strokeStyle = 'rgba(46,139,106,.5)'; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(0, 600); ctx.bezierCurveTo(300, 520, 500, 700, 800, 560); ctx.bezierCurveTo(1000, 470, 1100, 560, 1280, 500); ctx.stroke();
        // montanhas em tinta
        ctx.strokeStyle = 'rgba(27,31,59,.7)'; ctx.lineWidth = 4;
        for (let i = 0; i < 14; i++) { const x = r() * 1280, y = 120 + r() * 500, s = 30 + r() * 40; ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x, y - s * 1.1); ctx.lineTo(x + s, y); ctx.stroke(); }
        // bambus (floresta), névoa (pântano), nuvens (templo)
        ctx.fillStyle = 'rgba(46,139,106,.35)'; for (let i = 0; i < 30; i++) ctx.fillRect(180 + r() * 180, 380 + r() * 140, 6, 40 + r() * 30);
        ctx.fillStyle = 'rgba(106,76,147,.18)'; for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.ellipse(560 + r() * 160 - 80, 300 + r() * 80, 70, 20, 0, 0, TAU); ctx.fill(); }
        ctx.fillStyle = 'rgba(212,162,58,.25)'; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.ellipse(1000 + r() * 160 - 80, 150 + r() * 60, 70, 22, 0, 0, TAU); ctx.fill(); }
        // trilha tracejada entre as zonas
        ctx.setLineDash([14, 14]); ctx.strokeStyle = 'rgba(184,50,46,.75)'; ctx.lineWidth = 6;
        const pts = DATA.ORDEM_ZONAS.map(z => [DATA.ZONAS[z].pos.x * 1280, DATA.ZONAS[z].pos.y * 720]);
        ctx.beginPath(); ctx.moveTo(90, 690); pts.forEach(p => ctx.lineTo(p[0], p[1])); ctx.stroke(); ctx.setLineDash([]);
        // moldura dourada
        ctx.strokeStyle = C.ouro; ctx.lineWidth = 14; ctx.strokeRect(10, 10, 1260, 700);
        ctx.strokeStyle = '#8a6420'; ctx.lineWidth = 3; ctx.strokeRect(26, 26, 1228, 668);
        break;
      }
      case 'bg_floresta': {
        grad(['#CFE8C0', '#7DBE8E', '#2E6B4E']);
        ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#FFF6D0';
        for (let i = 0; i < 5; i++) { ctx.beginPath(); const x = 200 + i * 220; ctx.moveTo(x, 0); ctx.lineTo(x + 80, 0); ctx.lineTo(x + 260, 720); ctx.lineTo(x + 120, 720); ctx.fill(); }
        ctx.restore();
        const bambu = (x, w, cor, escuro) => {
          ctx.fillStyle = cor; ctx.fillRect(x, 0, w, 720);
          ctx.fillStyle = escuro; for (let y = 40 + r() * 80; y < 720; y += 90 + r() * 40) ctx.fillRect(x - 2, y, w + 4, 5);
          for (let k = 0; k < 3; k++) { ctx.save(); ctx.translate(x + w, 80 + r() * 400); ctx.rotate(-0.6 + r() * 0.4); ctx.fillStyle = escuro; ctx.beginPath(); ctx.ellipse(30, 0, 34, 7, 0, 0, TAU); ctx.fill(); ctx.restore(); }
        };
        for (let i = 0; i < 18; i++) bambu(r() * 1280, 14 + r() * 10, 'rgba(70,140,90,.55)', 'rgba(40,90,60,.6)');
        for (let i = 0; i < 9; i++) bambu(r() * 1280, 26 + r() * 14, '#4E9A5E', '#2E6B4E');
        ctx.fillStyle = '#3D5E2E'; ctx.fillRect(0, 560, 1280, 160);
        ctx.fillStyle = '#4D7A38'; for (let i = 0; i < 60; i++) { ctx.beginPath(); const x = r() * 1280; ctx.moveTo(x, 570); ctx.lineTo(x + 8, 540 - r() * 20); ctx.lineTo(x + 16, 570); ctx.fill(); }
        break;
      }
      case 'bg_pantano': {
        grad(['#5E6F7A', '#3B5157', '#1F2E33']);
        montanhas(420, 120, 'rgba(27,31,59,.5)', 11);
        // árvores mortas
        const arvore = (x, s) => {
          ctx.strokeStyle = '#1B1F2B'; ctx.lineCap = 'round'; ctx.lineWidth = 14 * s;
          ctx.beginPath(); ctx.moveTo(x, 560); ctx.quadraticCurveTo(x - 10 * s, 420, x + 10 * s, 300); ctx.stroke();
          ctx.lineWidth = 6 * s; ctx.beginPath(); ctx.moveTo(x + 4, 400); ctx.lineTo(x + 70 * s, 340); ctx.moveTo(x, 360); ctx.lineTo(x - 60 * s, 300); ctx.moveTo(x + 10 * s, 310); ctx.lineTo(x + 40 * s, 250); ctx.stroke();
        };
        arvore(120, 1.2); arvore(360, 0.8); arvore(980, 1.1); arvore(1180, 0.9);
        ctx.fillStyle = '#24403A'; ctx.fillRect(0, 540, 1280, 180);
        ctx.fillStyle = 'rgba(120,170,160,.25)'; for (let i = 0; i < 30; i++) { ctx.beginPath(); ctx.ellipse(r() * 1280, 570 + r() * 140, 40 + r() * 60, 5, 0, 0, TAU); ctx.fill(); }
        ctx.fillStyle = 'rgba(230,236,240,.12)'; for (let i = 0; i < 18; i++) { ctx.beginPath(); ctx.ellipse(r() * 1280, 400 + r() * 260, 140 + r() * 120, 26 + r() * 20, 0, 0, TAU); ctx.fill(); }
        ctx.fillStyle = 'rgba(155,225,93,.6)'; for (let i = 0; i < 20; i++) { ctx.beginPath(); ctx.arc(r() * 1280, 300 + r() * 300, 2 + r() * 2, 0, TAU); ctx.fill(); }
        break;
      }
      case 'bg_templo':
      case 'bg_titulo': {
        grad(['#0F1230', C.noite, '#3A2A5A']);
        for (let i = 0; i < 160; i++) { ctx.fillStyle = `rgba(255,245,220,${0.3 + r() * 0.7})`; ctx.fillRect(r() * 1280, r() * 460, 2, 2); }
        // sol sendo eclipsado
        ctx.save(); ctx.shadowColor = C.ouro; ctx.shadowBlur = 60;
        ctx.fillStyle = C.ouro; ctx.beginPath(); ctx.arc(nome === 'bg_titulo' ? 640 : 900, 190, 110, 0, TAU); ctx.fill(); ctx.restore();
        ctx.fillStyle = '#0D0F1E'; ctx.beginPath(); ctx.arc((nome === 'bg_titulo' ? 640 : 900) + 46, 172, 104, 0, TAU); ctx.fill();
        montanhas(470, 170, '#2A2550', 21);
        montanhas(520, 100, '#1B1F3B', 23);
        if (nome === 'bg_templo') {
          // chão de pedra e pilares
          ctx.fillStyle = '#5A4630'; ctx.fillRect(0, 560, 1280, 160);
          for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#6E5638' : '#7E6440'; ctx.fillRect(0, 560 + i * 26, 1280, 13); }
          [90, 330, 950, 1190].forEach(x => {
            Arte.traco(ctx, 5);
            Arte.poli(ctx, [x - 26, 560, x + 26, 560, x + 26, 260, x - 26, 260], C.vermelho);
            Arte.poli(ctx, [x - 40, 260, x + 40, 260, x + 30, 236, x - 30, 236], C.ouro);
          });
          ctx.beginPath(); ctx.moveTo(40, 236); ctx.quadraticCurveTo(210, 200, 380, 236); ctx.lineTo(380, 210); ctx.quadraticCurveTo(210, 170, 40, 210); ctx.closePath(); ctx.fillStyle = C.jade; ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(900, 236); ctx.quadraticCurveTo(1070, 200, 1240, 236); ctx.lineTo(1240, 210); ctx.quadraticCurveTo(1070, 170, 900, 210); ctx.closePath(); ctx.fill(); ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(242,230,201,.08)'; for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.ellipse(r() * 1280, 520 + r() * 180, 200, 30, 0, 0, TAU); ctx.fill(); }
        }
        break;
      }
      default:
        grad([C.noite, '#2a2f55']);
    }
  },
};
