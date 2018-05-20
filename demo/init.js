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
  const { skipWhile, delay, concat, concatMap, catchError, switchMap } = rxjs.operators

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
      concatMap(() => {
        return scanner.getFileList()
      }),
      catchError(err => {
        console.error(err)
        return of([])
      }),
  )

  stream$.subscribe(fileList => {
    console.info('fileList:', fileList)
  })

}
