import { showNodeDetails } from './utils.js';
import { renderLegend } from './legend.js';
import { commonDimensions } from './utils.js';
import { createZoom } from './utils.js';

export function renderArcDiagram(svg, data, dimensions) {
    const { width, height, margin } = dimensions;

    // Clear any existing content
    svg.selectAll("*").remove();

    const diagramWidth = width - margin.left - margin.right;
    const diagramHeight = (height * 3) - margin.top - margin.bottom;

    const mainGroup = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create dropdown for view selection
    const viewSelect = d3.select("#visualization-container")
        .insert("select", ":first-child")
        .attr("id", "view-select")
        .on("change", function() {
            updateView(this.value);
        });

    viewSelect.selectAll("option")
        .data(["Hierarchy", "Dependencies", "Inputs", "Outputs"])
        .enter().append("option")
        .text(d => d)
        .attr("value", d => d.toLowerCase());

    const colorScale = d3.scaleOrdinal()
        .domain(['directory', 'c', 'h', 'makefile', 'other'])
        .range(['#8BC34A', '#2196F3', '#FF9800', '#9C27B0', '#9E9E9E']);

    renderLegend(svg, colorScale, { width, height, margin });

    function updateView(viewType) {
        let links, nodes;

        switch (viewType) {
            case "hierarchy":
                links = getHierarchyLinks(data);
                break;
            case "dependencies":
                links = getDependencyLinks(data);
                break;
            case "inputs":
                links = getInputLinks(data);
                break;
            case "outputs":
                links = getOutputLinks(data);
                break;
        }

        nodes = getNodesFromLinks(links);
        renderArcs(links, nodes);
    }

    function getHierarchyLinks(data) {
        function extractLinks(node) {
            let links = [];
            if (node.children) {
                node.children.forEach(child => {
                    links.push({source: node.name, target: child.name});
                    links = links.concat(extractLinks(child));
                });
            }
            return links;
        }
        return extractLinks(data);
    }

    function getDependencyLinks(data) {
        function extractLinks(node) {
            let links = [];
            if (node.dependencies) {
                node.dependencies.forEach(dep => {
                    links.push({source: node.name, target: dep});
                });
            }
            if (node.children) {
                node.children.forEach(child => {
                    links = links.concat(extractLinks(child));
                });
            }
            return links;
        }
        return extractLinks(data);
    }

    function getInputLinks(data) {
        function extractLinks(node) {
            let links = [];
            if (node.inputs) {
                node.inputs.forEach(input => {
                    links.push({source: input, target: node.name});
                });
            }
            if (node.children) {
                node.children.forEach(child => {
                    links = links.concat(extractLinks(child));
                });
            }
            return links;
        }
        return extractLinks(data);
    }

    function getOutputLinks(data) {
        function extractLinks(node) {
            let links = [];
            if (node.outputs) {
                node.outputs.forEach(output => {
                    links.push({source: node.name, target: output});
                });
            }
            if (node.children) {
                node.children.forEach(child => {
                    links = links.concat(extractLinks(child));
                });
            }
            return links;
        }
        return extractLinks(data);
    }

    function getNodesFromLinks(links) {
        let nodeSet = new Set();
        links.forEach(link => {
            nodeSet.add(link.source);
            nodeSet.add(link.target);
        });
        return Array.from(nodeSet).map(name => ({
            id: name,
            group: name.includes('.') ? name.split('.').pop() : 'directory'
        }));
    }

    function renderArcs(links, nodes) {
        mainGroup.selectAll("*").remove();

        const y = d3.scalePoint()
            .domain(nodes.map(d => d.id))
            .range([0, diagramHeight]);

        const Y = new Map(nodes.map(({id}) => [id, y(id)]));

        function arc(d) {
            const y1 = Y.get(d.source);
            const y2 = Y.get(d.target);
            if (y1 === undefined || y2 === undefined) return null;
            const r = Math.abs(y2 - y1) / 2;
            return `M${margin.left},${y1}A${r},${r} 0,0,${y1 < y2 ? 1 : 0} ${margin.left},${y2}`;
        }

        const path = mainGroup.insert("g", "*")
            .attr("fill", "none")
            .attr("stroke-opacity", 0.6)
            .attr("stroke-width", 1.5)
            .selectAll("path")
            .data(links)
            .join("path")
            .attr("stroke", d => colorScale(d.source.split('.').pop() || 'directory'))
            .attr("d", arc)
            .filter(d => d !== null);

        const label = mainGroup.append("g")
            .attr("font-family", "sans-serif")
            .attr("font-size", 10)
            .attr("text-anchor", "end")
            .selectAll("g")
            .data(nodes)
            .join("g")
            .attr("transform", d => `translate(${margin.left},${Y.get(d.id)})`)
            .call(g => g.append("text")
                .attr("x", -6)
                .attr("dy", "0.35em")
                .attr("fill", d => d3.lab(colorScale(d.group)).darker(2))
                .text(d => d.id))
            .call(g => g.append("circle")
                .attr("r", 3)
                .attr("fill", d => colorScale(d.group)));

        // Add hover interactions
        label.on("mouseover", function(event, d) {
            d3.select(this).select("circle").transition()
                .duration(300)
                .attr("r", 6);

            path.attr("stroke-opacity", l => (l.source === d.id || l.target === d.id) ? 1 : 0.1);
        })
        .on("mouseout", function() {
            d3.select(this).select("circle").transition()
                .duration(300)
                .attr("r", 3);

            path.attr("stroke-opacity", 0.6);
        });

        // Add click interaction
        label.on("click", (event, d) => {
            console.log("Clicked node:", d);
            console.log("Full data object:", data);
            const nodeData = findNodeData(data, d.id);
            console.log("Found node data:", nodeData);
            if (nodeData) {
                showNodeDetails(nodeData);
            } else {
                console.error(`Node data not found for id: ${d.id}`);
                showNodeDetails(d); // Fallback to showing the basic node info
            }
        });

        console.log('Arc diagram rendering complete');
    }

    function findNodeData(data, id) {
        console.log("Searching for node with id:", id);
        console.log("Current node:", data);
        if (data.name === id) return data;
        if (data.children) {
            for (let child of data.children) {
                const found = findNodeData(child, id);
                if (found) return found;
            }
        }
        return null;
    }

    // Initial render
    updateView("hierarchy");
}