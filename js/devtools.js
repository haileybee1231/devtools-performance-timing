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
      let count = {}

      pwindow.onresize = () => { fullRender = true }

      // TODO use https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver
      function poll () {
        setTimeout(render, 100)
      }

      poll()

      function getData (expression, cb) {
        chrome.devtools.inspectedWindow.eval(`JSON.stringify(${expression})`, function (result) {
          cb(JSON.parse(result))
        })
      }

      function getNavigationMarks (cb) {
        const getNavigationTimings = `Object.getOwnPropertyNames(PerformanceTiming.prototype).map(name => ({ name: name, startTime: window.performance.timing[name] })).filter(n => !isNaN(n.startTime))`
        getData(getNavigationTimings, (navMarks) => {
          const compareStart = (a, b) => a.startTime - b.startTime
          const start = navMarks.map(n => n.startTime).sort(compareStart)[0]
          navMarks.forEach(n => { n.startTime -= start })
          cb(navMarks)
        })
      }

      function query (cb) {
        getData('window.performance.getEntriesByType("measure")', function (measures) {
          getData('window.performance.getEntriesByType("mark")', function (perfMarks) {
            getNavigationMarks(navMarks => {
              const marks = navMarks.concat(perfMarks)
              cb(marks, measures)

            })})})
      }

      function render () {
        query((marks, measures) => {
          // No new data
          if (!fullRender && count.measures === measures.length && count.marks === marks.length) {
            poll()
            return
          }

          count.measures = measures.length
          count.marks = marks.length

          const fn = fullRender ? pwindow.render : pwindow.update
          fullRender = false
          pwindow.requestAnimationFrame(() => {
            pwindow.renderControls(marks)
            fn(measures)
            poll()
          })
        })
      }
    })
  }
)
