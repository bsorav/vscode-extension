// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import { readFileSync } from 'fs';

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
		const panel_prd = vscode.window.createWebviewPanel(
			'productCFG', // Identifies the type of the webview. Used internally
			'Product Control Flow Graph', // Title of the panel displayed to the user
			vscode.ViewColumn.Two, // Editor column to show the new webview panel in.
			{
				enableScripts: true
			} // Webview options. More on these later.
		);

		const panel_src = vscode.window.createWebviewPanel(
			'srcCFG', // Identifies the type of the webview. Used internally
			'Source Control Flow Graph', // Title of the panel displayed to the user
			vscode.ViewColumn.One, // Editor column to show the new webview panel in.
			{
				enableScripts: true
			} // Webview options. More on these later.
		);

		const panel_dst = vscode.window.createWebviewPanel(
			'dstCFG', // Identifies the type of the webview. Used internally
			'Assembly Control Flow Graph', // Title of the panel displayed to the user
			vscode.ViewColumn.Three, // Editor column to show the new webview panel in.
			{
				enableScripts: true
			} // Webview options. More on these later.
			); 
			// vscode.commands.executeCommand("workbench");
		// vscode.commands.executeCommand("workbench.action.editorLayoutTwoRows");
		// vscode.commands.executeCommand("workbench.editor.openSideBySideDirection");
		// vscode.commands.executeCommand("workbench.action.editorLayoutTwoRowsRight");
		
		
		const onDiskPath_css = vscode.Uri.file(
			path.join(context.extensionPath, 'src/web_view/css/index.css')
		);
		const index_css = panel_prd.webview.asWebviewUri(onDiskPath_css);

		var onDiskPath_script = vscode.Uri.file(
			path.join(context.extensionPath, 'src/web_view/scripts/product.js')
		);
		const product_script = panel_prd.webview.asWebviewUri(onDiskPath_script);

		onDiskPath_script = vscode.Uri.file(
			path.join(context.extensionPath, 'src/web_view/scripts/source.js')
		);
		const source_script = panel_prd.webview.asWebviewUri(onDiskPath_script);

		onDiskPath_script = vscode.Uri.file(
			path.join(context.extensionPath, 'src/web_view/scripts/assembly.js')
		);
		const assembly_script = panel_prd.webview.asWebviewUri(onDiskPath_script);

		const onDiskPath_vis = vscode.Uri.file(
			path.join(context.extensionPath, 'node_modules/vis-network/dist/vis-network.min.js')
		);
		const vis = panel_prd.webview.asWebviewUri(onDiskPath_vis);

		panel_prd.webview.html = getProductWebviewContent(context.extensionPath, product_script, index_css);
		panel_src.webview.html = getSourceWebviewContent(context.extensionPath, source_script, index_css, vis);
		panel_dst.webview.html = getAssemblyWebviewContent(context.extensionPath, assembly_script, index_css);



		panel_prd.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case "highlight":
						panel_src.webview.postMessage({
							command:"highlight",
							from:message.from[0],
							to:message.to[0],
							path:message.path1
						  });
						  panel_dst.webview.postMessage({
							command:"highlight",
							from:message.from[1],
							to:message.to[1],
							path:message.path2
						  });
						break;
					case "clear":
						panel_src.webview.postMessage({
							command:"clear"
						});
						panel_dst.webview.postMessage({
						command:"clear"
						});
						break;
					default:
						break;
				}
			},
			undefined,
			context.subscriptions
		  );

	});


	// Code Text

	const src_code =  

	context.subscriptions.push(disposable);
}

function getProductWebviewContent(context_path:string, product_script: vscode.Uri, index_css: vscode.Uri) {

	const html = readFileSync(path.join(context_path, 'src/web_view/views/product.html'));

	return eval('`' + html + '`');
}

function getSourceWebviewContent(context_path:string, source_script: vscode.Uri, index_css: vscode.Uri, vis: vscode.Uri) {

	const html = readFileSync(path.join(context_path, 'src/web_view/views/source.html')).toString();

	return eval('`' + html + '`');
}

function getAssemblyWebviewContent(context_path:string, assembly_script:vscode.Uri, index_css: vscode.Uri) {

	const html = readFileSync(path.join(context_path, 'src/web_view/views/assembly.html')).toString();

	return eval('`' + html + '`');
}

// this method is called when your extension is deactivated
export function deactivate() {}
