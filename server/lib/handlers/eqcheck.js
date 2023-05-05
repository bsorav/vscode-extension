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
const defaultUnrollFactor = 8;

const commandCancelEqcheck = 'cancelEqcheck';
const commandSubmitEqcheck = 'submitEqcheck';
const commandPrepareEqcheck = 'prepareEqcheck';
const commandPointsToAnalysis = 'pointsToAnalysis';
const commandObtainProof = 'obtainProof';
const commandObtainSrcFiles = 'obtainSrcFiles';
const commandObtainDstFiles = 'obtainDstFiles';
const commandObtainFunctionListsAfterPreparePhase = 'obtainFunctionListsAfterPreparePhase';
const commandSaveSession = 'saveSession';
const commandLoadSession = 'loadSession';
const commandObtainSearchTree = 'obtainSearchTree';

const runStateStatusPreparing = 'preparing';
const runStateStatusQueued = 'queued';
const runStateStatusRunning = 'running';
const runStateStatusFoundProof = 'found_proof';
const runStateStatusExhaustedSearchSpace = 'exhausted_search_space';
const runStateStatusSafetyCheckFailed = 'safety_check_failed';
const runStateStatusTimedOut = 'timed_out';
const runStateStatusTerminated = 'terminated';

function def(a) {
  return (a === undefined) ? "undef" : "def";
}

