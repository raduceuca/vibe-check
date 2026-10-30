/*! Tidewell glaze configurator — intentional long tasks for long-task-attribution. */
(function (root) {
  var busy = function (ms) {
    var end = performance.now() + ms
    while (performance.now() < end) { /* spin */ }
  }

  var runBurst = function () {
    var i = 0
    var step = function () {
      busy(130)
      i += 1
      if (i < 6) setTimeout(step, 200)
    }
    step()
  }

  root.TidewellConfigurator = {
    onLoad: runBurst,
    onGlazeChange: runBurst,
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runBurst)
  } else {
    runBurst()
  }
})(typeof window !== 'undefined' ? window : globalThis);
