FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 worker && useradd --uid 10001 --gid worker --no-create-home worker
WORKDIR /app
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY --chown=10001:10001 hdqaz_worker ./hdqaz_worker
COPY --chown=10001:10001 tests ./tests
USER 10001:10001
STOPSIGNAL SIGTERM
CMD ["python", "-m", "hdqaz_worker.main"]
