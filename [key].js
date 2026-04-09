export async function onRequestGet(context) {
  const { env, params } = context;

  const key = params.key;

  if (!key) {
    return new Response("Missing file key", { status: 400 });
  }

  const object = await env.FILES_BUCKET.get(key);

  if (!object) {
    return new Response("File not found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000");

  return new Response(object.body, {
    status: 200,
    headers
  });
}