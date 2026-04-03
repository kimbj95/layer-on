# LayerOn

수치지형도 DXF/DWG 파일의 레이어를 국토지리정보원 표준코드표에 따라 자동으로 분류하고, 대분류별 색상과 한글 description을 지정하여 내보내는 웹 도구입니다. 680개 표준코드에 대한 정확 매칭, 접두어 매칭, 카테고리 폴백을 지원하며, 사용자가 색상을 편집한 뒤 DXF 또는 DWG로 다운로드할 수 있습니다.

## DWG/DXF Support

DXF와 DWG를 동일하게 지원합니다 (레이어 색상 + 한글 description). 입력 포맷과 관계없이 DXF/DWG 중 원하는 포맷으로 다운로드 가능합니다.

- **DXF**: [ezdxf](https://github.com/mozman/ezdxf) (MIT)로 직접 처리
- **DWG**: [ACadSharp](https://github.com/DomCR/ACadSharp) (MIT) 기반 .NET CLI 도구로 DXF 변환 후 처리

출력 DXF는 R2010 (AC1024) 이상으로 저장됩니다. R2007+에서 문자열이 UTF-8로 저장되어 ACadSharp의 cp949 인코딩 문제를 방지합니다.

## Structure

```
layeron/
  frontend/       → Next.js, TypeScript, Tailwind CSS
  backend/        → FastAPI, Python 3.11+, ezdxf
  dwg-converter/  → .NET 8 console app (ACadSharp), DWG↔DXF
  test-files/     → sample.dxf, sample.dwg (E2E 테스트용)
  Dockerfile      → Multi-stage build (dotnet + python)
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

### DWG Converter (local build)

```bash
cd dwg-converter
dotnet publish -c Release -r osx-arm64 --self-contained true /p:PublishSingleFile=true -o ./publish
./publish/DwgConverter to-dxf input.dwg output.dxf
```

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

- GitHub 연결 → root의 Dockerfile을 자동 감지하여 빌드
- Multi-stage: .NET SDK로 DwgConverter 빌드 → Python 이미지에 복사
- Environment: `PORT` (Railway 자동 설정)

### Frontend → Vercel

- GitHub 연결 후 Root Directory: `frontend`
- Environment: `NEXT_PUBLIC_API_URL` = Railway 배포 URL

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/upload` | Upload DXF/DWG file (multipart, max 50MB) |
| GET | `/api/session/{id}` | Get session state |
| POST | `/api/session/{id}/apply` | Apply colors, generate output (DXF or DWG) |
| GET | `/api/session/{id}/download` | Download processed file (DXF or DWG) |
