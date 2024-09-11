const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const getCodebaseStructure = require('./getCodebaseStructure');

const app = express();
const port = 3000;

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/api/codebase', async (req, res) => {
    const includeSource = req.query.includeSource === 'true';
    let codebaseData = await getCodebaseStructure();

    if (codebaseData && includeSource) {
        codebaseData = await addSourceCodeToData(codebaseData);
    }

    res.json(codebaseData || { error: 'Failed to load codebase structure' });
});

async function addSourceCodeToData(data) {
    if (data.type === 'file') {
        try {
            const absolutePath = path.join(__dirname, '../../../source-original', data.path);
            data.content = {
                source: await fs.readFile(absolutePath, 'utf-8')
            };
        } catch (error) {
            console.error(`Error reading file ${data.path}:`, error);
            data.content = { source: 'Error reading file' };
        }
    } else if (data.children) {
        data.children = await Promise.all(data.children.map(addSourceCodeToData));
    }
    return data;
}

app.get('/api/source-code', async (req, res) => {
  try {
    const filePath = path.join(__dirname, '../../source-original', req.query.path);
    console.log('Attempting to read file:', filePath);
    const content = await fs.readFile(filePath, 'utf-8');
    res.send(content);
  } catch (error) {
    console.error('Error reading source code:', error);
    res.status(404).send('File not found');
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});