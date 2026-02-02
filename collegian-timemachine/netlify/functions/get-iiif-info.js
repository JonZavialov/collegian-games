/**
 * Netlify function to get the IIIF info.json URL for a newspaper page.
 *
 * The PA Newspaper Archive uses IIIF but the URL contains a reel number
 * that varies by date. This function scrapes the page to get the IIIF ID.
 */

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: "Method not allowed" }),
    };
  }

  const { date, page } = event.queryStringParameters || {};

  if (!date || !page) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing required parameters: date, page" }),
    };
  }

  const COLLEGIAN_LCCN = "sn85054904";
  const pageUrl = `https://panewsarchive.psu.edu/lccn/${COLLEGIAN_LCCN}/${date}/ed-1/seq-${page}/`;

  try {
    const response = await fetch(pageUrl, {
      headers: {
        "User-Agent": "Collegian-TimeMachine/1.0",
      },
    });

    if (response.status === 404) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Page not found in archive" }),
      };
    }

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ message: `Failed to fetch page: ${response.statusText}` }),
      };
    }

    const html = await response.text();

    // Extract IIIF ID from the data-iiif_id attribute
    const iiifMatch = html.match(/data-iiif_id="([^"]+)"/);

    if (!iiifMatch) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "IIIF info not found on page" }),
      };
    }

    // The value is URL-encoded, decode it and construct the full URL
    const iiifPath = iiifMatch[1];
    const baseUrl = "https://panewsarchive.psu.edu";
    const infoUrl = `${baseUrl}${iiifPath}`;

    // Fetch the actual info.json
    const infoResponse = await fetch(infoUrl);

    if (!infoResponse.ok) {
      return {
        statusCode: infoResponse.status,
        body: JSON.stringify({ message: "Failed to fetch IIIF info" }),
      };
    }

    const info = await infoResponse.json();

    // Convert the IIIF @id to use our iiif-info function proxy
    // This function rewrites the @id in info.json to use our /iiif/ proxy
    // so that OpenSeadragon constructs tile URLs through our proxy
    // Original: https://panewsarchive.psu.edu/iiif/batch_pst.../0001.jp2
    // Proxied: /.netlify/functions/iiif-info/batch_pst.../0001.jp2
    const originalId = info["@id"];
    const proxyPath = originalId.replace("https://panewsarchive.psu.edu/iiif", "");

    // Return the URL to our iiif-info function which will rewrite the @id
    const infoJsonUrl = `/.netlify/functions/iiif-info${proxyPath}`;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        iiifInfoUrl: infoJsonUrl,
        width: info.width,
        height: info.height,
        tiles: info.tiles,
      }),
    };
  } catch (error) {
    console.error("Error fetching IIIF info:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Server error fetching IIIF info" }),
    };
  }
};
