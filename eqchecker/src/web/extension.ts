// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as vscode from 'vscode';
import * as fs from 'fs'
//var $ = require('jquery');
//var _ = require('underscore');
//var Promise = require('es6-promise').Promise;
//import * as path from 'path';

const defaultServerURL = 'http://proton.cse.iitd.ac.in:8080';
// const defaultServerURL = 'http://localhost:80';
const EqcheckDoneMessage = 'Eqcheck DONE';
const NUM_LAST_MESSAGES = 3;
const EQCHECK_STATUS_MESSAGE_START = 'Eqcheck started';

const statusEqcheckPinging = "eqcheckPinging";
const statusEqcheckCancelled = "eqcheckCancelled";

const commandCancelEqcheck = 'cancelEqcheck';
const commandSubmitEqcheck = 'submitEqcheck';
const commandPrepareEqcheck = 'prepareEqcheck';
const commandPointsToAnalysis = 'pointsToAnalysis';
const commandObtainProof = 'obtainProof';
const commandObtainScanviewReport = 'obtainScanviewReport';
const commandObtainSrcFiles = 'obtainSrcFiles';
const commandObtainDstFiles = 'obtainDstFiles';
const commandObtainFunctionListsAfterPreparePhase = 'obtainFunctionListsAfterPreparePhase';
const commandSaveSession = 'saveSession';
const commandLoadSession = 'loadSession';
const commandObtainSearchTree = 'obtainSearchTree';
const commandCheckLogin = 'checkLogin';
const commandUploadEqcheckDir = 'uploadEqcheckDir';

const runStateStatusPreparing = 'preparing';
const runStateStatusQueued = 'queued';
const runStateStatusRunning = 'running';
const runStateStatusFoundProof = 'found_proof';
const runStateStatusExhaustedSearchSpace = 'exhausted_search_space';
const runStateStatusSafetyCheckRunning = 'safety_check_running';
const runStateStatusSafetyCheckFailed = 'safety_check_failed';
const runStateStatusTimedOut = 'timed_out';
const runStateStatusTerminated = 'terminated';

declare var acquireVsCodeApi: any;
let recentlyUsedEntries: eqcheckMenuEntry[] =[];

interface eqcheckMenuEntry {
  source1Uri: string;
  source1Name: string;
  //source1Text: string;
  source2Uri: string;
  source2Name: string;
  //source2Text: string;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  //console.log('Congratulations, your extension "eqchecker" is now active in the web extension host!');
  //const cprovider = new ColorsViewProvider(context.extensionUri);
  //context.subscriptions.push(
  //  vscode.window.registerWebviewViewProvider(ColorsViewProvider.viewType, cprovider));
  Eqchecker.initializeEqchecker(context);
  EqcheckViewProvider.initializeEqcheckViewProvider(context.extensionUri);
  //console.log("creating EqcheckViewProvider object\n");
  //console.log("done creating EqcheckViewProvider object\n");
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(EqcheckViewProvider.viewType, EqcheckViewProvider.provider)
  );
  //console.log("done registering EqcheckViewProvider object\n");
  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  //let disposable = vscode.commands.registerCommand('eqchecker.checkEq', () => {
  //  Eqchecker.checkEq();
  //});
  //context.subscriptions.push(disposable);
  let disposable = vscode.commands.registerCommand('eqchecker.setServer', () => {
    Eqchecker.setServer();
  });
  context.subscriptions.push(disposable);
  disposable = vscode.commands.registerCommand('eqchecker.viewProductCFG', (webview, dirPath, key) => {
    EqcheckViewProvider.provider.viewProductCFG(webview, dirPath, key);
  });
  disposable = vscode.commands.registerCommand('eqchecker.logout', () => {
    Eqchecker.logout();
  });
  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}

function aNodeWithIdTreeDataProvider(webview, dirPath): vscode.TreeDataProvider<{ key: string[] }> {
  return {
    getChildren: (element: { key: string[] }): { key: string[] }[] => {
      return getChildren(element ? element.key : undefined).map(key => getNode(key));
    },
    getTreeItem: (element: { key: string[] }): vscode.TreeItem => {
      const treeItem = getTreeItem(webview, dirPath, element.key);
      //treeItem.id = element.key.join('.');
      //treeItem.command = enumeratedCGselected(treeItem.id);
      return treeItem;
    },
    getParent: ({ key }: { key: string[] }): { key: string[] } | undefined => {
      if (key.length <= 1) {
        return undefined;
      }
      let parent = [ ...key ];
      parent.pop();
      return getNode(parent);
    }
  };
}

function getChildren(key: string[] | undefined): string[][] {
  const treeElement = key ? getTreeElement(key) : Eqchecker.searchTree;
  //if (key !== undefined) {
  //  console.log(`getting children of ${key.join('.')}`);
  //}
  var ret = [];
  if (treeElement === undefined) {
    return ret;;
  }
  const searchTreeKeys = Object.keys(treeElement);
  for (const searchTreeKey of searchTreeKeys) {
    //console.log(`child ${searchTreeKey}`);
    const stringArr = searchTreeKey.split(".");
    ret.push(stringArr);
  }
  return ret;
}

function getSearchTreeNodeCorrelEntryFilename(searchTreeNode)
{
  return searchTreeNode.correl_entry_filename.toString();
}

function getSearchTreeNodeMarkdownTooltip(searchTreeNode)
{
  return searchTreeNode.search_node_status_markdown_tooltip.toString();
}

function getSearchTreeNodeDescription(searchTreeNode)
{
  return searchTreeNode.search_node_status_description.toString();
}

function getTreeItem(webview: vscode.Webview, dirPath: string, key: string[]): vscode.TreeItem {
  const treeElement = getTreeElement(key);
  const searchNode = getNode(key);
  const description = getSearchTreeNodeDescription(searchNode);
  // An example of how to use codicons in a MarkdownString in a tree item tooltip.
  const correl_entry_filename = getSearchTreeNodeCorrelEntryFilename(searchNode);
  const markdown_tooltip = getSearchTreeNodeMarkdownTooltip(searchNode);
  const tooltip = new vscode.MarkdownString(`$(zap) ${key.join('.')}\n\n${markdown_tooltip}`, true);
  //console.log(`key = ${key}, treeElement = ${JSON.stringify(treeElement)}`);
  const children = treeElement ? Object.keys(treeElement) : [];
  var collapsibleState = children.length ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
  const id = key.join('.');
  const key_last_elem = key[key.length - 1];
  return {
    label: /**vscode.TreeItemLabel**/<any>{ label: key_last_elem, highlights: searchNode.isStable ? void 0 : [[0, key_last_elem.length]] },
    tooltip: tooltip,
    collapsibleState: collapsibleState,
    id: id,
    command: {
      command: 'eqchecker.viewProductCFG',
      arguments: [webview, dirPath, correl_entry_filename],
      title: 'View Correlation'
    },
    description: description
  };
}

function getTreeElement(element: string[]): any {
  let parent = Eqchecker.searchTree;
  //console.log(`element = ${element}`);
  var prefix =  "";
  for (let i = 0; i < element.length; i++) {
    prefix = (prefix.length == 0) ? element[i] : prefix + "." + element[i];
    parent = parent[prefix];
    //console.log(`i = ${i}, element[i] = ${element[i]}, parent = ${JSON.stringify(parent)}`);
    if (!parent) {
      return null;
    }
  }
  return parent;
}

function getNode(key: string[]): { key: string[], isStable: boolean } {
  if (!Eqchecker.searchTreeNodes[key.join('.')]) {
    Eqchecker.searchTreeNodes[key.join('.')] = new SearchTreeNode(key, true, undefined, "", "");
  }
  return Eqchecker.searchTreeNodes[key.join('.')];
}

function matchEqCheckMenuEntries(e1 : eqcheckMenuEntry , e2 :eqcheckMenuEntry){
      if(e1.source1Name === e2.source1Name && e1.source1Uri === e2.source1Uri && e1.source2Name === e2.source2Name && e1.source2Uri === e2.source2Uri){
        return true;
      }
      return false;
}

