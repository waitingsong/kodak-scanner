import { interval, of, Observable, Subject, Subscription } from 'rxjs'
import {
  catchError,
  combineAll,
  concatMap,
  filter,
  map,
  mapTo,
  skipWhile,
  switchMap,
  take,
  takeWhile,
  tap,
  withLatestFrom,
} from 'rxjs/operators'

import { initialScanOpts, initialWsEvent, initialWsOpts } from './config'
import {
  Actions,
  ColorKind,
  InitialWsOpts,
  MsgId,
  ScanOpts,
  ScanOptsKeys,
  SendArgs,
  SrvEvent,
  SrvMethod,
  WsEvent,
  WsOpts,
  WsRecvData,
  WsSendData,
} from './model'
import RxWebsocketSubject from './rxws'


let globalMsgId: MsgId = 0


export class Scanner {
  subject: Subject<WsEvent>
  private wsSubject: RxWebsocketSubject<WsRecvData> | null
  private wsSub: Subscription | null
  private keppAliveSub: Subscription | null
  private subjectSub: Subscription
  private reqMap: Map<MsgId, Observable<any>>

  constructor(public scanOpts: Partial<ScanOpts>, public options: WsOpts) {
    this.keppAliveSub = null
    this.reqMap = new Map()
    this.subject = new Subject()
    this.subjectSub = this.innerSubscribe()
    this.wsSubject = null
    this.wsSub = null
  }


  connect(): Observable<null> {
    this.disconnect()
    this.wsSubject = new RxWebsocketSubject(`${this.options.host}:${this.options.ports[0]}`)

    return this.wsSubject.connectionStatus.pipe(
      filter(connected => connected),
      take(1),
      mapTo(null),
      tap(() => {
        this.subject.next({ ...initialWsEvent, action: Actions.wsConnected })

        this.wsSub = (<RxWebsocketSubject<WsRecvData>> this.wsSubject).subscribe(
          data => this.handleMsgEventData(data),

          data => this.subject.next({
            ...initialWsEvent,
            action: Actions.wsClosedException,
            payload: data,
          }),

          () => this.subject.next({
            ...initialWsEvent,
            action: Actions.wsClosed,
          }),
        )

        if (this.wsSubject) {
          this.setScanOptions()
            .pipe(tap(() => this.keppAlive()))
            .subscribe()
        }
      }),
    )
  }


  disconnect() {
    this.wsSub && this.wsSub.unsubscribe()
    this.wsSubject && this.wsSubject.unsubscribe()
    this.keppAliveSub && this.keppAliveSub.unsubscribe()
    this.keppAliveSub = this.wsSub = this.wsSubject = null
    this.clearReqObb()

    this.subject.next({ ...initialWsEvent, action: Actions.wsDisconnected })
  }

  destroy() {
    this.disconnect()
    this.subjectSub && this.subjectSub.unsubscribe()
  }

  showScanSource() {
    return this.sendMsg<void>(SrvMethod.showScanSource)
  }

  setScanPath(path: string) {
    return this.sendMsg<void>(SrvMethod.setScanPath, {
      path: path ? path : this.scanOpts.path,
    })

  }

  // wait ttl:sec/intv: msec
  waitScannerReady(ttl: number = 60, intv: number = 2000) {
    if (intv < 500) {
      intv = 1000
    }
    const limit = ttl > 0 ? Math.ceil(ttl / intv * 1000) : 60

    return interval(intv).pipe(
      take(limit), // timeout 60s
      switchMap(_ => this.isReadyScan()),
      catchError(err => {
        this.subject.next({
          ...initialWsEvent,
          action: Actions.exception,
          msg: 'waitScannerReady timeout',
          err,
        })

        return of(false)
      }),
      filter(ready => ready),
      take(1),
    )
  }


