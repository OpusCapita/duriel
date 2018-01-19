class EpicLogger {
    constructor() {
        this.info = msg => EpicLogger.log('info', msg);
        this.error = (msg, error) => EpicLogger.log('error', msg, error);
        this.debug = msg => EpicLogger.log('debug', msg);
        this.warn = msg => EpicLogger.log('warn', msg);
    }

    static log(level, message, error) {
        console.log("%d - %s - %s", new Date(), level, message);
        if(error){
            console.error(error);
        }
    }
}

module.exports = EpicLogger;