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
    const { email, newsletter, giveaways, unsubscribe } = JSON.parse(
      event.body || "{}"
    );

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Email is required" }),
      };
    }

    await client.connect();

    // Check if email exists
    const existingResult = await client.query(
      `SELECT id FROM email_signups WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email.trim()]
    );

    if (existingResult.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Email not found" }),
      };
    }

    // Handle unsubscribe - delete the record
    if (unsubscribe) {
      await client.query(
        `DELETE FROM email_signups WHERE LOWER(email) = LOWER($1)`,
        [email.trim()]
      );

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          success: true,
          message: "Successfully unsubscribed",
          unsubscribed: true,
        }),
      };
    }

    // Validate that at least one option is selected for updates
    if (!newsletter && !giveaways) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Please select at least one subscription option, or choose to unsubscribe",
        }),
      };
    }

    // Update preferences
    await client.query(
      `UPDATE email_signups
       SET newsletter = $1, giveaways = $2
       WHERE LOWER(email) = LOWER($3)`,
      [newsletter || false, giveaways || false, email.trim()]
    );

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        message: "Preferences updated successfully",
      }),
    };
  } catch (error) {
    console.error("Update email preferences error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Server error. Please try again." }),
    };
  } finally {
    await client.end();
  }
};