  scan(): Observable<string[]> {
    const scan$ = this.sendMsg<void>(SrvMethod.scan, {
      scanmodel: 0,
      position: 0,
    })

    return this.waitScannerReady()
      .pipe(
        switchMap(() => scan$),
        switchMap(() => this.waitScannerReady(300, 3000)),  // suspect every batch scan maximum duration 5min
        concatMap(() => this.getFileList()),
      )
  }

  setScanOptions(options?: Partial<ScanOpts>): Observable<void> {
    let opts: Partial<ScanOpts> = { ...this.scanOpts }

    if (options) {
      opts = options ? { ...initialScanOpts, ...options } : { ...initialScanOpts }
      this.scanOpts = { ...opts }
    }
    const arr = <Array<Observable<any>>> []

    for (const key of Object.keys(opts)) {
      // @ts-ignore
      if (typeof key === 'undefined' || typeof opts[key] === 'undefined') {
        continue
      }
      switch (key) {
        case ScanOptsKeys.setBrightness:
          arr.push(this.setBrightness(<number> opts[key]))
          break

        case ScanOptsKeys.setColor:
          arr.push(this.setColor(<number> opts[key]))
          break

        case ScanOptsKeys.setDPI:
          arr.push(this.setDPI(<number> opts[key]))
          break

        case ScanOptsKeys.setDuplex:
          arr.push(this.setDuplex(<boolean> opts[key]))
          break

        case ScanOptsKeys.setScanPath:
          arr.push(this.setScanPath(<string> opts[key]))
          break
      }
    }

    const combined$ = of(...arr)
      .pipe(
        concatMap(ret => of(ret)),
        combineAll(),
        mapTo(void 0),
      )

    return combined$
  }


  isReadyScan() {
    return this.sendMsg<string[]>(SrvMethod.scanStatus)
      .pipe(
        map(ret => ret && ret[0] === 'idle' ? true : false),
      )
  }

  getFileList(path?: string): Observable<string[]> {
    return this.sendMsg<string[]>(SrvMethod.getFileList, {
      path: path ? path : this.scanOpts.path,
    })
  }

  clearAll(path?: string) {
    return this.sendMsg<void>(SrvMethod.clearAll, {
      path: path ? path : this.scanOpts.path,
    })
  }

  setDuplex(duplex: boolean) {
    return this.sendMsg<void>(SrvMethod.setDuplex, { ivalue: duplex ? 1 : 0 })
  }

  // 0-100
  setBrightness(value: number) {
    return this.sendMsg<void>(SrvMethod.setBrightness, { ivalue: +value })
  }

  // 0:blackwhite, 1:gray, 2:trueColor
  setColor(kind: ColorKind) {
    return this.sendMsg<void>(SrvMethod.setColor, { ivalue: kind })
  }

  // 100, 150, 200, 240, 300, 400, 600, 1200
  setDPI(value: number) {
    return this.sendMsg<void>(SrvMethod.setDPI, { ivalue: +value })
  }

  /* -------- private --------------- */

  private innerSubscribe() {
    return this.subject.subscribe(ev => {
      // console.info('inner ev:', ev)
      switch (ev.action) {
        case Actions.ready:
          break
      }
    })
  }

  private sendMsg<T>(methodName: string, args?: SendArgs): Observable<T> {
    const pdata = this.parseSendOpts(methodName, args)

    if (this.wsSubject) {
      return this.createReqObb<T>(pdata)
    }
    else {
      this.subject.next({
        ...initialWsEvent,
        action: Actions.wsNoneAvailable,
        payload: pdata,
      })
      throw new Error(Actions.wsNoneAvailable)
    }
  }


  // parse response request by client
  private parseReqResponse<T>(data: WsRecvData): T {
    const event = { ...initialWsEvent, payload: data }

    event.msgId = +data.msg_id

    // @DEBUG
    // data.err = 1

    if (!data.err) {
      event.action = Actions.wsRecv
      this.subject.next(event)

      return <T> data.dat
    }
    else {
      event.action = Actions.wsRecvException
      event.msg = data.msg
      this.subject.next(event)

      throw new Error(data.msg ? data.msg : 'response error')
    }
  }


