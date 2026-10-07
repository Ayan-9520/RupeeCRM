"""Local smoke test for learn, admin overview and change-password endpoints."""

import json
import pathlib
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000"
env = {
    k.strip(): v.strip().strip('"')
    for k, v in (
        line.split("=", 1)
        for line in pathlib.Path("backend/.env").read_text(encoding="utf-8-sig").splitlines()
        if "=" in line and not line.lstrip().startswith("#")
    )
}


def call(method, path, body=None, token=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


email, pw = env["ADMIN_EMAIL"].strip(), env["ADMIN_PASSWORD"].strip()
s, tok = call("POST", "/api/auth/login", {"email": email, "password": pw})
print("login", s)
token = tok["access_token"]

s, q = call("GET", "/api/learn/quizzes/personal-loan-pro", token=token)
print("quiz", s, len(q["questions"]), "questions; answer leaked:", any("correct_index" in x for x in q["questions"]))

s, r = call("POST", "/api/learn/quizzes/personal-loan-pro/submit", {"answers": [0] * 10}, token=token)
print("fail attempt", s, r["score_percent"], r["passed"], r["points_awarded"])

answers = [2, 2, 0, 1, 2, 1, 2, 1, 1, 1]
s, r = call("POST", "/api/learn/quizzes/personal-loan-pro/submit", {"answers": answers}, token=token)
print("pass attempt", s, r["score_percent"], r["passed"], r["points_awarded"], r["certificate"]["certificate_no"] if r["certificate"] else None)

s, r = call("POST", "/api/learn/quizzes/personal-loan-pro/submit", {"answers": answers}, token=token)
print("repeat pass gives points again:", r["points_awarded"])

s, r = call("POST", "/api/learn/quizzes/personal-loan-pro/submit", {"answers": [1, 2]}, token=token)
print("short answers", s, r.get("detail"))

s, c = call("GET", "/api/learn/certificates", token=token)
print("certificates", s, len(c["items"]), "points", c["total_points"], "available", len(c["available"]))

s, o = call("GET", "/api/admin/overview", token=token)
print("overview", s, o["kpis"], "days", len(o["daily"]), "top", len(o["top_performers"]))

s, r = call("POST", "/api/auth/change-password", {"current_password": "wrong", "new_password": "NewPass123!"}, token=token)
print("change pw wrong current", s, r.get("detail"))
s, r = call("POST", "/api/auth/change-password", {"current_password": pw, "new_password": "short"}, token=token)
print("change pw too short", s)
s, r = call("GET", "/api/admin/overview")
print("overview no auth", s)

s, b = call("GET", "/api/billing/admin/subscriptions", token=token)
print("subscriptions", s, len(b["items"]), "active", b["active_count"], "plans", [p["id"] for p in b["plans"]])
s, r = call("POST", "/api/billing/admin/wallet-credit", {"user_id": "00000000-0000-0000-0000-000000000000", "amount": 100}, token=token)
print("wallet credit unknown user", s, r.get("detail"))
s, r = call("POST", "/api/billing/admin/wallet-credit", {"user_id": "00000000-0000-0000-0000-000000000000", "amount": -5}, token=token)
print("wallet credit negative", s)
s, r = call("POST", "/api/billing/admin/activate", {"user_id": "00000000-0000-0000-0000-000000000000", "plan_id": "x", "cycle": "monthly"})
print("admin activate no auth", s)
s, r = call("POST", "/api/billing/activate", {"plan_id": "nope", "cycle": "monthly"}, token=token)
print("admin self-activate unknown plan", s, r.get("detail"))

partner = env.get("SMOKE_PARTNER_EMAIL"), env.get("SMOKE_PARTNER_PASSWORD")
if all(partner):
    s, pt = call("POST", "/api/auth/login", {"email": partner[0], "password": partner[1]})
    s, r = call("POST", "/api/billing/activate", {"plan_id": b["plans"][0]["id"], "cycle": "monthly"}, token=pt["access_token"])
    print("partner self-activate blocked", s, r.get("detail"))
    s, r = call("GET", "/api/billing/admin/subscriptions", token=pt["access_token"])
    print("partner admin list blocked", s)
