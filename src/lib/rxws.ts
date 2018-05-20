import { interval, Observable, Observer, Subject } from 'rxjs'
import { distinctUntilChanged, share, takeWhile } from 'rxjs/operators'
import { WebSocketSubject, WebSocketSubjectConfig } from 'rxjs/websocket'


// https://stackoverflow.com/questions/38108814/rx-observable-websocket-immediately-complete-after-reconnect
export default class RxWebsocketSubject<T> extends Subject<T> {
  public connectionStatus: Observable<boolean>
  private connectionObserver: Observer<boolean> | null
  private reconnectionObservable: Observable<number> | null
  private socketSub: WebSocketSubject<any> | null
  private wsSubjectConfig: WebSocketSubjectConfig<any>


  constructor(
    private url: string,
    private reconnectInterval = 5000,
    private reconnectAttempts = 10,
    private resultSelector?: (e: MessageEvent) => any,
    private serializer?: (data: any) => string,
  ) {
    super()

    this.reconnectionObservable = null
    this.socketSub = null
    this.connectionObserver = null

    this.connectionStatus = new Observable<boolean>(observer => {
      this.connectionObserver = observer
    })
      .pipe(
        share(),
        distinctUntilChanged(),
      )

    if (! this.resultSelector) {
      this.resultSelector = this.defaultResultSelector
    }
    if (! this.serializer) {
      this.serializer = this.defaultSerializer
    }

    this.wsSubjectConfig = {
      url: this.url,
      closeObserver: {
        next: (ev: CloseEvent) => {
          this.socketSub = null
          this.connectionObserver && this.connectionObserver.next(false)
        },
      },
      openObserver: {
        next: (ev: Event) => {
          this.connectionObserver && this.connectionObserver.next(true)
        },
      },
    }

    this.connect()
    this.connectionStatus.subscribe(isConnected => {
      if (!this.reconnectionObservable && !isConnected) {
        this.reconnect()
      }
    })
  }


  defaultResultSelector(e: MessageEvent) {
    return JSON.parse(e.data)
  }

  defaultSerializer(data: any): string {
    return JSON.stringify(data)
  }

  connect() {
    this.socketSub = new WebSocketSubject(this.wsSubjectConfig)
    this.socketSub.subscribe(
      msg => { this.next(msg) },
      (error: Event) => {
        this.socketSub || this.reconnect()
      },
    )
  }

  reconnect() {
    this.reconnectionObservable = interval(this.reconnectInterval)
      .pipe(
        takeWhile((v, index) => {
          return index < this.reconnectAttempts && !this.socketSub
        }),
      )

    this.reconnectionObservable.subscribe(
      () => this.connect() ,
      err => console.info(err),
      () => {
        this.reconnectionObservable = null
        if (!this.socketSub) {
          this.complete()
          this.connectionObserver && this.connectionObserver.complete()
        }
      },
    )
  }


  send(data: any): void {
    if (this.socketSub && this.serializer) {
      // const dataNew = this.serializer(data)

      this.socketSub.next(data)
    }
  }
}
