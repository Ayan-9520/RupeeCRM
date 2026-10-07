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

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((settings.smtp_from_name, settings.smtp_from or settings.smtp_user))
    msg["To"] = to
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")

    context = ssl.create_default_context()
    try:
        if settings.smtp_port == 465:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=context, timeout=20) as smtp:
                smtp.login(settings.smtp_user, settings.smtp_password)
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
                smtp.starttls(context=context)
                smtp.login(settings.smtp_user, settings.smtp_password)
                smtp.send_message(msg)
    except (smtplib.SMTPException, OSError) as exc:
        log.error("SMTP send to %s failed: %s", to, exc)
        return False
    return True


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
