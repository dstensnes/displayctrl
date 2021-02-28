<template>
  {{ data }}
</template>

<script>
import wsClient from "../lib/wsClient.js";

export default {
  data() {
    return {
      data: 'hello',
    };
  },
  methods: {
    onWebsocketMessage(data) {
      console.log("wsMessage", data);
    },

  },
  mounted() {
    let wsProtocol = 'ws:';

    if (location.protocol === 'https:') {
      wsProtocol = 'wss:';
    }

    this._wsUrl = wsProtocol + '//' + window.location.host + '/viewer';
    this.ws = new wsClient(this._wsUrl);
    window.wsClient = this.ws;
    this.ws.onMsg('hello', (...msg) => {
      console.log("msg", ...msg);
    });
    this.ws.onEvent('open', (...data) => {
      console.log("open", ...data);
    });
    console.log("_wsUrl", this._wsUrl);
  }
};
</script>
