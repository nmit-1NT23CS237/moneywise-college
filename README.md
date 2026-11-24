# MoneyWise College — Student Pocket-Money Manager

A full-stack learning project for college students to track pocket money, daily expenses, monthly budgets, and savings goals.

## Stack
- React + Vite frontend
- Python FastAPI REST API
- SQLite database
- scikit-learn for a simple monthly expense forecast
- Statistical anomaly detection for unusually large expenses

## Features
- Add income and expense transactions
- View balance, income, expenses, and category breakdown
- Set monthly budget
- Set and track a savings goal
- View spending insights and a next-month expense estimate
- Flag unusually large expenses compared with prior transactions

## Run locally

### 1. Install Python dependencies
Open a terminal in this folder (the folder containing `requirements.txt`):
```bash
python -m pip install -r requirements.txt
```

### 2. Start the API
Keep this terminal open:
```bash
python -m uvicorn backend.main:app --reload
```
API docs: http://127.0.0.1:8000/docs

### 3. Start the React frontend
Open a second terminal in the `frontend` folder:
```bash
npm install
npm run dev
```
Open the local URL Vite prints (usually http://localhost:5173).

The frontend expects the API at http://127.0.0.1:8000. If needed, set `VITE_API_URL`.

## Notes for a project demonstration
- The database is created automatically on first API startup.
- The app starts with a few clearly labelled sample transactions so the dashboard is not empty. You can add and delete transactions.
- Forecasts are estimates, not financial advice. The model uses the user's recorded monthly totals when enough data exists; with limited history it falls back to a clearly labelled simple estimate.
- The anomaly flag uses a transparent statistical threshold (median plus three median absolute deviations, with a minimum threshold). It is an educational feature, not fraud detection.
- For a college submission, test the app locally, capture your own screenshots, and write your own report based on what actually works.
