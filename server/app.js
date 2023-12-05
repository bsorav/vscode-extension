#!/usr/bin/env node

const
    nopt = require('nopt'),
    os = require('os'),
    path = require('path'),
    process = require('process'),
    systemdSocket = require('systemd-socket'),
    url = require('url'),
    _ = require('underscore'),
    https = require('https'),
    fs = require('fs'),
    express = require('express'),
    responseTime = require('response-time'),
    Sentry = require('@sentry/node'),
    {logger, logToPapertrail, suppressConsoleLog} = require('./lib/logger'),
    RouteAPI = require('./lib/handlers/route-api');

const opts = nopt({
  host: [String],
  port: [Number],
  superoptInstall: [String],
  serverInstall: [String],
  tmpDir: [String]
});

const defArgs = {
  hostname: opts.host || 'localhost',
  port: opts.port || 80,
  superoptInstall: opts.superoptInstall || '/usr/local',
  serverInstall: opts.serverInstall || '/usr/local',
  tmpDir: opts.tmpDir || '/tmp',
};

//const codeAnalysisURL = "/codeAnalysis";

async function main() {
    const CompilationEnvironment = require('./lib/compilation-env');
    const compilationEnvironment = new CompilationEnvironment(/*compilerProps, compilationQueue, defArgs.doCache*/);
    const EqcheckHandler = require('./lib/handlers/eqcheck').Handler;
    const eqcheckHandler = new EqcheckHandler(defArgs.hostname, defArgs.port, defArgs.superoptInstall, process.env.DEFAULT_EQCHECK_QUOTA);

    const StorageHandler = require('./lib/storage/storage');
    const storageHandler = StorageHandler.storageFactory('local'/*, compilerProps, awsProps*/, '/');

    logger.info("=======================================");
    
    const webServer = express(),
        sFavicon = require('serve-favicon'),
        bodyParser = require('body-parser'),
        morgan = require('morgan'),
        compression = require('compression'),
        router = express.Router();

    const routeApi = new RouteAPI(router/*, compileHandler*/, eqcheckHandler/*, typecheckHandler, ceProps*/, storageHandler/*, renderGoldenLayout*/);

    webServer
        .set('trust proxy', true)
        .set('view engine', 'pug')
        .use(bodyParser.json({limit: '1000mb'}))
        .on('error', err => logger.error('Caught error in web handler; continuing:', err))
        .use(express.json())
        .use('/', router)
        //.use(codeAnalysisURL, (req, res) => {
        //  console.log('Url ', req.originalUrl, ' reached at ', req._startTime, ' by ip address ', req.ip, ' refered by ', req.get('Referer'), ' headers ', req.headers);
        //  const path = req.originalUrl.substring(codeAnalysisURL.length);
        //  const html = fs.readFileSync('path');
        //  res.send(html);
        //})
        //.post('/test', (req, res) => {
        //    console.log('method:\n' + req.method);
        //    console.log('headers:\n' + JSON.stringify(req.headers));
        //    console.log('query:\n' + JSON.stringify(req.query));
        //    console.log('route:\n' + JSON.stringify(req.route));
        //    console.log('params:\n' + JSON.stringify(req.params));
        //    console.log('_parsedUrl:\n' + JSON.stringify(req._parsedUrl));
        //    console.log('_readableState:\n' + JSON.stringify(req._readableState));
        //    console.log('complete:\n' + JSON.stringify(req.complete));
        //    console.log('rawTrailers:\n' + JSON.stringify(req.rawTrailers));
        //    //console.log('res:\n' + JSON.stringify(req.res));
				//		console.log('mode:\n' + req.mode);
        //    console.log('cache:\n' + req.cache);
        //    console.log('body:\n' + req.body);
        //    res.json({requestBody:req.body});
        //    console.log('body:\n' + JSON.stringify(req.body));
        //    console.log('data:\n' + JSON.stringify(req.data));
        //    console.log('source:\n' + JSON.stringify(req.source));
        //    console.log('source1Uri:\n' + JSON.stringify(req.source1Uri));
        //})
        .use((req, res, next) => {
            next({status: 404, message: `page "${req.path}" could not be found`});
        });

    router
        .get('/', (req, res) => {
            console.log('Url ', req.originalUrl, ' reached at ', req._startTime, ' by ip address ', req.ip, ' refered by ', req.get('Referer'), ' headers ', req.headers);
            //console.log('eqcheck page reached, app ', req.app);
            //console.log('eqcheck page reached, baseUrl ', req.baseUrl);
            //console.log('eqcheck page reached, body ', req.body);
            //console.log('eqcheck page reached, cookies ', req.cookies);
            //console.log('eqcheck page reached, fresh ', req.fresh);
            //console.log('eqcheck page reached, host ', req.hostname);
            //console.log('eqcheck page reached, method ', req.method);
            //console.log('eqcheck page reached, originalUrl ', req.originalUrl);
            //console.log('landing page reached, referer ', req.get('Referer'));
            //res.render('landing', renderConfig({
            //    embedded: false,
            //    mobileViewer: isMobileViewer(req)
            //}, req.query));
            res.send("Index page\n");
        })
        .get('/eqcheck', (req, res) => {
            console.log('Url ', req.originalUrl, ' reached at ', req._startTime, ' by ip address ', req.ip, ' refered by ', req.get('Referer'), ' headers ', req.headers);
            //res.render('eqcheck', renderConfig({embedded: false}, req.query));
            res.send("Eqcheck page\n");
        });

    routeApi.InitializeRoutes();

    startListening(webServer);
}

function startListening(server) {
    let _port;
    /*const ss = systemdSocket();
    if (ss) {
        // ms (5 min default)
        const idleTimeout = process.env.IDLE_TIMEOUT;
        const timeout = (typeof idleTimeout !== 'undefined' ? idleTimeout : 300) * 1000;
        if (idleTimeout) {
            const exit = () => {
                logger.info("Inactivity timeout reached, exiting.");
                process.exit(0);
            };
            let idleTimer = setTimeout(exit, timeout);
            const reset = () => {
                clearTimeout(idleTimer);
                idleTimer = setTimeout(exit, timeout);
            };
            server.all('*', reset);
            logger.info(`  IDLE_TIMEOUT: ${idleTimeout}`);
        }
        _port = ss;
    } else */{
        _port = defArgs.port;
    }

    if (process.env.USE_HTTPS == "true") {
      const httpsServer = https.createServer({
        key: fs.readFileSync(process.env.SSL_PRIVKEY),
        cert: fs.readFileSync(process.env.SSL_CERT),
      }, server);
      httpsServer.listen(_port,  () => {
        logger.info(`HTTPS server started on port ${_port}`);
        logger.info("=======================================");
      });
    } else {
      logger.info(`  Listening on http://${defArgs.hostname}:${_port}/`);
      logger.info("=======================================");
      server.listen(_port, defArgs.hostname);
    }
}

main()
    .then(() => {
    })
    .catch(err => {
        logger.error("Top-level error (shutting down):", err);
        process.exit(1);
    });