  private handleMsgEventData(data: WsRecvData): void {
    const event = { ...initialWsEvent, payload: data }

    if (! data) {
      event.action = Actions.invalidRecvedData
      this.subject.next(event)
      return
    }

    if (Number.isNaN(+data.msg_id)) {  // by server push
      this.handlePushMsg(data)
    }
    else {  // by client request
    }
  }

  private handlePushMsg(data: WsRecvData): void {
    const event = { ...initialWsEvent, payload: data }
    const str = data.msg_id

    if (typeof str === 'string') {
      // @ts-ignore
      const eventName = SrvEvent[str]

      event.action = eventName ? eventName : SrvEvent.onUnknownEvent
    }
    else {
      event.action = SrvEvent.onUnknownEvent
    }

    this.subject.next(event)
  }


  private createReqObb<T>(pdata: WsSendData): Observable<T> {
    const req$ = of(+pdata.msg_id).pipe(
      takeWhile(_ => !! this.wsSubject),
      tap(_ => {
        this.wsSubject && this.wsSubject.send(pdata)
        this.subject.next({
          ...initialWsEvent,
          action: Actions.wsSend,
          msgId: +pdata.msg_id,
          msg: pdata.fun,
        })
      }),
    )
    const subject = (<Subject<WsRecvData>> new Subject())
    const ret$ = subject.pipe(
      // tap(val => { debugger }),
      withLatestFrom(req$),
      skipWhile(arr => {
        const [res, msgId] = arr
        return +res.msg_id !== msgId
      }),
      map(arr => arr[0]),
      tap(res => this.unregReqObb(+res.msg_id)),
      map(res => this.parseReqResponse<T>(res)),
      take(1),  // !
    )

    this.wsSubject && this.wsSubject.subscribe(subject)
    this.regReqObb(+pdata.msg_id, ret$)

    return ret$
  }

  private regReqObb(key: MsgId, req$: Observable<any>) {
    this.reqMap.set(+key, req$)
  }

  // private getReqObb(key: MsgId): Observable<any> | void {
  //   return this.reqMap.get(+key)
  // }

  private unregReqObb(key: MsgId) {
    this.reqMap.delete(key)
  }

  private clearReqObb() {
    this.reqMap.clear()
  }




  private parseSendOpts(methodName: string, args?: SendArgs): WsSendData {
    globalMsgId += 1
    if (! Number.isSafeInteger(globalMsgId)) {
      globalMsgId = 1
    }
    const ret = <WsSendData> {
      fun: methodName,
      msg_id: String(globalMsgId), // serial from client or event name from server such as 'onUsbkeyChange'
    }

    if (typeof args === 'undefined') {
      return ret
    }
    else if (args && typeof args === 'object') {
      return <WsSendData> { ...args, ...ret }
    }

    return ret
  }


  private keppAlive() {
    if (this.wsSubject && this.wsSub && ! this.wsSub.closed) {
      // this.wsSubject.subscribe()
      const intvValue = this.options.keepAliveInterval

      if (intvValue > 0) {
        this.keppAliveSub = interval(intvValue)
          .pipe(
            take(1000),
            switchMap(() => this.isReadyScan()),
        )
          .subscribe()
      }
    }
  }

} // END of class


export function init(scanOptions?: Partial<ScanOpts>, wsOptions?: InitialWsOpts): Scanner {
  const wsOpts = parseOptions(wsOptions)
  const scanOpts = scanOptions ? { ...initialScanOpts, ...scanOptions } : { ...initialScanOpts }

  return new Scanner(scanOpts, wsOpts)
}


function parseOptions(options?: InitialWsOpts) {
  const opts = <WsOpts> options ? { ...initialWsOpts, ...options } : { ...initialWsOpts }

  return opts
}
