import os

from quart import Blueprint, Quart

from src.api import Api
from src.db import Database

app = Quart(__name__, static_folder=None)
app.secret_key = os.getenv("SECRET_KEY", "testkey")
CONTEXT_PATH = os.getenv("CONTEXT_PATH", "")


@app.after_request
def add_header(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


db = os.getenv("DATABASE_URL", "test.db")
database = Database(db)
api = Api(database)
api.url_prefix = CONTEXT_PATH
app.register_blueprint(api, url_prefix=CONTEXT_PATH)
app.register_blueprint(
    Blueprint("static_bp", __name__, static_folder="static", static_url_path="/static"),
    url_prefix=CONTEXT_PATH,
)
