# Arquitetura

O serviço segue a arquitetura em camadas usada na maioria das APIs de mercado.
Cada camada só conversa com a de baixo — e só pela interface dela.

```
 pedido HTTP
     │
 routes/        quais URLs existem e quem atende cada uma (só ligação, sem regra)
     │
 controllers/   HTTP ↔ aplicação: lê e valida o pedido, chama o service, monta a resposta
     │
 services/      regras de negócio: transições de status, algoritmo do elevador
     │
 repositories/  dados: memória (Etapas 1–2) ou SQLite (Etapas 3–4), mesma interface
     │
 db/            conexão e migrações do SQLite (node:sqlite, já vem no Node 22+)
```

## Por que assim

- **Testável:** `criarApp(repo)` monta o app sem subir servidor; os testes usam um
  repositório só na memória.
- **Trocar o banco não muda a regra:** os services recebem um `ChamadasRepository`.
  Na Etapa 3 você troca `MemoriaChamadasRepository` por `SqliteChamadasRepository`
  em `src/server.ts` — nenhum service muda.
- **Erros num lugar só:** qualquer camada lança `ErroHttp(status, mensagem)`; o
  middleware `tratarErros` responde `{"erro": mensagem}` com o status certo.

## Códigos de status usados

| Status | Quando |
|---|---|
| 200 | deu certo (GET, PATCH, POST /despacho) |
| 201 | chamada criada (com o cabeçalho `Location`) |
| 400 | o cliente mandou algo inválido (corpo, query) |
| 404 | a chamada (ou a rota) não existe |
| 409 | a mudança de status não é permitida no estado atual |
| 500 | erro do servidor — nunca deveria acontecer |
| 501 | ainda não implementado (os TODOs do repositório) |
