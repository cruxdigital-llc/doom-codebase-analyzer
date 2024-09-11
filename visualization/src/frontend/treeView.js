import { showNodeDetails } from './utils.js';
import { renderLegend } from './legend.js';
import { commonDimensions } from './utils.js';
import { createZoom } from './utils.js';

export function renderTree(svg, data, dimensions) {
    const { width, height, margin, boundWidth, boundHeight } = dimensions;
    
    const treeWidth = boundWidth * 1.25;
    const treeHeight = boundHeight * 1.5; // Double the height

    let nodeId = 0;

    const zoom = createZoom(svg);
    svg.call(zoom);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const tree = d3.tree().size([treeHeight, treeWidth]);

    const root = d3.hierarchy(data);
    root.x0 = treeHeight / 2;
    root.y0 = 0;

    const colorScale = d3.scaleOrdinal()
        .domain(['directory', 'c', 'h', 'makefile', 'other'])
        .range(['#8BC34A', '#2196F3', '#FF9800', '#9C27B0', '#9E9E9E']);

    renderLegend(svg, colorScale, { width, height, margin });

    function getNodeColor(d) {
        if (d.data.type === 'directory') return colorScale('directory');
        if (d.data.name.toLowerCase().endsWith('.c')) return colorScale('c');
        if (d.data.name.toLowerCase().endsWith('.h')) return colorScale('h');
        if (d.data.name.toLowerCase() === 'makefile') return colorScale('makefile');
        return colorScale('other');
    }

    function update(source) {
        const duration = 750;

        tree(root);

        const nodes = root.descendants();
        const links = root.descendants().slice(1);

        nodes.forEach(d => { d.y = d.depth * (treeWidth / (root.height + 1)); });

        const node = svg.selectAll('.node')
            .data(nodes, d => d.id || (d.id = ++nodeId));

        const nodeEnter = node.enter().append('g')
            .attr('class', 'node')
            .attr("transform", d => `translate(${source.y0},${source.x0})`)
            .on('click', (event, d) => {
                event.stopPropagation();
                if (d.children) {
                    d._children = d.children;
                    d.children = null;
                } else if (d._children) {
                    d.children = d._children;
                    d._children = null;
                }
                update(d);
                showNodeDetails(d);
            });

        nodeEnter.append('circle')
            .attr('r', 1e-6)
            .style('fill', d => getNodeColor(d))
            .style('stroke', '#000')
            .style('stroke-width', '1px');

        nodeEnter.append('text')
            .attr('dy', '.31em')
            .attr('x', d => d.children || d._children ? -13 : 13)
            .attr('text-anchor', d => d.children || d._children ? 'end' : 'start')
            .text(d => d.data.name)
            .style('fill-opacity', 1e-6);

        const nodeUpdate = nodeEnter.merge(node);

        nodeUpdate.transition()
            .duration(duration)
            .attr("transform", d => `translate(${d.y},${d.x})`);

        nodeUpdate.select('circle')
            .attr('r', 7)
            .style('fill', d => getNodeColor(d));

        nodeUpdate.select('text')
            .style('fill-opacity', 1);

        const nodeExit = node.exit().transition()
            .duration(duration)
            .attr("transform", d => `translate(${source.y},${source.x})`)
            .remove();

        nodeExit.select('circle')
            .attr('r', 1e-6);

        nodeExit.select('text')
            .style('fill-opacity', 1e-6);

        const link = svg.selectAll('path.link')
            .data(links, d => d.id);

        const linkEnter = link.enter().insert('path', "g")
            .attr("class", "link")
            .attr('d', d => {
                const o = {x: source.x0, y: source.y0};
                return diagonal(o, o);
            });

        link.merge(linkEnter).transition()
            .duration(duration)
            .attr('d', d => diagonal(d, d.parent));

        link.exit().transition()
            .duration(duration)
            .attr('d', d => {
                const o = {x: source.x, y: source.y};
                return diagonal(o, o);
            })
            .remove();

        nodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }

    function diagonal(s, d) {
        return `M ${s.y} ${s.x}
                C ${(s.y + d.y) / 2} ${s.x},
                  ${(s.y + d.y) / 2} ${d.x},
                  ${d.y} ${d.x}`;
    }

    function collapse(d) {
        if (d.children) {
            d._children = d.children;
            d._children.forEach(collapse);
            d.children = null;
        }
    }

    root.children.forEach(collapse);
    update(root);

    console.log('Tree rendering complete');
}