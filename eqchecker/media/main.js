// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

const runStateStatusPreparing = 'preparing';
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

    const oldState = vscode.getState() || { eqchecks: [] };
    //oldState.eqchecks.push({ value: getNewCalicoColor() });

    let eqchecks = oldState.eqchecks;
    //let eqchecks = [];

    displayEqcheckList(eqchecks);

    //console.log(`posting eqchecksLoaded\n`);
    vscode.postMessage({ type: 'eqchecksLoaded', eqchecks: JSON.stringify(eqchecks)});

    const welcome = document.querySelector('.clear-eqchecks-button');
    welcome.innerHTML = 'Start an Eqcheck';
    welcome.addEventListener('click', () => {
      hideStartButtonRightClickMenu();
      hideEqcheckRightClickMenu();
      startEqcheck();
    });
    welcome.addEventListener('contextmenu', (event) => {
       hideEqcheckRightClickMenu();
       onStartButtonRightClick(event);
    });


    //document.getElementById('eqcheck-view-proof').addEventListener('click', () => {
    //    //console.log('ViewProof clicked');
    //    const eqcheckRightClickMenu = document.getElementById("eqcheck-right-click-menu");
    //    const eqcheck = eqcheckRightClickMenu.eqcheck;
    //    hideRightClickMenu(eqcheck);
    //    vscode.postMessage({ type: 'eqcheckViewProof', eqcheck: eqcheck});
    //});

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'addEqcheckInView':
                {
                    //console.log("received message '" + message.type + "'");
                    addEqcheckInView(message.dirPath, message.source1Uri, message.source1Name, message.source1Text, message.source2Uri, message.source2Name, message.source2Text, message.functionName, getStatusMessage(message.runState, message.statusMessage), message.runState);
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
        }
    });

    function getStatusMessage(runState, statusMessage)
    {
      if (runState == runStateStatusPreparing) {
        return "Preparing";
      } else if (runState == runStateStatusRunning) {
        return statusMessage;
      } else if (runState == runStateStatusQueued) {
        return "Queued";
      } else if (runState == runStateStatusFoundProof) {
        return "Found Proof";
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
      } else if (runState == runStateStatusRunning || runState == runStateStatusPreparing) {
        //console.log(`returning yellow colour\n`);
        return "rgb(0, 0, 0)"; //black
      } else if (runState == runStateStatusFoundProof) {
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
        vscode.setState({ eqchecks : eqchecks });
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
      if (eqcheck.runState == runStateStatusRunning || eqcheck.runState == runStateStatusPreparing || eqcheck.runState == runStateStatusQueued) {
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
      eqcheckCancel(eqcheck);

      console.log('eqcheckClear clicked');
      eqcheckRightClickMenu.style.display = "none";

      removeEqcheck(eqcheck);
      displayEqcheckList(eqchecks);
    };

    function viewSearchTreeListener(evt) {
      const eqcheckRightClickMenu = document.getElementById("eqcheck-right-click-menu");
      //const eqcheck = evt.currentTarget.eqcheck;
      const eqcheck = eqcheckRightClickMenu.eqcheck;

      console.log('viewSearchTree clicked');
      eqcheckRightClickMenu.style.display = "none";
    };

    function cancelAndClearAllEqchecksListener() {
      hideStartButtonRightClickMenu();
      for (const eqcheck of eqchecks) {
        eqcheckCancel(eqcheck);
      }
      eqchecks = [];
      displayEqcheckList(eqchecks);
    }

    function saveSessionListener() {
      console.log('saveSessionListener called');
      const eqcheckRightClickMenu = document.getElementById("eqcheck-right-click-menu");
      const startButtonRightClickMenu = document.getElementById('start-button-right-click-menu');
      startButtonRightClickMenu.style.display = "none";
      eqcheckRightClickMenu.style.display = "none";
      vscode.postMessage({ type: 'saveSession', eqchecks: JSON.stringify(eqchecks) });
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

      items[0].removeEventListener('click', cancelAndClearAllEqchecksListener);
      items[0].removeEventListener('click', hideProofListener);
      items[0].removeEventListener('click', saveSessionListener);
      items[0].removeEventListener('click', loadSessionListener);

      items[1].removeEventListener('click', cancelAndClearAllEqchecksListener);
      items[1].removeEventListener('click', hideProofListener);
      items[1].removeEventListener('click', saveSessionListener);
      items[1].removeEventListener('click', loadSessionListener);

      items[2].removeEventListener('click', cancelAndClearAllEqchecksListener);
      items[2].removeEventListener('click', hideProofListener);
      items[2].removeEventListener('click', saveSessionListener);
      items[2].removeEventListener('click', loadSessionListener);

      items[3].removeEventListener('click', cancelAndClearAllEqchecksListener);
      items[3].removeEventListener('click', hideProofListener);
      items[3].removeEventListener('click', saveSessionListener);
      items[3].removeEventListener('click', loadSessionListener);

      if (anyEqcheckInViewStateViewProof()) {
        items[0].innerHTML = 'Hide Proof';
        items[0].addEventListener('click', hideProofListener);
        items[1].innerHTML = 'Clear all eqchecks';
        items[1].addEventListener('click', cancelAndClearAllEqchecksListener);
        items[2].innerHTML = 'Save Session';
        items[2].addEventListener('click', saveSessionListener);
        items[3].innerHTML = 'Restore Session';
        items[3].addEventListener('click', loadSessionListener);
      } else {
        items[0].innerHTML = 'Clear all eqchecks';
        items[0].addEventListener('click', cancelAndClearAllEqchecksListener);
        items[1].innerHTML = 'Save Session';
        items[1].addEventListener('click', saveSessionListener);
        items[2].innerHTML = 'Restore Session';
        items[2].addEventListener('click', loadSessionListener);
        items[3].innerHTML = '';
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

        items[1].removeEventListener('click', viewProofListener);
        items[1].removeEventListener('click', hideProofListener);
        items[1].removeEventListener('click', eqcheckCancelListener);
        items[1].removeEventListener('click', eqcheckClearListener);

        items[2].removeEventListener('click', viewProofListener);
        items[2].removeEventListener('click', hideProofListener);
        items[2].removeEventListener('click', eqcheckCancelListener);
        items[2].removeEventListener('click', eqcheckClearListener);

        items[0].innerHTML = '';
        items[1].innerHTML = '';
        items[2].innerHTML = '';

        eqcheckRightClickMenu.style.display = "inline";

        if (eqcheck.runState == runStateStatusFoundProof) {
          items[0].removeEventListener('click', eqcheckCancelListener);
          if (eqcheck.viewState != viewStateViewProof) {
            items[0].innerHTML = 'View Proof';
            items[0].addEventListener('click', viewProofListener);
          } else {
            //console.log(`adding HideProof to the menu`);
            items[0].innerHTML = 'Hide Proof';
            items[0].addEventListener('click', hideProofListener);
          }
          items[1].innerHTML = 'View Search Tree';
          items[2].innerHTML = 'Clear';
          items[2].addEventListener('click', eqcheckClearListener);
        } else if (eqcheck.runState == runStateStatusRunning || eqcheck.runState == runStateStatusPreparing) {
          if (eqcheck.viewState != viewStateCancelling) {
            items[0].innerHTML = 'Cancel';
            items[0].addEventListener('click', eqcheckCancelListener);
            items[1].innerHTML = 'View Search Tree';
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
          items[1].innerHTML = 'Clear';
          items[1].addEventListener('click', eqcheckClearListener);
        } else if (eqcheck.runState == runStateStatusTimedOut) {
          items[0].innerHTML = 'View Search Tree';
          items[1].innerHTML = 'Clear';
          items[1].addEventListener('click', eqcheckClearListener);
        } else if (eqcheck.runState == runStateStatusTerminated) {
          items[0].innerHTML = 'View Search Tree';
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
        _runState
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
        viewState: viewStateBase,
      }
      console.log(`adding eqcheck.functionName \n${JSON.stringify(eqcheck.functionName)}`);
      eqchecks.push(eqcheck);
      displayEqcheckList(eqchecks);
    }

    function startEqcheck() {
      vscode.postMessage({ type: 'startEqcheck'});
    }
}());
