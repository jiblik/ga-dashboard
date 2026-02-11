require('dotenv').config();
const express = require('express');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// GA4 Data API client
// Supports both: credentials.json file (local) or GOOGLE_CREDENTIALS env var (Railway/cloud)
let analyticsDataClient;
if (process.env.GOOGLE_CREDENTIALS) {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  analyticsDataClient = new BetaAnalyticsDataClient({ credentials });
} else {
  analyticsDataClient = new BetaAnalyticsDataClient({
    keyFilename: path.join(__dirname, 'credentials.json'),
  });
}

// The GA4 property ID - numeric ID from the property settings
// You can find it in GA4 Admin > Property Settings > Property ID
const PROPERTY_ID = process.env.GA4_PROPERTY_ID || '';

app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to fetch purchase data with source/UTM info
app.get('/api/report', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    if (!PROPERTY_ID) {
      return res.status(500).json({ error: 'GA4_PROPERTY_ID is not configured in .env' });
    }

    // GA4 limits to 9 dimensions per request, so we split into 2 calls
    const txFilter = {
      filter: {
        fieldName: 'transactionId',
        stringFilter: { matchType: 'FULL_REGEXP', value: '.+' },
      },
    };

    // Request 1: Source + item data (9 dims)
    const [mainResponse] = await analyticsDataClient.runReport({
      property: PROPERTY_ID,
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'date' },
        { name: 'transactionId' },
        { name: 'firstUserSource' },
        { name: 'firstUserMedium' },
        { name: 'firstUserCampaignName' },
        { name: 'sessionSource' },
        { name: 'sessionMedium' },
        { name: 'sessionCampaignName' },
        { name: 'itemName' },
      ],
      metrics: [{ name: 'itemRevenue' }],
      dimensionFilter: txFilter,
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: true }],
      limit: 10000,
    });

    // Request 2: Landing page per transaction
    const [lpResponse] = await analyticsDataClient.runReport({
      property: PROPERTY_ID,
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'transactionId' },
        { name: 'landingPagePlusQueryString' },
      ],
      metrics: [{ name: 'itemRevenue' }],
      dimensionFilter: txFilter,
      limit: 10000,
    });

    // Build landing page lookup: transactionId -> landingPage
    const lpMap = {};
    (lpResponse.rows || []).forEach((row) => {
      const txId = row.dimensionValues[0].value;
      const lp = row.dimensionValues[1].value;
      if (!lpMap[txId] || lp !== '(not set)') {
        lpMap[txId] = lp;
      }
    });

    const notSet = (v) => !v || v === '(not set)' || v === '(none)';

    const rows = (mainResponse.rows || []).map((row) => {
      const dims = row.dimensionValues.map((d) => d.value);
      const metrics = row.metricValues.map((m) => m.value);

      const rawDate = dims[0];
      const formattedDate = rawDate.length === 8
        ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
        : rawDate;

      const firstSource = dims[2];
      const firstMedium = dims[3];
      const firstCampaign = dims[4];
      const sessSource = dims[5];
      const sessMedium = dims[6];
      const sessCampaign = dims[7];

      return {
        date: formattedDate,
        transactionId: dims[1],
        firstSource: firstSource,
        firstMedium: firstMedium,
        firstCampaign: firstCampaign,
        source: notSet(sessSource) ? firstSource : sessSource,
        medium: notSet(sessMedium) ? firstMedium : sessMedium,
        campaign: notSet(sessCampaign) ? firstCampaign : sessCampaign,
        landingPage: lpMap[dims[1]] || '(not set)',
        itemName: dims[8],
        revenue: parseFloat(metrics[0]) || 0,
      };
    });

    // Calculate totals
    const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);
    const uniqueTransactions = new Set(rows.map((r) => r.transactionId)).size;

    res.json({
      rows,
      totals: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalTransactions: uniqueTransactions,
        totalItems: rows.length,
      },
      rowCount: rows.length,
    });
  } catch (err) {
    console.error('GA4 API Error:', err.message);
    res.status(500).json({
      error: 'Failed to fetch data from Google Analytics',
      details: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
});
