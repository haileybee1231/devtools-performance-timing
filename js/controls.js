/*** Controls ***/

window.renderControls = function (marks) {
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
    const chronologicalMarks = marks.slice().sort((a, b) => a.startTime - b.startTime)
    return h('select', { className: 'marks', multiple: 'multiple', size: 16 },
             chronologicalMarks.map(mark => h('option', { value: mark.name }, mark.name)))
  }

  window.document.getElementById('controls').innerHTML = ''
  render(h(Controls), window.document.getElementById('controls'))
}
