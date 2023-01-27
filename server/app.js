#!/usr/bin/env node

const
    nopt = require('nopt'),
    os = require('os'),
    path = require('path'),
    process = require('process'),
    systemdSocket = require('systemd-socket'),
    url = require('url'),
    _ = require('underscore'),
    express = require('express'),
    responseTime = require('response-time'),
    Sentry = require('@sentry/node'),
    {logger, logToPapertrail, suppressConsoleLog} = require('./lib/logger'),
    RouteAPI = require('./lib/handlers/route-api');

const opts = nopt({
  host: [String],
  port: [Number],
  superoptInstall: [String],
  tmpDir: [String]
});

const defArgs = {
  hostname: opts.host || 'localhost',
  port: opts.port || 80,
  superoptInstall: opts.superoptInstall || '/usr/local',
  tmpDir: opts.tmpDir || '/tmp',
};

async function main() {
    const CompilationEnvironment = require('./lib/compilation-env');
    const compilationEnvironment = new CompilationEnvironment(/*compilerProps, compilationQueue, defArgs.doCache*/);
    const EqcheckHandler = require('./lib/handlers/eqcheck').Handler;
    const eqcheckHandler = new EqcheckHandler(compilationEnvironment/*, awsProps*/);

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
        .on('error', err => logger.error('Caught error in web handler; continuing:', err))
        .use('/', router)
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
    const ss = systemdSocket();
    let _port;
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
    } else {
        _port = defArgs.port;
    }
    logger.info(`  Listening on http://${defArgs.hostname}:${_port}/`);
    logger.info("=======================================");
    //server.listen(_port, defArgs.hostname);
    server.listen(_port, defArgs.hostname);
}

main()
    .then(() => {
    })
    .catch(err => {
        logger.error("Top-level error (shutting down):", err);
        process.exit(1);
    });
