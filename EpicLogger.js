/**
 * Super epic simple logger of duriel!
 * @class
 */
class EpicLogger {
    constructor() {
        this.logLevel = EpicLogger.getEnvLogLevel();
        this.severe = (msg, obj) => this.log('severe', msg, null, obj, EpicLogger.getColors().CYAN);
        this.debug = (msg, obj) => this.log('debug', msg, null, obj, EpicLogger.getColors().GREEN);
        this.info = (msg, obj) => this.log('info', msg, null, obj, EpicLogger.getColors().WHITE);
        this.warn = (msg, obj) => this.log('warn', msg, null, obj, EpicLogger.getColors().YELLOW);
        this.error = (msg, error, obj) => this.log('error', msg, error, obj, EpicLogger.getColors().RED);
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

    static getEnvLogLevel() {
        return process.env['andariel_loglevel'] ? process.env['andariel_loglevel'] : "info";
    }

    static getColors(){
        return {
            RESET: "\x1b[0m",
            RED: "\x1b[31m",
            YELLOW : "\x1b[33m",
            GREEN :"\x1b[32m",
            CYAN: "\x1b[36m",
            WHITE: "\x1b[37m"
        }
    }

    log(level, message, error, obj, color) {
        if (EpicLogger.getLogLevels().indexOf(level) < EpicLogger.getLogLevels().indexOf(this.logLevel)) {
            return;
        }
        let logValue = EpicLogger.convert2ReadableString(message);
        if (obj) {
            logValue += `\n${EpicLogger.convert2ReadableString(obj)}`;
        }
        console.log(`${color}%s - %s - %s${EpicLogger.getColors().RESET}`, EpicLogger.formatDate2String(new Date()), level, logValue);
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

    static formatDate2String(date) {
        return `${this.padLeft(date.getDate(), '0', 2)}.${this.padLeft(date.getMonth() + 1, '0', 2)}.${date.getFullYear()} ${this.padLeft(date.getHours() , '0', 2)}:${this.padLeft(date.getMinutes(), '0', 2)}:${this.padLeft(date.getSeconds(), '0', 2)}`
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