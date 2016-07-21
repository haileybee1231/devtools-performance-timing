'use strict'
chrome.devtools.panels.create('Timing Viewer',
  'toast.png',
  'viewer.html',
  function (panel) {
    let runOnce
    panel.onShown.addListener(function(pwindow) {
      if (runOnce) {
        return
      }
      runOnce = true

      let firstTime = true

      // TODO use https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver
      function pollForMarks () {
        setTimeout(function () {
          const getMarks = 'JSON.stringify(window.performance.getEntriesByType("measure"))'
          chrome.devtools.inspectedWindow.eval(getMarks, function (stringifiedMarks) {
            const marks = JSON.parse(stringifiedMarks)

            const fn = firstTime ? render : update
            firstTime = false

            pwindow.requestAnimationFrame(() => {
              fn(marks, pwindow)
              pollForMarks()
            })
          })
        }, 500)
      }

      pollForMarks()
    })
  }
)

let width,
  height,
  axisHeight = 60,
  svg,
  gX,
  measureGroup,
  zoomable,
  d3,
  line

function render (measures, window) {
  const container = window.document.getElementsByClassName('container')[0]

  d3 = window.d3
  width = window.innerWidth,
  height = Math.max(window.innerHeight, 200)

  container.innerHTML = ''

  svg = d3.select(container).append('svg')
    .attr('width', width)
    .attr('height', height)

  gX = svg.append('g')
    .attr('class', 'axis')
    .attr('width', width)
    .attr('height', 60)
    .attr('transform', `translate(0,${height - axisHeight})`)

  measureGroup = svg
    .append('g')

  line = svg.append('g')

  line.append('line')
    .style('stroke', 'grey')
    .style('stroke-width', 0.5)
    .attr('x1', 0)
    .attr('y1', 0)
    .attr('x2', 0)
    .attr('y2', height - axisHeight)

  line.append('text')
    .text('help')

  zoomable = svg.append('rect')
    .attr('class', 'zoom')
    .attr('width', width)
    .attr('height', height)

  update(measures)
}

let xAxisScale
function update (measures) {
  const formatZeroSecondMillisecond = d3.timeFormat('%-Lms'),
    formatSecond = d3.timeFormat('%-S.%Ls'),
    multiFormat = function (date) {
      return (d3.timeSecond(date) < date && d3.timeSecond(date) < 1000 ? formatZeroSecondMillisecond : formatSecond)(date)
    },
    color = d3.scaleOrdinal(d3.schemeCategory10)

  const endTime = Math.max.apply(null, measures.map(d => d.startTime + d.duration))
  const x = d3.scaleLinear()
    .domain([0, endTime])
    .rangeRound([0, width])

  const y = d3.scaleBand()
    .domain(measures.map(d => d.name))
    .range([0, height - axisHeight])
    .padding(.1)

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
    .style('fill', d => color(d.name))
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

  zoomable
    .on('mousemove', function() {
      let coords = d3.mouse(this)

      line.attr('transform', `translate(${coords[0]}, 0)`)
      line.select('text')
        .attr('y', coords[1])
        .text(`${(xAxisScale || x).invert(coords[0]).toFixed(3)}ms`)
    })
    .on('mouseover', function() {
      let coords = d3.mouse(this)

      line.attr('transform', `translate(${coords[0]}, 0)`)
      line.select('text')
        .attr('y', coords[1])
        .text(`${(xAxisScale || x).invert(coords[0]).toFixed(3)}ms`)
    })

  zoomable
    .call(d3.zoom()
    .scaleExtent([1, Infinity])
    .translateExtent([[0, 0], [width, height]])
    .on('zoom', handleZoom))

  function handleZoom () {
    const t = d3.event.transform
    measureGroup.attr('transform', `translate(${t.x}, 0) scale(${t.k}, 1)`)
    // Un-scale text
    measureGroup.selectAll('text').attr('transform', `scale(${1/t.k}, 1)`)
    xAxisScale = d3.event.transform.rescaleX(x)
    gX.call(xAxis.scale(xAxisScale))
  }
}
