const API_ROOT = "https://www.soundslice.com/api/v1";

function authHeader() {
  const { SOUNDSLICE_APP_ID, SOUNDSLICE_PASSWORD } = process.env;
  const token = Buffer.from(
    `${SOUNDSLICE_APP_ID}:${SOUNDSLICE_PASSWORD}`
  ).toString("base64");
  return { Authorization: `Basic ${token}`, Accept: "application/json" };
}

function ensureCreds() {
  const { SOUNDSLICE_APP_ID, SOUNDSLICE_PASSWORD } = process.env;
  if (!SOUNDSLICE_APP_ID || !SOUNDSLICE_PASSWORD) {
    const err = new Error("Soundslice credentials not configured");
    err.status = 501;
    throw err;
  }
}

/** GET /api/soundslice  → list all slices (for quick credential checks) */
export async function listSlices(_req, res) {
  try {
    ensureCreds();
    const rs = await fetch(`${API_ROOT}/slices/`, { headers: authHeader() });
    if (!rs.ok) {
      const body = await rs.text().catch(() => "");
      return res
        .status(502)
        .json({
          error: "Soundslice API error",
          status: rs.status,
          body: body.slice(0, 300),
        });
    }
    const data = await rs.json();
    return res.json({ slices: data });
  } catch (e) {
    return res
      .status(e.status || 500)
      .json({ error: e.message || "Failed to list slices" });
  }
}

/** GET /api/soundslice/:id  → get a single slice by scorehash */
export async function getSlice(req, res) {
  try {
    ensureCreds();
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "Missing slice id" });
    const rs = await fetch(`${API_ROOT}/slices/${id}/`, {
      headers: authHeader(),
    });
    if (!rs.ok) {
      const body = await rs.text().catch(() => "");
      return res
        .status(502)
        .json({
          error: "Soundslice API error",
          status: rs.status,
          body: body.slice(0, 300),
        });
    }
    const slice = await rs.json();
    return res.json({ slice });
  } catch (e) {
    return res
      .status(e.status || 500)
      .json({ error: e.message || "Failed to get slice" });
  }
}

/** POST /api/soundslice  → create a slice (metadata only)
 *  Body: { name?, artist?, status?, embed_status?, print_status?, folder_id? }
 *  NOTE: Soundslice expects POST "parameters" — use form encoding.
 */
export async function createSlice(req, res) {
  try {
    ensureCreds();
    const { name, artist, status, embed_status, print_status, folder_id } =
      req.body || {};
    const form = new URLSearchParams();
    if (name) form.set("name", name);
    if (artist) form.set("artist", artist);
    if (status != null) form.set("status", String(status)); // 1=secret disabled, 3=secret enabled
    if (embed_status != null) form.set("embed_status", String(embed_status)); // 1=disabled, 2=all domains (some accounts), 4=allowlist
    if (print_status != null) form.set("print_status", String(print_status)); // per docs: default disabled; "allowed" value per your account docs
    if (folder_id) form.set("folder_id", String(folder_id));

    const rs = await fetch(`${API_ROOT}/slices/`, {
      method: "POST",
      headers: {
        ...authHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const text = await rs.text();
    if (!rs.ok) {
      return res
        .status(502)
        .json({
          error: "Soundslice API error",
          status: rs.status,
          body: text.slice(0, 300),
        });
    }
    const slice = JSON.parse(text);
    return res.status(201).json({ slice });
  } catch (e) {
    return res
      .status(e.status || 500)
      .json({ error: e.message || "Failed to create slice" });
  }
}

export async function getDailySlice(_req, res) {
  try {
    const {
      SOUNDSLICE_APP_ID,
      SOUNDSLICE_PASSWORD,
      SOUNDSLICE_DAILY_SCOREHASH,
      SOUNDSLICE_ALLOW_STUB,
    } = process.env;

    if (
      !SOUNDSLICE_APP_ID ||
      !SOUNDSLICE_PASSWORD ||
      !SOUNDSLICE_DAILY_SCOREHASH
    ) {
      if (SOUNDSLICE_ALLOW_STUB === "1") {
        return res.json({
          slice: {
            id: "demo123",
            title: "Daily Sight-Reading (demo)",
            url: "https://www.soundslice.com",
            embed_url: null,
          },
        });
      }
      return res
        .status(501)
        .json({ error: "Soundslice credentials not configured" });
    }

    const scorehash = SOUNDSLICE_DAILY_SCOREHASH.trim();
    const rs = await fetch(`${API_ROOT}/slices/${scorehash}/`, {
      headers: authHeader(),
    });
    if (!rs.ok) {
      const body = await rs.text().catch(() => "");
      return res.status(502).json({
        error: "Soundslice API error",
        status: rs.status,
        body: body.slice(0, 200),
      });
    }
    const slice = await rs.json();
    return res.json({
      slice: {
        id: slice.slug || slice.scorehash || scorehash,
        title: slice.name,
        url: slice.url,
        embed_url: slice.embed_url,
      },
    });
  } catch (err) {
    console.error("[soundslice]", err);
    return res.status(500).json({ error: "Failed to load daily slice" });
  }
}
