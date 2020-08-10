const { v4: uuidv4 } = require('uuid');
const APP_NAMESPACE = '9f4750c8-c940-11ea-87d0-0242ac130003'

const createSessionStore = require('./instance/SessionStore')
const NoSessionError = require('./errors/NoSessionError')
class SessionContainer {
    constructor({Session}) {
        this.sessions = new Map
        this.model = Session
        Object.getOwnPropertyNames(SessionContainer.prototype)
            .filter((propertyName) => propertyName !== 'constructor')
            .forEach((method) => (this[method] = this[method].bind(this)))
    }

    async getSession({ id }) {
        return this.sessions.get(id) || this.cacheAndReturnDbSession({ id })
    }

    async cacheAndReturnDbSession(session) {
        const _session = await this.dbGetSession()
        if (!this.getSession(_session)) this.sessions.set(session.id, session)
        return session
    }

    dbGetSession({ id }) {
        return this.model.findOne({ id }).exec()
    }

    destroy(session) {
        this.sessions.delete(session.id)
    }

    async start(req, session) {
        session.id = uuidv4()
        session = createSessionStore(session, this)
        console.info(`Session for ${session.user.name} created, session(${session.id})`)
        this.sessions.set(session.id, session)
        req.token = session.id
        session.onUpdate()
        await this.debounceSession(req)
    }

    fromToken(req, res, next) {
        req.token = req.header('osu-token')
        next()
    }

    async continue(req, res, next) {
        if (!req.token) return next('route') // @arily next('route')和next()不同 同一条路由后面的中间件会被跳过.
        if (!(this.sessions.has(req.token))) {
            // const session = this.restoreSessionFromDB({ id: req.token })
            return next(new NoSessionError())
        }
        await this.debounceSession(req)
        console.info(`Session for ${req.session.user.name} resumed, session(${req.session.id})`)
        next()
    }

    quit(session) {
        this.destroy(session)
    }

    nextRouteIfNoSession(req, res, next) {
        if (!req.session) return next("route")
        next()
    }

    nextRouteIfHasSession(req, res, next) {
        if (req.session) return next("route")
        next()
    }

    async debounceSession(req) {
        let timer
        const session = await this.getSession({ id: req.token })
        Object.defineProperty(req, "session", {
            get: () => {
                if (timer) {
                    clearTimeout(timer)
                    console.info(`Timeout of Session for ${session.user.name} reset, session(${session.id})`)
                }
                timer = setTimeout(() => {
                    console.info(`Session for ${session.user.name} expired, removing it ... session(${session.id})`)
                    this.model.deleteOne({ id: session.id }, err => { if (err) console.warn(err) })
                    if (this.getSession({ id: req.token })) this.destroy(session)
                }, 1000 * 60 * 60 * 24) // 1d 
                return session
            },
        })
    }

    handleSessionError(err, req, res, next) {
        console.log(err)
        if (!err.name == 'NoSessionError') return next()
        // console.log('NoSessionError!')
    }
}

module.exports = {
    NoSessionError,
    SessionContainer
}