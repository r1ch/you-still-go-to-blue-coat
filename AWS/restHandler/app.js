'use strict'
//AWS Setup
const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB.DocumentClient()

//Dynamo Setup
const {
    DynamoDbSchema,
    DynamoDbTable,
    DataMapper
} = require('@aws/dynamodb-data-mapper');
const { v4 } = require('uuid');
const DynamoDB = require('aws-sdk/clients/dynamodb');

const client = new DynamoDB({region: 'eu-west-1'});
const mapper = new DataMapper({client});

//Express Setup
const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const compression = require('compression')
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')
const app = express()
const router = express.Router()
const asyncHandler = require('express-async-handler')


router.use(cors())
router.use(bodyParser.json())
router.use(bodyParser.urlencoded({ extended: true }))
router.use(awsServerlessExpressMiddleware.eventContext())


router.get('/',(req,res) => {
    res.redirect(301,"https://witb.bradi.sh/")
})

//List all games
router.get('/games', asyncHandler(async (req, res) => {
    let games = []
    for await (const game of mapper.query(Game, {recordType: 'GAME'})) {
        games.push(game)
    }
    res.json(games)
}))

//Get a specific game
router.get('/games/:game', (req, res) => {
    mapper.get(Object.assign(new Game, {identifier: req.params.game}))
    .then(res.json.bind(res))
    .catch(err => {
        console.log(err)
        res.status(404).send(`No game found for ID: ${req.params.game}`)
    })
})

//Join a player to a game (upsert a player association)
router.put('/games/:game/players', (req, res)=>{
    let player = new Player();
    player.identifier = req.body.id
    player.url = req.body.url
    player.name = req.body.name
    player.association = req.params.game;
    mapper.update(player,{onMissing: 'skip'}).then(res.json.bind(res))
})

//Get all players in a game
router.get('/games/:game/players', asyncHandler(async (req, res) => {
    let players = []
    for await (const player of mapper.query(Player, {recordType: 'PLAYER', association: req.params.game}, {indexName: 'index'})) {
        players.push(simple(player))
    }
    res.json(players)
}))

//Get a player
router.get('/players/:player', (req, res) => {
    mapper.get(Object.assign(new Player, {identifier: req.params.player}))
    .then(res.json.bind(res))
    .catch(err => {
        console.log(err)
        res.status(404).send(`No player found for ID: ${req.params.player}`)
    })
})

//Update a player's names
router.put('/players/:player/names', (req, res)=>{
    let player = new Player();
    player.identifier = req.params.player
    player.names = req.body.names
    mapper.update(player,{onMissing: 'skip'}).then(res.json.bind(res))
})

//Get a player's names
router.get('/players/:player/names', (req, res) => {
    mapper.get(Object.assign(new Player, {identifier: req.params.player}))
    .then(player=>{
        res.json(namesOf(player))
    })
    .catch(err => {
        console.log(err)
        res.status(404).send(`No game found for ID: ${req.params.player}`)
    })
})

//Update a player's team
router.put('/players/:player/team', (req, res)=>{
    let player = new Player();
    player.identifier = req.params.player
    player.team = req.body.team
    mapper.update(player,{onMissing: 'skip'}).then(res.json.bind(res))
})

//Get a player's team
router.get('/players/:player/team', (req, res) => {
    mapper.get(Object.assign(new Player, {identifier: req.params.player}))
    .then(player=>{
        res.json(teamOf(player))
    })
    .catch(err => {
        console.log(err)
        res.status(404).send(`No player found for ID: ${req.params.player}`)
    })
})

router.post('/games/:game/start', asyncHandler(async (req, res) => {
    console.log("Starting game")
    let names = []
    let t = {}
    for await (const player of mapper.query(Player, {recordType: 'PLAYER', association: req.params.game}, {indexName: 'index'})) {
        names.push(...namesOf(player))
        if(!t[player.team]){
            t[player.team] = {
                team : player.team,
                players : [player],
            }
        } else {
            t[player.team].players.push(player)
        }
    }
    let teams = []
    for(let key of Object.keys(t)){
        teams.push(t[key])
    }
    let game = new Game()
    game.identifier = req.params.game
    game.names = names
    game.namesLeftThisRound = names
    game.teams = teams
    game.teamIndex = 0
    game.teamPlayerIndex = Array(teams.length).fill(0)
    game.playIndex = 0
    game.roundIndex = 0
    game.started = true
    game.ended = false
    console.log(JSON.stringify(game))
    mapper.update(game,{onMissing: 'skip'}).then((game)=>{
        res.json(game)
    })
}))

