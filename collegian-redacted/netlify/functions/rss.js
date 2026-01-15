export default async (req, context) => {
  const RSS_URL = "https://www.psucollegian.com/search/?f=rss&l=50&t=article";

  try {
    const response = await fetch(RSS_URL);

    // If the newspaper is blocking us, return an error
    if (!response.ok) {
      return new Response(`Error fetching RSS: ${response.statusText}`, {
        status: response.status,
      });
    }

    const xml = await response.text();

    return new Response(xml, {
      headers: {
        "Content-Type": "application/rss+xml",
        // CRITICAL: This tells Netlify CDN to store this response for 3600 seconds (1 hour)
        // Netlify will serve this cached version to all users without hitting the newspaper again.
        "Cache-Control": "public, max-age=0, must-revalidate, s-maxage=3600",
      },
    });
  } catch (error) {
    return new Response(`Internal Server Error: ${error.message}`, {
      status: 500,
    });
  }
};
