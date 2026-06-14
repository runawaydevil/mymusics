# Customização visual do embed MyMusics

Este guia descreve como sites que embutem o player MyMusics podem personalizar cores, tipografia e layout **sem injetar CSS no iframe**.

## Por que não dá para usar CSS externo?

O embed roda em um **iframe cross-origin**. Por causa da Same-Origin Policy, a página pai **não consegue** alterar estilos dentro do iframe. A abordagem correta — usada por SoundCloud, Spotify e widgets SaaS — é o MyMusics expor **parâmetros de URL** e **mensagens postMessage** que definem tokens CSS (`--mm-*`) dentro do documento do embed.

### O que você pode customizar (v1)

- Presets nomeados (`light`, `dark`, `midnight`, `minimal`, …)
- Cores individuais (accent, fundo, painel, texto, texto secundário)
- Raio de borda (`radius`)
- Família tipográfica (`system`, `sans`, `serif`)
- Layout compacto (`theme=compact`)
- Tema em tempo real via `postMessage`

### O que não está no escopo v1

- Arquivo CSS externo (`?stylesheet=`)
- Fontes arbitrárias por URL
- `@import` ou CSS livre do embedder

---

## Início rápido

### Preset claro

```html
<iframe
  src="https://mymusics.murad.gg/embed?preset=light&brand=0"
  title="MyMusics"
  width="380"
  height="420"
  style="border:0"
  allow="autoplay"
></iframe>
```

### Marca do site (accent laranja, layout compacto)

```html
<iframe
  src="https://mymusics.murad.gg/embed?preset=minimal&accent=e64a19&theme=compact"
  title="MyMusics"
  width="380"
  height="320"
  style="border:0"
  allow="autoplay"
></iframe>
```

### Midnight com fonte serifada

```html
<iframe
  src="https://mymusics.murad.gg/embed?preset=midnight&font=serif"
  title="MyMusics"
  width="380"
  height="540"
  style="border:0"
  allow="autoplay"
></iframe>
```

---

## Parâmetros de URL

| Param | Exemplo | Efeito |
|-------|---------|--------|
| `preset` | `light` | Preset base de cores |
| `accent` | `fbc02d` ou `%23fbc02d` | Cor de destaque (botão play, highlights) |
| `bg` | `0f172a` | Fundo da página embed |
| `panel` | `1e293b` | Fundo de cards / player |
| `text` | `f8fafc` | Texto principal |
| `fgMuted` | `94a3b8` | Texto secundário (artista, hints) |
| `radius` | `12` | Border-radius em px (0–24) |
| `font` | `serif` | `system`, `sans` ou `serif` |
| `theme` | `compact` | Layout compacto |
| `autoplay` | `0` | Desliga autoplay / auto-advance |
| `start` | `12345` | ID da faixa inicial |
| `brand` | `0` | Oculta logo MyMusics |
| `muted` | `1` | Inicia mudo (**áudio**, não cor) |

**Convenções de cor**

- Hex com ou sem `#`; valores inválidos são ignorados (fallback ao preset).
- Use `fgMuted` para cor secundária. O param `muted=1` é **somente boolean** de áudio.

---

## Presets

| Preset | Descrição |
|--------|-----------|
| `default` | Visual MyMusics padrão (azul profundo, accent amarelo) |
| `light` | Fundo claro, texto escuro, accent laranja |
| `dark` | Neutro escuro (#121212), menos saturado que o default |
| `midnight` | Azul profundo de marca, accent ciano |
| `minimal` | Painéis flat, sombra reduzida, bordas suaves |

Params individuais **sobrescreem** tokens do preset escolhido.

---

## Tokens CSS (`--mm-*`)

Aplicados em `document.documentElement` quando a rota `/embed` está ativa. Úteis ao inspecionar o iframe no DevTools.

| Token | Uso |
|-------|-----|
| `--mm-bg` | Fundo |
| `--mm-bg-panel` | Cards / shell do player |
| `--mm-text` | Títulos e labels |
| `--mm-text-muted` | Artista, hints |
| `--mm-accent` | Botão play, destaques |
| `--mm-accent-secondary` | Links, progresso |
| `--mm-border` | Bordas e divisores |
| `--mm-radius` | Border-radius |
| `--mm-shadow` | Sombra do card |
| `--mm-font-body` | Corpo |
| `--mm-font-display` | Título da faixa |

---

## postMessage

### Iframe → parent (existentes)

Payload: `{ source: "mymusics", type, ... }`

- `mymusics:ready` — `{ trackCount }`
- `mymusics:track` — `{ id, title, artist, streamUrl }`
- `mymusics:state` — `{ state: "playing" | "paused" | "buffering" | "error" }`
- `mymusics:error` — `{ code, message }`
- `mymusics:theme-applied` — `{ tokens: { "--mm-bg": "#...", ... } }` (debug)

### Parent → iframe — comandos (existentes)

```javascript
iframe.contentWindow.postMessage(
  { source: "mymusics-host", type: "mymusics:command", command: "play" },
  "*"
);
```

Comandos: `play`, `pause`, `next`.

### Parent → iframe — tema (novo)

```javascript
iframe.contentWindow.postMessage(
  {
    source: "mymusics-host",
    type: "mymusics:theme",
    theme: { preset: "light", accent: "#e64a19" },
  },
  "*"
);
```

Campos aceitos em `theme`: `preset`, `accent`, `bg`, `panel`, `text`, `fgMuted` (ou `textMuted`), `radius`, `font`. Mesma validação que a URL.

O iframe responde com `mymusics:theme-applied` contendo os tokens CSS efetivos.

### Tema dinâmico conforme dark mode do site

```javascript
const iframe = document.querySelector("iframe.mymusics-embed");

function syncEmbedTheme() {
  const isDark = document.documentElement.classList.contains("dark");
  iframe?.contentWindow?.postMessage(
    {
      source: "mymusics-host",
      type: "mymusics:theme",
      theme: { preset: isDark ? "dark" : "light" },
    },
    "*"
  );
}

const observer = new MutationObserver(syncEmbedTheme);
observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
syncEmbedTheme();
```

---

## oEmbed

A API oEmbed repassa a query string da URL embed:

```
GET /api/oembed?url=https://mymusics.murad.gg/embed?preset=light&accent=fbc02d
```

---

## Gerador de snippet

As páginas **Home** e **About** incluem um gerador com preset, accent, fonte, radius e preview ao vivo.

---

## Limitações e roadmap

| Limitação v1 | Roadmap |
|--------------|---------|
| Sem CSS externo | Possível helper JS (`embed.js`) estilo SoundCloud Widget |
| Contraste não validado automaticamente | Recomenda-se WCAG manualmente |
| `accentSecondary` não exposto por URL | Pode ser adicionado em versão futura |

---

## Referências

- [SoundCloud Widget API](https://developers.soundcloud.com/docs/api/html5-widget)
- [Spotify Embed](https://developer.spotify.com/documentation/embeds)
- [MDN: Using CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
