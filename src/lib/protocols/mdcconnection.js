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
        this.cmdRate = 10;
    }

    send(cmdId, cmdData = []) {
        return new Promise((resolve, reject) => {
            this.cmdQueue.push({cmdId, cmdData: Buffer.from(cmdData), resolve, reject});
            this._transmit();
        });
    }

    _transmit() {
        if (this.connecting || this.processingCommand || this.cmdQueue.length === 0) {
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

        console.log("PKGDATA> ", pkgData);

        this.connection.write(pkgData, null);
    }

    _receiveError(msg, terminate = true) {
        console.log(`${this.rhost}: ${msg}\n`);
        if (terminate) {
            this.connection.destroy();
            this.connection = null;
        }
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
            let result = this.recvBuffer.slice(6, splitPos);
            this.recvBuffer = this.recvBuffer.slice(splitPos + 1);
            console.log("RECVBUFFER> ", this.recvBuffer);
            console.log("PACKET> ", result);

            this.processingCommand = false;

            if (success) {
                cmd.resolve(result);
            } else {
                this._receiveError("Command failed", false);
                cmd.reject(result);
            }

            setTimeout(() => {
                this._transmit();
            }, this.cmdRate);
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
            console.log("CHECKSUM1> ", data[i].toString(16), sum.toString(16));
        }
        return sum;
    }
}
