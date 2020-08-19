const { v4: uuidv4 } = require('uuid');
const APP_NAMESPACE = '9f4750c8-c940-11ea-87d0-0242ac130003'

const createSessionStore = require('./instance/SessionStore')
const NoSessionError = require('./errors/NoSessionError')

/**
 * SessionContainer
 * @author arily
 */
class SessionContainer {
    /**
     * Create SessionContaner instance
     * @param {sb-db} database 
     */
    constructor({ Session, User }) {
        this.sessions = new Map
        this.SessionModel = Session
        this.UserModel = User
        Object.getOwnPropertyNames(SessionContainer.prototype)
            .filter((propertyName) => propertyName !== 'constructor')
            .forEach((method) => (this[method] = this[method].bind(this)))
    }

    /**
     * get session
     * @param {SessionStore | Object} session - An Object with id key
     * @returns {SessionStore | undefined} session
     */
    async getSession({ id }) {
        return this.sessions.get(id) || this.cacheAndReturnDbSession({ id })
    }

    /**
    * alias of SessionContainer.destroy
    * @param {SessionStore | Object} session - An Object with id key
    */
    quit(session) {
        this.destroy(session)
    }

    /**
    * retrieve session and store in sessions
    * @param {SessionStore | Object} session - An Object with id key
    * @returns {SessionStore} session
    */
    async cacheAndReturnDbSession(session) {
        let _session = await this.dbGetSession(session)
        _session = createSessionStore(_session, this)
        _session.resumed = true
        // _session.user = await this.UserModel.findOne(_session.user).exec()
        // console.log(_session)
        // if (!this.getSession(_session)) 
        this.sessions.set(session.id, _session)
        return _session
    }

    /**
     * get session from db
     * @param {SessionStore | Object} session - An Object with id key
     * @returns {Object} session data
     */
    dbGetSession({ id }) {
        return this.SessionModel.findOne({ id }).exec().then(res => {
            if (!res) return res
            return res.toObject()
        })
    }

    /**
     * destroy a session
     * will not destroy the session in database
     * @param {SessionStore | Object} session 
     */
    destroy(session) {
        this.sessions.delete(session.id)
    }

    /**
     * handling exipre for session and bond session to request
     * @param {Request} req - Express Request
     */
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
                    this.SessionModel.deleteOne({ id: session.id }, err => { if (err) console.warn(err) })
                    if (this.getSession({ id: req.token })) this.destroy(session)
                }, 1000 * 60 * 60 * 24) // 1d 
                return session
            },
        })
    }

    /* ==== */

    /**
     * start a session
     * @param {Request} req - Express Request
     * @param {Object} session - initial state of session
     */
    async start(req, session) {
        session.id = uuidv4()
        session = createSessionStore(session, this)
        console.info(`Session for ${session.user.name} created, session(${session.id})`)
        this.sessions.set(session.id, session)
        req.token = session.id
        session.onUpdate()
        await this.debounceSession(req)
    }

    /* ==== */

    /**
     * mark token from request header
     * express middleware
     * @param {Request} req Express Request
     * @param {Response | Any} res Express Response (unused)
     * @param {next} next Express next()
     */
    fromToken(req, res, next) {
        req.token = req.header('osu-token')
        next()
    }

    /**
     * bond a session to request if a session exists
     * @param {Request} req Express Request
     * @param {Response | Any} res Express Response (unused)
     * @param {next} next Express next()
     */
    async continue(req, res, next) {
        if (!req.token) return next('route') // @arily next('route')和next()不同 同一条路由后面的中间件会被跳过.
        const session = await this.getSession({ id: req.token })
        if (!session) return next(new NoSessionError())
        if (!session.user) return next(new NoSessionError('user undefined'))
        await this.debounceSession(req)
        console.info(`Session for ${req.session.user.name} resumed, session(${req.session.id})`)
        next()
    }

    /**
     * jump to next route if no session is bonded with the request
     * @param {Request} req Express Request
     * @param {Response | Any} res Express Response (unused)
     * @param {next} next Express next()
     */
    nextRouteIfNoSession(req, res, next) {
        if (!req.session) return next("route")
        next()
    }
    /**
    * jump to next route if a is bonded with the request
    * @param {Request} req Express Request
    * @param {Response | Any} res Express Response (unused)
    * @param {next} next Express next()
    */
    nextRouteIfHasSession(req, res, next) {
        if (req.session) return next("route")
        next()
    }

    /**
    * jump to next route if resumed flag of session is not true
    * @param {Request} req Express Request
    * @param {Response | Any} res Express Response (unused)
    * @param {next} next Express next()
    */
    nextRouteIfNotResumedSession(req, res, next) {
        if (!req.session.resumed) return next("route")
        next()
    }

    /**
    * clear resumed flag from request.session
    * @param {Request} req Express Request
    * @param {Response | Any} res Express Response (unused)
    * @param {next} next Express next()
    */
    removeResumedSessionFlag(req, res, next) {
        delete req.session.resumed
        next()
    }

    handleSessionError(err, req, res, next) {
        // console.log(err)
        if (!err.name == 'NoSessionError') return next()
        console.log('NoSessionError!', err.message, req.token)
    }
}

module.exports = {
    NoSessionError,
    SessionContainer
}