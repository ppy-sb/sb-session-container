module.exports = class NoSessionError extends Error{
    constructor(message) {
        super(message);
        this.name = "NoSessionError"; 
    }
}