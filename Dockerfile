FROM python:3.11-slim

# LibreOffice powers the in-browser PPT/Word -> PDF preview
# (document_pipeline.convert_office_to_pdf). fonts-nanum keeps Korean
# text in slides/documents from rendering as tofu boxes during conversion.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    fonts-nanum \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
