/**
 * iOS の Universal Links：yotachat.app のリンクを、yota アプリで開いてよいと示す。
 * APPLE_TEAM_ID に、Apple Developer のチームID（10文字）を入れる。
 */
export function GET() {
  const team = process.env.APPLE_TEAM_ID;
  if (!team) return Response.json({ applinks: { details: [] } });
  return Response.json({
    applinks: { details: [{ appIDs: [`${team}.app.yotachat`], components: [{ "/": "/*" }] }] },
  });
}
