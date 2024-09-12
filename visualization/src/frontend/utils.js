export function getNodeColor(d, colorScale) {
    if (d.data.type === 'directory') return "#8BC34A";
    if (d.data.name.toLowerCase().endsWith('.c')) return "#2196F3";
    if (d.data.name.toLowerCase().endsWith('.h')) return "#FF9800";
    if (d.data.name.toLowerCase() === 'makefile') return "#9C27B0";
    return "#9E9E9E";
}

export function showNodeDetails(d) {
    const details = d3.select('#details-panel');
    details.html('');

    if (!d || (!d.data && !d.name)) {
        details.append('p').text('No details available for this node.');
        return;
    }

    const nodeData = d.data || d;

    details.append('h2').text(nodeData.name);
    details.append('p').text(`Type: ${nodeData.type}`);
    if (nodeData.size) details.append('p').text(`Size: ${nodeData.size} bytes`);

    if (nodeData.type === 'directory') {
        if (nodeData.children) {
            addCollapsibleSection(details, 'Subdirectories', () => {
                const list = document.createElement('ul');
                nodeData.children.filter(child => child.type === 'directory').forEach(child => {
                    const li = document.createElement('li');
                    li.textContent = child.name;
                    list.appendChild(li);
                });
                return list;
            });
        }
        if (nodeData.children) {
            addCollapsibleSection(details, 'Files', () => {
                const list = document.createElement('ul');
                nodeData.children.filter(child => child.type === 'file').forEach(child => {
                    const li = document.createElement('li');
                    li.textContent = child.name;
                    list.appendChild(li);
                });
                return list;
            });
        }
    } else {
        if (nodeData.readme) {
            addCollapsibleSection(details, 'Published Readme', nodeData.readme);
        }
        addCollapsibleSection(details, 'Gen AI Analysis', 'AI analysis not available yet.');
        if (nodeData.dependencies && nodeData.dependencies.length > 0) {
            addCollapsibleSection(details, 'Dependencies', () => {
                const list = document.createElement('ul');
                nodeData.dependencies.forEach(dep => {
                    const li = document.createElement('li');
                    li.textContent = dep;
                    list.appendChild(li);
                });
                return list;
            });
        }
        if (nodeData.inputs && nodeData.inputs.length > 0) {
            addCollapsibleSection(details, 'Inputs', () => {
                const list = document.createElement('ul');
                nodeData.inputs.forEach(input => {
                    const li = document.createElement('li');
                    li.textContent = input;
                    list.appendChild(li);
                });
                return list;
            });
        }
        if (nodeData.outputs && nodeData.outputs.length > 0) {
            addCollapsibleSection(details, 'Outputs', () => {
                const list = document.createElement('ul');
                nodeData.outputs.forEach(output => {
                    const li = document.createElement('li');
                    li.textContent = output;
                    list.appendChild(li);
                });
                return list;
            });
        }
        addCollapsibleSection(details, 'Source Code', 'Source code not available in static version');
    }
}

function addCollapsibleSection(container, title, content) {
    const section = container.append('div').attr('class', 'collapsible-section');
    const header = section.append('h3');
    header.html(`<span class="collapse-icon">▶</span> ${title}`);
    const contentDiv = section.append('div').attr('class', 'section-content');

    if (typeof content === "function") {
        contentDiv.append(() => content());
    } else {
        contentDiv.append('p').text(content);
    }

    header.on('click', () => {
        const isExpanded = contentDiv.style('display') !== 'none';
        contentDiv.style('display', isExpanded ? 'none' : 'block');
        header.select('.collapse-icon').text(isExpanded ? '▶' : '▼');
    });

    contentDiv.style('display', 'none');
}

export const commonDimensions = {
    width: 960,
    height: 600,
    margin: { top: 20, right: 20, bottom: 20, left: 40 }
};

export function createZoom(svg) {
    return d3.zoom()
        .scaleExtent([0.5, 3])
        .on("zoom", (event) => {
            svg.attr("transform", event.transform);
        });
}

export const colorScale = d3.scaleOrdinal()
    .domain(['directory', 'c', 'h', 'makefile', 'other'])
    .range(['#8BC34A', '#2196F3', '#FF9800', '#9C27B0', '#9E9E9E']);