import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch'; // Need to ensure node-fetch is available or use built-in in Node 18+

dotenv.config({ path: '../.env.local' }); // Load from parent .env.local

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const ELEVENLABS_API_KEY = process.env.AI33_API_KEY; // Using the key found

if (!ELEVENLABS_API_KEY) {
  console.warn("WARNING: AI33_API_KEY not found in env variables!");
}

// Routes

// 1. Get Voices
app.get('/api/voices', async (req, res) => {
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      }
    });
    
    if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.statusText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching voices:', error);
    res.status(500).json({ error: 'Failed to fetch voices' });
  }
});

// 2. Generate Speech
app.post('/api/generate', async (req, res) => {
  console.log("Received generate request", req.body);
  const { text, voiceId, settings } = req.body;

  if (!text || !voiceId) {
    return res.status(400).json({ error: 'Missing text or voiceId' });
  }

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_monolingual_v1", // Default model, can be parameterized
        voice_settings: settings || {
          stability: 0.5,
          similarity_boost: 0.5
        }
      })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("ElevenLabs Error:", errorText);
        throw new Error(`ElevenLabs API error: ${response.statusText}`);
    }

    // Pipe the audio directly to the client
    res.setHeader('Content-Type', 'audio/mpeg');
    
    // We can't just pipe readable web stream to express response directly in all node versions easily without conversion
    // So we'll get buffer and send.
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    res.send(buffer);

  } catch (error) {
    console.error('Error generating speech:', error);
    res.status(500).json({ error: 'Failed to generate speech' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
