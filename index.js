#!/usr/bin/env node
const express = require("express");
const app = express();
const inquirer = require("inquirer");
const fetch = require("node-fetch");
const fs = require('fs');
const cli = require("./utils/cli");
const chalk = require("chalk");
const init = require("./utils/init");
const { get } = require("http");
const input = cli.input;
require("dotenv").config();
const pkg = require("./package.json");
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
        fs.writeFileSync(__dirname + '/config.json', JSON.stringify({ token: input.token }));
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
    // fs.writeFileSync('./code.json', JSON.stringify({ code: req.query.code, state: req.query.state }));
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
        fs.writeFileSync(__dirname + '/config.json', JSON.stringify({ token: json }));
        return res.sendFile(__dirname + "/utils/logged-in.html");
    }
});


const middleware = () => {
    // const existingConfig = fs.existsSync('./config.json');
    const existingConfig = fs.existsSync(__dirname + '/config.json');
    if (!existingConfig) {
        return null;
    } else {
        const config = require(__dirname + '/config.json');
        if (!config.token) return null;
        return config.token;
    }
}


app.listen(31234, () => {
    (async () => {
        if (input.includes("v")) {
            printNote(pkg.version);
            process.exit(0);
        } else if (input.includes("c")) {
            const token = middleware()
            printSuccess("token: " + token)
            process.exit(0);
        } else if (input.includes("login")) {
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
                fs.unlinkSync(__dirname + '/config.json');
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
                await getTodayTasks(token)
                await showOptions(token)
            }
        }

        // let's not exit the process because login case
        // process.exit(0);
    })();
});

class Task {
    constructor(id, content, labels) {
        this.id = id;
        this.content = content;
        this.labels = labels;
    }
}

const getAllTasks = async (token) => await getTask(token, "ALL TASKS", "")
const getTodayTasks = async (token) => await getTask(token, "FOR TODAY", "filter=(today|overdue)")

const getTask = async (token, title, filter) => {
    const headers = { 'Authorization': `Bearer ${token}` };
    const response = await fetch(`${base}/tasks?${filter}`, { headers });
    const json = await response.json();
    var tasks = []
    init({ title: title, clear: true });
    for (var i = 0; i < json.length; i++) {
        task_element = json[i]
        var task = new Task(task_element.id, task_element.content, task_element.labels)
        tasks.push(task)
        if (task_element.labels.length == 0)
            console.log(`${i + 1}. ${task.content}`)
        else
            console.log(`${i + 1}. ${task.content} (label: ${task.labels})`)
    }

    console.log(`\n`)
    printNote("Options:")
    console.log("add/ complete/ delete: for tasks")
    console.log("all/ for-today: for viewing tasks")
    console.log("exit: to exit")
    console.log(`\n`)
    const input = await inquirer.prompt([
        {
            type: "input",
            name: "command",
            message: "Enter your command",
        },
    ]);
    switch (input.command) {
        case "add":
            {
                const input = await inquirer.prompt([
                    {
                        type: "input",
                        name: "task",
                        message: "Enter task: ",
                    },
                    {
                        type: "input",
                        name: "due_string",
                        message: "Enter human readable due (e.g. today, after 5 days, tomorrow at 12:00, etc.): ",
                    }
                ]);
                const response = await fetch(`${base}/tasks`, {
                    method: "POST",
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: input.task, due_string: input.due_string })
                });
                if (response.status == 200) {
                    printSuccess("Successfully added task")
                }
                else {
                    printError("Error in adding task")
                }
                if (title == "FOR TODAY")
                    await getTodayTasks(token)
                else
                    await getAllTasks(token)
            }
            break;
        case "complete":
            {
                const input = await inquirer.prompt([
                    {
                        type: "input",
                        name: "task_number",
                        message: "Enter task number",
                    },
                ]);
                const task_number = input.task_number
                const task_id = tasks[task_number - 1].id
                const response = await fetch(`${base}/tasks/${task_id}/close`, {
                    method: "POST",
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.status == 204) {
                    printSuccess("Successfully completed task")
                }
                else {
                    printError("Error in completing task")
                }
                if (title == "FOR TODAY")
                    await getTodayTasks(token)
                else
                    await getAllTasks(token)
            }
            break;
        case "delete":
            {
                const input = await inquirer.prompt([
                    {
                        type: "input",
                        name: "task_number",
                        message: "Enter task number",
                    },
                ]);
                const task_number = input.task_number
                const task_id = tasks[task_number - 1].id
                const response = await fetch(`${base}/tasks/${task_id}`, {
                    method: "DELETE",
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.status == 204) {
                    printSuccess("Successfully deleted task")
                } else {
                    printError("Error in deleting task")
                }
                if (title == "FOR TODAY")
                    await getTodayTasks(token)
                else
                    await getAllTasks(token)
            }
            break;
        case "all":
            await getAllTasks(token)
            break;
        case "for-today":
            await getTodayTasks(token)
            break;
        case "exit":
            process.exit(0);
            break;
        default:
            printError("Invalid command")
            process.exit(0);
            break;
    }

}