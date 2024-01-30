import { writable } from 'svelte/store'
import { ok } from './ok'
import { error } from './error'

function uuid({ short } = { short: false }) {
  let dt = new Date().getTime()
  const BLUEPRINT = short ? 'xyxxyxyx' : 'xxxxxxxx-xxxx-yxxx-yxxx-xxxxxxxxxxxx'
  const RESULT = BLUEPRINT.replace(/[xy]/g, function check(c) {
    const r = (dt + Math.random() * 16) % 16 | 0
    dt = Math.floor(dt / 16)
    return (c == 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
  return RESULT
}

/**
 * @typedef CreateEmitterPayload
 * @property {ReadableStreamDefaultController} controller
 * @property {{connected:boolean}} context
 */

/**
 *
 * @param {CreateEmitterPayload} payload
 * @returns {(eventName:string,data:string)=>import('./types').Unsafe<void>}}
 */
function createEmitter({ controller, context }) {
  let id = 1
  const encoder = new TextEncoder()

  return function emit(eventName, data) {
    if (!context.connected) {
      return error('Client disconnected from the stream.')
    }
    const typeOfEventName = typeof eventName
    const typeOfData = typeof data
    if (typeOfEventName !== 'string') {
      return error(
        `Event name must of type \`string\`, received \`${typeOfEventName}\`.`,
      )
    }
    if (typeOfData !== 'string') {
      return error(
        `Event data must of type \`string\`, received \`${typeOfData}\`.`,
      )
    }
    if (eventName.includes('\n')) {
      return error(
        `Event name must not contain new line characters, received "${eventName}".`,
      )
    }

    controller.enqueue(encoder.encode(`id: ${id}\nevent: ${eventName}\n`))
    const chunks = data.split('\n')
    for (const chunk of chunks) {
      try {
        controller.enqueue(
          encoder.encode(`data: ${encodeURIComponent(chunk)}\n`),
        )
      } catch (e) {
        return error(e)
      }
    }
    try {
      controller.enqueue(encoder.encode('\n'))
    } catch (e) {
      return error(e)
    }
    id++
    return ok()
  }
}

/**
 * @type {Map<string,NodeJS.Timeout>}
 */
const timeouts = new Map()
/**
 * @type {Map<string,import('svelte/store').Writable<boolean>>}
 */
const locks = new Map()

/**
 * @typedef StreamContext
 * @property {boolean} connected
 */

/**
 * @typedef CreateTimeoutAndLockPayload
 * @property {StreamContext} context
 * @property {number} timeout
 */

/**
 * @typedef CreateTimeoutPayload
 * @property {StreamContext} context
 * @property {import('svelte/store').Writable<boolean>} lock
 * @property {number} timeout
 */

/**
 *
 * @param {CreateTimeoutPayload} payload
 * @returns
 */
function createTimeout({ context, lock, timeout }) {
  return setTimeout(async function run() {
    if (!context.connected) {
      return
    }
    lock.set(false)
  }, timeout)
}

/**
 * @typedef CreateStreamPayload
 * @property {Start} start
 * @property {string} id
 * @property {import('svelte/store').Writable<boolean>} lock
 * @property {StreamContext} context
 * @property {number} timeout
 * @property {Cancel} [cancel]
 */

/**
 *
 * @param {CreateStreamPayload} payload
 * @returns
 */
function createStream({ start, id, lock, context, cancel, timeout }) {
  return new ReadableStream({
    async start(controller) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this

      const unsubscribe = lock.subscribe(async function run($lock) {
        if ($lock) {
          return
        }

        if (!context.connected) {
          unsubscribe()
          return
        }

        controller.close()
        context.connected = false

        if (cancel) {
          cancel(self)
        }

        unsubscribe()
      })

      timeouts.set(id, createTimeout({ context, timeout, lock }))

      const emit = createEmitter({ controller, context })

      start({ source: self, emit, lock })
    },
    cancel() {
      if (cancel) {
        lock.set(false)
      }
    },
  })
}

/**
 * @callback OnCancel
 * @param {UnderlyingDefaultSource<string>} stream
 * @returns {void|PromiseLike<void>}
 */

/**
 * @typedef Connection
 * @property {(eventName:string,data:string)=>import('./types').Unsafe<void>} emit Emit events to the client.\
 * The `Unsafe<void>` wrapper may contain an error
 * ## Example
 * ```js
 * const {error} = emit('message', 'hello world')
 * if(error){
 *  console.error(error)
 *  lock.set(false)
 *  return
 * }
 * ```
 * @property {import("svelte/store").Writable<boolean>} lock This store is initialized with `true`,
 * it prevents the underlying `Response` from resolving automatically.\
 * Set it to `false` in order to unlock the `Response` and end the stream immediately.
 *
 * > **Note**\
 * > You shouldn't `emit` any more events after setting the lock to `false`.\
 * > Attempting to emit more data afterwards will result into an error.
 * > ```js
 * > lock.set(false)
 * > const {error} = emit('message', 'hello world')
 * > if(error){
 * >  console.error(error) // "Client disconnected from the stream."
 * >  return
 * > }
 * > ```
 * @property {UnderlyingDefaultSource<string>} source
 */

/**
 * @callback Start
 * @param {Connection} payload
 * @returns {void|PromiseLike<void>}
 */

/**
 * @callback Cancel
 * @param {UnderlyingDefaultSource<string>} stream
 * @returns {void|PromiseLike<void>}
 */

/**
 * test
 * @typedef EventsPayload
 * @property {Request} request
 * @property {Start} start The stream has started, run all your logic inside this function.
 * > **Warning**\
 * > You should delegate all code that you would normally write directly under your `export function POST` function to this method instead.\
 * > That is because the whole endpoint is actually going to be used to collect beacon signals from the client in order to correctly detect inactivity or disconnected clients.\
 * > Beacon signals will be collected repeatedly (by default every `5 seconds`), thus, unless you want to collect that beacon data, you should put all your code inside this `start` function, which will get triggered only once per client connection: the first time they connect.
 * > ## Example
 * > ```js
 * > export function POST({ request }) {
 * > return events({
 * >  request,
 * >  timeout: 3000,
 * >  start({emit}) {
 * >    const notifications = [
 * >      { title: 'title-1', body: 'lorem...' },
 * >      { title: 'title-2', body: 'lorem...' },
 * >      { title: 'title-3', body: 'lorem...' },
 * >    ]
 * >    notifications.forEach(function pass(notification){
 * >      emit('notification', JSON.stringify(notification))
 * >    })
 * >  }
 * > })
}
 * > ```
 * @property {Record<string, string>} [headers]
 * @property {Cancel} [cancel] Do something when the stream is canceled.\
 * The following qualify as "canceling"
 * - Calling `.cancel` on the underlying `ReadableStream`
 * - Calling `lock.set(false)`
 * - Timeout due to missing beacon signals
 * @property {number} [timeout] A countdown in `milliseconds`.\
 * If it expires the stream ends immediately.\
 * Each client can send a beacon to the server to reset this timeout and keep the stream online.\
 * \
 * Beacons request must include only the stream id as a query string
 * ## Example
 * ```http
 * http://127.0.0.1:5757/events?
 * ```
 */

/**
 * Create one stream and emit multiple server sent events.
 * @param {EventsPayload} payload
 */
export function events({ start, cancel, request, headers, timeout = 7000 }) {
  /**
   * @type {StreamContext}
   */
  const context = { connected: true }
  const parts = request.url.split('?')
  let id = 2 === parts.length ? parts[1] ?? '' : ''

  if (id) {
    const timeoutOld = timeouts.get(id)
    const lock = locks.get(id)
    if (timeoutOld && lock) {
      clearTimeout(timeoutOld)
      timeouts.set(id, createTimeout({ timeout, context, lock }))
      locks.set(id, lock)
    }
    return new Response()
  }

  do {
    id = uuid({ short: false })
  } while (timeouts.has(id))

  const lock = writable(true)
  locks.set(id, lock)
  const stream = createStream({
    start,
    timeout,
    id,
    lock,
    cancel,
    context,
  })

  return new Response(stream, {
    //@ts-ignore
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/event-stream',
      'Connection': 'keep-alive',
      ...headers,
      'x-sse-id': id,
    },
  })
}
