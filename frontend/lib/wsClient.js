export default class wsClient {
    constructor(url) {
        this._ws = null;
        this._wsUrl = url;
        this._wsProtocol = null;
        this._msgHandlers = {};
        this._eventHandlers = {
            'open': function(...args) {
                console.log("OPEN", ...args);
            },
        };
        this._connectTimer = null;
        this._connect();
    }

    send(msg) {
        if (!this._ws) {
            return;
        }

        this._ws.send(msg);
    }

    onMsg(msgType, handler) {
        this._msgHandlers[msgType] = handler;
    }

    onEvent(eventType, handler) {
        this._eventHandlers[eventType] = handler;
    }

    _connect() {
        if (this._ws) {
            return;
        }

        if (this._connectTimer) {
            clearTimeout(this._connectTimer);
            this._connectTimer = null;
        }

        this._ws = new WebSocket(this._wsUrl, this._wsProtocol);
        this._ws.onopen = (...args) => {
            this._eventHandler('open', this, ...args);
        };
        this._ws.onmessage = (...args) => {
            this._msgHandler(...args);
        };
        this._ws.onclose = (...args) => {
            if (typeof this._ws.terminate === 'function') {
                this._ws.terminate();
            }
            this._ws = null;
            this.connectTimer = setTimeout(() => {
                this._connect();
            }, 1000);
            this._eventHandler('closed', this, ...args);
        };
    }

    _msgHandler(event) {
        let msg = null;
        try {
            msg = JSON.parse(event.data);
        } catch (e) {
            this._errorHandler('Unable to decode message', event.data, e.message);
            return;
        }
        if (typeof msg['_msgType'] !== 'string') {
            this._errorHandler('Message received without "_msgType" key', msg);
            return;
        }
        if (typeof this._msgHandlers[msg['_msgType']] !== 'function') {
            this._errorHandler(`No handler for "_msgType"=="${msg['_msgType']}"`, msg);
            return;
        }

        this._msgHandlers[msg['_msgType']](msg, this);
    }

    _eventHandler(event, ...args) {
        if (typeof this._eventHandlers[event] === 'function') {
            this._eventHandlers[event](...args);
        }
    }

    _errorHandler(...args) {
        console.log('wsClient::_errorHandler', ...args);
    }
}
