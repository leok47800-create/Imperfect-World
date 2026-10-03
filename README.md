# Imperfect World

RPG de fantasia oriental com combate por turnos, feito em HTML5 + JavaScript puro + Canvas 2D, sem bibliotecas.

## Como jogar

- **Duplo clique** em `index.html` já funciona.
- **Recomendado:** rode com um servidor local para as artes perderem o fundo magenta (pelo `file://` o navegador bloqueia a leitura dos pixels):

```
cd imperfect-world
python -m http.server 8000
```

Depois abra `http://localhost:8000` no navegador. No celular, use o IP do PC na mesma rede (ex.: `http://192.168.0.10:8000`) e jogue com o celular deitado.

## Novidades desta versão

- **Golpe no tempo certo:** ao atacar, um anel dourado fecha sobre o alvo. Toque na tela (ou aperte Espaço) quando ele encostar no círculo: **Perfeito** dá +50% de dano e mais chance de crítico; **Bom**, +15%. Quando um monstro vai bater, aparece um anel vermelho: acertar o tempo **apara** o golpe (perfeito = metade do dano e sem veneno/queimadura). Dá para desligar em Pausa → Golpe no tempo.
- **Quebra de guarda:** cada monstro tem escudos (◆) sob a vida. Acertar a fraqueza dele ou dar um golpe perfeito tira um escudo. Sem escudos, a guarda **quebra**: ele perde o próximo turno, toma dano dobrado e, se for um chefe preparando o especial, o golpe é cancelado.
- **Intenção visível:** um balão sobre cada monstro mostra o que ele vai fazer no próximo turno (⚔ ataque e o dano, ⚠ especial, ⛨ proteger/defender, ☠ cuspe, ➜ fugir).
- **Comportamentos:** Javali dá investidas, Lanterna explode ao morrer, Sapo cospe ácido, Esqueleto se remonta (a menos que caia com Arcano ou Fogo), Guardião protege aliados feridos e a Garça foge se ficar sozinha.

- **3 espaços de save:** cada espaço guarda um personagem diferente (nível, itens, ouro, missões e zonas). Na tela inicial, **Continuar** abre o último jogado e **Personagens** mostra os três espaços. Para trocar durante o jogo: Pausa → Trocar personagem. Um save da versão antiga vai automaticamente para o espaço 1.

- **6 habilidades por classe** (níveis 1, 3, 5, 8, 10 e 14):
  - Guerreiro: Golpe Rasgador, Lâmina Giratória, Grito de Guerra, Lâmina Sanguinária, Corte Sísmico, Execução do General.
  - Maga: Bola de Fogo, Correntes Elétricas, Escudo Arcano, Lótus Curativa, Tempestade de Raios, Chama da Fênix.
  - Arqueiro: Flecha Dupla, Flecha Venenosa, Passo do Vento (agora desvia de todos os ataques da rodada e deixa o próximo tiro crítico), Flecha Perfurante, Chuva de Flechas, Flecha do Céu Partido.
- **Hordas:** cada caça traz de 1 a 3 monstros. Toque no monstro (ou na caixa dele) para escolher o alvo, ou use ←/→ / Tab. As habilidades de nível 10 (Corte Sísmico, Tempestade de Raios, Chuva de Flechas) acertam todos.
- **Ritmo mais rápido:** XP em dobro (`multXP: 2`), uns 70 combates (cerca de 130 monstros) para zerar.
- **Sequência de vitórias:** cada vitória seguida dá +10% de XP (até +50%). Zera ao voltar à vila, fugir ou cair.
- **Velocidade da batalha:** botão `1×/2×` na batalha (ou tecla **V**). A escolha fica salva.
- **Aviso de golpe:** os chefes anunciam o especial um turno antes (⚠ no registro e na caixa do inimigo). É a hora de usar **Defender** ou o **Passo do Vento**.
- **Fraquezas:** cada ataque tem um elemento (Corte, Flecha, Arcano, Fogo, Raio). Inimigos fracos tomam 50% a mais; os resistentes, menos. A fraqueza aparece na caixa do inimigo depois que você a descobre.
- **Itens raros:** monstros podem deixar equipamentos Comuns ou Raros. Chefes deixam um Épico ou o item **Lendário** exclusivo (garantido na 1ª vitória). Itens podem ser vendidos no Inventário.
- **História:** cenas com diálogo na abertura, antes e depois de cada chefe e no final.
- **App instalável (PWA):** veja abaixo.

## Instalar como app no celular

O navegador só permite instalar a partir de um endereço **https://** (ou `http://localhost`). O jeito mais fácil:

