/**
 * Netlify function to fetch ALTO XML from PA Newspaper Archive and extract
 * coordinates for text strings containing the target year.
 *
 * This enables efficient redaction by:
 * 1. Fetching OCR data server-side (faster, no CORS issues)
 * 2. Parsing XML and filtering for year matches
 * 3. Returning only the minimal coordinate data needed
 */

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: "Method not allowed" }),
    };
  }

  try {
    const { date, page, targetYear } = JSON.parse(event.body);

    if (!date || !page || !targetYear) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing required parameters: date, page, targetYear" }),
      };
    }

    const COLLEGIAN_LCCN = "sn85054904";
    const ocrUrl = `https://panewsarchive.psu.edu/lccn/${COLLEGIAN_LCCN}/${date}/ed-1/seq-${page}/ocr.xml`;

    const response = await fetch(ocrUrl, {
      headers: {
        "User-Agent": "Collegian-TimeMachine/1.0",
        "Accept": "application/xml, text/xml",
      },
    });

    if (response.status === 404) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "OCR data not found for this page" }),
      };
    }

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ message: `Failed to fetch OCR: ${response.statusText}` }),
      };
    }

    const xmlText = await response.text();

    // Parse ALTO XML to extract page dimensions and matching strings
    const result = parseAltoXml(xmlText, targetYear.toString());

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
      },
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error("Error processing redactions:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Server error processing redactions" }),
    };
  }
};

/**
 * Parse ALTO XML and extract coordinates for strings containing the target year.
 * ALTO format uses attributes: HPOS, VPOS, WIDTH, HEIGHT for each String element.
 * Page dimensions come from the Page element's HEIGHT and WIDTH attributes.
 */
function parseAltoXml(xmlText, targetYear) {
  const redactions = [];
  let pageWidth = 0;
  let pageHeight = 0;

  // Extract page dimensions from <Page> element
  const pageMatch = xmlText.match(/<Page[^>]*\sWIDTH="(\d+)"[^>]*\sHEIGHT="(\d+)"/i) ||
                    xmlText.match(/<Page[^>]*\sHEIGHT="(\d+)"[^>]*\sWIDTH="(\d+)"/i);

  if (pageMatch) {
    // Handle both attribute orderings
    if (xmlText.match(/<Page[^>]*\sWIDTH="(\d+)"[^>]*\sHEIGHT="(\d+)"/i)) {
      pageWidth = parseInt(pageMatch[1], 10);
      pageHeight = parseInt(pageMatch[2], 10);
    } else {
      pageHeight = parseInt(pageMatch[1], 10);
      pageWidth = parseInt(pageMatch[2], 10);
    }
  }

  // Find all String elements containing the target year
  // ALTO format: <String HPOS="x" VPOS="y" WIDTH="w" HEIGHT="h" CONTENT="text" />
  const stringRegex = /<String[^>]*CONTENT="([^"]*)"[^>]*\/>/gi;
  let match;

  while ((match = stringRegex.exec(xmlText)) !== null) {
    const content = match[1];

    // Check if this string contains the target year
    if (content.includes(targetYear)) {
      const fullTag = match[0];

      // Extract coordinates
      const hposMatch = fullTag.match(/HPOS="(\d+)"/);
      const vposMatch = fullTag.match(/VPOS="(\d+)"/);
      const widthMatch = fullTag.match(/WIDTH="(\d+)"/);
      const heightMatch = fullTag.match(/HEIGHT="(\d+)"/);

      if (hposMatch && vposMatch && widthMatch && heightMatch) {
        const x = parseInt(hposMatch[1], 10);
        const y = parseInt(vposMatch[1], 10);
        const w = parseInt(widthMatch[1], 10);
        const h = parseInt(heightMatch[1], 10);

        // Add padding to ensure full coverage
        const padding = Math.max(4, h * 0.1);

        redactions.push({
          x: x - padding,
          y: y - padding,
          w: w + padding * 2,
          h: h + padding * 2,
        });
      }
    }
  }

  return {
    pageWidth,
    pageHeight,
    redactions,
    count: redactions.length,
  };
}
