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


//List all games
router.get('/attendees/latest', asyncHandler(async (req, res) => {
    let games = []
    for await (const game of mapper.query(Game, {recordType: 'GAME'})) {
        games.push(game)
    }
    res.json(games)
}))

//Get a specific game
router.get('/attendee', (req, res) => {
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



app.use('/', router)

module.exports = app


class Attendee {
    constructor(){
        this.recordType = "ATTENDEE";
    }
}

Object.defineProperties(Attendee.prototype, {
    [DynamoDbTable]: {
        value: 'bluecoat'
    },
    [DynamoDbSchema]: {
        value: {
            recordType: {
                type: 'String',
                keyType: 'HASH',
                defaultProvider: ()=>"ATTENDEE",
            },
            identifier: {
	              type: 'String',
                  keyType: 'RANGE',
                  defaultProvider: v4
            },
        },
    },
});