const express = require("express");
const app = express();
const inquirer = require("inquirer");
const fetch = require("node-fetch");
const { exec } = require("child_process");
const fs = require('fs');
const cli = require("./utils/cli");
const chalk = require("chalk");
const init = require("./utils/init");
const input = cli.input;
require("dotenv").config();
const base = "https://api.todoist.com/rest/v2";

const printNote = (msg) => { console.log(chalk.bgCyan(msg)) }
const printError = (msg) => { console.log(chalk.bgRed(msg)) }
const printSuccess = (msg) => { console.log(chalk.bgGreen(msg)) }

const loginTempFn = async () => {
    console.log("Sign in to https://www.todoist.com/")
    printNote("Copy token from Settings > Integrations > Developer API Token")
    const input = await inquirer.prompt([
        {
            type: "input",
            name: "token",
            message: "Enter your token",
        },
    ]);
    const token = input.token

    const headers = { 'Authorization': `Bearer ${token}` };
    const response = await fetch(`${base}/labels`, { headers });
    if (response.status == 200) {
        fs.writeFileSync('./config.json', JSON.stringify({ token: input.token }));
        printSuccess("Successfully logged in...")
    }
    else {
        printError("Invalid token")
    }
};

const loginFn = () => {
    const add_on = `client_id=${process.env.CLIENT_ID}&scope=data:read_write,data:delete&state=${process.env.STATE}`
    const loginurl = `https://todoist.com/oauth/authorize?${add_on}`
    printNote("open this url ")
    console.log(loginurl)
}

app.get("/auth", async (req, res) => {
    if (!req.query.code) {
        return printError("No code found")
    }
    fs.writeFileSync('./code.json', JSON.stringify({ code: req.query.code, state: req.query.state }));
    const datastring = `client_id=${process.env.CLIENT_ID}&client_secret=${process.env.CLIENT_SECRET}&code=${req.query.code}&grant_type=authorization_code`
    const response = await fetch("https://todoist.com/oauth/access_token", {
        method: "POST",
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: datastring
    })
    const json = await response.json()
    if (res.status !== 200) {
        return res.send({ error_code: res.status, error_message: json })
    } else {
        fs.writeFileSync('./config.json', JSON.stringify({ token: json }));
        return res.sendFile(__dirname + "/utils/logged-in.html");
    }
});


const middleware = () => {
    const existingConfig = fs.existsSync('./config.json');
    if (!existingConfig) {
        return null;
    } else {
        const config = require('./config.json');
        if (!config.token) return null;
        return config.token;
    }
}


app.listen(31234, () => {
    console.log("listening on port 31234");

    (async () => {
        console.log("starting shell...");

        if (input.includes("login")) {
            if (middleware() == null) {
                // loginFn()
                await loginTempFn()

            } else {
                console.log("Already logged in")
                printNote("use logout command and then login again")
            }
            process.exit(0);
        }
        else if (input.includes("logout")) {
            try {
                fs.unlinkSync('./config.json');
                printSuccess("Successfully logged out...")
            } catch (err) { }
            process.exit(0)
        }
        else {
            const token = middleware()
            if (token == null) {
                printError("Please login first")
                process.exit(0)
            } else {
                init({ clear: true });
                console.log("all your tasks for token " + token)
            }
        }

        // let's not exit the process because login case
        // process.exit(0);
    })();
});