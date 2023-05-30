const express = require('express');
const app = express();
const fs = require('fs');
// const env = require('../HOST.env.json');
const API_BASEURL = "http://http://localhost:3001";
const API_CRM_URL = "http://localhost:3001";
const GRAPHQL_API_URL = "http://obl-new.orientbell.com/graphql";
const QUIZ_API_URL = "http://obl-new.orientbell.com/graphql";

// Logger
const accessLogStream = fs.createWriteStream(__dirname + '/server.log', {flags: 'a'})
var logger = function (type, msg) {
    let _date = (new Date()).toLocaleString('en-GB', {timeZone: 'Asia/Kolkata'});
    let _log = JSON.stringify({...{severity: type, time: _date}, ...msg});
    _log += '\n\n';

    accessLogStream.write(_log);
}

// hits on www
const PROXY_API_PREFIX = '/';

var crypto = require('crypto');
var bodyParser = require('body-parser');
var request = require('request');
var proxyAPI = express.Router();

var cookieParser = require('cookie-parser')
app.use(cookieParser());

var iv = new Buffer.from('0000000000000000');
var encrypt = function (data, key) {
    var decodeKey = crypto.createHash('sha1').update(key, 'utf-8').digest().slice(0, 16);
    var cipher = crypto.createCipheriv('aes-128-cbc', decodeKey, iv);
    var final = cipher.update(data, 'utf8', 'hex') + cipher.final('hex');
    return final.length > 10 ? final.toUpperCase() : false;
};

function decrypt(data, key) {
    var mykey = crypto.createDecipher('aes-128-cbc', key);
    var mystr = mykey.update(data, 'hex', 'utf8')
    mystr += mykey.final('utf8');
    return mystr;
}

// app.engine('.html', require('ejs').renderFile);
// app.engine('.js', require('ejs').renderFile);
// app.engine('.json', require('ejs').renderFile);

// Body Parser
app.use(bodyParser.json({limit: "50mb"}));
app.use(bodyParser.urlencoded({limit: "50mb", extended: true, parameterLimit: 50000}));

const allowedOrigins = ['http://localhost:3050','http://localhost:4000', 'http://localhost:3000'];
// Middleware For CORS
app.use(function (req, res, next) {

    if (allowedOrigins.indexOf(req.headers['origin']) > -1) {
        res.setHeader('Access-Control-Allow-Origin', req.headers['origin']);
    }
    res.header('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Headers',
        [
            'Origin',
            'X-Requested-With',
            'Content-Type',
            'Authorization',
            'AgentAuthorization',
            'content-currency',
            'Cache-Control',
            'x-prerender',
            'user-agent',
            'Store'
        ].join(', ')
    );
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Powered-By', 'Mark 42');
    let shouldNext = true;

    if (req.method === 'OPTIONS' &&
        ((req.connection.encrypted ? ' https://' : 'http://') + req.hostname) === "http://localhost:3001") {
        res.status(200);
        res.send();
        shouldNext = false;
    } else {
        let _headers = {}
        let _slashIndex = req.url.replace(PROXY_API_PREFIX).indexOf('/');
        let _query = req.url.substring(_slashIndex + 1);
        if (req.url.indexOf('?') > -1) {
            _query = _query.split('?')[0];
        }
            _headers['user-agent'] = req.headers['user-agent'];

        if (req.url.indexOf('mobileapi') > -1 || req.url.indexOf('restapi') > -1) {
            _headers['x-api-key'] = "http://obl-new.orientbell.com/graphql";
            _headers['lang'] = req.headers['lang'] ? req.headers['lang'] : "";
            _headers['authorization'] = req.headers['authorization'];
        }
        if (req.url.indexOf('graphql') > -1) {
            _headers['Authorization'] = req.headers['authorization'];
            _headers['content-currency'] = req.headers['content-currency'] && req.headers['content-currency'] !== 'null' && req.headers['content-currency'] !== null ? req.headers['content-currency'] : "USD"
            _headers['Store'] = req.headers['store'] && req.headers['store'] !== 'null' && req.headers['store'] !== null ? req.headers['store'] : "default"
        }
        _headers['Authorization'] = req.headers['authorization'];
        if (shouldNext) {
            _headers['X-Forwarded-For'] = req.ip;
            if (req.headers['content-type']) {
                _headers['Content-Type'] = 'application/json';
            }
            req._headers = _headers;
            next();
        }
    }
});

