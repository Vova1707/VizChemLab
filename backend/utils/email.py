import aiosmtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from core.config import settings
import logging

logger = logging.getLogger(__name__)

async def send_reset_password_email(email_to: str, token: str):
    message = MIMEMultipart("alternative")
    message["Subject"] = "Password Reset"
    message["From"] = settings.SMTP_USER
    message["To"] = email_to

    link = f"http://{str(settings.SERVER_HOST)}:{int(settings.SERVER_PORT)}/reset-password?token={token}"
    html = f"""
    <html>
      <body>
        <p>You requested a password reset.</p>
        <p>Click the button below to set a new password:</p>
        <a href="{link}" style="display:inline-block; padding:10px 20px; background:#dc3545; color:white; text-decoration:none; border-radius:4px;">Reset Password</a>
        <p>Link is valid for 1 hour.</p>
        <p>If you didn't request a reset - just ignore this email.</p>
      </body>
    </html>
    """
    message.attach(MIMEText(html, "html", "utf-8"))

    smtp_password = settings.SMTP_PASSWORD.get_secret_value()
    
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=smtp_password,
            use_tls=True,
            timeout=15,
            tls_context=context,
        )
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
