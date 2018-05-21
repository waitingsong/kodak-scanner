import { Actions, ColorKind, ScanOpts, WsEvent, WsOpts } from './model'

export const initialScanOpts: Partial<ScanOpts> = {
  color: ColorKind.trueColor,
  dpi:   200, // 100, 150, 200, 240, 300, 400, 600, 1200
  duplex:   false,
  path:   'c:/kodak-scan-tmp',
}

export const initialWsOpts: WsOpts = {
  host: 'ws://127.0.0.1',
  ports: [7181],
  keepAliveInterval: 60 * 1000, // msec
}

export const initialWsEvent: WsEvent = {
  action: Actions.noneAvailable,
}
