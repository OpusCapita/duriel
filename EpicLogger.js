class EpicLogger {
    constructor() {
        this.info = (msg, obj) => EpicLogger.log('info', msg, null, obj);
        this.error = (msg, error) => EpicLogger.log('error', msg, error);
        this.debug = (msg, obj) => EpicLogger.log('debug', msg, null, obj);
        this.warn = msg => EpicLogger.log('warn', msg);
    }

    static log(level, message, error, obj) {
        let logValue = this.convert2ReadableString(message);
        if (obj) {
            logValue += `\n${this.convert2ReadableString(obj)}`;
        }
        if (error) {
            logValue += `\n${this.convert2ReadableString(error)}`;
        }
        console.log("%d - %s - %s", new Date(), level, logValue);
    }

    static convert2ReadableString(message) {
        let logValue = "";
        if (typeof message === 'string' || message instanceof String) {
            logValue = message;
        } else {
            try {
                logValue = JSON.stringify(message, null, 1);
            } catch (error) {
                logValue = message;
            }
        }
        return logValue;
    }

}

module.exports = EpicLogger;