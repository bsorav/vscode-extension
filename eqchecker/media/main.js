//@ts-check

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    const vscode = acquireVsCodeApi();

    const oldState = vscode.getState() || { eqchecks: [] };

    /** @type {Array<{ value: string }>} */
    let eqchecks = oldState.eqchecks;

    updateEqcheckList(eqchecks);

    document.querySelector('.add-eqcheck-button').addEventListener('click', () => {
        addEqcheck();
    });

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'addEqcheck':
                {
                    addEqcheck();
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
     * @param {Array<{ value: string }>} eqchecks
     */
    function updateEqcheckList(eqchecks) {
        const ul = document.querySelector('.eqcheck-list');
        ul.textContent = '';
        for (const eqcheck of eqchecks) {
            const li = document.createElement('li');
            li.className = 'eqcheck-entry';

            const eqcheckPreview = document.createElement('div');
            eqcheckPreview.className = 'eqcheck-preview';
            eqcheckPreview.style.backgroundColor = `#${eqcheck.value}`;
            eqcheckPreview.addEventListener('click', () => {
                onEqcheckClicked(eqcheck.value);
            });
            li.appendChild(eqcheckPreview);

            const input = document.createElement('input');
            input.className = 'eqcheck-input';
            input.type = 'text';
            input.value = eqcheck.value;
            input.addEventListener('change', (e) => {
                const value = e.target.value;
                if (!value) {
                    // Treat empty value as delete
                    eqchecks.splice(eqchecks.indexOf(eqcheck), 1);
                } else {
                    eqcheck.value = value;
                }
                updateEqcheckList(eqchecks);
            });
            li.appendChild(input);

            ul.appendChild(li);
        }

        // Update the saved state
        vscode.setState({ eqchecks : eqchecks });
    }

    /** 
     * @param {string} eqcheck
     */
    function onEqcheckClicked(eqcheck) {
        vscode.postMessage({ type: 'eqcheckSelected', value: eqcheck });
    }

    /**
     * @returns string
     */
    function getNewCalicoColor() {
        const colors = ['020202', 'f1eeee', 'a85b20', 'daab70', 'efcb99'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    function addEqcheck() {
        eqchecks.push({ value: getNewCalicoColor() });
        updateEqcheckList(eqchecks);
    }
}());


