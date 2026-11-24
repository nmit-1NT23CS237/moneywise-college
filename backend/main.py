from datetime import date, datetime
from pathlib import Path
from typing import Literal, Optional
import sqlite3
import statistics

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "moneywise.db"

app = FastAPI(
    title="MoneyWise College API",
    description="REST API for student pocket-money and expense management.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CATEGORIES = [
    "Food", "Transport", "Education", "Hostel/Rent", "Shopping",
    "Entertainment", "Mobile/Data", "Health", "Other", "Pocket Money", "Part-time Work"
]

def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kind TEXT NOT NULL CHECK(kind IN ('income','expense')),
                amount REAL NOT NULL CHECK(amount > 0),
                category TEXT NOT NULL,
                note TEXT NOT NULL DEFAULT '',
                tx_date TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        """)
        conn.execute("INSERT OR IGNORE INTO settings(key, value) VALUES('monthly_budget', '5000')")
        conn.execute("INSERT OR IGNORE INTO settings(key, value) VALUES('savings_goal', '10000')")
        count = conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
        if count == 0:
            today = date.today()
            sample = [
                ("income", 5000, "Pocket Money", "Monthly pocket money", today.replace(day=1).isoformat()),
                ("expense", 450, "Food", "Mess and snacks", today.isoformat()),
                ("expense", 180, "Transport", "Bus and auto", today.isoformat()),
                ("expense", 250, "Education", "Printouts and notes", today.isoformat()),
                ("expense", 120, "Entertainment", "Movie with friends", today.isoformat()),
            ]
            conn.executemany(
                "INSERT INTO transactions(kind, amount, category, note, tx_date) VALUES(?,?,?,?,?)",
                sample,
            )

init_db()

class TransactionIn(BaseModel):
    kind: Literal["income", "expense"]
    amount: float = Field(gt=0, le=10000000)
    category: str = Field(min_length=1, max_length=50)
    note: str = Field(default="", max_length=200)
    tx_date: date

class SettingsIn(BaseModel):
    monthly_budget: float = Field(gt=0, le=10000000)
    savings_goal: float = Field(gt=0, le=100000000)

def row_to_dict(row):
    return {
        "id": row["id"], "kind": row["kind"], "amount": row["amount"],
        "category": row["category"], "note": row["note"], "tx_date": row["tx_date"]
    }

def all_transactions():
    with connect() as conn:
        rows = conn.execute("SELECT * FROM transactions ORDER BY tx_date DESC, id DESC").fetchall()
    return [row_to_dict(r) for r in rows]

def get_setting(key, default):
    with connect() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    return float(row["value"]) if row else default

@app.get("/")
def root():
    return {"app": "MoneyWise College", "status": "running", "docs": "/docs"}

@app.get("/api/health")
def health():
    return {"status": "ok", "database": "connected"}

@app.get("/api/categories")
def categories():
    return {"categories": CATEGORIES}

@app.get("/api/transactions")
def list_transactions():
    return all_transactions()

@app.post("/api/transactions", status_code=201)
def create_transaction(item: TransactionIn):
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO transactions(kind, amount, category, note, tx_date) VALUES(?,?,?,?,?)",
            (item.kind, item.amount, item.category, item.note.strip(), item.tx_date.isoformat()),
        )
        new_id = cur.lastrowid
        row = conn.execute("SELECT * FROM transactions WHERE id=?", (new_id,)).fetchone()
    return row_to_dict(row)

@app.delete("/api/transactions/{transaction_id}")
def delete_transaction(transaction_id: int):
    with connect() as conn:
        cur = conn.execute("DELETE FROM transactions WHERE id=?", (transaction_id,))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"deleted": True, "id": transaction_id}

@app.get("/api/settings")
def get_settings():
    return {
        "monthly_budget": get_setting("monthly_budget", 5000),
        "savings_goal": get_setting("savings_goal", 10000),
    }

@app.put("/api/settings")
def update_settings(item: SettingsIn):
    with connect() as conn:
        conn.execute("INSERT OR REPLACE INTO settings(key,value) VALUES('monthly_budget',?)", (str(item.monthly_budget),))
        conn.execute("INSERT OR REPLACE INTO settings(key,value) VALUES('savings_goal',?)", (str(item.savings_goal),))
    return get_settings()

@app.get("/api/dashboard")
def dashboard():
    txs = all_transactions()
    today = date.today()
    month_prefix = today.strftime("%Y-%m")
    month_txs = [t for t in txs if t["tx_date"].startswith(month_prefix)]
    income = sum(t["amount"] for t in month_txs if t["kind"] == "income")
    expenses = sum(t["amount"] for t in month_txs if t["kind"] == "expense")
    all_income = sum(t["amount"] for t in txs if t["kind"] == "income")
    all_expenses = sum(t["amount"] for t in txs if t["kind"] == "expense")
    by_category = {}
    for t in month_txs:
        if t["kind"] == "expense":
            by_category[t["category"]] = by_category.get(t["category"], 0) + t["amount"]
    budget = get_setting("monthly_budget", 5000)
    goal = get_setting("savings_goal", 10000)
    balance = all_income - all_expenses
    return {
        "month": today.strftime("%B %Y"),
        "monthly_income": round(income, 2),
        "monthly_expenses": round(expenses, 2),
        "current_balance": round(balance, 2),
        "monthly_budget": budget,
        "budget_used_percent": round((expenses / budget) * 100, 1) if budget else 0,
        "budget_remaining": round(budget - expenses, 2),
        "savings_goal": goal,
        "savings_progress_percent": round(max(0, min(100, (max(balance, 0) / goal) * 100)), 1) if goal else 0,
        "category_totals": [{"category": k, "amount": round(v, 2)} for k, v in sorted(by_category.items(), key=lambda x: x[1], reverse=True)],
        "recent_transactions": txs[:6],
        "transaction_count": len(txs),
    }

@app.get("/api/insights")
def insights():
    txs = all_transactions()
    expenses = [t for t in txs if t["kind"] == "expense"]
    messages = []
    if not expenses:
        messages.append({"type": "info", "title": "Start tracking", "message": "Add your first expense to start seeing your spending patterns."})
    else:
        totals = {}
        for t in expenses:
            totals[t["category"]] = totals.get(t["category"], 0) + t["amount"]
        biggest = max(totals, key=totals.get)
        messages.append({
            "type": "tip", "title": "Top spending category",
            "message": f"{biggest} is your highest recorded expense category at ₹{totals[biggest]:,.0f}."
        })
        budget = get_setting("monthly_budget", 5000)
        this_month = date.today().strftime("%Y-%m")
        month_expenses = sum(t["amount"] for t in expenses if t["tx_date"].startswith(this_month))
        used = (month_expenses / budget) * 100 if budget else 0
        if used >= 100:
            messages.append({"type": "warning", "title": "Budget exceeded", "message": f"You have used {used:.0f}% of your monthly budget. Consider pausing non-essential spending."})
        elif used >= 80:
            messages.append({"type": "warning", "title": "Budget getting low", "message": f"You have used {used:.0f}% of your monthly budget. Keep an eye on upcoming expenses."})
        else:
            messages.append({"type": "good", "title": "Budget check", "message": f"You have used {used:.0f}% of your monthly budget so far."})

        # Transparent anomaly threshold: median + 3*MAD, with a sensible floor.
        amounts = [t["amount"] for t in expenses]
        median = statistics.median(amounts)
        mad = statistics.median([abs(x - median) for x in amounts]) if len(amounts) > 1 else 0
        threshold = max(median + 3 * mad, median * 2.5, 1000)
        unusual = [t for t in expenses if t["amount"] >= threshold]
        if unusual:
            top = max(unusual, key=lambda t: t["amount"])
            messages.append({"type": "alert", "title": "Unusually large expense", "message": f"₹{top['amount']:,.0f} for {top['category']} on {top['tx_date']} is much larger than your typical recorded expense. Check whether it was expected."})

    forecast = forecast_next_month(txs)
    messages.append({"type": "forecast", "title": "Next-month expense estimate", "message": forecast["explanation"]})
    return {"insights": messages, "forecast": forecast}

def forecast_next_month(txs):
    by_month = {}
    for t in txs:
        if t["kind"] == "expense":
            month = t["tx_date"][:7]
            by_month[month] = by_month.get(month, 0) + t["amount"]
    vals = [by_month[k] for k in sorted(by_month)]
    if len(vals) >= 3:
        # Small, transparent regression model using previous monthly totals and month index.
        from sklearn.ensemble import RandomForestRegressor
        X, y = [], []
        for i in range(2, len(vals)):
            X.append([vals[i-1], vals[i-2], i])
            y.append(vals[i])
        if len(X) >= 2:
            model = RandomForestRegressor(n_estimators=80, random_state=42, max_depth=4)
            model.fit(X, y)
            estimate = float(model.predict([[vals[-1], vals[-2], len(vals)]])[0])
            method = "Random Forest regression"
            explanation = f"The model estimates about ₹{estimate:,.0f} next month using recorded monthly expense totals. This is a rough estimate because personal spending can change."
            return {"amount": round(max(0, estimate), 2), "method": method, "history_months": len(vals), "explanation": explanation}
    if vals:
        recent = vals[-3:]
        estimate = sum(recent) / len(recent)
        return {
            "amount": round(estimate, 2), "method": "Recent-month average (limited history)",
            "history_months": len(vals),
            "explanation": f"Estimated at about ₹{estimate:,.0f} using the average of available recorded months. Add more monthly history for a more meaningful ML forecast."
        }
    return {
        "amount": 0, "method": "Not enough data", "history_months": 0,
        "explanation": "Add expenses over time to generate a next-month estimate."
    }
