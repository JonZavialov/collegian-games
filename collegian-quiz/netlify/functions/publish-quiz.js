const { Client } = require("pg");

const QUIZ_SLUG = "beat-the-editor";
const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;
const LOCK_MINUTES = 30;

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
    const payload = JSON.parse(event.body || "{}");
    const { passcode, quiz } = payload;
    const expectedPasscode = process.env.QUIZ_ADMIN_PASSCODE;
    const clientIp = getClientIp(event);

    if (!expectedPasscode) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Server is missing admin passcode." }),
      };
    }

    if (!quiz) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Quiz payload is required." }),
      };
    }

    await client.connect();

    const attemptResult = await client.query(
      `
      SELECT attempts, first_attempt_at, locked_until
      FROM quiz_admin_attempts
      WHERE ip_address = $1
      `,
      [clientIp]
    );

    if (attemptResult.rows.length > 0) {
      const { locked_until: lockedUntil } = attemptResult.rows[0];
      if (lockedUntil && new Date(lockedUntil) > new Date()) {
        return {
          statusCode: 429,
          body: JSON.stringify({
            message: "Too many attempts. Please try again later.",
          }),
        };
      }
    }

    if (!passcode || passcode !== expectedPasscode) {
      const now = new Date();
      await client.query(
        `
        INSERT INTO quiz_admin_attempts (ip_address, attempts, first_attempt_at, last_attempt_at, locked_until)
        VALUES ($1, 1, $2, $2, NULL)
        ON CONFLICT (ip_address)
        DO UPDATE SET
          attempts = CASE
            WHEN quiz_admin_attempts.first_attempt_at < $2 - INTERVAL '${WINDOW_MINUTES} minutes' THEN 1
            ELSE quiz_admin_attempts.attempts + 1
          END,
          first_attempt_at = CASE
            WHEN quiz_admin_attempts.first_attempt_at < $2 - INTERVAL '${WINDOW_MINUTES} minutes' THEN $2
            ELSE quiz_admin_attempts.first_attempt_at
          END,
          last_attempt_at = $2,
          locked_until = CASE
            WHEN quiz_admin_attempts.attempts + 1 >= ${MAX_ATTEMPTS}
              AND quiz_admin_attempts.first_attempt_at >= $2 - INTERVAL '${WINDOW_MINUTES} minutes'
            THEN $2 + INTERVAL '${LOCK_MINUTES} minutes'
            ELSE quiz_admin_attempts.locked_until
          END
        `,
        [clientIp, now]
      );

      return {
        statusCode: 401,
        body: JSON.stringify({ message: "Invalid admin passcode." }),
      };
    }

    await client.query(
      `
      UPDATE quiz_admin_attempts
      SET attempts = 0,
          first_attempt_at = NULL,
          last_attempt_at = NULL,
          locked_until = NULL
      WHERE ip_address = $1
      `,
      [clientIp]
    );

    const result = await client.query(
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
      [QUIZ_SLUG, quiz]
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ data: result.rows[0].data }),
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
