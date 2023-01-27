const temp = require('temp'),
    fs = require('fs-extra'),
    path = require('path'),
    httpProxy = require('http-proxy'),
    quote = require('shell-quote'),
    _ = require('underscore'),
    exec = require('../exec'),
    logger = require('../logger').logger,
    utils = require('../utils'),
    which = require('which'),
    Sentry = require('@sentry/node');

temp.track();

let hasSetUpAutoClean = false;
const defaultUnrollFactor = 64;

function initialise(/*compilerEnv*/) {
    if (hasSetUpAutoClean) return;
    hasSetUpAutoClean = true;
    //const tempDirCleanupSecs = compilerEnv.ceProps("tempDirCleanupSecs", 600);
    const tempDirCleanupSecs = 600;
    logger.info(`Cleaning temp dirs every ${tempDirCleanupSecs} secs`);

    let cyclesBusy = 0;
    //setInterval(() => {
    //    const status = compilerEnv.compilationQueue.status();
    //    if (status.busy) {
    //        cyclesBusy++;
    //        logger.warn(
    //            `temp cleanup skipped, pending: ${status.pending}, waiting: ${status.size}, cycles: ${cyclesBusy}`);
    //        return;
    //    }

    //    cyclesBusy = 0;

    //    temp.cleanup((err, stats) => {
    //        if (err) logger.error('temp cleanup error', err);
    //        if (stats) logger.debug('temp cleanup stats', stats);
    //    });
    //}, tempDirCleanupSecs * 1000);
}

class EqcheckHandler {
    constructor(superoptInstall/*, awsProps*/) {
        this.compilersById = {};
        this.superoptInstall = superoptInstall;
        //this.compilerEnv = compilationEnvironment;
        this.factories = {};
        //this.textBanner = this.compilerEnv.ceProps('textBanner');
        this.proxy = httpProxy.createProxyServer({});
        //this.awsProps = awsProps;
        initialise(/*this.compilerEnv*/);

        // Mostly cribbed from
        // https://github.com/nodejitsu/node-http-proxy/blob/master/examples/middleware/bodyDecoder-middleware.js
        // We just keep the body as-is though: no encoding using queryString.stringify(), as we don't use a form
        // decoding middleware.
        this.proxy.on('proxyReq', function (proxyReq, req) {
            if (!req.body || !Object.keys(req.body).length) {
                return;
            }

            const contentType = proxyReq.getHeader('Content-Type');
            let bodyData;

            if (contentType === 'application/json') {
                bodyData = JSON.stringify(req.body);
            }

            if (contentType === 'application/x-www-form-urlencoded') {
                bodyData = req.body;
            }

            if (bodyData) {
                proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
                proxyReq.write(bodyData);
            }
        });
        //console.log("EqcheckHandler object constructed\n");
    }

    parseRequest(req/*, compiler*/) {
        let dirPathIn, offsetIn, source, optimized, unrollFactor, srcName, optName;
        if (req.is('json')) {
            // JSON-style request
            //console.log('JSON-style parseRequest:\n' + JSON.stringify(req));
            //const requestOptions = req.body.options;
            //console.log('JSON-style parseRequest:\n' + Object.keys(req));
            //console.log('method:\n' + req.method);
            //console.log('headers:\n' + JSON.stringify(req.headers));
            //console.log('query:\n' + JSON.stringify(req.query));
            //console.log('route:\n' + JSON.stringify(req.route));
            //console.log('params:\n' + JSON.stringify(req.params));
            //console.log('_parsedUrl:\n' + JSON.stringify(req._parsedUrl));
            //console.log('_readableState:\n' + JSON.stringify(req._readableState));
            //console.log('complete:\n' + JSON.stringify(req.complete));
            //console.log('rawTrailers:\n' + JSON.stringify(req.rawTrailers));
            ////console.log('res:\n' + JSON.stringify(req.res));
            //console.log('mode:\n' + req.mode);
            //console.log('cache:\n' + req.cache);
            //console.log('body:\n' + JSON.stringify(req.body));
            //console.log('source:\n' + JSON.stringify(req.source));
            //console.log('source1Uri:\n' + JSON.stringify(req.source1Uri));
            source = req.body.source;
            //console.log('source:\n' + source);
            optimized = req.body.optimized;
            unrollFactor = req.body.unrollFactor || defaultUnrollFactor;
            dirPathIn = req.body.dirPathIn;
            offsetIn = req.body.offsetIn;
            srcName = "src.".concat(req.body.source1Name);
            optName = "opt.".concat(req.body.source2Name);
            //if (req.body.bypassCache)
            //    bypassCache = true;
            //options = requestOptions.userArguments;
            //const execParams = requestOptions.executeParameters || {};
            //executionParameters.args = execParams.args;
            //executionParameters.stdin = execParams.stdin;
            //backendOptions = requestOptions.compilerOptions || {};
            //filters = requestOptions.filters || compiler.getDefaultFilters();
            //tools = requestOptions.tools;
            //libraries = requestOptions.libraries || [];
        } else {
            // API-style
            //console.log('API-style parseRequest');
            source = req.body;
            optimized = req.optimized;
            unrollFactor = req.unrollFactor || defaultUnrollFactor;
            dirPathIn = req.dirPathIn;
            offsetIn = req.offsetIn;
            srcName = "src.".concat(req.source1Name);
            optName = "opt.".concat(req.source2Name);
            //options = req.query.options;
            //// By default we get the default filters.
            //filters = compiler.getDefaultFilters();
            //// If specified exactly, we'll take that with ?filters=a,b,c
            //if (req.query.filters) {
            //    filters = _.object(_.map(req.query.filters.split(","), filter => [filter, true]));
            //}
            //// Add a filter. ?addFilters=binary
            //_.each((req.query.addFilters || "").split(","), filter => {
            //    if (filter) filters[filter] = true;
            //});
            //// Remove a filter. ?removeFilter=intel
            //_.each((req.query.removeFilters || "").split(","), filter => {
            //    if (filter) delete filters[filter];
            //});
            //// Ask for asm not to be returned
            //backendOptions.skipAsm = req.query.skipAsm === "true";
        }
        //options = this.splitArguments(options);
        //if (!Array.isArray(executionParameters.args)) {
        //    executionParameters.args = this.splitArguments(executionParameters.args);
        //}

        //tools = tools || [];
        //tools.forEach((tool) => {
        //    tool.args = this.splitArguments(tool.args);
        //});
        //return {source, options, backendOptions, filters, bypassCache, tools, executionParameters, libraries};
        return {dirPathIn, offsetIn, source, optimized, unrollFactor, srcName, optName};
    }

