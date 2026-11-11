import { collect } from "../../lib/collect.js";

// GET /api/info : サーバー側で取得できた情報をJSONで返す
export async function onRequestGet({ request }) {
  return new Response(JSON.stringify(collect(request), null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
