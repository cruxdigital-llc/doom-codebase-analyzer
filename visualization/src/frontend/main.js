import { renderTree } from './treeview.js';
import { renderTreemap } from './treemapView.js';
import { renderArcDiagram } from './arcDiagramView.js';
import { commonDimensions } from './utils.js';

let currentVisualization = null;

async function fetchCodebaseData() {
    console.log('Fetching codebase data...');
    try {
        const response = await fetch('/api/codebase?includeSource=true');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Fetched data:', JSON.stringify(data, null, 2));
        return data;
    } catch (error) {
        console.error('Error fetching codebase data:', error);
        return null;
    }
}

async function initializeVisualization() {
    console.log('Initializing visualization...');
    const data = await fetchCodebaseData();
    if (data) {
        console.log('Data fetched successfully');
        
        function renderVisualization(type) {
            const container = document.getElementById('visualization-container');
            
            // Clear previous content
            d3.select(container).html('');

            const svg = d3.select(container)
                .append('svg')
                .attr('width', commonDimensions.width)
                .attr('height', commonDimensions.height);

            const boundWidth = commonDimensions.width - commonDimensions.margin.left - commonDimensions.margin.right;
            const boundHeight = (commonDimensions.height * 2) - commonDimensions.margin.top - commonDimensions.margin.bottom;

            const dimensions = {...commonDimensions, boundWidth, boundHeight};

            switch(type) {
                case 'tree':
                    renderTree(svg, data, dimensions);
                    break;
                case 'treemap':
                    renderTreemap(svg, data, dimensions);
                    break;
                case 'arc-diagram':
                    renderArcDiagram(svg, data, dimensions);
                    break;
            }
        }

        // Set up event listeners for visualization buttons
        document.getElementById('tree-view').addEventListener('click', () => renderVisualization('tree'));
        document.getElementById('treemap-view').addEventListener('click', () => renderVisualization('treemap'));
        document.getElementById('arc-diagram-view').addEventListener('click', () => renderVisualization('arc-diagram'));

        // Initial render
        renderVisualization('tree');
    } else {
        console.log('No data fetched, cannot render visualizations');
    }
}

// Call the initialization function when the page loads
window.addEventListener('load', initializeVisualization);