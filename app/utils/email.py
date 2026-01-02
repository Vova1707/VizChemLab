import aiosmtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings

async def send_verification_email(email_to: str, token: str):
    message = MIMEMultipart("alternative")
    message["Subject"] = "Подтвердите регистрацию"
    message["From"] = settings.SMTP_USER
    message["To"] = email_to

    link = f"http://localhost:{settings.FRONTEND_PORT}/verify-email?token={token}"
    html = f"""
    <html>
      <body>
        <p>Здравствуйте!</p>
        <p>Пожалуйста, подтвердите ваш email:</p>
        <a href="{link}" style="display:inline-block; padding:10px 20px; background:#007bff; color:white; text-decoration:none; border-radius:4px;">Подтвердить</a>
      </body>
    </html>
    """
    message.attach(MIMEText(html, "html", "utf-8"))

    smtp_password = settings.SMTP_PASSWORD.get_secret_value()
    
    # Создаем контекст SSL, который игнорирует проверку сертификатов (для исправления ошибки CERTIFICATE_VERIFY_FAILED)
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
        print(f"Failed to send email: {e}")


async def send_reset_password_email(email_to: str, token: str):
    message = MIMEMultipart("alternative")
    message["Subject"] = "Сброс пароля"
    message["From"] = settings.SMTP_USER
    message["To"] = email_to

    link = f"http://{str(settings.SERVER_HOST)}:{int(settings.SERVER_PORT)}/reset-password?token={token}"
    html = f"""
    <html>
      <body>
        <p>Вы запросили сброс пароля.</p>
        <p>Нажмите кнопку ниже, чтобы задать новый пароль:</p>
        <a href="{link}" style="display:inline-block; padding:10px 20px; background:#dc3545; color:white; text-decoration:none; border-radius:4px;">Сбросить пароль</a>
        <p>Ссылка действительна 1 час.</p>
        <p>Если вы не запрашивали сброс — просто проигнорируйте это письмо.</p>
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
        print(f"Failed to send email: {e}")