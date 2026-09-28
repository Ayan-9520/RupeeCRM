"""Locked partner plans & lead category prices (Phase 0)."""

from __future__ import annotations

# Monthly base prices (INR). Quarterly = −10%, Yearly = −20%.
PLANS: dict[str, dict] = {
    "starter": {
        "name": "Starter",
        "monthly": 999,
        "seats": 1,
        "lead_credits_monthly": 999,
        "modules": {
            "leadboard": True,
            "my_leads": True,
            "marketing_basic": True,
            "marketing_full": False,
            "visiting_card": True,
            "card_per_seat": False,
            "public_profile": False,
            "directory_featured": False,
            "hrms_soft": False,
            "hrms_full": False,
            "team_assign": False,
            "payouts": True,
        },
    },
    "growth": {
        "name": "Growth",
        "monthly": 2999,
        "seats": 3,
        "lead_credits_monthly": 2500,
        "modules": {
            "leadboard": True,
            "my_leads": True,
            "marketing_basic": True,
            "marketing_full": True,
            "visiting_card": True,
            "card_per_seat": True,
            "public_profile": True,
            "directory_featured": False,
            "hrms_soft": True,
            "hrms_full": False,
            "team_assign": True,
            "payouts": True,
        },
    },
    "pro": {
        "name": "Pro Team",
        "monthly": 7999,
        "seats": 10,
        "lead_credits_monthly": 7000,
        "modules": {
            "leadboard": True,
            "my_leads": True,
            "marketing_basic": True,
            "marketing_full": True,
            "visiting_card": True,
            "card_per_seat": True,
            "public_profile": True,
            "directory_featured": True,
            "hrms_soft": True,
            "hrms_full": True,
            "team_assign": True,
            "payouts": True,
        },
    },
}

# Default marketplace lead price by product_category
CATEGORY_LEAD_PRICES: dict[str, float] = {
    "loan": 149,
    "insurance": 149,
    "credit_card": 79,
    "investment": 129,
}

ACTIVATION_FEE = 999
RECHARGE_MIN = 500
PAYOUT_MIN = 1000


def cycle_price(monthly: int, cycle: str) -> int:
    if cycle == "quarterly":
        return int(round(monthly * 3 * 0.9))
    if cycle == "yearly":
        return int(round(monthly * 12 * 0.8))
    return monthly


def default_lead_price(category: str | None) -> float:
    key = (category or "loan").strip().lower()
    return float(CATEGORY_LEAD_PRICES.get(key, CATEGORY_LEAD_PRICES["loan"]))
