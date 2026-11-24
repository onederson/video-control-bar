# Video Control Bar

Extensão leve e privada (Manifest V3) para navegadores Chromium (**Brave, Chrome, Edge, Opera, Vivaldi**) que oferece:

1. **Controle exato de velocidade** para qualquer `<video>` ou `<audio>` da web (YouTube, Instagram, Twitch, cursos, players embutidos e Shadow DOM).
2. **Barra de controles completa** (progresso arrastável com prévia de tempo, play/pause, voltar/avançar 5s, volume, mudo, velocidade, Picture-in-Picture e tela cheia) para vídeos em sites que escondem os controles nativos — como **Instagram Reels**, **TikTok** e **Threads**.

> **Privacidade:** zero requisições de rede, zero rastreio e zero dependências externas. Usa apenas `storage` (para salvar suas preferências) e `activeTab` (para mostrar o domínio da aba atual no popup).

---

## Funcionalidades

### Velocidade precisa
- **Campo numérico livre:** digite qualquer velocidade positiva (ex.: `0,1`, `1,35`, `2,5`, `10`, etc., aceitando ponto ou vírgula).
- **Ajuste rápido:** botões `− 0,5x`, reset `1x`, `+ 0,5x` e grade de presets (`0,5x` até `10x`).
- **Persistência automática:** a velocidade vale para todas as abas e é reaplicada automaticamente quando o site troca de vídeo.
- *(Nota técnica: navegadores Chromium limitam o `playbackRate` nativo entre `0,0625x` e `16x`; valores fora dessa faixa são salvos normalmente e aplicados no limite suportado pelo navegador.)*

### Barra de controles flutuante (por site)
- **Ligada por padrão** em sites que ocultam controles nativos: `instagram.com`, `tiktok.com`, `threads.net` e `threads.com`.
- **Desligada por padrão** nos demais sites (como YouTube) para não duplicar controles — com ativação em **1 clique** no popup ou pelo atalho **Alt+C** em qualquer site.
- **Isolada em Shadow DOM:** não sofre conflito com o CSS do site e impede que camadas invisíveis (como no Instagram) bloqueiem cliques na barra de progresso ou no volume.
- **Auto-ocultação inteligente:** some suavemente após 2,5s sem mexer o mouse enquanto o vídeo toca e reaparece ao passar o mouse sobre o vídeo ou pausar.
- **Responsiva:** adapta-se automaticamente a vídeos verticais estreitos (Reels/Shorts) e funciona também em tela cheia.

---

## Atalhos de teclado

*(Ativos quando há mídia na página e você não está digitando em campos de texto.)*

| Tecla | Ação |
| :---: | :--- |
| **D** | Aumenta a velocidade em `+0,5x` |
| **S** | Reduz a velocidade em `−0,5x` |
| **R** | Alterna entre `1x` e a última velocidade preferida (padrão `2x`) |
| **Alt+C** | Liga ou desliga a barra de controles completa no site atual |

---

## Instalação (Modo desenvolvedor)

1. Baixe ou clone este repositório:
   ```bash
   git clone https://github.com/onederson/video-control-bar.git
   ```
2. Abra `brave://extensions`, `chrome://extensions` ou `edge://extensions`.
3. Ative o **Modo do desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação** (*Load unpacked*) e selecione a pasta do projeto.
5. Fixe o ícone **Video Control Bar** na barra do navegador.

> Sempre que editar algum arquivo, clique no botão **↻ (Atualizar)** da extensão na página de extensões e recarregue a aba do vídeo.

---

## Estrutura do projeto

```text
video-control-bar/
├── manifest.json   # Configuração Manifest V3, ícones, permissões e content scripts
├── content.js      # Controle de velocidade, atalhos D/S/R e selo visual
├── controls.js     # Barra de controles flutuante em Shadow DOM e atalho Alt+C
├── popup.html      # Interface do popup (tema claro/escuro automático)
├── popup.js        # Lógica do popup e alternância da barra por site
├── icons/          # Ícones PNG (16, 48 e 128 px)
├── tests/          # Testes automatizados (node --test tests/controls.test.js)
└── README.md       # Documentação
```

---

## Testes

Requer apenas Node.js (usa `node:test`, sem dependências externas):

```bash
node --test tests/controls.test.js
```
