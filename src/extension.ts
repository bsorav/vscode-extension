// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "equivalence-checker" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('equivalence-checker.visualize', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		const panel = vscode.window.createWebviewPanel(
			'productCFG', // Identifies the type of the webview. Used internally
			'Product Control Flow Graph', // Title of the panel displayed to the user
			vscode.ViewColumn.One, // Editor column to show the new webview panel in.
			{
				enableScripts: true
			} // Webview options. More on these later.
		  );

		const onDiskPath_p5 = vscode.Uri.file(
			path.join(context.extensionPath, 'node_modules/p5/lib/p5.js')
		);
		const p5_lib = panel.webview.asWebviewUri(onDiskPath_p5);

		const onDiskPath_script = vscode.Uri.file(
			path.join(context.extensionPath, 'src/web_view/sketch.js')
		);
		const script = panel.webview.asWebviewUri(onDiskPath_script);

		console.log(p5_lib, script);

		panel.webview.html = getWebviewContent(p5_lib, script);
	});

	context.subscriptions.push(disposable);
}

function getWebviewContent(p5: vscode.Uri, sketch: vscode.Uri) {
	return `
	<!doctype html>
	<html>
	<head>
	  <script src="${p5}"></script>
	  <script src="${sketch}"></script>
	</head>
	<body>
	</body>
	</html>`;
}

// this method is called when your extension is deactivated
export function deactivate() {}
