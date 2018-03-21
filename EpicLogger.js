
const colors = {
    Reset: "\x1b[0m",
    Bright: "\x1b[1m",
    Dim: "\x1b[2m",
    Underscore: "\x1b[4m",
    Blink: "\x1b[5m",
    Reverse: "\x1b[7m",
    Hidden: "\x1b[8m",
    fg: {
        Black: "\x1b[30m",
        Red: "\x1b[31m",
        Green: "\x1b[32m",
        Yellow: "\x1b[33m",
        Blue: "\x1b[34m",
        Magenta: "\x1b[35m",
        Cyan: "\x1b[36m",
        White: "\x1b[37m",
        Crimson: "\x1b[38m"
    },
    bg: {
        Black: "\x1b[40m",
        Red: "\x1b[41m",
        Green: "\x1b[42m",
        Yellow: "\x1b[43m",
        Blue: "\x1b[44m",
        Magenta: "\x1b[45m",
        Cyan: "\x1b[46m",
        White: "\x1b[47m",
        Crimson: "\x1b[48m"
    }
};

class EpicLogger {
    constructor() {
        this.info = (msg, obj) => EpicLogger.log('info', msg, null, obj);
        this.error = (msg, error) => EpicLogger.log('error', `\\033[31m${msg}` , error);
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
        if(level === "error"){
            console.log(colors.fg.Red, "%d - %s - %s", new Date(), level, logValue, colors.Reset);
        } else {
            console.log();
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