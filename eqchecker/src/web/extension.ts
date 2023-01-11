// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "eqchecker" is now active in the web extension host!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('eqchecker.checkEq', () => {
		// Get labels of opened files in all groups
        let tabs = vscode.window.tabGroups.all.flatMap(({ tabs }) => tabs);
	    //console.log("tabs size = ");
		//console.log(tabs.length);
		let cSources : (typeof tabs) = [];
		let asmSources : (typeof tabs) = [];
		tabs.forEach(function(entry) {
			//console.log('label = ' + entry.label);
			//console.log('isActive = ' + entry.isActive);
			//console.log('isDirty = ' + entry.isDirty);
			//console.log('isPinned = ' + entry.isPinned);
			//console.log('isPreview = ' + entry.isPreview);
			//console.log('groupViewColumn = ' + entry.group.viewColumn);
			//console.log('\n');
			if (entry.label.endsWith(".c")) {
			  cSources.push(entry);
			} else if (entry.label.endsWith(".s")) {
	          asmSources.push(entry);
			}
			//c_sources.push(tab);
		});
		console.log("Printing C sources:");
		cSources.forEach(function(cSource) { console.log("label = " + cSource.label); });
		console.log("Printing ASM sources:");
		asmSources.forEach(function(asmSource) { console.log("label = " + asmSource.label); });
	    //console.log(tabs);
		//let url = "http://localhost:3000";
		//fetch(url, {method: 'POST', body: JSON.stringify({name: "go"})}).then((response) => response.json()).then((data) => console.log(data));
		// Display a message box to the user
		//vscode.window.showInformationMessage("hello");
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
