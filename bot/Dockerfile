FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN pip install --no-cache-dir Pillow==11.3.0 boto3==1.40.45
WORKDIR /app
COPY hdqaz_bot ./hdqaz_bot
COPY tests ./tests
USER 10001:10001
CMD ["python", "-m", "hdqaz_bot.main"]
