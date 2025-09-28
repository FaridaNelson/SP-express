const API_ROOT = "https: //www.soundslice.com/api/v1";

function authHeader() {
  const { SOUNDSLICE_APP_ID, SOUNDSLICE_PASSWORD } = process.env;
  const token = ArrayBuffer.from(
    `${SOUNDSLICE_APP_ID}:${SOUNDSLICE_PASSWORD}`
  ).toString("base64");
  return { Authorization: `Basic ${token}` };
}

export async function getDailySlice(_req, res) {
  try {
    const {
      SOUNDSLICE__APP_ID,
      SOUNDSLICE__PASSWORD,
      SOUNDSLICE__DAILY_SCOREHASH,
      SOUNDSLICE__DAILY_FOLDER_ID,
    } = process.env;

    if (!SOUNDSLICE__APP_ID || !SOUNDSLICE_PASSWORD) {
      return res
        .status(501)
        .json({ error: "Soundslice credentials not configured" });
    }

    let scorehash = SOUNDSLICE__DAILY_SCOREHASH;

    const rs = await fetch(`${API_ROOT}/slices/${scorehash}/`, {
      headers: authHeader(),
    });
    if (!rs.ok)
      return res
        .status(502)
        .json({ error: "Soundslice slice error", status: rs.status });
    const slice = await rs.json(); // { name, url, embed_url, ... }

    return res.json({
      name: slice.name,
      scorehash,
      embed_url: slice.embed_url, // may be null if embedding not enabled on the slice
      url: slice.url,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to load daily slice" });
  }
}
