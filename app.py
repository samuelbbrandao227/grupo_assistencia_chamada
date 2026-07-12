"""
Backend da Lista de Chamada — versão endurecida para produção.

Principais mudanças em relação à versão original:
  - debug NUNCA fica ligado por padrão (só via variável de ambiente local)
  - configuração sensível (IGREJA_ID, GRUPOS, SECRET_KEY) vem de variáveis
    de ambiente, não fica hardcoded no código
  - rate limiting no /api/login para dificultar força bruta
  - cabeçalhos de segurança (HSTS, CSP básica, no-sniff, etc.) via Talisman
  - nunca loga e-mail/senha recebidos
  - respeita X-Forwarded-* quando atrás de proxy/load balancer (Render,
    Railway, nginx, etc.)
"""

import os
import re
import logging

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_talisman import Talisman
from werkzeug.middleware.proxy_fix import ProxyFix
import requests

from portal_presbiterio import PortalPresbiterio

load_dotenv()

IGREJA_ID = int(os.environ.get("IGREJA_ID", "48534"))
GRUPOS = {
    "A": os.environ.get("GRUPO_A_ID"),
    "B": os.environ.get("GRUPO_B_ID"),
    "C": os.environ.get("GRUPO_C_ID"),
}
GRUPOS = {k: (int(v) if v else None) for k, v in GRUPOS.items()}

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

app = Flask(__name__, static_folder="static", static_url_path="")
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-only-change-me")

# Confia nos cabeçalhos X-Forwarded-* de UM proxy reverso na frente
# (necessário para HTTPS/HSTS funcionarem corretamente atrás de Render,
# Railway, nginx, etc.)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

# Cabeçalhos de segurança + força HTTPS (desative force_https=False só
# se estiver testando localmente sem TLS).
FORCE_HTTPS = os.environ.get("FLASK_DEBUG", "0") != "1"
Talisman(
    app,
    force_https=FORCE_HTTPS,
    strict_transport_security=True,
    content_security_policy={
        "default-src": "'self'",
        "style-src": "'self' 'unsafe-inline' fonts.googleapis.com",
        "font-src": "fonts.gstatic.com",
        "script-src": "'self'",
    },
)

# Limita tentativas de login por IP para dificultar força bruta contra
# as credenciais do Portal do Presbitério.
limiter = Limiter(get_remote_address, app=app, default_limits=[])

# Nunca deixe logs registrarem corpo de requisição (poderia vazar senha).
logging.getLogger("werkzeug").setLevel(logging.WARNING)


def listar_todos_membros(portal: PortalPresbiterio, per_page: int = 100):
    """Percorre todas as páginas do endpoint de membros e retorna a lista completa."""
    membros = []
    page = 1
    while True:
        items = portal.listar_membros(page=page, per_page=per_page)
        if not items:
            break
        membros.extend(items)
        if len(items) < per_page:
            break
        page += 1
    return membros


@app.route("/")
def home():
    return send_from_directory(app.static_folder, "login.html")


@app.route("/chamada")
def chamada():
    return send_from_directory(app.static_folder, "lista-de-chamada.html")


@app.route("/api/login", methods=["POST"])
@limiter.limit("5 per minute; 20 per hour")
def api_login():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip()
    senha = payload.get("senha") or ""
    grupo = (payload.get("grupo") or "").strip().upper()

    # Validação básica de entrada (nunca logar 'email'/'senha' abaixo disso)
    if not email or not senha:
        return jsonify(success=False, error="Informe e-mail e senha."), 400

    if not EMAIL_RE.match(email):
        return jsonify(success=False, error="E-mail inválido."), 400

    if len(senha) > 256 or len(email) > 254:
        return jsonify(success=False, error="Entrada inválida."), 400

    if grupo not in GRUPOS:
        return jsonify(success=False, error="Selecione um grupo válido (A, B ou C)."), 400

    if GRUPOS[grupo] is None:
        return jsonify(
            success=False,
            error=f"O grupo_id do Grupo {grupo} ainda não foi configurado no servidor.",
        ), 400

    portal = PortalPresbiterio(email=email, senha=senha)

    try:
        portal.login()
    except requests.HTTPError:
        return jsonify(success=False, error="E-mail ou senha inválidos."), 401
    except requests.RequestException:
        return jsonify(
            success=False, error="Não foi possível conectar ao Portal do Presbitério."
        ), 502

    try:
        portal.selecionar_igreja(IGREJA_ID, GRUPOS[grupo])
        itens = listar_todos_membros(portal)
    except requests.HTTPError:
        return jsonify(
            success=False, error="Não foi possível carregar os membros do grupo."
        ), 502
    except requests.RequestException:
        return jsonify(
            success=False, error="Falha de comunicação com o Portal do Presbitério."
        ), 502

    membros = [
        {"nome": item["nom_membro"].strip()}
        for item in itens
        if item.get("nom_membro")
    ]

    return jsonify(success=True, grupo=grupo, membros=membros)


@app.errorhandler(404)
def not_found(_e):
    return jsonify(success=False, error="Não encontrado."), 404


@app.errorhandler(500)
def server_error(_e):
    # Nunca devolve stack trace / detalhes internos ao cliente.
    return jsonify(success=False, error="Erro interno do servidor."), 500


if __name__ == "__main__":
    # Este bloco só é usado em desenvolvimento local. Em produção o
    # processo é iniciado por um servidor WSGI (gunicorn), veja o Procfile.
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    port = int(os.environ.get("PORT", "5000"))
    app.run(debug=debug, port=port)
