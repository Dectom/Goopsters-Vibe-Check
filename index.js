const Discord = require('discord.js');
const mysql = require(`mysql`);
const tfs = require('@tensorflow/tfjs');
const toxicity = require('@tensorflow-models/toxicity');
const auth = require('./auth.json');

const Client = new Discord.Client();
const con = mysql.createPool(auth.mysql);

const threshold = 0.6;

const scoreSystem = {
  identity_attack: 5,
  insult: 2,
  obscene: 1,
  severe_toxicity: 25,
  sexual_explicit: 3,
  threat: 10,
  toxicity: 2,
}

let Toxic;
test();

async function query(query, params) {
  return new Promise((resolve, reject) => {
    con.query({ sql: query }, params, (err, res) => {
      if(err) return console.log(err);
      console.log(`Executed request => ${query}`);
      resolve(res);
    });
  });
}; ""

async function test() {
  await toxicity.load(threshold).then(model => {Toxic = model;});
  con.query("SHOW TABLES;", (err, res) => {
    if (err) return process.exit(`FAILED_SQL_CONNECTION`);
    else console.log("MySQL Connection Initialized.");
  });
  Client.on('message', async (msg) => {
    if(msg.author.bot) return;
    let user = (await query("SELECT * FROM users WHERE id = ?", [msg.author.id]))[0];
    if(!user) await query("INSERT INTO users (id, points) VALUES(?, ?)", [msg.author.id, 0]);

    let tempArr = [];
    let results = [];
    Toxic.classify(msg.content).then(async (res) => {
      for (let i in res) {
        for (let x in res[i].results) {
          results.push(`label: ${res[i].label}, probabilities: ${JSON.stringify(res[i].results[x].probabilities)}, match: ${res[i].results[x].match ? 'true' : 'false'}\n`);
          if (res[i].results[x].match) {
            console.log(`Detected ${msg.author.tag} as ${res[i].label}`);
            tempArr.push(res[i].label);
          }
        }
      }
      if(tempArr.length >=1) {
        let score = 0;
        for(let i in tempArr) {
          score += scoreSystem[tempArr[i]]
        }
        if (msg.channel.id === "555218595072966677") {
          msg.channel.send(results);
        }
        await query("UPDATE users SET points = ? WHERE id = ?", [user.points += score, msg.author.id]);
        msg.channel.send(`Woah ${msg.author} you failed the vibe check \n \n\`${tempArr.join(", ")}\`, You were given \`${score}\` vibe points`);
      }
    })

    if (msg.content.toLowerCase().startsWith(`-score`) || msg.content.toLowerCase().startsWith(`-points`)) {
      if (msg.mentions.users.first()) {
        let tmp = (await query("SELECT * FROM users WHERE id = ?", [msg.mentions.users.first().id]))[0];
        if(!tmp) return msg.channel.send("User doesn't have a profile yet.");
        user = tmp;
      }
      msg.channel.send(user.points);
    }

    if(msg.content.toLowerCase().startsWith(`-leaderboard`) || msg.content.toLowerCase().startsWith(`-lb`)) {
      let lb = await query("SELECT * FROM users ORDER BY points DESC LIMIT 10");
      let tmp = [];
      for(let i = 0; i < lb.length; i++) {
        let member = await msg.guild.members.fetch(lb[i].id);
        if(member) tmp.push(`#${i+1} ${member.user.username}#${member.user.discriminator} - ${lb[i].points}`);
      }
      msg.channel.send(`Top 10 Toxic People:\n \n\`\`\`${tmp.join("\n")}\`\`\``)
    }
  });
  Client.on('ready', () => {
    console.log(`Prepared to check yo vibes as ${Client.user.tag}`);
  })
  Client.login(auth.token);
}