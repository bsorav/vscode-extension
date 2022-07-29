/* eslint-disable @typescript-eslint/naming-convention */
/*
    PRODUCT CFG 
*/


var vscode = acquireVsCodeApi();


var prod_cfg = null;

window.addEventListener('message', async event => {
    const messgae = event.data;
    prod_cfg = messgae;
    console.log(prod_cfg);
});


async function waitForMessage(){
    // console.log(prod_cfg);
    while(prod_cfg === null){
        await new Promise(r => window.setTimeout(r, 100));
    }
}

await waitForMessage();


function initializeContainer(){
    let container = document.getElementById('cfg');
    container.style.width = '100%';
    container.style.height = '100%';
}

function drawNetwork(cfg) {

    var nodeMap = {};
    var idx = 0;
    cfg["nodes"].forEach(element => {
        nodeMap[element] = idx;
        idx++;
    });

    var nodes = new vis.DataSet(cfg["nodes"].map(function(node, idx) {return {id:idx, label:node[0] + "," + node[1]};}));
    var edges = new vis.DataSet(cfg["edges"].map(function(edge) {return {from:nodeMap[edge.from], to:nodeMap[edge.to], label:edge.path1 + '\n\n' +edge.path2};}));

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

