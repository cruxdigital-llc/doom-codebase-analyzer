const fs = require('fs').promises;
const path = require('path');

async function getCodebaseStructure() {
  const filePath = path.join(__dirname, '../../../doom_codebase_structure.json');
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading codebase structure:', error);
    return { type: 'directory', name: 'root', children: [] };
  }
}

module.exports = getCodebaseStructure;