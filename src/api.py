from datetime import datetime
from time import time

import aiopoke
from quart import (
    Blueprint,
    jsonify,
    redirect,
    render_template,
    request,
    send_from_directory,
    session,
    url_for,
)

from src.db import Cache, Database, DuplicatedUserException, User

CACHE_EXPIRATION_TIMESTAMP = (60 * 60 * 24) * 3  # 3 days


class Api(Blueprint):
    def __init__(self, database: Database):
        super().__init__("api", __name__)
        self.database = database
        self.api = aiopoke.AiopokeClient()

        self.add_url_rule("/", view_func=self.index)
        self.add_url_rule(
            "/pokeapi-js-wrapper-sw.js",
            view_func=self.service_worker,
            methods=["GET"],
        )
        self.add_url_rule("/logout", view_func=self.logout, methods=["GET", "POST"])
        self.add_url_rule(
            "/register",
            view_func=self._register,
            methods=["GET", "POST"],
        )
        self.add_url_rule("/login", view_func=self.login, methods=["GET", "POST"])
        self.add_url_rule(
            "/<int:gen_id>/<int:pokemon_id>",
            view_func=self.catch,
            methods=["POST", "DELETE"],
        )
        self.add_url_rule(
            "/dashboard/<int:gen_id>",
            view_func=self.dashboard,
            methods=["GET"],
        )
        self.add_url_rule(
            "/dashboard/pokeapi-js-wrapper-sw.js",
            view_func=self.service_worker,
            methods=["GET"],
        )
        self.add_url_rule(
            "/cache/<int:gen_id>",
            view_func=self.cache,
            methods=["GET", "POST"],
        )
        self.add_url_rule("/health", view_func=self.health, methods=["GET"])

    def health(self):
        return jsonify({"status": "ok"}), 200

    def get_user(self) -> User:
        user = User(session.get("user_id", ""), session.get("username", ""))
        if not user.validate():
            raise PermissionError("User or id not set")
        return user

    async def service_worker(self):
        return await send_from_directory(
            "static", "pokeapi-js-wrapper-sw.js", mimetype="application/javascript"
        )

    async def index(self):
        if session.get("username"):
            return redirect(url_for("api.dashboard", gen_id=1))
        return await render_template(
            "index.html", user=session.get("username"), context_path=self.url_prefix
        )

    async def logout(self):
        session.clear()
        return redirect(url_for("api.index"))

    async def _register(self):
        if request.method == "POST":
            data = None
            try:
                data = await request.get_json()
            except Exception:
                return jsonify({"message": "invalid request"}), 400
            if not data:
                return jsonify({"message": "failed to process data"}), 400
            username = data.get("username")
            password = data.get("password")
            if username is None or password is None:
                return jsonify({"message": "invalid username or password"}), 400
            try:
                self.database.create_user(username, password)
                return jsonify({"message": "user created successfuly, please, login"})
            except DuplicatedUserException:
                return jsonify({"message": "username already taken"}), 400
        if request.method == "GET":
            return await render_template("register.html", context_path=self.url_prefix)
        return jsonify({"message": "invalid method"}), 405

    async def login(self):
        if request.method == "POST":
            data = None
            try:
                data = await request.get_json()
            except Exception:
                return jsonify({"message": "invalid request"}), 400
            if not data:
                return jsonify({"message": "failed to process data"}), 400
            username = data.get("username", "")
            password = data.get("password", "")
            if username == "" or password == "":
                return jsonify({"message": "invalid username or password"}), 400
            try:
                user = self.database.get_user(username, password)
                session["username"] = user.username
                session["user_id"] = user.id
                return jsonify({"message": "success"})
            except PermissionError:
                return jsonify({"message": "invalid username or password"}), 400

        if request.method == "GET":
            return await render_template("login.html", context_path=self.url_prefix)

        return jsonify({"message": "invalid method"}), 405

    async def dashboard(self, gen_id: int):
        if not session.get("user_id"):
            return redirect(url_for("api.login"))
        try:
            stored_gen_data = self.database.get_generation_data(self.get_user(), gen_id)
            gen_data = await self.api.get_generation(gen_id)
            pokemon_data = []
            for pokemon in gen_data.pokemon_species:
                if pokemon.id in stored_gen_data.pokemon_ids:
                    pokemon_data.append({"id": pokemon.id, "caught": True})
                    continue
                pokemon_data.append({"id": pokemon.id, "caught": False})
            return await render_template(
                "dashboard.html",
                context=pokemon_data,
                user=session.get("username"),
                context_path=self.url_prefix,
            )
        except PermissionError:
            return redirect(url_for("api.login"))

    async def catch(self, gen_id: int, pokemon_id: int):
        if not session.get("user_id"):
            return redirect(url_for("api.login"))
        user = self.get_user()
        user_data = self.database.get_generation_data(user, gen_id)
        if request.method == "DELETE":
            user_data.pokemon_ids.remove(pokemon_id)
        elif pokemon_id not in user_data.pokemon_ids:
            user_data.pokemon_ids.append(pokemon_id)
        else:
            return jsonify({"message": "pokemon already caight"}), 400
        try:
            self.database.update_generation(user_data, user, gen_id)
            return jsonify({"messsage": "ok"})
        except PermissionError:
            return redirect(url_for("api.login"))

    async def cache(self, gen_id: int):
        if request.method == "POST":
            try:
                cached_data = await request.get_json()
                to_cache = [
                    Cache(data["id"], data["name"], data["img"], "")
                    for data in cached_data
                ]
                self.database.cache_data(gen_id, to_cache)
                return cached_data
            except Exception as e:
                print(e)
                return jsonify({"message": "error"}), 500

        cache = self.database.get_cached(gen_id)
        __cache = []
        for c in cache:
            updated_at = c.updated_at
            if isinstance(updated_at, str):
                updated_at = datetime.strptime(c.updated_at, "%Y-%m-%d %H:%M:%S")
            diff = time() - updated_at.timestamp()
            if diff >= CACHE_EXPIRATION_TIMESTAMP:
                continue
            __cache.append(c)
        return __cache
