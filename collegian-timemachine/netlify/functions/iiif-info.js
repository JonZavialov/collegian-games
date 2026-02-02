/**
 * Proxy for IIIF info.json that rewrites the @id to use our proxy.
 * This is necessary because OpenSeadragon uses the @id from info.json
 * to construct tile URLs, and we need those to go through our proxy.
 */

exports.handler = async (event) => {
  // Extract the IIIF identifier from the path
  // Path will be like: /.netlify/functions/iiif-info/batch_pst.../0001.jp2
  const path = event.path.replace("/.netlify/functions/iiif-info", "");

  if (!path || path === "/") {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing IIIF identifier" }),
    };
  }

  const iiifUrl = `https://panewsarchive.psu.edu/iiif${path}/info.json`;

  try {
    const response = await fetch(iiifUrl, {
      headers: {
        "User-Agent": "Collegian-TimeMachine/1.0",
      },
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ message: "Failed to fetch IIIF info" }),
      };
    }

    const info = await response.json();

    // Rewrite the @id to use our proxy
    // This is critical - OpenSeadragon uses @id to build tile URLs
    const originalId = info["@id"];
    info["@id"] = originalId.replace(
      "https://panewsarchive.psu.edu/iiif/",
      "/iiif/"
    );

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(info),
    };
  } catch (error) {
    console.error("Error fetching IIIF info:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Server error" }),
    };
  }
};
