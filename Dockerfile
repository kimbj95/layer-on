# Stage 1: Build .NET DWG converter
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS dotnet-build
WORKDIR /src
COPY dwg-converter/ ./dwg-converter/
RUN dotnet publish dwg-converter/DwgConverter.csproj \
    -c Release -r linux-x64 \
    --self-contained true \
    /p:PublishSingleFile=true \
    /p:IncludeNativeLibrariesForSelfExtract=true \
    -o /out/bin

# Stage 2: Python backend
FROM python:3.11-slim
WORKDIR /app

# Copy DWG converter binary
COPY --from=dotnet-build /out/bin/DwgConverter /app/bin/DwgConverter
RUN chmod +x /app/bin/DwgConverter

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ .

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
