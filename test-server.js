const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Server is running!');
});

const PORT = 8642;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Test server running on http://0.0.0.0:${PORT}`);
});

// Keep alive
process.on('SIGINT', () => {
  console.log('Shutting down...');
  server.close();
  process.exit(0);
});
