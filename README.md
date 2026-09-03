# Masri Electronics

Arabic RTL commerce storefront and administration application for **المصري للأدوات الكهربائية**.

## Local setup

Requires Python 3.12+ and Node.js 18+.

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -e ".[dev]"
copy .env.example .env
.venv\Scripts\alembic.exe upgrade head
.venv\Scripts\python.exe -m scripts.instance_cli apply --profile ..\instance\masri-electronics.yaml
.venv\Scripts\python.exe -m app.initial_data --email you@example.com --password '<choose-one>'
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8002

cd ..\frontend
npm ci
npm run dev
```

Customer contact details, policies, domain, delivery areas, logo, verified brand palette, and catalog must be configured before launch. No customer catalog or demo seed ships with this clone.
