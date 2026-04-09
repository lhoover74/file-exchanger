function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendEmail(env, payload) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data?.message === "string" ? data.message : "Email send failed."
    );
  }

  return data;
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const formData = await request.formData();

    const leadId = (formData.get("leadId") || "").toString().trim();
    const fileName = (formData.get("fileName") || "").toString().trim();
    const uploadedBy = (formData.get("uploadedBy") || "").toString().trim();

    if (!leadId || !fileName || !uploadedBy) {
      return json({ ok: false, error: "Missing required fields." }, 400);
    }

    const lead = await env.DB.prepare(`
      SELECT *
      FROM leads
      WHERE id = ?
      LIMIT 1
    `).bind(leadId).first();

    if (!lead) {
      return json({ ok: false, error: "Lead not found." }, 404);
    }

    const isClientUpload = uploadedBy === "client";

    const toEmail = isClientUpload
      ? (env.ADMIN_NOTIFY_EMAIL || "michael@govdirect.org")
      : lead.email;

    const subject = isClientUpload
      ? `New client upload from ${lead.name || "Client"}`
      : `New project file uploaded for ${lead.name || "your project"}`;

    const heading = isClientUpload
      ? "A new client file was uploaded"
      : "A new project file is ready";

    const intro = isClientUpload
      ? `${escapeHtml(lead.name || "A client")} uploaded a new file to the project portal.`
      : `A new file has been uploaded to your Books and Brews project workspace.`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <body style="margin:0;padding:0;background:#0b0b0c;font-family:Arial,sans-serif;">
        <div style="max-width:680px;margin:0 auto;padding:32px 16px;">
          <div style="background:#f4f0eb;border:1px solid #ddd3ca;border-radius:22px;overflow:hidden;">
            <div style="padding:28px 28px 22px;background:
              radial-gradient(circle at top right, rgba(199,144,88,.12), transparent 28%),
              linear-gradient(180deg,#f7f4ef,#f1ece6);
              border-bottom:1px solid #ddd3ca;">
              <div style="font-size:12px;letter-spacing:4px;text-transform:uppercase;color:#7b6a5f;margin-bottom:12px;">
                Books and Brews
              </div>
              <h1 style="margin:0;font-size:34px;line-height:1.08;color:#3b302b;font-family:Georgia,serif;">
                ${heading}
              </h1>
              <p style="margin:14px 0 0;font-size:15px;line-height:1.8;color:#6f6258;">
                ${intro}
              </p>
            </div>

            <div style="padding:28px;">
              <div style="padding:18px;background:#efe9e3;border:1px solid #d7c8bb;border-radius:16px;">
                <p style="margin:0 0 10px;font-size:15px;line-height:1.8;color:#4f443d;">
                  <strong>Client:</strong> ${escapeHtml(lead.name || "—")}
                </p>
                <p style="margin:0 0 10px;font-size:15px;line-height:1.8;color:#4f443d;">
                  <strong>Email:</strong> ${escapeHtml(lead.email || "—")}
                </p>
                <p style="margin:0;font-size:15px;line-height:1.8;color:#4f443d;">
                  <strong>File:</strong> ${escapeHtml(fileName)}
                </p>
              </div>

              <p style="margin:22px 0 0;font-size:14px;line-height:1.8;color:#7a6c62;">
                Sign in to the portal or admin dashboard to view the file.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail(env, {
      from: "Books and Brews <quotes@booksnbrew.govdirect.org>",
      to: [toEmail],
      subject,
      html,
      replyTo: "michael@govdirect.org"
    });

    return json({ ok: true, notified: true });
  } catch (err) {
    return json(
      { ok: false, error: err instanceof Error ? err.message : "Notification failed." },
      500
    );
  }
}