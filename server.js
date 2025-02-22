import express from 'express'
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import WebsiteAudit from './WebsiteAudit/index.js';
import logger from './middleware/logger.js';
import auditWebsiteWithStreaming from './routes/audit.js';

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const app = express()
const PORT = 3000

app.use(cors());

app.use(logger)

app.get('/audit', auditWebsiteWithStreaming)

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/site/landing.html')
})

app.listen(PORT, () => {
  console.log('Open the server at ' + `http://localhost:${PORT}`)
})
