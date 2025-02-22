import express from 'express'
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import WebsiteAudit from './WebsiteAudit/index.js';

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const app = express()
const PORT = 3000

app.use(cors());

app.use((req, res, next) => {
  console.log(`${req.method} request`)
  console.log(`URL: ${req.url}`)


  next()
})

app.get('/audit', async (req, res) => {
  const site = req.query.site
  console.log('auditing', { site })

  if (!site) {
    return res.status(400).json({ error: 'Site URL is required.' });
  }
  
  // Set headers for Server-Sent Events (SSE)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const websiteAudit = new WebsiteAudit();

  // Emit progress updates to the client
  const emitProgress = (message) => {
    res.write(`data: ${JSON.stringify({ progress: message })}\n\n`);
  };

  try {
    const results = await websiteAudit.auditSiteWithProgress(site, emitProgress);

    if (results) {
      res.write(`data: ${JSON.stringify({ results })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Audit failed.' })}\n\n`);
    }
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
  }

  // End the stream
  res.end();
})

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/sites/landing.html')
})

app.listen(PORT, () => {
  console.log('Open the server at ' + `http://localhost:${PORT}`)
})
