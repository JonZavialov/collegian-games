const { Client } = require("pg");
const crypto = require("crypto");

const QUIZ_SLUG = "beat-the-editor";
const SESSION_COOKIE = "quiz_admin_session";
const MAX_VERSIONS = 50;

const getClientIp = (event) => {
  const forwarded = event.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return (
    event.headers["x-nf-client-connection-ip"] ||
    event.headers["client-ip"] ||
    "unknown"
  );
};

const parseCookies = (cookieHeader = "") =>
  cookieHeader.split(";").reduce((acc, part) => {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const ensureVersionsTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS quiz_config_versions (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL,
      data JSONB NOT NULL,
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ,
      versioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS quiz_config_versions_slug_versioned_idx
    ON quiz_config_versions (slug, versioned_at DESC);
  `);
};

exports.handler = async (event) => {
  const client = new Client({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    const cookies = parseCookies(event.headers.cookie || "");
    const token = cookies[SESSION_COOKIE];
    const clientIp = getClientIp(event);

    if (!token) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: "Admin session required." }),
      };
    }

    const tokenHash = hashToken(token);
    const sessionResult = await client.query(
      `
      SELECT token_hash
      FROM quiz_admin_sessions
      WHERE token_hash = $1
        AND ip_address = $2
        AND expires_at > NOW()
      `,
      [tokenHash, clientIp]
    );

    if (sessionResult.rows.length === 0) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: "Admin session required." }),
      };
    }

    await ensureVersionsTable(client);

    const versionsResult = await client.query(
      `
      SELECT id, slug, published_at, created_at, versioned_at
      FROM quiz_config_versions
      WHERE slug = $1
      ORDER BY versioned_at DESC
      LIMIT $2
      `,
      [QUIZ_SLUG, MAX_VERSIONS]
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ versions: versionsResult.rows }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message }),
    };
  } finally {
    await client.end();
  }
};
