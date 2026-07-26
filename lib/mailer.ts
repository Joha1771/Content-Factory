const RESEND_API = "https://api.resend.com/emails";
const FROM = `mvira <noreply@mvira.uz>`;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://mvira.uz";

async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not configured");

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Failed to send email");
  }
}

export async function sendPasswordResetEmail(email: string, token: string, locale = "ru") {
  const resetUrl = `${SITE_URL}/${locale}/auth/reset-password?token=${token}`;

  const subjects: Record<string, string> = {
    ru: "Сброс пароля — mvira",
    uz: "Parolni tiklash — mvira",
    en: "Password reset — mvira",
  };

  const bodies: Record<string, string> = {
    ru: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#f0ebe3">
        <div style="background:#2d1b4e;padding:32px;border-radius:2px;text-align:center;margin-bottom:32px">
          <span style="font-family:Georgia,serif;font-size:28px;font-weight:300;color:#f0ebe3;letter-spacing:4px">mv<span style="color:#c9847a">ira</span></span>
        </div>
        <h1 style="font-family:Georgia,serif;font-weight:300;font-size:28px;color:#2d1b4e;margin:0 0 16px">Сброс пароля</h1>
        <p style="color:rgba(45,27,78,0.65);font-size:15px;line-height:1.7;margin:0 0 32px">
          Мы получили запрос на сброс пароля для вашего аккаунта. Нажмите кнопку ниже чтобы создать новый пароль.
        </p>
        <a href="${resetUrl}" style="display:block;background:#2d1b4e;color:#f0ebe3;text-decoration:none;text-align:center;padding:14px 32px;border-radius:2px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:24px">
          Сбросить пароль
        </a>
        <p style="color:rgba(45,27,78,0.4);font-size:12px;line-height:1.6;margin:0">
          Ссылка действительна 1 час. Если вы не запрашивали сброс пароля — просто проигнорируйте это письмо.
        </p>
        <hr style="border:none;border-top:1px solid rgba(45,27,78,0.1);margin:24px 0">
        <p style="color:rgba(45,27,78,0.3);font-size:11px;text-align:center;margin:0">mvira.uz · AI Marketing Platform</p>
      </div>
    `,
    uz: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#f0ebe3">
        <div style="background:#2d1b4e;padding:32px;border-radius:2px;text-align:center;margin-bottom:32px">
          <span style="font-family:Georgia,serif;font-size:28px;font-weight:300;color:#f0ebe3;letter-spacing:4px">mv<span style="color:#c9847a">ira</span></span>
        </div>
        <h1 style="font-family:Georgia,serif;font-weight:300;font-size:28px;color:#2d1b4e;margin:0 0 16px">Parolni tiklash</h1>
        <p style="color:rgba(45,27,78,0.65);font-size:15px;line-height:1.7;margin:0 0 32px">
          Akkauntingiz uchun parolni tiklash so'rovi qabul qilindi. Yangi parol yaratish uchun quyidagi tugmani bosing.
        </p>
        <a href="${resetUrl}" style="display:block;background:#2d1b4e;color:#f0ebe3;text-decoration:none;text-align:center;padding:14px 32px;border-radius:2px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:24px">
          Parolni tiklash
        </a>
        <p style="color:rgba(45,27,78,0.4);font-size:12px;line-height:1.6;margin:0">
          Havola 1 soat davomida amal qiladi. Agar siz parolni tiklashni so'ramagan bo'lsangiz, ushbu xatni e'tiborsiz qoldiring.
        </p>
      </div>
    `,
    en: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#f0ebe3">
        <div style="background:#2d1b4e;padding:32px;border-radius:2px;text-align:center;margin-bottom:32px">
          <span style="font-family:Georgia,serif;font-size:28px;font-weight:300;color:#f0ebe3;letter-spacing:4px">mv<span style="color:#c9847a">ira</span></span>
        </div>
        <h1 style="font-family:Georgia,serif;font-weight:300;font-size:28px;color:#2d1b4e;margin:0 0 16px">Password Reset</h1>
        <p style="color:rgba(45,27,78,0.65);font-size:15px;line-height:1.7;margin:0 0 32px">
          We received a request to reset your account password. Click the button below to create a new password.
        </p>
        <a href="${resetUrl}" style="display:block;background:#2d1b4e;color:#f0ebe3;text-decoration:none;text-align:center;padding:14px 32px;border-radius:2px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:24px">
          Reset Password
        </a>
        <p style="color:rgba(45,27,78,0.4);font-size:12px;line-height:1.6;margin:0">
          This link is valid for 1 hour. If you didn't request a password reset, you can safely ignore this email.
        </p>
      </div>
    `,
  };

  await sendEmail(email, subjects[locale] ?? subjects.ru, bodies[locale] ?? bodies.ru);
}

export async function sendLeadNotificationEmail(
  ownerEmail: string,
  lead: { name?: string; phone?: string; email?: string; message?: string },
  landingTitle: string
) {
  const rows = [
    lead.name    ? `<tr><td style="padding:4px 0;color:rgba(45,27,78,0.5);font-size:13px;width:90px">Имя</td><td style="padding:4px 0;font-size:13px;color:#2d1b4e;font-weight:500">${lead.name}</td></tr>` : "",
    lead.phone   ? `<tr><td style="padding:4px 0;color:rgba(45,27,78,0.5);font-size:13px">Телефон</td><td style="padding:4px 0;font-size:13px;color:#2d1b4e;font-weight:500">${lead.phone}</td></tr>` : "",
    lead.email   ? `<tr><td style="padding:4px 0;color:rgba(45,27,78,0.5);font-size:13px">Email</td><td style="padding:4px 0;font-size:13px;color:#2d1b4e;font-weight:500">${lead.email}</td></tr>` : "",
    lead.message ? `<tr><td style="padding:4px 0;color:rgba(45,27,78,0.5);font-size:13px">Сообщение</td><td style="padding:4px 0;font-size:13px;color:#2d1b4e;font-weight:500">${lead.message}</td></tr>` : "",
  ].filter(Boolean).join("");

  const html = `
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#f0ebe3">
      <div style="background:#2d1b4e;padding:32px;border-radius:2px;text-align:center;margin-bottom:32px">
        <span style="font-family:Georgia,serif;font-size:28px;font-weight:300;color:#f0ebe3;letter-spacing:4px">mv<span style="color:#c9847a">ira</span></span>
      </div>
      <h1 style="font-family:Georgia,serif;font-weight:300;font-size:26px;color:#2d1b4e;margin:0 0 8px">Новая заявка</h1>
      <p style="color:rgba(45,27,78,0.5);font-size:13px;margin:0 0 24px">Лендинг: <strong style="color:#2d1b4e">${landingTitle}</strong></p>
      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:4px;padding:16px 20px;display:block;box-sizing:border-box">
        ${rows}
      </table>
      <hr style="border:none;border-top:1px solid rgba(45,27,78,0.1);margin:24px 0">
      <p style="color:rgba(45,27,78,0.3);font-size:11px;text-align:center;margin:0">mvira.uz · AI Marketing Platform</p>
    </div>
  `;

  await sendEmail(ownerEmail, `Новая заявка — ${landingTitle}`, html);
}

export async function sendInvitationEmail(
  email: string,
  workspaceName: string,
  inviterName: string,
  role: string,
  isExistingUser: boolean
) {
  const loginUrl = `${SITE_URL}/ru/auth/login`;
  const registerUrl = `${SITE_URL}/ru/auth/register`;
  const actionUrl = isExistingUser ? loginUrl : registerUrl;
  const actionLabel = isExistingUser ? "Войти в аккаунт" : "Зарегистрироваться";

  const html = `
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#f0ebe3">
      <div style="background:#2d1b4e;padding:32px;border-radius:2px;text-align:center;margin-bottom:32px">
        <span style="font-family:Georgia,serif;font-size:28px;font-weight:300;color:#f0ebe3;letter-spacing:4px">mv<span style="color:#c9847a">ira</span></span>
      </div>
      <h1 style="font-family:Georgia,serif;font-weight:300;font-size:28px;color:#2d1b4e;margin:0 0 16px">Приглашение в команду</h1>
      <p style="color:rgba(45,27,78,0.65);font-size:15px;line-height:1.7;margin:0 0 8px">
        <strong>${inviterName}</strong> приглашает вас в воркспейс <strong>${workspaceName}</strong> с ролью <strong>${role}</strong>.
      </p>
      <p style="color:rgba(45,27,78,0.65);font-size:15px;line-height:1.7;margin:0 0 32px">
        ${isExistingUser ? "Войдите в аккаунт чтобы начать работу." : "Создайте аккаунт чтобы принять приглашение."}
      </p>
      <a href="${actionUrl}" style="display:block;background:#2d1b4e;color:#f0ebe3;text-decoration:none;text-align:center;padding:14px 32px;border-radius:2px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:24px">
        ${actionLabel}
      </a>
      <hr style="border:none;border-top:1px solid rgba(45,27,78,0.1);margin:24px 0">
      <p style="color:rgba(45,27,78,0.3);font-size:11px;text-align:center;margin:0">mvira.uz · AI Marketing Platform</p>
    </div>
  `;

  await sendEmail(email, `Приглашение в ${workspaceName} — mvira`, html);
}
