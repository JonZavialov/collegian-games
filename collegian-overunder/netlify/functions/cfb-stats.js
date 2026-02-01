// netlify/functions/cfb-stats.js
// Fetches Penn State football player stats from CollegeFootballData.com API
// and transforms them into a format suitable for the Over/Under game

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: "Method not allowed" }),
    };
  }

  const apiKey = process.env.CFBD_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "API key not configured" }),
    };
  }

  try {
    // Get current year for the season
    const currentYear = new Date().getFullYear();
    // If we're before August, use previous year's season
    const seasonYear = new Date().getMonth() < 7 ? currentYear - 1 : currentYear;

    const url = `https://api.collegefootballdata.com/stats/player/season?year=${seasonYear}&team=Penn State`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    const rawData = await response.json();

    // Process and consolidate player stats
    // The API returns one row per player per stat type
    const playerMap = new Map();

    for (const row of rawData) {
      const { playerId, player, category, statType, stat } = row;

      // Skip if missing required fields
      if (!playerId || !player || !category || !stat) continue;

      // We want specific stat types that make for interesting comparisons
      // Focus on cumulative stats that are comparable
      const interestingStats = [
        { category: "passing", statType: "YDS", displayName: "Passing Yards", minValue: 100 },
        { category: "passing", statType: "TD", displayName: "Passing TDs", minValue: 2 },
        { category: "rushing", statType: "YDS", displayName: "Rushing Yards", minValue: 50 },
        { category: "rushing", statType: "TD", displayName: "Rushing TDs", minValue: 1 },
        { category: "rushing", statType: "CAR", displayName: "Carries", minValue: 20 },
        { category: "receiving", statType: "YDS", displayName: "Receiving Yards", minValue: 50 },
        { category: "receiving", statType: "TD", displayName: "Receiving TDs", minValue: 1 },
        { category: "receiving", statType: "REC", displayName: "Receptions", minValue: 5 },
        { category: "interceptions", statType: "INT", displayName: "Interceptions", minValue: 1 },
        { category: "defensive", statType: "TOT", displayName: "Total Tackles", minValue: 20 },
        { category: "defensive", statType: "SOLO", displayName: "Solo Tackles", minValue: 15 },
        { category: "defensive", statType: "TFL", displayName: "Tackles for Loss", minValue: 2 },
        { category: "defensive", statType: "SACKS", displayName: "Sacks", minValue: 1 },
        { category: "kicking", statType: "FGM", displayName: "Field Goals Made", minValue: 3 },
        { category: "kicking", statType: "PTS", displayName: "Kicking Points", minValue: 20 },
        { category: "punting", statType: "YDS", displayName: "Punt Yards", minValue: 500 },
      ];

      // Check if this stat matches one of our interesting stats
      const matchingStat = interestingStats.find(
        (s) =>
          s.category.toLowerCase() === category.toLowerCase() &&
          s.statType.toLowerCase() === statType.toLowerCase()
      );

      if (!matchingStat) continue;

      const statValue = parseFloat(stat);
      if (isNaN(statValue) || statValue < matchingStat.minValue) continue;

      // Create unique key for player + stat type
      const key = `${playerId}-${matchingStat.displayName}`;

      // Only keep unique player-stat combinations
      if (!playerMap.has(key)) {
        playerMap.set(key, {
          id: key,
          playerId: playerId.toString(),
          name: player,
          category: matchingStat.displayName,
          value: statValue,
          // ESPN headshot URL pattern - may not work for all players
          image: `https://a.espncdn.com/i/headshots/college-football/players/full/${playerId}.png`,
        });
      }
    }

    // Convert map to array and sort by value for variety
    const gameCards = Array.from(playerMap.values());

    // If we don't have enough data, return error
    if (gameCards.length < 10) {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, s-maxage=3600", // Cache for 1 hour if low data
        },
        body: JSON.stringify({
          error: "Not enough player data available",
          cards: gameCards,
          count: gameCards.length,
        }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=86400", // Cache for 24 hours
      },
      body: JSON.stringify({
        season: seasonYear,
        team: "Penn State",
        cards: gameCards,
        count: gameCards.length,
      }),
    };
  } catch (error) {
    console.error("CFB Stats API error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Failed to fetch player stats",
        error: error.message,
      }),
    };
  }
};
