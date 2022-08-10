// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import { readFileSync } from 'fs';
import { newSimplify, parseProofFile, pathNode, seriesCombinationOfPath, simplifyPathString, splitMultiControlPath } from './proof_parser';

import * as cp from "child_process";
import { Console } from 'console';

const execShell = (cmd: string) =>
    new Promise<string>((resolve, reject) => {
        cp.exec(cmd, (err, out) => {
            if (err) {
                return reject(err);
            }
            return resolve(out);
        });
    });

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "vscode-extension for the equivalence checker" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	
	
	// PROOF VISUALIZE COMMAND
	let visualize = vscode.commands.registerCommand('equivalence-checker.visualize', async () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user

	
		let proof_file_path = path.join(context.extensionPath, 'eq_check_out/proof.txt');
		let src_code_path = path.join(context.extensionPath, 'eq_check_out/src.txt');
		let dst_code_path = path.join(context.extensionPath, 'eq_check_out/dst.txt');
		// await vscode.window.showOpenDialog().then(result => {proof_file_path = result[0].path;});

		let file = readFileSync(proof_file_path, 'utf8');
		let parsedResult = parseProofFile(file);

		let src_code = readFileSync(src_code_path, 'utf8');

		let dst_code = readFileSync(dst_code_path, 'utf8');

		console.log(parsedResult);
		
		const panel_prd = vscode.window.createWebviewPanel(
			'productCFG', // Identifies the type of the webview. Used internally
			'Product Control Flow Graph', // Title of the panel displayed to the user
			vscode.ViewColumn.Two, // Editor column to show the new webview panel in.
			{
				enableScripts: true,
				 retainContextWhenHidden: true,
			} // Webview options. More on these later.
		);

		// const panel_src = vscode.window.createWebviewPanel(
		// 	'srcCFG', // Identifies the type of the webview. Used internally
		// 	'Source Control Flow Graph', // Title of the panel displayed to the user
		// 	vscode.ViewColumn.One, // Editor column to show the new webview panel in.
		// 	{
		// 		enableScripts: true,
		// 		retainContextWhenHidden: true,
		// 	} // Webview options. More on these later.
		// );


		// const panel_dst = vscode.window.createWebviewPanel(
		// 	'dstCFG', // Identifies the type of the webview. Used internally
		// 	'Destination Control Flow Graph', // Title of the panel displayed to the user
		// 	vscode.ViewColumn.Three, // Editor column to show the new webview panel in.
		// 	{
		// 		enableScripts: true,
		// 		retainContextWhenHidden: true,
		// 	} // Webview options. More on these later.
		// );
		// vscode.comman("workbench.action.editorLayoutTwoRowsRight");

		const panel_src_code = vscode.window.createWebviewPanel(
			'src_code', // Identifies the type of the webview. Used internally
			'Source Code', // Title of the panel displayed to the user
			vscode.ViewColumn.One, // Editor column to show the new webview panel in.
			{
				enableScripts: true,
				 retainContextWhenHidden: true,
			} // Webview options. More on these later.
		);

		const panel_dst_code = vscode.window.createWebviewPanel(
			'dst_code', // Identifies the type of the webview. Used internally
			'Destination Code', // Title of the panel displayed to the user
			vscode.ViewColumn.Three, // Editor column to show the new webview panel in.
			{
				enableScripts: true,
				retainContextWhenHidden: true,
			} // Webview options. More on these later.
		);

		const onDiskPath_css = vscode.Uri.file(
			path.join(context.extensionPath, 'src/web_view/css/index.css')
		);
		const index_css = panel_prd.webview.asWebviewUri(onDiskPath_css);

		var onDiskPath_script = vscode.Uri.file(
			path.join(context.extensionPath, 'src/web_view/scripts/product.js')
		);
		const product_script = panel_prd.webview.asWebviewUri(onDiskPath_script);

		const onDiskPath_prism = vscode.Uri.file(
			path.join(context.extensionPath, 'node_modules/prismjs/prism.js')
		);
		const prism = panel_prd.webview.asWebviewUri(onDiskPath_prism);

		const onDiskPath_prism_css = vscode.Uri.file(
			path.join(context.extensionPath, 'node_modules/prismjs/themes/prism.css')
		);
		const prism_css = panel_prd.webview.asWebviewUri(onDiskPath_prism_css);

		const onDiskPath_prism_ln_css = vscode.Uri.file(
			path.join(context.extensionPath, 'node_modules/prismjs/plugins/line-numbers/prism-line-numbers.css')
		);
		const prism_ln_css = panel_prd.webview.asWebviewUri(onDiskPath_prism_ln_css);

		const onDiskPath_prism_ln_script = vscode.Uri.file(
			path.join(context.extensionPath, 'node_modules/prismjs/plugins/line-numbers/prism-line-numbers.js')
		);
		const prism_ln_script = panel_prd.webview.asWebviewUri(onDiskPath_prism_ln_script);
		
		const vis_network_script = vscode.Uri.file(
			path.join(context.extensionPath, 'node_modules/vis-network/standalone/umd/vis-network.min.js')
		);

		const vis_network = panel_prd.webview.asWebviewUri(vis_network_script);

		onDiskPath_script = vscode.Uri.file(
			path.join(context.extensionPath, 'src/web_view/scripts/src_code.js')
		);
		const src_code_script = panel_prd.webview.asWebviewUri(onDiskPath_script);

		onDiskPath_script = vscode.Uri.file(
			path.join(context.extensionPath, 'src/web_view/scripts/dst_code.js')
		);
		const dst_code_script = panel_prd.webview.asWebviewUri(onDiskPath_script);
		

		// Set the webview content
		
		panel_prd.webview.html = getProductWebviewContent(context.extensionPath, product_script, index_css, vis_network);
		// panel_src.webview.html = getSourceWebviewContent(context.extensionPath, source_script, index_css, vis_network);
		// panel_dst.webview.html = getAssemblyWebviewContent(context.extensionPath, assembly_script, index_css, vis_network);
		
		
		panel_src_code.webview.html = getSourceCodeWebviewContent(context.extensionPath, src_code_script, index_css, prism, prism_css, prism_ln_css, prism_ln_script);
		panel_dst_code.webview.html = getAssemblyCodeWebviewContent(context.extensionPath, dst_code_script, index_css, prism, prism_css, prism_ln_css, prism_ln_script);
		// Message passing to src and dst webview
		
		panel_prd.webview.postMessage(parsedResult).then((res) => {console.log(res);});
		panel_src_code.webview.postMessage({command: "data", code:src_code});
		panel_dst_code.webview.postMessage({command: "data", code:dst_code});

		panel_prd.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case "highlight":
						// panel_src.webview.postMessage({
						// 	command: "highlight",
						// 	from: message.from[0],
						// 	to: message.to[0],
						// 	path: message.path1
						// });
						// panel_dst.webview.postMessage({
						// 	command: "highlight",
						// 	from: message.from[1],
						// 	to: message.to[1],
						// 	path: message.path2
						// });
						panel_src_code.webview.postMessage({
							command: "highlight",
							path: message.path1
						});
						panel_dst_code.webview.postMessage({
							command: "highlight",
							path: message.path2
						});
						break;
					case "clear":
						// panel_src.webview.postMessage({
						// 	command: "clear"
						// });
						// panel_dst.webview.postMessage({
						// 	command: "clear"
						// });
						panel_src_code.webview.postMessage({
							command: "clear"
						});
						panel_dst_code.webview.postMessage({
							command: "clear"
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


	// EQUIVALENCE CHECK COMMAND
	let equivalence = vscode.commands.registerCommand('equivalence-checker.equivalence', async () => {

		await execShell('rm ~/vscode-extension/eq_check_out/*');
		await execShell('echo > ~/vscode-extension/eq_check_out/logs.txt');

		// Select src Code
		let srcCodePath;
		await vscode.window.showOpenDialog().then(result => {srcCodePath = result[0].path;});

		await execShell('cp ' + srcCodePath + ' ~/vscode-extension/eq_check_out/');
		await execShell('cp ' + srcCodePath + ' ~/vscode-extension/eq_check_out/src.txt')


		var openPath = vscode.Uri.parse("file://" + srcCodePath); //A request file path
		vscode.workspace.openTextDocument(openPath).then(doc => {
			vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
		});

		var openPath = vscode.Uri.parse(path.join(context.extensionPath, 'eq_check_out/logs.txt')); //A request file path
		vscode.workspace.openTextDocument(openPath).then(doc => {
			vscode.window.showTextDocument(doc, vscode.ViewColumn.Two);
		});

		let dstCodePath = "";
		await vscode.window.showOpenDialog().then(result => {dstCodePath = result[0].path;});

		await execShell('cp ' + dstCodePath + ' ~/vscode-extension/eq_check_out/');
		// console.log(dstCodePath);

		var openPath = vscode.Uri.parse("file://" + dstCodePath); //A request file path
		vscode.workspace.openTextDocument(openPath).then(doc => {
			vscode.window.showTextDocument(doc, vscode.ViewColumn.Three);
		});


		const dir = await execShell('pwd');
		const res = await execShell('eq32 --unroll-factor 64 ' + srcCodePath + ' ' + dstCodePath + ' --proof ~/vscode-extension/eq_check_out/proof.txt > ~/vscode-extension/eq_check_out/logs.txt');

		if(dstCodePath.endsWith(".s")){
			let temp = dstCodePath;
			dstCodePath += ".o.harvest";
			let dstCodeText = readFileSync(dstCodePath).toString();;

			let idx1 = dstCodeText.indexOf('=iseq\n') + 6;
			let idx2 = dstCodeText.substring(idx1).indexOf('--') + idx1;

			dstCodeText = dstCodeText.substring(idx1, idx2);
			await execShell('echo \"' + dstCodeText + '\" > ~/vscode-extension/eq_check_out/dst.txt');
			dstCodePath = temp;
		}
		else{
			await execShell('cp ' + dstCodePath + ' ~/vscode-extension/eq_check_out/dst.txt');
		}

		var openPath = vscode.Uri.parse(path.join(context.extensionPath, 'eq_check_out/proof.txt')); //A request file path
		vscode.workspace.openTextDocument(openPath).then(doc => {
			vscode.window.showTextDocument(doc, vscode.ViewColumn.Two);
		});
		vscode.window.showInformationMessage("Equivalence Proof Generated");

	});


	context.subscriptions.push(visualize);
	context.subscriptions.push(equivalence);
}

function getProductWebviewContent(context_path: string, product_script: vscode.Uri, index_css: vscode.Uri, vis_network: vscode.Uri) {

	const html = readFileSync(path.join(context_path, 'src/web_view/views/product.html'));

	return eval('`' + html + '`');
}

function getSourceWebviewContent(context_path: string, source_script: vscode.Uri, index_css: vscode.Uri, vis_network: vscode.Uri) {

	const html = readFileSync(path.join(context_path, 'src/web_view/views/source.html')).toString();

	return eval('`' + html + '`');
}

function getSourceCodeWebviewContent(context_path: string, script: vscode.Uri, index_css: vscode.Uri, prism_script: vscode.Uri, prism_css: vscode.Uri, prism_ln_css: vscode.Uri, prism_ln_script: vscode.Uri) {

	const html = readFileSync(path.join(context_path, 'src/web_view/views/src_code.html')).toString();

	return eval('`' + html + '`');
}



function getAssemblyWebviewContent(context_path: string, assembly_script: vscode.Uri, index_css: vscode.Uri, vis_network: vscode.Uri) {

	const html = readFileSync(path.join(context_path, 'src/web_view/views/assembly.html')).toString();

	return eval('`' + html + '`');
}

function getAssemblyCodeWebviewContent(context_path: string, script: vscode.Uri, index_css: vscode.Uri, prism_script: vscode.Uri, prism_css: vscode.Uri, prism_ln_css: vscode.Uri, prism_ln_script: vscode.Uri) {

	const html = readFileSync(path.join(context_path, 'src/web_view/views/dst_code.html')).toString();

	return eval('`' + html + '`');
}

// this method is called when your extension is deactivated
export function deactivate() { }


