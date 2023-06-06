// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

const runStateStatusPreparing = 'preparing';
const runStateStatusPointsTo = 'preparing';
const runStateStatusQueued = 'queued';
const runStateStatusRunning = 'running';
const runStateStatusFoundProof = 'found_proof';
const runStateStatusExhaustedSearchSpace = 'exhausted_search_space';
const runStateStatusSafetyCheckFailed = 'safety_check_failed';
const runStateStatusTimedOut = 'timed_out';
const runStateStatusTerminated = 'terminated';

const viewStateBase = 'base';
const viewStateCancelling = 'cancelling';
const viewStateViewProof = 'viewProof';
const viewStateViewSearchTree = 'viewSearchTree';


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
                    addEqcheckInView(message.dirPath, message.source1Uri, message.source1Name, message.source1Text, message.source2Uri, message.source2Name, message.source2Text, message.functionName, getStatusMessage(message.runState, message.statusMessage), message.runState, message.prepareDirpath, message.pointsToDirpath);
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
                    updateEqcheckInView(message.origRequest, getStatusMessage(message.runState, message.statusMessage), message.runState);
                    break;
                }
            case 'removeEqcheckInView':
                {
                    removeEqcheckInView(message.origRequest);
                    break;
                }
            case 'eqcheckCancelled':
                {
                    //console.log("received eqcheckCancelled message '" + message.type + "'");
                    updateEqcheckInView(message.origRequest, "Cancelled", runStateStatusTerminated);
                    break;
                }
            case 'loadEqchecks':
                {
                  for (var i = message.eqchecks.length - 1; i >= 0; i--) {
                    const eqcheck = message.eqchecks[i];
                    const existsAlready = eqcheckExistsAlready(eqcheck);
                    //console.log(`i = ${i}, existsAlready = ${existsAlready}`);
                    if (!existsAlready) {
                      addEqcheckInView(eqcheck.dirPath, eqcheck.source1Uri, eqcheck.source1Name, eqcheck.source1Text, eqcheck.source2Uri, eqcheck.source2Name, eqcheck.source2Text, eqcheck.functionName, getStatusMessage(eqcheck.runState, eqcheck.statusMessage), eqcheck.runState, eqcheck.prepareDirpath, eqcheck.pointsToDirpath);
                    }
                  }
                  displayEqcheckList(eqchecks);
                  const curState = vscode.getState();
                  vscode.postMessage({ type: 'eqchecksLoaded', eqchecks: message.eqchecks, loginName: curState.currentUser });
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
        }
        vscode.postMessage({ type: 'registerLogin', currentUser: curState.currentUser});
      }
      welcome.addEventListener('contextmenu', welcomeButtonRightClick);
    }

    function getStatusMessage(runState, statusMessage)
    {
      if (runState == runStateStatusPreparing) {
        return "Preparing";
      } else if (runState == runStateStatusPointsTo) {
        return "Points-to analysis";
      } else if (runState == runStateStatusRunning) {
        return statusMessage;
      } else if (runState == runStateStatusQueued) {
        return "Queued";
      } else if (runState == runStateStatusFoundProof) {
        return "Found proof and safety";
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
    function getBackgroundColorFromRunstate(runState)
    {
      //console.log(`runState = ${runState}.\n`);
      if (runState == runStateStatusQueued) {
        //console.log(`returning red colour\n`);
        return "rgb(150, 150, 0)";  //yellow
      } else if (runState == runStateStatusRunning || runState == runStateStatusPreparing || runState == runStateStatusPointsTo) {
        //console.log(`returning yellow colour\n`);
        return "rgb(0, 0, 0)"; //black
      } else if (runState == runStateStatusFoundProof || runState == runStateStatusSafetyCheckFailed) {
        //console.log(`returning green colour\n`);
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

    /**
     * @param {Array<{ dirPath: string, source1Uri: string, source1Name: string, source2Uri: string, source2Name: string, functionName: string, runState: string }>} eqchecks
     */
    function displayEqcheckList(eqchecks) {
        const ul = document.querySelector('.eqcheck-list');
        ul.textContent = '';
        //console.log("displayEqcheckList:\n");
        //for (const eqcheck of eqchecks) {
        //  console.log(`eqcheck = ${eqcheck.dirPath}`);
        //}
        //ul.empty();
        //ul.innerHTML = "";
        for (const eqcheck of eqchecks) {
            const li = document.createElement('li');
            li.className = 'eqcheck-entry';

            const eqcheckPreview = document.createElement('div');
            eqcheckPreview.className = 'eqcheck-preview';
            //const bgColor = '000000';
            const bgColor = getBackgroundColorFromRunstate(eqcheck.runState);
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
              //document.getElementById('hoverEqcheckSource1Uri').style.display='none';
              //document.getElementById('hoverEqcheckSource2Uri').style.display='none';
              //document.getElementById('hoverEqcheckArrow').style.display='none';

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
        if (eqc.viewState === viewState) {
          eqc.viewState = viewStateBase;
        }
      }
    }

    function viewProof(eqcheck) {
      console.log('ViewProof clicked');
      const eqcheckRightClickMenu = document.getElementById("eqcheck-right-click-menu");
      eqchecks_remove_view_state(viewStateViewProof);
      eqcheck.viewState = viewStateViewProof;
      eqcheckRightClickMenu.style.display = "none";
      vscode.postMessage({ type: 'eqcheckViewProof', eqcheck: eqcheck});
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
      eqcheckRightClickMenu.style.display = "none";
      startButtonRightClickMenu.style.display = "none";
      vscode.postMessage({ type: 'eqcheckHideProof'/*, eqcheck: eqcheck*/});
    };

    function eqcheckCancel(eqcheck) {
      console.log('eqcheckCancel called');
      if (eqcheck.runState == runStateStatusRunning || eqcheck.runState == runStateStatusPreparing || eqcheck.runState == runStateStatusPointsTo || eqcheck.runState == runStateStatusQueued) {
        eqcheck.viewState = viewStateCancelling;
        eqcheck.statusMessage = "Cancelling...";
        displayEqcheckList(eqchecks);
        vscode.postMessage({ type: 'eqcheckCancel', eqcheck: eqcheck});
        eqcheck.statusMessage = 'Cancelled';
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
        if (eqcheck.viewState === viewStateViewProof) {
          return true;
        }
      }
      return false;
    }

    function showStartButtonRightClickMenu(mouseX, mouseY) {
      const startButtonRightClickMenu = document.getElementById('start-button-right-click-menu');
      startButtonRightClickMenu.style.top = `${mouseY}px`;
      startButtonRightClickMenu.style.left = `${mouseX}px`;

      var items = startButtonRightClickMenu.querySelectorAll(".item");

      for (const item of items) {
        item.removeEventListener('click', cancelAllEqchecksListener);
        item.removeEventListener('click', clearAllEqchecksListener);
        item.removeEventListener('click', hideProofListener);
        item.removeEventListener('click', saveSessionListener);
        item.removeEventListener('click', loadSessionListener);
      }

      if (anyEqcheckInViewStateViewProof()) {
        items[0].innerHTML = 'Hide Proof';
        items[0].addEventListener('click', hideProofListener);
        items[1].innerHTML = 'Cancel all eqchecks';
        items[1].addEventListener('click', cancelAllEqchecksListener);
        items[2].innerHTML = 'Clear all eqchecks';
        items[2].addEventListener('click', clearAllEqchecksListener);
        items[3].innerHTML = 'Save Session';
        items[3].addEventListener('click', saveSessionListener);
        items[4].innerHTML = 'Load Session';
        items[4].addEventListener('click', loadSessionListener);
      } else {
        items[0].innerHTML = 'Cancel all eqchecks';
        items[0].addEventListener('click', cancelAllEqchecksListener);
        items[1].innerHTML = 'Clear all eqchecks';
        items[1].addEventListener('click', clearAllEqchecksListener);
        items[2].innerHTML = 'Save Session';
        items[2].addEventListener('click', saveSessionListener);
        items[3].innerHTML = 'Load Session';
        items[3].addEventListener('click', loadSessionListener);
        items[4].innerHTML = '';
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
        eqcheckRightClickMenu.style.top = `${mouseY}px`;
        eqcheckRightClickMenu.style.left = `${mouseX}px`;
        eqcheckRightClickMenu.eqcheck = eqcheck;

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

        eqcheckRightClickMenu.style.display = "inline";

        if (eqcheck.runState == runStateStatusFoundProof || eqcheck.runState == runStateStatusSafetyCheckFailed) {
          if (eqcheck.viewState != viewStateViewProof) {
            items[0].innerHTML = 'View Proof';
            items[0].addEventListener('click', viewProofListener);
          } else {
            //console.log(`adding HideProof to the menu`);
            items[0].innerHTML = 'Hide Proof';
            items[0].addEventListener('click', hideProofListener);
          }
          items[1].innerHTML = 'Code Analysis Report';
          items[1].addEventListener('click', viewScanReportListener);
          items[2].innerHTML = 'View Search Tree';
          items[2].addEventListener('click', viewSearchTreeListener);
          items[3].innerHTML = 'Cancel';
          items[3].addEventListener('click', eqcheckCancelListener);
          items[4].innerHTML = 'Clear';
          items[4].addEventListener('click', eqcheckClearListener);
        } else if (eqcheck.runState == runStateStatusRunning || eqcheck.runState == runStateStatusPreparing || eqcheck.runState == runStateStatusPointsTo) {
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
          }
        } else if (eqcheck.runState == runStateStatusQueued) {
          items[0].innerHTML = 'Clear';
          items[0].addEventListener('click', eqcheckClearListener);
        } else if (eqcheck.runState == runStateStatusExhaustedSearchSpace) {
          items[0].innerHTML = 'View Search Tree';
          items[0].addEventListener('click', viewSearchTreeListener);
          items[1].innerHTML = 'Clear';
          items[1].addEventListener('click', eqcheckClearListener);
        } else if (eqcheck.runState == runStateStatusTimedOut) {
          items[0].innerHTML = 'View Search Tree';
          items[0].addEventListener('click', viewSearchTreeListener);
          items[1].innerHTML = 'Clear';
          items[1].addEventListener('click', eqcheckClearListener);
        } else if (eqcheck.runState == runStateStatusTerminated) {
          items[0].innerHTML = 'View Search Tree';
          items[0].addEventListener('click', viewSearchTreeListener);
          items[1].innerHTML = 'Clear';
          items[1].addEventListener('click', eqcheckClearListener);
        } else {
          items[0].innerHTML = 'Clear';
          items[0].addEventListener('click', eqcheckClearListener);
          //items[0].removeEventListener("click". arguments.callee);
        }
        //console.log(`before eqcheckRightClickMenu = ${JSON.stringify(eqcheckRightClickMenu)}`);

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
    function updateEqcheckInView(origRequest, statusMessage, runState)
    {
      //console.log('origRequest.dirPath = ' + origRequest.dirPath+ '\n');
      //console.log('statusMessage = ' + statusMessage + '\n');
      //console.log('runState = ' + runState + '\n');
      for (const eqcheck of eqchecks) {
        if (eqcheckMatchesOrigRequest(eqcheck, origRequest)) {
          //console.log(`updateEqcheckInView match found. statusMessage = ${statusMessage}\n`);
          eqcheck.statusMessage = statusMessage;
          eqcheck.runState = runState;
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
