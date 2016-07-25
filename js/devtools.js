'use strict'

chrome.devtools.panels.create('Timing Viewer',
  'toast.png',
  'viewer.html',
  function (panel) {
    let runOnce
    panel.onShown.addListener(function (pwindow) {
      if (runOnce) {
        return
      }
      runOnce = true

      let fullRender = true
      let count = 0

      //renderControls(pwindow, [])

      //chrome.devtools.inspectedWindow.eval(`window.performance.mark('a')`)

      //pwindow.setTimeout(() => {
        //chrome.devtools.inspectedWindow.eval(`window.performance.mark('b')`)
      //}, 1500)

      //const cmd = 'JSON.stringify(window.performance.getEntriesByType("mark"))'

      /*
      pwindow.setTimeout(() => {
        chrome.devtools.inspectedWindow.eval(cmd, function (stringifiedMarks) {
          console.log(stringifiedMarks)
        })
      }, 4000)
      */

      pwindow.onresize = () => { fullRender = true }

      // TODO use https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver
      function pollForMarks () {
        setTimeout(function () {
          const getMarks = 'JSON.stringify(window.performance.getEntriesByType("mark"))'
          const getMeasures = 'JSON.stringify(window.performance.getEntriesByType("measure"))'
          chrome.devtools.inspectedWindow.eval(getMeasures, function (stringifiedMeasures) {
            const measures = JSON.parse(stringifiedMeasures)

            // No new data
            if (!fullRender && count === measures.length) {
              pollForMarks()
              return
            }

            count = measures.length

            const fn = fullRender ? render : update
            fullRender = false

            pwindow.requestAnimationFrame(() => {
              chrome.devtools.inspectedWindow.eval(getMarks, function (stringifiedMarks) {
                console.log(stringifiedMarks)
                const marks = JSON.parse(stringifiedMarks)
                renderControls(pwindow, marks)
              })

              fn(measures, pwindow)
              pollForMarks()
            })
          })
        }, 100)
      }

      pollForMarks()
    })
  }
)

/*** Controls ***/

function renderControls (window, marks) {
  const { Component, h, render } = window.preact

  function createMeasure () {
    const options = window.document.getElementsByTagName('option')

    if (options.length) {
      const compareMarks = Array.from(options).filter(option => !!option.selected).map(option => option.value)
      if (compareMarks.length === 2) {
        const [a, b] = compareMarks

        const cmd = `window.performance.measure("${a} to ${b}", "${a}", "${b}")`
        chrome.devtools.inspectedWindow.eval(cmd)
      }
    }
  }

  const Controls = () => {
    return h('div', null,
             h(Header),
             h(Marks),
             h('button', { onclick: createMeasure}, 'Create Measure'))
  }

  const Header = () => {
    return h('header', null,
             h('h3', null, 'Select two marks'))
  }

  const Marks = () => {
    return h('select', { className: 'marks', multiple: 'multiple', size: 16 },
               marks.map(mark => h('option', { value: mark.name }, mark.name)))
  }
  window.document.getElementById('controls').innerHTML = ''
  render(h(Controls), window.document.getElementById('controls'))
}

/*** Chart ***/

let width,
  height,
  axisHeight = 20,
  svg,
  gX,
  measureGroup,
  zoomable,
  d3,
  line,
  margin = { top: 0, right: 10, bottom: 0, left: 10 }

function render (measures, window) {
  const chart = window.document.getElementById('chart')

  d3 = window.d3
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

  function updateLine () {
    let coords = d3.mouse(this)

    const time = (xAxisScale || x).invert(coords[0])
    line.attr('transform', `translate(${coords[0]}, 0)`)

    if (time !== -Infinity) {
      line.select('text')
        .attr('y', coords[1])
        .text(`${time.toFixed(3)}ms`)
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
