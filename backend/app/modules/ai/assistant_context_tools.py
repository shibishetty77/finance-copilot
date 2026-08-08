"""
AI Finance Assistant — Context Engine.

Provides internal "tools" that query the user's financial data and return
compact, LLM-ready summaries.  Only the data relevant to the user's question
is fetched — we never send the entire database to the model.

Architecture rule: These functions are the ONLY way the assistant accesses
financial data.  Never import ORM models directly in assistant_service.py.

Public interface:
  build_financial_context(db, user_id, question) → str
      → Analyses the question and calls the right tools.

Individual tools (also callable directly):
  get_spending_summary(db, user_id, month?)
  get_category_spending(db, user_id, month?, category?)
  get_recent_transactions(db, user_id, limit=10)
  get_largest_transactions(db, user_id, month?, limit=5, type=expense)
  get_monthly_comparison(db, user_id)
  get_recurring_expenses(db, user_id)
  get_goal_progress(db, user_id)
  get_portfolio_summary(db, user_id)
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.ai.service import AIService
from app.modules.ai.prompt_templates import tool_selection_prompt
from app.modules.ai.tools import market_data as md

from app.models.category import Category
from app.models.goal import Goal
from app.models.holding import Holding
from app.models.transaction import Transaction

logger = logging.getLogger(__name__)

# Maximum characters we will ever send as financial context to the LLM.
_MAX_CONTEXT_CHARS = 2_000


# ── Date helpers ──────────────────────────────────────────────────────────────

def _current_month_range() -> tuple[date, date]:
    """Return (first day, last day) of the current month."""
    today = date.today()
    first = today.replace(day=1)
    import calendar
    last = today.replace(day=calendar.monthrange(today.year, today.month)[1])
    return first, last

def _last_month_range() -> tuple[date, date]:
    """Return (first day, last day) of the previous month."""
    today = date.today()
    if today.month == 1:
        year, month = today.year - 1, 12
    else:
        year, month = today.year, today.month - 1
    import calendar
    first = date(year, month, 1)
    last = date(year, month, calendar.monthrange(year, month)[1])
    return first, last

def _parse_period(period: str | None) -> tuple[date | None, date | None]:
    """Convert a period string into a date range."""
    if not period or period == "current_month":
        return _current_month_range()
    
    today = date.today()
    if period == "last_month":
        return _last_month_range()
    elif period == "last_3_months":
        first, _ = _last_month_range()
        for _ in range(2):
            if first.month == 1:
                first = date(first.year - 1, 12, 1)
            else:
                first = date(first.year, first.month - 1, 1)
        import calendar
        last = date(today.year, today.month, calendar.monthrange(today.year, today.month)[1])
        return first, last
    elif period == "this_year":
        first = date(today.year, 1, 1)
        import calendar
        last = date(today.year, 12, 31)
        return first, last
    elif period == "last_year":
        first = date(today.year - 1, 1, 1)
        last = date(today.year - 1, 12, 31)
        return first, last
    
    # Fallback
    return _current_month_range()


def _format_inr(amount: float) -> str:
    """Format a float as ₹ with commas."""
    return f"₹{amount:,.2f}"


# ── Individual tools ──────────────────────────────────────────────────────────

async def get_spending_summary(
    db: AsyncSession,
    user_id: str,
    period: str | None = None,
) -> dict[str, Any]:
    """
    Return total income, expenses, and savings for the given period.
    """
    date_from, date_to = _parse_period(period)

    query = (
        select(
            func.sum(
                case((Transaction.type == "income", Transaction.amount), else_=0)
            ).label("income"),
            func.sum(
                case((Transaction.type == "expense", Transaction.amount), else_=0)
            ).label("expenses"),
            func.count(Transaction.id).label("count"),
        )
        .where(
            and_(
                Transaction.user_id == user_id,
                Transaction.transaction_date >= date_from,
                Transaction.transaction_date <= date_to,
            )
        )
    )
    result = await db.execute(query)
    row = result.one()
    income = float(row.income or 0)
    expenses = float(row.expenses or 0)
    return {
        "period": f"{date_from.strftime('%b %Y')}",
        "income": income,
        "expenses": expenses,
        "savings": income - expenses,
        "transaction_count": row.count or 0,
    }


async def get_category_spending(
    db: AsyncSession,
    user_id: str,
    period: str | None = None,
    category_name: str | None = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """
    Return per-category expense breakdown.
    Optionally filter to a single category name (case-insensitive partial match).
    """
    date_from, date_to = _parse_period(period)

    query = (
        select(
            Category.name.label("category"),
            func.sum(Transaction.amount).label("total"),
            func.count(Transaction.id).label("count"),
        )
        .join(Category, Transaction.category_id == Category.id, isouter=True)
        .where(
            and_(
                Transaction.user_id == user_id,
                Transaction.type == "expense",
                Transaction.transaction_date >= date_from,
                Transaction.transaction_date <= date_to,
            )
        )
        .group_by(Category.name)
        .order_by(func.sum(Transaction.amount).desc())
        .limit(limit)
    )
    result = await db.execute(query)
    rows = result.all()

    data = [
        {
            "category": row.category or "Uncategorised",
            "total": float(row.total or 0),
            "count": row.count or 0,
        }
        for row in rows
    ]

    if category_name:
        needle = category_name.lower()
        data = [d for d in data if needle in d["category"].lower()]

    return data


async def get_recent_transactions(
    db: AsyncSession,
    user_id: str,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Return the most recent transactions."""
    query = (
        select(Transaction)
        .options(selectinload(Transaction.category))
        .where(Transaction.user_id == user_id)
        .order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(query)
    txns = result.scalars().all()
    return [
        {
            "date": str(t.transaction_date),
            "description": t.description or t.merchant_name or "—",
            "category": t.category.name if t.category else "Uncategorised",
            "amount": float(t.amount),
            "type": t.type,
        }
        for t in txns
    ]


async def get_largest_transactions(
    db: AsyncSession,
    user_id: str,
    period: str | None = None,
    limit: int = 5,
    txn_type: str = "expense",
) -> list[dict[str, Any]]:
    """Return the N largest transactions of the given type in the period."""
    date_from, date_to = _parse_period(period)

    query = (
        select(Transaction)
        .options(selectinload(Transaction.category))
        .where(
            and_(
                Transaction.user_id == user_id,
                Transaction.type == txn_type,
                Transaction.transaction_date >= date_from,
                Transaction.transaction_date <= date_to,
            )
        )
        .order_by(Transaction.amount.desc())
        .limit(limit)
    )
    result = await db.execute(query)
    txns = result.scalars().all()
    return [
        {
            "date": str(t.transaction_date),
            "description": t.description or t.merchant_name or "—",
            "category": t.category.name if t.category else "Uncategorised",
            "amount": float(t.amount),
        }
        for t in txns
    ]


async def get_monthly_comparison(
    db: AsyncSession,
    user_id: str,
) -> dict[str, Any]:
    """Compare current month vs previous month income/expenses."""
    curr = await get_spending_summary(db, user_id, "current_month")
    prev = await get_spending_summary(db, user_id, "last_month")

    def _pct_change(new: float, old: float) -> str:
        if old == 0:
            return "N/A"
        change = ((new - old) / old) * 100
        sign = "+" if change >= 0 else ""
        return f"{sign}{change:.1f}%"

    return {
        "current_month": curr,
        "previous_month": prev,
        "expense_change": _pct_change(curr["expenses"], prev["expenses"]),
        "income_change": _pct_change(curr["income"], prev["income"]),
        "savings_change": _pct_change(curr["savings"], prev["savings"]),
    }


async def get_recurring_expenses(
    db: AsyncSession,
    user_id: str,
) -> list[dict[str, Any]]:
    """Return all transactions marked as recurring."""
    query = (
        select(Transaction)
        .options(selectinload(Transaction.category))
        .where(
            and_(
                Transaction.user_id == user_id,
                Transaction.is_recurring == True,  # noqa: E712
                Transaction.type == "expense",
            )
        )
        .order_by(Transaction.amount.desc())
        .limit(20)
    )
    result = await db.execute(query)
    txns = result.scalars().all()
    return [
        {
            "description": t.description or t.merchant_name or "—",
            "category": t.category.name if t.category else "Uncategorised",
            "amount": float(t.amount),
            "recurrence": t.recurrence_type or "recurring",
        }
        for t in txns
    ]


async def get_goal_progress(
    db: AsyncSession,
    user_id: str,
) -> list[dict[str, Any]]:
    """Return all goals with completion percentage."""
    query = select(Goal).where(Goal.user_id == user_id).order_by(Goal.target_date)
    result = await db.execute(query)
    goals = result.scalars().all()
    output = []
    for g in goals:
        target = float(g.target_amount)
        current = float(g.current_amount)
        pct = (current / target * 100) if target > 0 else 0
        remaining = target - current
        output.append(
            {
                "name": g.name,
                "target": target,
                "current": current,
                "percent_complete": round(pct, 1),
                "remaining": remaining,
                "target_date": str(g.target_date) if g.target_date else None,
            }
        )
    return output


async def get_portfolio_summary(
    db: AsyncSession,
    user_id: str,
) -> dict[str, Any]:
    """Return aggregated portfolio metrics."""
    query = (
        select(
            func.sum(Holding.invested_amount).label("total_invested"),
            func.sum(Holding.current_value).label("total_current"),
            func.sum(Holding.gain_loss).label("total_gain_loss"),
            func.count(Holding.id).label("holding_count"),
        )
        .where(Holding.user_id == user_id)
    )
    result = await db.execute(query)
    row = result.one()
    invested = float(row.total_invested or 0)
    current = float(row.total_current or 0)
    gain_loss = float(row.total_gain_loss or 0)
    gain_pct = (gain_loss / invested * 100) if invested > 0 else 0

    return {
        "total_invested": invested,
        "current_value": current,
        "gain_loss": gain_loss,
        "gain_loss_percent": round(gain_pct, 2),
        "holding_count": row.holding_count or 0,
    }


async def get_net_worth(
    db: AsyncSession,
    user_id: str,
) -> dict[str, Any]:
    """Return net worth approximation (savings + portfolio)."""
    # 1. Get total savings across all time
    query_savings = (
        select(
            func.sum(
                case((Transaction.type == "income", Transaction.amount), else_=0)
            ).label("income"),
            func.sum(
                case((Transaction.type == "expense", Transaction.amount), else_=0)
            ).label("expenses"),
        )
        .where(Transaction.user_id == user_id)
    )
    result_savings = await db.execute(query_savings)
    row_savings = result_savings.one()
    total_income = float(row_savings.income or 0)
    total_expenses = float(row_savings.expenses or 0)
    total_savings = total_income - total_expenses

    # 2. Get portfolio current value
    portfolio = await get_portfolio_summary(db, user_id)
    portfolio_value = float(portfolio["current_value"])

    net_worth = total_savings + portfolio_value

    return {
        "total_savings": total_savings,
        "portfolio_value": portfolio_value,
        "net_worth": net_worth,
    }


async def analyze_portfolio_holding(
    db: AsyncSession,
    user_id: str,
    symbol: str,
) -> dict[str, Any]:
    """
    Combine a user's holding from the DB with live/recent market data.
    All calculations are done in Python; only the result goes to the LLM.
    """
    # 1. Fetch the user's holding record from DB
    query = (
        select(Holding)
        .where(
            and_(
                Holding.user_id == user_id,
                Holding.symbol.ilike(f"%{symbol.split('.')[0]}%"),
            )
        )
        .limit(1)
    )
    result = await db.execute(query)
    holding = result.scalars().first()

    # Resolve ticker (e.g. "RELIANCE" → "RELIANCE.NS")
    resolved_ticker = md.resolve_ticker(symbol) or symbol

    # 2. Fetch market data
    quote = md.get_quote(resolved_ticker)
    hist = md.get_historical_performance(resolved_ticker, "1y")

    holding_data: dict[str, Any] = {}
    if holding:
        quantity = float(holding.quantity or 0)
        avg_buy = float(holding.average_buy_price or 0)
        invested = float(holding.invested_amount or 0)
        stored_current = float(holding.current_value or 0)
        stored_gain = float(holding.gain_loss or 0)

        # Use live market price if available, else fall back to stored
        live_price = quote.get("price")
        if live_price and quantity > 0:
            live_value = round(live_price * quantity, 2)
            live_gain = round(live_value - invested, 2)
            live_gain_pct = round((live_gain / invested) * 100, 2) if invested else 0
        else:
            live_value = stored_current
            live_gain = stored_gain
            live_gain_pct = float(holding.gain_loss_percent or 0)

        holding_data = {
            "symbol": holding.symbol,
            "company_name": holding.company_name,
            "quantity": quantity,
            "average_buy_price": avg_buy,
            "invested_amount": invested,
            "live_price": live_price,
            "live_value": live_value,
            "live_gain": live_gain,
            "live_gain_pct": live_gain_pct,
            "holding_in_db": True,
        }
    else:
        holding_data = {"holding_in_db": False, "symbol": resolved_ticker}

    return {
        "holding": holding_data,
        "market_quote": quote,
        "market_1y_performance": hist,
    }


# ── Context builder ───────────────────────────────────────────────────────────

# Keywords that trigger each tool
_KEYWORD_MAP: dict[str, list[str]] = {
    "spending_summary":    ["spend", "spent", "expense", "expenses", "total", "much", "month", "save", "saved", "savings", "budget"],
    "category_spending":   ["food", "groceries", "transport", "rent", "utilities", "shopping", "entertainment", "healthcare", "education", "subscription", "category", "categories"],
    "recent_transactions": ["recent", "latest", "last", "transaction", "transactions", "paid", "bought", "purchased"],
    "largest_transactions":["biggest", "largest", "most", "top", "expensive", "high"],
    "monthly_comparison":  ["compare", "comparison", "last month", "previous month", "vs", "versus", "change", "difference"],
    "recurring_expenses":  ["recurring", "subscription", "subscriptions", "regular", "monthly payment"],
    "goal_progress":       ["goal", "goals", "target", "saving for", "savings goal"],
    "portfolio_summary":   ["portfolio", "investment", "investments", "stock", "holding", "holdings", "gain", "loss", "returns"],
}


def _detect_tools(question: str) -> set[str]:
    """Return the set of tool names needed to answer the question."""
    lower = question.lower()
    needed: set[str] = set()
    for tool, keywords in _KEYWORD_MAP.items():
        if any(kw in lower for kw in keywords):
            needed.add(tool)
    # Always include at least a spending summary so the assistant has basic context
    if not needed:
        needed.add("spending_summary")
        needed.add("recent_transactions")
    return needed


def _detect_category(question: str) -> str | None:
    """Try to detect a specific category mentioned in the question."""
    category_names = [
        "food", "groceries", "transport", "rent", "utilities", "shopping",
        "entertainment", "healthcare", "education", "investments", "subscriptions",
        "miscellaneous", "salary", "freelance", "business",
    ]
    lower = question.lower()
    for cat in category_names:
        if cat in lower:
            return cat.capitalize()
    return None


def _format_context(data: dict[str, Any]) -> str:
    """Render collected financial data as a compact human-readable string."""
    lines: list[str] = ["=== USER FINANCIAL DATA ==="]

    if "spending_summary" in data:
        s = data["spending_summary"]
        lines += [
            f"\n[{s['period']} Summary]",
            f"  Income:   {_format_inr(s['income'])}",
            f"  Expenses: {_format_inr(s['expenses'])}",
            f"  Savings:  {_format_inr(s['savings'])}",
            f"  Transactions: {s['transaction_count']}",
        ]

    if "category_spending" in data:
        cats = data["category_spending"]
        if cats:
            lines.append("\n[Category Breakdown (this month)]")
            for c in cats[:8]:
                lines.append(f"  {c['category']}: {_format_inr(c['total'])} ({c['count']} txns)")

    if "recent_transactions" in data:
        txns = data["recent_transactions"]
        if txns:
            lines.append("\n[Recent Transactions]")
            for t in txns[:8]:
                sign = "+" if t["type"] == "income" else "-"
                lines.append(f"  {t['date']} | {t['description']} | {t['category']} | {sign}{_format_inr(t['amount'])}")

    if "largest_transactions" in data:
        txns = data["largest_transactions"]
        if txns:
            lines.append("\n[Largest Expenses (this month)]")
            for t in txns:
                lines.append(f"  {t['date']} | {t['description']} | {t['category']} | {_format_inr(t['amount'])}")

    if "monthly_comparison" in data:
        mc = data["monthly_comparison"]
        curr = mc["current_month"]
        prev = mc["previous_month"]
        lines += [
            "\n[Month Comparison]",
            f"  This month:  expenses {_format_inr(curr['expenses'])}, income {_format_inr(curr['income'])}",
            f"  Last month:  expenses {_format_inr(prev['expenses'])}, income {_format_inr(prev['income'])}",
            f"  Expense change: {mc['expense_change']}",
            f"  Savings change: {mc['savings_change']}",
        ]

    if "recurring_expenses" in data:
        recur = data["recurring_expenses"]
        if recur:
            lines.append("\n[Recurring Expenses]")
            for r in recur[:10]:
                lines.append(f"  {r['description']} | {r['category']} | {_format_inr(r['amount'])} ({r['recurrence']})")
        else:
            lines.append("\n[Recurring Expenses]\n  None found.")

    if "goal_progress" in data:
        goals = data["goal_progress"]
        if goals:
            lines.append("\n[Goal Progress]")
            for g in goals:
                lines.append(
                    f"  {g['name']}: {_format_inr(g['current'])} / {_format_inr(g['target'])} "
                    f"({g['percent_complete']}%) — {_format_inr(g['remaining'])} remaining"
                )
        else:
            lines.append("\n[Goals]\n  No goals set.")

    if "portfolio_summary" in data:
        p = data["portfolio_summary"]
        if p["holding_count"] > 0:
            sign = "+" if p["gain_loss"] >= 0 else ""
            lines += [
                "\n[Portfolio Summary]",
                f"  Holdings: {p['holding_count']}",
                f"  Invested: {_format_inr(p['total_invested'])}",
                f"  Current value: {_format_inr(p['current_value'])}",
                f"  Gain/Loss: {sign}{_format_inr(p['gain_loss'])} ({sign}{p['gain_loss_percent']}%)",
            ]
        else:
            lines.append("\n[Portfolio]\n  No holdings recorded.")

    if "net_worth" in data:
        n = data["net_worth"]
        lines += [
            "\n[Net Worth Summary]",
            f"  Total Cash/Savings: {_format_inr(n['total_savings'])}",
            f"  Portfolio Value: {_format_inr(n['portfolio_value'])}",
            f"  Total Net Worth: {_format_inr(n['net_worth'])}",
        ]

    # ── Market Data sections ───────────────────────────────────────────────────

    if "market_quote" in data:
        q = data["market_quote"]
        err = q.get("error")
        if err:
            lines.append(f"\n[Market Quote]\n  {err}")
        else:
            currency = q.get('currency') or ''
            price = f"{q['price']:,.2f} {currency}" if q.get('price') is not None else 'N/A'
            chg = (
                f"{'+' if (q.get('day_change') or 0) >= 0 else ''}"
                f"{q['day_change']:,.2f} ({q['day_change_percent']:+.2f}%)"
                if q.get('day_change') is not None else 'N/A'
            )
            lines += [
                f"\n[Market Quote — {q.get('symbol')}]",
                f"  Company: {q.get('company_name') or 'N/A'}",
                f"  Latest Price: {price}",
                f"  Previous Close: {q.get('previous_close'):,.2f} {currency}" if q.get('previous_close') else "  Previous Close: N/A",
                f"  Day Change: {chg}",
                f"  Exchange: {q.get('exchange') or 'N/A'}",
                f"  Data as of: {q.get('data_timestamp')}",
                "  NOTE: This may be delayed data, not real-time.",
            ]

    if "market_history" in data:
        h = data["market_history"]
        err = h.get("error")
        if err:
            lines.append(f"\n[Historical Performance]\n  {err}")
        else:
            ret = h.get('return_percent')
            ret_str = f"{ret:+.2f}%" if ret is not None else 'N/A'
            lines += [
                f"\n[Historical Performance — {h.get('symbol')} ({h.get('period')})]",
                f"  Start Price: {h.get('start_price'):,.2f} ({h.get('start_date')})",
                f"  End Price:   {h.get('end_price'):,.2f} ({h.get('end_date')})",
                f"  Return:      {ret_str}",
                f"  Period High: {h.get('high'):,.2f}" if h.get('high') else "  Period High: N/A",
                f"  Period Low:  {h.get('low'):,.2f}" if h.get('low') else "  Period Low: N/A",
                f"  Data as of:  {h.get('data_timestamp')}",
            ]

    if "market_comparison" in data:
        c = data["market_comparison"]
        lines.append(f"\n[Securities Comparison — {c.get('period')}]")
        for key in ("security_1", "security_2"):
            s = c.get(key, {})
            ret = s.get('return_percent')
            ret_str = f"{ret:+.2f}%" if ret is not None else 'N/A'
            err = s.get('error')
            if err:
                lines.append(f"  {s.get('symbol')}: {err}")
            else:
                lines.append(
                    f"  {s.get('symbol')} ({s.get('company_name') or 'N/A'}): "
                    f"{s.get('start_price')} → {s.get('end_price')} | Return: {ret_str}"
                )
        winner = c.get('winner_by_return')
        if winner and winner != 'tie':
            lines.append(f"  Better performer: {winner}")
        elif winner == 'tie':
            lines.append("  Performance: Tied")
        lines.append(f"  Data as of: {c.get('data_timestamp')}")

    if "company_info" in data:
        i = data["company_info"]
        err = i.get("error")
        if err:
            lines.append(f"\n[Company Info]\n  {err}")
        else:
            cap_cr = i.get('market_cap_crores')
            lines += [
                f"\n[Company Info — {i.get('symbol')}]",
                f"  Company: {i.get('company_name') or 'N/A'}",
                f"  Sector: {i.get('sector') or 'N/A'}",
                f"  Industry: {i.get('industry') or 'N/A'}",
                f"  Market Cap: {'₹' + f'{cap_cr:,.0f} Cr' if cap_cr else 'N/A'}",
                f"  P/E Ratio: {i.get('pe_ratio') or 'N/A'}",
                f"  Dividend Yield: {f"{i['dividend_yield']*100:.2f}%" if i.get('dividend_yield') else 'N/A'}",
                f"  52w High: {i.get('52w_high') or 'N/A'}",
                f"  52w Low: {i.get('52w_low') or 'N/A'}",
                f"  Data as of: {i.get('data_timestamp')}",
            ]

    if "portfolio_holding_analysis" in data:
        a = data["portfolio_holding_analysis"]
        h = a.get("holding", {})
        q = a.get("market_quote", {})
        hist = a.get("market_1y_performance", {})
        sym = h.get('symbol', 'N/A')
        lines.append(f"\n[Holding Analysis — {sym}]")
        if h.get("holding_in_db"):
            sign = '+' if (h.get('live_gain') or 0) >= 0 else ''
            lines += [
                f"  Qty: {h.get('quantity')} units @ avg {_format_inr(h.get('average_buy_price', 0))}",
                f"  Invested: {_format_inr(h.get('invested_amount', 0))}",
                f"  Live Price: {_format_inr(h.get('live_price', 0)) if h.get('live_price') else 'N/A (using stored value)'}",
                f"  Current Value: {_format_inr(h.get('live_value', 0))}",
                f"  Gain/Loss: {sign}{_format_inr(h.get('live_gain', 0))} ({sign}{h.get('live_gain_pct', 0):.2f}%)",
            ]
        else:
            lines.append(f"  No holding for {sym} found in your portfolio.")
        if not hist.get("error") and hist.get("return_percent") is not None:
            ret = hist['return_percent']
            lines.append(f"  Market 1Y Return: {ret:+.2f}% ({hist.get('start_date')} → {hist.get('end_date')})")
        lines.append(f"  Data as of: {q.get('data_timestamp', 'N/A')}")
        lines.append("  NOTE: Market data may be delayed. Not real-time.")

    context = "\n".join(lines)
    # Trim to budget
    if len(context) > _MAX_CONTEXT_CHARS:
        context = context[:_MAX_CONTEXT_CHARS] + "\n... [truncated]"
    return context


async def determine_required_tools(
    ai_service: AIService,
    history: list[dict[str, str]],
    question: str,
) -> dict[str, Any]:
    """Use the LLM to determine which internal tool to call."""
    history_text = ""
    for msg in history[-5:]:
        history_text += f"{msg['role'].capitalize()}: {msg['content']}\n"
    
    prompt = tool_selection_prompt(history_text, question)
    schema = {
        "type": "object",
        "properties": {
            "tool": {"type": "string"},
            "period": {"type": ["string", "null"]},
            "category": {"type": ["string", "null"]},
            "limit": {"type": ["integer", "null"]}
        },
        "required": ["tool"]
    }
    
    try:
        response = await ai_service.generate_structured(prompt, schema=schema)
        return response.data
    except Exception as exc:
        logger.error("Failed to determine tool via LLM: %s", exc)
        return {"tool": "none"}


async def build_financial_context(
    db: AsyncSession,
    user_id: str,
    question: str,
    ai_service: AIService,
    history: list[dict[str, str]],
) -> str:
    """
    Main entry point for the context engine.

    Uses an LLM to determine which financial data is needed,
    queries only that data, and returns a compact string for the LLM.

    Args:
        db:       Async DB session.
        user_id:  Authenticated user ID.
        question: The user's natural-language question.
        ai_service: The initialized AIService to perform the tool selection.
        history:  Conversation history messages.

    Returns:
        A formatted string ≤ _MAX_CONTEXT_CHARS summarising the relevant data.
    """
    tool_req = await determine_required_tools(ai_service, history, question)
    tool_name = tool_req.get("tool", "none")
    period = tool_req.get("period") or "1y"
    category = tool_req.get("category")
    limit = tool_req.get("limit") or 10
    ticker_raw = tool_req.get("ticker") or ""
    ticker2_raw = tool_req.get("ticker2") or ""

    # Resolve tickers (may return None if unrecognised)
    ticker = md.resolve_ticker(ticker_raw) if ticker_raw else None
    ticker2 = md.resolve_ticker(ticker2_raw) if ticker2_raw else None

    collected: dict[str, Any] = {}

    try:
        if tool_name == "get_monthly_spending":
            collected["spending_summary"] = await get_spending_summary(db, user_id, period if period in {"current_month", "last_month", "last_3_months", "this_year", "last_year"} else None)

        elif tool_name == "get_category_spending":
            collected["category_spending"] = await get_category_spending(
                db, user_id, period, category_name=category
            )

        elif tool_name == "get_recent_transactions":
            collected["recent_transactions"] = await get_recent_transactions(db, user_id, limit=limit)

        elif tool_name == "get_largest_expenses":
            collected["largest_transactions"] = await get_largest_transactions(db, user_id, period, limit=limit)

        elif tool_name == "get_monthly_comparison":
            collected["monthly_comparison"] = await get_monthly_comparison(db, user_id)

        elif tool_name == "get_recurring_expenses":
            collected["recurring_expenses"] = await get_recurring_expenses(db, user_id)

        elif tool_name == "get_goal_progress":
            collected["goal_progress"] = await get_goal_progress(db, user_id)

        elif tool_name == "get_portfolio_summary":
            collected["portfolio_summary"] = await get_portfolio_summary(db, user_id)
            
        elif tool_name == "get_net_worth":
            collected["net_worth"] = await get_net_worth(db, user_id)

        # ── Market Data Tools ──────────────────────────────────────────────────
        elif tool_name == "get_market_quote":
            if ticker:
                collected["market_quote"] = md.get_quote(ticker)
            else:
                return "=== MARKET DATA ===\nI couldn't determine which stock ticker to look up. Please provide the stock name or ticker symbol (e.g. RELIANCE, TCS, AAPL)."

        elif tool_name == "get_historical_performance":
            if ticker:
                collected["market_history"] = md.get_historical_performance(ticker, period)
            else:
                return "=== MARKET DATA ===\nI couldn't determine which stock to look up historical data for. Please provide the stock name or ticker."

        elif tool_name == "compare_securities":
            if ticker and ticker2:
                collected["market_comparison"] = md.compare_securities(ticker, ticker2, period)
            elif ticker:
                return "=== MARKET DATA ===\nTo compare securities, I need two ticker symbols. Please specify both stocks (e.g. 'Compare TCS and Infosys')."
            else:
                return "=== MARKET DATA ===\nI couldn't determine which stocks to compare. Please specify both stock names."

        elif tool_name == "get_company_info":
            if ticker:
                collected["company_info"] = md.get_company_info(ticker)
            else:
                return "=== MARKET DATA ===\nI couldn't determine which company to look up. Please provide the company name or ticker symbol."

        elif tool_name == "analyze_portfolio_holding":
            if ticker_raw:
                collected["portfolio_holding_analysis"] = await analyze_portfolio_holding(
                    db, user_id, ticker_raw
                )
            else:
                return "=== MARKET DATA ===\nI couldn't determine which holding to analyze. Please specify the stock name (e.g. 'How is my Reliance holding performing?')."
            
        elif tool_name == "none":
            pass # No financial context needed

    except Exception as exc:
        logger.warning("Context engine error executing tool %s: %s", tool_name, exc)
        return "=== USER FINANCIAL DATA ===\nData temporarily unavailable."

    if not collected and tool_name != "none":
        # Fallback if the tool failed or wasn't matched properly
        return "=== USER FINANCIAL DATA ===\nNo specific data could be retrieved for this query."
        
    return _format_context(collected)
