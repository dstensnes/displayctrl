module.exports = class AbstractDevice {
    constructor(devInfo, commands) {
        this.devInfo = devInfo;
        this.state = {};
        this.commands = [];

        for(let c in commands) {
            this.registerCommand(c);
        }
    }



    registerCommand(cmdObj) {
        let c = new cmdObj(this.devInfo, this.state)
    }
};