// get cookie list
function cookieList(cookies) {
    var rc = cookies
    var list = {};
    rc && rc.split(';').forEach(function (cookie) {
        var parts = cookie.split('=');
        list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
    return list;
}

// Set API Domain
app.use(PROXY_API_PREFIX, proxyAPI);

proxyAPI.get('*', function (req, res) {
    const _path = req.url;
    doGet(req._headers, _path).then(data => {
        res.status(data.status);
        res.send(data.body);
    }).catch(err => {
        // console.log(err)
        res.send('{"results":{"exception":true},"statusCode":200}');
    });
})

function doGet(_headers, _path) {
    let _url = (_path.indexOf("/graphql") > -1 ? GRAPHQL_API_URL : API_BASEURL) + _path;
    return new Promise(function (resolve, reject) {
        request(
            {
                headers: _headers,
                url: _url,
                method: 'GET'
            }, function (err, res, body) {
                if (err) {
                    logger('error', {
                        status: 'NETWORK_FAULT',
                        req: _url,
                        requestType: 'GET',
                        error: err
                    });
                    resolve({body: '{"results":{"exception":true},"statusCode":500}', status: 500});
                } else {
                    if (res.statusCode > 200 && res.statusCode <= 403 && _url.indexOf('event/track') === -1) {
                        logger('silent', {
                            status: res.statusCode.toString(),
                            req: _url,
                            resHeaders: res.headers,
                            requestType: 'GET',
                            RESPMSG: body
                        });
                    }

                    if (res.statusCode > 403) {
                        logger('error', {
                            status: res.statusCode.toString(),
                            req: _url,
                            requestType: 'GET',
                            RESPMSG: body
                        });
                    }

                    resolve({body: body, status: res.statusCode});
                }
            }
        );
    });
}


proxyAPI.post('*', function (req, res) {
    const _path = req.url;
    let _formData = req.body;
    // console.log(req._headers,"req._headers", _path,"_path", _formData,"_formData", req._isHostURL,"req._isHostURL")
    doPOST(req._headers, _path, _formData, req._isHostURL).then(data => {
        res.status(data.status);
        res.send(data.body);
    }).catch(err => {
        res.send('{"results":{"exception":true},"statusCode":500}');
    })
})

function doPOST(_headers, _path, _data, isHostURL, isFlag) {
    // let _url = (_path.indexOf("/graphql") > -1 ? GRAPHQL_API_URL : API_BASEURL) + _path;
    let _url = GRAPHQL_API_URL;

    if (_path.indexOf('mobileapi') > -1 || _path.indexOf('restapi') > -1) {
        _url = QUIZ_API_URL + _path
    }
    return new Promise(function (resolve, reject) {
        let options = {
            headers: _headers,
            uri: _url,
            method: 'POST'
        }
        console.log(options)

        if (_headers['Content-Type'] && _headers['Content-Type'] === 'application/json')
            options['body'] = JSON.stringify(_data);
        else
            options['formData'] = _data;
        request(options, function (err, res, body) {
            if (err) {
                console.log(err)
                logger('error', {
                    status: 'NETWORK_FAULT_1',
                    req: _path,
                    requestType: 'POST',
                    eventDate: options['body'] || options['formData'],
                    error: err
                });
                resolve({body: '{"results":{"exception":true},"statusCode":500}', status: 500});
            } else {
                console.log("magic works")
                if (res.statusCode > 200 && res.statusCode <= 403) {
                    logger('silent', {
                        status: res.statusCode.toString(),
                        req: options.uri,
                        resHeaders: res.headers,
                        requestType: 'POST',
                        eventDate: options['body'] || options['formData'],
                        RESPMSG: body
                    });
                }

                if (res.statusCode > 403) {
                    logger('error', {
                        status: res.statusCode.toString(),
                        req: options.uri,
                        resHeaders: res.headers,
                        requestType: 'POST',
                        eventDate: options['body'] || options['formData'],
                        RESPMSG: body
                    });
                }
                resolve({body: body, status: res.statusCode});
            }
        });
    });
}


function doMultipartImageUpload(url, req, res) {
    return new Promise(function (resolve, reject) {
        let _headers = {
            'AUTHORIZATION': req.headers['authorization'] ? req.headers['authorization'] : '',
            'Content-Type': 'multipart/form-data'
        };
        req.headers = {...req.headers, ..._headers};
        var FormData = require('form-data');
        var form = new FormData();
        if (req.file) {
            form.append('image', fs.createReadStream(tmpFileDir + "/" + req.file.filename));
        }
        var options = {
            url: UM_API_URL + url,
            method: 'POST',
            headers: _headers,
            formData: {image: fs.createReadStream(tmpFileDir + "/" + req.file.filename)}
        };

        request(options, function (err, res, body) {
            if (req.file) {
                fs.unlink(tmpFileDir + "/" + req.file.filename, () => {
                })
            }
            if (err) {
                logger('error', {
                    status: 'NETWORK_FAULT_1',
                    req: options.url,
                    requestType: 'GET',
                    eventDate: options['body'] || options['formData'],
                    error: err
                });
                resolve({body: '{"results":{"exception":true},"statusCode":500}', status: 500});
            } else {
                if (res.statusCode > 200 && res.statusCode <= 403) {
                    logger('silent', {
                        status: res.statusCode.toString(),
                        req: options.url,
                        resHeaders: res.headers,
                        requestType: 'POST',
                        eventDate: options['body'] || options['formData'],
                        RESPMSG: body
                    });
                }

                if (res.statusCode > 403) {
                    logger('error', {
                        status: res.statusCode.toString(),
                        req: options.url,
                        resHeaders: res.headers,
                        requestType: 'POST',
                        eventDate: options['body'] || options['formData'],
                        RESPMSG: body
                    });
                }
                resolve({body: body, status: res.statusCode});
            }
        });

    });

}

proxyAPI.put('*', function (req, res) {
    const _path = req.url;
    var _formData = req.body;
    doPUT(req._headers, _path, _formData).then(data => {
        res.status(data.status);
        res.send(data.body);
    }).catch(err => {
        res.send('{"results":{"exception":true},"statusCode":500}');
    })
});

function doPUT(_headers, _path, _data) {
    return new Promise(function (resolve, reject) {
        let options = {
            headers: _headers,
            uri: API_BASEURL + _path,
            method: 'PUT'
        };
        if (_headers['Content-Type'] && _headers['Content-Type'] === 'application/json')
            options['body'] = JSON.stringify(_data);
        else
            options['formData'] = _data;
        request(options, function (err, res, body) {
            if (err) {
                logger('error', {
                    status: 'NETWORK_FAULT_1',
                    req: _path,
                    requestType: 'GET',
                    eventDate: options['body'] || options['formData'],
                    error: err
                });
                resolve({body: '{"results":{"exception":true},"statusCode":500}', status: 500});
            } else {
                if (res.statusCode > 200 && res.statusCode <= 403) {
                    logger('silent', {
                        status: res.statusCode.toString(),
                        req: options.uri,
                        resHeaders: res.headers,
                        requestType: 'POST',
                        eventDate: options['body'] || options['formData'],
                        RESPMSG: body
                    });
                }

                if (res.statusCode > 403) {
                    logger('error', {
                        status: res.statusCode.toString(),
                        req: options.uri,
                        resHeaders: res.headers,
                        requestType: 'POST',
                        eventDate: options['body'] || options['formData'],
                        RESPMSG: body
                    });
                }
                resolve({body: body, status: res.statusCode});
            }
        });
    });
}

proxyAPI.delete('*', function (req, res) {
    const _path = req.url;
    doDelete(req._headers, _path).then(data => {
        res.status(data.status);
        res.send(data.body);
    }).catch(err => {
        res.send('{"results":{"exception":true},"statusCode":200}');
    });
});

function doDelete(_headers, _path) {
    let _url = API_BASEURL + _path;
    return new Promise(function (resolve, reject) {
        request(
            {
                headers: _headers,
                url: _url,
                method: 'DELETE'
            }, function (err, res, body) {
                if (err) {
                    logger('error', {
                        status: 'NETWORK_FAULT',
                        req: _url,
                        requestType: 'DELETE',
                        error: err
                    });
                    resolve({body: '{"results":{"exception":true},"statusCode":500}', status: 500});
                } else {
                    if (res.statusCode > 403) {
                        logger('error', {
                            status: res.statusCode.toString(),
                            req: _url,
                            requestType: 'GET',
                            RESPMSG: body
                        });
                    }
                    resolve({body: body, status: res.statusCode});
                }
            }
        );
    });
}


proxyAPI.patch('*', function (req, res) {
    const _path = req.url;
    var _formData = req.body;
    doPATCH(req._headers, _path, _formData).then(data => {
        res.status(data.status);
        res.send(data.body);
    }).catch(err => {
        res.send('{"results":{"exception":true},"statusCode":500}');
    })
});

function doPATCH(_headers, _path, _data) {
    return new Promise(function (resolve, reject) {
        let options = {
            headers: _headers,
            uri: API_BASEURL + _path,
            method: 'PATCH'
        };
        if (_path.indexOf('/api') > -1 || _path.indexOf("/crm/") > -1) {
            options.uri = API_CRM_URL + _path;
        }
        if (_path.indexOf('/emailOrCall') > -1) {
            options.uri = API_CRM_URL + _path;
        }
        if (_headers['Content-Type'] && _headers['Content-Type'] === 'application/json')
            options['body'] = JSON.stringify(_data);
        else
            options['formData'] = _data;
        request(options, function (err, res, body) {
            if (err) {
                logger('error', {
                    status: 'NETWORK_FAULT_1',
                    req: _path,
                    requestType: 'GET',
                    eventDate: options['body'] || options['formData'],
                    error: err
                });
                resolve({body: '{"results":{"exception":true},"statusCode":500}', status: 500});
            } else {
                if (res.statusCode > 200 && res.statusCode <= 403) {
                    logger('silent', {
                        status: res.statusCode.toString(),
                        req: options.uri,
                        resHeaders: res.headers,
                        requestType: 'POST',
                        eventDate: options['body'] || options['formData'],
                        RESPMSG: body
                    });
                }

                if (res.statusCode > 403) {
                    logger('error', {
                        status: res.statusCode.toString(),
                        req: options.uri,
                        resHeaders: res.headers,
                        requestType: 'POST',
                        eventDate: options['body'] || options['formData'],
                        RESPMSG: body
                    });
                }
                resolve({body: body, status: res.statusCode});
            }
        });
    });
}

app.all('*', function (req, res) {
    res.status(403);
    res.send('{"results":{"exception":true},"statusCode":403}');
    logger('silent', {
        status: "403",
        req: req.path,
        error: 'INVALID_ROUTE'
    });
});

module.exports = function (WORKER_ID) {
    app.listen(3001, () => {
        console.log('SERVER ' + WORKER_ID + ' STARTED on PORT: ' + 3001);
    });
};
