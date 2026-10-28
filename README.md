# Meeting Agent

App desktop para Windows que percebe quando uma reunião começa (Teams, Meet, Zoom ou qualquer app que use o microfone), pergunta se deve gerar a ata, grava o áudio do PC e o microfone, transcreve e pede ao Claude a ata com um título curto.

## Instalar

Baixe `Meeting Agent Setup <versão>.exe` na página de [Releases](../../releases) e execute. O instalador não é assinado: se o Windows mostrar "O Windows protegeu o computador", clique em **Mais informações** e depois em **Executar assim mesmo**.

## Configurar (uma vez, por usuário)

Na aba **Configurações**, cole as chaves de API:

| Chave | Para quê | Onde criar |
|---|---|---|
| Groq (ou OpenAI) | transcrever o áudio | console.groq.com (plano grátis) / platform.openai.com |
| Anthropic | escrever a ata e o título | console.anthropic.com |

As chaves ficam cifradas pelo Windows em `%APPDATA%\meeting-agent`, só legíveis pelo seu usuário nesta máquina.

## Usar

1. Deixe o app aberto ou na bandeja do sistema. Ao detectar uma chamada, ele mostra um aviso no canto da tela: **Gerar ata** ou **Ignorar**. Também dá para iniciar na mão.
2. Ao terminar a chamada, ele pergunta se encerra e gera a ata.
3. Em **Histórico**, veja a ata e a transcrição de cada reunião e pesquise por título, data ou plataforma (ex.: `teams ontem`, `orçamento semana passada`, `26/10`).

Os arquivos ficam em `Documentos\MeetingAgent\<data> <título>\` (`transcript.jsonl`, `ata.md`, `ata.docx`, `meta.json`).

## Privacidade

O áudio é enviado em trechos de até 30 s ao provedor de transcrição (Groq ou OpenAI) e o texto da transcrição, à Anthropic. Avise os participantes que a reunião está sendo transcrita.

## Desenvolver

```bash
npm install
npm run dev      # app em modo desenvolvimento
npm test         # testes
npm run dist     # gera o instalador em dist/
npm run icon     # regenera os ícones a partir de scripts/icon.svg
```

Atrás de proxy com inspeção TLS (certificado da empresa), rode o build com `NODE_OPTIONS=--use-system-ca`.

Stack: Electron, React, Tailwind, Framer Motion. A detecção de reunião usa a API de áudio do Windows (WASAPI) via um PowerShell residente.
