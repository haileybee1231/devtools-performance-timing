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

      const d3 = pwindow.d3

      setTimeout(function () {
        const getMarks = 'JSON.stringify(window.performance.getEntriesByType("measure"))'
        chrome.devtools.inspectedWindow.eval(getMarks, function (stringifiedMarks) {
          const marks = JSON.parse(stringifiedMarks)

          console.table(marks)
          console.log(marks)

          render(pwindow, d3, marks)
        })
      }, 5000)
    })
  }
)

function render(window, d3, marks) {
  const container = window.document.getElementsByClassName('container')[0]

  const width = container.offsetWidth
  const height = Math.max(container.offsetHeight, 200)

  container.innerHTML = ''

  const color = d3.scaleOrdinal()
    .range(['#98abc5', '#8a89a6', '#7b6888', '#6b486b', '#a05d56', '#d0743c', '#ff8c00'])

  const svg = d3.select(container).append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')

  const endTime = Math.max.apply(null, marks.map(m => m.startTime + m.duration))
  const axisHeight = 60

  const x = d3.scaleLinear()
    .domain([0, endTime])
    .rangeRound([0, width])

  const y = d3.scaleBand()
    .domain(marks.map(function(d) {
      return d.name
    }))
    .range([0, height - axisHeight])
    .padding(.1)

  function zoomed() {
    const t = d3.event.transform
    groups.attr('transform', `translate(${t.x}, 0) scale(${t.k}, 1)`);
    // Un-scale text
    groups.selectAll('text').attr('transform', `scale(${1/t.k}, 1)`)
    gX.call(xAxis.scale(d3.event.transform.rescaleX(x)));
  }

  const xAxis = d3.axisBottom(x).tickFormat(multiFormat)

  const formatZeroSecondMillisecond = d3.timeFormat("%-Lms")
  formatSecond = d3.timeFormat("%-S.%Ls")

  function multiFormat(date) {
    return (d3.timeSecond(date) < date && d3.timeSecond(date) < 1000 ? formatZeroSecondMillisecond : formatSecond)(date);
  }

  const gX = svg
    .append('g')
    .attr('class', 'axis')
    .attr('width', width)
    .attr('height', 60)
    .attr('transform', `translate(0,${height - axisHeight})`)
    .call(xAxis)

  const groups = svg
    .append('g')

  const items = groups.selectAll('.mark')
    .data(marks)
    .enter()
    .append('g')
    .attr('class', 'mark')
    .attr('transform', d => `translate(${x(d.startTime)},${y(d.name)})`)

  items.append('rect')
    .attr('height', y.bandwidth())
    .attr('width', d => x(d.duration)) // TODO change marks[0].startTime to domain[0]
    .style('fill', d => color(d.name))

  items.append('text')
    .attr('x', () => 10)
    .attr('y', y.bandwidth() / 2 + 4) // 4 is about half the line height??
    //.style('text-anchor', 'middle')
    .text(d => d.name)

  svg.append('rect')
    .attr('class', 'zoom')
    .attr('width', width)
    .attr('height', height)
    .call(d3.zoom()
      .scaleExtent([1, Infinity])
      .translateExtent([
        [0, 0],
        [width, height]
      ])
      .on('zoom', zoomed))
}
