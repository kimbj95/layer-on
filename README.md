# LayerOn

수치지형도 DXF 파일의 레이어를 국토지리정보원 표준코드표에 따라 자동으로 분류하고, 대분류별 색상을 지정하여 내보내는 웹 도구입니다. 680개 표준코드에 대한 정확 매칭, 접두어 매칭, 카테고리 폴백을 지원하며, 사용자가 색상을 편집한 뒤 DXF로 다운로드할 수 있습니다.

## Why DXF only

DWG 파일을 직접 읽으려면 ODA (Open Design Alliance) SDK가 필요하며, 상용 라이선스 제약이 있습니다. LayerOn은 MIT 라이선스인 [ezdxf](https://github.com/mozman/ezdxf)만 사용하여 라이선스 제약 없이 DXF 파일을 처리합니다. DWG 파일은 AutoCAD에서 "다른 이름으로 저장 > DXF"로 변환하거나, 무료 도구인 ODA File Converter를 사용하면 됩니다.

## Structure

```
layeron/
  frontend/   → Next.js, TypeScript, Tailwind CSS
  backend/    → FastAPI, Python 3.11+, ezdxf
```

## Local Development

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend runs on http://localhost:8000.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:3000.

### Run tests

```bash
# Backend
cd backend
source .venv/bin/activate
pytest tests/ -v

# Frontend
cd frontend
npm run build
```

## Deploy

### Backend → Railway

- GitHub 연결 후 Root Directory: `backend`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Environment: `PORT` (Railway 자동 설정)

### Frontend → Vercel

- GitHub 연결 후 Root Directory: `frontend`
- Environment: `NEXT_PUBLIC_API_URL` = Railway 배포 URL

순수 Python + Node.js만 사용하므로 Docker 불필요.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/upload` | Upload DXF file (multipart, max 50MB) |
| GET | `/api/session/{id}` | Get session state |
| POST | `/api/session/{id}/apply` | Apply colors and generate output DXF |
| GET | `/api/session/{id}/download` | Download processed DXF |
