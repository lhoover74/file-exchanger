function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function parseCookies(cookieHeader) {
  const cookies = {};
  (cookieHeader || "").split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i === -1) return;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (key) cookies[key] = value;
  });
  return cookies;
}

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);

    let leadId = url.searchParams.get("leadId");

    if (!leadId) {
      const cookies = parseCookies(request.headers.get("Cookie"));
      leadId = cookies.bb_client_lead_id || "";
    }

    if (!leadId) {
      return json({ ok: false, error: "Missing lead ID." }, 400);
    }

    const result = await env.DB.prepare(`
      SELECT *
      FROM project_files
      WHERE lead_id = ?
      ORDER BY created_at DESC, id DESC
    `).bind(leadId).all();

    return json({
      ok: true,
      files: result.results || []
    });
  } catch (err) {
    return json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to load files." },
      500
    );
  }
}