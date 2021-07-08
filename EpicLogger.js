/**
 * Super epic simple logger of duriel!
 * @class
 */
class EpicLogger {
    constructor(config) {
        this.logLevel = EpicLogger.getEnvLogLevel(config);
        this.severe = (msg, ...obj) => this.log('severe', msg, ...obj);
        this.debug = (msg, ...obj) => this.log('debug', msg, ...obj);
        this.info = (msg, ...obj) => this.log('info', msg, ...obj);
        this.warn = (msg, ...obj) => this.log('warn', msg, ...obj);
        this.error = (msg, error, ...obj) => this.log('error', msg, error, ...obj);
        this.log = this.log.bind(this);
    }

    /**
     * @static
     * @method
     * @returns {string[]}
     */
    static getLogLevels() {
        return [
            "severe", "debug", "info", "warn", "error"
        ];
    }

    static getEnvLogLevel(config) {
        let result;
        if (config) {result = config.andariel_loglevel;}
        if (!result) {result = process.env['andariel_loglevel'] ? process.env['andariel_loglevel'] : "info";}
        return result;
    }

    static getColors() {
        return {
            RESET: "\x1b[0m",
            RED: "\x1b[31m",
            GREEN: "\x1b[32m",
            YELLOW: "\x1b[33m",
            BLUE: "\x1b[34m",
            MAGENTA: "\x1b[35m",
            CYAN: "\x1b[36m",
            WHITE: "\x1b[37m",
        }
    }

    static getLevelColor(level) {
        switch (level) {
        case "severe":
            return EpicLogger.getColors().CYAN;
        case "debug":
            return EpicLogger.getColors().GREEN;
        case "info":
            return EpicLogger.getColors().WHITE;
        case "warn":
            return EpicLogger.getColors().YELLOW;
        case "error":
            return EpicLogger.getColors().RED;
        default:
            return EpicLogger.getColors().MAGENTA;
        }
    }

    log(level, ...obj) {
        if (EpicLogger.getLogLevels().indexOf(level) >= 0 && EpicLogger.getLogLevels().indexOf(level) < EpicLogger.getLogLevels().indexOf(this.logLevel)) {
            return;
        }
        const prefix = `${EpicLogger.getLevelColor(level)}${level} - ${new Date().toISOString()} - Duriel - `;
        const postfix = `${EpicLogger.getColors().RESET}`;
        let logValue = "";
        if (obj) {
            for (const attachment of obj) {logValue += `\n${EpicLogger.convert2ReadableString(attachment)}`;}
        }
        console.log(`${prefix}${logValue.trim()}${postfix}`);
    }

    static convert2ReadableString(message) {
        let logValue = "";
        if (typeof message === 'string' || message instanceof String) {
            logValue = message;
        } else if (typeof message === 'Error' || message instanceof Error) {
            try {
                logValue = message.stack || message
            } catch (e) {
                return message
            }
        } else {
            try {
                logValue = JSON.stringify(message, null, 1);
            } catch (error) {
                logValue = message;
            }
        }
        return logValue;
    }

    static padLeft(s, c, l) {
        s = String(s);
        while (s.length < l) {
            s = `${c}${s}`;
        }
        return s;
    }
}

module.exports = EpicLogger;
