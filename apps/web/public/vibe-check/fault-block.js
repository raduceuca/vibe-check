/* Deliberate main-thread freeze for the landing FaultBench. Five ~120ms tasks. */
;(function () {
  for (var i = 0; i < 5; i++) {
    var end = performance.now() + 120
    while (performance.now() < end) {
      // busy wait
    }
  }
})()
