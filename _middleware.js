function parseCookies(cookieHeader) {
  const cookies = {};
  (cookieHeader || "").split(";").forEach((part) => {
    const index = part.indexOf("=");
    if (index === -1) return;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = value;
  });
  return cookies;
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function expectedAdminToken(env) {
  return sha256(`${env.ADMIN_PASSWORD || ""}|${env.ADMIN_SESSION_SECRET || ""}`);
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const cookies = parseCookies(request.headers.get("Cookie"));

  const isAdminPage =
    pathname.startsWith("/admin") &&
    !pathname.startsWith("/admin/login");

  const isAdminApi =
    pathname.startsWith("/api/leads") ||
    pathname.startsWith("/api/notes") ||
    pathname.startsWith("/api/reminders") ||
    pathname.startsWith("/api/bookings") ||
    pathname.startsWith("/api/projects") ||
    pathname.startsWith("/api/messages") ||
    pathname.startsWith("/api/invoices") ||
    pathname.startsWith("/api/stripe/create-checkout-session") ||
    pathname.startsWith("/api/client/create-account") ||
    pathname.startsWith("/api/client/send-invite") ||
    pathname.startsWith("/api/client/send-update");

  const isClientPage =
    pathname === "/client/portal.html";

  const isClientApi =
    pathname.startsWith("/api/client/me") ||
    pathname.startsWith("/api/client/change-password") ||
    pathname.startsWith("/api/client/reply");

  const isFileUploadRoute =
    pathname.startsWith("/api/files/upload") ||
    pathname.startsWith("/api/files/by-lead") ||
    pathname.startsWith("/files/");

  // Let file routes handle their own logic
  if (isFileUploadRoute) {
    return next();
  }

  if (isAdminPage || isAdminApi) {
    const adminToken = cookies.bb_admin_session;
    const validAdminToken = await expectedAdminToken(env);
    const adminAuthenticated = Boolean(
      adminToken &&
      validAdminToken &&
      adminToken === validAdminToken
    );

    if (!adminAuthenticated) {
      if (isAdminApi) {
        return new Response(
          JSON.stringify({ ok: false, error: "Unauthorized" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      return Response.redirect(`${url.origin}/admin/login.html`, 302);
    }
  }

  if (isClientPage || isClientApi) {
    const clientToken = cookies.bb_client_session;
    const clientLeadId = cookies.bb_client_lead_id;

    if (!clientToken || !clientLeadId) {
      if (isClientApi) {
        return new Response(
          JSON.stringify({ ok: false, error: "Unauthorized" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      return Response.redirect(`${url.origin}/client/login.html`, 302);
    }
  }

  return next();
}