1. Suba a pasta `imperfect-world` para o **GitHub Pages**, Netlify ou Vercel (todos têm plano grátis).
2. Abra o link no celular. No Chrome (Android), toque em **⋮ → Instalar app**. No Safari (iPhone), **Compartilhar → Adicionar à Tela de Início**.
3. Depois da primeira abertura, o jogo funciona até sem internet.

Ao mudar arquivos do jogo, aumente a `VERSAO` no `sw.js` para os celulares baixarem a versão nova.

## Controles

| Tecla | Ação |
|---|---|
| 1 / 2 / 3 / 4 / 5 | Atacar / Habilidades / Item / Defender / Fugir |
| Q / W / E / R / T / Y | Habilidades direto |
| 1 a 5 (com o menu de itens aberto) | Usar a poção da lista |
| ← / → ou Tab | Trocar o alvo numa horda |
| V | Velocidade da batalha (1× / 2×) |
| I | Inventário e status |
| Esc | Pausa / fechar painel |
| Espaço / Enter / toque | Golpe no tempo certo (quando o anel fecha) |
| Enter | Confirmar |

Mouse e toque funcionam em todos os botões.

## Artes

Coloque os PNGs na pasta `assets/` com estes nomes. Qualquer imagem que faltar é desenhada no código com formas simples, então o jogo funciona com ou sem elas.

- `hero_guerreiro.png`, `hero_mago.png`, `hero_arqueiro.png` — 4 quadros em linha (parado, ataque, habilidade, dano)
- `npcs.png` — Ferreiro, Mercadora, Mestre de Missões
- `enemies_floresta.png`, `enemies_pantano.png`, `enemies_templo.png` — 2 monstros lado a lado
- `boss_floresta.png`, `boss_pantano.png`, `boss_templo.png`
- `bg_vila.png`, `bg_mapa.png`, `bg_floresta.png`, `bg_pantano.png`, `bg_templo.png` — fundos 16:9
- `items.png`, `ui_icons.png` — grades 4×4
- `logo.png`, `title_screen.png`, `icon.png`

Sprites com fundo magenta (#FF00FF) têm o fundo removido automaticamente (tolerância em `DATA.TOLERANCIA_MAGENTA`).

Enquanto faltar alguma imagem, o console do navegador mostra um aviso "404" para ela. Isso some quando o arquivo existir.

## Balanceamento

Todos os números ficam em `js/data.js`. Os mais úteis para ajustar o ritmo:

- `DATA.BAL.multXP` — multiplicador de XP. Padrão 2 (uns 70 combates para zerar). Com 1 (valores do documento original), são algumas centenas.
- `DATA.BAL.hordaPesos` — chance de a caça trazer 1, 2 ou 3 monstros.
- `DATA.BAL.sequenciaBonus` / `sequenciaMax` — bônus da sequência de vitórias.
- `DATA.BAL.chanceDropEquip` e `chanceRaro` — chance de cair equipamento e de ele ser Raro.
- `elem` em cada inimigo — fraquezas (acima de 1) e resistências (abaixo de 1).
- `DATA.BAL.qte*` — tempo e bônus do golpe no tempo certo; `guarda` em cada inimigo; `DATA.COMPORTAMENTOS`.
- `DATA.HABILIDADES` — todas as habilidades (custo, multiplicador, nível e efeitos).
- `DATA.HISTORIA` — todas as falas da história.
- `DATA.BAL.multOuro` — multiplicador de ouro.
- `DATA.BAL.chanceDropPocao` — chance de um monstro comum deixar uma Poção de Vida P.
- `DATA.BAL.ouroInicial` e `DATA.BAL.pocoesIniciais`.

Decisões onde o documento original não especificava:

- A Maga usa o ataque mágico também no "Atacar" (com o cajado).
- O Sapo envenena com 35% de chance por acerto.
- A Névoa da Serpente é usada a cada 4 turnos e vem junto de uma mordida.
- O Imperador Eclipse dá 3000 XP e 2000 ouro.
- Missões de caça podem ser repetidas depois de entregues. As de chefe valem uma vez.

## Estrutura

```
index.html
css/style.css
js/data.js     classes, habilidades, inimigos, zonas, itens, missões, balanceamento
js/assets.js   carregamento, remoção do magenta e desenhos substitutos
js/audio.js    efeitos e música (Web Audio API, escala pentatônica)
js/battle.js   fórmulas e combate por turnos
js/save.js     novo personagem e salvamento (localStorage, 3 espaços)
js/ui.js       telas, painéis, HUD
js/main.js     game loop, efeitos visuais, cenas, teclado e regras da vila
assets/        artes do jogo
manifest.json  dados do app instalável
sw.js          guarda o jogo para funcionar offline
```

O jogo salva sozinho depois de cada batalha, compra, aprimoramento, missão e descanso.
