// vim: sts=4 ts=4 sw=4 autoindent expandtab

const net = require('net');

module.exports = class MDCConnection {
    constructor(rhost) {
        this.rhost = rhost;
        this.rport = 1515;
        this.connection = null;
        this.recvBuffer = Uint8Array;
        this.sendBuffer = Array();
    }

    _isConnected() {
        return this.connection !== null;
    }

    _transmit() {
        let data = this.sendBuffer.shift();
        console.log('CONNECTION', this.connection);
        if (data) {
            console.log("Send> ", data);
            this.connection.write(data, null, () => { console.log("TRANSMIT"); });
        }
    }

    _connect() {
        this.connection = net.Socket();
        this.connection.connect(
            this.rport,
            this.rhost,
            () => {
                console.log(`Connected to ${this.rhost}:${this.rport}`);
                this._transmit();
            }
        )

        this.connection.on('close', () => {
            this.connection = null;
        })

        this.connection.on('data', (data) => {
            console.log("Recv> ", data);
            this.recvBuffer += data;
        })

        return this.connection;
    }

    _onRead(size, buf) {
        this.recvBuffer += buf;
        console.log("RECV> ", buf, buf[0]);
    }

    send(data) {
        console.log("SENDBUFFER", this.sendBuffer);
        this.sendBuffer.push(Uint8Array.from(data));
        if (this._isConnected()) {
            this._transmit();
        }
        else {
            this._connect();
        }
    }
}
