FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY hdqaz_bot ./hdqaz_bot
COPY tests ./tests
USER 10001:10001
CMD ["python", "-m", "hdqaz_bot.main"]
