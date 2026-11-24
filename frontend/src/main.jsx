import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Wallet, TrendingUp, TrendingDown, PiggyBank, Plus, Trash2, Sparkles,
  LayoutDashboard, ReceiptText, Target, RefreshCw, AlertCircle, CheckCircle2,
  CalendarDays, ArrowUpRight, IndianRupee, GraduationCap, X
} from "lucide-react";
import "./style.css";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const money = (v) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(v || 0));
const today = new Date().toISOString().slice(0, 10);
const categories = ["Food", "Transport", "Education", "Hostel/Rent", "Shopping", "Entertainment", "Mobile/Data", "Health", "Other", "Pocket Money", "Part-time Work"];

function App() {
  const [dashboard, setDashboard] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [settings, setSettings] = useState({ monthly_budget: 5000, savings_goal: 10000 });
  const [insights, setInsights] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [tab, setTab] = useState("Overview");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ kind: "expense", amount: "", category: "Food", note: "", tx_date: today });
  const [settingsForm, setSettingsForm] = useState({ monthly_budget: "5000", savings_goal: "10000" });

  async function request(path, options = {}) {
    const res = await fetch(`${API}${path}`, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || `Request failed (${res.status})`);
    }
    return res.json();
  }

  async function load() {
    setBusy(true);
    try {
      const [d, t, s, i] = await Promise.all([
        request("/api/dashboard"), request("/api/transactions"), request("/api/settings"), request("/api/insights")
      ]);
      setDashboard(d); setTransactions(t); setSettings(s);
      setSettingsForm({ monthly_budget: String(s.monthly_budget), savings_goal: String(s.savings_goal) });
      setInsights(i.insights); setForecast(i.forecast);
      setNotice("");
    } catch (e) {
      setNotice(`Could not connect to the API. Start the FastAPI server first. (${e.message})`);
    } finally { setBusy(false); }
  }

  useEffect(() => { load(); }, []);

  async function addTransaction(e) {
    e.preventDefault();
    try {
      await request("/api/transactions", { method: "POST", body: JSON.stringify({ ...form, amount: Number(form.amount) }) });
      setForm({ kind: "expense", amount: "", category: "Food", note: "", tx_date: today });
      setNotice("Transaction saved successfully.");
      await load();
    } catch (e) { setNotice(e.message); }
  }

  async function removeTransaction(id) {
    try { await request(`/api/transactions/${id}`, { method: "DELETE" }); setNotice("Transaction deleted."); await load(); }
    catch (e) { setNotice(e.message); }
  }

  async function saveSettings(e) {
    e.preventDefault();
    try {
      const s = await request("/api/settings", { method: "PUT", body: JSON.stringify({ monthly_budget: Number(settingsForm.monthly_budget), savings_goal: Number(settingsForm.savings_goal) }) });
      setSettings(s); setNotice("Budget and savings goal updated."); await load();
    } catch (e) { setNotice(e.message); }
  }

  const maxCategory = Math.max(1, ...(dashboard?.category_totals || []).map(x => x.amount));
  const currentMonthTransactions = useMemo(() => transactions.filter(t => t.tx_date.slice(0, 7) === today.slice(0, 7)), [transactions]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-icon"><Wallet size={22}/></div><div><b>MoneyWise</b><small>COLLEGE EDITION</small></div></div>
        <div className="student-pill"><div className="avatar"><GraduationCap size={20}/></div><div><b>Student account</b><small>Pocket money planner</small></div></div>
        <div className="nav-label">WORKSPACE</div>
        {[
          ["Overview", LayoutDashboard], ["Transactions", ReceiptText], ["Budget & goals", Target]
        ].map(([label, Icon]) => <button key={label} className={`nav-item ${tab === label ? "active" : ""}`} onClick={() => setTab(label)}><Icon size={18}/>{label}</button>)}
        <div className="sidebar-bottom"><div className="tip-icon"><Sparkles size={18}/></div><b>Small steps add up.</b><p>Build healthier money habits one transaction at a time.</p><span>Designed for student life</span></div>
      </aside>

      <main className="main">
        <header className="topbar"><div><div className="eyebrow">YOUR PERSONAL FINANCE SPACE</div><h1>{tab === "Overview" ? "Money overview" : tab}</h1><p>Make your pocket money go a little further.</p></div><button className="refresh" onClick={load} disabled={busy}><RefreshCw size={16} className={busy ? "spin" : ""}/> Refresh</button></header>
        {notice && <div className={`notice ${notice.toLowerCase().includes("could not") || notice.toLowerCase().includes("failed") ? "error" : ""}`}><AlertCircle size={17}/><span>{notice}</span><button onClick={() => setNotice("")}><X size={15}/></button></div>}

        {tab === "Overview" && <>
          <section className="hero-card"><div><span className="hero-chip"><Sparkles size={14}/> STUDENT MONEY SNAPSHOT</span><h2>Every rupee has a purpose.</h2><p>Track what comes in, understand what goes out, and plan for what matters to you.</p><div className="hero-foot"><span><CalendarDays size={15}/> {dashboard?.month || "Your month at a glance"}</span><span><span className="status-dot"/> Data saved locally</span></div></div><div className="hero-art"><div className="art-circle"><Wallet size={45}/></div><div className="floating f1">₹ Pocket money</div><div className="floating f2"><TrendingUp size={16}/> Smart insights</div></div></section>

          <section className="stats-grid">
            <Stat title="Current balance" value={money(dashboard?.current_balance)} icon={Wallet} tone="purple" subtitle="Income minus expenses"/>
            <Stat title="Money received" value={money(dashboard?.monthly_income)} icon={TrendingUp} tone="green" subtitle="This month"/>
            <Stat title="Money spent" value={money(dashboard?.monthly_expenses)} icon={TrendingDown} tone="orange" subtitle="This month"/>
            <Stat title="Budget remaining" value={money(dashboard?.budget_remaining)} icon={PiggyBank} tone="blue" subtitle="Monthly spending limit"/>
          </section>

          <section className="content-grid">
            <div className="panel spending-panel"><div className="panel-head"><div><h3>Where your money goes</h3><p>Expense categories this month</p></div><span className="mini-tag">BY CATEGORY</span></div>
              {(dashboard?.category_totals || []).length ? <div className="category-list">{dashboard.category_totals.map((c, i) => <div className="category-row" key={c.category}><div className="category-meta"><span>{c.category}</span><b>{money(c.amount)}</b></div><div className="bar-track"><div className={`bar bar-${i % 5}`} style={{ width: `${Math.max(4, c.amount / maxCategory * 100)}%` }}/></div></div>)}</div> : <Empty text="Add an expense to see your spending breakdown."/>}
              <div className="panel-foot"><span>Total recorded expenses</span><b>{money(dashboard?.monthly_expenses)}</b></div>
            </div>
            <div className="panel insight-panel"><div className="panel-head"><div><h3><Sparkles size={18}/> Smart insights</h3><p>Helpful patterns from your transactions</p></div></div>
              {forecast && <div className="forecast-card"><div className="forecast-top"><span>Next-month estimate</span><span className="forecast-icon"><TrendingUp size={17}/></span></div><b>{money(forecast.amount)}</b><small>{forecast.method}</small><p>{forecast.explanation}</p></div>}
              <div className="insight-list">{insights.slice(0, 3).map((x, i) => <div className={`insight-item ${x.type}`} key={i}><span className="insight-symbol">{x.type === "good" ? <CheckCircle2 size={17}/> : x.type === "warning" || x.type === "alert" ? <AlertCircle size={17}/> : <Sparkles size={17}/>}</span><div><b>{x.title}</b><p>{x.message}</p></div></div>)}</div>
            </div>
          </section>

          <section className="panel transactions-panel"><div className="panel-head"><div><h3>Recent transactions</h3><p>Your latest pocket-money activity</p></div><button className="text-button" onClick={() => setTab("Transactions")}>View all <ArrowUpRight size={15}/></button></div><TransactionTable items={(dashboard?.recent_transactions || [])} onDelete={removeTransaction}/></section>
        </>}

        {tab === "Transactions" && <section className="two-col">
          <div className="panel"><div className="panel-head"><div><h3>Add a transaction</h3><p>Record pocket money or daily spending.</p></div><span className="panel-icon"><Plus size={18}/></span></div>
            <form className="form" onSubmit={addTransaction}>
              <label>Transaction type<div className="segmented"><button type="button" className={form.kind === "expense" ? "selected expense" : ""} onClick={() => setForm({...form, kind:"expense", category:"Food"})}>Expense</button><button type="button" className={form.kind === "income" ? "selected income" : ""} onClick={() => setForm({...form, kind:"income", category:"Pocket Money"})}>Money received</button></div></label>
              <label>Amount (₹)<input required type="number" min="1" step="1" placeholder="e.g. 150" value={form.amount} onChange={e => setForm({...form, amount:e.target.value})}/></label>
              <label>Category<select value={form.category} onChange={e => setForm({...form, category:e.target.value})}>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
              <label>Date<input required type="date" value={form.tx_date} onChange={e => setForm({...form, tx_date:e.target.value})}/></label>
              <label>Note (optional)<input maxLength="200" placeholder="e.g. Lunch with friends" value={form.note} onChange={e => setForm({...form, note:e.target.value})}/></label>
              <button className="primary-btn" type="submit"><Plus size={17}/> Save transaction</button>
            </form>
          </div>
          <div className="panel"><div className="panel-head"><div><h3>All transactions</h3><p>{transactions.length} recorded entries</p></div></div><TransactionTable items={transactions} onDelete={removeTransaction}/></div>
        </section>}

        {tab === "Budget & goals" && <section className="two-col">
          <div className="panel"><div className="panel-head"><div><h3>Monthly plan</h3><p>Set limits that work for your student budget.</p></div><span className="panel-icon"><Target size={18}/></span></div>
            <form className="form" onSubmit={saveSettings}><label>Monthly spending budget (₹)<input type="number" min="1" required value={settingsForm.monthly_budget} onChange={e => setSettingsForm({...settingsForm, monthly_budget:e.target.value})}/></label><label>Savings goal (₹)<input type="number" min="1" required value={settingsForm.savings_goal} onChange={e => setSettingsForm({...settingsForm, savings_goal:e.target.value})}/></label><button className="primary-btn"><Target size={17}/> Save plan</button></form>
          </div>
          <div className="panel goal-panel"><div className="panel-head"><div><h3>Your progress</h3><p>A little progress is still progress.</p></div></div>
            <div className="goal-block"><div className="goal-heading"><span>Monthly budget used</span><b>{dashboard?.budget_used_percent || 0}%</b></div><div className="big-track"><div className="big-fill" style={{width:`${Math.min(100, dashboard?.budget_used_percent || 0)}%`}}/></div><p>{money(dashboard?.budget_remaining)} remaining from {money(settings.monthly_budget)}.</p></div>
            <div className="goal-block"><div className="goal-heading"><span>Savings goal progress</span><b>{dashboard?.savings_progress_percent || 0}%</b></div><div className="big-track green-track"><div className="big-fill green-fill" style={{width:`${dashboard?.savings_progress_percent || 0}%`}}/></div><p>Goal: {money(settings.savings_goal)}. Current tracked balance: {money(dashboard?.current_balance)}.</p></div>
            <div className="gentle-note"><PiggyBank size={20}/><span>Tip: choose one small expense to reduce this week, then see how the change adds up over a month.</span></div>
          </div>
        </section>}

        <footer><span>MoneyWise College</span><span>Track gently. Plan confidently.</span><span>Educational project · Not financial advice</span></footer>
      </main>
    </div>
  );
}

function Stat({title, value, icon: Icon, tone, subtitle}) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={20}/></div><div className="stat-title">{title}</div><div className="stat-value">{value ?? "—"}</div><div className="stat-subtitle">{subtitle}</div></div>;
}
function Empty({text}) { return <div className="empty"><Wallet size={24}/><p>{text}</p></div>; }
function TransactionTable({items, onDelete}) {
  if (!items?.length) return <Empty text="No transactions yet. Add one to get started."/>;
  return <div className="table-wrap"><table><thead><tr><th>Transaction</th><th>Category</th><th>Date</th><th className="right">Amount</th><th></th></tr></thead><tbody>{items.map(t => <tr key={t.id}><td><div className="tx-name"><span className={`tx-dot ${t.kind}`}/><div><b>{t.note || t.category}</b><small>{t.kind === "income" ? "Money received" : "Expense"}</small></div></div></td><td><span className="category-pill">{t.category}</span></td><td>{t.tx_date}</td><td className={`right amount ${t.kind}`}>{t.kind === "income" ? "+" : "−"}{money(t.amount)}</td><td><button className="delete-btn" title="Delete transaction" onClick={() => onDelete(t.id)}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div>;
}

createRoot(document.getElementById("root")).render(<App />);
