const express = require("express");
const app = express();
const inquirer = require("inquirer");
const fetch = require("node-fetch");
const { exec } = require("child_process");
const fs = require('fs');
const cli = require("./utils/cli");
const chalk = require("chalk");
const input = cli.input;
require("dotenv").config();

const loginFn = () => {
    const add_on = `client_id=${process.env.CLIENT_ID}&scope=data:read_write,data:delete&state=${process.env.STATE}`
    const loginurl = `https://todoist.com/oauth/authorize?${add_on}`
    console.log("open this url: " + loginurl)
}

app.get("/auth", async (req, res) => {
    if (!req.query.code) {
        return console.log("no code found")
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
        console.log(chalk.red('Authentication Error'));
        console.log("Please login using cli-todoist login")
        process.exit(0);
    } else {
        const config = require('./config.json');
        if (!config.token) {
            console.log("Please login using cli-todoist login")
            process.exit(0);
        }
        return config.token;
    }
}


app.listen(31234, () => {
    console.log("listening on port 31234");

    (async () => {
        console.log("starting shell...");

        if (input.includes("login")) {
            loginFn()
        } else {
            const token = middleware()
            console.log("all your tasks for token " + token)
            process.exit(0)
        }

        // let's not exit the process because login case
        // process.exit(0);
    })();
});