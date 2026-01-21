const { Client } = require("pg");
const crypto = require("crypto");

const QUIZ_SLUG = "beat-the-editor";
const SESSION_COOKIE = "quiz_admin_session";

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
    const payload = JSON.parse(event.body || "{}");
    const versionId = Number(payload.versionId);
    const cookies = parseCookies(event.headers.cookie || "");
    const token = cookies[SESSION_COOKIE];
    const clientIp = getClientIp(event);

    if (!Number.isInteger(versionId) || versionId <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "versionId must be a positive integer." }),
      };
    }

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
    await client.query("BEGIN");

    const versionResult = await client.query(
      `
      SELECT data
      FROM quiz_config_versions
      WHERE id = $1
        AND slug = $2
      `,
      [versionId, QUIZ_SLUG]
    );

    if (versionResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Version not found." }),
      };
    }

    const currentResult = await client.query(
      `
      SELECT data, published_at, created_at
      FROM quiz_configs
      WHERE slug = $1
      `,
      [QUIZ_SLUG]
    );

    if (currentResult.rows.length > 0) {
      const current = currentResult.rows[0];
      await client.query(
        `
        INSERT INTO quiz_config_versions (slug, data, published_at, created_at)
        VALUES ($1, $2, $3, $4)
        `,
        [QUIZ_SLUG, current.data, current.published_at, current.created_at]
      );
    }

    const restoredData = versionResult.rows[0].data;
    const restoreResult = await client.query(
      `
      INSERT INTO quiz_configs (slug, data, published_at, created_at, updated_at)
      VALUES ($1, $2, NOW(), NOW(), NOW())
      ON CONFLICT (slug)
      DO UPDATE SET
        data = EXCLUDED.data,
        published_at = EXCLUDED.published_at,
        updated_at = NOW()
      RETURNING data
      `,
      [QUIZ_SLUG, restoredData]
    );

    await client.query("COMMIT");

    return {
      statusCode: 200,
      body: JSON.stringify({ data: restoreResult.rows[0].data }),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message }),
    };
  } finally {
    await client.end();
  }
};
