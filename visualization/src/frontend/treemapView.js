import { showNodeDetails } from './utils.js';
import { renderLegend } from './legend.js';

export function renderTreemap(svg, data, dimensions) {
    const {width, height, margin} = dimensions;

    // Clear any existing content
    svg.selectAll("*").remove();

    const treemapWidth = (width * 1.5) - margin.left - margin.right;
    const treemapHeight = (height * 2) - margin.top - margin.bottom;

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top + 50})`);

    const root = d3.hierarchy(data)
        .sum(d => d.size || 0)
        .sort((a, b) => b.value - a.value);

    const treemap = d3.treemap()
        .size([treemapWidth, treemapHeight])
        .paddingTop(50)
        .paddingRight(7)
        .paddingInner(3)
        .round(true);

    treemap(root);

    const cell = g.selectAll("g")
        .data(root.descendants())
        .enter().append("g")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    cell.append("rect")
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0)
        .attr("fill", d => d.children ? "#8BC34A" : getNodeColor(d))
        .attr("stroke", d => d.children ? "#000" : "none")
        .attr("stroke-width", d => d.children ? 2 : 0);

    cell.append("text")
        .attr("x", 4)
        .attr("y", 14)
        .attr("dy", ".35em")
        .text(d => d.data.name)
        .attr("font-size", "10px")
        .each(function(d) {
            let self = d3.select(this);
            let textLength = self.node().getComputedTextLength();
            let text = self.text();
            while (textLength > (d.x1 - d.x0 - 8) && text.length > 0) {
                text = text.slice(0, -1);
                self.text(text + '...');
                textLength = self.node().getComputedTextLength();
            }
        });

    cell.append("text")
        .attr("x", 4)
        .attr("y", 26)
        .attr("dy", ".35em")
        .text(d => d.value)
        .attr("font-size", "9px")
        .attr("fill", "#555");

    cell.append("title")
        .text(d => `${d.data.name}\nSize: ${d.value}\nType: ${d.data.type}`);

    cell.on("click", (event, d) => showNodeDetails(d));

    const colorScale = d3.scaleOrdinal()
        .domain(['directory', 'c', 'h', 'makefile', 'other'])
        .range(['#8BC34A', '#2196F3', '#FF9800', '#9C27B0', '#9E9E9E']);

    renderLegend(svg, colorScale, { width, height, margin });

    console.log('Treemap rendering complete');
}

function getNodeColor(d) {
    if (d.data.type === 'directory') return "#8BC34A";
    if (d.data.name.toLowerCase().endsWith('.c')) return "#2196F3";
    if (d.data.name.toLowerCase().endsWith('.h')) return "#FF9800";
    if (d.data.name.toLowerCase() === 'makefile') return "#9C27B0";
    return "#9E9E9E";
}