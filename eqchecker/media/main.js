//@ts-check

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    const vscode = acquireVsCodeApi();

    const oldState = vscode.getState() || { eqchecks: [] };
    //oldState.eqchecks.push({ value: getNewCalicoColor() });

    let eqchecks = oldState.eqchecks;
    //let eqchecks = [];

    updateEqcheckList(eqchecks);

    document.querySelector('.clear-eqchecks-button').addEventListener('click', () => {
        clearEqchecks();
    });

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'addEqcheck':
                {
                    console.log("received message '" + message.type + "'");
                    addEqcheckInView(message.source1Uri, message.source1Name, message.source2Uri, message.source2Name, message.functionName, message.statusMessage, message.runState);
                    break;
                }
            case 'updateEqcheckInView':
                {
                    //console.log("received message '" + message.type + "'");
                    updateEqcheckInView(message.origRequest, message.dirPath, message.statusMessage, message.runState);
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

    /**
     * @param {string} runState
     */
    function getBackgroundColorFromRunstate(runState)
    {
      switch(runState) {
        case "RunstateRunning": return "008000";
        default: return "000000";
      }
    }

    /**
     * @param {Array<{ source1Uri: string, source1Name: string, source2Uri: string, source2Name: string, functionName: string, runState: string }>} eqchecks
     */
    function updateEqcheckList(eqchecks) {
        const ul = document.querySelector('.eqcheck-list');
        ul.textContent = '';
        //ul.empty();
        //ul.innerHTML = "";
        for (const eqcheck of eqchecks) {
            const li = document.createElement('li');
            li.className = 'eqcheck-entry';

            const eqcheckPreview = document.createElement('div');
            eqcheckPreview.className = 'eqcheck-preview';
            const bgColor = '000000';
            //const bgColor = getBackgroundColorFromRunstate(eqcheck.runState);
            //console.log(`runstate = ${eqcheck.runState}, bgColor = ${bgColor}`);
            //eqcheckPreview.style.backgroundColor = `#${bgColor}`;
            eqcheckPreview.style.backgroundColor = '000000';
            eqcheckPreview.innerHTML = `${eqcheck.source1Name} &#x2192 ${eqcheck.source2Name} : ${eqcheck.functionName}`;
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
     * @param {{ source1Uri: string, source1Name: string, source2Uri: string, source2Name: string, functionName: string, runState: string }} eqcheck
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
     * @param {{ source1Uri: string, source1Name: string, source2Uri: string, source2Name: string, functionName: string, runState: string }} eqcheck
     */
    function onEqcheckMouseOut(eqcheck) {
        //do nothing for now. Should display the URIs
    }

    /**
     * @param {{ source1Uri: string, source1Name: string, source2Uri: string, source2Name: string, functionName: string, runState: string }} eqcheck
     */
    function onEqcheckMouseLeave(eqcheck) {
	    //document.getElementById('hoverEqcheckSource1Uri').style.display='none';
	    //document.getElementById('hoverEqcheckSource2Uri').style.display='none';
	    //document.getElementById('hoverEqcheckArrow').style.display = 'none';
    }

    /**
     * @param {{ source1Uri: string, source1Name: string, source2Uri: string, source2Name: string, functionName: string, runState: string }} eqcheck, {number} mouseX, {number} mouseY
     */
    function showRightClickMenu(eqcheck, mouseX, mouseY) {
        const eqcheckRightClickMenu = document.getElementById("eqcheck-right-click-menu");
        eqcheckRightClickMenu.style.top = `${mouseY}px`;
        eqcheckRightClickMenu.style.left = `${mouseX}px`;

        eqcheckRightClickMenu.classList.add("visible");
    }

    function hideRightClickMenu() {
        const eqcheckRightClickMenu = document.getElementById("eqcheck-right-click-menu");
        eqcheckRightClickMenu.classList.remove("visible");
    }

    /**
     * @param {{ source1Uri: string, source1Name: string, source2Uri: string, source2Name: string, functionName: string, runState: string }} eqcheck
     */
    function onEqcheckRightClick(eqcheck, event) {
        const eqcheckRightClickMenu = document.getElementById("eqcheck-right-click-menu");
        event.preventDefault();
        const { clientX: mouseX, clientY: mouseY } = event;

        showRightClickMenu(eqcheck, mouseX, mouseY);
        //vscode.postMessage({ type: 'eqcheckShowProof', value: eqcheck });
    }

    /**
     * @param {{ source1Uri: string, source1Name: string, source2Uri: string, source2Name: string, functionName: string, runState: string }} eqcheck
     */
    function onEqcheckDoubleClick(eqcheck) {
        //vscode.postMessage({ type: 'eqcheckShowProof', value: eqcheck });
    }

    /**
     * @param {{ source1Uri: string, source1Name: string, source2Uri: string, source2Name: string, functionName: string, runState: string }} eqcheck
     */
    function onEqcheckClicked(eqcheck) {
        //vscode.postMessage({ type: 'eqcheckShowProof', value: eqcheck });
    }

    /**
     * @param {{ source1Uri: string, source1Name: string, source2Uri: string, source2Name: string, functionName: string, runState: string }} eqcheck
     */
    function getHoverMessage(eqcheck) {
      return `${eqcheck.source1Uri} &#x2192 ${eqcheck.source2Uri} : ${eqcheck.functionName}`;
    }

    /**
     * @param {{ source1Uri: string, source1Name: string, source2Uri: string, source2Name: string, functionName: string, statusMessage: string, runState: string }} origRequest, dirName: string, statusMessage: string, runState: string
     */
    function updateEqcheckInView(origRequest, dirPath, statusMessage, runState)
    {
      console.log('statusMessage = ' + statusMessage + '\n');
      console.log('runState = ' + runState + '\n');
      for (const eqcheck of eqchecks) {
        if (eqcheckMatchesOrigRequest(eqcheck, origRequest)) {
          eqcheck.statusMessage = statusMessage;
          eqcheck.runState = runState;
          break;
        }
      }
      updateEqcheckList(eqchecks);
    }

    /**
     * @param {{ source1Uri: string, source1Name: string, source2Uri: string, source2Name: string, functionName: string, statusMessage: string, runState: string }} eqcheck, dirName: string, statusMessage: string, runState: string
     */
    function eqcheckMatchesOrigRequest(eqcheck, origRequest) : boolean
    {
      return false;
    }

    /**
     * @param _source1Uri : string, _source1Name: string, _source2Uri: string, _source2Name: string, _functionName: string, _statusMessage: string, _runState: string
     */
    function addEqcheckInView(
        _source1Uri,
        _source1Name,
        _source2Uri,
        _source2Name,
        _functionName,
        _statusMessage,
        _runState
    ) {
      console.log(`runState = ${_runState}`);
      eqchecks.push({
        source1Uri: _source1Uri,
        source1Name: _source1Name,
        source2Uri: _source2Uri,
        source2Name: _source2Name,
        functionName: _functionName,
        statusMessage : _statusMessage,
        runState: _runState,
      });
      updateEqcheckList(eqchecks);
    }

    function clearEqchecks() {
        //eqchecks.push({ value: getNewCalicoColor() });
        eqchecks = [];
        //console.log('clearEqchecks Called');
        updateEqcheckList(eqchecks);
    }
}());
