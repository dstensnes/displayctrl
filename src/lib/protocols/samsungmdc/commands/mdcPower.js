const abstractCommand = require("../abstractcommand.js");

module.exports = class mdcPower extends abstractCommand {
    cmdPrefix() {
        return Buffer.from([ 0x11 ]);
    }
};
