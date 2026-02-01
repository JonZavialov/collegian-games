const { Client } = require("pg");
const crypto = require("crypto");

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;
const LOCK_MINUTES = 30;
const SESSION_TTL_HOURS = 8;
const SESSION_COOKIE = "quiz_admin_session";

// Use Netlify's trusted IP header (cannot be spoofed by clients)
const getClientIp = (event) => {
  // x-nf-client-connection-ip is set by Netlify and cannot be spoofed
  return (
    event.headers["x-nf-client-connection-ip"] ||
    event.headers["client-ip"] ||
    "unknown"
  );
};

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

// Constant-time string comparison to prevent timing attacks
const secureCompare = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) {
    // Still do a comparison to maintain constant time
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: "Method not allowed." }),
    };
  }

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
    const payload = JSON.parse(event.body || "{}");
    const { passcode } = payload;
    const expectedPasscode = process.env.QUIZ_ADMIN_PASSCODE;
    const clientIp = getClientIp(event);

    if (!expectedPasscode) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Server configuration error." }),
      };
    }

    await client.connect();

    // Check if currently locked out
    const attemptResult = await client.query(
      `SELECT locked_until FROM quiz_admin_attempts WHERE ip_address = $1`,
      [clientIp]
    );

    if (attemptResult.rows.length > 0) {
      const { locked_until: lockedUntil } = attemptResult.rows[0];
      if (lockedUntil && new Date(lockedUntil) > new Date()) {
        const remainingMs = new Date(lockedUntil) - new Date();
        const remainingMins = Math.ceil(remainingMs / 60000);
        return {
          statusCode: 429,
          body: JSON.stringify({
            message: `Too many attempts. Please try again in ${remainingMins} minute${remainingMins === 1 ? "" : "s"}.`,
          }),
        };
      }
    }

    // Use constant-time comparison to prevent timing attacks
    const isValidPasscode = passcode && secureCompare(passcode, expectedPasscode);

    if (!isValidPasscode) {
      // Record the failed attempt and get the new attempt count
      const updateResult = await client.query(
        `INSERT INTO quiz_admin_attempts (ip_address, attempts, first_attempt_at, last_attempt_at, locked_until)
         VALUES ($1, 1, NOW(), NOW(), NULL)
         ON CONFLICT (ip_address)
         DO UPDATE SET
           attempts = CASE
             WHEN quiz_admin_attempts.first_attempt_at IS NULL
               OR quiz_admin_attempts.first_attempt_at < NOW() - INTERVAL '1 minute' * $2
             THEN 1
             ELSE quiz_admin_attempts.attempts + 1
           END,
           first_attempt_at = CASE
             WHEN quiz_admin_attempts.first_attempt_at IS NULL
               OR quiz_admin_attempts.first_attempt_at < NOW() - INTERVAL '1 minute' * $2
             THEN NOW()
             ELSE quiz_admin_attempts.first_attempt_at
           END,
           last_attempt_at = NOW(),
           locked_until = CASE
             WHEN quiz_admin_attempts.first_attempt_at IS NOT NULL
               AND quiz_admin_attempts.first_attempt_at >= NOW() - INTERVAL '1 minute' * $2
               AND quiz_admin_attempts.attempts + 1 >= $3
             THEN NOW() + INTERVAL '1 minute' * $4
             ELSE quiz_admin_attempts.locked_until
           END
         RETURNING attempts, locked_until`,
        [clientIp, WINDOW_MINUTES, MAX_ATTEMPTS, LOCK_MINUTES]
      );

      const { attempts, locked_until: lockedUntil } = updateResult.rows[0];
      const attemptsRemaining = MAX_ATTEMPTS - attempts;

      if (lockedUntil) {
        return {
          statusCode: 429,
          body: JSON.stringify({
            message: `Too many attempts. Please try again in ${LOCK_MINUTES} minutes.`,
          }),
        };
      }

      return {
        statusCode: 401,
        body: JSON.stringify({
          message: `Invalid passcode. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} remaining.`,
        }),
      };
    }

    // Successful login - clear attempt counter
    await client.query(
      `DELETE FROM quiz_admin_attempts WHERE ip_address = $1`,
      [clientIp]
    );

    // Generate secure session token
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);

    // Clean up expired sessions and create new one
    await client.query(
      `DELETE FROM quiz_admin_sessions WHERE expires_at < NOW()`
    );

    await client.query(
      `INSERT INTO quiz_admin_sessions (token_hash, ip_address, created_at, expires_at)
       VALUES ($1, $2, NOW(), NOW() + INTERVAL '1 hour' * $3)`,
      [tokenHash, clientIp, SESSION_TTL_HOURS]
    );

    return {
      statusCode: 200,
      headers: {
        "Set-Cookie": `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_HOURS * 60 * 60}`,
      },
      body: JSON.stringify({ authenticated: true }),
    };
  } catch (error) {
    console.error("Login error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "An error occurred." }),
    };
  } finally {
    await client.end();
  }
};
