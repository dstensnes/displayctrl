// vim: sts=4 ts=4 sw=4 autoindent expandtab

module.exports = class InputText {
    constructor(name, text, value) {
        this.name = name;
        this.text = text;
        this.value = value;
    }

    encode() {
        return Buffer.from(this.value);
    }

    decode(input) {
        this.value = input.toString();
    }

    render() {
        return `
            <label for="${this.name}">
                ${this.text}
            </label>
            <input name="${this.name}" value="${this.value}">
        `;
    }
}