    //splitArguments(options) {
    //    return _.chain(quote.parse(options || '')
    //        .map(x => typeof (x) === "string" ? x : x.pattern))
    //        .compact()
    //        .value();
    //}

    //handlePopularArguments(req, res, next) {
    //    const compiler = this.compilerFor(req);
    //    if (!compiler) return next();
    //    res.send(compiler.possibleArguments.getPopularArguments(this.getUsedOptions(req)));
    //}

    //handleOptimizationArguments(req, res, next) {
    //    const compiler = this.compilerFor(req);
    //    if (!compiler) return next();
    //    res.send(compiler.possibleArguments.getOptimizationArguments(this.getUsedOptions(req)));
    //}

    //getUsedOptions(req) {
    //    if (req.body) {
    //        const data = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;

    //        if (data.presplit) {
    //            return data.usedOptions;
    //        } else {
    //            return this.splitArguments(data.usedOptions);
    //        }
    //    }
    //    return false;
    //}
    //get_eqchecker() {
    //  //const res = await fs.stat(eqchecker_exe_path);
    //  return BaseEqchecker;
    //}

    checkSource(source) {
        const re = /^\s*#\s*i(nclude|mport)(_next)?\s+["<](\/|.*\.\.)[">]/;
        const failed = [];
        utils.splitLines(source).forEach((line, index) => {
            if (line.match(re)) {
                failed.push(`<stdin>:${index + 1}:1: no absolute or relative includes please`);
            }
        });
        if (failed.length > 0) return failed.join("\n");
        return null;
    }

    get_outfilename(dirPath) {
      //console.log('dirPath ', dirPath);
      return path.join(dirPath, 'eqcheck.example.out');
    }

    get_errfilename(dirPath) {
      return path.join(dirPath, 'eqcheck.example.err');
    }

    run_eqcheck(source, optimized, unrollFactor, dirPath, srcName, optName) {
        //console.log('run_eqcheck called. source = ', source);
        //console.log('run_eqcheck called. optimized = ', optimized);
        //const optionsError = this.checkOptions(options);
        //if (optionsError) throw optionsError;
        const sourceError = this.checkSource(source);
        if (sourceError) throw sourceError;

        const outFilename = this.get_outfilename(dirPath);
        //const errFilename = this.get_errfilename(dirPath);

        return new Promise((resolve, reject) => {
            //console.log('dirPath = ', dirPath);
            const sourceFilename = path.join(dirPath, srcName);
            fs.writeFile(sourceFilename, source);
            resolve([dirPath,sourceFilename]);
        }).then( values => {
             const dirPath = values[0];
             const sourceFilename = values[1];
             //console.log('sourceFilename = ', sourceFilename);
             const optimizedFilename = path.join(dirPath, optName);
             fs.writeFile(optimizedFilename, optimized)
             return [dirPath,sourceFilename,optimizedFilename];
        }).then( values => {
            const dirPath = values[0];
            const sourceFilename = values[1];
            const optimizedFilename = values[2];
            const redirect = ['-xml-output', outFilename];
            const unroll = ['-unroll-factor', unrollFactor];
            //const no_use_relocatable_mls = ['-no-use-relocatable-memlabels'];
            const eq32_args = ([ sourceFilename, optimizedFilename ]).concat(redirect).concat(unroll);
            console.log('calling eq32 ' + eq32_args);
            return exec.execute(this.superoptInstall + "/bin/eq32", eq32_args);
        }).then( result => {
            return result;
        })
        //result.stdout = result.stdout.split('\n');
        //result.stderr = result.stderr.split('\n');
        //return { stdout: [ {line: 1, text: sourceFilename}], stderr: [{line: 2, text: assemblyFilename}] };
    }

