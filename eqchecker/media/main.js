// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

const runStateStatusQueued = 'queued';
const runStateStatusRunning = 'running';
const runStateStatusFoundProof = 'found_proof';
const runStateStatusExhaustedSearchSpace = 'exhausted_search_space';
const runStateStatusSafetyCheckFailed = 'safety_check_failed';
const runStateStatusTimedOut = 'timed_out';
const runStateStatusTerminated = 'terminated';

const viewStateBase = 'base';
const viewStateViewProof = 'viewProof';
const viewStateViewSearchTree = 'viewSearchTree';


(function () {
    const vscode = acquireVsCodeApi();

    const oldState = vscode.getState() || { eqchecks: [] };
    //oldState.eqchecks.push({ value: getNewCalicoColor() });

    let eqchecks = oldState.eqchecks;
    //let eqchecks = [];

    displayEqcheckList(eqchecks);

    document.querySelector('.clear-eqchecks-button').addEventListener('click', () => {
        clearEqchecks();
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
                    console.log("received message '" + message.type + "'");
                    addEqcheckInView(message.dirPath, message.source1Uri, message.source1Name, message.source1Text, message.source2Uri, message.source2Name, message.source2Text, message.functionName, getStatusMessage(message.runState, message.statusMessage), message.runState);
                    break;
                }
            case 'updateEqcheckInView':
                {
                    console.log("received message '" + message.type + "'");
                    updateEqcheckInView(message.origRequest, getStatusMessage(message.runState, message.statusMessage), message.runState);
                    break;
                }
            //case 'clearEqchecks':
            //    {
            //        eqchecks = [];
            //        updateEqcheckList(eqchecks);
            //        break;
            //    }
        }
    });

    function getStatusMessage(runState, statusMessage)
    {
      if (runState == runStateStatusRunning) {
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
      console.log(`runState = ${runState}.\n`);
      if (runState == runStateStatusQueued) {
        //console.log(`returning red colour\n`);
        return "rgb(150, 150, 0)";  //yellow
      } else if (runState == runStateStatusRunning) {
        //console.log(`returning yellow colour\n`);
        return "rgb(0, 0, 0)"; //black
      } else if (runState == runStateStatusFoundProof) {
        //console.log(`returning green colour\n`);
        return "rgb(0, 150, 0)"; //green
      } else {
        //return "rgb(0,0,0)";
        console.log(`returning fallback colour\n`);
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
                onEqcheckRightClick(eqcheck, event);
            });
            eqcheckPreview.addEventListener('ondblclick', () => {
                onEqcheckDoubleClick(eqcheck);
            });
            eqcheckPreview.addEventListener('click', (event) => {
                hideRightClickMenu(eqcheck);
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
            thd.innerHTML = `${eqcheck.source1Name} &#x2192 ${eqcheck.source2Name} : ${eqcheck.functionName}`;
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


    function viewProofListener(evt) {
      const eqcheckRightClickMenu = document.getElementById("eqcheck-right-click-menu");
      //const eqcheck = evt.currentTarget.eqcheck;
      const eqcheck = eqcheckRightClickMenu.eqcheck;
      console.log('ViewProof clicked');
      eqcheck.viewState = viewStateViewProof;
      eqcheckRightClickMenu.style.display = "none";
      vscode.postMessage({ type: 'eqcheckViewProof', eqcheck: eqcheck});
    };


    /**
     * @param {{ dirPath: string, source1Uri: string, source1Name: string, source2Uri: string, source2Name: string, functionName: string, runState: string }} eqcheck, {number} mouseX, {number} mouseY
     */
    function showRightClickMenu(eqcheck, mouseX, mouseY) {
        const eqcheckRightClickMenu = document.getElementById("eqcheck-right-click-menu");
        eqcheckRightClickMenu.style.top = `${mouseY}px`;
        eqcheckRightClickMenu.style.left = `${mouseX}px`;
        eqcheckRightClickMenu.eqcheck = eqcheck;

        var items = eqcheckRightClickMenu.querySelectorAll(".item");

        console.log(`eqcheck.runState = ${eqcheck.runState}`);
        console.log(`runStateStatusFoundProof = ${runStateStatusFoundProof}`);
        console.log(`eqcheck.viewState = ${eqcheck.viewState}`);
        eqcheckRightClickMenu.style.display = "inline";

        if (eqcheck.runState == runStateStatusFoundProof) {
          if (eqcheck.viewState != viewStateViewProof) {
            items[0].innerHTML = 'View Proof';
            if (items[0].getAttribute('listener') !== 'true') {
              items[0].addEventListener('click', viewProofListener);
            }
          } else {
            //console.log(`adding HideProof to the menu`);
            items[0].removeEventListener('click', viewProofListener);
            items[0].innerHTML = 'Hide Proof';
            items[0].addEventListener('click', () => {
              console.log('HideProof clicked');
              eqcheck.viewState = viewStateBase;
              eqcheckRightClickMenu.style.display = "none";
              vscode.postMessage({ type: 'eqcheckHideProof', eqcheck: eqcheck});
            });
          }
          items[1].innerHTML = 'View Search Tree';
        } else if (eqcheck.runState == runStateStatusRunning) {
          items[0].innerHTML = 'Cancel';
          items[1].innerHTML = 'View Search Tree';
        } else if (eqcheck.runState == runStateStatusQueued) {
          items[0].innerHTML = 'Cancel';
          items[1].innerHTML = 'Clear';
        } else if (eqcheck.runState == runStateExhaustedSearchSpace) {
          items[0].innerHTML = 'View Search Tree';
          items[1].innerHTML = 'Clear';
        } else if (eqcheck.runState == runStateTimedOut) {
          items[0].innerHTML = 'View Search Tree';
          items[1].innerHTML = 'Clear';
        } else if (eqcheck.runState == runStateStatusTerminated) {
          items[0].innerHTML = 'View Search Tree';
          items[1].innerHTML = 'Clear';
        } else {
          //items[0].removeEventListener("click". arguments.callee);
        }
        //console.log(`before eqcheckRightClickMenu = ${JSON.stringify(eqcheckRightClickMenu)}`);

        eqcheckRightClickMenu.classList.add("visible");
    }

    function hideRightClickMenu() {
        const eqcheckRightClickMenu = document.getElementById("eqcheck-right-click-menu");
        eqcheckRightClickMenu.style.display = "none";
        eqcheckRightClickMenu.classList.remove("visible");
    }

    /**
     * @param {{ dirPath: string, source1Uri: string, source1Name: string, source2Uri: string, source2Name: string, functionName: string, runState: string }} eqcheck
     */
    function onEqcheckRightClick(eqcheck, event) {
        const eqcheckRightClickMenu = document.getElementById("eqcheck-right-click-menu");
        event.preventDefault();
        const { clientX: mouseX, clientY: mouseY } = event;

        showRightClickMenu(eqcheck, mouseX, mouseY);
        //vscode.postMessage({ type: 'eqcheckShowProof', value: eqcheck });
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
        //vscode.postMessage({ type: 'eqcheckShowProof', value: eqcheck });
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
      //console.log('statusMessage = ' + statusMessage + '\n');
      //console.log('runState = ' + runState + '\n');
      for (const eqcheck of eqchecks) {
        if (eqcheckMatchesOrigRequest(eqcheck, origRequest)) {
          eqcheck.statusMessage = statusMessage;
          eqcheck.runState = runState;
          break;
        }
      }
      displayEqcheckList(eqchecks);
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
      console.log(`runState = ${_runState}`);
      eqchecks.push({
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
      });
      displayEqcheckList(eqchecks);
    }

    function clearEqchecks() {
        //eqchecks.push({ value: getNewCalicoColor() });
        eqchecks = [];
        //console.log('clearEqchecks Called');
        displayEqcheckList(eqchecks);
    }
}());
