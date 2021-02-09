// vim: sts=4 ts=4 sw=4 autoindent expandtab

const net = require('net');

module.exports = class MDCConnection {
    constructor(rhost) {
        this.rhost = rhost;
        this.rport = 1515;
        this.connection = null;
        this.cmdQueue = [];
        this.recvBuffer = Buffer.alloc(0);
        this.processingCommand = false;
        this.connecting = false;
        this.reconnectTime = 1000;
        this.cmdRate = 10;
    }

    send(packet) {
        return new Promise((resolve, reject) => {
            this.cmdQueue.push({
                resolve: resolve,
                reject: reject,
                packet: packet,
            });
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
        this.connection.write(this.cmdQueue[0].packet, null);
    }

    _onReceive(data) {
        if (this.cmdQueue.length === 0) {
            return;
        }

        this.recvBuffer = Buffer.concat([this.recvBuffer, data]);

        while (true) {
            let buf = this.recvBuffer.toString();
            let pos = buf.indexOf("\n");
            if (pos >= 0) {
                let cmd = this.cmdQueue.shift();
                let result = buf.substr(0, pos);
                this.recvBuffer = this.recvBuffer.slice(pos + 1);
                this.processingCommand = false;
                cmd.resolve(result);
                setTimeout(() => {
                    this._transmit();
                }, this.cmdRate);
            } else {
                break;
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
}
