/* eslint-disable */

function initScanner(init) {
  // default options
  // const scanOpts = {
  //   color: 2,
  //   duplex: false,
  //   dpi: 200,
  //   path: 'c:/kodak-scan-tmp',
  // }
  // const scanner = init(scanOpts)
  const scanner = init()

  subscribeEvent(scanner)
  scanner.connect().subscribe(
    connected => console.log('connected'),
    err => console.log('connect fail'),
    () => console.log('connected or connect fail timeout'),
  )
  window.scanner = scanner
}


function subscribeEvent(scanner) {
  scanner.subject.subscribe(ev => {
    console.log('outer ev:', ev)
  })
}


function scan(btn) {
  const { of } = rxjs
  const { catchError, concatMap, skipWhile, timeout, tap } = rxjs.operators

  btn.disabled = true
  const stream$ = scanner.scan()
    .pipe(
      timeout(120 * 1000),  // 120s
    )

  stream$.subscribe(
    fileList => {
      console.info('fileList:', fileList)
    },
    err => {
      btn.disabled = false
      console.error('got error:', err)
    },
    complete => {
      btn.disabled = false
    },
  )
}

function scan2(btn) {
  const { of } = rxjs
  const { timeout, skipWhile, concatMap, catchError } = rxjs.operators

  // scanner.isReadyScan().subscribe(flag => {
  //   console.log('scan ready?', flag)
  // })

  btn.disabled = true
  const opts = {
    color: 2,
    duplex: false,
    dpi: 150,
  }
  const stream$ = scanner.setScanOptions(opts)
    .pipe(
      concatMap(() => scanner.scan()),
      timeout(120 * 1000),  // 120s
    )

  stream$.subscribe(
    fileList => {
      console.info('fileList:', fileList)
    },
    err => {
      btn.disabled = false
      console.error('got error:', err)
    },
    complete => {
      btn.disabled = false
    },
  )

}