    newTempDir() {
        return new Promise((resolve, reject) => {
            temp.mkdir({prefix: 'compiler-explorer-compiler', dir: process.env.tmpDir}, (err, dirPath) => {
                if (err)
                    reject(`Unable to open temp file: ${err}`);
                else
                    resolve(dirPath);
            });
        });
    }

    async getOutputChunk(dirPath, offset) {
      const max_chunksize = 8192;
      let outFilename;
      let chunkBuf = Buffer.alloc(max_chunksize);

      outFilename = this.get_outfilename(dirPath);
      let outfd = await fs.open(outFilename, 'r');
      let numread = fs.readSync(outfd, chunkBuf, 0, max_chunksize, offset);
      chunkBuf = chunkBuf.slice(0, numread);
      let chunk = chunkBuf.toString();
      //console.log('numread = ', numread, ", chunk ", chunk);
      await fs.close(outfd);
      let offsetNew = offset + numread;
      return [offsetNew, chunk];
    }

    async handle(req, res, next) {
        //console.log('eqchecker handler called');
        //const eqchecker = this.get_eqchecker();
        //const compiler = this.compilerFor(req);
        //if (!compiler) {
        //    return next();
        //}
        //console.log('parseRequest called');
        const {
            dirPathIn, offsetIn, source, optimized, unrollFactor, srcName, optName
        } = this.parseRequest(req/*, compiler*/);
        //const remote = compiler.getRemote();
        //if (remote) {
        //    req.url = remote.path;
        //    this.proxy.web(req, res, {target: remote.target, changeOrigin: true}, e => {
        //        logger.error("Proxy error: ", e);
        //        next(e);
        //    });
        //    return;
        //}
        if (dirPathIn != undefined) {
          console.log('ping received with dirPathIn ', dirPathIn, ', offset ', offsetIn);
          const ret = await this.getOutputChunk(dirPathIn, offsetIn);
          const offsetNew = ret[0];
          const chunkNew = ret[1];
          //console.log('chunkNew ', chunkNew);
          res.end(JSON.stringify({dirPath: dirPathIn, offset: offsetNew, chunk: chunkNew}));
          return;
        }

        if (source === undefined) {
            logger.warn("No body found in request: source code missing", req);
            return next(new Error("Bad request"));
        }

        if (optimized === undefined) {
            logger.warn("No body found in request: optimized code missing", req);
            return next(new Error("Bad request"));
        }

        //console.log('source = ', source);
        //console.log('assembly = ', assembly);

        function textify(array) {
            return _.pluck(array || [], 'text').join("\n");
        }

        //console.log('calling run_eqcheck in handler');
            //
        const dirPath =  await this.newTempDir();
        this.run_eqcheck(source, optimized, unrollFactor, dirPath, srcName, optName)
            .then(
                result => {
                    //console.log('found result', result);
                    //if (req.accepts(['text', 'json']) === 'json') {
                    //    //console.log('found json result');
                    //    res.send(result);
                    //} else {
                    //    console.log('found plain result');
                    //    res.set('Content-Type', 'text/plain');
                    //    try {
                    //        if (!_.isEmpty(this.textBanner)) res.write('# ' + this.textBanner + "\n");
                    //        res.write(textify(result.asm));
                    //        if (result.code !== 0) res.write("\n# Eqchecker exited with result code " + result.code);
                    //        if (!_.isEmpty(result.stdout)) res.write("\nStandard out:\n" + textify(result.stdout));
                    //        if (!_.isEmpty(result.stderr)) res.write("\nStandard error:\n" + textify(result.stderr));
                    //    } catch (ex) {
                    //        Sentry.captureException(ex);
                    //        res.write(`Error handling request: ${ex}`);
                    //    }
                    //    res.end('\n');
                    //}
                    res.end(JSON.stringify({retcode: 0}));
                },
                error => {
                    console.log('found error');
                    if (typeof (error) !== "string") {
                        if (error.stack) {
                            logger.error("Error during equivalence check: ", error);
                            Sentry.captureException(error);
                        } else if (error.code) {
                            logger.error("Error during equivalence check: ", error.code);
                            if (typeof (error.stderr) === "string") {
                                error.stdout = utils.parseOutput(error.stdout);
                                error.stderr = utils.parseOutput(error.stderr);
                            }
                            res.end(JSON.stringify(error));
                            return;
                        } else {
                            logger.error("Error during equivalence check: ", error);
                        }

                        error = `Internal Compiler Explorer error: ${error.stack || error}`;
                    } else {
                        logger.error("Error during equivalence check: ", {error});
                    }
                    //res.end(JSON.stringify({code: -1, stderr: [{text: error}]}));
                    res.end(JSON.stringify({retcode: -1, stderr: [{text: error}]}));
                });
        res.end(JSON.stringify({dirPath: dirPath, offset: 0, chunk: ''}));
    }
}

module.exports.Handler = EqcheckHandler;
module.exports.SetTestMode = function () {
    hasSetUpAutoClean = true;
};