class SearchTreeNode {
  searchKey: string[];
  isStable: boolean;
  correl_entry_filename: string;
  search_node_status_markdown_tooltip: string;
  search_node_status_description: string;
  constructor(readonly key: string[], is_stable: boolean, filename: string, tooltip: string, description: string) {
    this.searchKey = key;
    this.isStable = is_stable;
    this.correl_entry_filename = filename;
    this.search_node_status_markdown_tooltip = tooltip;
    this.search_node_status_description = description;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function uri2str(uri : vscode.Uri) : string {
  return uri.fsPath;
}


class Eqchecker {
  public static context;
  public static extensionUri;
  public static serverURL : string = defaultServerURL;
  public static outputMap : Record<string, string[]> = {};
  public static statusMap : Record<string, string> = {};
  public static searchTree : any = {};
  public static searchTreeDirPath : string;
  public static searchTreeNodes : any = {};
  public static searchTreeView : any = undefined;
  public static searchTreeDataProvider : any = undefined;
  public static loginName : string = undefined;

  public static initializeEqchecker(context: vscode.ExtensionContext) {
    //console.log("extensionUri = " + context.extensionUri.fsPath);
    Eqchecker.extensionUri = context.extensionUri;
    Eqchecker.context = context;
  }

  public static fetchFailed(err, url)
  {
    vscode.window.showInformationMessage(`Connection failed to eqchecker server: error ='${err}'`);
    //vscode.window.showInformationMessage(`Connection failed to eqchecker server URL ${url}: error ='${err}'`);
  }

  public static addEqcheckOutput(origRequest, dirPath: string, jsonMessages, runStatus) : boolean
  {
    var messages;
    if (jsonMessages === null || jsonMessages === undefined || jsonMessages.messages === undefined) {
      messages = undefined;
    } else {
      messages = jsonMessages.messages.MSG;
    }
    //if (messages === undefined/* || messages.length === 0*/) {
    //  //console.log("messages = " + messages);
    //  return false;
    //}
    //console.log("addEqcheckOutput called. messages.length = " + messages.length);
    //messages.foreach(function(message) {
    //  console.log(message);
    //});
    if (/*Eqchecker.outputMap[dirPath] === undefined*/ messages !== undefined && messages.length > 0) {
      Eqchecker.outputMap[dirPath] = messages;
    }/* else {
      Eqchecker.outputMap[dirPath] = Eqchecker.outputMap[dirPath].concat(messages);
    }*/
    const lastMessages = Eqchecker.getLastMessages(dirPath, NUM_LAST_MESSAGES);
    const [statusMessage, runState] = Eqchecker.determineEqcheckViewStatusFromLastMessages(lastMessages, runStatus);
    //console.log(`updateEqcheckInView being called on dirPath ${origRequest.dirPath}\n`);
    var request =
        { type: 'updateEqcheckInView',
          //dirPath: dirPath,
          origRequest: origRequest,
          statusMessage: statusMessage,
          runState: runState,
        };
    EqcheckViewProvider.provider.viewProviderPostMessage(request);
    if (lastMessages[0] === EqcheckDoneMessage) {
      return true;
    }
    if (runStatus === undefined || runStatus.running_status === undefined) {
      //console.log(`runState = ${runState}, runState.running_status is null`);
      return false;
    }
    //console.log(`runStatus.running_status.status_flag = ${runStatus.running_status.status_flag}`);
    const ret = runStatus.running_status.status_flag == runStateStatusFoundProof
           || runStatus.running_status.status_flag == runStateStatusExhaustedSearchSpace
           || runStatus.running_status.status_flag == runStateStatusSafetyCheckFailed
           || runStatus.running_status.status_flag == runStateStatusTimedOut
           || runStatus.running_status.status_flag == runStateStatusTerminated
    ;
    //console.log(`ret = ${ret}, runStatus.running_status.status_flag = ${runStatus.running_status.status_flag}`);
    return ret;
  }

  public static determineEqcheckViewStatusFromLastMessages(lastMessages, runStatus)
  {
    var runState;
    //console.log(`runStatus = ${runStatus}\n`);
    if (runStatus === null || runStatus === undefined || runStatus.running_status === undefined) {
     runState = runStateStatusPreparing;
    } else {
     runState = runStatus.running_status.status_flag;
    }
    return [lastMessages[0], runState];
  }

  public static getLastMessages(dirPath, n)
  {
    var lastMessages : string[] = [];
    let numMessages = (Eqchecker.outputMap[dirPath] === undefined) ? 0 : Eqchecker.outputMap[dirPath].length;
    for (let i = 0; i < n && i < numMessages; i++) {
      lastMessages.push(Eqchecker.outputMap[dirPath][numMessages - 1 - i]);
    }
    return lastMessages;
  }

  public static async RequestResponseForCommand(jsonRequest) : Promise<any> {
    var url = Eqchecker.serverURL + "/api/eqchecker/submit_eqcheck";
    //console.log("extra =\n" + JSON.stringify(extra));
    return new Promise((resolve, reject) =>
      fetch(url, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        body: jsonRequest,
        headers: {
          'Content-Type' : 'application/json',
          'Accept' : 'application/json',
        }
      })
      .then(function (response) {
        resolve(response.json());
      })
      .catch(function(err) {
        console.log(`error = ${JSON.stringify(err)}\n`);
        Eqchecker.fetchFailed(err, url);
        reject();
      })
    );
  }

  public static async logout()
  {
    this.setLoginName(undefined);
    var viewRequest =
        { type: 'userLogout',
        };
    EqcheckViewProvider.provider.viewProviderPostMessage(viewRequest);
  }

  public static setLoginName(name) {
    this.loginName = name;
  }

  public static setLoginNameIfUndefined(name) {
    if (this.loginName === undefined) {
      this.loginName = name;
    }
  }

  public static getLoginName() {
    if (this.loginName === undefined) {
      console.log(`Warning: loginName is undefined!`);
    }
    return this.loginName;
  }

  public static async RequestNextChunk(jsonRequest, origRequestIn, dirPathType) {
    return new Promise ((resolve, reject) => {
      const origRequest = origRequestIn;
      //const firstRequest = firstRequestIn;
      //console.log(`requesting response for server command ${origRequest.serverCommand}, dirPathIn ${origRequest.dirPathIn}, function ${origRequest.functionName}`);
      this.RequestResponseForCommand(jsonRequest).then(async function(result) {
        //const result = res.result;
        //const origRequest = result.extra.origRequest;
        //const firstRequest = result.extra.firstRequest;
        //console.log("result =\n" + JSON.stringify(result));
        //console.log("extra =\n" + JSON.stringify(result.extra));
        let dirPath = result.dirPath;
        //console.log(`response received for function ${origRequest.functionName}, dirPath ${dirPath}`);
        if (origRequest.dirPathIn === undefined) {
          //console.log("first response received.\n");
          origRequest.type = 'addEqcheckInView';
          origRequest.dirPath = dirPath;
          origRequest.dirPathIn = dirPath;
          origRequest[dirPathType] = dirPath;
          origRequest.quotaRemaining = result.quotaRemaining;
          EqcheckViewProvider.provider.viewProviderPostMessage(origRequest);
          Eqchecker.statusMap[dirPath] = statusEqcheckPinging;
          const msg = (origRequest.source2Uri === undefined) ? `Compiling ${origRequest.source1Uri}` : `Checking equivalence for: ${origRequest.source1Uri} -> ${origRequest.source2Uri}`;
          vscode.window.showInformationMessage(msg);
        } else {
          //console.log("response received.\n");
        }
        let offset = result.offset;
        let chunk = result.chunk;
        let runStatus = result.runStatus;
        //console.log(`dirPath = ${dirPath}, offset = ${offset}.\n`);
        //console.log(`chunk = ${chunk}.\n`);
        const done = Eqchecker.addEqcheckOutput(origRequest, dirPath, chunk, runStatus);
        if (!done) {
          if (Eqchecker.statusMap[dirPath] === statusEqcheckPinging) {
            await Eqchecker.wait(500);
            //let jsonRequestNew = JSON.stringify({/*serverCommand: commandPingEqcheck, */dirPathIn: dirPath, offsetIn: offset});
            let jsonRequestNew = JSON.stringify({serverCommand: origRequest.serverCommand, dirPathIn: dirPath, offsetIn: offset});
            resolve(Eqchecker.RequestNextChunk(jsonRequestNew, origRequest, undefined));
          } else {
            resolve({dirPath: dirPath, runStatus: runStatus});
          }
        } else {
          resolve({dirPath: dirPath, runStatus: runStatus});
        }
      })
    });
      //.catch(function(err) {
      //  console.log(`Error: ${err}`)
      //  return "";
      //});
  }

  private static createWarningMessageFromFunctionList(name, ls)
  {
    var msg = `The following functions are present only in the ${name} program:`;
    for (let fname in ls) {
      msg += ` ${fname}`;
    }
    return msg;
  }

  private static async populatePreparePhaseInfo(request) //this function is (and should remain) idempotent
  {
    const prepareDirpath = request.prepareDirpath;
    //console.log(`prepareDirpath = ${prepareDirpath}`);
    const {src_filename: src_filename_arr, dst_filename: dst_filename_arr, dst_filename_is_object: dst_filename_is_object_str, src_bc: src_bc, src_ir: src_ir, dst_bc: dst_bc, dst_ir: dst_ir, harvest: harvest, object: object, compile_log: compile_log, common: common, src_only: src_only, dst_only: dst_only} = await this.obtainFunctionListsAfterPreparePhase(prepareDirpath);

    const src_filename = src_filename_arr.toString();
    const dst_filename = dst_filename_arr.toString();
    if (dst_filename === "") {
      console.log('returning false because dst_filename === ""');
      return { retval: false, src_filename: src_filename, dst_filename: dst_filename, src_bc: src_bc, dst_bc: dst_bc, src_ir: src_ir, dst_ir: dst_ir, common: common, harvest: harvest, object: object, compile_log: compile_log };
    }

    const dst_filename_is_object = (dst_filename_is_object_str == "true");

    if (request.source2Uri === undefined) {
      request.source1Name = posix.basename(src_filename.toString(), undefined);
      request.source1Uri = src_filename.toString();
      request.source2Name = posix.basename(dst_filename.toString(), undefined);
      request.source2Uri = dst_filename.toString();
      request.dstFilenameIsObject = dst_filename_is_object;
      request.source2Text = object;
      request.compile_log = compile_log;
      console.log(`set source2 to ${request.source2Name}\n`);
    }

    //console.log(`common = ${common}`);

    if (common.length === 0) {
      const msg = `ERROR: No common function in files given for eqcheck`;
      const origRequest = { ...request };
      origRequest.dirPath = request.dirPathIn;
      var viewRequest =
          { type: 'updateEqcheckInView',
            origRequest: origRequest,
            statusMessage: msg,
            runState: runStateStatusTerminated,
          };
      EqcheckViewProvider.provider.viewProviderPostMessage(viewRequest);
      vscode.window.showInformationMessage(msg);
      return { retval: false, src_filename: src_filename, dst_filename: dst_filename, src_bc: src_bc, dst_bc: dst_bc, src_ir: src_ir, dst_ir: dst_ir, common: common, harvest: harvest, object: object, compile_log: compile_log };
    }
    if (src_only.length > 0) {
      const msg = this.createWarningMessageFromFunctionList('first', src_only);
      vscode.window.showInformationMessage(msg);
    }
    if (dst_only.length > 0) {
      const msg = this.createWarningMessageFromFunctionList('second', dst_only);
      vscode.window.showInformationMessage(msg);
    }
    console.log(`populatePreparePhaseInfo: src_bc = ${src_bc}`);
    return { retval: true, src_filename: src_filename, src_bc: src_bc, src_ir: src_ir, dst_filename: dst_filename, dst_bc: dst_bc, dst_ir: dst_ir, common: common, harvest: harvest, object: object, compile_log: compile_log };
  }

  public static async submitRunCommand(request) {
    const pointsToDirpath = request.pointsToDirpath;

    const preparePhaseResult = await this.populatePreparePhaseInfo(request);
    if (!preparePhaseResult.retval) {
      return false;
    }

    const jsonRequest3 = JSON.stringify({serverCommand: commandObtainSrcFiles, dirPathIn: pointsToDirpath});
    const response = (await this.RequestResponseForCommand(jsonRequest3));
    //console.log(`obtain src files response = ${JSON.stringify(response)}\n`);
    const src_etfg = response.etfg;
    const src_ir = response.ir;
    const src_bc = response.bc;
    const source1 = response.src;

    const jsonRequest4 = JSON.stringify({serverCommand: commandObtainDstFiles, dirPathIn: pointsToDirpath});
    const response2 = (await this.RequestResponseForCommand(jsonRequest4));
    //console.log(`obtain dst files response2 = ${JSON.stringify(response2)}\n`);
    const dst_etfg = response2.etfg;
    const dst_ir = response2.ir;
    const dst_bc = response2.bc;
    const source2 = response2.dst;
    //console.log(`dst_etfg = ${JSON.stringify(dst_etfg)}\n`);

    console.log(`preparePhaseResult.common = ${preparePhaseResult.common.join(" ")}`);

    var funRequestPromises = [];
    for (let i = 0; i < preparePhaseResult.common.length; i++) {
      const functionName = preparePhaseResult.common[i];
      //console.log(`functionName '${functionName}'`);
      //console.log(`request.functionName = '${request.functionName}'`);
      //console.log(`functionName === request.functionName = '${functionName === request.functionName}'`);
      //console.log(`functionName == request.functionName = '${functionName == request.functionName}'`);
      //console.log(`functionName.valueOf() == request.functionName.valueOf() = '${functionName.valueOf() == request.functionName.valueOf()}'`);
      //console.log(`functionName.toString() == request.functionName.toString() = '${functionName.toString() == request.functionName.toString()}'`);
      if (request.functionName != undefined && request.functionName.toString() != functionName.toString()) {
        console.log(`Ignoring function ${functionName} (request.functionName = ${request.functionName})`);
        continue;
      }
      var funRequest = { ...request};

      //console.log(`functionName = ${functionName}\n`);
      funRequest.serverCommand = commandSubmitEqcheck;
      funRequest.dirPathIn = request.dirPathIn;
      funRequest.dirPath = request.dirPathIn;
      funRequest.src_etfg = src_etfg;
      funRequest.dst_etfg = dst_etfg;
      funRequest.src_bc = src_bc;
      funRequest.dst_bc = dst_bc;
      funRequest.src_ir = src_ir;
      funRequest.dst_ir = dst_ir;
      funRequest.source1 = source1;
      funRequest.source2 = source2;
      funRequest.loginName = Eqchecker.getLoginName();

      //if (src_etfg !== undefined) {
      //  funRequest.source1 = src_etfg;
      //} else if (src_bc !== undefined) {
      //  funRequest.source1 = src_bc;
      //}
      //if (dst_etfg !== undefined) {
      //  funRequest.source2 = dst_etfg;
      //} else if (dst_bc !== undefined) {
      //  funRequest.source2 = dst_bc;
      //}
      funRequest.harvest = preparePhaseResult.harvest;
      funRequest.object = preparePhaseResult.object;
      funRequest.compile_log = preparePhaseResult.compile_log;
      funRequest.functionName = functionName;
      const jsonRequest = JSON.stringify(funRequest);
      funRequestPromises.push(Eqchecker.RequestNextChunk(jsonRequest, funRequest, "runDirpath"));
    }

    const origRequest = { ...request };
    origRequest.dirPath = pointsToDirpath;
    const viewRequestRemove2 =
        { type: 'removeEqcheckInView',
          origRequest: origRequest,
        };
    EqcheckViewProvider.provider.viewProviderPostMessage(viewRequestRemove2);

    Promise.all(funRequestPromises);

    return true;
  }


  public static async submitPointsToCommand(request) {
    const prepareDirpath = request.prepareDirpath;

    if (prepareDirpath === "") {
      console.log('returning false because prepareDirpath = empty-string');
      return false;
    }

    const prepareRequest = { ...request };
    prepareRequest.dirPath = prepareDirpath;

    const preparePhaseResult = await this.populatePreparePhaseInfo(request);
    if (!preparePhaseResult.retval) {
      return false;
    }

    request.src_bc = preparePhaseResult.src_bc;
    request.src_ir = preparePhaseResult.src_ir;
    request.dst_bc = preparePhaseResult.dst_bc;
    request.dst_ir = preparePhaseResult.dst_ir;
    request.source1 = preparePhaseResult.src_filename;
    request.source2 = preparePhaseResult.dst_filename;
    request.loginName = Eqchecker.getLoginName();

    //if (preparePhaseResult.src_bc === undefined) {
    //  request.source1 = preparePhaseResult.src_filename;
    //} else {
    //  request.source1 = preparePhaseResult.src_bc;
    //}
    //if (preparePhaseResult.dst_bc === undefined) {
    //  request.source2 = preparePhaseResult.dst_filename;
    //} else {
    //  request.source2 = preparePhaseResult.dst_bc;
    //}

    request.serverCommand = commandPointsToAnalysis;
    const jsonRequest2 = JSON.stringify(request);
    const result: any = await Eqchecker.RequestNextChunk(jsonRequest2, request, "pointsToDirpath");

    request.pointsToDirpath = result.dirPath;
    request.dirPathIn = undefined;
    var runCommand = Eqchecker.submitRunCommand(request);

    const viewRequestRemove =
        { type: 'removeEqcheckInView',
          origRequest: prepareRequest,
        };
    EqcheckViewProvider.provider.viewProviderPostMessage(viewRequestRemove);

    return await runCommand;
  }

  public static async submitPrepareCommand(request) {
    console.log(`submitting prepare command\n`);
    request.serverCommand = commandPrepareEqcheck;
    request.loginName = Eqchecker.getLoginName();
    const jsonRequest = JSON.stringify(request);
    const result : any = await Eqchecker.RequestNextChunk(jsonRequest, request, "prepareDirpath");

    const preparePhaseResult = await this.populatePreparePhaseInfo(request);
    if (preparePhaseResult.retval) {
      const viewRequestRemove =
          { type: 'removeEqcheckInView',
            origRequest: request,
          };
      EqcheckViewProvider.provider.viewProviderPostMessage(viewRequestRemove);
    }
    const dirPath = result.dirPath;
    request.prepareDirpath = result.dirPath;
    request.dirPathIn = undefined;
    request.source1Text = undefined;
    request.source2Text = undefined;
    return await Eqchecker.submitPointsToCommand(request);
  }


  public static async addEqcheck(entry) {
    //console.log("addEqcheck() called\n");
    //var source : string;
    //var optimized : string;
    if (entry === undefined || entry.source1Uri === undefined) {
      return false;
    }

    let options: vscode.InputBoxOptions = {
      prompt: "Extra arguments: ",
      placeHolder: "(none)"
    };
    var extra_args = "";
    //await vscode.window.showInputBox(options).then(async ea => {
    //  if (!ea) return;
    //  extra_args = ea;
    //});

    const source1Text = await vscode.workspace.fs.readFile(vscode.Uri.file(entry.source1Uri));
    var source2Text;
    if (entry.source2Uri !== undefined) {
      source2Text = await vscode.workspace.fs.readFile(vscode.Uri.file(entry.source2Uri));
    }

    //console.log('source = ' + source);
    //console.log('optimized = ' + optimized);
    var request =
        { //serverCommand: commandPrepareEqcheck,
          source1Uri: entry.source1Uri,
          source1Name: entry.source1Name,
          source1Text: source1Text,
          source2Uri: entry.source2Uri,
          source2Name: entry.source2Name,
          source2Text: source2Text,
          dstFilenameIsObject: undefined,
          statusMessage: EQCHECK_STATUS_MESSAGE_START,
          dirPathIn: undefined,
          functionName: undefined,
          src_ir: undefined,
          dst_ir: undefined,
          src_etfg: undefined,
          dst_etfg: undefined,
          harvest: undefined,
          object: undefined,
          compile_log: undefined,
          extra_args: extra_args
        };
    //console.log(`jsonRequest = ${jsonRequest}\n`);
    return await Eqchecker.submitPrepareCommand(request);
  }

  public static async obtainSearchTreeFromServer(dirPathIn)
  {
    let jsonRequest = JSON.stringify({serverCommand: commandObtainSearchTree, dirPathIn: dirPathIn});
    const response = await this.RequestResponseForCommand(jsonRequest);
    return response.search_tree;
  }

  public static async obtainProofFromServer(dirPathIn, cg_name: string/*key : string[]*/)
  {
    //const cg_name = (key === undefined) ? undefined : key.join('.');
    let jsonRequest = JSON.stringify({serverCommand: commandObtainProof, dirPathIn: dirPathIn, cg_name: cg_name});
    const response = await this.RequestResponseForCommand(jsonRequest);
    //console.log("obtainProofFromServer response: ", JSON.stringify(response));
    //const proof = response.proof;
    //console.log("response proof: ", JSON.stringify(proof));
    return response;
  }

  public static async obtainScanviewReportFromServer(dirPathIn, filename)
  {
    let jsonRequest = JSON.stringify({serverCommand: commandObtainScanviewReport, dirPathIn: dirPathIn, source1: filename});
    const response = await this.RequestResponseForCommand(jsonRequest);
    return response;
  }

  public static async obtainFunctionListsAfterPreparePhase(dirPathIn)
  {
    let jsonRequest = JSON.stringify({serverCommand: commandObtainFunctionListsAfterPreparePhase, dirPathIn: dirPathIn});
    let response = await this.RequestResponseForCommand(jsonRequest);
    return response;
  }

  public static async stopPinging(dirPath)
  {
    Eqchecker.statusMap[dirPath] = statusEqcheckCancelled;
  }

  public static async eqcheckCancel(webview: vscode.Webview, dirPath)
  {
    this.stopPinging(dirPath);
    var request =
      { serverCommand: commandCancelEqcheck,
        dirPathIn: dirPath,
      };
    let jsonRequest = JSON.stringify(request);
    const response = (await this.RequestResponseForCommand(jsonRequest));
    console.log("Cancel Eqcheck response: ", JSON.stringify(response));
    //var viewRequest =
    //    { type: 'eqcheckCancelled',
    //      //dirPath: dirPath,
    //      origRequest: {dirPath: dirPath},
    //    };
    //EqcheckViewProvider.provider.viewProviderPostMessage(viewRequest);
    return;
  }


  public static async checkEq()
  {
      // Get labels of opened files in all groups
      let tabs = vscode.window.tabGroups.all.flatMap(({ tabs }) => tabs);
        //console.log("tabs size = ");
      //console.log(tabs.length);
      //let textEditors = vscode.window.visibleTextEditors;
      let cSources = [];
      let asmSources = [];
      let textDocuments = await vscode.workspace.textDocuments;
      textDocuments.forEach(async function(entry) {
        //console.log('textDocument fileName = ' + entry.fileName);
        //console.log('\n');
        if (entry.fileName.endsWith(".c")) {
          cSources.push({ Uri: entry.fileName, Text: entry.getText() });
        } else if (entry.fileName.endsWith(".s")) {
          asmSources.push({ Uri: entry.fileName, Text: entry.getText() });
        }
        //c_sources.push(tab);
      });
      tabs.forEach(async function(entry) {
        //console.log('fileName = ' + entry.fileName);
        //console.log('\n');

        if (entry.input instanceof vscode.TabInputText) {
          let entryUri = uri2str((entry.input as vscode.TabInputText).uri);
          //console.log('tab entry Uri = ' + entryUri);
          let alreadyExists = false;
          cSources.forEach(function(f) { if (f.Uri === entryUri) alreadyExists = true; });
          asmSources.forEach(function(f) { if (f.Uri === entryUri) alreadyExists = true; });

          if (!alreadyExists && entryUri.endsWith(".c")) {
            cSources.push({ Uri: entryUri });
          } else if (!alreadyExists && entryUri.endsWith(".s")) {
            asmSources.push({ Uri: entryUri });
          }
        }
        //c_sources.push(tab);
      });

      //console.log("Printing C sources:");
      //cSources.forEach(function(cSource) { console.log("fileName = " + cSource.Uri); });
      //console.log("Printing ASM sources:");
      //asmSources.forEach(function(asmSource) { console.log("fileName = " + asmSource.Uri); });
      let eqcheckPairsnew = Eqchecker.genLikelyEqcheckPairs(cSources, asmSources);
      //console.log("eqcheckPairs size " + eqcheckPairs.length);
      //let eqcheckPairs = oldEqChecksMenuEntry;
      //console.log(`EqCheckPairs are : ${JSON.stringify(eqcheckPairs)}`);
      let eqcheckPairs = [...recentlyUsedEntries];

      for(const e1 of eqcheckPairsnew){
        let matched =false;
        for(const e2 of recentlyUsedEntries){
          if(matchEqCheckMenuEntries(e1,e2)){
            matched=true;
            break;
          }
        }
        if(!matched){
          eqcheckPairs.push(e1);
        }
      }
      
      let result = await Eqchecker.showEqcheckFileOptions(eqcheckPairs);
      //console.log(`result = ${result}`);
      var eqcheckPair;
      if (result >= eqcheckPairs.length) {
        eqcheckPair = await Eqchecker.openSourceFiles();
      }
       else {
        eqcheckPair = eqcheckPairs[result];
        recentlyUsedEntries.unshift(eqcheckPair);
      }
      console.log(`eqcheckPair = ${JSON.stringify(eqcheckPair)}\n`);
      if (await Eqchecker.addEqcheck(eqcheckPair) === true) {
        vscode.window.showInformationMessage(`Checking equivalence for: ${eqcheckPair.source1Uri} -> ${eqcheckPair.source2Uri}`);
      }
        //console.log(tabs);
      //let url = "http://localhost:3000";
      //fetch(url, {method: 'POST', body: JSON.stringify({name: "go"})}).then((response) => response.json()).then((data) => console.log(data));
      // Display a message box to the user
      //vscode.window.showInformationMessage("hello");
  }

  public static async setServer()
  {
    //let servers : string[] = [];
    //servers.push(defaultServerURL);
    //const result = await vscode.window.showQuickPick(servers, {
    //  placeHolder: servers?.[0],
    //  ignoreFocusOut: true
    //});
    //Eqchecker.serverURL = result;

    const options: vscode.InputBoxOptions = {
      prompt: "Enter the server URL",
      placeHolder: Eqchecker.serverURL,
      ignoreFocusOut: true
    };
    await vscode.window.showInputBox(options).then(async ea => {
      if (ea) {
        Eqchecker.serverURL = ea;
      }
    });
  }

  private static async openSourceFiles() : Promise<eqcheckMenuEntry>
  {
    const options = {
      canSelectMany: false,
      openLabel: 'Open Source Code File(s)',
      filters: {
        'Source Code': ['c'],
      }
    };

    let srcFileUri, dstFileUri, srcFileName, dstFileName, srcText, dstText;

    // Ask the user to select the first source code file.
    const firstFileUris = await vscode.window.showOpenDialog(options);
    if (firstFileUris && firstFileUris[0]) {
      srcFileUri = firstFileUris[0].fsPath;
      srcFileName = posix.basename(srcFileUri, undefined);
      //srcText = await vscode.workspace.openTextDocument(srcFileUri);
      //await vscode.window.showTextDocument(srcText, { viewColumn: vscode.ViewColumn.One });
      //console.log(`srcText = ${JSON.stringify(srcText)}\n`);

      // Ask the user to select the next source code file.
      var dst_options = {
        canSelectMany: false,
        openLabel: 'Open Destination Code File(s)',
      };

      const dstFileUris = await vscode.window.showOpenDialog(dst_options);
      if (dstFileUris && dstFileUris[0]) {
        dstFileUri = dstFileUris[0].fsPath;
        dstFileName = posix.basename(dstFileUri, undefined);
      }
      //dstText = await vscode.workspace.openTextDocument(dstFileUri);
      //await vscode.window.showTextDocument(dstText, { viewColumn: vscode.ViewColumn.Two });
    }
    return { source1Uri: srcFileUri,
             source1Name: srcFileName,
             //source1Text: undefined/*srcText*/,
             source2Uri: dstFileUri,
             source2Name: dstFileName,
             //source2Text: undefined/*dstText*/
            };
  }

  private static genLikelyEqcheckPairs(cSources, asmSources) : eqcheckMenuEntry[]
  {
    let ret : eqcheckMenuEntry[] = [];
    let i = 0;
    cSources.forEach(function (cSource1) {

      ret.push({ source1Uri: cSource1.Uri,
                 source1Name: posix.basename(cSource1.Uri, undefined),
                 //source1Text: undefined/*cSource1.Text*/,
                 source2Uri: undefined,
                 source2Name: undefined,
                 //source2Text: undefined/*asmSource.Text*/
                });

      //console.log("cSource1Label = " + cSource1.fileName);
      /*if (cSource1.input instanceof vscode.TabInputText) */{
        //let cSource1Uri = uri2str((cSource1.input as vscode.TabInputText).uri);
        let cSource1Uri = cSource1.Uri;
        //console.log("cSource1Uri = " + cSource1Uri);
        asmSources.forEach(function (asmSource) {
          //console.log("asmSourceLabel = " + asmSource.fileName);
          /*if (asmSource.input instanceof vscode.TabInputText) */{
            //let asmSourceUri = uri2str((asmSource.input as vscode.TabInputText).uri);
            let asmSourceUri = asmSource.Uri;
            //console.log("asmSourceUri = " + asmSourceUri);
            ret.push({ source1Uri: cSource1Uri,
                       source1Name: posix.basename(cSource1Uri, undefined),
                       //source1Text: undefined/*cSource1.Text*/,
                       source2Uri: asmSourceUri,
                       source2Name: posix.basename(asmSourceUri, undefined),
                       //source2Text: undefined/*asmSource.Text*/
                      });
            //let pr = `${++i}: ${cSource1.label} -> ${asmSource.label}`;
            //ret.push(pr);
          }
        });
        cSources.forEach(function (cSource2) {
          /*if (cSource2.input instanceof vscode.TabInputText) */{
            //let cSource2Uri = uri2str((cSource2.input as vscode.TabInputText).uri);
            let cSource2Uri = cSource2.Uri;
            //console.log("cSource2Uri = " + cSource2Uri);
            if (cSource1Uri !== cSource2Uri) {
              ret.push({ source1Uri: cSource1Uri,
                         source1Name: posix.basename(cSource1Uri, undefined),
                         //source1Text: undefined/*cSource1.Text*/,
                         source2Uri: cSource2Uri,
                         source2Name: posix.basename(cSource2Uri, undefined),
                         //source2Text: undefined/*cSource2.Text*/
                        });
              //let pr = `${++i}: ${cSource1.label} -> ${cSource2.label}`;
              //ret.push(pr);
            }
          }
        });
      }
    });

    return ret;
  }

  /**
   * Shows a pick list using window.showQuickPick().
   */
  private static async showEqcheckFileOptions(menuItems : eqcheckMenuEntry[]) : Promise<number> {
    let i = 0;
    //console.log("before getQuickPickItems..() call: menuItems length = " + menuItems.length.toString());
    let items = Eqchecker.getQuickPickItemsFromEqcheckMenuEntries(menuItems);
    //console.log("before showQuickPick call: menuItems length = " + menuItems.length.toString() + ", items.length = " + items.length.toString());
    const result = await vscode.window.showQuickPick(items, {
      placeHolder: items?.[0],
      ignoreFocusOut: true
      //onDidSelectItem: item => window.showInformationMessage(`Focus ${++i}: ${item}`)
    });
    //console.log("before findIndex call");
    //vscode.window.showInformationMessage(`Got: ${result}`);
    let resultIndex = items.findIndex(function (v : string, _ : number, o : object) { return (v === result); });
    console.log("resultIndex = " + resultIndex.toString());
    return resultIndex;
  }

  private static getQuickPickItemsFromEqcheckMenuEntries(menuItems : eqcheckMenuEntry[]) : string[] {
    //console.log("calling menuItems.map(). menuItems.length = " + menuItems.length.toString());
    let ret = menuItems.map(function (menuItem) {
                if (menuItem.source2Name !== undefined) {
                  return `${menuItem.source1Name} -> ${menuItem.source2Name}`;
                } else {
                  return `Compile ${menuItem.source1Name}`;
                }
              });
    ret.push('Pick source/assembly files from the filesystem');
    //console.log("returned from menuItems.map(). ret.length = " + ret.length.toString());
    return ret;
  }

  /**
   * @returns string
   */
  public static getNewCalicoColor() {
      return '000000';
      const colors = ['020202', 'f1eeee', 'a85b20', 'daab70', 'efcb99'];
      return colors[Math.floor(Math.random() * colors.length)];
  }

  public static wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  public static Text2String(text)
  {
    var arr = [];
    for (let i in text) {
      arr.push(text[i]);
    }
    const dec = new TextDecoder("utf-8");
    return dec.decode(new Uint8Array(arr));
  }

  public static eqcheckHasFinishedExecuting(eqcheck)
  {
    if (   eqcheck.runState == runStateStatusFoundProof
        || eqcheck.runState == runStateStatusExhaustedSearchSpace
        || eqcheck.runState == runStateStatusSafetyCheckFailed
        || eqcheck.runState == runStateStatusTimedOut
        || eqcheck.runState == runStateStatusTerminated) {
      return true;
    }
    //console.log(`eqcheck.runState = ${eqcheck.runState}\n`);
    return false;
  }

  public static cgs_to_tree_rec(obj, parentname)
  {
    var tree = {};
    var treeNodes = {};
    var curname = [ ...parentname ];
    if (obj instanceof Object) {
      //console.log(`instanceof Object evaluates to true`);
      for (const k in obj) {
        //console.log(`looking at ${k}`);
        if (obj.hasOwnProperty(k)) {
          //console.log(`hasOwnProperty true for ${k}`);
          if (k == "trie_key") {
            for (const str of obj[k][0].string) {
              curname.push(str);
            }
          }
        }
      }
      for (const k in obj) {
        if (obj.hasOwnProperty(k)) {
          if (k == "trie_child_tree") {
            const trie_child_tree_node = obj[k][0];
            if (trie_child_tree_node.hasOwnProperty('trie_child')) {
              for (const trie_child of trie_child_tree_node.trie_child) {
                const {name: child_name, tree: child_tree, treeNodes: child_treeNodes } = Eqchecker.cgs_to_tree_rec(trie_child, curname);
                tree[child_name as string] = child_tree;
                //console.log(`child_treeNodes =\n${JSON.stringify(child_treeNodes)}`);
                treeNodes = Object.assign({}, child_treeNodes, treeNodes);
                //console.log(`treeNodes =\n${JSON.stringify(treeNodes)}`);
              }
            }
            if (trie_child_tree_node.hasOwnProperty("trie_val")) {
              //console.log(`found trie_val`);
              const trie_child_val = trie_child_tree_node.trie_val[0];
              const is_stable = (trie_child_val.correl_entry_status_is_stable == "true");
              treeNodes[curname.join('.')] = new SearchTreeNode(curname, is_stable, trie_child_val.correl_entry_filename, trie_child_val.correl_entry_status_markdown_tooltip, trie_child_val.correl_entry_status_description);
              //console.log(`curname ${curname.join('.')} cg enum_status ${trie_child_val.cg_enum_status}`);
            }
          }
        }
      }
    }
    //console.log(`treeNodes =\n${JSON.stringify(treeNodes)}`);
    const ret = { name: curname.join('.'), tree: tree, treeNodes: treeNodes };
    //console.log(`returning ${JSON.stringify(ret)}\n`);
    return ret;
  }

  public static cgs_enumerated_to_search_tree(cgs_enumerated)
  {
    //console.log(`cgs_enumerated =\n${JSON.stringify(cgs_enumerated)}\n`);
    const {name: searchTreeName, tree: searchTree, treeNodes: searchTreeNodes} = Eqchecker.cgs_to_tree_rec(cgs_enumerated.trie_child[0], []);
    var ret = { };
    ret[searchTreeName] = searchTree;
    //console.log(`ret =\n${JSON.stringify(ret)}`);
    //console.log(`searchTreeNodes =\n${JSON.stringify(searchTreeNodes)}`);
    return { searchTree: ret, searchTreeNodes: searchTreeNodes };
  }

  public static tfg_llvm_obtain_subprogram_info(tfg_llvm)
  {
    return [tfg_llvm.llvm_subprogram_debug_info, tfg_llvm.llvm_ir_subprogram_debug_info];
  }

  public static tfg_asm_obtain_subprogram_info(tfg_asm, assembly)
  {
    return {line: 0, scope_line: 0};
  }
}

class EqcheckViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'eqchecker.eqcheckView';
  public static provider : EqcheckViewProvider;
  private _view?: vscode.WebviewView;
  private proof_panels;
  private scanview_panel;

