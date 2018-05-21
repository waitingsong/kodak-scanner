/* eslint-disable */

function initScanner(init) {
  const scanner = init()

  subscribeEvent(scanner)
  scanner.connect()
  window.scanner = scanner
}


function subscribeEvent(scanner) {
  scanner.subject.subscribe(ev => {
    console.log('outer ev:', ev)
  })
}


function scan() {
  const { of } = rxjs
  const { timeout, skipWhile, concatMap, catchError } = rxjs.operators

  // scanner.isReadyScan().subscribe(flag => {
  //   console.log('scan ready?', flag)
  // })

  const opts = {
    color: 2,
    duplex: false,
    dpi: 200,
  }
   const stream$ = scanner.setScanOptions(opts)
    .pipe(
      concatMap(() => scanner.scan()),
      concatMap(() => scanner.getFileList()),
      timeout(120 * 1000),  // 120s
  )

  stream$.subscribe(
    fileList => {
      console.info('fileList:', fileList)
    },
    err => console.error('got error:', err),
  )

}
