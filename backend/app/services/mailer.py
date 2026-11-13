"""Plain SMTP sender. Works with Hostinger mailboxes (smtp.hostinger.com, SSL 465)."""

from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

from app.core.config import settings

log = logging.getLogger(__name__)


def send_email(to: str, subject: str, text: str, html: str | None = None) -> bool:
    if not settings.smtp_enabled:
        log.warning("SMTP not configured; email to %s not sent", to)
        return False

    user = settings.smtp_user.strip()
    password = settings.smtp_password.strip().strip('"').strip("'")
    # Hostinger rejects mail whose From differs from the authenticated mailbox.
    sender = (settings.smtp_from or "").strip() or user
    if sender.split("@")[-1].lower() != user.split("@")[-1].lower():
        sender = user

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((settings.smtp_from_name, sender))
    msg["Reply-To"] = sender
    msg["To"] = to
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")

    attempts = [settings.smtp_port] + [p for p in (465, 587) if p != settings.smtp_port]
    context = ssl.create_default_context()
    for port in attempts:
        try:
            if port == 465:
                with smtplib.SMTP_SSL(settings.smtp_host, port, context=context, timeout=20) as smtp:
                    smtp.login(user, password)
                    smtp.send_message(msg, from_addr=user)
            else:
                with smtplib.SMTP(settings.smtp_host, port, timeout=20) as smtp:
                    smtp.starttls(context=context)
                    smtp.login(user, password)
                    smtp.send_message(msg, from_addr=user)
            log.info("SMTP sent to %s via port %s", to, port)
            return True
        except smtplib.SMTPAuthenticationError as exc:
            log.error("SMTP login failed for %s: %s — check SMTP_USER / SMTP_PASSWORD", user, exc)
            return False
        except (smtplib.SMTPException, OSError) as exc:
            log.error("SMTP send to %s via port %s failed: %s", to, port, exc)
    return False


def notify_password_issued(user_email: str, name: str, password: str, reason: str, also: list[str] | None = None) -> bool:
    """Email the password to the person, and a copy to the admin mailbox."""
    login = settings.crm_public_url.rstrip("/")
    who = name or "there"
    text = (
        f"Hi {who},\n\n"
        f"Your RupeeOne password is ready.\n\n"
        f"Email: {user_email}\n"
        f"Password: {password}\n\n"
        f"Sign in at {login}\n\n"
        "— RupeeDial"
    )
    html = f"""\
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#2d2340">
  <h2 style="color:#10662A;margin-bottom:4px">Your RupeeOne password</h2>
  <p>Hi {who},</p>
  <p>Use this login at <a href="{login}">{login}</a>.</p>
  <p style="background:#f4fbf6;border:1px solid #d8ecdd;border-radius:12px;padding:14px 16px">
    <strong>Email</strong><br>{user_email}<br><br>
    <strong>Password</strong><br>{password}
  </p>
  <p style="font-size:12px;color:#94a3b8;margin-top:28px">RupeeDial · crm.rupeedial.com</p>
</div>"""
    sent = send_email(user_email, "Your RupeeOne password", text, html)
    seen = {user_email.strip().lower()}
    copies: list[str] = []
    admin = (settings.admin_email or "").strip()
    if admin:
        copies.append(admin)
    for item in also or []:
        if item and item.strip():
            copies.append(item.strip())
    note = (
        f"{who} ({user_email}) has a new RupeeOne password.\n"
        f"Reason: {reason}\n"
        f"Password: {password}\n"
    )
    for target in copies:
        key = target.lower()
        if key in seen:
            continue
        seen.add(key)
        send_email(target, f"Password for {who}", note)
    return sent


def send_password_reset(to: str, name: str, link: str) -> bool:
    minutes = settings.password_reset_minutes
    text = (
        f"Hi {name},\n\n"
        f"We received a request to reset your RupeeOne password.\n"
        f"Open this link to set a new password (valid for {minutes} minutes, one use only):\n\n"
        f"{link}\n\n"
        "If you did not ask for this, ignore this email. Your password stays the same.\n\n"
        "— RupeeDial"
    )
    html = f"""\
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#2d2340">
  <h2 style="color:#10662A;margin-bottom:4px">Reset your password</h2>
  <p>Hi {name},</p>
  <p>We received a request to reset your RupeeOne password. This link works once and expires in {minutes} minutes.</p>
  <p style="margin:28px 0">
    <a href="{link}" style="background:#10662A;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Set a new password</a>
  </p>
  <p style="font-size:13px;color:#5c4d72">If the button doesn't work, copy this link:<br><span style="word-break:break-all">{link}</span></p>
  <p style="font-size:13px;color:#5c4d72">Didn't ask for this? Ignore this email — your password stays the same.</p>
  <p style="font-size:12px;color:#94a3b8;margin-top:28px">RupeeDial · crm.rupeedial.com</p>
</div>"""
    return send_email(to, "Reset your RupeeOne password", text, html)
