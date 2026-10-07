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


def send_password_reset(to: str, name: str, link: str) -> bool:
    minutes = settings.password_reset_minutes
    text = (
        f"Hi {name},\n\n"
        f"We received a request to reset your RupeeDial One password.\n"
        f"Open this link to set a new password (valid for {minutes} minutes, one use only):\n\n"
        f"{link}\n\n"
        "If you did not ask for this, ignore this email. Your password stays the same.\n\n"
        "— RupeeDial"
    )
    html = f"""\
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#2d2340">
  <h2 style="color:#10662A;margin-bottom:4px">Reset your password</h2>
  <p>Hi {name},</p>
  <p>We received a request to reset your RupeeDial One password. This link works once and expires in {minutes} minutes.</p>
  <p style="margin:28px 0">
    <a href="{link}" style="background:#10662A;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Set a new password</a>
  </p>
  <p style="font-size:13px;color:#5c4d72">If the button doesn't work, copy this link:<br><span style="word-break:break-all">{link}</span></p>
  <p style="font-size:13px;color:#5c4d72">Didn't ask for this? Ignore this email — your password stays the same.</p>
  <p style="font-size:12px;color:#94a3b8;margin-top:28px">RupeeDial · crm.rupeedial.com</p>
</div>"""
    return send_email(to, "Reset your RupeeDial One password", text, html)
