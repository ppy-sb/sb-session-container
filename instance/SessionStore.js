/**
 * SessionStore
 * @constructor
 * @param {SessionContainer} container SessionContainer
 */
function SessionStore(container) {
    this.pendingPackets = []
    this.container = container
}

/**
 * return and reset pending packets
 * @returns {Array} packets
 */
SessionStore.prototype.flushPendingPackets = function () {
    const packets = [...this.pendingPackets]
    this.pendingPackets.length = 0
    return packets
}

/**
 * callback when session is updated
 */
SessionStore.prototype.onUpdate = function () {
    const SessionModel = this.container.SessionModel
    setImmediate(() => SessionModel.findOneAndUpdate({ id: this.id }, this, { upsert: true }, err => { if (err) console.warn(err) }))
    console.info(`Cloud session for ${this.user.name} updated, session(${this.id})`)
}

/**
 * shortcut for destroy session
 */
SessionStore.prototype.quit = function () {
    this.container.quit(this)
}

/**
 * Builder function for SessionStore
 * @module SessionStore
 * @see:SessionStore
 * @param {Object} obj initial state for SessionStore
 * @param {SessionContainer} container SessionContainer
 * @returns {SessionStore}
 */
module.exports = (obj, container) => {
    return Object.assign(new SessionStore(container), obj)
}