  constructor(
    private readonly _extensionUri: vscode.Uri,
  ) { }

  public static initializeEqcheckViewProvider(_extensionUri: vscode.Uri) {
    EqcheckViewProvider.provider = new EqcheckViewProvider(_extensionUri);
  }

  public static getScanviewWebviewContent(context_path: string, scanview_script: vscode.Uri, scanview_css: vscode.Uri)
  {
    const html =
    `<!doctype html>
    <html>
    <head>
      <script type="module" src=${scanview_script}></script>
      <link rel="stylesheet" href=${scanview_css}>
    </head>

    <body class="full-view" >
        <div id="report"></div>
    </body>
    </html>`;
    return eval('`' + html + '`');
  }

  public static getProductWebviewContent(context_path: string, product_script: vscode.Uri, index_css: vscode.Uri, graph_src: vscode.Uri, d3_v5_min_js: vscode.Uri, index_min_js: vscode.Uri, d3_graphviz_js: vscode.Uri)
  {
    const html =
    `<!DOCTYPE html>
    <html>
      <meta charset="utf-8">
      <head>
        <link rel="stylesheet" href=${index_css}>
        <script type="module" src=${graph_src}></script>
        <script>
          function zoomIn() {
            var content = document.getElementById("graph");
            var zoom = document.getElementById("zoom_percent");
            var currentZoom = parseFloat(content.style.zoom) || 1;
            content.style.zoom = currentZoom + 0.25;
            zoom.innerHTML=JSON.stringify((currentZoom+0.25)*100)+"%";
          }

          function zoomOut() {
            var content = document.getElementById("graph");
            var zoom = document.getElementById("zoom_percent");
            var currentZoom = parseFloat(content.style.zoom) || 1;
            if(Math.abs(currentZoom - 0.25) > 1e-9){
              content.style.zoom = currentZoom - 0.25;
              zoom.innerHTML=JSON.stringify((currentZoom-0.25)*100)+"%";
            }
          }
        </script>
      </head>
      <body style="background-color:#FFFFFF;">
        <script src="${d3_v5_min_js}"></script>
        <script src="${index_min_js}"></script>
        <script src="${d3_graphviz_js}"></script>
        <div class="zoom-button">
          <button onclick="zoomIn()">+</button>
          <span id = "zoom_percent">100%</span>
          <button onclick="zoomOut()">-</button>
        </div>
        <div class="graph" id="graph" style="text-align: center;"></div>
      </body>
    </html>`;

    return eval('`' + html + '`');
  }

