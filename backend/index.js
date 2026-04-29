require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Issue a short-lived Deepgram temporary API token
app.get('/api/deepgram/token', async (req, res) => {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  const projectId = process.env.DEEPGRAM_PROJECT_ID;

  if (!apiKey) {
    return res.status(500).json({ error: 'DEEPGRAM_API_KEY not configured' });
  }

  // If no project ID is set, return the key directly
  if (!projectId) {
    return res.json({ key: apiKey });
  }

  try {
    // Dynamic import for fetch if using older node, but Node 18+ has native fetch
    const response = await fetch(
      `https://api.deepgram.com/v1/projects/${projectId}/keys`,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment: 'monkeyspeak-ephemeral',
          scopes: ['usage:write'],
          time_to_live_in_seconds: 30,
        }),
      }
    );

    if (!response.ok) {
      // Fallback: return the main key if ephemeral key creation fails
      return res.json({ key: apiKey });
    }

    const data = await response.json();
    return res.json({ key: data.result?.key ?? apiKey });
  } catch (err) {
    // Network error — fall back to main key
    return res.json({ key: apiKey });
  }
});

// Health check endpoint for GCP
app.get('/', (req, res) => {
  res.send('MonkeySpeak Backend is running');
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
