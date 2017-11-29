class EpicLogger {
    constructor() {
        this.info = msg => this.log('info', msg);
        this.error = msg => this.log('error', msg);
    }

    log(level, message) {
        console.log("%d - %s - %s", new Date(), level, message);
    }
}

module.exports = EpicLogger;