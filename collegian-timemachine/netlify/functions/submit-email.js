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
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    const { email, newsletter, giveaways, source } = JSON.parse(
      event.body || "{}"
    );

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Email is required" }),
      };
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid email format" }),
      };
    }

    if (!newsletter && !giveaways) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Please select at least one subscription option",
        }),
      };
    }

    await client.connect();

    // Check if email already exists
    const existingResult = await client.query(
      `SELECT id FROM email_signups WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email.trim()]
    );

    if (existingResult.rows.length > 0) {
      return {
        statusCode: 409,
        body: JSON.stringify({ message: "Email already registered" }),
      };
    }

    // Insert new email signup
    await client.query(
      `INSERT INTO email_signups (email, newsletter, giveaways, source, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [email.trim().toLowerCase(), newsletter || false, giveaways || false, source || "unknown"]
    );

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        message: "Successfully signed up!",
      }),
    };
  } catch (error) {
    console.error("Submit email error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Server error. Please try again." }),
    };
  } finally {
    await client.end();
  }
};
