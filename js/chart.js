/*** Chart ***/

let width,
  height,
  axisHeight = 20,
  svg,
  gX,
  measureGroup,
  zoomable,
  line,
  margin = { top: 0, right: 10, bottom: 0, left: 10 }

window.render = function (measures) {
  const chart = window.document.getElementById('chart')

  width = chart.offsetWidth - margin.left - margin.right,
  // TODO figure out why height is a few pixels too big
  height = window.innerHeight - margin.top - margin.bottom - 3

  chart.innerHTML = ''

  svg = d3.select(chart).append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
    .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`)

  gX = svg.append('g')
    .attr('class', 'axis')
    .attr('width', width)
    .attr('height', axisHeight)
    .attr('transform', `translate(0, ${height - axisHeight})`)

  measureGroup = svg.append('g')

  line = svg.append('g')

  line.append('line')
    .style('stroke', 'grey')
    .style('stroke-width', 0.5)
    .attr('x1', 0)
    .attr('y1', 0)
    .attr('x2', 0)
    .attr('y2', height - axisHeight)

  line.append('text')
    .attr('x', 5)

  zoomable = svg.append('rect')
    .attr('class', 'zoom')
    .attr('width', width)
    .attr('height', height)

  update(measures)
}

let xAxisScale
let color = d3.scaleOrdinal(d3.schemeCategory10)
window.update = function (measures) {
  const formatZeroSecondMillisecond = d3.timeFormat('%-Lms'),
    formatSecond = d3.timeFormat('%-S.%Ls'),
    multiFormat = function (date) {
      return (d3.timeSecond(date) < date && d3.timeSecond(date) < 1000 ? formatZeroSecondMillisecond : formatSecond)(date)
    }

  const endTime = Math.max.apply(null, measures.map(d => d.startTime + d.duration))
  const x = d3.scaleLinear()
    .domain([0, endTime])
    .rangeRound([0, width])

  const y = d3.scaleBand()
    .domain(measures.map(d => d.name))
    .range([0, height - axisHeight])
    .padding(.15)

  // a join fn is most definitely not needed because measures can only be added and are never updated, but I'm adding one anyway to reinforce d3 learnings.
  const measureSelection = measureGroup.selectAll('.measure')
    .data(measures, d => d.name)
  const measureEnter = measureSelection.enter()
  const measureExit = measureSelection.exit()

  const t = d3.transition()
   .duration(750)

  // Update existing items
  measureSelection
    .transition(t)
    .attr('transform', d => `translate(${x(d.startTime)},${y(d.name)})`)

  measureSelection.selectAll('text')
    .transition(t)
    .attr('y', y.bandwidth() / 2 + 4)

  measureSelection.selectAll('rect')
    .transition(t)
    .attr('height', y.bandwidth())
    .attr('width', d => x(d.duration))

  const newMeasures = measureEnter.append('g')
    .attr('class', 'measure')

  // Operations to new items only
  newMeasures
    .attr('transform', d => `translate(${x(d.startTime)},${y(d.name)})`)

  newMeasures.append('rect')
    .style('fill', d => { console.log(d.name, color(d.name)); return color(d.name)})
    .attr('width', () => x(0))
    .attr('height', y.bandwidth())
    .transition(t)
    .attr('width', d => x(d.duration)) // TODO change measures[0].startTime to domain[0]

  newMeasures.append('text')
    .attr('x', () => 10)
    .attr('y', y.bandwidth() / 2 + 4)
    .text(d => d.name)

  measureExit.remove()

  const xAxis = d3.axisBottom(x).tickFormat(multiFormat)

  gX.call(xAxisScale ? xAxis.scale(xAxisScale) : xAxis)

  function updateLine () {
    let coords = d3.mouse(this)

    const time = (xAxisScale || x).invert(coords[0])
    line.attr('transform', `translate(${coords[0]}, 0)`)

    if (time !== -Infinity) {
      line.select('text')
        .attr('y', coords[1])
        .text(`${time.toFixed(3)}ms`)
        .attr('x', function () {
          let textWidth = d3.select(this).node().getBBox().width
          let mouseNearRightEdge = coords[0] > width - textWidth
          return mouseNearRightEdge ? -1 * textWidth - 5 : 5
        })
    }
  }

  zoomable
    .on('mousemove', updateLine)
    .on('mouseover', updateLine)

  zoomable
    .call(d3.zoom()
      .scaleExtent([1, Infinity])
      .translateExtent([[0, 0], [width, height]])
      .on('zoom', handleZoom))

  /* http://stackoverflow.com/questions/38534875/can-i-use-zoom-translateby-to-set-an-initial-pan
  .scaleBy(2)
  .translateBy(x(100), 0)
  */

  function handleZoom () {
    const t = d3.event.transform
    measureGroup.attr('transform', `translate(${t.x}, 0) scale(${t.k}, 1)`)
    // Un-scale text
    measureGroup.selectAll('text').attr('transform', `scale(${1/t.k}, 1)`)
    xAxisScale = d3.event.transform.rescaleX(x)
    gX.call(xAxis.scale(xAxisScale))
  }
}
