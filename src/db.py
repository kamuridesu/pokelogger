import sqlite3
from dataclasses import dataclass

import psycopg2
import psycopg2.errors

SQLITE_DDL = """
CREATE TABLE IF NOT EXISTS pkm_user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS caught (
    user_id INTEGER,
    pokemon_ids TEXT,
    generation INTEGER,
    FOREIGN KEY (user_id) REFERENCES pkm_user(id)
);

CREATE TABLE IF NOT EXISTS cache (
    id INTEGER NOT NULL,
    gen_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    img VARCHAR(500) NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, gen_id)
);
"""

POSTGRES_DDL = """
CREATE TABLE IF NOT EXISTS "pkm_user" (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS caught (
    user_id INTEGER,
    pokemon_ids TEXT,
    generation INTEGER,
    FOREIGN KEY (user_id) REFERENCES "pkm_user"(id)
);

CREATE TABLE IF NOT EXISTS cache (
    id INTEGER NOT NULL,
    gen_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    img VARCHAR(500) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, gen_id)
);
"""


class DuplicatedUserException(PermissionError):
    def __init__(self, message="username already registered", *args: object) -> None:
        super().__init__(message, *args)


@dataclass
class User:
    id: int
    username: str

    def validate(self):
        return (self.id is not None and self.id != "") and (
            self.username is not None and self.username != ""
        )


@dataclass
class Cache:
    id: int
    name: str
    img: str
    updated_at: str


@dataclass
class Generation:
    user_id: int
    pokemon_ids: list[int]
    generation: int

    def to_str(self):
        return ",".join([str(id) for id in self.pokemon_ids])


class Database:
    def __init__(self, db_url: str) -> None:
        self.db_url = db_url
        self._setup_connection()
        self._setup_queries()
        self.init()

    def _setup_connection(self):
        if self.db_url.startswith(("postgres://", "postgresql://")):
            self.db_type = "postgres"
            self.conn = psycopg2.connect(self.db_url)
        else:
            self.db_type = "sqlite"
            self.conn = sqlite3.connect(self.db_url, check_same_thread=False)

    def _setup_queries(self):
        if self.db_type == "postgres":
            user_table = '"pkm_user"'
            param = "%s"
            self.queries = {
                "init": POSTGRES_DDL,
                "create_user": f"INSERT INTO {user_table} (username, password) VALUES ({param}, {param})",
                "get_user": f"SELECT id, username FROM {user_table} WHERE username = {param} AND password = {param}",
                "add_gen_data": f"INSERT INTO caught (user_id, pokemon_ids, generation) VALUES ({param}, {param}, {param})",
                "get_gen_data": f"SELECT * FROM caught WHERE user_id = {param} AND generation = {param}",
                "update_gen": f"UPDATE caught SET pokemon_ids = {param} WHERE user_id = {param} AND generation = {param}",
                "get_cached": f"SELECT id, name, img, updated_at FROM cache WHERE gen_id = {param}",
                "cache_data": f"""
                    INSERT INTO cache (id, name, img, gen_id) VALUES ({param}, {param}, {param}, {param})
                    ON CONFLICT(gen_id, id) DO UPDATE SET
                        name = excluded.name,
                        img = excluded.img,
                        updated_at = NOW()
                """,
            }
        else:
            user_table = "pkm_user"
            param = "?"
            self.queries = {
                "init": SQLITE_DDL,
                "create_user": f"INSERT INTO {user_table} (username, password) VALUES ({param}, {param})",
                "get_user": f"SELECT id, username FROM {user_table} WHERE username = {param} AND password = {param}",
                "add_gen_data": f"INSERT INTO caught (user_id, pokemon_ids, generation) VALUES ({param}, {param}, {param})",
                "get_gen_data": f"SELECT * FROM caught WHERE user_id = {param} AND generation = {param}",
                "update_gen": f"UPDATE caught SET pokemon_ids = {param} WHERE user_id = {param} AND generation = {param}",
                "get_cached": f"SELECT id, name, img, updated_at FROM cache WHERE gen_id = {param}",
                "cache_data": f"""
                    INSERT INTO cache (id, name, img, gen_id) VALUES ({param}, {param}, {param}, {param})
                    ON CONFLICT(gen_id, id) DO UPDATE SET
                        name = excluded.name,
                        img = excluded.img,
                        updated_at = CURRENT_TIMESTAMP
                """,
            }

    def init(self):
        """Initializes the database schema."""
        cursor = self.conn.cursor()
        if self.db_type == "sqlite":
            cursor.executescript(self.queries["init"])
        else:
            cursor.execute(self.queries["init"])
        self.conn.commit()
        cursor.close()

    def create_user(self, username: str, password: str):
        try:
            cursor = self.conn.cursor()
            cursor.execute(self.queries["create_user"], (username, password))
            self.conn.commit()
            cursor.close()
        except (sqlite3.IntegrityError, psycopg2.errors.UniqueViolation):
            self.conn.rollback()
            raise DuplicatedUserException

    def get_user(self, username: str, password: str) -> User:
        cursor = self.conn.cursor()
        cursor.execute(self.queries["get_user"], (username, password))
        item = cursor.fetchone()
        cursor.close()
        if item is None:
            raise PermissionError(f"Invalid username or password for user {username}")
        return User(*item)

    def add_generation_data(self, generation: Generation):
        cursor = self.conn.cursor()
        try:
            cursor.execute(
                self.queries["add_gen_data"],
                (generation.user_id, generation.to_str(), generation.generation),
            )
            self.conn.commit()
        except (sqlite3.IntegrityError, psycopg2.errors.ForeignKeyViolation) as e:
            self.conn.rollback()
            raise PermissionError(
                f"Cannot add data for non-existent user_id: {generation.user_id}"
            ) from e
        finally:
            cursor.close()

    def get_generation_data(self, user: User, generation: int) -> Generation:
        cursor = self.conn.cursor()
        cursor.execute(self.queries["get_gen_data"], (user.id, generation))
        item = cursor.fetchone()
        cursor.close()
        if item is None:
            gen = Generation(user.id, [], generation)
            self.add_generation_data(gen)
            return gen
        return Generation(
            user.id, [int(x) for x in item[1].split(",") if item[1] != ""], item[-1]
        )

    def update_generation(self, generation: Generation, user: User, gen_id: int):
        cursor = self.conn.cursor()
        cursor.execute(
            self.queries["update_gen"], (generation.to_str(), user.id, gen_id)
        )
        self.conn.commit()
        cursor.close()

    def cache_data(self, gen_id: int, data: list[Cache]):
        cursor = self.conn.cursor()
        to_upsert = [(item.id, item.name, item.img, gen_id) for item in data]
        cursor.executemany(self.queries["cache_data"], to_upsert)
        self.conn.commit()
        cursor.close()

    def get_cached(self, gen_id: int) -> list[Cache]:
        cursor = self.conn.cursor()
        cursor.execute(self.queries["get_cached"], (gen_id,))
        items = cursor.fetchall()
        cursor.close()
        if not items:
            return []
        return [Cache(*data) for data in items]

    def close(self):
        self.conn.close()
