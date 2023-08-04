const welcome = require("cli-welcome");
const pkg = require("./../package.json");
const unhandled = require("cli-handle-unhandled");

module.exports = ({ title = "cli-todoist", clear = true }) => {
  unhandled();
  welcome({
    title: title,
    // tagLine: `by mannnish_`,
    version: pkg.version,
    // bgColor: "#36BB09",
    // color: "#000000",
    // bold: true,
    clear,
  });
};