function bufferToString(jsonObject)
{
  //console.log(`bufferToUint8Array 1: jsonObject = ${JSON.stringify(jsonObject)}\n`);
  //console.log(`bufferToUint8Array 1: jsonObject.data = ${JSON.stringify(jsonObject.data)}\n`);
  //console.log(`bufferToUint8Array 1: jsonObject[data] = ${JSON.stringify(jsonObject["data"])}\n`);
  if (jsonObject === undefined/* || jsonObject.data === undefined*/) {
    //console.log(`bufferToUint8Array 2: jsonObject = ${jsonObject}\n`);
    //console.log(`bufferToUint8Array 3: jsonObject.data = ${jsonObject.data}\n`);
    return undefined;
  }
  return jsonObject.toString();
}


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
        let commandIn, dirPathIn, offsetIn, source, src_ir, src_etfg, optimized, dst_ir, dst_etfg, object, compile_log, harvest, unrollFactor, srcName, optName, dstFilenameIsObject, functionName, sessionName, eqchecks, cg_name;
        if (req.is('json')) {
            // JSON-style request
            ////console.log('JSON-style parseRequest:\n' + JSON.stringify(req)); //this fails due to a circularity in REQ
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
            src_ir = req.body.src_ir;
            src_etfg = req.body.src_etfg;
            //console.log('source:\n' + source);
            optimized = req.body.source2Text;
            dst_ir = req.body.dst_ir;
            dst_etfg = req.body.dst_etfg;
            object = req.body.object;
            compile_log = req.body.compile_log;
            harvest = req.body.harvest;
            unrollFactor = req.body.unrollFactor || defaultUnrollFactor;
            commandIn = req.body.serverCommand;
            dirPathIn = req.body.dirPathIn;
            offsetIn = req.body.offsetIn;
            srcName = "src.".concat(req.body.source1Name);
            optName = (req.body.source2Name === undefined) ? undefined : "opt.".concat(req.body.source2Name);
            dstFilenameIsObject = req.body.dstFilenameIsObject;
            functionName = req.body.functionName;
            sessionName = req.body.sessionName;
            eqchecks = req.body.eqchecks;
            cg_name = req.body.cg_name;
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
            src_ir = req.src_ir;
            src_etfg = req.src_etfg;
            optimized = req.source2Text;
            dst_ir = req.dst_ir;
            dst_etfg = req.dst_etfg;
            object = req.object;
            compile_log = req.compile_log;
            harvest = req.harvest;
            unrollFactor = req.unrollFactor || defaultUnrollFactor;
            commandIn = req.serverCommand;
            dirPathIn = req.dirPathIn;
            offsetIn = req.offsetIn;
            srcName = "src.".concat(req.source1Name);
            //optName = "opt.".concat(req.source2Name);
            optName = (req.source2Name === undefined) ? undefined : "opt.".concat(req.source2Name);
            dstFilenameIsObject = req.dstFilenameIsObject;
            functionName = req.functionName;
            sessionName = req.sessionName;
            eqchecks = req.eqchecks;
            cg_name = req.cg_name;
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
        console.log("commandIn = " + commandIn);
        return {commandIn, dirPathIn, offsetIn, source, src_ir, src_etfg, optimized, dst_ir, dst_etfg, object, compile_log, harvest, unrollFactor, srcName, optName, dstFilenameIsObject, functionName, sessionName, eqchecks, cg_name};
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

    get_proof_filename(dirPath, cg_name) {
      //console.log('dirPath ', dirPath);
      if (cg_name === undefined) {
        return path.join(dirPath, 'eq.proof');
      } else {
        return path.join(dirPath, cg_name);
      }
    }


    get_srcfilename(dirPath) {
      //console.log('dirPath ', dirPath);
      return path.join(dirPath, 'eqcheck.example.out');
    }

    get_object_filename_for_dst_filename(dst_filename, dst_filename_is_object) {
      //const true_str = "true";
      //console.log(`dst_filename_is_object = ${dst_filename_is_object}`);
      //console.log(`(dst_filename_is_object===true) = ${dst_filename_is_object === true}`);
      //console.log(`(dst_filename_is_object===\"true\") = ${dst_filename_is_object === true_str}`);
      //console.log(`(dst_filename_is_object==true) = ${dst_filename_is_object == true}`);
      //console.log(`(dst_filename_is_object==\"true\") = ${dst_filename_is_object == true_str}`);
      if (dst_filename_is_object === true/* || dst_filename_is_object === "true" || dst_filename_is_object == "true"*/) {
        return dst_filename + "";
      } else {
        return dst_filename + ".o";
      }
    }

    get_compile_log_filename_for_dst_filename(dst_filename, dst_filename_is_object) {
      const obj_filename = this.get_object_filename_for_dst_filename(dst_filename, dst_filename_is_object);
      return obj_filename + ".compile_log";
    }


    get_harvest_filename_for_object_filename(obj_filename) {
      return obj_filename + ".harvest";
    }

    get_outfilename(dirPath) {
      //console.log('dirPath ', dirPath);
      return path.join(dirPath, 'eqcheck.example.out');
    }

    get_runstatus_filename(dirPath) {
      //console.log('dirPath ', dirPath);
      return path.join(dirPath, 'eqcheck.runstatus');
    }

    get_search_tree_filename(dirPath) {
      //console.log('dirPath ', dirPath);
      return path.join(dirPath, 'eqcheck.search_tree');
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

    buffer_from_json(json) {
      return (json === undefined) ? undefined : Buffer.from(json.data);
    }

    run_eqcheck(sourceJSON, src_irJSON, src_etfgJSON, optimizedJSON, dst_irJSON, dst_etfgJSON, objectJSON, compile_logJSON, harvestJSON, unrollFactor, dirPath, srcName, optName, dstFilenameIsObject, functionName, dryRun, llvm2tfg_only) {
        //console.log(`run_eqcheck called. sourceJSON (type ${typeof sourceJSON}) = ${sourceJSON}`);

        const source = this.readFileObjectToUint8Array(sourceJSON);
        const optimized = this.readFileObjectToUint8Array(optimizedJSON);
        const src_ir = this.buffer_from_json(src_irJSON);
        const src_etfg = this.buffer_from_json(src_etfgJSON);
        const dst_ir = this.buffer_from_json(dst_irJSON);
        const dst_etfg = this.buffer_from_json(dst_etfgJSON);
        const harvest = this.buffer_from_json(harvestJSON);
        const object = this.buffer_from_json(objectJSON);
        const compile_log = this.buffer_from_json(compile_logJSON);

        console.log(`source = ${def(source)}, optimized = ${def(optimized)}, src_ir = ${def(src_ir)}, src_etfg = ${def(src_etfg)}, dst_ir = ${def(dst_ir)}, dst_etfg = ${def(dst_etfg)}, harvest = ${def(harvest)}, object = ${def(object)}, compile_log = ${def(compile_log)}\n`);

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
        const src_irFilename = sourceFilename + ".ll";
        const src_etfgFilename = sourceFilename + ".etfg";
        var optimizedFilename = (optName === undefined) ? undefined : path.join(dirPath, optName);
        const dst_irFilename = (optimizedFilename === undefined) ? undefined : optimizedFilename + ".ll";
        const dst_etfgFilename = (optimizedFilename === undefined) ? undefined : optimizedFilename + ".etfg";
        const objFilename = (optimizedFilename === undefined) ? undefined : this.get_object_filename_for_dst_filename(optimizedFilename, dstFilenameIsObject);
        const compile_logFilename = (optimizedFilename === undefined) ? undefined : this.get_compile_log_filename_for_dst_filename(optimizedFilename, dstFilenameIsObject);
        const harvestFilename = this.get_harvest_filename_for_object_filename(objFilename);
        const outFilename = this.get_outfilename(dirPath);
        const runstatusFilename = this.get_runstatus_filename(dirPath);
        const searchTreeFilename = this.get_search_tree_filename(dirPath);
        const proofFilename = this.get_proof_filename(dirPath, undefined);
        //const errFilename = this.get_errfilename(dirPath);

        return new Promise((resolve, reject) => {
            //console.log('dirPath = ', dirPath);
            //const sourceFilename = path.join(dirPath, srcName);
            if (!fs.existsSync(sourceFilename)) {
              //console.log(`sourceTxt = ${JSON.stringify(sourceTxt)}`);
              fs.writeFileSync(sourceFilename, sourceTxt);
            }
            //console.log('optimizedFilename = ', optimizedFilename);
            //console.log(`optimized = ${def(optimized)}`);
            if (optimizedFilename !== undefined && !fs.existsSync(optimizedFilename)) {
              fs.writeFileSync(optimizedFilename, optimized)
            }
            const src_names = ['-src-filename', sourceFilename];
            var dst_names = (optimizedFilename === undefined) ? [] : ['-dst-filename', optimizedFilename];
            if (dstFilenameIsObject) {
              dst_names.push('-dst-filename-is-object');
            }
            if (src_ir !== undefined) {
              console.log(`writing the src_ir file to ${src_irFilename}`);
              fs.writeFileSync(src_irFilename, src_ir);
            }
            if (src_etfg !== undefined) {
              console.log(`writing the src_etfg file to ${src_etfgFilename}`);
              fs.writeFileSync(src_etfgFilename, src_etfg);
              sourceFilename = src_etfgFilename;
            }
            if (dst_ir !== undefined) {
              console.log(`writing the dst_ir file to ${dst_irFilename}`);
              fs.writeFileSync(dst_irFilename, dst_ir);
            }
            if (dst_etfg !== undefined) {
              fs.writeFileSync(dst_etfgFilename, dst_etfg);
              console.log(`writing the dst_etfg file to ${dst_etfgFilename}`);
              optimizedFilename = dst_etfgFilename;
            } else if (harvest !== undefined) {
              //console.log(`harvest = ${JSON.stringify(harvest)}\n`);
              fs.writeFileSync(harvestFilename, harvest);
              console.log(`writing harvest output to ${harvestFilename}`);
              optimizedFilename = harvestFilename;
            }
            var dstObjArg = [];
            if (object !== undefined) {
              console.log(`writing object to ${objFilename}`);
              fs.writeFileSync(objFilename, object);
              dstObjArg = ['--dst-object', objFilename];
            }
            var dstCompileLogArg = [];
            if (compile_log !== undefined) {
              console.log(`writing object to ${compile_logFilename}`);
              //console.log(`compile_log = ${JSON.stringify(compile_log)}`);
              fs.writeFileSync(compile_logFilename, compile_log);
              dstCompileLogArg = ['--compile-log', compile_logFilename];
            }

            const redirect = ['-xml-output', outFilename, '-running_status', runstatusFilename, '-search_tree', searchTreeFilename];
            const unroll = ['-unroll-factor', unrollFactor];
            const proof = ['-proof', proofFilename, '-tmpdir-path', dirPath];
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
            var eq32_args = ([ sourceFilename ]).concat(redirect).concat(proof).concat(dstObjArg).concat(dstCompileLogArg).concat(unroll).concat(dryRunArg).concat(src_names).concat(dst_names);
            if (optimizedFilename !== undefined) {
              eq32_args = eq32_args.concat(['--dst', optimizedFilename]);
            }
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

    eqchecksDir() {
      return new Promise((resolve, reject) => {
        const ret = path.join(this.superoptInstall, 'server-eqfiles');
        if (!fs.existsSync(ret)) {
          fs.mkdir(ret, (err) => {
              if (err) {
                console.error(err);
                reject(`Could not create dir ${ret}`);
              }
              console.log('Directory created successfully!');
          });
        }
        resolve(ret);
      });
    }

    async savedSessionsDir() {
      return new Promise((resolve, reject) => {
        this.eqchecksDir().then( (eqDir) => {
          const savedSessDir = path.join(eqDir, 'savedSessions');
          if (!fs.existsSync(savedSessDir)) {
            fs.mkdir(savedSessDir, (err) => {
                if (err) {
                  console.error(err);
                  reject(`Could not create dir ${savedSessDir}`);
                }
                console.log('Directory created successfully!');
            });
          }
          resolve(savedSessDir);
        });
      });
    }

    async readBuffer(filename, start = 0, bufferSize = undefined, max_chunksize = 8192) {
      //console.log(`readBuffer: filename = ${filename}`);
      let fd;
      try {
        fd = await fs.open(filename, 'r');
      } catch (err) {
        console.log(`file not found ${filename}`);
        console.error(err);
        return undefined;
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
      //console.log(`readBuffer returning ${JSON.stringify(buffer)}`);
      return buffer;
    }

    async getProofXML(dirPath, cg_name) {
      let proofFilename = this.get_proof_filename(dirPath, cg_name) + ".xml";
      var buffer = await this.readBuffer(proofFilename);
      if (buffer === undefined) return undefined;
      return buffer;
    }

    async getSrcFiles(dirPath) {
      const runStatus = await this.getRunningStatus(dirPath);
      const srcFilenameJSON = runStatus.running_status.src_filename;
      //console.log(`srcFilenameJSON = ${srcFilenameJSON}\n`);
      const srcFilename = srcFilenameJSON.join();
      //console.log(`srcFilename = ${srcFilename}\n`);
      const irFilename = srcFilename + ".ll";
      const etfgFilename = srcFilename + ".etfg";

      const src = await this.readBuffer(srcFilename);
      //console.log(`getSrcFiles: srcFilename = ${srcFilename}, src = ${src}\n`);
      const ir = await this.readBuffer(irFilename);
      const etfg = await this.readBuffer(etfgFilename);
      return { src: src, ir: ir, etfg: etfg };
    }

    async getDstFiles(dirPath) {
      const runStatus = await this.getRunningStatus(dirPath);
      const dstFilename = runStatus.running_status.dst_filename.join();
      const dst = await this.readBuffer(dstFilename);
      const dstFilenameIsObject = (runStatus.running_status.dst_filename_is_object == "true");
      const objFilename = this.get_object_filename_for_dst_filename(dstFilename, dstFilenameIsObject);

      let harvestFilename = this.get_harvest_filename_for_object_filename(objFilename);
      if (fs.existsSync(harvestFilename)) {
        var tfgFilename = objFilename + ".tfg";

        const harvest = await this.readBuffer(harvestFilename);
        const obj = await this.readBuffer(objFilename);
        const tfg = await this.readBuffer(tfgFilename);
        return { dst: dst, obj: obj, harvest: harvest, tfg: tfg };
      } else {
        let irFilename = dstFilename + ".ll";
        let etfgFilename = dstFilename + ".etfg";

        console.log(`getDstFiles: etfgFilename = ${etfgFilename}`);
        var ir, etfg;
        if (fs.existsSync(etfgFilename)) {
          console.log(`getDstFiles: etfgFilename = ${etfgFilename} exists. reading etfg`);
          ir = await this.readBuffer(irFilename);
          etfg = await this.readBuffer(etfgFilename);
        }
        return { dst: dst, ir: ir, etfg: etfg };
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
      var buffer = (await this.readBuffer(outFilename, offset)).toString();
      if (buffer === undefined) {
        return [offset, ""];
      }
      //let numread = fs.readSync(outfd, chunkBuf, 0, max_chunksize, offset);
      //let chunkBuf = buffer.slice(0, bufferSize);
      let chunk = buffer;
      //console.log(`chunk: ${JSON.stringify(chunk)}\n`);
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

    async getSearchTree(dirPath) {
      const searchTreeFilename = this.get_search_tree_filename(dirPath);
      if (!fs.existsSync(searchTreeFilename)) {
        return "";
      }
      const buffer = fs.readFileSync(searchTreeFilename);
      const searchTreeXML = buffer.toString();
      var searchTree;
      xml2js.parseString(searchTreeXML, {explictArray: false}, function (err, result) {
        searchTree = result;
      });
      return searchTree;
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
          commandIn, dirPathIn, offsetIn, source, src_ir, src_etfg, optimized, dst_ir, dst_etfg, object, compile_log, harvest, unrollFactor, srcName, optName, dstFilenameIsObject, functionName, sessionName, eqchecks, cg_name
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
        if (dirPathIn === undefined) {
          if (commandIn === commandSubmitEqcheck) {
            console.log(`Submit received on ${dirPathIn}: source = ${def(source)}, src_ir = ${def(src_ir)}, src_etfg = ${def(src_etfg)}, optimized = ${def(optimized)}, dst_ir = ${def(dst_ir)}, dst_etfg = ${def(dst_etfg)}, object = ${def(object)}, harvest = ${def(harvest)}, compile_log = ${def(compile_log)}\n`);
            //console.log(`src_etfg = ${JSON.stringify(src_etfg)}\n`);
          } else if (commandIn === commandPrepareEqcheck) {
            console.log(`Prepare received on ${dirPathIn}: source = ${def(source)}, src_ir = ${def(src_ir)}, src_etfg = ${def(src_etfg)}, optimized = ${def(optimized)}, dst_ir = ${def(dst_ir)}, dst_etfg = ${def(dst_etfg)}, object = ${def(object)}, harvest = ${def(harvest)}, compile_log = ${def(compile_log)}\n`);
          } else if (commandIn === commandPointsToAnalysis) {
            console.log(`PointsTo received on ${dirPathIn}: source = ${def(source)}, src_ir = ${def(src_ir)}, src_etfg = ${def(src_etfg)}, optimized = ${def(optimized)}, dst_ir = ${def(dst_ir)}, dst_etfg = ${def(dst_etfg)}, object = ${def(object)}, harvest = ${def(harvest)}, compile_log = ${def(compile_log)}\n`);
          }

          if (source === undefined) {
              logger.warn("No body found in request: source code missing", req);
              return next(new Error("Bad request"));
          }

          //if (optimized === undefined) {
          //    logger.warn("No body found in request: optimized code missing", req);
          //    return next(new Error("Bad request"));
          //}

          const dirPath =  (dirPathIn === undefined) ? await this.newTempDir() : dirPathIn;
          const dryRun = (commandIn === commandPrepareEqcheck);
          const llvm2tfg_only = (commandIn === commandPointsToAnalysis);

          this.run_eqcheck(source, src_ir, src_etfg, optimized, dst_ir, dst_etfg, object, compile_log, harvest, unrollFactor, dirPath, srcName, optName, dstFilenameIsObject, functionName, dryRun, llvm2tfg_only)
              .then(
                  result => {
                      res.end(JSON.stringify({retcode: 0}));
                  },
                  error => {
                      this.eqcheck_error(error, res);
                  });
          const response = JSON.stringify({dirPath: dirPath, offset: 0, chunk: ''});
          //console.log(`response = ${response}\n`);
          res.end(response);
        } else {
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
        }
      } else if (commandIn === commandObtainFunctionListsAfterPreparePhase) {
        console.log('obtainFunctionListsAfterPreparePhase received with dirPathIn ', dirPathIn, ', offset ', offsetIn);
        const runStatus = await this.getRunningStatus(dirPathIn);
        const dstFilename = runStatus.running_status.dst_filename;
        if (dstFilename === "") {
          res.end(JSON.stringify({ dst_filename: dstFilename }));
          return;
        }
        const dstFilenameIsObject = (runStatus.running_status.dst_filename_is_object == "true");
        const objectFilename = this.get_object_filename_for_dst_filename(dstFilename, dstFilenameIsObject);
        const compile_logFilename = this.get_compile_log_filename_for_dst_filename(dstFilename, dstFilenameIsObject);
        const harvestFilename = this.get_harvest_filename_for_object_filename(objectFilename);
        //console.log(`runStatus = ${JSON.stringify(runStatus)}\n`);
        console.log(`dstFilename = ${dstFilename}\n`);
        console.log(`dstFilenameIsObject = ${dstFilenameIsObject}\n`);
        console.log(`objectFilename = ${objectFilename}\n`);
        //console.log(`harvestFilename = ${harvestFilename}\n`);
        //console.log(`running_status = ${JSON.stringify(runStatus.running_status)}`);
        //console.log(`dry_run_info = ${JSON.stringify(runStatus.running_status.dry_run_info)}`);
        //console.log(`common_functions = ${JSON.stringify(runStatus.running_status.dry_run_info[0].common_functions)}`);
        const object = await this.readBuffer(objectFilename);
        const compile_log = await this.readBuffer(compile_logFilename);
        const harvest = await this.readBuffer(harvestFilename);
        const common = this.dryRunInfoGetFunctions(runStatus.running_status.dry_run_info[0].common_functions[0]);
        const src_only = this.dryRunInfoGetFunctions(runStatus.running_status.dry_run_info[0].src_only_functions[0]);
        const dst_only = this.dryRunInfoGetFunctions(runStatus.running_status.dry_run_info[0].dst_only_functions[0]);
        //console.log(`harvest = ${harvest}\n`);
        //console.log(`common = ${common}, src_only = ${src_only}, dst_only = ${dst_only}`);
        const responseStr = JSON.stringify({ dst_filename: dstFilename, dst_filename_is_object: dstFilenameIsObject, harvest: harvest, object: object, compile_log: compile_log, common: common, src_only: src_only, dst_only: dst_only });
        res.end(responseStr);
        return;
      } else if (commandIn === commandObtainProof) {
        console.log('ObtainProof received with dirPathIn ', dirPathIn);
        const proof_xml = await this.getProofXML(dirPathIn, cg_name);
        //console.log('proof_xml =\n', proof_xml);

        var proofObj;
        xml2js.parseString(proof_xml, {explicitArray: false, preserveChildrenOrder: true}, function (err, result) {
            //console.dir(result);
            proofObj = result;
        });

        const src_files = await this.getSrcFiles(dirPathIn);
        const dst_files = await this.getDstFiles(dirPathIn);

        const src_code = (src_files.src === undefined) ? undefined : src_files.src.toString();
        const src_ir = (src_files.ir === undefined) ? undefined : src_files.ir.toString();
        const dst_code = (dst_files.dst === undefined) ? undefined : dst_files.dst.toString();
        const dst_ir = (dst_files.ir === undefined) ? undefined : dst_files.ir.toString();

        //console.log(`src_code = ${src_files.src}\n`);
        const proofStr = JSON.stringify({dirPath: dirPathIn, proof: proofObj, src_code: src_code, src_ir: src_ir, dst_code: dst_code, dst_ir: dst_ir});
        //console.log("proofStr:\n" + proofStr);
        res.end(proofStr);
        return;
      } else if (commandIn === commandObtainSearchTree) {
        console.log('ObtainSearchTree received with dirPathIn ', dirPathIn);
        //var runStatus = await this.getRunningStatus(dirPathIn);
        //const searchTree = runStatus.running_status.enumerated_cgs;
        const searchTree = await this.getSearchTree(dirPathIn);
        const searchTreeStr = JSON.stringify(searchTree);
        console.log('returning ', searchTreeStr);
        res.end(searchTreeStr);
        return;
      } else if (commandIn === commandObtainSrcFiles) {
        console.log('commandObtainSrcFiles received with dirPathIn ', dirPathIn);
        const src_files_json = await this.getSrcFiles(dirPathIn);
        const src_files_str = JSON.stringify(src_files_json);
        //console.log(`responding with dirPathIn ${src_files_str}\n`);
        res.end(src_files_str);
        return;
      } else if (commandIn === commandObtainDstFiles) {
        console.log('commandObtainDstFiles received with dirPathIn ', dirPathIn);
        const dst_files_json = await this.getDstFiles(dirPathIn);
        const dst_files_str = JSON.stringify(dst_files_json);
        res.end(dst_files_str);
        return;
      } else if (commandIn === commandCancelEqcheck) {
        if (dirPathIn !== undefined) {
          console.log('CancelEqcheck received with dirPathIn ', dirPathIn);
          const runStatus = await this.getRunningStatus(dirPathIn);

          if (runStatus !== undefined && runStatus !== null && runStatus.running_status !== undefined) {
            console.log(`killing runStatus.pid = ${runStatus.running_status.pid}\n`);
            tree_kill(runStatus.running_status.pid, 'SIGKILL');
          }
        }
        const chunkStr = JSON.stringify({dirPath: dirPathIn, serverStatus: "cancelled"});
        res.end(chunkStr);
        return;
      } else if (commandIn === commandSaveSession) {
        const ssdir = await this.savedSessionsDir();
        const sessionFile = path.join(ssdir, sessionName);
        var ret = true;
        await fs.writeFile(sessionFile, eqchecks, function (err) {
          if (err) ret = false;
          //console.log(`Saved ${sessionFile}`);
        });
        const chunkStr = JSON.stringify({done: ret});
        res.end(chunkStr);
        return;
      } else if (commandIn === commandLoadSession) {
        const ssdir = await this.savedSessionsDir();
        const sessionFile = path.join(ssdir, sessionName);
        var response = fs.readFile(sessionFile, 'utf8', function(err, data) {
          if (err) {
            console.log(`Could not load from ${sessionFile}: ${err}`);
          }
          //console.log(`data = ${data}`);
          const chunkStr = JSON.stringify({eqchecks: data});
          res.end(chunkStr);
          return;
        });
      } else {
        assert(false, "Invalid Command " + commandIn);
      }
    }
}

module.exports.Handler = EqcheckHandler;
module.exports.SetTestMode = function () {
    hasSetUpAutoClean = true;
};
