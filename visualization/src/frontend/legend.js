export function renderLegend(svg, colorScale, dimensions) {
    const { width, height, margin } = dimensions;
    const legendWidth = 50;
    const legendHeight = 30;
    const itemWidth = 100;

    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - margin.right - legendWidth}, ${margin.top})`);

    const legendItems = legend.selectAll(".legend-item")
        .data(colorScale.domain())
        .enter().append("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(${i * itemWidth}, 0)`);

    legendItems.append("rect")
        .attr("width", 18)
        .attr("height", 18)
        .style("fill", colorScale);

    legendItems.append("text")
        .attr("x", 24)
        .attr("y", 9)
        .attr("dy", ".35em")
        .style("text-anchor", "start")
        .text(d => d)
        .style("font-size", "10px");

    return legend;
}