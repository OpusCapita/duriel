class EpicLogger {
    constructor() {
        this.logLevel = EpicLogger.getEnvLogLevel();
        this.severe = (msg, obj) => this.log('severe', msg, null, obj);
        this.debug = (msg, obj) => this.log('debug', msg, null, obj);
        this.info = (msg, obj) => this.log('info', msg, null, obj);
        this.warn = msg => this.log('warn', msg);
        this.error = (msg, error) => this.log('error', msg, error);
        this.log = this.log.bind(this);
    }

    static getLogLevels() {
        return [
            "severe", "debug", "info", "warn", "error"
        ];
    }

    static getEnvLogLevel() {
        return process.env.epicLogLevel ? process.env.epicLogLevel : "debug";
    }

    log(level, message, error, obj) {
        if (EpicLogger.getLogLevels().indexOf(level) < EpicLogger.getLogLevels().indexOf(this.logLevel)) {
            return;
        }
        let logValue = EpicLogger.convert2ReadableString(message);
        if (obj) {
            logValue += `\n${EpicLogger.convert2ReadableString(obj)}`;
        }
        console.log("%d - %s - %s", new Date(), level, logValue);
        if (error) {
            console.error(error);
        }
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