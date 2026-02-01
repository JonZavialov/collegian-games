const { Client } = require("pg");

const QUIZ_SLUG = "beat-the-editor";

exports.handler = async () => {
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
    const result = await client.query(
      `SELECT data, published_at
       FROM quiz_configs
       WHERE slug = $1
       LIMIT 1`,
      [QUIZ_SLUG]
    );

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Quiz not found." }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        data: result.rows[0].data,
        publishedAt: result.rows[0].published_at,
      }),
    };
  } catch (error) {
    console.error("Get quiz error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "An error occurred." }),
    };
  } finally {
    await client.end();
  }
};