router.put('/games/:game/turn/:turn', asyncHandler(async (req, res) => {
    mapper.get(Object.assign(new Game, {identifier: req.params.game}))
    .then((game)=>{
        if(game.playIndex>req.params.turn) return res.json(game)
        else{
            if(!game.ended){
                //record turn
                game.turns = game.turns || [];
                game.turns[game.playIndex] = {
                    roundIndex: game.roundIndex,
                    teamIndex: game.teamIndex,
                    playerIndex: game.teamPlayerIndex[game.teamIndex],
                    names: req.body.namesGot
                }
                //prune names
                let tempNamesGot = [...req.body.namesGot]
                game.namesLeftThisRound = game.namesLeftThisRound.filter(name=>{
                    console.log(`They got ${req.body.namesGot}, checking ${name} in ${game.namesLeftThisRound}`)
                    let at = tempNamesGot.indexOf(name)
                    console.log(`Got index ${at}`)
                    if(at>=0){
                        console.log(`So will remove ${tempNamesGot.splice(at,1)}`)
                        return false
                    }
                    return true
                })
            }
            console.log(`Carrying forward ${JSON.stringify(game.namesLeftThisRound)}`)

            //new round + names if no names left or end the game
            if(game.namesLeftThisRound.length==0){
                if(game.roundIndex<game.rounds.length-1){
                    game.roundIndex++
                    game.namesLeftThisRound = game.names
                } else {
                    game.ended = true
                }
            }

            if(!game.ended){
                game.playIndex++
                game.teamPlayerIndex[game.teamIndex] = (game.teamPlayerIndex[game.teamIndex]+1)%game.teams[game.teamIndex].players.length
                game.teamIndex = game.playIndex%game.teams.length
            }

            console.log(JSON.stringify(game))

            mapper.update(game,{onMissing: 'skip'}).then((game)=>{
                res.json(game)
            })

        }

    })
}))


app.use('/', router)

module.exports = app


const simple = (player)=>{
    if (player.names) player.numberOfNames = player.names.length
    else player.numberOfNames = 0
    delete player.names
    return player
}

const namesOf = (player)=>{ 
    if (player.names) return player.names
    else return []
}

const teamOf = (player)=>{
    if (player.team) return player.team
    else return 0
}

class Game {
    constructor(){
        this.recordType = "GAME";
    }
}

Object.defineProperties(Game.prototype, {
    [DynamoDbTable]: {
        value: 'witb'
    },
    [DynamoDbSchema]: {
        value: {
            recordType: {
                type: 'String',
                keyType: 'HASH',
                defaultProvider: ()=>"GAME",
            },
            identifier: {
	              type: 'String',
                  keyType: 'RANGE',
                  defaultProvider: v4
            },
            title: {type : 'String'},
            rounds: {type: 'List', memberType: {type: 'String'}},
            secondsPerRound: {type: 'Number'},
            namesPerPerson: {type: 'Number'},
            names: {type: 'List', memberType: {type: 'String'}},
            namesLeftThisRound: {type: 'List', memberType: {type: 'String'}},
            turns: {type: 'List', memberType: {type: 'Document',
                members: {
                    roundIndex: {type:'Number'},
                    teamIndex: {type:'Number'},
                    playerIndex: {type:'Number'},
                    names: {type: 'List', memberType: {type: 'String'}},
                }   
            }},
            teams: {type: 'List', memberType: {type: 'Document',
                members: {
                    team: {type:'Number'},
                    players: {type: 'List', memberType: {type: 'Document',
                        members: {
                            url: {type : 'String'},
                            identifier: {type : 'String'},
                            name: {type : 'String'},
                            team: {type : 'Number'}
                        }
                    }}
                }
            }},
            playIndex: {type: 'Number'},
            roundIndex: {type: 'Number'},
            teamIndex : {type: 'Number'},
            teamPlayerIndex : {type: 'List', memberType: {type: 'Number'}},
            started: {type: 'Boolean'},
            ended: {type: 'Boolean'},
            updated: {
                type : 'Number',
                defaultProvider: ()=>Date.now()
            }
        },
    },
});


class Player {
    constructor(){
        this.recordType = "PLAYER"
    }
}

Object.defineProperties(Player.prototype, {
    [DynamoDbTable]: {
        value: 'witb'
    },
    [DynamoDbSchema]: {
        value: {
            recordType: {
                type: 'String',
                keyType: 'HASH',
                defaultProvider: ()=>"PLAYER",
            },
            identifier: {
	              type: 'String',
                  keyType: 'RANGE',
                  defaultProvider: v4   
            },
            name: {type : 'String'},
            url: {type: 'String'},
            association: {type: 'String'},
            names: {type: 'List', memberType: {type: 'String'}},
            team: {
                type : 'Number',
                defaultProvider: ()=>0
            },
            updated: {
                type : 'Number',
                defaultProvider: ()=>Date.now()
            }
        },
    },
});