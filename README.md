# Lista de Chamada — Login + Portal do Presbitério

## Estrutura

```
chamada-app/
├── app.py                      # Backend Flask (login + busca de membros)
├── portal_presbiterio.py       # Classe fornecida (integração com o Portal)
├── requirements.txt
└── static/
    ├── login.html               # Tela de login (e-mail, senha, grupo A/B/C)
    └── lista-de-chamada.html    # Lista de chamada (carrega membros dinamicamente)
```

## ⚠️ Antes de rodar: configure os `grupo_id`

Abra `app.py` e preencha o dicionário `GRUPOS` com os IDs reais de cada grupo
no Portal do Presbitério (o `igreja_id` já está fixo em `48534`):

```python
GRUPOS = {
    "A": 12345,   # <- substitua pelo grupo_id real
    "B": 12346,
    "C": 12347,
}
```

Enquanto um grupo estiver com `None`, o login para esse grupo retornará erro
("grupo_id não configurado").

## Como rodar

```bash
cd chamada-app
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Abra **http://localhost:5000** no navegador.

## Como funciona o fluxo

1. `login.html` envia `{ email, senha, grupo }` para `POST /api/login`.
2. O backend (`app.py`):
   - instancia `PortalPresbiterio(email, senha)`;
   - chama `.login()`;
   - chama `.selecionar_igreja(48534, GRUPOS[grupo])`;
   - pagina `.listar_membros()` até esgotar os resultados e monta a lista
     final usando `item["nom_membro"]` como nome de cada membro.
3. O backend responde `{ success: true, grupo, membros: [{ nome: "..." }, ...] }`.
4. O front-end guarda essa lista em `sessionStorage` (não fica salva em
   disco, some ao fechar a aba) e redireciona para `/chamada`.
5. `lista-de-chamada.html` lê os membros do `sessionStorage` e monta a lista
   de presença — mesma interface (selo de presença, motivo de ausência,
   busca, copiar resumo, imprimir) que já tínhamos, só que os nomes agora
   vêm da API em vez de estarem fixos no código.
6. O botão **"Trocar de conta"** limpa o `sessionStorage` e volta ao login.

## Observações e pontos a validar

- **Erros de login**: qualquer `HTTPError` do `requests` (401, 403, etc.)
  durante `.login()` é tratado como "e-mail ou senha inválidos". Se o Portal
  retornar algum status diferente do esperado para credenciais erradas,
  pode ser necessário ajustar essa checagem em `api_login()`.
- **Paginação**: `listar_todos_membros()` busca páginas de 100 em 100 até
  vir uma página incompleta. Se o endpoint tiver algum comportamento
  diferente (ex.: sempre retorna `perPage` itens, mesmo na última página),
  me avise para ajustar a condição de parada.
- **Sessão sem persistência no servidor**: o backend não guarda a sessão
  do Portal entre requisições — cada login faz o fluxo completo e devolve
  tudo de uma vez. Isso simplifica bastante, mas significa que, se no
  futuro você quiser uma ação como "recarregar membros" sem pedir a senha
  de novo, será preciso guardar a sessão do `requests` em algum lugar
  (ex.: cache em memória por usuário).
- **Produção**: `app.run(debug=True)` é só para desenvolvimento. Para uso
  real, rode atrás de um servidor WSGI (gunicorn, waitress) e sirva por
  HTTPS, já que senhas trafegam no corpo da requisição.
