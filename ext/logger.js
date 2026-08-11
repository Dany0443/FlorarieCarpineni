'use strict';


const fs   = require('fs');
const path = require('path');


// ANSI color palette (subtle, readable)
const C = {
    reset   : '\x1b[0m',
    bold    : '\x1b[1m',
    dim     : '\x1b[2m',

    red     : '\x1b[31m',
    green   : '\x1b[32m',
    yellow  : '\x1b[33m',
    blue    : '\x1b[34m',
    magenta : '\x1b[35m',
    cyan    : '\x1b[36m',
    white   : '\x1b[37m',
    gray    : '\x1b[90m',
    bred    : '\x1b[91m',
    bgreen  : '\x1b[92m',
    byellow : '\x1b[93m',
    bblue   : '\x1b[94m',
    bmagenta: '\x1b[95m',
    bcyan   : '\x1b[96m',
    bwhite  : '\x1b[97m',
};

// Enable color only when TTY (or forced)
const USE_COLOR = process.stdout.isTTY || process.env.FORCE_COLOR === '1';
const color = (code, str) => USE_COLOR ? `${code}${str}${C.reset}` : str;


// Level definitions with styles
const LEVELS = {
    INFO:  { label: 'INFO ', color: C.bwhite,   msgColor: C.white   },
    WARN:  { label: 'WARN ', color: C.byellow,  msgColor: C.yellow  },
    ERROR: { label: 'ERROR', color: C.bred,     msgColor: C.bred    },
    DEBUG: { label: 'DEBUG', color: C.bcyan,    msgColor: C.cyan    },
};


class Logger {
    constructor(logDir) {
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        this._logFile    = path.join(logDir, 'server.log');
        this._errorFile  = path.join(logDir, 'errors.log');
        this._maxSize    = 5 * 1024 * 1024;  // 5 MB rotation threshold

        // Ensure files exist
        [this._logFile, this._errorFile].forEach(f => {
            if (!fs.existsSync(f)) fs.writeFileSync(f, '');
        });
    }

    
    // Time formatters
    _timestampISO()  { return new Date().toISOString(); }
    _timestampTime() { return new Date().toISOString().slice(11, 23); } // HH:MM:SS.mmm

    
    // Rotate file if too large
    _rotate(filePath) {
        try {
            if (fs.existsSync(filePath) && fs.statSync(filePath).size > this._maxSize) {
                const rotated = filePath.replace(/\.log$/, `.${Date.now()}.log`);
                fs.renameSync(filePath, rotated);
                fs.writeFileSync(filePath, '');
            }
        } catch (_) {
            // Ignore rotation errors – log writing will still work
        }
    }

    
    // Core write method
    _write(level, message) {
        const levelDef = LEVELS[level] || LEVELS.INFO;
        const isError  = level === 'ERROR';
        const isWarn   = level === 'WARN';

        const timeStr    = color(C.gray + C.dim, this._timestampTime());
        const labelStr   = color(C.bold + levelDef.color, `[${levelDef.label}]`);
        const messageStr = color(levelDef.msgColor, message);
        const consoleLine = `${timeStr} ${labelStr} ${messageStr}`;

        if (isError) {
            process.stderr.write(consoleLine + '\n');
        } else if (isWarn) {
            process.stderr.write(consoleLine + '\n');
        } else {
            process.stdout.write(consoleLine + '\n');
        }

        
        const fileLine = `[${this._timestampISO()}] [${level.padEnd(5)}] ${message}`;

        // Write to main log
        this._rotate(this._logFile);
        fs.appendFile(this._logFile, fileLine + '\n', () => {});

        // Write to error log separately for ERROR level
        if (isError) {
            this._rotate(this._errorFile);
            fs.appendFile(this._errorFile, fileLine + '\n', () => {});
        }
    }

    
    // Public logging methods
    info(message)  { this._write('INFO', message); }
    warn(message)  { this._write('WARN', message); }
    error(message) { this._write('ERROR', message); }
    debug(message) {
        if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
            this._write('DEBUG', message);
        }
    }

    
    // Divider line (console only)
    divider(char = '─', length = 60) {
        const line = char.repeat(length);
        process.stdout.write(color(C.gray, line) + '\n');
    }

    
    /**
     * @param {string} name          
     * @param {string} version       
     * @param {Array}  rows          
     */
    banner(name, version, rows = []) {
        const W = 58;  

        const pad = (str, width) => {
            const visible = str.replace(/\x1b\[[0-9;]*m/g, ''); 
            const padding = Math.max(0, width - visible.length);
            return str + ' '.repeat(padding);
        };

        // Box drawing characters
        const tl = '╔', tr = '╗', bl = '╚', br = '╝';
        const vl = '║', hl = '═';
        const sl = '╠', sr = '╣';
        const hline = hl.repeat(W);

        // Build box lines
        const lines = [];

        // Top border
        lines.push(`${tl}${hline}${tr}`);

        // Title row
        const title = `${name}  v${version}`;
        lines.push(`${vl}  ${pad(title, W - 2)}${vl}`);

        // Info rows: PID, Node version, time
        const pidInfo = `PID ${process.pid}  ·  Node ${process.version}`;
        lines.push(`${vl}  ${pad(pidInfo, W - 2)}${vl}`);

        const startTime = new Date().toLocaleString('ro-RO', { hour12: false });
        lines.push(`${vl}  ${pad(`Started  ${startTime}`, W - 2)}${vl}`);

        // Separator line
        lines.push(`${sl}${hline}${sr}`);

        // Custom rows from configuration
        rows.forEach(row => {
            if (typeof row === 'string') {
                // Separator inside box
                lines.push(`${sl}${hl.repeat(W)}${sr}`);
            } else {
                const key = String(row.key).padEnd(16);
                const val = String(row.val);
                const line = `${key}${val}`;
                lines.push(`${vl}  ${pad(line, W - 2)}${vl}`);
            }
        });

        // Bottom border
        lines.push(`${bl}${hline}${br}`);

        // Print the box
        const box = lines.join('\n');
        if (USE_COLOR) {
            process.stdout.write(color(C.bold + C.bcyan, box) + '\n\n');
        } else {
            process.stdout.write(box + '\n\n');
        }

        const summary = `===== ${name} v${version} started · PID ${process.pid} =====`;
        this._rotate(this._logFile);
        fs.appendFile(this._logFile, `[${this._timestampISO()}] [INFO ] ${summary}\n`, () => {});
    }
}

module.exports = Logger;