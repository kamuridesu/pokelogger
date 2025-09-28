FROM python:3.13-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /app
COPY pyproject.toml .
COPY uv.lock uv.lock
COPY --from=ghcr.io/astral-sh/uv:0.8.22 /uv /uvx /bin/
RUN uv pip install --system -r pyproject.toml
COPY templates/ templates/
COPY static/ static/
COPY src/ src/
COPY main.py main.py
ENTRYPOINT [ "python", "main.py" ]
