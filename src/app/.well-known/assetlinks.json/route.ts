/**
 * Android の App Links：yotachat.app のリンクを、yota アプリで開いてよいと示す。
 * ANDROID_CERT_SHA256 に、Google Play の「アプリの署名鍵」の SHA-256 フィンガープリントを入れる（複数ならカンマ区切り）。
 */
export function GET() {
  const fingerprints = (process.env.ANDROID_CERT_SHA256 ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!fingerprints.length) return Response.json([]);
  return Response.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: "app.yotachat", sha256_cert_fingerprints: fingerprints },
    },
  ]);
}
