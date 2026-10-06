# Serviço de despacho de elevadores

> **Situação real do webforge.** Um prédio comercial de 10 andares (térreo = 0)
> troca o sistema dos elevadores. A central do prédio passa a registrar cada
> chamada na sua API, avisa quando a pessoa embarca e quando chega, e pergunta
> a cada 5 segundos para onde mandar o elevador. Você constrói esse serviço.

Na Situação "A API do controlador" a central mandava tudo a cada pedido. Aqui
a **API é dona do estado**: ela guarda as chamadas, decide com o que guardou,
sobrevive a reinícios e responde métricas para o painel de operação.

## Como rodar

Requisitos: **Node 22.13 ou mais novo** (recomendado o 24, veja `.nvmrc`).

```bash
npm install
npm run dev        # servidor em http://localhost:3000, reinicia a cada alteração
npm test           # testes automatizados (Vitest + supertest)
npm run typecheck  # checagem de tipos (TypeScript)
```

Teste rápido:

```bash
curl -i -X POST localhost:3000/chamadas -H "Content-Type: application/json" -d '{"andar": 3, "destino": 0, "segundos": 15}'
```

## As etapas

Cada etapa vale XP na plataforma e só abre depois da anterior. Antes de enviar,
rode a **central do prédio** — as mesmas checagens que a plataforma faz:

```bash
npm run central -- 1     # (2, 3 ou 4)
```

| Etapa | O que fazer | Onde |
|---|---|---|
| **1. Contrato REST** | `POST /chamadas` (201 + `Location`), `GET /chamadas` com filtro `status`, `PATCH /chamadas/:id` com as transições (409 quando não pode) e 400 para entrada inválida | `controllers/chamadas.controller.ts`, `services/chamadas.service.ts` |
| **2. Despacho** | `POST /despacho`: o algoritmo do elevador usando as chamadas guardadas. A central opera o prédio inteiro pela sua API — passe na meta | `services/despacho.service.ts`, `controllers/despacho.controller.ts` |
| **3. Persistência** | Troque a memória pelo SQLite e implemente a paginação. A central reinicia o seu servidor no meio e confere que nada se perdeu | `repositories/sqlite.repository.ts`, `src/server.ts` |
| **4. Métricas e testes** | `GET /metricas` calculado em SQL e pelo menos 8 testes passando em `tests/` | `repositories/sqlite.repository.ts`, `tests/` |

Os pontos a implementar estão marcados com `TODO Etapa N` e respondem **501**
até você terminar. O contrato completo está em [`docs/openapi.yaml`](docs/openapi.yaml)
e a organização do código em [`docs/arquitetura.md`](docs/arquitetura.md).

## Como enviar

1. Este repositório precisa ser **público** no seu GitHub.
2. Faça commit e push.
3. Na plataforma (Situações reais → Serviço de despacho), cole a URL do
   repositório e clique em **Validar**. A central roda o seu `npm start` (porta
   em `PORT`, banco em `DB_ARQUIVO`) e mostra o resultado de cada checagem.

## Estrutura

```
src/
  app.ts                  monta o app Express (sem subir o servidor)
  server.ts               sobe o servidor (PORT, DB_ARQUIVO)
  routes/                 URLs → controllers
  controllers/            HTTP ↔ services
  services/               regras de negócio
  repositories/           dados (memória e SQLite)
  db/                     conexão e migrações
  domain/                 tipos e regras do domínio (chamada, status)
  http/                   erros e validação
tests/                    testes (Vitest + supertest)
tools/central/            a central do prédio (não edite)
docs/                     contrato (OpenAPI) e arquitetura
```
