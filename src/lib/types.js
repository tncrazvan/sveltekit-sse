export {}

/**
 * @template T
 * @template [E = Error]
 * @typedef {{value:T,error:false|E}} Unsafe
 */

/**
 * @typedef ClosePayload
 * @property {string} [reason]
 */

/**
 * Describes an event before being serialized.
 * @typedef Event
 * @property {string} id Message identifier, it identifies a message\
 * This value is not globally unique, it is only unique within the current stream's scope.
 * @property {string} event Name of the event.
 * @property {string} data Message data.
 * @property {boolean} isLocal If `true` then this event has been emitted locally, not by the server.
 * @property {number} status The status code of the underlying http response.
 * @property {string} statusText The status text of the underlying http response.
 * @property {Headers} headers The headers of the underlying http response.
 * @property {function():void} connect Connect the stream.
 * @property {Error} [error] Something went wrong.
 * > **Note**\
 * > You can use this whenever the stream disconnects for any reason in order to reconnect.
 *
 * ## Example
 * ```js
 * const quote = source('/events', {
 *    close({ connect }) {
 *     console.log('reconnecting...')
 *     connect()
 *   }
 * })
 * ```
 * @property {function():void} close Close the stream.
 */

/**
 * @typedef {(event:import('./types').Event)=>void} EventListener
 */

/**
 * @typedef {(eventName:string,data:string)=>import('./types').Unsafe<void>} EmitterOfManyEvents
 */

/**
 * @typedef Connection
 * @property {(eventName:string,data:string)=>import('./types').Unsafe<void,Error>} emit Emit events to the client.\
 * The result wrapper may contain an error
 * ## Example
 * ```js
 * const {error} = emit('message', 'hello world')
 * if(error){
 *  console.error(error)
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
 * Describes the current parsed json and the previous json values.
 * @template T
 * @typedef JsonPredicatePayload
 * @property {Error} error The error generated by `JSON.parse`.
 * @property {string} raw This is the current raw string value, the one that triggered the error.
 * @property {null|T} previous This is the previous value of the store.
 */

/**
 * @template [T = any]
 * @callback JsonPredicate
 * @param {JsonPredicatePayload<T>} payload
 * @returns {null|T}
 */

/**
 * Options for the underlying http request.
 * @typedef {Pick<import('@microsoft/fetch-event-source').FetchEventSourceInit, "body"|"cache"|"credentials"|"fetch"|"headers"|"integrity"|"keepalive"|"method"|"mode"|"openWhenHidden"|"redirect"|"referrer"|"referrerPolicy"|"window">} Options
 */
