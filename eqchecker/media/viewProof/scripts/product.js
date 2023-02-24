/* eslint-disable @typescript-eslint/naming-convention */
/*
    PRODUCT CFG 
*/

const vscode = acquireVsCodeApi();

var prod_cfg = null;

window.addEventListener('message', async event => {
    const message = event.data;
    //console.log(`RECEIVED EVENT: ${JSON.stringify(message)}\n`);
    switch (message.command) {
      case 'showProof':
        prod_cfg = message.code;
        //prod_cfg = message;
        //console.log(`prod_cfg = ${prod_cfg}`);
        //console.log("RECEIVED showProof\n");
        break;
    }
});

async function waitForMessage(){
    while(prod_cfg === null){
        console.log("prod_cfg is still NULL");
        await new Promise(r => window.setTimeout(r, 1000));
    }
}
vscode.postMessage({command:"loaded"});

//console.log("Waiting for proof\n");
await waitForMessage();
//console.log(`Proof received, prod_cfg =\n${JSON.stringify(prod_cfg)}\n`);

function initializeContainer(){
    let container = document.getElementById('cfg');
    container.style.width = '100%';
    container.style.height = '100%';
}

function drawNetwork(cfg) {

    var nodeMap = {};
    var idx = 0;
    //console.log(`drawNetwork: prod_cfg =\n${JSON.stringify(cfg)}\n`);
    const graph_hierarchy = cfg["graph-hierarchy"];
    //console.log(`drawNetwork: graph_hierarchy=\n${JSON.stringify(graph_hierarchy)}\n`);
    const graph = graph_hierarchy["graph"];
    //console.log(`drawNetwork: graph=\n${JSON.stringify(graph)}\n`);
    const nodes_in = graph["nodes"];
    //console.log(`drawNetwork: nodes_in=\n${JSON.stringify(nodes_in)}\n`);
    var edges_in = graph["edges"];
    //console.log(`drawNetwork: edges_in=\n${JSON.stringify(edges_in)}\n`);

    nodes_in.forEach(element => {
        nodeMap[element.pc] = idx;
        idx++;
    });

    var nodes = new vis.DataSet(nodes_in.map(function(node, idx) {return {id:idx, label:node.pc/*node[0] + "," + node[1]*/};}));
    var edges = new vis.DataSet(edges_in.map(function(edge) {return {from:nodeMap[edge.from_pc], to:nodeMap[edge.to_pc], label:""/*edge.path1 + '\n\n' +edge.path2*/};}));

    var network = new vis.Network(document.getElementById('cfg'), {
        nodes: nodes,
        edges: edges
    }, {
        nodes: {
            shape: 'ellipse',
            scaling: {
                label: {
                    enabled: true
                }
            }
        },
        edges: {
            arrows: {
                to: {
                    enabled: true,
                },
            },
            smooth: {
                enabled: true,
                type: "continuous",
                roundness: 0.5,
                forceDirection: "vertical"
            },
            font: {
                align: 'horizontal',
            },
            chosen: {
                edge:   function(values, id, selected, hovering) {
                    if(selected){
                        values.color = 'rgb(255, 0, 0)';
                    }
                  }
            },
            width: 3,
            widthConstraint: {
                maximum: 300,
            }
        },
        layout: {
            hierarchical: {
                direction: "UD",
                enabled: true,
                levelSeparation: 300,
                nodeSpacing: 200,
                // shakeTowards: "leaves"
            }
        },
        physics: {
            enabled: false,
            // solver: "hierarchicalRepulsion"
        }
    });

    return {network:network, nodeMap:nodeMap};
}

initializeContainer();
var res = drawNetwork(prod_cfg);

var network = res.network;
var nodeMap = res.nodeMap;

network.on('selectEdge', function(properties) {
    let edgeId = properties.edges[0];
    let edge = network.body.data.edges.get(edgeId);

    var from = prod_cfg["nodes"][edge.from];
    var to = prod_cfg["nodes"][edge.to];
    var path1 = edge.label.split('\n\n')[0];
    var path2 = edge.label.split('\n\n')[1];

    vscode.postMessage({
        command:"highlight",
        from: from,
        to: to,
        path1: path1,
        path2: path2
    });
});

network.on('deselectEdge', function(properties) {
    vscode.postMessage({
        command:"clear"
    });
});
