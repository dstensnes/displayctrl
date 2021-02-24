// vim: sts=4 ts=4 sw=4 autoindent expandtab

const net = require('net');

module.exports = class MDCConnection {
    constructor(rhost, displayId = 0) {
        this.rhost = rhost;
        this.rport = 1515;
        this.displayId = displayId;
        this.connection = null;
        this.cmdQueue = [];
        this.recvBuffer = Buffer.alloc(0);
        this.processingCommand = false;
        this.connecting = false;
        this.reconnectTime = 1000;
        this.retryCmdDelay = 1000;
        this.retryCmdMaxCount = 3;
        this.cmdRate = 10;
        this.onUnexpectedReceive = (pkg) => {
            console.log("UNEXPECTED> ", pkg);
        };
    }

    send(cmdData = []) {
        let tmpData = Buffer.from(cmdData);
        return new Promise((resolve, reject) => {
            if (tmpData.length < 1) {
                reject("No data to send");
                return;
            }
            this.cmdQueue.push({
                cmdId: tmpData[0],
                cmdData: tmpData.slice(1),
                retryCounter: 0,
                retryTimer: null,
                resolve,
                reject,
            });
            this._transmit();
        });
    }



    _transmit() {
        if (this.connecting || this.cmdQueue.length === 0) {
            return;
        }

        if (this.connection === null) {
            this._connect();
            return;
        }

        this.processingCommand = true;

        let pkgData = Buffer.concat([
            Buffer.from([
                0xAA,
                this.cmdQueue[0].cmdId,
                this.displayId,
                this.cmdQueue[0].cmdData.byteLength
            ]),
            this.cmdQueue[0].cmdData
        ]);

        let checksum = Buffer.from([this._checksum(pkgData.slice(1))]);
        pkgData = Buffer.concat([pkgData, checksum]);

        this.cmdQueue[0].retryCounter += 1;

        if (!this.cmdQueue[0].retryTimer) {
            this.cmdQueue[0].retryTimer = setTimeout(() => {
                this.cmdQueue[0].retryTimer = null;
                this._transmit();
            }, this.retryCmdDelay);
        }

        console.log(`Transmit[${this.cmdQueue[0].retryCounter}]> `, pkgData);
        this.connection.write(pkgData, null);
    }

    _onReceive(data) {
        if (this.cmdQueue.length === 0) {
            return;
        }

        this.recvBuffer = Buffer.concat([this.recvBuffer, data]);

        while (true) {
            if (this.recvBuffer.byteLength < 6) {
                break; // Not enough data yet.
            }

            if (this.recvBuffer[0] !== 0xAA || this.recvBuffer[1] !== 0xFF) {
                this._receiveError("Invalid magic bytes");
                break;
            }

            let splitPos = 4 + this.recvBuffer[3]; // Header + data_length(offset 3)
            if (this.recvBuffer.byteLength < splitPos) {
                break; // Not a full packet yet.
            }

            if (this._checksum(this.recvBuffer.slice(1, splitPos)) !== this.recvBuffer[splitPos]) {
                this._receiveError("Checksum failure");
                break;
            }

            let success = this.recvBuffer[4] === 0x41;

            let cmd = this.cmdQueue.shift();
            clearTimeout(cmd.retryTimer);
            cmd.retryTimer = null;

            let receivedCmdId = this.recvBuffer[5];
            let receivedPkg = Buffer.concat([
                this.recvBuffer.slice(5, 6),
                this.recvBuffer.slice(6, splitPos)
            ]);

            this.recvBuffer = this.recvBuffer.slice(splitPos + 1);
            this.processingCommand = false;

            if (receivedCmdId !== cmd.cmdId) {
                // If we didn't expect this packet, do not resolve.
                // Instead, we pass to onUnexpectedReceive, if defined,
                // but only if it is a success packet, since we are
                // not worried about failed commands that we didn't
                // issue.
                if (success && (typeof(this.onUnexpectedReceive) == 'function')) {
                    this.onUnexpectedReceive(receivedPkg);
                }
            }
            else if (success) {
                cmd.resolve(receivedPkg);
            } else {
                this._receiveError("Command failed", false);
                cmd.reject(receivedPkg);
            }

            setTimeout(() => {
                this._transmit();
            }, this.cmdRate);
        }
    }

    _receiveError(msg, terminate = true) {
        console.log(`${this.rhost}: ${msg}\n`);
        if (terminate) {
            this._disconnect();
        }
    }

    _disconnect() {
        if (this.connection) {
            this.connection.destroy();
            this.connection = null;
            this.connecting = false;
            this.processingCommand = false;
            if (this.cmdQueue.length > 0 && this.cmdQueue[0].retryTimer) {
                clearTimeout(this.cmdQueue[0].retryTimer);
            }
        }
    }

    _connect() {
        if (this.connection || this.connecting) {
            return;
        }

        this.connecting = true;
        let connection = net.Socket();

        connection.on('error', (e) => {
            this.connection = null;
            this.connecting = false;
            console.log(`${this.rhost}: `, e.code);
            if (this.cmdQueue.length > 0) {
                if (this.cmdQueue[0].retryTimer) {
                    clearTimeout(this.cmdQueue[0].retryTimer);
                }
                setTimeout(() => {
                    this._connect();
                }, this.reconnectTime);

            }
        });

        connection.on('close', () => {
            this.connection = null;
            this.connecting = false;
            console.log(`${this.rhost}: Disconnected`);
            if (this.cmdQueue.length > 0) {
                if (this.cmdQueue[0].retryTimer) {
                    clearTimeout(this.cmdQueue[0].retryTimer);
                }
                setTimeout(() => {
                    this._connect();
                }, this.reconnectTime);
            }
        });

        connection.on('data', (data) => {
            console.log(`${this.rhost}: DATA`, data);
            this._onReceive(data);
        });

        connection.connect(
            this.rport,
            this.rhost,
            () => {
                this.connection = connection;
                console.log(`${this.rhost}: Connected to port ${this.rport}`);
                this.connecting = false;
                setTimeout(() => {
                    this._transmit();
                }, this.cmdRate);
            }
        );

        return connection;
    }

    _checksum(data) {
        let sum = 0;
        for (let i = 0; i < data.byteLength; i++) {
            sum += data[i];
            sum %= 256;
            // console.log("CHECKSUM1> ", data[i].toString(16), sum.toString(16));
        }
        return sum;
    }
}
