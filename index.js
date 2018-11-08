'use strict'
const http = require('http')
const u = require('elife-utils')

function main() {
    let cfg = loadConfig()
    startHttpServer(cfg)
}

function loadConfig() {
    let cfg = {}
    if(process.env.QWERT_PORT) {
        cfg.PORT = process.env.QWERT_PORT
    } else {
        cfg.PORT = 7766
    }
    return cfg
}

function startHttpServer(cfg) {
    u.showMsg(`Server starting on ${cfg.PORT}...`)
    http.createServer(handleReq).listen(cfg.PORT)
}

function handleReq(req, res) {
    u.showMsg('Got request: ' + req.url)
    if(req.url == '/msg') return userMsg(req, res)
    if(req.url == '/bot') return botMsg(req, res)
    return reply400('Not found', res)
}

function userMsg(req, res) {
    if(req.method != 'POST') return reply400(`Not a POST request`, res)
    withJSONData(req, res, (err, data) => {
        if(err) reply400(err, res)
        else {
            addReply(data)
            res.writeHead(200)
            res.end()
        }
    })
}

let MSGS = []
// TODO: remove this temp function
function addReply(data) {
    if(data.msg) MSGS.push(data.msg)
}

function botMsg(req, res) {
    res.writeHead(200)
    let msg = MSGS.shift()
    if(msg) res.end(JSON.stringify({msg:msg}))
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
 * string. While this is not very efficient, we don't expect the
 * requests to be very large so it should be ok. If the requests are
 * very large we terminate the request.
 *
 * TODO: Validate maxmimum request size
 */
function withPostData(req, res, cb) {
    let data = '';
    req.on('data', (d) => {
        data += d;
        if(data.length > 1e6) {
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


main()
