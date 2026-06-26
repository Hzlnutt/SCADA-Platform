FROM python:3.10-slim

WORKDIR /app

# Install minimal libraries for OpenCV headless image decoding
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -i https://mirrors.aliyun.com/pypi/simple/ --no-cache-dir --default-timeout=1000 --retries 10 -r requirements.txt
RUN pip install -i https://mirrors.aliyun.com/pypi/simple/ --no-cache-dir --default-timeout=1000 --retries 10 --no-deps mediapipe==0.10.14





COPY app.py .

EXPOSE 5001

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "5001"]
