'use strict'
const cote = require('cote')({statusLogsEnabled:false})
const http = require('http')
const u = require('@elife/utils')

function main() {
    let cfg = loadConfig()
    startHttpServer(cfg)
}

function loadConfig() {
    let cfg = {}
    if(process.env.QWERT_PORT) {
        cfg.PORT = process.env.QWERT_PORT
    } else {
        cfg.PORT = 8193
    }
    return cfg
}

function startHttpServer(cfg) {
    u.showMsg(`QWERT Server starting on ${cfg.PORT}...`)
    http.createServer(handleReq).listen(cfg.PORT)
}

function handleReq(req, res) {

    if(req.url == '/msg') return userMsg(req, res)
    else if(req.url == '/bot') return botMsg(req, res)
    else if( req.url == '/ping') return pingResponse(req, res)
}

function pingResponse(req, res) {
    res.writeHead(200)
    res.end()
}

function userMsg(req, res) {
    if(req.method != 'POST') return reply400(`Not a POST request`, res)
    withJSONData(req, res, (err, data) => {
        if(err) reply400(err, res)
        else {
            client.send({
                type: 'message',
                chan: botKey,
                ctx: 'qwert',
                from: 'localuser',
                msg: data.msg,
                addl: data.addl,
            }, (err) => {
                if(err) {
                    u.showErr(err)
                    res.writeHead(500)
                } else {
                    res.writeHead(200)
                }
                res.end()
            })
        }
    })
}

let MSGS = []
function addReply(data) {
    if(data.msg || data.addl) MSGS.push(data)
}

function botMsg(req, res) {
    res.writeHead(200)
    let msg = MSGS.shift()
    if(msg || msg === 0) res.end(JSON.stringify(msg))
    else res.end()
}

/*      outcome/
 * Log and respond with client error
 */
function reply400(e, res) {
    u.showErr(e)
    res.writeHead(400)
    res.end()
}

/*
 *      problem/
 * The data reaching us in is saved in the Body of the message and not
 * in the URL or the headers.
 *
 *      way/
 * Use events to read the body data as it arrives and append it to a
 * string.
 *
 * This is not very efficient so we restrict the maximum request size.
 *
 * TODO: Validate if this is ok esp with storing video
 */
function withPostData(req, res, cb) {
    let data = '';
    req.on('data', (d) => {
        data += d;
        if(data.length > 2e7) {
            data = "";
            res.writeHead(413)
            res.end();
            req.connection.destroy();
        }
    });
    req.on('end', () => {
        cb(null, data);
    });
}

/*      outcome/
 * Get the Post data and convert it into a JSON object before returning
 */
function withJSONData(req, res, cb) {
    withPostData(req, res, (err, data) => {
        if(err) cb(err)
        else {
            try {
                let o = JSON.parse(data)
                cb(null, o)
            } catch(e) {
                u.showErr(e.message)
                cb(`Failed to parse data: ` + data)
            }
        }
    })
}

const client = new cote.Requester({
    name: 'QWERT Comm Channel',
    key: 'everlife-communication-svc',
})

/*      understand/
 * The telegram microservice has to be partitioned by a key to identify
 * it uniquely.
 */
const botKey = 'everlife-comm-qwert-svc'

const botChannel = new cote.Responder({
    name: 'QWERT Communication Service',
    key: botKey,
})

botChannel.on('reply', (req, cb) => {
    addReply({msg: req.msg, addl: req.addl})
    cb()
})

/**
 *   outcome/
 *  This service is used to get the message from the support channel, 
 * show the message to the owner of the avatar
 * 
 */
botChannel.on('support-msg', (req, cb) =>{
    addReply({msg: req.msg, addl: req.addl}) 
} )
main()
