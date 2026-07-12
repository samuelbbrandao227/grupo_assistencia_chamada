from dataclasses import dataclass

import requests

DEFAULT_TIMEOUT = 15  # segundos — evita que uma requisição trave o worker


@dataclass
class PortalPresbiterio:
    email: str
    senha: str
    base_url: str = "https://portal.presbiterio.org.br"

    def __post_init__(self):
        self.session = requests.Session()

    def _get(self, endpoint: str, **kwargs):
        kwargs.setdefault("timeout", DEFAULT_TIMEOUT)
        response = self.session.get(f"{self.base_url}{endpoint}", **kwargs)
        response.raise_for_status()
        return response

    def _post(self, endpoint: str, **kwargs):
        kwargs.setdefault("timeout", DEFAULT_TIMEOUT)
        response = self.session.post(f"{self.base_url}{endpoint}", **kwargs)
        response.raise_for_status()
        return response

    def login(self):
        response = self._post(
            "/v2/api/entrar",
            json={
                "email": self.email,
                "senha": self.senha,
            },
        )

        token = response.json()["accessToken"]

        response = self._get(
            "/v2/api/obter-url-v1",
            headers={"Authorization": f"Bearer {token}"},
            json={"ModuloId": 2},
        )

        redirect_url = response.json()["url"]

        # Cria a sessão do portal antigo
        self.session.get(redirect_url, timeout=DEFAULT_TIMEOUT)

    def selecionar_igreja(self, igreja_id: int, grupo_id: int):
        self._get("/module-switch/2")
        self._get(f"/gestaoigreja/change/igreja/{igreja_id}")
        self._get(f"/gestaoigreja/change/grupo/{grupo_id}")

    def listar_membros(self, page=1, per_page=100):
        response = self._get(
            "/gestaoigreja/grupo/membro/indexjson",
            params={
                "kfilter": "",
                "page": page,
                "perPage": per_page,
            },
        )

        return response.json()["data"]["items"]
