// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

const runStateStatusPreparing = 'preparing';
const runStateStatusPointsTo = 'pointsto';
const runStateStatusQueued = 'queued';
const runStateStatusRunning = 'running';
const runStateStatusFoundProof = 'found_proof';
const runStateStatusExhaustedSearchSpace = 'exhausted_search_space';
const runStateStatusSafetyCheckRunning = 'safety_check_running';
const runStateStatusSafetyCheckFailed = 'safety_check_failed';
const runStateStatusTimedOut = 'timed_out';
const runStateStatusTerminated = 'terminated';

const viewStateBase = 'base';
const viewStateCancelling = 'cancelling';
const viewStateViewProof = 'viewProof';
const viewStateProofPartiallyClosed = 'partialClose';
const viewStateViewSearchTree = 'viewSearchTree';
let hideProofClicked;

let currentlyShowingProofOfEqCheck;



(function () {
    const vscode = acquireVsCodeApi();

    const oldState = vscode.getState() || { eqchecks: [], currentUser: undefined, quotaRemaining: undefined };
    //const oldState = { eqchecks: [] };
    //oldState.eqchecks.push({ value: getNewCalicoColor() });

    let eqchecks = oldState.eqchecks;
    const currentUser = oldState.currentUser;

    displayEqcheckList(eqchecks);

    //console.log(`posting eqchecksLoaded\n`);
    vscode.postMessage({ type: 'eqchecksLoaded', eqchecks: eqchecks, loginName: currentUser});

    displayWelcomeButton();

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'loginAuthenticated': {
              console.log(`Login authenticated called`);
              const oldState = vscode.getState() || { eqchecks: [], currentUser: undefined, quotaRemaining: undefined };
              vscode.setState({ eqchecks : oldState.eqchecks, currentUser: message.currentUser, quotaRemaining: message.quotaRemaining });
              displayWelcomeButton();
              break;
            }
            case 'addEqcheckInView':
                {
                    //console.log("received message '" + message.type + "'");
                    const oldState = vscode.getState() || { eqchecks: [], currentUser: undefined, quotaRemaining: undefined };
                    const quotaRemaining = (message.quotaRemaining === undefined) ? oldState.quotaRemaining : message.quotaRemaining;
                    vscode.setState({ eqchecks : oldState.eqchecks, currentUser: oldState.currentUser, quotaRemaining: message.quotaRemaining });
                    displayWelcomeButton();
                    addEqcheckInView(message.dirPath, message.source1Uri, message.source1Name, message.source1Text, message.source2Uri, message.source2Name, message.source2Text, message.functionName, getStatusMessage(message.runState, message.statusMessage, true), message.runState, message.prepareDirpath, message.pointsToDirpath);
                    break;
                }
            case 'userLogout':
                {
                  const oldState = vscode.getState() || { eqchecks: [], currentUser: undefined, quotaRemaining: undefined };
                  vscode.setState({ eqchecks : oldState.eqchecks, currentUser: undefined, quotaRemaining: undefined });
                  displayWelcomeButton();
                  break;
                }
            case 'updateEqcheckInView':
                {
                    //console.log("received updateEqcheckInView message '" + message.type + "'");
                    updateEqcheckInView(message.origRequest, getStatusMessage(message.runState, message.statusMessage, message.vir_flag), message.runState, message.vir_flag);
                    break;
                }
            case 'removeEqcheckInView':
                {
                    removeEqcheckInView(message.origRequest);
                    break;
                }
            //case 'eqcheckCancelled':
            //    {
            //        //console.log("received eqcheckCancelled message '" + message.type + "'");
            //        updateEqcheckInView(message.origRequest, "Cancelled", runStateStatusTerminated);
            //        break;
            //    }
            case 'loadEqchecks':
                {
                  for (var i = message.eqchecks.length - 1; i >= 0; i--) {
                    const eqcheck = message.eqchecks[i];
                    const existsAlready = eqcheckExistsAlready(eqcheck);
                    //console.log(`i = ${i}, existsAlready = ${existsAlready}`);
                    if (!existsAlready) {
                      addEqcheckInView(eqcheck.dirPath, eqcheck.source1Uri, eqcheck.source1Name, eqcheck.source1Text, eqcheck.source2Uri, eqcheck.source2Name, eqcheck.source2Text, eqcheck.functionName, getStatusMessage(eqcheck.runState, eqcheck.statusMessage, eqcheck.virStatus), eqcheck.runState, eqcheck.prepareDirpath, eqcheck.pointsToDirpath);
                    }
                  }
                  displayEqcheckList(eqchecks);
                  const curState = vscode.getState();
                  vscode.postMessage({ type: 'eqchecksLoaded', eqchecks: message.eqchecks, loginName: curState.currentUser });
                  break;
                }
            case 'panelIsclosed':
              {
                console.log("PanelIsClosed Received at main.js");
                currentlyShowingProofOfEqCheck.viewState = viewStateProofPartiallyClosed;
                break;
              }
            case 'allPanelsAreclosed':
              {
                console.log("AllPanelsAreClosed Received at main.js");
                if(!hideProofClicked){
                  currentlyShowingProofOfEqCheck.viewState = viewStateBase;
                  currentlyShowingProofOfEqCheck = undefined;
                }
                break;
              }
        }
    });

    function welcomeButtonAuthenticateLogin(event)
    {
      vscode.postMessage({ type: 'authenticateLogin'});
    }

    function welcomeButtonStartEqcheck(event)
    {
      hideStartButtonRightClickMenu();
      hideEqcheckRightClickMenu();
      startEqcheck();
    }

    function welcomeButtonRightClick(event)
    {
      hideEqcheckRightClickMenu();
      onStartButtonRightClick(event);
    }

    function displayWelcomeButton()
    {
      const welcome = document.querySelector('.clear-eqchecks-button');
      welcome.removeEventListener('click', welcomeButtonStartEqcheck);
      welcome.removeEventListener('click', welcomeButtonAuthenticateLogin);
      welcome.removeEventListener('contextmenu', welcomeButtonRightClick);

      const curState = vscode.getState();
      if (curState.currentUser === undefined/* || curState.quotaRemaining === undefined || curState.quotaRemaining <= 0*/) {
        welcome.innerHTML = 'Login';
        welcome.addEventListener('click', welcomeButtonAuthenticateLogin);
      } else {
        const curState = vscode.getState();
        welcome.innerHTML = `<small><small>${curState.currentUser}</small></small><br>Start an Eqcheck<br><small><small>(${curState.quotaRemaining} remaining)</small></small>`;
        if (curState.quotaRemaining > 0) {
          welcome.addEventListener('click', welcomeButtonStartEqcheck);
        } else {
          const oldState = vscode.getState() || { eqchecks: [], currentUser: undefined, quotaRemaining: undefined };
          vscode.setState({ eqchecks : oldState.eqchecks, currentUser: undefined, quotaRemaining: undefined });
          displayWelcomeButton();
        }
        vscode.postMessage({ type: 'registerLogin', currentUser: curState.currentUser});
      }
      welcome.addEventListener('contextmenu', welcomeButtonRightClick);
    }

    function getStatusMessage(runState, statusMessage, virStatus)
    {
      if (virStatus == null || virStatus == undefined){
        virStatus = true;
      }
      if (runState == runStateStatusPreparing) {
        return "Preparing";
      } else if (runState == runStateStatusPointsTo) {
        return "Points-to analysis";
      } else if (runState == runStateStatusRunning) {
        return statusMessage;
      } else if (runState == runStateStatusQueued) {
        return "Queued";
      } else if (runState == runStateStatusFoundProof) {
        if (virStatus == true){
          return "Found proof and safety";
        } else {
          return "Generating Validation IR";
        }
      } else if (runState == runStateStatusSafetyCheckRunning) {
        return "Found proof, safety check running";
      } else if (runState == runStateStatusSafetyCheckFailed) {
        return "Found proof, safety unclear";
      } else if (runState == runStateStatusExhaustedSearchSpace) {
        return "Exhausted Search Space";
      } else if (runState == runStateStatusTimedOut) {
        return "Timed Out";
      } else if (runState == runStateStatusTerminated) {
        return "Terminated";
      } else {
        return "";
      }
    }

    /**
     * @param {string} runState
     */
    function getBackgroundColorFromRunstate(runState, virStatus)
    {
      if (virStatus == undefined || virStatus == null){
        virStatus = false;
      }
      //console.log(`runState = ${runState}.\n`);
      if (runState == runStateStatusQueued) {
        //console.log(`returning red colour\n`);
        return "rgb(150, 150, 0)";  //yellow
      } else if (runState == runStateStatusRunning || runState == runStateStatusPreparing || runState == runStateStatusPointsTo) {
        //console.log(`returning yellow colour\n`);
        return "rgb(0, 0, 0)"; //black
      } else if ((runState == runStateStatusFoundProof || runState == runStateStatusSafetyCheckRunning || runState == runStateStatusSafetyCheckFailed) && !virStatus) {
        //console.log(`returning green colour\n`);
        return "rgb(73, 11, 120)"; // purple
      } else if ((runState == runStateStatusFoundProof || runState == runStateStatusSafetyCheckRunning || runState == runStateStatusSafetyCheckFailed) && virStatus) {
        return "rgb(0, 150, 0)"; //green
      } else {
        //return "rgb(0,0,0)";
        //console.log(`returning fallback colour\n`);
        return "rgb(0, 0, 0)"; //yellow
        //return "#006400"; //dark green
      }
      //return "006400"; //dark green
      //switch(runState) {
      //  case runStateStatusRunning: return "006400"; //dark green
      //  default: return "000000";
      //}
    }

    function displayEqcheck(eqcheck, ul) {
      const li = document.createElement('li');
      li.className = 'eqcheck-entry';

      const eqcheckPreview = document.createElement('div');
      eqcheckPreview.className = 'eqcheck-preview';
      //const bgColor = '000000';
      const bgColor = getBackgroundColorFromRunstate(eqcheck.runState,eqcheck.virStatus);
      //console.log(`runstate = ${eqcheck.runState}, bgColor = ${bgColor}`);
      eqcheckPreview.style.backgroundColor = `${bgColor}`;
      eqcheckPreview.addEventListener('mouseover', (/*event*/) => {
          onEqcheckMouseOver(eqcheck);
      });
      eqcheckPreview.addEventListener('mouseleave', (event) => {
          //hideRightClickMenu(eqcheck); //this hides it even if we go to the right-click-menu
          onEqcheckMouseLeave(eqcheck);
      });
      eqcheckPreview.addEventListener('mouseout', (/*event*/) => {
          onEqcheckMouseOut(eqcheck);
      });
      eqcheckPreview.addEventListener('contextmenu', (event) => {
          hideStartButtonRightClickMenu(eqcheck);
          onEqcheckRightClick(eqcheck, event);
      });
      eqcheckPreview.addEventListener('ondblclick', () => {
          onEqcheckDoubleClick(eqcheck);
      });
      eqcheckPreview.addEventListener('click', (event) => {
          hideEqcheckRightClickMenu();
          hideStartButtonRightClickMenu(eqcheck);
          onEqcheckClicked(eqcheck);
      });

      var t = document.createElement("table");
      t.setAttribute("id", "eqcheck-preview-table");
      eqcheckPreview.appendChild(t);

      var th = document.createElement("th");
      th.setAttribute("id", "Eqcheck header row");
      var thd = document.createElement("td");
      //var thd_text = document.createTextNode(`${eqcheck.source1Name} &#x2192 ${eqcheck.source2Name} : ${eqcheck.functionName}`);
      //thd.appendChild(thd_text);
      if (eqcheck.source2Name === undefined) {
        thd.innerHTML = `Compiling ${eqcheck.source1Name}`;
      } else if (eqcheck.functionName === undefined) {
        thd.innerHTML = `${eqcheck.source1Name} &#x2192 ${eqcheck.source2Name}`;
      } else {
        thd.innerHTML = `${eqcheck.functionName}: ${eqcheck.source1Name} &#x2192 ${eqcheck.source2Name}`;
      }
      th.appendChild(thd);
      t.appendChild(th);

      var tr = document.createElement("tr");
      tr.setAttribute("id", "Eqcheck status row");
      var trd = document.createElement("td");
      var trd_text = document.createTextNode(`${eqcheck.statusMessage}`);
      trd.appendChild(trd_text);
      tr.appendChild(trd);
      t.appendChild(tr);

      eqcheckPreview.appendChild(t);
      //eqcheckPreview.innerHTML = `${eqcheck.source1Name} &#x2192 ${eqcheck.source2Name} : ${eqcheck.functionName}<br>${eqcheck.statusMessage}`;
      li.appendChild(eqcheckPreview);
      var hr = document.createElement("hr");
      li.appendChild(hr);

      //const input = document.createElement('input');
      //input.className = 'eqcheck-input';
      //input.type = 'text';
      //input.value = eqcheck.value;
      //input.addEventListener('change', (e) => {
      //    const value = e.target.value;
      //    if (!value) {
      //        // Treat empty value as delete
      //        eqchecks.splice(eqchecks.indexOf(eqcheck), 1);
      //    } else {
      //        eqcheck.value = value;
      //    }
      //    updateEqcheckList(eqchecks);
      //});
      //li.appendChild(input);

      ul.appendChild(li);
    }

    /**
     * @param {Array<{ dirPath: string, source1Uri: string, source1Name: string, source2Uri: string, source2Name: string, functionName: string, runState: string }>} eqchecks
     */
    function displayEqcheckList(eqchecks) {
        const ul = document.querySelector('.eqcheck-list');
        ul.textContent = '';

        eqchecks.sort(
          function(a, b) {
            //console.log(`a = ${JSON.stringify(a)}`);
            //console.log(`b = ${JSON.stringify(b)}`);
            if (a.functionName === undefined) {
              return a;
            }
            if (b.functionName === undefined) {
              return b;
            }
            const aname = String(a.functionName[0]);
            const bname = String(b.functionName[0]);
            //console.log(`aname = ${aname}`);
            //console.log(`bname = ${bname}`);
            const cmp = aname.localeCompare(bname);
            //console.log(`cmp = ${cmp}`);
            return cmp;
          }
        );

        for (const eqcheck of eqchecks) {
          if (eqcheck.runState != runStateStatusRunning && eqcheck.runState != runStateStatusPointsTo && eqcheck.runState != runStateStatusPreparing) {
            displayEqcheck(eqcheck, ul);
          }
        }

        for (const eqcheck of eqchecks) {
          if (eqcheck.runState == runStateStatusRunning || eqcheck.runState == runStateStatusPointsTo || eqcheck.runState == runStateStatusPreparing) {
            displayEqcheck(eqcheck, ul);
          }
        }

        // Update the saved state
        const oldState = vscode.getState() || { eqchecks: [], currentUser: undefined, quotaRemaining: undefined };
        vscode.setState({ eqchecks : eqchecks, currentUser: oldState.currentUser, quotaRemaining: oldState.quotaRemaining });
    }

    /**
     * @param {{ dirPath: string, source1Uri: string, source1Name: string, source2Uri: string, source2Name: string, functionName: string, runState: string }} eqcheck
     */
    function onEqcheckMouseOver(eqcheck) {
        //do nothing for now. Should display the URIs
              //document.getElementById('hoverEqcheckSource1Uri').value = eqcheck.source1Uri;
              //document.getElementById('hoverEqcheckSource2Uri').value = eqcheck.source2Uri;
              //document.getElementById('hoverEqcheckArrow').style.display = 'inline';
              //document.getElementById('hoverEqcheckSource1Uri').style.display='inline';
              //document.getElementById('hoverEqcheckSource2Uri').style.display='inline';
    }

    /**
     * @param {{ dirPath: string, source1Uri: string, source1Name: string, source2Uri: string, source2Name: string, functionName: string, runState: string }} eqcheck
     */
    function onEqcheckMouseOut(eqcheck) {
        //do nothing for now. Should display the URIs
    }

    /**
     * @param {{ dirPath: string, source1Uri: string, source1Name: string, source2Uri: string, source2Name: string, functionName: string, runState: string }} eqcheck
     */
    function onEqcheckMouseLeave(eqcheck) {
            //document.getElementById('hoverEqcheckSource1Uri').style.display='none';
            //document.getElementById('hoverEqcheckSource2Uri').style.display='none';
            //document.getElementById('hoverEqcheckArrow').style.display = 'none';
    }

    function eqchecks_remove_view_state(viewState)
    {
      for (const eqc of eqchecks) {
        if (eqc.viewState === viewState)  {
          eqc.viewState = viewStateBase;
        }
      }
    }

    function viewProof(eqcheck) {
      console.log('ViewProof clicked');
      const eqcheckRightClickMenu = document.getElementById("eqcheck-right-click-menu");
      eqchecks_remove_view_state(viewStateViewProof);
      eqchecks_remove_view_state(viewStateProofPartiallyClosed);
      eqcheck.viewState = viewStateViewProof;
      eqcheckRightClickMenu.style.display = "none";
      currentlyShowingProofOfEqCheck = eqcheck;
      hideProofClicked=false;

      //vscode.postMessage({ type: 'eqcheckViewProof', eqcheck: eqcheck});
      // Only send a message if proof is completed and ready to view 
      // Else the webview crashes
      const runState = eqcheck.runState;
      if ((runState == runStateStatusFoundProof || runState == runStateStatusSafetyCheckRunning || runState == runStateStatusSafetyCheckFailed) && eqcheck.virStatus){
        vscode.postMessage({ type: 'eqcheckViewProof', eqcheck: eqcheck});
      } else if (runState == runStateStatusExhaustedSearchSpace){
        vscode.postMessage({type : 'eqcheckFailed'});
      } else {
        // vscode.window.showErrorMessage('The equivalence check is not complete yet.');
        vscode.postMessage({ type: 'eqcheckNotReady'});
      }
    }

    function viewProofListener(evt) {
      console.log('ViewProofListener called');
      const eqcheckRightClickMenu = document.getElementById("eqcheck-right-click-menu");
      //const eqcheck = evt.currentTarget.eqcheck;
      const eqcheck = eqcheckRightClickMenu.eqcheck;
      viewProof(eqcheck);
    };

    function viewScanReport(eqcheck) {
      console.log('ViewScanReport clicked');
      const eqcheckRightClickMenu = document.getElementById("eqcheck-right-click-menu");
      eqcheckRightClickMenu.style.display = "none";
      console.log(`main.js: dirPath=${eqcheck.dirPath}`);
      vscode.postMessage({ type: 'eqcheckViewScanReport', dirPath: eqcheck.dirPath});
    };

    function viewScanReportListener(evt) {
      console.log('ViewScanReportListener called');
      const eqcheckRightClickMenu = document.getElementById("eqcheck-right-click-menu");
      //const eqcheck = evt.currentTarget.eqcheck;
      const eqcheck = eqcheckRightClickMenu.eqcheck;
      viewScanReport(eqcheck);
    };

    function hideProofListener(evt) {
      const eqcheckRightClickMenu = document.getElementById("eqcheck-right-click-menu");
      const startButtonRightClickMenu = document.getElementById('start-button-right-click-menu');
      //const eqcheck = evt.currentTarget.eqcheck;
      //const eqcheck = eqcheckRightClickMenu.eqcheck;
      console.log('HideProof clicked');
      //eqcheck.viewState = viewStateBase;
      eqchecks_remove_view_state(viewStateViewProof);
      eqchecks_remove_view_state(viewStateProofPartiallyClosed);
      eqcheckRightClickMenu.style.display = "none";
      startButtonRightClickMenu.style.display = "none";
      hideProofClicked = true;
      currentlyShowingProofOfEqCheck = undefined;
      vscode.postMessage({ type: 'eqcheckHideProof'/*, eqcheck: eqcheck*/});
    };

    function eqcheckCancel(eqcheck) {
      console.log('eqcheckCancel called');
      if (eqcheck.runState == runStateStatusRunning || eqcheck.runState == runStateStatusPreparing || eqcheck.runState == runStateStatusPointsTo || eqcheck.runState == runStateStatusSafetyCheckRunning || eqcheck.runState == runStateStatusQueued) {
        eqcheck.viewState = viewStateCancelling;
        eqcheck.statusMessage = "Cancelled";
        displayEqcheckList(eqchecks);
        vscode.postMessage({ type: 'eqcheckCancel', eqcheck: eqcheck});
        //eqcheck.statusMessage = 'Cancelled';
        eqcheck.runState = runStateStatusTerminated;
      }
    }


    function removeEqcheck(eqcheck) {
      //console.log(`removing eqcheck =\n${JSON.stringify(eqcheck)}`);
      const index = eqchecks.indexOf(eqcheck);
      if (index > -1) { // only splice array when item is found
        eqchecks.splice(index, 1); // 2nd parameter means remove one item only
      }
    }

    function eqcheckCancelListener(evt) {
      const eqcheckRightClickMenu = document.getElementById("eqcheck-right-click-menu");
      eqcheckRightClickMenu.style.display = "none";
      //const eqcheck = evt.currentTarget.eqcheck;
      const eqcheck = eqcheckRightClickMenu.eqcheck;
      eqcheckCancel(eqcheck);
    };

    function matchEqCheckMenuEntries(e1 , e2){
      if(e1.dirPath===e2.dirPath && e1.source1Name === e2.source1Name && e1.source1Uri === e2.source1Uri && e1.source2Name === e2.source2Name && e1.source2Uri === e2.source2Uri){
        return true;
      }
      return false;
    };

    function eqcheckClearListener(evt) {
      const eqcheckRightClickMenu = document.getElementById("eqcheck-right-click-menu");
      //const eqcheck = evt.currentTarget.eqcheck;
      const eqcheck = eqcheckRightClickMenu.eqcheck;
      //eqcheckCancel(eqcheck);

      console.log('eqcheckClear clicked');
      eqcheckRightClickMenu.style.display = "none";

      removeEqcheck(eqcheck);
      vscode.postMessage({ type: 'eqcheckClear', eqcheck: eqcheck});
      displayEqcheckList(eqchecks);
      if(matchEqCheckMenuEntries(eqcheck,currentlyShowingProofOfEqCheck)){
        eqchecks_remove_view_state(viewStateViewProof);
        eqchecks_remove_view_state(viewStateProofPartiallyClosed);
        currentlyShowingProofOfEqCheck = undefined;
        vscode.postMessage({ type: 'eqcheckHideProof'/*, eqcheck: eqcheck*/});
      }
    };

    function viewSearchTreeListener(evt) {
      const eqcheckRightClickMenu = document.getElementById("eqcheck-right-click-menu");
      //const eqcheck = evt.currentTarget.eqcheck;
      const eqcheck = eqcheckRightClickMenu.eqcheck;

      console.log('viewSearchTree clicked');
      eqcheckRightClickMenu.style.display = "none";

      vscode.postMessage({ type: 'eqcheckViewSearchTree', eqcheck: eqcheck });
    };

    function cancelAllEqchecksListener() {
      hideStartButtonRightClickMenu();
      for (const eqcheck of eqchecks) {
        eqcheckCancel(eqcheck);
      }
      displayEqcheckList(eqchecks);
    }

    function clearAllEqchecksListener() {
      hideStartButtonRightClickMenu();
      eqchecks = [];
      vscode.postMessage({ type: 'eqcheckClear', eqcheck: undefined});
      displayEqcheckList(eqchecks);
    }

    function saveSessionListener() {
      console.log('saveSessionListener called');
      const eqcheckRightClickMenu = document.getElementById("eqcheck-right-click-menu");
      const startButtonRightClickMenu = document.getElementById('start-button-right-click-menu');
      startButtonRightClickMenu.style.display = "none";
      eqcheckRightClickMenu.style.display = "none";
      vscode.postMessage({ type: 'saveSession', eqchecks: eqchecks });
    }

    function loadSessionListener() {
      console.log('loadSessionListener called');
      const eqcheckRightClickMenu = document.getElementById("eqcheck-right-click-menu");
      const startButtonRightClickMenu = document.getElementById('start-button-right-click-menu');
      startButtonRightClickMenu.style.display = "none";
      eqcheckRightClickMenu.style.display = "none";
      vscode.postMessage({ type: 'loadSession' });
    }


    function anyEqcheckInViewStateViewProof() {
      for (const eqcheck of eqchecks) {
        if (eqcheck.viewState === viewStateViewProof || eqcheck.viewState === viewStateProofPartiallyClosed) {
          return true;
        }
      }
      return false;
    }

    //sahil
    function anyEqcheckInRunningState() {
      for (const eqcheck of eqchecks) {
        if (eqcheck.runState === runStateStatusPreparing || eqcheck.runState === runStateStatusPointsTo || eqcheck.runState === runStateStatusRunning || eqcheck.runState === runStateStatusSafetyCheckRunning) {
          return true;
        }
      }
      return false;
    }

    function showStartButtonRightClickMenu(mouseX, mouseY) {
      const startButtonRightClickMenu = document.getElementById('start-button-right-click-menu');
      var width = window.innerWidth;
      var height = window.innerHeight;
      //boxWidth set in main.css
      var boxWidth= 100;
      startButtonRightClickMenu.style.top = `${mouseY}px`;
      // console.log(mouseX+ " "+ mouseY);
      // console.log("Visible Width= "+window.innerWidth+" Visible Height="+window.innerHeight);

      if(width<=boxWidth+70){
        //For case when the user makes startButton Width less than boxWidth+70. 
        //above 70 is chosen by hit and trial method.
        startButtonRightClickMenu.style.left = `25px`;
      }
      else if(mouseX>width-boxWidth){
        // For normal width case. If the user clicks in extreme right.
        //Then show thw menu in left of click
        startButtonRightClickMenu.style.left = `${mouseX-boxWidth}px`;
      }
      else{
        //else show menu in right of click
        startButtonRightClickMenu.style.left = `${mouseX}px`;
      }
      //console.log(mouseX + " " + mouseY);
      //console.log("widht = "+ width + " height= "+ height);
      var menuEntryCount =0;

      var items = startButtonRightClickMenu.querySelectorAll(".item");

      for (const item of items) {
        item.removeEventListener('click', cancelAllEqchecksListener);
        item.removeEventListener('click', clearAllEqchecksListener);
        item.removeEventListener('click', hideProofListener);
        item.removeEventListener('click', saveSessionListener);
        item.removeEventListener('click', loadSessionListener);
      }

      items[0].style.display = "block";
      items[1].style.display = "block";
      items[2].style.display = "block";
      items[3].style.display = "block";
      items[4].style.display = "block";

      if (anyEqcheckInViewStateViewProof()) {
        items[0].innerHTML = 'Hide Proof';
        items[0].addEventListener('click', hideProofListener);
        if(anyEqcheckInRunningState()){
          items[1].innerHTML = 'Cancel all eqchecks';
          items[1].addEventListener('click', cancelAllEqchecksListener);
          menuEntryCount =5;
        }
        else{
          items[1].style.display = "none";
          menuEntryCount =4;
        }
        items[2].innerHTML = 'Clear all eqchecks';
        items[2].addEventListener('click', clearAllEqchecksListener);
        items[3].innerHTML = 'Save Session';
        items[3].addEventListener('click', saveSessionListener);
        items[4].innerHTML = 'Load Session';
        items[4].addEventListener('click', loadSessionListener);
      } else {
        if(anyEqcheckInRunningState()){
          items[0].innerHTML = 'Cancel all eqchecks';
          items[0].addEventListener('click', cancelAllEqchecksListener);
          menuEntryCount =5;
        }
        else{
          items[0].style.display = "none";
          menuEntryCount =4;
        }
        items[1].innerHTML = 'Clear all eqchecks';
        items[1].addEventListener('click', clearAllEqchecksListener);
        items[2].innerHTML = 'Save Session';
        items[2].addEventListener('click', saveSessionListener);
        items[3].innerHTML = 'Load Session';
        items[3].addEventListener('click', loadSessionListener);
        items[4].style.display = "none";
      }
      if(height<=150){
        //26 = textSize(10px)+ top Padding(8px) + bottom padding(8px)
        startButtonRightClickMenu.style.top = `${height-menuEntryCount*26}px`;
      }
      else if(mouseY> height - menuEntryCount*26){
        startButtonRightClickMenu.style.top = `${mouseY-menuEntryCount*26}px`;
      }
      else{
        startButtonRightClickMenu.style.top = `${mouseY}px`;
      }

      startButtonRightClickMenu.style.display = "inline";
      startButtonRightClickMenu.classList.add("visible");
    }

    function hideStartButtonRightClickMenu() {
        const eqcheckRightClickMenu = document.getElementById("start-button-right-click-menu");
        eqcheckRightClickMenu.style.display = "none";
        eqcheckRightClickMenu.classList.remove("visible");
    }

    /**
     * @param {{ dirPath: string, source1Uri: string, source1Name: string, source2Uri: string, source2Name: string, functionName: string, runState: string }} eqcheck, {number} mouseX, {number} mouseY
     */
    function showEqcheckRightClickMenu(eqcheck, mouseX, mouseY) {
        const eqcheckRightClickMenu = document.getElementById("eqcheck-right-click-menu");
        var width = window.innerWidth;
        var height = window.innerHeight;
        var boxWidth= 150;

        eqcheckRightClickMenu.style.top = `${mouseY}px`;

        if(width<=boxWidth+70){
          //For case when the user makes startButton Width less than boxWidth+50. 
          //above 50 is chosen by hit and trial method.
          eqcheckRightClickMenu.style.left = `25px`;
        }
        else if(mouseX>width-boxWidth){
          // For normal width case. If the user clicks in extreme right.
          //Then show the menu in left of click
          eqcheckRightClickMenu.style.left = `${mouseX-boxWidth}px`;
        }
        else{
          //else show menu in right of click
          eqcheckRightClickMenu.style.left = `${mouseX}px`;
        }
        eqcheckRightClickMenu.eqcheck = eqcheck;

        var menuEntryCount=0

        console.log(mouseX+" "+mouseY);
        console.log("top= "+eqcheckRightClickMenu.style.top+" bottom= "+eqcheckRightClickMenu.style.bottom);
        console.log("Visible Width= "+window.innerWidth+" Visible Height="+window.innerHeight);


        var items = eqcheckRightClickMenu.querySelectorAll(".item");

        //console.log(`eqcheck.runState = ${eqcheck.runState}`);
        //console.log(`runStateStatusFoundProof = ${runStateStatusFoundProof}`);
        //console.log(`eqcheck.viewState = ${eqcheck.viewState}`);

        items[0].removeEventListener('click', viewProofListener);
        items[0].removeEventListener('click', hideProofListener);
        items[0].removeEventListener('click', eqcheckCancelListener);
        items[0].removeEventListener('click', eqcheckClearListener);
        items[0].removeEventListener('click', viewSearchTreeListener);
        items[0].removeEventListener('click', viewScanReportListener);

        items[1].removeEventListener('click', viewProofListener);
        items[1].removeEventListener('click', hideProofListener);
        items[1].removeEventListener('click', eqcheckCancelListener);
        items[1].removeEventListener('click', eqcheckClearListener);
        items[1].removeEventListener('click', viewSearchTreeListener);
        items[1].removeEventListener('click', viewScanReportListener);

        items[2].removeEventListener('click', viewProofListener);
        items[2].removeEventListener('click', hideProofListener);
        items[2].removeEventListener('click', eqcheckCancelListener);
        items[2].removeEventListener('click', eqcheckClearListener);
        items[2].removeEventListener('click', viewSearchTreeListener);
        items[2].removeEventListener('click', viewScanReportListener);

        items[3].removeEventListener('click', viewProofListener);
        items[3].removeEventListener('click', hideProofListener);
        items[3].removeEventListener('click', eqcheckCancelListener);
        items[3].removeEventListener('click', eqcheckClearListener);
        items[3].removeEventListener('click', viewSearchTreeListener);
        items[3].removeEventListener('click', viewScanReportListener);

        items[4].removeEventListener('click', viewProofListener);
        items[4].removeEventListener('click', hideProofListener);
        items[4].removeEventListener('click', eqcheckCancelListener);
        items[4].removeEventListener('click', eqcheckClearListener);
        items[4].removeEventListener('click', viewSearchTreeListener);
        items[4].removeEventListener('click', viewScanReportListener);

        items[0].innerHTML = '';
        items[1].innerHTML = '';
        items[2].innerHTML = '';
        items[3].innerHTML = '';
        items[4].innerHTML = '';
        
        items[0].style.display = "block";
        items[1].style.display = "block";
        items[2].style.display = "block";
        items[3].style.display = "block";
        items[4].style.display = "block";

        eqcheckRightClickMenu.style.display = "inline";

        //if (eqcheck.runState == runStateStatusFoundProof || eqcheck.runState == runStateStatusSafetyCheckFailed || eqcheck.runState == runStateStatusSafetyCheckRunning)
        if (eqcheck.runState == runStateStatusFoundProof/* || eqcheck.runState == runStateStatusSafetyCheckFailed || eqcheck.runState == runStateStatusSafetyCheckRunning*/) {
          if(eqcheck.viewState == viewStateProofPartiallyClosed){
            items[0].innerHTML = 'View Whole Proof';
            items[0].addEventListener('click', viewProofListener);
            items[1].innerHTML = 'Hide Proof';
            items[1].addEventListener('click', hideProofListener);
            items[2].innerHTML = 'Code Analysis Report';
            items[2].addEventListener('click', viewScanReportListener);
            items[3].innerHTML = 'View Search Tree';
            items[3].addEventListener('click', viewSearchTreeListener);
            items[4].innerHTML = 'Clear';
            items[4].addEventListener('click', eqcheckClearListener);
          }
          else{
            if (eqcheck.viewState != viewStateViewProof) {
              items[0].innerHTML = 'View Proof';
              items[0].addEventListener('click', viewProofListener);
            }
             else {
              //console.log(`adding HideProof to the menu`);
              items[0].innerHTML = 'Hide Proof';
              items[0].addEventListener('click', hideProofListener);
            }
            items[1].innerHTML = 'Code Analysis Report';
            items[1].addEventListener('click', viewScanReportListener);
            items[2].innerHTML = 'View Search Tree';
            items[2].addEventListener('click', viewSearchTreeListener);
            items[3].innerHTML = 'Clear';
            items[3].addEventListener('click', eqcheckClearListener);
            items[4].style.display ="none";
          }
          menuEntryCount=5;
        } 
        else if (eqcheck.runState == runStateStatusRunning || eqcheck.runState == runStateStatusPreparing || eqcheck.runState == runStateStatusPointsTo || eqcheck.runState == runStateStatusSafetyCheckRunning) {
          if (eqcheck.viewState != viewStateCancelling) {
            items[0].innerHTML = 'Cancel';
            items[0].addEventListener('click', eqcheckCancelListener);
            items[1].innerHTML = 'View Search Tree';
            items[1].addEventListener('click', viewSearchTreeListener);
            items[2].innerHTML = 'Clear';
            items[2].addEventListener('click', eqcheckClearListener);
          } else {
            items[0].innerHTML = 'Clear';
            items[0].addEventListener('click', eqcheckClearListener);
            items[1].innerHTML = 'ViewSearchTree';
            items[1].addEventListener('click', viewSearchTreeListener);
            items[2].style.display = "none";
          }
          items[3].style.display = "none";
          items[4].style.display = "none";
          menuEntryCount =3;
        } 
        else if (eqcheck.runState == runStateStatusQueued) {
          items[0].innerHTML = 'Clear';
          items[0].addEventListener('click', eqcheckClearListener);
          items[1].style.display = "none";
          items[2].style.display = "none";
          items[3].style.display = "none";
          items[4].style.display = "none";
          menuEntryCount =1;
        } 
        else if (eqcheck.runState == runStateStatusExhaustedSearchSpace) {
          items[0].innerHTML = 'View Search Tree';
          items[0].addEventListener('click', viewSearchTreeListener);
          items[1].innerHTML = 'Clear';
          items[1].addEventListener('click', eqcheckClearListener);
          items[2].style.display = "none";
          items[3].style.display = "none";
          items[4].style.display = "none";
          menuEntryCount =2;
        } 
        else if (eqcheck.runState == runStateStatusTimedOut) {
          items[0].innerHTML = 'View Search Tree';
          items[0].addEventListener('click', viewSearchTreeListener);
          items[1].innerHTML = 'Clear';
          items[1].addEventListener('click', eqcheckClearListener);
          items[2].style.display = "none";
          items[3].style.display = "none";
          items[4].style.display = "none";
          menuEntryCount =2;
        } 
        else if (eqcheck.runState == runStateStatusTerminated) {
          items[0].innerHTML = 'View Search Tree';
          items[0].addEventListener('click', viewSearchTreeListener);
          items[1].innerHTML = 'Clear';
          items[1].addEventListener('click', eqcheckClearListener);
          items[2].style.display = "none";
          items[3].style.display = "none";
          items[4].style.display = "none";
          menuEntryCount =2;
        } 
        else if (eqcheck.runState == runStateStatusSafetyCheckFailed) {
          items[0].innerHTML = 'View Search Tree';
          items[0].addEventListener('click', viewSearchTreeListener);
          items[1].innerHTML = 'Clear';
          items[1].addEventListener('click', eqcheckClearListener);
          items[2].style.display = "none";
          items[3].style.display = "none";
          items[4].style.display = "none";
          menuEntryCount =2;
        }
        else {
          items[0].innerHTML = 'Clear';
          items[0].addEventListener('click', eqcheckClearListener);
          items[1].style.display = "none";
          items[2].style.display = "none";
          items[3].style.display = "none";
          items[4].style.display = "none";
          menuEntryCount =1;
          //items[0].removeEventListener("click". arguments.callee);
        }
        //console.log(`before eqcheckRightClickMenu = ${JSON.stringify(eqcheckRightClickMenu)}`);
        if(height<=150){
          //26 = textSize(10px)+ top Padding(8px) + bottom padding(8px)
          eqcheckRightClickMenu.style.top = `${height-menuEntryCount*26}px`;
        }
        else if(mouseY> height - menuEntryCount*26){
          eqcheckRightClickMenu.style.top = `${mouseY-menuEntryCount*26}px`;
        }
        else{
          eqcheckRightClickMenu.style.top = `${mouseY}px`;
        }
        eqcheckRightClickMenu.classList.add("visible");
    }

    function hideEqcheckRightClickMenu() {
        const eqcheckRightClickMenu = document.getElementById("eqcheck-right-click-menu");
        eqcheckRightClickMenu.style.display = "none";
        eqcheckRightClickMenu.classList.remove("visible");
    }

    /**
     * @param {{ dirPath: string, source1Uri: string, source1Name: string, source2Uri: string, source2Name: string, functionName: string, runState: string }} eqcheck
     */
    function onEqcheckRightClick(eqcheck, event) {
        event.preventDefault();
        const { clientX: mouseX, clientY: mouseY } = event;

        const eqcheckRightClickMenu = document.getElementById('eqcheck-right-click-menu');
        if (eqcheckRightClickMenu.style.display !== "inline") {
          showEqcheckRightClickMenu(eqcheck, mouseX, mouseY);
        } else {
          hideEqcheckRightClickMenu();
        }
        //vscode.postMessage({ type: 'eqcheckShowProof', value: eqcheck });
    }

    function onStartButtonRightClick(event) {
      //const startButtonRightClickMenu = document.getElementById("start-button-right-click-menu");
      event.preventDefault();
      const { clientX: mouseX, clientY: mouseY } = event;

      const startButtonRightClickMenu = document.getElementById('start-button-right-click-menu');
      if (startButtonRightClickMenu.style.display !== "inline") {
        showStartButtonRightClickMenu(mouseX, mouseY);
      } else {
        hideStartButtonRightClickMenu();
      }
    }

    /**
     * @param {{ dirPath: string, source1Uri: string, source1Name: string, source2Uri: string, source2Name: string, functionName: string, runState: string }} eqcheck
     */
    function onEqcheckDoubleClick(eqcheck) {
        //vscode.postMessage({ type: 'eqcheckShowProof', value: eqcheck });
    }

    /**
     * @param {{ dirPath: string, source1Uri: string, source1Name: string, source2Uri: string, source2Name: string, functionName: string, runState: string }} eqcheck
     */
    function onEqcheckClicked(eqcheck) {
        const eqcheckRightClickMenu = document.getElementById("start-button-right-click-menu");
        //vscode.postMessage({ type: 'eqcheckShowProof', value: eqcheck });
        if (eqcheckRightClickMenu.style.display !== "inline") {
          viewProof(eqcheck);
        } else {
          hideEqcheckRightClickMenu();
        }
    }

    /**
     * @param {{ dirPath: string, source1Uri: string, source1Name: string, source2Uri: string, source2Name: string, functionName: string, runState: string }} eqcheck
     */
    //function getHoverMessage(eqcheck) {
    //  return `${eqcheck.source1Uri} &#x2192 ${eqcheck.source2Uri} : ${eqcheck.functionName}`;
    //}

    ///**
    // * @param {{ dirPath: string, source1Uri: string, source1Name: string, source2Uri: string, source2Name: string, functionName: string, statusMessage: string, runState: string }} origRequest, dirName: string, statusMessage: string, runState: string
    // */
    function updateEqcheckInView(origRequest, statusMessage, runState, virStatus)
    {
      //console.log('origRequest.dirPath = ' + origRequest.dirPath+ '\n');
      //console.log('statusMessage = ' + statusMessage + '\n');
      //console.log('runState = ' + runState + '\n');
      for (const eqcheck of eqchecks) {
        if (eqcheckMatchesOrigRequest(eqcheck, origRequest)) {
          //console.log(`updateEqcheckInView match found. statusMessage = ${statusMessage}\n`);
          eqcheck.statusMessage = statusMessage;
          eqcheck.runState = runState;
          eqcheck.virStatus = virStatus;
          break;
        } else {
          //console.log(`eqcheckMatchesOrigRequest returned false for ${eqcheck.dirPath}`);
        }
      }
      displayEqcheckList(eqchecks);
    }

    function removeEqcheckInView(origRequest)
    {
      var eqcheckToRemove;
      for (const eqcheck of eqchecks) {
        if (eqcheckMatchesOrigRequest(eqcheck, origRequest)) {
          eqcheckToRemove = eqcheck;
          console.log(`updateEqcheckInView match found. eqcheckToRemove.source2Name = ${eqcheck.source2Name}, origRequest.source2Name = ${origRequest.source2Name}. eqcheckToRemove.dirPath = ${eqcheckToRemove.dirPath}, dirPathIn = ${eqcheckToRemove.dirPathIn}, origRequest.dirPath = ${origRequest.dirPath}, dirPathIn = ${origRequest.dirPathIn}\n`);
          break;
        }
      }
      if (eqcheckToRemove !== undefined) {
        removeEqcheck(eqcheckToRemove);
        displayEqcheckList(eqchecks);
      }
    }

    ///**
    // * @param {{ dirPath: string, source1Uri: string, source1Name: string, source2Uri: string, source2Name: string, functionName: string, statusMessage: string, runState: string }} eqcheck, dirName: string, statusMessage: string, runState: string
    // */
    function eqcheckMatchesOrigRequest(eqcheck, origRequest)
    {
      return eqcheck.dirPath === origRequest.dirPath;
        //&& eqcheck.source1Uri === origRequest.source1Uri
        //&& eqcheck.source2Uri === origRequest.source2Uri
        //&& eqcheck.functionName === origRequest.functionName
      //;
    }

    function eqcheckExistsAlready(eqcheck)
    {
      for (const eqc of eqchecks) {
        if (eqcheck.dirPath !== undefined && eqc.dirPath !== undefined && eqcheck.dirPath.toString() == eqc.dirPath.toString()) {
          return true;
        }
        if (eqcheck.dirPath === undefined && eqc.dirPath === undefined) {
          if (eqcheck.prepareDirpath !== undefined && eqc.prepareDirpath !== undefined && eqcheck.prepareDirpath.toString() == eqc.prepareDirpath.toString()) {
            return true;
          }
        }
      }
      return false;
    }

    /**
     * @param _dirPath : string, _source1Uri : string, _source1Name: string, _source2Uri: string, _source2Name: string, _functionName: string, _statusMessage: string, _runState: string
     */
    function addEqcheckInView(
        _dirPath,
        _source1Uri,
        _source1Name,
        _source1Text,
        _source2Uri,
        _source2Name,
        _source2Text,
        _functionName,
        _statusMessage,
        _runState,
        _prepareDirpath,
        _pointsToDirpath
    ) {
      const eqcheck = {
        dirPath: _dirPath,
        source1Uri: _source1Uri,
        source1Name: _source1Name,
        source1Text: _source1Text,
        source2Uri: _source2Uri,
        source2Name: _source2Name,
        source2Text: _source2Text,
        functionName: _functionName,
        statusMessage : _statusMessage,
        runState: _runState,
        prepareDirpath: _prepareDirpath,
        pointsToDirpath: _pointsToDirpath,
        viewState: viewStateBase,
      }
      console.log(`adding eqcheck.functionName \n${JSON.stringify(eqcheck.functionName)}`);
      eqchecks.unshift(eqcheck);
      displayEqcheckList(eqchecks);
    }

    function startEqcheck() {
      vscode.postMessage({ type: 'startEqcheck'});
    }
}());