  public static getSourceCodeWebviewContent(context_path: string, script: vscode.Uri, index_css: vscode.Uri, prism_script: vscode.Uri, prism_css: vscode.Uri, prism_ln_css: vscode.Uri, prism_ln_script: vscode.Uri, prism_nasm_script: vscode.Uri) {
    //const html = readFileSync(path.join(context_path, 'src/web_view/views/src_code.html')).toString();
    //return eval('`' + html + '`');
    const style = `
    <style>
      .line-number {
        float: left;
        margin-right: 20px;
        color: #CB3535; /* Line number color */
      }
    </style>
  `;

    const html =
    `<!doctype html>
    <html>
    <head>
      ${style}
        <script type="module" src=${script}></script>
        <link rel="stylesheet" href=${index_css}>
        <script type="module" src=${prism_script}></script>
        <link rel="stylesheet" href=${prism_css}>
        <script>
          function zoomIn() {
            var content = document.getElementById("content");
            var zoom = document.getElementById("zoom_percent");
            var currentZoom = parseFloat(content.style.zoom) || 1;
            content.style.zoom = currentZoom + 0.25;
            zoom.innerHTML=JSON.stringify((currentZoom+0.25)*100)+"%";
          }

          function zoomOut() {
            var content = document.getElementById("content");
            var zoom = document.getElementById("zoom_percent");
            var currentZoom = parseFloat(content.style.zoom) || 1;
            if(Math.abs(currentZoom - 0.25) > 1e-9){
              content.style.zoom = currentZoom - 0.25;
              zoom.innerHTML=JSON.stringify((currentZoom-0.25)*100)+"%";
            }
          }
        
        </script>
    </head>
    <body class="full-view">
        <div class="zoom-button">
          <button onclick="zoomIn()">+</button>
          <span id = "zoom_percent">100%</span>
          <button onclick="zoomOut()">-</button>
        </div>
        <div id="content">
            <div class="code-container" style="display:block;">
                <pre id="pre-code" ><code id="code" class="language-clike"></code></pre>
            </div>
            <canvas id="canvas" style="position: absolute;"></canvas>
            <div id="right-click-menu">
            <div id="RightClickMenuItem1" class="item"></div>
            <div id="RightClickMenuItem2" class="item"></div>
            <div id="RightClickMenuItem3" class="item"></div>
            <div id="RightClickMenuItem4" class="item"></div>
            <div id="RightClickMenuItem4" class="item"></div>
            </div>
        </div>
    </body>
    </html>`;
    return eval('`' + html + '`');
  }

  public static getAssemblyCodeWebviewContent(context_path: string, script: vscode.Uri, index_css: vscode.Uri, prism_script: vscode.Uri, prism_css: vscode.Uri, prism_ln_css: vscode.Uri, prism_ln_script: vscode.Uri, prism_nasm_script: vscode.Uri) {
    //const html = readFileSync(path.join(context_path, 'src/web_view/views/dst_code.html')).toString();
    //return eval('`' + html + '`');
    const style = `
    <style>
      .line-number {
        float: left;
        margin-right: 20px;
        color: #CB3535; /* Line number color */
      }
    </style>
  `;
    const html =
    `<!doctype html>
    <html>
    <head>
      ${style}
        <script type="module" src=${script}></script>
        <link rel="stylesheet" href=${index_css}>
        <script type="module" src=${prism_script}></script>
        <link rel="stylesheet" href=${prism_css}>
        <script type="module" src=${prism_nasm_script}></script>
        <script>
          function zoomIn() {
            var content = document.getElementById("content");
            var zoom = document.getElementById("zoom_percent");
            var currentZoom = parseFloat(content.style.zoom) || 1;
            content.style.zoom = currentZoom + 0.25;
            zoom.innerHTML=JSON.stringify((currentZoom+0.25)*100)+"%";
          }

          function zoomOut() {
            var content = document.getElementById("content");
            var zoom = document.getElementById("zoom_percent");
            var currentZoom = parseFloat(content.style.zoom) || 1;
            if(Math.abs(currentZoom - 0.25) > 1e-9){
              content.style.zoom = currentZoom - 0.25;
              zoom.innerHTML=JSON.stringify((currentZoom-0.25)*100)+"%";
            }
          }

        </script>
    </head>
    <body class="full-view">
        <div class="zoom-button">
          <button onclick="zoomIn()">+</button>
          <span id = "zoom_percent">100%</span>
          <button onclick="zoomOut()">-</button>
        </div>
        <div id="content">
            <div class="code-container" style="display:block;">
                <pre id="pre-code"><code id="code" class="language-clike"></code></pre>
            </div>
            <canvas id="canvas" style="position: absolute;"></canvas>
        </div>
    </body>
    </html>`;
    return eval('`' + html + '`');
  }

  panel_set_html(panel, html)
  {
    if (panel !== undefined) {
      panel.webview.html = html;
    }
  }

  panel_post_message(panel, msg)
  {
    if (panel !== undefined) {
      panel.webview.postMessage(msg);
    }
  }

  set_proof_panels_to_undef_if_all_disposed()
  {
    if (this.proof_panels === undefined) {
      return;
    }
    if (this.proof_panels.prd !== undefined) {
      return;
    }
    if (this.proof_panels.src_code !== undefined) {
      return;
    }
    if (this.proof_panels.dst_code !== undefined) {
      return;
    }
    if (this.proof_panels.src_ir !== undefined) {
      return;
    }
    if (this.proof_panels.dst_ir !== undefined) {
      return;
    }
    this.proof_panels = undefined;
  }


  async sendPanelClosedMessage(){
    const request =
        { type: 'panelIsclosed',
        };
    EqcheckViewProvider.provider.viewProviderPostMessage(request);
  }
  async sendAllPanelsClosedMessage(){
    const request =
        { type: 'allPanelsAreclosed',
        };
    EqcheckViewProvider.provider.viewProviderPostMessage(request);
  }
  async sendClosedMessage(){
    if(this.proof_panels === undefined){
      this.sendAllPanelsClosedMessage();
    }
    else{
      this.sendPanelClosedMessage();
    }
  }

