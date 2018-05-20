export type MsgId = number
// normal callback or resolve of Promise
export type MsgQueueCb = (value: string | number) => void

export interface SendArgs {
  [param: string]: string | number | void
}


export interface WsSendData extends SendArgs {
  fun: string
  msg_id: string // string of msgId
}

export interface WsRecvData {
  msg_id: string // String(msgId)
  err: number // 0:succ
  msg?: string
  dat?: any
}


export interface WsOpts {
  host: string
  ports: number[]
  keepAliveInterval: number
  scanPath: string
}

export interface InitialWsOpts extends Partial<WsOpts> { }


export const enum Actions {
  exception = 'exception',
  initial = 'initial',
  invalidRecvedData = 'invalidRecvedData',
  invalidRecvSubject = 'invalidRecvMsgSubject',
  noneAvailable = 'eventNoneAvailable',
  ready = 'ready',
  wsConnected = 'connected',
  wsClosed = 'socketClosed',
  wsClosedException = 'socketClosedWithException',
  wsDisconnected = 'disconnected',
  wsNoneAvailable = 'wsNoneAvailable',
  wsSend = 'wsSend',
  wsRecv = 'wsRecv',
  wsRecvException = 'wsRecvException',
}

export interface WsEvent {
  action: Actions | SrvEvent
  err?: Error
  msg?: string
  msgId?: MsgId
  payload?: WsRecvData | WsSendData
}

// ws服务端调用方法
export const enum SrvMethod {
  clearAll = 'allclear',  // remove all images and index file
  getFileList = 'Filelist',  // fetch image files list
  imgToBase64 = 'ImgToBase64String',
  removeImg = 'remove',  // remove one image
  rotateImg = 'ImageRotation',
  scan = 'scan',
  scanStatus = 'scanstatus',
  setDuplex = 'setduplex',  // setup duplex scan
  setBrightness = 'setbrightness',
  setColor = 'setcolor',  //
  setContrast = 'setcontrast',
  setDPI = 'setdpi',
  setScanPath = 'setscanpath',
  showScanSource = 'scansource',  // open dialog to select source
  showSetup = 'showsetup',  // open dialog for setup
}

// ws服务端推送事件名
export enum SrvEvent {
  onDebugChange = 'debugChange',
  onUnknownEvent = 'unknownEvent',
}

export enum ColorKind {
  blackwhite, // 0
  gray, // 1
  trueColor,  // 2
}

export interface ScanOpts {
  brightness: number
  color: ColorKind
  dpi: number // 100, 150, 200, 240, 300, 400, 600, 1200
  duplex: boolean
  path: string  // save scan images
}

export const enum ScanOptsKeys {
  setBrightness = 'brightness',
  setColor = 'color',
  setDPI = 'dpi',
  setDuplex = 'duplex',
  setScanPath = 'path',
}
