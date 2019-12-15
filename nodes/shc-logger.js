const DEBUG = false;

module.exports = class ShcLogger {
    fine(...args) {
        if (DEBUG) {
            console.log('fine', ...args);
        }
    }

    debug(...args) {
        if (DEBUG) {
            console.log('debug', ...args);
        }
    }

    info(...args) {
        if (DEBUG) {
            console.log('info', ...args);
        }
    }

    warn(...args) {
        if (DEBUG) {
            console.log('warn', ...args);
        }
    }

    error(...args) {
        if (DEBUG) {
            console.log('error', ...args);
        }
    }
};
