require('dotenv').config();
const express = require('express');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// GA4 Data API client - uses credentials.json in project root
const analyticsDataClient = new BetaAnalyticsDataClient({
  keyFilename: path.join(__dirname, 'credentials.json'),
});

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

    const [response] = await analyticsDataClient.runReport({
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
      metrics: [
        { name: 'itemRevenue' },
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'transactionId',
          stringFilter: {
            matchType: 'FULL_REGEXP',
            value: '.+',
          },
        },
      },
      orderBys: [
        { dimension: { dimensionName: 'date' }, desc: true },
      ],
      limit: 10000,
    });

    const rows = (response.rows || []).map((row) => {
      const dims = row.dimensionValues.map((d) => d.value);
      const metrics = row.metricValues.map((m) => m.value);

      // Format date from YYYYMMDD to YYYY-MM-DD
      const rawDate = dims[0];
      const formattedDate = rawDate.length === 8
        ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
        : rawDate;

      // Use firstUser data, fall back to session data if firstUser is (not set)
      const firstSource = dims[2];
      const firstMedium = dims[3];
      const firstCampaign = dims[4];
      const sessSource = dims[5];
      const sessMedium = dims[6];
      const sessCampaign = dims[7];

      const notSet = (v) => !v || v === '(not set)' || v === '(none)';

      return {
        date: formattedDate,
        transactionId: dims[1],
        firstSource: firstSource,
        firstMedium: firstMedium,
        firstCampaign: firstCampaign,
        source: notSet(sessSource) ? firstSource : sessSource,
        medium: notSet(sessMedium) ? firstMedium : sessMedium,
        campaign: notSet(sessCampaign) ? firstCampaign : sessCampaign,
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
