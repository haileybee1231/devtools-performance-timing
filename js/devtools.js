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
        const getMarks = 'JSON.stringify(window.performance.getEntriesByType("mark"))'
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

function render (window, d3, marks) {
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

  const y = d3.scaleBand()
    .domain(marks.map(function(d) {
      return d.name
    }))
    .range([0, height])
    .padding(.1)

  const pointWidth = 200
  const x = d3.scaleLinear()
    .domain([0, marks[marks.length - 1].startTime])
    .rangeRound([0, width - pointWidth])

  // change state group to be positioned in the y now instead of x
  const groups = svg.selectAll('.marks')
    .data(marks)
    .enter()
    .append('g')
      .attr('class', 'g')
      .attr('transform', d => `translate(${x(d.startTime)},${y(d.name)})`)

  groups.append('rect')
        .attr('height', y.bandwidth())
        //.attr('x', d => x(d.startTime)) // this is the horizontal position in the stack
        .attr('width', d => pointWidth) // this is the horizontal "height" of the bar
        .style('fill', d => color(d.name))

  groups.append("text")
    .attr('x', pointWidth / 2)
    .attr('y', y.bandwidth() / 2 + 4) // 4 is about half the line height??
    .style('text-anchor', 'middle')
    .text(d => d.name)
}
