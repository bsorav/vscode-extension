/* eslint-disable @typescript-eslint/naming-convention */
/*
    PRODUCT CFG 
*/

// var prod_cfg = {
//     "nodes": [["S_1_1", "D_1_1"], ["S_6_15", "D_9_20"], ["S_6_15", "D_22_29"], ["S_8_1", "D_36_1"]],
//     "edges": [
//         {
//             "from": ["S_1_1", "D_1_1"],
//             "to": ["S_6_15", "D_9_20"],
//             "path1": "S_1_1-S_6_15", 
//             "path2":"D_1_1-D_9_20"
//         },
//         {
//             "from": ["S_6_15", "D_9_20"],
//             "to": ["S_6_15", "D_9_20"],
//             "path1": "S_6_15-S_6_19-S_6_15", 
//             "path2":"D_9_20-D_10_9-D_9_70-D_9_20"
//         },
//         {   
//             "from": ["S_6_15", "D_9_20"],
//             "to": ["S_6_15", "D_22_29"],
//             "path1": "S_6_15-S_6_15",
//             "path2" : "D_9_20-D_12_1-D_22_29"
//         },
//         {
//             "from": ["S_6_15", "D_22_29"],
//             "to" : ["S_6_15", "D_22_29"],
//             "path1": "(S_6_15-S_6_19-S_6_15)^4",
//             "path2": "((D_22_29-D_23_9-D_20_1-D_22_29)+(D_22_29-D_23_9-D_24_40-D_25_11-D_26_11-D_26_11-D_27_11-D_27_11-D_28_11-D_28_11-D_29_11-D_29_11-D_30_11-D_30_11-D_31_11-D_31_11-D_32_11-D_32_11-D_20_1-D_22_29))"
//         },
//         {
//             "from": ["S_6_15", "D_22_29"],
//             "to": ["S_8_1", "D_36_1"],
//             "path1": "(S_6_15-S_6_19-S_6_15)^4-S_7_11-S_8_1",
//             "path2": " D_22_29-D_23_9-((D_25_11-((D_26_11-((D_27_11-((D_28_11-((D_29_11-((D_30_11-((D_31_11-D_32_11-D_32_11-D_32_33-D_35_1)+(D_32_11-D_31_33-D_35_1)))+(D_31_11-D_30_33-D_35_1)))+(D_30_11-D_29_33-D_35_1)))+(D_29_11-D_28_33-D_35_1)))+(D_28_11-D_27_33-D_35_1)))+(D_27_11-D_26_33-D_35_1)))+(D_26_11-D_25_33-D_35_1))-D_36_1"
//         },
//         {
//             "from": ["S_6_15", "D_9_20"],
//             "to": ["S_8_1", "D_36_1"],
//             "path1": "((S_6_15-S_6_19-S_6_15)+(S_6_15))-S_7_11-S_8_1",
//             "path2": "D_9_20-D_10_11-D_10_11-D_11_17-D_35_1-D_36_1"
//         }
//     ]
// };;

// import {Network} from '../../../node_modules/vis-network/standalone/umd/vis-network.min.js';

var vscode = acquireVsCodeApi();

// const prod_cfg = {
//     "nodes" : 
//         [["S_3_1","D_37_1"], ["S_4_20","D_49_5"], ["S_13_1","D_107_5"]],
//     "edges" : 
//         [
//             {
//                 "from" : ["S_3_1","D_37_1"],
//                 "to" : ["S_4_20","D_49_5"],
//                 "path1" : "S_3_1-S_4_20",
//                 "path2" : "D_37_1-D_49_5",
//             },
//             {
//                 "from" : ["S_4_20","D_49_5"],
//                 "to" : ["S_4_20","D_49_5"],
//                 "path1" : "((S_4_20-S_6_13-S_4_20)+(S_4_20-S_8_13-S_4_20)+(S_4_20-S_10_13-S_4_20))^4",
//                 "path2" : "D_49_5-D_106_5-D_49_5",
//             },
//             {
//                 "from" : ["S_4_20","D_49_5"],
//                 "to" : ["S_13_1","D_107_5"],
//                 "path1" : "((S_4_20-S_6_13-S_4_20)+(S_4_20-S_8_13-S_4_20)+(S_4_20-S_10_13-S_4_20))^4-S_13_1",
//                 "path2" : "D_49_5-D_106_5-D_107_5",
//             }
//         ]
// };

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
    container.style.width = window.innerWidth + 'px';
    container.style.height = window.innerHeight + 'px';
}

function drawNetwork(cfg) {

    var nodeMap = {};
    var idx = 0;
    cfg["nodes"].forEach(element => {
        nodeMap[element] = idx;
        idx++;
    });

    var nodes = new vis.DataSet(cfg["nodes"].map(function(node, idx) {return {id:idx, label:node[0] + "," + node[1]};}));
    var edges = new vis.DataSet(cfg["edges"].map(function(edge) {return {from:nodeMap[edge.from], to:nodeMap[edge.to], label:edge.path1 + '\n' +edge.path2};}));

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
                shakeTowards: "leaves"
            }
        },
        physics: {
            enabled: false,
            solver: "hierarchicalRepulsion"
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
    var path1 = edge.label.split('\n')[0];
    var path2 = edge.label.split('\n')[1];

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

