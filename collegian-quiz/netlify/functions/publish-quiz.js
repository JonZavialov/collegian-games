const { Client } = require("pg");

const QUIZ_SLUG = "beat-the-editor";

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

    if (!expectedPasscode) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Server is missing admin passcode." }),
      };
    }

    if (!passcode || passcode !== expectedPasscode) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: "Invalid admin passcode." }),
      };
    }

    if (!quiz) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Quiz payload is required." }),
      };
    }

    await client.connect();

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
