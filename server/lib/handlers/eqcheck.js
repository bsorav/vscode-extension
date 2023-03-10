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
    Sentry = require('@sentry/node'),
    xml2js = require('xml2js'),
    assert = require('assert'),
    tree_kill = require('tree-kill')//,
    //textEncoding = require('text-encoding')
;

//temp.track();

let hasSetUpAutoClean = false;
const defaultUnrollFactor = 64;

const commandPingEqcheck = 'pingEqcheck';
const commandCancelEqcheck = 'cancelEqcheck';
const commandSubmitEqcheck = 'submitEqcheck';
const commandPrepareEqcheck = 'prepareEqcheck';
const commandPointsToAnalysis = 'pointsToAnalysis';
const commandObtainProof = 'obtainProof';
const commandObtainSrcFiles = 'obtainSrcFiles';
const commandObtainDstFiles = 'obtainDstFiles';
const commandObtainFunctionListsAfterPreparePhase = 'obtainFunctionListsAfterPreparePhase';

const runStateStatusPreparing = 'preparing';
const runStateStatusQueued = 'queued';
const runStateStatusRunning = 'running';
const runStateStatusFoundProof = 'found_proof';
const runStateStatusExhaustedSearchSpace = 'exhausted_search_space';
const runStateStatusSafetyCheckFailed = 'safety_check_failed';
const runStateStatusTimedOut = 'timed_out';
const runStateStatusTerminated = 'terminated';

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
        let commandIn, dirPathIn, offsetIn, source, src_etfg, optimized, object, harvest, unrollFactor, srcName, optName, functionName;
        if (req.is('json')) {
            // JSON-style request
            //console.log('JSON-style parseRequest:\n' + JSON.stringify(req)); //this fails due to a circularity in REQ
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
            source = req.body.source1Text;
            src_etfg = req.body.src_etfg;
            //console.log('source:\n' + source);
            optimized = req.body.source2Text;
            object = req.body.object;
            harvest = req.body.harvest;
            unrollFactor = req.body.unrollFactor || defaultUnrollFactor;
            commandIn = req.body.serverCommand;
            dirPathIn = req.body.dirPathIn;
            offsetIn = req.body.offsetIn;
            srcName = "src.".concat(req.body.source1Name);
            optName = "opt.".concat(req.body.source2Name);
            functionName = req.body.functionName;
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
            source = req.source1Text;
            src_etfg = req.src_etfg;
            optimized = req.source2Text;
            object = req.object;
            harvest = req.harvest;
            unrollFactor = req.unrollFactor || defaultUnrollFactor;
            commandIn = req.serverCommand;
            dirPathIn = req.dirPathIn;
            offsetIn = req.offsetIn;
            srcName = "src.".concat(req.source1Name);
            optName = "opt.".concat(req.source2Name);
            functionName = req.functionName;
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
        //console.log("commandIn = " + commandIn);
        return {commandIn, dirPathIn, offsetIn, source, src_etfg, optimized, object, harvest, unrollFactor, srcName, optName, functionName};
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

    get_proof_filename(dirPath) {
      //console.log('dirPath ', dirPath);
      return path.join(dirPath, 'eq.proof');
    }


    get_srcfilename(dirPath) {
      //console.log('dirPath ', dirPath);
      return path.join(dirPath, 'eqcheck.example.out');
    }


    get_outfilename(dirPath) {
      //console.log('dirPath ', dirPath);
      return path.join(dirPath, 'eqcheck.example.out');
    }

    get_runstatus_filename(dirPath) {
      //console.log('dirPath ', dirPath);
      return path.join(dirPath, 'eqcheck.runstatus');
    }


    get_errfilename(dirPath) {
      return path.join(dirPath, 'eqcheck.example.err');
    }

    readFileObjectToUint8Array(jsonObject)
    {
      if (jsonObject === undefined) {
        return undefined;
      }
      var arr = [];
      for (var i in jsonObject) {
        arr.push(jsonObject[i]);
      }
      return new Uint8Array(arr);
    }

    bufferToUint8Array(jsonObject)
    {
      if (jsonObject === undefined || jsonObject.data === undefined) {
        return undefined;
      }
      var arr = [];
      for (let i = 0; i < jsonObject.data.length; i++) {
        arr.push(jsonObject.data[i]);
      }
      return new Uint8Array(arr);
    }

    run_eqcheck(sourceJSON, src_etfgJSON, optimizedJSON, objectJSON, harvestJSON, unrollFactor, dirPath, srcName, optName, functionName, dryRun, llvm2tfg_only) {
        //console.log(`run_eqcheck called. sourceJSON (type ${typeof sourceJSON}) = ${sourceJSON}`);

        const source = this.readFileObjectToUint8Array(sourceJSON);
        const optimized = this.readFileObjectToUint8Array(optimizedJSON);
        const src_etfg = this.bufferToUint8Array(src_etfgJSON);
        const harvest = this.bufferToUint8Array(harvestJSON);
        const object = this.bufferToUint8Array(objectJSON);

        //console.log(`harvestJSON = ${JSON.stringify(harvestJSON)}\n`);
        //console.log(`harvest = ${harvest}\n`);

        //console.log(`run_eqcheck called. source (type ${typeof source}) = ${source}`);
        //console.log(`run_eqcheck called. optimized (type ${typeof source}) = ${source}`);

        //console.log('run_eqcheck called. optimized = ', optimized);
        //const optionsError = this.checkOptions(options);
        //if (optionsError) throw optionsError;
        const decoder = new TextDecoder();
        const sourceTxt = decoder.decode(source);
        //console.log(`sourceTxt = ${sourceTxt}\n`);
        const sourceError = this.checkSource(sourceTxt);
        if (sourceError) throw sourceError;

        //const sourceFilename = this.get_src_filename(dirPath);
        var sourceFilename = path.join(dirPath, srcName);
        const etfgFilename = sourceFilename + ".etfg";
        //const optimizedFilename = this.get_dst_filename(dirPath);
        var optimizedFilename = path.join(dirPath, optName);
        const objFilename = optimizedFilename + ".o";
        const harvestFilename = optimizedFilename + ".o.harvest";
        const outFilename = this.get_outfilename(dirPath);
        const runstatusFilename = this.get_runstatus_filename(dirPath);
        const proofFilename = this.get_proof_filename(dirPath);
        //const errFilename = this.get_errfilename(dirPath);

        return new Promise((resolve, reject) => {
            //console.log('dirPath = ', dirPath);
            //const sourceFilename = path.join(dirPath, srcName);
            if (!fs.existsSync(sourceFilename)) {
              fs.writeFileSync(sourceFilename, sourceTxt);
            }
            //console.log('sourceFilename = ', sourceFilename);
            if (!fs.existsSync(optimizedFilename)) {
              fs.writeFileSync(optimizedFilename, optimized)
            }
            if (src_etfg !== undefined) {
              console.log(`writing the src_etfg file`);
              fs.writeFileSync(etfgFilename, src_etfg);
              sourceFilename = etfgFilename;
            }
            if (harvest !== undefined) {
              //console.log(`harvest = ${JSON.stringify(harvest)}\n`);
              fs.writeFileSync(harvestFilename, harvest);
              optimizedFilename = harvestFilename;
            }
            var dstObjArg = [];
            if (object !== undefined) {
              fs.writeFileSync(objFilename, object);
              dstObjArg = ['--dst-object', objFilename];
            }
            const redirect = ['-xml-output', outFilename, '-running_status', runstatusFilename];
            const unroll = ['-unroll-factor', unrollFactor];
            const proof = ['-proof', proofFilename, '-tmpdir-path', dirPath];
            const src_dst_names = ['-src-filename', sourceFilename, '-dst-filename', optimizedFilename];
            var dryRunArg = [];
            if (dryRun) {
              dryRunArg = ['--dry-run'];
            } else {
              console.log(`functionName = ${functionName}`);
              if (functionName !== undefined && functionName !== null) {
                dryRunArg = ['-f', functionName];
              }
            }
            if (llvm2tfg_only) {
              dryRunArg.push('--llvm2tfg-only');
            }
            //const no_use_relocatable_mls = ['-no-use-relocatable-memlabels'];
            const eq32_args = ([ sourceFilename, optimizedFilename ]).concat(redirect).concat(proof).concat(dstObjArg).concat(unroll).concat(dryRunArg).concat(src_dst_names);
            console.log('calling eq32 ' + eq32_args);
            resolve(exec.execute(this.superoptInstall + "/bin/eq32", eq32_args));
        });
        //result.stdout = result.stdout.split('\n');
        //result.stderr = result.stderr.split('\n');
        //return { stdout: [ {line: 1, text: sourceFilename}], stderr: [{line: 2, text: assemblyFilename}] };
    }

    newTempDir() {
        return new Promise((resolve, reject) => {
            temp.mkdir({prefix: 'eqchecker', dir: process.env.tmpDir}, (err, dirPath) => {
                if (err)
                    reject(`Unable to open temp file: ${err}`);
                else
                    resolve(dirPath);
            });
        });
    }

    async readBuffer(filename, start = 0, bufferSize = undefined, max_chunksize = 8192) {
      let fd;
      try {
        fd = await fs.open(filename, 'r');
      } catch (err) {
        console.log(`file not found ${filename}`);
        console.error(err);
        return "";
      }
      let stats = fs.fstatSync(fd);
      if (stats.size === undefined) {
        await fs.close(fd);
        return "";
      }
      if (bufferSize === undefined) {
        bufferSize = stats.size - start;
      }
      if (bufferSize <= 0) {
        return "";
      }
      var buffer = Buffer.alloc(bufferSize);
      var bytesRead = 0;

      while (bytesRead < bufferSize) {
        var size = Math.min(max_chunksize, bufferSize - bytesRead);
        var read = fs.readSync(fd, buffer, bytesRead, size, start + bytesRead);
        bytesRead += read;
      }
      await fs.close(fd);
      return buffer;
    }

    async getProofXML(dirPath) {
      let proofFilename = this.get_proof_filename(dirPath) + ".xml";
      var buffer = await this.readBuffer(proofFilename);
      return buffer.toString();
    }

    async getSrcFiles(dirPath) {
      const runStatus = await this.getRunningStatus(dirPath);
      const srcFilenameJSON = runStatus.running_status.src_filename;
      //console.log(`srcFilenameJSON = ${srcFilenameJSON}\n`);
      const srcFilename = srcFilenameJSON.join();
      //console.log(`srcFilename = ${srcFilename}\n`);
      //const irFilename = srcFilename + ".ll";
      const etfgFilename = srcFilename + ".etfg";

      const src = await this.readBuffer(srcFilename);
      //const ir = await this.readBuffer(irFilename);
      const etfg = await this.readBuffer(etfgFilename);
      return { src: src/*, ir: ir*/, etfg: etfg };
    }

    async getDstFiles(dirPath) {
      const runStatus = await this.getRunningStatus(dirPathIn);
      const dstFilename = runStatus.running_status.dst_filename.join();
      const dst = await this.readBuffer(dstFilename);

      let harvestFilename = dstFilename + ".o.harvest";
      if (fs.existsSync(harvestFilename)) {
        var objFilename = this.get_obj_filename(dirPath);
        var tfgFilename = this.get_tfg_filename(dirPath);

        const harvest = await this.readBuffer(harvest);
        const obj = await this.readBuffer(objFilename);
        const tfg = await this.readBuffer(tfgFilename);
        return { dst: dst, obj: obj, harvest: harvest, tfg: tfg };
      } else {
        //let irFilename = this.get_ir_filename(dirPath, "opt");
        let etfgFilename = dstFilename + ".etfg";

        //const ir = await this.readBuffer(irFilename);
        const etfg = await this.readBuffer(etfgFilename);
        return { dst: dst/*, ir: ir*/, etfg: etfg };
      }
    }

    async getOutputChunk(dirPath, offset) {
      //let outFilename;
      //let chunkBuf = Buffer.alloc(max_chunksize);

      const outFilename = this.get_outfilename(dirPath);

      if (!fs.existsSync(outFilename)) {
        //console.log(`file does not exist: ${outFilename}\n`);
        return [offset, ""];
      }
      //let outfd;
      //try {
      //  outfd = await fs.open(outFilename, 'r');
      //} catch (err) {
      //  console.log(`file not found ${outFilename}`);
      //  console.error(err);
      //}

      //let stats = fs.fstatSync(outfd);
      //console.log("stats.size = " + stats.size);
      //console.log("offset = " + offset);
      //if (stats.size === undefined) {
      //  return [offset, ""];
      //}
      //var bufferSize = stats.size - offset;
      //if (bufferSize === 0) {
      //  return [offset, ""];
      //}
      //const max_chunksize = 8192; //8192-byte intervals
      var buffer = await this.readBuffer(outFilename, offset);

      //let numread = fs.readSync(outfd, chunkBuf, 0, max_chunksize, offset);
      //let chunkBuf = buffer.slice(0, bufferSize);
      let chunk = buffer.toString();
      console.log(`chunk: ${JSON.stringify(chunk)}\n`);
      const end_of_message_marker = "</MSG>";

      let lastMessage = chunk.lastIndexOf(end_of_message_marker);
      if (lastMessage === -1) {
        return [offset, ""];
      }
      let chunkEnd = lastMessage + end_of_message_marker.length;
      let truncatedChunk = chunk.substring(0, chunkEnd);

      //console.log('numread = ', numread, ", chunk ", chunk);
      //await fs.close(outfd);
      //let offsetNew = offset + numread;
      //return [offsetNew, chunk];
      let offsetNew = offset + chunkEnd;
      return [offsetNew, truncatedChunk];
    }

    async getRunningStatus(dirPath) {
      const runStatusFilename = this.get_runstatus_filename(dirPath);
      if (!fs.existsSync(runStatusFilename)) {
        return "";
      }
      const buffer = fs.readFileSync(runStatusFilename);
      const runStatusXML = buffer.toString();
      var runStatus;
      xml2js.parseString(runStatusXML, {explictArray: false}, function (err, result) {
        runStatus = result;
      });
      return runStatus;
    }

    pidIsRunning(pid) {
      try {
        process.kill(pid, 0);
        return true;
      } catch(e) {
        return false;
      }
    }

    eqcheck_error(error, res) {
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
    }

    dryRunInfoGetFunctions(fmap) {
      //console.log(`fmap = ${JSON.stringify(fmap)}\n`);
      var ret = [];
      var vals = [];
      const ls = fmap.function_dry_run_info_entry_pair;
      //console.log(`ls = ${JSON.stringify(ls)}`);
      if (ls === undefined) {
        return [];
      }
      for (let i = 0; i < ls.length; i++) {
        const e = ls[i];
        //console.log(`entry = ${JSON.stringify(e)}`);
        const src_loc = e.dry_run_info_entry[0].src_lines_of_code;
        const dst_loc = e.dry_run_info_entry[0].dst_lines_of_code;
        const metric = dst_loc;
        vals.push({ function_name: e.function_name, metric: metric});
      }
      //console.log(`before sort, vals = ${JSON.stringify(vals)}`);
      vals.sort(function (a, b) { return a.metric - b.metric });
      //console.log(`after sort, vals = ${JSON.stringify(vals)}`);
      for (let i = 0; i < vals.length; i++) {
        ret.push(vals[i].function_name);
      }
      //console.log(`ret = ${ret}`);
      return ret;
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
          commandIn, dirPathIn, offsetIn, source, src_etfg, optimized, object, harvest, unrollFactor, srcName, optName, functionName
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
      //console.log("commandIn = " + commandIn);
      if (commandIn === commandSubmitEqcheck || commandIn === commandPrepareEqcheck || commandIn === commandPointsToAnalysis) {
        if (commandIn === commandSubmitEqcheck) {
          console.log(`Submit received on ${dirPathIn}\n`);
          console.log(`src_etfg = ${JSON.stringify(src_etfg)}\n`);
        } else if (commandIn === commandPrepareEqcheck) {
          console.log(`Prepare received on ${dirPathIn}\n`);
        } else if (commandIn === commandPointsToAnalysis) {
          console.log(`PointsTo received on ${dirPathIn}\n`);
        }

        if (source === undefined) {
            logger.warn("No body found in request: source code missing", req);
            return next(new Error("Bad request"));
        }

        if (optimized === undefined) {
            logger.warn("No body found in request: optimized code missing", req);
            return next(new Error("Bad request"));
        }

        const dirPath =  (dirPathIn === undefined) ? await this.newTempDir() : dirPathIn;
        const dryRun = (commandIn === commandPrepareEqcheck);
        const llvm2tfg_only = (commandIn === commandPointsToAnalysis);

        this.run_eqcheck(source, src_etfg, optimized, object, harvest, unrollFactor, dirPath, srcName, optName, functionName, dryRun, llvm2tfg_only)
            .then(
                result => {
                    res.end(JSON.stringify({retcode: 0}));
                },
                error => {
                    this.eqcheck_error(error, res);
                });
        const response = JSON.stringify({dirPath: dirPath, offset: 0, chunk: ''});
        console.log(`response = ${response}\n`);
        res.end(response);
      } else if (commandIn === commandPingEqcheck) {
        console.log('ping received with dirPathIn ', dirPathIn, ', offset ', offsetIn);
        const ret = await this.getOutputChunk(dirPathIn, offsetIn);
        var runStatus = await this.getRunningStatus(dirPathIn);
        const offsetNew = ret[0];
        let chunkXML_orig = ret[1];
        let chunkXML = ("<messages>").concat(chunkXML_orig).concat("</messages>");
        //console.log("chunkXML:\n" + chunkXML);

        //var xml = "<root>Hello xml2js!</root>"
        var chunkObj;
        xml2js.parseString(chunkXML, {explictArray: true}, function (err, result) {
            //console.dir(result);
            chunkObj = result;
        });

        if (runStatus !== undefined && runStatus !== null && runStatus.running_status !== undefined) {
          const pidRunning = this.pidIsRunning(runStatus.running_status.pid);
          if (runStatus.running_status.status_flag === runStateStatusRunning) {
            runStatus = await this.getRunningStatus(dirPathIn); //get running status again after checking pidRunning (to avoid a condition where the process exits after the running status is taken)
            if (runStatus.running_status.status_flag === runStateStatusRunning && !pidRunning) {
              console.log(`Setting status_flag to terminated`);
              runStatus.running_status.status_flag = runStateStatusTerminated;
            }
          }
        }

        //const chunkJson = xml2json.toJson(chunkXML, );
        //const chunkObj = JSON.parse(chunkJson);
        //const chunkObj = xml2json.toJson(chunkXML, { object: true, arrayNotation: true });
        //console.log("chunkJson:\n" + chunkJson);
        //console.log("chunkObj:\n" + chunkObj);
        //console.log("JSON.stringify(chunkObj):\n" + JSON.stringify(chunkObj));

        //console.log("chunkJson:\n" + JSON.stringify(chunkJson, null, "    ") );
        //console.log("chunkJson:\n" + JSON.stringify(chunkJson));
        //for (var key in chunkJson) {
        //  console.log('key ' + key);
        //  console.log('value ' + chunkJson[key]);
        //}

        //console.log('chunkNew ', chunkNew);
        const chunkStr = JSON.stringify({dirPath: dirPathIn, offset: offsetNew, chunk: chunkObj, runStatus: runStatus});
        //console.log('chunkStr =\n' + chunkStr);
        res.end(chunkStr);
        return;
      } else if (commandIn === commandObtainFunctionListsAfterPreparePhase) {
        console.log('obtainFunctionListsAfterPreparePhase received with dirPathIn ', dirPathIn, ', offset ', offsetIn);
        const runStatus = await this.getRunningStatus(dirPathIn);
        const objectFilename = runStatus.running_status.dst_filename + ".o";
        const harvestFilename = runStatus.running_status.dst_filename + ".o.harvest";
        //console.log(`runStatus = ${JSON.stringify(runStatus)}\n`);
        //console.log(`objectFilename = ${objectFilename}\n`);
        //console.log(`harvestFilename = ${harvestFilename}\n`);
        //console.log(`running_status = ${JSON.stringify(runStatus.running_status)}`);
        //console.log(`dry_run_info = ${JSON.stringify(runStatus.running_status.dry_run_info)}`);
        //console.log(`common_functions = ${JSON.stringify(runStatus.running_status.dry_run_info[0].common_functions)}`);
        const object = await this.readBuffer(objectFilename);
        const harvest = await this.readBuffer(harvestFilename);
        const common = this.dryRunInfoGetFunctions(runStatus.running_status.dry_run_info[0].common_functions[0]);
        const src_only = this.dryRunInfoGetFunctions(runStatus.running_status.dry_run_info[0].src_only_functions[0]);
        const dst_only = this.dryRunInfoGetFunctions(runStatus.running_status.dry_run_info[0].dst_only_functions[0]);
        //console.log(`harvest = ${harvest}\n`);
        //console.log(`common = ${common}, src_only = ${src_only}, dst_only = ${dst_only}`);
        const responseStr = JSON.stringify({ harvest: harvest, object: object, common: common, src_only: src_only, dst_only: dst_only });
        res.end(responseStr);
        return;
      } else if (commandIn === commandObtainProof) {
        console.log('ObtainProof received with dirPathIn ', dirPathIn);
        const proof_xml = await this.getProofXML(dirPathIn);
        //console.log('proof_xml =\n', proof_xml);

        var proofObj;
        xml2js.parseString(proof_xml, {explicitArray: false, preserveChildrenOrder: true}, function (err, result) {
            //console.dir(result);
            proofObj = result;
        });

        const proofStr = JSON.stringify({dirPath: dirPathIn, proof: proofObj});
        //console.log("proofStr:\n" + proofStr);
        res.end(proofStr);
        return;
      } else if (commandIn === commandObtainSrcFiles) {
        //console.log('commandObtainSrcFiles received with dirPathIn ', dirPathIn);
        const src_files_json = await this.getSrcFiles(dirPathIn);
        const src_files_str = JSON.stringify(src_files_json);
        //console.log(`responding with dirPathIn ${src_files_str}\n`);
        res.end(src_files_str);
        return;
      } else if (commandIn === commandObtainDstFiles) {
        const dst_files_json = await this.getDstFiles(dirPathIn);
        const dst_files_str = JSON.stringify(dst_files_json);
        res.end(dst_files_str);
        return;
      } else if (commandIn === commandCancelEqcheck) {
        console.log('CancelEqcheck received with dirPathIn ', dirPathIn);
        const runStatus = await this.getRunningStatus(dirPathIn);

        if (runStatus !== undefined && runStatus !== null) {
          console.log(`killing runStatus.pid = ${runStatus.running_status.pid}\n`);
          tree_kill(runStatus.running_status.pid, 'SIGKILL');
        }

        const chunkStr = JSON.stringify({dirPath: dirPathIn, serverStatus: "cancelled"});
        res.end(chunkStr);
        return;
      } else {
        assert(false, "Invalid Command " + commandIn);
      }
    }
}

module.exports.Handler = EqcheckHandler;
module.exports.SetTestMode = function () {
    hasSetUpAutoClean = true;
};