  getPanels(enable_panel_prd, src_ir, dst_ir) {
    const proof_panels = this.proof_panels;
    var panel_prd, panel_src_code, panel_dst_code, panel_src_ir, panel_dst_ir;

    //vscode.window.showInformationMessage(`eqcheckViewProof received. proof ${JSON.stringify(proof)}`);
    if (enable_panel_prd) {
      if (proof_panels === undefined || proof_panels.prd=== undefined) {
        panel_prd =
          vscode.window.createWebviewPanel(
              'productCFG',
              'Product Control Flow Graph',
              vscode.ViewColumn.Two,
              {
                enableScripts: true,
                retainContextWhenHidden: true
              }
          );
        panel_prd.onDidDispose(
          () => {
            this.proof_panels.prd = undefined;
            this.set_proof_panels_to_undef_if_all_disposed()
            this.sendClosedMessage();
          },
          null,
          Eqchecker.context.subscriptions
        );
      } else {
        panel_prd = proof_panels.prd;
      }
    }
    if (proof_panels === undefined || proof_panels.src_code === undefined) {
      panel_src_code =
        vscode.window.createWebviewPanel(
          'src_code',
          'Source Code',
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true
          }
        );
        panel_src_code.onDidDispose(
          () => {
            this.proof_panels.src_code = undefined;
            this.set_proof_panels_to_undef_if_all_disposed()
            this.sendClosedMessage();
          },
          null,
          Eqchecker.context.subscriptions
        );
    } else {
      panel_src_code = proof_panels.src_code;
    }
    if (proof_panels === undefined || proof_panels.dst_code === undefined) {
      panel_dst_code =
        vscode.window.createWebviewPanel(
          'dst_code',
          'Destination Code',
          (dst_ir === undefined) ? vscode.ViewColumn.Three: vscode.ViewColumn.Four,
          {
            enableScripts: true,
            retainContextWhenHidden: true
          }
        );
        panel_dst_code.onDidDispose(
          () => {
            this.proof_panels.dst_code = undefined;
            this.set_proof_panels_to_undef_if_all_disposed();
            this.sendClosedMessage();
          },
          null,
          Eqchecker.context.subscriptions
        );

    } else {
      panel_dst_code = proof_panels.dst_code;
    }
    if (src_ir !== undefined) {
      if (proof_panels === undefined || proof_panels.src_ir === undefined) {
        panel_src_ir = undefined;
        //panel_src_ir =
        //  vscode.window.createWebviewPanel(
        //    'src_ir',
        //    'Source IR',
        //    vscode.ViewColumn.Two,
        //    {
        //      enableScripts: true,
        //      retainContextWhenHidden: true
        //    }
        //  );
        //panel_src_ir.onDidDispose(
        //  () => {
        //    this.proof_panels.panel_src_ir = undefined;
        //    this.set_proof_panels_to_undef_if_all_disposed();
        //  },
        //  null,
        //  Eqchecker.context.subscriptions
        //);
      } else {
        panel_src_ir = proof_panels.src_ir;
      }
    }
    if (dst_ir !== undefined) {
      if (proof_panels === undefined || proof_panels.dst_ir === undefined) {
        panel_dst_ir = undefined;
        //panel_dst_ir =
        //  vscode.window.createWebviewPanel(
        //    'dst_ir',
        //    'Destination IR',
        //    vscode.ViewColumn.Four,
        //    {
        //      enableScripts: true,
        //      retainContextWhenHidden: true
        //    }
        //  );
        //panel_dst_ir.onDidDispose(
        //  () => {
        //    this.proof_panels.panel_dst_ir = undefined;
        //    this.set_proof_panels_to_undef_if_all_disposed();
        //  },
        //  null,
        //  Eqchecker.context.subscriptions
        //);
      } else {
        panel_dst_ir = proof_panels.dst_ir;
      }
    }
    return [panel_prd, panel_src_code, panel_dst_code, panel_src_ir, panel_dst_ir];
  }

  async viewProductCFG(webview: vscode.Webview, dirPath: string, correl_entry_filename: string)
  {
    const proof_panels = this.proof_panels;
    const proof_response = await Eqchecker.obtainProofFromServer(dirPath, correl_entry_filename);
    //console.log(`proof_response= ${JSON.stringify(proof_response)}\n`);
    //console.log(`proof_response.src_code = ${JSON.stringify(proof_response.src_code)}\n`);
    const src_code = proof_response.src_code;
    //console.log(`src_code = ${src_code}\n`);
    const dst_code = proof_response.dst_code;
    const src_ir = (proof_response.src_ir === undefined) ? undefined : proof_response.src_ir;
    const dst_ir = (proof_response.dst_ir === undefined) ? undefined : proof_response.dst_ir;
    const src_vir = (proof_response.src_vir === undefined) ? undefined : proof_response.src_vir;
    const dst_vir = (proof_response.dst_vir === undefined) ? undefined : proof_response.dst_vir;
    //console.log("eqcheckViewProof src_ir = ", src_ir);
    const correl_entry = proof_response["proof"]["correl_entry"];
    //console.log("eqcheckViewProof correl_entry = ", JSON.stringify(correl_entry));
    const graph_hierarchy = correl_entry["cg"];
    const corr_graph = graph_hierarchy["corr_graph"];
    const src_tfg = corr_graph["src_tfg"];
    const dst_tfg = corr_graph["dst_tfg"];

    const eqcheck_info = corr_graph["eqcheck_info"];
    const dst_assembly = eqcheck_info["dst_assembly_with_pcs"];

    const src_tfg_llvm = src_tfg["tfg_llvm"];

    const dst_tfg_llvm = dst_tfg["tfg_llvm"];
    const dst_tfg_asm = dst_tfg["tfg_asm"];

    const [src_subprogram_info, src_ir_subprogram_info] = Eqchecker.tfg_llvm_obtain_subprogram_info(src_tfg_llvm);
    var dst_subprogram_info, dst_ir_subprogram_info;
    if (dst_tfg_llvm === undefined) {
      dst_subprogram_info = Eqchecker.tfg_asm_obtain_subprogram_info(dst_tfg_asm, dst_assembly);
    } else {
      [dst_subprogram_info, dst_ir_subprogram_info] = Eqchecker.tfg_llvm_obtain_subprogram_info(dst_tfg_llvm);
    }

    const [panel_prd, panel_src_code, panel_dst_code, panel_src_ir, panel_dst_ir] = this.getPanels(true, src_ir, dst_ir);

    const index_css = webview.asWebviewUri(
      vscode.Uri.joinPath(Eqchecker.extensionUri, 'media/viewProof/css/index.css')
    );
    const product_script = webview.asWebviewUri(vscode.Uri.joinPath(Eqchecker.extensionUri, 'media/viewProof/scripts/product.js'));
    const prism = webview.asWebviewUri(vscode.Uri.joinPath(Eqchecker.extensionUri, 'node_modules/prismjs/prism.js'));
    const prism_css = webview.asWebviewUri(vscode.Uri.joinPath(Eqchecker.extensionUri, 'node_modules/prismjs/themes/prism.css'));
    const prism_ln_css = webview.asWebviewUri(vscode.Uri.joinPath(Eqchecker.extensionUri, 'node_modules/prismjs/plugins/line-numbers/prism-line-numbers.css'));
    const prism_ln_script = webview.asWebviewUri(vscode.Uri.joinPath(Eqchecker.extensionUri, 'node_modules/prismjs/plugins/line-numbers/prism-line-numbers.js'));
    const prism_nasm_script = webview.asWebviewUri(vscode.Uri.joinPath(Eqchecker.extensionUri, 'node_modules/prismjs/components/prism-nasm.min.js'));
    //const highlight_script = webview.asWebviewUri(vscode.Uri.joinPath(Eqchecker.extensionUri, 'node_modules/highlight.js/lib/index.js'));
    const src_code_script = webview.asWebviewUri(vscode.Uri.joinPath(Eqchecker.extensionUri, 'media/viewProof/scripts/src_code.js'));
    //const src_ir_script = webview.asWebviewUri(vscode.Uri.joinPath(Eqchecker.extensionUri, 'media/viewProof/scripts/src_code.js'));
    //const dst_code_script = webview.asWebviewUri(vscode.Uri.joinPath(Eqchecker.extensionUri, 'media/viewProof/scripts/dst_code.js'));
    const dst_code_script = webview.asWebviewUri(vscode.Uri.joinPath(Eqchecker.extensionUri, 'media/viewProof/scripts/src_code.js'));
    //const dst_ir_script = webview.asWebviewUri(vscode.Uri.joinPath(Eqchecker.extensionUri, 'media/viewProof/scripts/src_code.js'));
    const prod_source_js = webview.asWebviewUri(vscode.Uri.joinPath(Eqchecker.extensionUri, 'media/viewProof/scripts/product.js'));
    const d3_v5_min_js = webview.asWebviewUri(vscode.Uri.joinPath(Eqchecker.extensionUri, 'node_modules/d3/dist/d3.js'));
    const index_min_js = webview.asWebviewUri(vscode.Uri.joinPath(Eqchecker.extensionUri, 'node_modules/@hpcc-js/wasm/dist/index.min.js'));
    const d3_graphviz_js = webview.asWebviewUri(vscode.Uri.joinPath(Eqchecker.extensionUri, 'node_modules/d3-graphviz/build/d3-graphviz.js'));

    // Set the webview content

    this.panel_set_html(panel_prd, EqcheckViewProvider.getProductWebviewContent(Eqchecker.extensionUri.fsPath, product_script, index_css, prod_source_js, d3_v5_min_js, index_min_js, d3_graphviz_js));
    this.panel_set_html(panel_src_code, EqcheckViewProvider.getSourceCodeWebviewContent(Eqchecker.extensionUri.fsPath, src_code_script, index_css, prism, prism_css, prism_ln_css, prism_ln_script, prism_nasm_script));
    this.panel_set_html(panel_dst_code, EqcheckViewProvider.getAssemblyCodeWebviewContent(Eqchecker.extensionUri.fsPath, dst_code_script, index_css, prism, prism_css, prism_ln_css, prism_ln_script, prism_nasm_script));

    //if (src_ir !== undefined) {
    //  this.panel_set_html(panel_src_ir, EqcheckViewProvider.getSourceCodeWebviewContent(Eqchecker.extensionUri.fsPath, src_ir_script, index_css, prism, prism_css, prism_ln_css, prism_ln_script, prism_nasm_script));
    //}
    //if (dst_ir !== undefined) {
    //  this.panel_set_html(panel_dst_ir, EqcheckViewProvider.getAssemblyCodeWebviewContent(Eqchecker.extensionUri.fsPath, dst_ir_script, index_css, prism, prism_css, prism_ln_css, prism_ln_script, prism_nasm_script));
    //}
    let panel_prd_loaded = false;
    let panel_src_code_loaded = false;
    let panel_dst_code_loaded = false;
    //let panel_src_ir_loaded = (panel_src_ir === undefined);
    //let panel_dst_ir_loaded = (panel_dst_ir === undefined);

    // Handle messages from the webview
    if (panel_prd !== undefined) {
      panel_prd.webview.onDidReceiveMessage(
        message => {
          switch (message.command) {
            case 'loaded':
              //console.log("product-CFG panel loaded.\n");
              panel_prd_loaded = true;
              //vscode.window.showErrorMessage(message.text);
              break;
            case "highlight":
              this.panel_post_message(panel_src_code, {
                command: "highlight",
                path: message.edge.src_edge,
                tfg: message.src_tfg,
                eqcheck_info: message.eqcheck_info,
                srcdst: "src",
                codetype: "code"
                //subprogram_info: message.src_subprogram_info,
                //nodeMap: message.src_nodeMap
              });
              this.panel_post_message(panel_src_ir, {
                command: "highlight",
                path: message.edge.src_edge,
                tfg: message.src_tfg,
                eqcheck_info: message.eqcheck_info,
                srcdst: "src",
                codetype: "ir"
                //subprogram_info: message.src_ir_subprogram_info,
                //nodeMap: message.src_ir_nodeMap
              });
              this.panel_post_message(panel_dst_code, {
                command: "highlight",
                path: message.edge.dst_edge,
                tfg: message.dst_tfg,
                eqcheck_info: message.eqcheck_info,
                srcdst: "dst",
                codetype: "code"
                //subprogram_info: message.dst_subprogram_info,
                //nodeMap: message.dst_nodeMap
              });
              this.panel_post_message(panel_dst_ir, {
                  command: "highlight",
                  path: message.edge.dst_edge,
                  tfg: message.dst_tfg,
                  eqcheck_info: message.eqcheck_info,
                  srcdst: "dst",
                  codetype: "ir"
                  //subprogram_info: message.dst_ir_subprogram_info,
                  //nodeMap: message.dst_ir_nodeMap
              });
              break;
            case "clear":
              this.panel_post_message(panel_src_code, {
                command: "clear"
              });
              this.panel_post_message(panel_src_ir, {
                command: "clear"
              });
              this.panel_post_message(panel_dst_code, {
                command: "clear"
              });
              this.panel_post_message(panel_dst_ir, {
                command: "clear"
              });
              break;
            default:
              break;
          }
        },
        undefined,
        Eqchecker.context.subscriptions
      );
    }
    //if (panel_src_ir !== undefined) {
    //  panel_src_ir.webview.onDidReceiveMessage(
    //    message => {
    //      switch (message.command) {
    //        case 'loaded':
    //          console.log("src-ir panel loaded.\n");
    //          panel_src_ir_loaded = true;
    //          //vscode.window.showErrorMessage(message.text);
    //          break;
    //      }
    //    },
    //    undefined,
    //    Eqchecker.context.subscriptions
    //  );
    //}


    if (panel_src_code !== undefined) {
      // Handle messages from the webview
      panel_src_code.webview.onDidReceiveMessage(
        message => {
          switch (message.command) {
            case 'loaded':
              //console.log("src-code panel loaded.\n");
              panel_src_code_loaded = true;
              //vscode.window.showErrorMessage(message.text);
              break;
          }
        },
        undefined,
        Eqchecker.context.subscriptions
      );
    }
    //if (panel_dst_ir !== undefined) {
    //  panel_dst_ir.webview.onDidReceiveMessage(
    //    message => {
    //      switch (message.command) {
    //        case 'loaded':
    //          //console.log("dst-ir panel loaded.\n");
    //          panel_dst_ir_loaded = true;
    //          //vscode.window.showErrorMessage(message.text);
    //          break;
    //      }
    //    },
    //    undefined,
    //    Eqchecker.context.subscriptions
    //  );
    //}

    if (panel_dst_code !== undefined) {
      panel_dst_code.webview.onDidReceiveMessage(
        message => {
          switch (message.command) {
            case 'loaded':
              //console.log("dst-code panel loaded.\n");
              panel_dst_code_loaded = true;
              //vscode.window.showErrorMessage(message.text);
              break;
          }
        },
        undefined,
        Eqchecker.context.subscriptions
      );
    }

    if (proof_panels !== undefined) {
      this.panel_post_message(panel_prd, {command: 'load'});
      this.panel_post_message(panel_src_code, {command: 'load'});
      //this.panel_post_message(panel_src_ir, {command: 'load'});
      this.panel_post_message(panel_dst_code, {command: 'load'});
      //this.panel_post_message(panel_dst_ir, {command: 'load'});
    } // otherwise the panels would have been freshly created and would have posted the "loaded" message anyway

    async function waitForLoading(){
      while (panel_prd_loaded === false || panel_src_code_loaded === false || panel_dst_code_loaded === false/* || panel_src_ir_loaded === false || panel_dst_ir_loaded === false*/) {
          //console.log(`panel_{prd,src_code,dst_code}_loaded ${panel_prd_loaded} ${panel_src_code_loaded} ${panel_dst_code_loaded} is still false`);
          await Eqchecker.wait(1000);
      }
    }
    await waitForLoading();
    // Message passing to src and dst webview
    //console.log(`Panels loaded. Posting proof to panel_prd.\n`);
    this.panel_post_message(panel_prd, {command: 'showProof', code: correl_entry});
    //console.log("Posted proof to panel_prd\n");

    const src_ec = correl_entry["src_ec"];
    const dst_ec = correl_entry["dst_ec"];

    //console.log("Posting src_code to panel_src_code. src_code = \n" + src_code);
    this.panel_post_message(panel_src_code, {command: "data", code:src_code, ir: src_ir, src_vir: src_vir, syntax_type: "c/llvm", path: src_ec, tfg: src_tfg, eqcheck_info: eqcheck_info, srcdst: "src"/*, codetype: "code"*/});

    //console.log("Posting src_ir to panel_src_ir. src_ir = \n" + src_ir);
    //this.panel_post_message(panel_src_ir, {command: "data", code:src_ir, syntax_type: "c/llvm", path: src_ec, tfg: src_tfg, eqcheck_info: eqcheck_info, srcdst: "src", codetype: "ir"});

    if (dst_assembly === "") {
      this.panel_post_message(panel_dst_code, {command: "data", code:dst_code, ir: dst_ir, syntax_type: "c/llvm", path: dst_ec, tfg: dst_tfg, eqcheck_info: eqcheck_info,  dst_vir: dst_vir, srcdst: "dst"/*, codetype: "code"*/});
      //this.panel_post_message(panel_dst_ir, {command: "data", code:dst_ir, syntax_type: "c/llvm", path: dst_ec, tfg: dst_tfg, eqcheck_info: eqcheck_info, srcdst: "dst", codetype: "ir"});
    } else {
      this.panel_post_message(panel_dst_code, {command: "data", code:dst_assembly, syntax_type: "asm", path: dst_ec, tfg: dst_tfg, eqcheck_info: eqcheck_info, srcdst: "dst", dst_vir: dst_vir, codetype: "code"});
    }
    this.proof_panels = { prd: panel_prd, src_code: panel_src_code, src_ir: panel_src_ir, dst_code: panel_dst_code, dst_ir: panel_dst_ir };
    //console.log(`eqcheckViewProof: new_panels = ${JSON.stringify(new_panels)}\n`);
    //return new_panels;
  }

  async viewScanReport(webview: vscode.Webview, dirPath: string, filename: string) {
    if (this.scanview_panel !== undefined) {
      this.scanview_panel.dispose();
    }
    this.scanview_panel =
        vscode.window.createWebviewPanel(
            'codeAnalysis',
            'CodeAnalysis',
            vscode.ViewColumn.One,
            {
              enableScripts: true,
              retainContextWhenHidden: true
            }
        );
    this.scanview_panel.onDidDispose(
      () => {
        this.scanview_panel = undefined;
      },
      null,
      Eqchecker.context.subscriptions
    );

    this.scanview_panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'linkClicked':
            console.log(`linkClicked received on dirPath ${message.dirPath} filename ${message.filename}`);
            var filename = message.filename;
            var hash = "";
            if (filename !== undefined) {
              const hashChar = filename.lastIndexOf('#');
              console.log(`hashChar = ${hashChar}`);
              if (hashChar != -1) {
                filename = filename.substr(0, hashChar);
                hash = filename.substr(hashChar + 1);
                console.log(`filename = ${filename}, hash = ${hash}`);
              }
            } else {
             console.log("filename is undefined");
            }
            if (filename == "") {
              if (hash != "") {
                //var element_to_scroll_to = document.getElementById(hash);
                //element_to_scroll_to.scrollIntoView();
                console.log(`Warning: filename is empty and hash is ${hash}`);
              } else {
                console.log("Warning: both filename and hash are empty");
              }
            } else {
              await this.viewScanReport(webview, message.dirPath, filename);
            }
            break;
          default:
            break;
        }
      },
      undefined,
      Eqchecker.context.subscriptions
    );

    const scanview_report_response = await Eqchecker.obtainScanviewReportFromServer(dirPath, filename);
    const scanview_report = scanview_report_response.scanview_report;

    //console.log(`scanview_report = ${scanview_report}`);
    //console.log(`scanview_report = ${JSON.stringify(scanview_report)}`);
    //console.log(`scanview_report = ${scanview_report.toString()}`);
    this.panel_set_html(this.scanview_panel, scanview_report);


    //const scanview_css = webview.asWebviewUri(
    //  vscode.Uri.joinPath(Eqchecker.extensionUri, 'media/scanview.css')
    //);
    //const scanview_script = webview.asWebviewUri(vscode.Uri.joinPath(Eqchecker.extensionUri, 'media/scanview.js'));
    //this.panel_set_html(this.scanview_panel, EqcheckViewProvider.getScanviewWebviewContent(Eqchecker.extensionUri.fsPath, scanview_script, scanview_css));

    //var scanview_panel_loaded = false;
    //this.scanview_panel.webview.onDidReceiveMessage(
    //  message => {
    //    switch (message.command) {
    //      case 'loaded':
    //        //console.log("scanview panel loaded.\n");
    //        scanview_panel_loaded = true;
    //        //vscode.window.showErrorMessage(message.text);
    //        break;
    //    }
    //  },
    //  undefined,
    //  Eqchecker.context.subscriptions
    //);

    //async function waitForScanviewLoad(){
    //  while (scanview_panel_loaded === false) {
    //      //console.log(`scanview_panel_loaded ${scanview_panel_loaded} is still false`);
    //      await Eqchecker.wait(1000);
    //  }
    //}
    //await waitForScanviewLoad();

    //this.panel_set_html(this.scanview_panel, scanview_report);
    //this.panel_post_message(this.scanview_panel, {command: 'scanviewReport', url: scanview_url.scanview_report_url});
  }

  async checkLoginAtServer(loginName)
  {
    const jsonRequest = JSON.stringify({serverCommand: commandCheckLogin, loginName: loginName});
    var response = (await Eqchecker.RequestResponseForCommand(jsonRequest));
    if (response.expectedOTP !== undefined) {
      var otp;
      const options: vscode.InputBoxOptions = {
        prompt: `Enter the OTP sent to ${loginName}: `,
        placeHolder: "4-digit number",
        ignoreFocusOut: true
      };
      await vscode.window.showInputBox(options).then(async ea => {
        if (!ea) return;
        otp = ea;
      });
      if (otp != response.expectedOTP) {
        response.success = undefined;
      }
    }
    return response;
  }

  async authenticateLogin()
  {
    var loginName;
    var quotaRemaining;
    const options: vscode.InputBoxOptions = {
      prompt: "Enter your email address",
      placeHolder: "OTP will be sent to this email address",
      ignoreFocusOut: true
    };
    await vscode.window.showInputBox(options).then(async ea => {
      if (!ea) return;
      loginName = ea.toLowerCase();
    });
    if (loginName !== undefined) {
      const response = await this.checkLoginAtServer(loginName);
      if (response.success === undefined) {
        const msg = `Login ${loginName} was unsuccessful`;
        vscode.window.showInformationMessage(msg);
        loginName = undefined;
      } else if (response.quotaRemaining === undefined || response.quotaRemaining <= 0) {
        const msg = `${loginName} has exceeeded its quota of eqchecks`;
        vscode.window.showInformationMessage(msg);
      }
      quotaRemaining = response.quotaRemaining;
    }
    return {currentUser: loginName, quotaRemaining: quotaRemaining};
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    //console.log("resolveWebviewView() called\n");
    this._view = webviewView;
    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      localResourceRoots: [
        this._extensionUri
      ]
    };
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'registerLogin': {
          Eqchecker.setLoginName(data.currentUser);
          break;
        }
        case 'authenticateLogin': {
          const {currentUser: currentUser, quotaRemaining: quotaRemaining} = await this.authenticateLogin();
          if (currentUser !== undefined) {
            Eqchecker.setLoginName(currentUser);
            var viewRequest =
              { type: 'loginAuthenticated',
                currentUser: currentUser,
                quotaRemaining: quotaRemaining,
              };
            EqcheckViewProvider.provider.viewProviderPostMessage(viewRequest);
          }
          break;
        }
        case 'eqcheckViewProof': {
          //console.log(`ViewProof received\n`);
          //console.log(`data.eqcheck = ${JSON.stringify(data.eqcheck)}`);
          //console.log(`source1Text = ${JSON.stringify(data.eqcheck.source1Text)}\n`);
          //const source1Str = Eqchecker.Text2String(data.eqcheck.source1Text);
          //const source2Str = Eqchecker.Text2String(data.eqcheck.source2Text);
          console.log(JSON.stringify(data.eqcheck));
          await this.viewProductCFG(webviewView.webview, data.eqcheck.dirPath, undefined);  
          // [HACK] Call viewProductCFG twice to fix click/hover bug
          await this.viewProductCFG(webviewView.webview, data.eqcheck.dirPath, undefined);
          // [HACK] Call viewProductCFG twice to fix click/hover bug
          await this.viewProductCFG(webviewView.webview, data.eqcheck.dirPath, undefined);
          //console.log(`new_panels = ${JSON.stringify(new_panels)}\n`);

          //this.proof_panels = new_panels;
          //console.log(`ViewProof received. data.eqcheck.dirPath = ${data.eqcheck.dirPath}\n`);
          //console.log(`ViewProof received. this.panels = ${JSON.stringify(this.panels)}\n`);
          break;
        }
        case 'eqcheckHideProof': {
          //console.log(`HideProof received. data.eqcheck.dirPath = ${data.eqcheck.dirPath}\n`);
          //console.log(`HideProof received. this.panels = ${JSON.stringify(this.panels)}\n`);
          //console.log(`HideProof received. this.panels[data.eqcheck.dirPath].length = ${this.panels[data.eqcheck.dirPath].length}\n`);
          const panel = this.proof_panels;
          if (panel !== undefined) {
            panel.prd.dispose();
            panel.src_code.dispose();
            panel.dst_code.dispose();
            if (panel.src_ir !== undefined) {
              panel.src_ir.dispose();
            }
            if (panel.dst_ir !== undefined) {
              panel.dst_ir.dispose();
            }
            this.proof_panels = undefined;
          }
          break;
        }
        case 'eqcheckViewScanReport': {
          console.log(`viewScanReport received with dirPath ${data.dirPath} filename ${data.filename}`);
          await this.viewScanReport(webviewView.webview, data.dirPath + "/..", data.filename);
          break;
        }
        case 'eqchecksLoaded': {
          console.log(`eqchecksLoaded received\n`);
          var eqcheckRequestPromises = [];
          const eqchecks = data.eqchecks;
          const loginName = data.loginName;
          Eqchecker.setLoginNameIfUndefined(loginName);
          console.log(`eqchecks =\n${JSON.stringify(eqchecks)}\n`);
          for (var i = 0; i < eqchecks.length; i++) {
            const eqcheck = eqchecks[i];

            if (Eqchecker.eqcheckHasFinishedExecuting(eqcheck)) {
              continue;
            }

            const request = { dirPath: eqcheck.dirPath, dirPathIn: eqcheck.dirPath, source1Uri: eqcheck.source1Uri, source1Name: eqcheck.source1Name, source1Text: eqcheck.source1Text, source2Uri: eqcheck.source2Uri, source2Name: eqcheck.source2Name, source2Text: eqcheck.source2Text, functionName: eqcheck.functionName, prepareDirpath: eqcheck.prepareDirpath, pointsToDirpath: eqcheck.pointsToDirpath, runDirpath: eqcheck.runDirpath, source1: eqcheck.source1, src_bc: eqcheck.src_bc, src_ir: eqcheck.src_ir, src_etfg: eqcheck.src_etfg, source2: eqcheck.source2, dst_bc: eqcheck.dst_bc, dst_ir: eqcheck.dst_ir, dst_etfg: eqcheck.dst_etfg };

            //console.log(`eqcheck =\n${JSON.stringify(eqcheck)}\n`);
            //console.log(`eqcheck.runState =${eqcheck.runState}\n`);
            if (eqcheck.dirPath !== undefined) {
              Eqchecker.statusMap[eqcheck.dirPath] = statusEqcheckPinging;
            }
            console.log(`eqcheck.dirPath = ${eqcheck.dirPath}\n`);
            console.log(`eqcheck.pointsToDirpath = ${eqcheck.pointsToDirpath}\n`);
            console.log(`eqcheck.prepareDirpath = ${eqcheck.prepareDirpath}\n`);
            if (eqcheck.dirPath !== undefined && eqcheck.dirPath !== eqcheck.pointsToDirpath && eqcheck.dirPath !== eqcheck.prepareDirpath) {
              //do the run
              console.log(`Submitting run command for ${eqcheck.dirPath}\n`);
              Eqchecker.submitRunCommand(request);
            } else if (eqcheck.pointsToDirpath !== undefined) {
              //do the points-to followed by run
              console.log(`Submitting pointsTo command for ${eqcheck.dirPath}\n`);
              Eqchecker.submitPointsToCommand(request);
            } else {
              //do the prepare followed by points-to followed by run
              console.log(`Submitting Prepare command for ${eqcheck.dirPath}\n`);
              Eqchecker.submitPrepareCommand(request);
            }
          }
          //console.log(`eqcheckRequestPromises.length = ${eqcheckRequestPromises.length}`);
          Promise.all(eqcheckRequestPromises);
          break;
        }
        case 'startEqcheck': {
          //console.log(`startEqcheck received\n`);
          Eqchecker.checkEq();
          break;
        }
        case 'eqcheckCancel': {
          //console.log(`eqcheckCancel received\n`);
          await Eqchecker.eqcheckCancel(webviewView.webview, data.eqcheck.dirPath);
          break;
        }
        case 'eqcheckClear': {
          if (data.eqcheck === undefined || data.eqcheck.dirPath === Eqchecker.searchTreeDirPath) {
            //console.log(`data = ${JSON.stringify(data)}`);
            Eqchecker.searchTree = undefined;
            Eqchecker.searchTreeNodes = undefined;
            Eqchecker.searchTreeDirPath = undefined;
            Eqchecker.searchTreeDataProvider = aNodeWithIdTreeDataProvider(webviewView.webview, data.eqcheck.dirPath);
            Eqchecker.searchTreeView = vscode.window.createTreeView('eqchecker.searchTreeView', { treeDataProvider: Eqchecker.searchTreeDataProvider, showCollapseAll: true });
          }
          break;
        }
        case 'eqcheckViewSearchTree': {
          console.log('viewSearchTree received');
          const cgs_enumerated = await Eqchecker.obtainSearchTreeFromServer(data.eqcheck.dirPath);
          const { searchTree: searchTree, searchTreeNodes: searchTreeNodes } = Eqchecker.cgs_enumerated_to_search_tree(cgs_enumerated);
          //console.log(`searchTree =\n${searchTree}\n`);
          Eqchecker.searchTree = searchTree;
          Eqchecker.searchTreeNodes = searchTreeNodes;
          Eqchecker.searchTreeDirPath = data.eqcheck.dirPath;
          //if (Eqchecker.searchTreeView !== undefined) {
          //  console.log('searchTreeView already exists');
          //  Eqchecker.searchTreeView.dispose();
          //}
          Eqchecker.searchTreeDataProvider = aNodeWithIdTreeDataProvider(webviewView.webview, data.eqcheck.dirPath);
          Eqchecker.searchTreeView = vscode.window.createTreeView('eqchecker.searchTreeView', { treeDataProvider: Eqchecker.searchTreeDataProvider, showCollapseAll: true });
          Eqchecker.context.subscriptions.push(Eqchecker.searchTreeView);
          console.log('searchTreeView created');
          break;
        }
        case 'saveSession': {
          console.log('saveSession received')
          let options: vscode.InputBoxOptions = {
            prompt: "Session Name: ",
            placeHolder: "Session name to save"
          };
          vscode.window.showInputBox(options).then(async sessionName => {
            if (!sessionName) return;
            const jsonRequest = JSON.stringify({serverCommand: commandSaveSession, sessionName: sessionName, eqchecks: data.eqchecks});
            const response = (await Eqchecker.RequestResponseForCommand(jsonRequest));
            if (response.done !== false) {
              const msg = `Session ${sessionName} saved.`;
              vscode.window.showInformationMessage(msg);
            } else {
              const msg = `Failed to save ${sessionName}.`;
              vscode.window.showInformationMessage(msg);
            }
          });
          break;
        }
        case 'loadSession': {
          console.log('loadSession received')
          let options: vscode.InputBoxOptions = {
            prompt: "Session Name: ",
            placeHolder: "Session name to load"
          };
          vscode.window.showInputBox(options).then(async sessionName => {
            if (!sessionName) return;
            const jsonRequest = JSON.stringify({serverCommand: commandLoadSession, sessionName: sessionName});
            const response = (await Eqchecker.RequestResponseForCommand(jsonRequest));
            if (response.eqchecks !== undefined) {
              const eqchecks = response.eqchecks;
              console.log(`eqchecks.length = ${eqchecks.length}`);
              var viewRequest =
                { type: 'loadEqchecks',
                  eqchecks: eqchecks,
                };
              EqcheckViewProvider.provider.viewProviderPostMessage(viewRequest);
            } else {
              const msg = `Failed to load ${sessionName}.`;
              vscode.window.showInformationMessage(msg);
            }
          });
          break;
        }
        default: {
          console.log('Unknown message received from webview: ' + data.type)
        }
      }
    });
  }

  public viewProviderPostMessage(message)
  {
    if (this._view) {
     this._view.show?.(true); // `show` is not implemented in 1.49 but is for 1.50 insiders
     //console.log("Posting message.");
     this._view.webview.postMessage(
        message,
      );
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    //console.log("_getHtmlForWebview() called\n");
    // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
    const mainScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
    // Do the same for the stylesheet.
    const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
    const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
    const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));
    // Use a nonce to only allow a specific script to be run.
    const nonce = getNonce();
    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <!--
          Use a content security policy to only allow loading styles from our extension directory,
          and only allow scripts that have a specific nonce.
          (See the 'webview-sample' extension sample for img-src content security policy examples)
        -->
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleResetUri}" rel="stylesheet">
        <link href="${styleVSCodeUri}" rel="stylesheet">
        <link href="${styleMainUri}" rel="stylesheet">
        <title>Equivalence Checks</title>
      </head>
      <body>
        <button class="clear-eqchecks-button"></button>
        <div id="start-button-right-click-menu">
        <div id="StartButtonRightClickMenuItem0" class="item"></div>
        <div id="StartButtonRightClickMenuItem1" class="item"></div>
        <div id="StartButtonRightClickMenuItem2" class="item"></div>
        <div id="StartButtonRightClickMenuItem3" class="item"></div>
        <div id="StartButtonRightClickMenuItem4" class="item"></div>
        </div>
        <hr>
        <ul class="eqcheck-list">
        </ul>
        <div id="eqcheck-right-click-menu" eqcheck="eqcheck-none">
        <div id="EqcheckRightClickMenuItem1" class="item"></div>
        <div id="EqcheckRightClickMenuItem2" class="item"></div>
        <div id="EqcheckRightClickMenuItem3" class="item"></div>
        <div id="EqcheckRightClickMenuItem4" class="item"></div>
        <div id="EqcheckRightClickMenuItem5" class="item"></div>
        </div>
        <script nonce="${nonce}" src="${mainScriptUri}"></script>
      </body>
      </html>`;
  }
}

function assertPath(path) {
  if (typeof path !== 'string') {
    throw new TypeError('Path must be a string. Received ' + JSON.stringify(path));
  }
}

// Resolves . and .. elements in a path with directory names
function normalizeStringPosix(path, allowAboveRoot) {
  var res = '';
  var lastSegmentLength = 0;
  var lastSlash = -1;
  var dots = 0;
  var code;
  for (var i = 0; i <= path.length; ++i) {
    if (i < path.length)
      code = path.charCodeAt(i);
    else if (code === 47 /*/*/)
      break;
    else
      code = 47 /*/*/;
    if (code === 47 /*/*/) {
      if (lastSlash === i - 1 || dots === 1) {
        // NOOP
      } else if (lastSlash !== i - 1 && dots === 2) {
        if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== 46 /*.*/ || res.charCodeAt(res.length - 2) !== 46 /*.*/) {
          if (res.length > 2) {
            var lastSlashIndex = res.lastIndexOf('/');
            if (lastSlashIndex !== res.length - 1) {
              if (lastSlashIndex === -1) {
                res = '';
                lastSegmentLength = 0;
              } else {
                res = res.slice(0, lastSlashIndex);
                lastSegmentLength = res.length - 1 - res.lastIndexOf('/');
              }
              lastSlash = i;
              dots = 0;
              continue;
            }
          } else if (res.length === 2 || res.length === 1) {
            res = '';
            lastSegmentLength = 0;
            lastSlash = i;
            dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          if (res.length > 0)
            res += '/..';
          else
            res = '..';
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0)
          res += '/' + path.slice(lastSlash + 1, i);
        else
          res = path.slice(lastSlash + 1, i);
        lastSegmentLength = i - lastSlash - 1;
      }
      lastSlash = i;
      dots = 0;
    } else if (code === 46 /*.*/ && dots !== -1) {
      ++dots;
    } else {
      dots = -1;
    }
  }
  return res;
}

function _format(sep, pathObject) {
  var dir = pathObject.dir || pathObject.root;
  var base = pathObject.base || (pathObject.name || '') + (pathObject.ext || '');
  if (!dir) {
    return base;
  }
  if (dir === pathObject.root) {
    return dir + base;
  }
  return dir + sep + base;
}
var posix = {
  // path.resolve([from ...], to)
  resolve: function resolve() {
    var resolvedPath = '';
    var resolvedAbsolute = false;
    var cwd;
    for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      var path;
      if (i >= 0)
        path = arguments[i];
      else {
        if (cwd === undefined)
          cwd = process.cwd();
        path = cwd;
      }
      assertPath(path);
      // Skip empty entries
      if (path.length === 0) {
        continue;
      }
      resolvedPath = path + '/' + resolvedPath;
      resolvedAbsolute = path.charCodeAt(0) === 47 /*/*/;
    }
    // At this point the path should be resolved to a full absolute path, but
    // handle relative paths to be safe (might happen when process.cwd() fails)
    // Normalize the path
    resolvedPath = normalizeStringPosix(resolvedPath, !resolvedAbsolute);
    if (resolvedAbsolute) {
      if (resolvedPath.length > 0)
        return '/' + resolvedPath;
      else
        return '/';
    } else if (resolvedPath.length > 0) {
      return resolvedPath;
    } else {
      return '.';
    }
  },
  normalize: function normalize(path) {
    assertPath(path);
    if (path.length === 0) return '.';
    var isAbsolute = path.charCodeAt(0) === 47 /*/*/;
    var trailingSeparator = path.charCodeAt(path.length - 1) === 47 /*/*/;
    // Normalize the path
    path = normalizeStringPosix(path, !isAbsolute);
    if (path.length === 0 && !isAbsolute) path = '.';
    if (path.length > 0 && trailingSeparator) path += '/';
    if (isAbsolute) return '/' + path;
    return path;
  },
  isAbsolute: function isAbsolute(path) {
    assertPath(path);
    return path.length > 0 && path.charCodeAt(0) === 47 /*/*/;
  },
  join: function join() {
    if (arguments.length === 0)
      return '.';
    var joined;
    for (var i = 0; i < arguments.length; ++i) {
      var arg = arguments[i];
      assertPath(arg);
      if (arg.length > 0) {
        if (joined === undefined)
          joined = arg;
        else
          joined += '/' + arg;
      }
    }
    if (joined === undefined)
      return '.';
    return posix.normalize(joined);
  },
  relative: function relative(from, to) {
    assertPath(from);
    assertPath(to);
    if (from === to) return '';
    //from = posix.resolve(from);
    //to = posix.resolve(to);
    if (from === to) return '';
    // Trim any leading backslashes
    var fromStart = 1;
    for (; fromStart < from.length; ++fromStart) {
      if (from.charCodeAt(fromStart) !== 47 /*/*/)
        break;
    }
    var fromEnd = from.length;
    var fromLen = fromEnd - fromStart;
    // Trim any leading backslashes
    var toStart = 1;
    for (; toStart < to.length; ++toStart) {
      if (to.charCodeAt(toStart) !== 47 /*/*/)
        break;
    }
    var toEnd = to.length;
    var toLen = toEnd - toStart;
    // Compare paths to find the longest common path from root
    var length = fromLen < toLen ? fromLen : toLen;
    var lastCommonSep = -1;
    var i = 0;
    for (; i <= length; ++i) {
      if (i === length) {
        if (toLen > length) {
          if (to.charCodeAt(toStart + i) === 47 /*/*/) {
            // We get here if `from` is the exact base path for `to`.
            // For example: from='/foo/bar'; to='/foo/bar/baz'
            return to.slice(toStart + i + 1);
          } else if (i === 0) {
            // We get here if `from` is the root
            // For example: from='/'; to='/foo'
            return to.slice(toStart + i);
          }
        } else if (fromLen > length) {
          if (from.charCodeAt(fromStart + i) === 47 /*/*/) {
            // We get here if `to` is the exact base path for `from`.
            // For example: from='/foo/bar/baz'; to='/foo/bar'
            lastCommonSep = i;
          } else if (i === 0) {
            // We get here if `to` is the root.
            // For example: from='/foo'; to='/'
            lastCommonSep = 0;
          }
        }
        break;
      }
      var fromCode = from.charCodeAt(fromStart + i);
      var toCode = to.charCodeAt(toStart + i);
      if (fromCode !== toCode)
        break;
      else if (fromCode === 47 /*/*/)
        lastCommonSep = i;
    }
    var out = '';
    // Generate the relative path based on the path difference between `to`
    // and `from`
    for (i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i) {
      if (i === fromEnd || from.charCodeAt(i) === 47 /*/*/) {
        if (out.length === 0)
          out += '..';
        else
          out += '/..';
      }
    }
    // Lastly, append the rest of the destination (`to`) path that comes after
    // the common path parts
    if (out.length > 0)
      return out + to.slice(toStart + lastCommonSep);
    else {
      toStart += lastCommonSep;
      if (to.charCodeAt(toStart) === 47 /*/*/)
        ++toStart;
      return to.slice(toStart);
    }
  },
  _makeLong: function _makeLong(path) {
    return path;
  },
  dirname: function dirname(path) {
    assertPath(path);
    if (path.length === 0) return '.';
    var code = path.charCodeAt(0);
    var hasRoot = code === 47 /*/*/;
    var end = -1;
    var matchedSlash = true;
    for (var i = path.length - 1; i >= 1; --i) {
      code = path.charCodeAt(i);
      if (code === 47 /*/*/) {
          if (!matchedSlash) {
            end = i;
            break;
          }
        } else {
        // We saw the first non-path separator
        matchedSlash = false;
      }
    }
    if (end === -1) return hasRoot ? '/' : '.';
    if (hasRoot && end === 1) return '//';
    return path.slice(0, end);
  },
  basename: function basename(path, ext) {
    if (ext !== undefined && typeof ext !== 'string') throw new TypeError('"ext" argument must be a string');
    assertPath(path);
    var start = 0;
    var end = -1;
    var matchedSlash = true;
    var i;
    if (ext !== undefined && ext.length > 0 && ext.length <= path.length) {
      if (ext.length === path.length && ext === path) return '';
      var extIdx = ext.length - 1;
      var firstNonSlashEnd = -1;
      for (i = path.length - 1; i >= 0; --i) {
        var code = path.charCodeAt(i);
        if (code === 47 /*/*/) {
            // If we reached a path separator that was not part of a set of path
            // separators at the end of the string, stop now
            if (!matchedSlash) {
              start = i + 1;
              break;
            }
          } else {
          if (firstNonSlashEnd === -1) {
            // We saw the first non-path separator, remember this index in case
            // we need it if the extension ends up not matching
            matchedSlash = false;
            firstNonSlashEnd = i + 1;
          }
          if (extIdx >= 0) {
            // Try to match the explicit extension
            if (code === ext.charCodeAt(extIdx)) {
              if (--extIdx === -1) {
                // We matched the extension, so mark this as the end of our path
                // component
                end = i;
              }
            } else {
              // Extension does not match, so our result is the entire path
              // component
              extIdx = -1;
              end = firstNonSlashEnd;
            }
          }
        }
      }
      if (start === end) end = firstNonSlashEnd;else if (end === -1) end = path.length;
      return path.slice(start, end);
    } else {
      for (i = path.length - 1; i >= 0; --i) {
        if (path.charCodeAt(i) === 47 /*/*/) {
            // If we reached a path separator that was not part of a set of path
            // separators at the end of the string, stop now
            if (!matchedSlash) {
              start = i + 1;
              break;
            }
          } else if (end === -1) {
          // We saw the first non-path separator, mark this as the end of our
          // path component
          matchedSlash = false;
          end = i + 1;
        }
      }
      if (end === -1) return '';
      return path.slice(start, end);
    }
  },
  extname: function extname(path) {
    assertPath(path);
    var startDot = -1;
    var startPart = 0;
    var end = -1;
    var matchedSlash = true;
    // Track the state of characters (if any) we see before our first dot and
    // after any path separator we find
    var preDotState = 0;
    for (var i = path.length - 1; i >= 0; --i) {
      var code = path.charCodeAt(i);
      if (code === 47 /*/*/) {
          // If we reached a path separator that was not part of a set of path
          // separators at the end of the string, stop now
          if (!matchedSlash) {
            startPart = i + 1;
            break;
          }
          continue;
        }
      if (end === -1) {
        // We saw the first non-path separator, mark this as the end of our
        // extension
        matchedSlash = false;
        end = i + 1;
      }
      if (code === 46 /*.*/) {
          // If this is our first dot, mark it as the start of our extension
          if (startDot === -1)
            startDot = i;
          else if (preDotState !== 1)
            preDotState = 1;
      } else if (startDot !== -1) {
        // We saw a non-dot and non-path separator before our dot, so we should
        // have a good chance at having a non-empty extension
        preDotState = -1;
      }
    }
    if (startDot === -1 || end === -1 ||
        // We saw a non-dot character immediately before the dot
        preDotState === 0 ||
        // The (right-most) trimmed path component is exactly '..'
        preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
      return '';
    }
    return path.slice(startDot, end);
  },
  format: function format(pathObject) {
    if (pathObject === null || typeof pathObject !== 'object') {
      throw new TypeError('The "pathObject" argument must be of type Object. Received type ' + typeof pathObject);
    }
    return _format('/', pathObject);
  },
  parse: function parse(path) {
    assertPath(path);
    var ret = { root: '', dir: '', base: '', ext: '', name: '' };
    if (path.length === 0) return ret;
    var code = path.charCodeAt(0);
    var isAbsolute = code === 47 /*/*/;
    var start;
    if (isAbsolute) {
      ret.root = '/';
      start = 1;
    } else {
      start = 0;
    }
    var startDot = -1;
    var startPart = 0;
    var end = -1;
    var matchedSlash = true;
    var i = path.length - 1;
    // Track the state of characters (if any) we see before our first dot and
    // after any path separator we find
    var preDotState = 0;
    // Get non-dir info
    for (; i >= start; --i) {
      code = path.charCodeAt(i);
      if (code === 47 /*/*/) {
          // If we reached a path separator that was not part of a set of path
          // separators at the end of the string, stop now
          if (!matchedSlash) {
            startPart = i + 1;
            break;
          }
          continue;
        }
      if (end === -1) {
        // We saw the first non-path separator, mark this as the end of our
        // extension
        matchedSlash = false;
        end = i + 1;
      }
      if (code === 46 /*.*/) {
          // If this is our first dot, mark it as the start of our extension
          if (startDot === -1) startDot = i;else if (preDotState !== 1) preDotState = 1;
        } else if (startDot !== -1) {
        // We saw a non-dot and non-path separator before our dot, so we should
        // have a good chance at having a non-empty extension
        preDotState = -1;
      }
    }
    if (startDot === -1 || end === -1 ||
    // We saw a non-dot character immediately before the dot
    preDotState === 0 ||
    // The (right-most) trimmed path component is exactly '..'
    preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
      if (end !== -1) {
        if (startPart === 0 && isAbsolute) ret.base = ret.name = path.slice(1, end);else ret.base = ret.name = path.slice(startPart, end);
      }
    } else {
      if (startPart === 0 && isAbsolute) {
        ret.name = path.slice(1, startDot);
        ret.base = path.slice(1, end);
      } else {
        ret.name = path.slice(startPart, startDot);
        ret.base = path.slice(startPart, end);
      }
      ret.ext = path.slice(startDot, end);
    }
    if (startPart > 0) ret.dir = path.slice(0, startPart - 1);else if (isAbsolute) ret.dir = '/';
    return ret;
  },
  sep: '/',
  delimiter: ':',
  win32: null,
  posix: null
};
class File implements vscode.FileStat {
  type: vscode.FileType;
  ctime: number;
  mtime: number;
  size: number;
  name: string;
  data?: Uint8Array;
  constructor(name: string) {
    this.type = vscode.FileType.File;
    this.ctime = Date.now();
    this.mtime = Date.now();
    this.size = 0;
    this.name = name;
  }
}
class Directory implements vscode.FileStat {
  type: vscode.FileType;
  ctime: number;
  mtime: number;
  size: number;
  name: string;
  entries: Map<string, File | Directory>;
  constructor(name: string) {
    this.type = vscode.FileType.Directory;
    this.ctime = Date.now();
    this.mtime = Date.now();
    this.size = 0;
    this.name = name;
    this.entries = new Map();
  }
}
type Entry = File | Directory;
class MemFS implements vscode.FileSystemProvider {
  root = new Directory('');
  // --- snapshot save and restore functions
  async snapshotSave(snapshotFilename: vscode.Uri): Promise<void> {
    //const fs = require('vscode.workspace.fs')
    var snapshot = JSON.stringify(this.root);
  var enc = new TextEncoder(); // always utf-8
    await vscode.workspace.fs.writeFile(snapshotFilename, enc.encode(snapshot));
  }
  async snapshotRestore(snapshotFilename: vscode.Uri): Promise<void> {
    //const fs = require('vscode.workspace.fs')
    var contents = await vscode.workspace.fs.readFile(snapshotFilename);
  var dec = new TextDecoder("utf-8");
    this.root = JSON.parse(dec.decode(contents));
  }
  // --- manage file metadata
  stat(uri: vscode.Uri): vscode.FileStat {
    return this._lookup(uri, false);
  }
  readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
    const entry = this._lookupAsDirectory(uri, false);
    const result: [string, vscode.FileType][] = [];
    for (const [name, child] of entry.entries) {
      result.push([name, child.type]);
    }
    return result;
  }
  // --- manage file contents
  readFile(uri: vscode.Uri): Uint8Array {
    const data = this._lookupAsFile(uri, false).data;
    if (data) {
      return data;
    }
    throw vscode.FileSystemError.FileNotFound();
  }
  writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): void {
    const basename = posix.basename(uri.path, undefined);
    const parent = this._lookupParentDirectory(uri);
    let entry = parent.entries.get(basename);
    if (entry instanceof Directory) {
      throw vscode.FileSystemError.FileIsADirectory(uri);
    }
    if (!entry && !options.create) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    if (entry && options.create && !options.overwrite) {
      throw vscode.FileSystemError.FileExists(uri);
    }
    if (!entry) {
      entry = new File(basename);
      parent.entries.set(basename, entry);
      this._fireSoon({ type: vscode.FileChangeType.Created, uri });
    }
    entry.mtime = Date.now();
    entry.size = content.byteLength;
    entry.data = content;
    this._fireSoon({ type: vscode.FileChangeType.Changed, uri });
  }
  // --- manage files/folders
  rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): void {
    if (!options.overwrite && this._lookup(newUri, true)) {
      throw vscode.FileSystemError.FileExists(newUri);
    }
    const entry = this._lookup(oldUri, false);
    const oldParent = this._lookupParentDirectory(oldUri);
    const newParent = this._lookupParentDirectory(newUri);
    const newName = posix.basename(newUri.path, undefined);
    oldParent.entries.delete(entry.name);
    entry.name = newName;
    newParent.entries.set(newName, entry);
    this._fireSoon(
      { type: vscode.FileChangeType.Deleted, uri: oldUri },
      { type: vscode.FileChangeType.Created, uri: newUri }
    );
  }
  delete(uri: vscode.Uri): void {
    const dirname = uri.with({ path: posix.dirname(uri.path) });
    const basename = posix.basename(uri.path, undefined);
    const parent = this._lookupAsDirectory(dirname, false);
    if (!parent.entries.has(basename)) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    parent.entries.delete(basename);
    parent.mtime = Date.now();
    parent.size -= 1;
    this._fireSoon({ type: vscode.FileChangeType.Changed, uri: dirname }, { uri, type: vscode.FileChangeType.Deleted });
  }
  createDirectory(uri: vscode.Uri): void {
    const basename = posix.basename(uri.path, undefined);
    const dirname = uri.with({ path: posix.dirname(uri.path) });
    const parent = this._lookupAsDirectory(dirname, false);
    const entry = new Directory(basename);
    parent.entries.set(entry.name, entry);
    parent.mtime = Date.now();
    parent.size += 1;
    this._fireSoon({ type: vscode.FileChangeType.Changed, uri: dirname }, { type: vscode.FileChangeType.Created, uri });
  }
  // --- lookup
  private _lookup(uri: vscode.Uri, silent: false): Entry;
  private _lookup(uri: vscode.Uri, silent: boolean): Entry | undefined;
  private _lookup(uri: vscode.Uri, silent: boolean): Entry | undefined {
    const parts = uri.path.split('/');
    let entry: Entry = this.root;
    for (const part of parts) {
      if (!part) {
        continue;
      }
      let child: Entry | undefined;
      if (entry instanceof Directory) {
        child = entry.entries.get(part);
      }
      if (!child) {
        if (!silent) {
          throw vscode.FileSystemError.FileNotFound(uri);
        } else {
          return undefined;
        }
      }
      entry = child;
    }
    return entry;
  }
  private _lookupAsDirectory(uri: vscode.Uri, silent: boolean): Directory {
    const entry = this._lookup(uri, silent);
    if (entry instanceof Directory) {
      return entry;
    }
    throw vscode.FileSystemError.FileNotADirectory(uri);
  }
  private _lookupAsFile(uri: vscode.Uri, silent: boolean): File {
    const entry = this._lookup(uri, silent);
    if (entry instanceof File) {
      return entry;
    }
    throw vscode.FileSystemError.FileIsADirectory(uri);
  }
  private _lookupParentDirectory(uri: vscode.Uri): Directory {
    const dirname = uri.with({ path: posix.dirname(uri.path) });
    return this._lookupAsDirectory(dirname, false);
  }
  // --- manage file events
  private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  private _bufferedEvents: vscode.FileChangeEvent[] = [];
  private _fireSoonHandle?: NodeJS.Timer;
  readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;
  watch(_resource: vscode.Uri): vscode.Disposable {
    // ignore, fires for all changes...
    return new vscode.Disposable(() => { });
  }
  private _fireSoon(...events: vscode.FileChangeEvent[]): void {
    this._bufferedEvents.push(...events);
    if (this._fireSoonHandle) {
      clearTimeout(this._fireSoonHandle);
    }
    this._fireSoonHandle = setTimeout(() => {
      this._emitter.fire(this._bufferedEvents);
      this._bufferedEvents.length = 0;
    }, 5);
  }
}
