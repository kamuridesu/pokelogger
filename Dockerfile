FROM ghcr.io/astral-sh/uv AS uv

FROM python:3.13-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /app
COPY pyproject.toml .
COPY uv.lock uv.lock
RUN --mount=from=uv,source=/uv,target=/bin/uv \
    uv pip install --system -r pyproject.toml
COPY templates/ templates/
COPY static/ static/
COPY src/ src/
COPY main.py main.py
RUN --mount=from=uv,source=/uv,target=/bin/uv \
    uv pip install --system -e .
ENTRYPOINT [ "python", "main.py" ]
