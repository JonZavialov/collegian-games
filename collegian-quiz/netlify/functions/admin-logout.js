const { Client } = require("pg");
const crypto = require("crypto");

const SESSION_COOKIE = "quiz_admin_session";

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

    if (token) {
      await client.connect();
      const tokenHash = hashToken(token);
      await client.query(
        `
        DELETE FROM quiz_admin_sessions
        WHERE token_hash = $1
        `,
        [tokenHash]
      );
    }

    return {
      statusCode: 200,
      headers: {
        "Set-Cookie": `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`,
      },
      body: JSON.stringify({ authenticated: false }),
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
