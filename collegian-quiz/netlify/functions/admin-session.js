const { Client } = require("pg");
const crypto = require("crypto");

const SESSION_COOKIE = "quiz_admin_session";

// Use Netlify's trusted IP header (cannot be spoofed by clients)
const getClientIp = (event) => {
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
    const cookies = parseCookies(event.headers.cookie || "");
    const token = cookies[SESSION_COOKIE];

    if (!token) {
      return {
        statusCode: 200,
        body: JSON.stringify({ authenticated: false }),
      };
    }

    const tokenHash = hashToken(token);
    const clientIp = getClientIp(event);

    await client.connect();

    const result = await client.query(
      `
      SELECT token_hash
      FROM quiz_admin_sessions
      WHERE token_hash = $1
        AND ip_address = $2
        AND expires_at > NOW()
      `,
      [tokenHash, clientIp]
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ authenticated: result.rows.length > 0 }),
    };
  } catch (error) {
    console.error("Session check error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "An error occurred." }),
    };
  } finally {
    await client.end();
  }
};
