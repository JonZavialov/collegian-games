const { Client } = require("pg");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: "Method not allowed" }),
    };
  }

  const client = new Client({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: false,
  });

  try {
    const { email } = JSON.parse(event.body || "{}");

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Email is required" }),
      };
    }

    await client.connect();

    const result = await client.query(
      `SELECT newsletter, giveaways, unsubscribed FROM email_signups WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email.trim()]
    );

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Email not found" }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        newsletter: result.rows[0].newsletter,
        giveaways: result.rows[0].giveaways,
        unsubscribed: result.rows[0].unsubscribed || false,
      }),
    };
  } catch (error) {
    console.error("Get email preferences error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Server error" }),
    };
  } finally {
    await client.end();
  }
};
