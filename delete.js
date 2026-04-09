function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const formData = await request.formData();

    const fileId = (formData.get("fileId") || "").toString().trim();

    if (!fileId) {
      return json({ ok: false, error: "Missing file ID." }, 400);
    }

    const existing = await env.DB.prepare(`
      SELECT *
      FROM project_files
      WHERE id = ?
      LIMIT 1
    `).bind(fileId).first();

    if (!existing) {
      return json({ ok: false, error: "File not found." }, 404);
    }

    if (existing.file_key) {
      await env.FILES_BUCKET.delete(existing.file_key);
    }

    await env.DB.prepare(`
      DELETE FROM project_files
      WHERE id = ?
    `).bind(fileId).run();

    return json({ ok: true, deleted: true });
  } catch (err) {
    return json(
      { ok: false, error: err instanceof Error ? err.message : "Delete failed." },
      500
    );
  }
}