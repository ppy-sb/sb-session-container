// const db = require('../../controllers/db')
function Store(container) {
    this.pendingPackets = []
    this.container = container
}

Store.prototype.flushPendingPackets = function () {
    const packets = [...this.pendingPackets]
    this.pendingPackets.length = 0
    return packets
}

Store.prototype.onUpdate = function () {
    const SessionModel = this.container.model
    setImmediate(() => SessionModel.findOneAndUpdate({ id: this.id }, this, { upsert: true }, err => { if (err) console.warn(err) }))
    console.info(`Cloud session for ${this.user.name} updated, session(${this.id})`)
}

Store.prototype.quit = function () {
    this.container.quit(this)
}

module.exports = (obj, container) => {
    return Object.assign(new Store(container), obj)
}