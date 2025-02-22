const auditWebsiteWithStreaming = async (req, res) => {
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
}

export default auditWebsiteWithStreaming